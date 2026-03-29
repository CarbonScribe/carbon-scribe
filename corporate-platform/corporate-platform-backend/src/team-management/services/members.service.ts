import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../shared/database/prisma.service';
import { CreateMemberDto } from '../dto/create-member.dto';
import { UpdateMemberDto } from '../dto/update-member.dto';
import { RolesService } from './roles.service';

type TeamMemberEntity = {
  id: string;
  companyId: string;
  userId: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  roleId: string;
  status: string;
  joinedAt: Date;
  invitedBy: string | null;
  invitedAt: Date | null;
  lastActiveAt: Date | null;
  metadata: unknown;
  department: string | null;
  title: string | null;
  role?: { id: string; name: string; permissions: unknown };
};

@Injectable()
export class MembersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rolesService: RolesService,
  ) {}

  private get memberRepo() {
    return (this.prisma as any).teamMember;
  }

  private get roleRepo() {
    return (this.prisma as any).role;
  }

  private get userRepo() {
    return (this.prisma as any).user;
  }

  async listMembers(companyId: string) {
    const members = (await this.memberRepo.findMany({
      where: { companyId },
      include: { role: true },
      orderBy: { joinedAt: 'desc' },
    })) as TeamMemberEntity[];

    return members;
  }

  async getMemberById(companyId: string, memberId: string) {
    const member = (await this.memberRepo.findFirst({
      where: { id: memberId, companyId },
      include: { role: true },
    })) as TeamMemberEntity | null;

    if (!member) {
      throw new NotFoundException('Team member not found');
    }

    return member;
  }

  async createMember(companyId: string, actorId: string, dto: CreateMemberDto) {
    await this.rolesService.ensureSystemRoles(companyId);

    const role = await this.roleRepo.findFirst({
      where: { id: dto.roleId, companyId },
    });

    if (!role) {
      throw new NotFoundException('Role not found');
    }

    const user = dto.userId
      ? await this.userRepo.findFirst({ where: { id: dto.userId } })
      : await this.userRepo.findFirst({ where: { email: dto.email } });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.companyId !== companyId) {
      throw new ForbiddenException(
        'User does not belong to the current company',
      );
    }

    const existingMember = await this.memberRepo.findFirst({
      where: { companyId, userId: user.id },
    });

    if (existingMember) {
      throw new ConflictException('Team member already exists for this user');
    }

    const status = dto.status ?? 'ACTIVE';

    const created = await this.prisma.$transaction(async (tx) => {
      const member = (await (tx as any).teamMember.create({
        data: {
          companyId,
          userId: user.id,
          email: dto.email,
          firstName: dto.firstName ?? user.firstName,
          lastName: dto.lastName ?? user.lastName,
          roleId: dto.roleId,
          status,
          joinedAt: new Date(),
          invitedBy: actorId,
          invitedAt: new Date(),
          metadata: dto.metadata,
          department: dto.department,
          title: dto.title,
        },
        include: { role: true },
      })) as TeamMemberEntity;

      if (status === 'ACTIVE') {
        await this.rolesService.syncMemberCount(dto.roleId);
      }

      await (tx as any).auditLog.create({
        data: {
          companyId,
          userId: actorId,
          eventType: 'team.member.created',
          severity: 'INFO',
          resource: 'team-management',
          method: 'CREATE_MEMBER',
          details: {
            memberId: member.id,
            roleId: dto.roleId,
            status,
          },
          status: 'SUCCESS',
          statusCode: 201,
        },
      });

      return member;
    });

    return created;
  }

  async updateMember(
    companyId: string,
    actorId: string,
    memberId: string,
    dto: UpdateMemberDto,
  ) {
    const existing = await this.getMemberById(companyId, memberId);

    const updated = (await this.memberRepo.update({
      where: { id: memberId },
      data: {
        ...(dto.firstName !== undefined ? { firstName: dto.firstName } : {}),
        ...(dto.lastName !== undefined ? { lastName: dto.lastName } : {}),
        ...(dto.status !== undefined ? { status: dto.status } : {}),
        ...(dto.department !== undefined ? { department: dto.department } : {}),
        ...(dto.title !== undefined ? { title: dto.title } : {}),
        ...(dto.metadata !== undefined ? { metadata: dto.metadata } : {}),
      },
      include: { role: true },
    })) as TeamMemberEntity;

    if (dto.status && dto.status !== existing.status) {
      await this.rolesService.syncMemberCount(existing.roleId);
    }

    await (this.prisma as any).auditLog.create({
      data: {
        companyId,
        userId: actorId,
        eventType: 'team.member.updated',
        severity: 'INFO',
        resource: 'team-management',
        method: 'UPDATE_MEMBER',
        details: {
          memberId,
          previousStatus: existing.status,
          nextStatus: updated.status,
        },
        status: 'SUCCESS',
        statusCode: 200,
      },
    });

    return updated;
  }

  async deactivateMember(companyId: string, actorId: string, memberId: string) {
    const existing = await this.getMemberById(companyId, memberId);

    if (existing.status === 'INACTIVE') {
      return existing;
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const member = await (tx as any).teamMember.update({
        where: { id: memberId },
        data: { status: 'INACTIVE' },
        include: { role: true },
      });

      await this.rolesService.syncMemberCount(existing.roleId);

      await (tx as any).auditLog.create({
        data: {
          companyId,
          userId: actorId,
          eventType: 'team.member.deactivated',
          severity: 'INFO',
          resource: 'team-management',
          method: 'DEACTIVATE_MEMBER',
          details: {
            memberId,
            previousStatus: existing.status,
            nextStatus: 'INACTIVE',
          },
          status: 'SUCCESS',
          statusCode: 200,
        },
      });

      return member;
    });

    return updated;
  }

  async reactivateMember(companyId: string, actorId: string, memberId: string) {
    const existing = await this.getMemberById(companyId, memberId);

    if (existing.status === 'ACTIVE') {
      return existing;
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const member = await (tx as any).teamMember.update({
        where: { id: memberId },
        data: { status: 'ACTIVE', lastActiveAt: new Date() },
        include: { role: true },
      });

      await this.rolesService.syncMemberCount(existing.roleId);

      await (tx as any).auditLog.create({
        data: {
          companyId,
          userId: actorId,
          eventType: 'team.member.reactivated',
          severity: 'INFO',
          resource: 'team-management',
          method: 'REACTIVATE_MEMBER',
          details: {
            memberId,
            previousStatus: existing.status,
            nextStatus: 'ACTIVE',
          },
          status: 'SUCCESS',
          statusCode: 200,
        },
      });

      return member;
    });

    return updated;
  }

  async assignRole(
    companyId: string,
    actorId: string,
    memberId: string,
    roleId: string,
  ) {
    const existing = await this.getMemberById(companyId, memberId);
    const nextRole = await this.roleRepo.findFirst({
      where: { id: roleId, companyId },
    });

    if (!nextRole) {
      throw new NotFoundException('Role not found');
    }

    if (existing.roleId === roleId) {
      return existing;
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const member = (await (tx as any).teamMember.update({
        where: { id: memberId },
        data: { roleId },
        include: { role: true },
      })) as TeamMemberEntity;

      if (existing.status === 'ACTIVE') {
        await this.rolesService.syncMemberCount(existing.roleId);
        await this.rolesService.syncMemberCount(roleId);
      }

      await (tx as any).auditLog.create({
        data: {
          companyId,
          userId: actorId,
          eventType: 'team.member.role_assigned',
          severity: 'INFO',
          resource: 'team-management',
          method: 'ASSIGN_ROLE',
          details: {
            memberId,
            previousRoleId: existing.roleId,
            nextRoleId: roleId,
          },
          status: 'SUCCESS',
          statusCode: 200,
        },
      });

      return member;
    });

    return updated;
  }
}
