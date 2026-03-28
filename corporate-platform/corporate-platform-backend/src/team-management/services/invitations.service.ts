import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomBytes } from 'crypto';
import { PrismaService } from '../../shared/database/prisma.service';
import { InviteMemberDto } from '../dto/invite-member.dto';
import { JwtPayload } from '../../auth/interfaces/jwt-payload.interface';
import { RolesService } from './roles.service';

const INVITATION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

@Injectable()
export class InvitationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rolesService: RolesService,
  ) {}

  private get invitationRepo() {
    return (this.prisma as any).invitation;
  }

  private get roleRepo() {
    return (this.prisma as any).role;
  }

  private get memberRepo() {
    return (this.prisma as any).teamMember;
  }

  private get userRepo() {
    return (this.prisma as any).user;
  }

  async inviteMember(companyId: string, actorId: string, dto: InviteMemberDto) {
    await this.rolesService.ensureSystemRoles(companyId);

    const role = await this.roleRepo.findFirst({
      where: { id: dto.roleId, companyId },
    });

    if (!role) {
      throw new NotFoundException('Role not found');
    }

    const existingMember = await this.memberRepo.findFirst({
      where: {
        companyId,
        email: dto.email,
        status: {
          in: ['ACTIVE', 'PENDING'],
        },
      },
    });

    if (existingMember) {
      throw new ConflictException('Member already exists with this email');
    }

    const existingPending = await this.invitationRepo.findFirst({
      where: {
        companyId,
        email: dto.email,
        status: 'PENDING',
      },
    });

    if (existingPending) {
      throw new ConflictException(
        'Pending invitation already exists for this email',
      );
    }

    const invitation = await this.invitationRepo.create({
      data: {
        companyId,
        email: dto.email,
        roleId: dto.roleId,
        invitedBy: actorId,
        token: this.generateToken(),
        expiresAt: new Date(Date.now() + INVITATION_TTL_MS),
        status: 'PENDING',
      },
      include: { role: true },
    });

    await (this.prisma as any).auditLog.create({
      data: {
        companyId,
        userId: actorId,
        eventType: 'team.invitation.created',
        severity: 'INFO',
        resource: 'team-management',
        method: 'INVITE_MEMBER',
        details: {
          invitationId: invitation.id,
          email: dto.email,
          roleId: dto.roleId,
        },
        status: 'SUCCESS',
        statusCode: 201,
      },
    });

    return invitation;
  }

  async listPendingInvitations(companyId: string) {
    await this.expireInvitations(companyId);

    return this.invitationRepo.findMany({
      where: { companyId, status: 'PENDING' },
      include: { role: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async acceptInvitation(user: JwtPayload, token: string) {
    const invitation = await this.invitationRepo.findFirst({
      where: { token },
      include: { role: true },
    });

    if (!invitation) {
      throw new NotFoundException('Invitation not found');
    }

    if (invitation.status !== 'PENDING') {
      throw new BadRequestException('Invitation is no longer pending');
    }

    if (invitation.expiresAt.getTime() < Date.now()) {
      await this.invitationRepo.update({
        where: { id: invitation.id },
        data: { status: 'EXPIRED' },
      });
      throw new BadRequestException('Invitation has expired');
    }

    if (user.email.toLowerCase() !== invitation.email.toLowerCase()) {
      throw new ForbiddenException(
        'Invitation email does not match current user',
      );
    }

    const userRecord = await this.userRepo.findFirst({
      where: { id: user.sub },
    });
    if (!userRecord) {
      throw new NotFoundException('User not found');
    }

    if (userRecord.companyId !== invitation.companyId) {
      throw new ForbiddenException(
        'User does not belong to invitation company',
      );
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const acceptedInvitation = await (tx as any).invitation.update({
        where: { id: invitation.id },
        data: {
          status: 'ACCEPTED',
          acceptedAt: new Date(),
        },
      });

      const existingMember = await (tx as any).teamMember.findFirst({
        where: {
          companyId: invitation.companyId,
          userId: user.sub,
        },
      });

      let member;
      if (existingMember) {
        member = await (tx as any).teamMember.update({
          where: { id: existingMember.id },
          data: {
            roleId: invitation.roleId,
            status: 'ACTIVE',
            invitedAt: invitation.createdAt,
            invitedBy: invitation.invitedBy,
            lastActiveAt: new Date(),
          },
          include: { role: true },
        });
      } else {
        member = await (tx as any).teamMember.create({
          data: {
            companyId: invitation.companyId,
            userId: user.sub,
            email: invitation.email,
            firstName: userRecord.firstName,
            lastName: userRecord.lastName,
            roleId: invitation.roleId,
            status: 'ACTIVE',
            joinedAt: new Date(),
            invitedAt: invitation.createdAt,
            invitedBy: invitation.invitedBy,
            lastActiveAt: new Date(),
          },
          include: { role: true },
        });
      }

      await this.rolesService.syncMemberCount(invitation.roleId);
      if (existingMember && existingMember.roleId !== invitation.roleId) {
        await this.rolesService.syncMemberCount(existingMember.roleId);
      }

      await (tx as any).auditLog.create({
        data: {
          companyId: invitation.companyId,
          userId: user.sub,
          eventType: 'team.invitation.accepted',
          severity: 'INFO',
          resource: 'team-management',
          method: 'ACCEPT_INVITATION',
          details: {
            invitationId: invitation.id,
            memberId: member.id,
            roleId: invitation.roleId,
          },
          status: 'SUCCESS',
          statusCode: 200,
        },
      });

      return {
        invitation: acceptedInvitation,
        member,
      };
    });

    return result;
  }

  async resendInvitation(
    companyId: string,
    actorId: string,
    invitationId: string,
  ) {
    const invitation = await this.invitationRepo.findFirst({
      where: { id: invitationId, companyId },
    });

    if (!invitation) {
      throw new NotFoundException('Invitation not found');
    }

    if (invitation.status !== 'PENDING') {
      throw new BadRequestException('Only pending invitations can be resent');
    }

    const updated = await this.invitationRepo.update({
      where: { id: invitationId },
      data: {
        token: this.generateToken(),
        expiresAt: new Date(Date.now() + INVITATION_TTL_MS),
      },
      include: { role: true },
    });

    await (this.prisma as any).auditLog.create({
      data: {
        companyId,
        userId: actorId,
        eventType: 'team.invitation.resent',
        severity: 'INFO',
        resource: 'team-management',
        method: 'RESEND_INVITATION',
        details: {
          invitationId,
          email: invitation.email,
        },
        status: 'SUCCESS',
        statusCode: 200,
      },
    });

    return updated;
  }

  async cancelInvitation(
    companyId: string,
    actorId: string,
    invitationId: string,
  ) {
    const invitation = await this.invitationRepo.findFirst({
      where: { id: invitationId, companyId },
    });

    if (!invitation) {
      throw new NotFoundException('Invitation not found');
    }

    await this.invitationRepo.delete({ where: { id: invitationId } });

    await (this.prisma as any).auditLog.create({
      data: {
        companyId,
        userId: actorId,
        eventType: 'team.invitation.cancelled',
        severity: 'INFO',
        resource: 'team-management',
        method: 'CANCEL_INVITATION',
        details: {
          invitationId,
          email: invitation.email,
        },
        status: 'SUCCESS',
        statusCode: 200,
      },
    });

    return { success: true };
  }

  private async expireInvitations(companyId: string): Promise<void> {
    await this.invitationRepo.updateMany({
      where: {
        companyId,
        status: 'PENDING',
        expiresAt: { lt: new Date() },
      },
      data: {
        status: 'EXPIRED',
      },
    });
  }

  private generateToken(): string {
    return randomBytes(32).toString('hex');
  }
}
