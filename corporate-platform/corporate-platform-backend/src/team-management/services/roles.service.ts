import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../shared/database/prisma.service';
import { CreateRoleDto, UpdateRoleDto } from '../dto/manage-role.dto';
import {
  ALL_PERMISSIONS,
  ROLE_PERMISSIONS,
} from '../../rbac/constants/permissions.constants';

type TeamRoleEntity = {
  id: string;
  companyId: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  permissions: unknown;
  memberCount: number;
  createdAt: Date;
  updatedAt: Date;
};

@Injectable()
export class RolesService {
  constructor(private readonly prisma: PrismaService) {}

  private get roleRepo() {
    return (this.prisma as any).role;
  }

  private get memberRepo() {
    return (this.prisma as any).teamMember;
  }

  private readonly systemRoleSeeds = [
    {
      name: 'ADMIN',
      description: 'Full access to all team and platform operations',
      permissions: [...ALL_PERMISSIONS],
    },
    {
      name: 'MANAGER',
      description: 'Operational management and reporting permissions',
      permissions: [...ROLE_PERMISSIONS.manager],
    },
    {
      name: 'ANALYST',
      description: 'Read and analytics-focused permissions',
      permissions: [...ROLE_PERMISSIONS.analyst],
    },
    {
      name: 'VIEWER',
      description: 'Read-only access to core workspace data',
      permissions: [...ROLE_PERMISSIONS.viewer],
    },
  ];

  async ensureSystemRoles(companyId: string): Promise<void> {
    for (const seed of this.systemRoleSeeds) {
      await this.roleRepo.upsert({
        where: {
          companyId_name: {
            companyId,
            name: seed.name,
          },
        },
        create: {
          companyId,
          name: seed.name,
          description: seed.description,
          isSystem: true,
          permissions: seed.permissions,
        },
        update: {
          isSystem: true,
          permissions: seed.permissions,
          description: seed.description,
        },
      });
    }
  }

  async listRoles(companyId: string): Promise<TeamRoleEntity[]> {
    await this.ensureSystemRoles(companyId);
    const roles = (await this.roleRepo.findMany({
      where: { companyId },
      orderBy: [{ isSystem: 'desc' }, { name: 'asc' }],
    })) as TeamRoleEntity[];

    return roles.map((role) => ({
      ...role,
      permissions: this.parsePermissions(role.permissions),
    }));
  }

  async getRoleById(
    companyId: string,
    roleId: string,
  ): Promise<TeamRoleEntity> {
    await this.ensureSystemRoles(companyId);
    const role = (await this.roleRepo.findFirst({
      where: { id: roleId, companyId },
    })) as TeamRoleEntity | null;

    if (!role) {
      throw new NotFoundException('Role not found');
    }

    return {
      ...role,
      permissions: this.parsePermissions(role.permissions),
    };
  }

  async createRole(companyId: string, actorId: string, dto: CreateRoleDto) {
    await this.ensureSystemRoles(companyId);
    const normalizedName = this.normalizeRoleName(dto.name);
    if (this.systemRoleSeeds.some((seed) => seed.name === normalizedName)) {
      throw new ConflictException('System role names are reserved');
    }

    const permissions = this.validatePermissions(dto.permissions);

    const created = (await this.roleRepo.create({
      data: {
        companyId,
        name: normalizedName,
        description: dto.description,
        isSystem: false,
        permissions,
      },
    })) as TeamRoleEntity;

    await this.logAudit(companyId, actorId, 'team.role.created', {
      roleId: created.id,
      roleName: created.name,
      permissions,
    });

    return {
      ...created,
      permissions,
    };
  }

  async updateRole(
    companyId: string,
    actorId: string,
    roleId: string,
    dto: UpdateRoleDto,
  ) {
    const existing = await this.getRoleById(companyId, roleId);

    if (existing.isSystem) {
      throw new ForbiddenException('System roles cannot be modified');
    }

    const updatedPermissions = dto.permissions
      ? this.validatePermissions(dto.permissions)
      : this.parsePermissions(existing.permissions);

    const updated = (await this.roleRepo.update({
      where: { id: roleId },
      data: {
        ...(dto.description !== undefined
          ? { description: dto.description }
          : {}),
        ...(dto.permissions !== undefined
          ? { permissions: updatedPermissions }
          : {}),
      },
    })) as TeamRoleEntity;

    await this.logAudit(companyId, actorId, 'team.role.updated', {
      roleId,
      descriptionChanged: dto.description !== undefined,
      permissionsChanged: dto.permissions !== undefined,
      permissions: updatedPermissions,
    });

    return {
      ...updated,
      permissions: this.parsePermissions(updated.permissions),
    };
  }

  async deleteRole(companyId: string, actorId: string, roleId: string) {
    const existing = await this.getRoleById(companyId, roleId);

    if (existing.isSystem) {
      throw new ForbiddenException('System roles cannot be deleted');
    }

    const assigned = await this.memberRepo.count({
      where: { roleId, status: 'ACTIVE' },
    });
    if (assigned > 0) {
      throw new ConflictException('Cannot delete role with active members');
    }

    await this.roleRepo.delete({ where: { id: roleId } });

    await this.logAudit(companyId, actorId, 'team.role.deleted', {
      roleId,
      roleName: existing.name,
    });

    return { success: true };
  }

  async syncMemberCount(roleId: string): Promise<void> {
    const activeMembers = await this.memberRepo.count({
      where: { roleId, status: 'ACTIVE' },
    });

    await this.roleRepo.update({
      where: { id: roleId },
      data: { memberCount: activeMembers },
    });
  }

  private normalizeRoleName(name: string): string {
    return name.trim().toUpperCase();
  }

  private validatePermissions(candidate: string[]): string[] {
    const unique = Array.from(
      new Set(candidate.map((permission) => permission.trim())),
    ).filter(Boolean);
    if (unique.length === 0) {
      throw new BadRequestException('Role must have at least one permission');
    }

    const invalid = unique.filter(
      (permission) => !ALL_PERMISSIONS.includes(permission as any),
    );
    if (invalid.length > 0) {
      throw new BadRequestException(
        `Invalid permission(s): ${invalid.join(', ')}`,
      );
    }

    return unique;
  }

  private parsePermissions(value: unknown): string[] {
    if (Array.isArray(value)) {
      return value.filter(
        (entry): entry is string => typeof entry === 'string',
      );
    }

    return [];
  }

  private async logAudit(
    companyId: string,
    userId: string,
    eventType: string,
    details: Record<string, unknown>,
  ): Promise<void> {
    await (this.prisma as any).auditLog.create({
      data: {
        companyId,
        userId,
        eventType,
        severity: 'INFO',
        resource: 'team-management',
        method: 'TEAM_ROLE',
        details,
        status: 'SUCCESS',
        statusCode: 200,
      },
    });
  }
}
