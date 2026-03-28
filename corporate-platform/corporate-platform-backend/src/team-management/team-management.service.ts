import { Injectable } from '@nestjs/common';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { CreateMemberDto } from './dto/create-member.dto';
import { UpdateMemberDto } from './dto/update-member.dto';
import { AssignRoleDto } from './dto/assign-role.dto';
import { InviteMemberDto } from './dto/invite-member.dto';
import { CreateRoleDto, UpdateRoleDto } from './dto/manage-role.dto';
import { MembersService } from './services/members.service';
import { RolesService } from './services/roles.service';
import { PermissionsService } from './services/permissions.service';
import { InvitationsService } from './services/invitations.service';

@Injectable()
export class TeamManagementService {
  constructor(
    private readonly membersService: MembersService,
    private readonly rolesService: RolesService,
    private readonly permissionsService: PermissionsService,
    private readonly invitationsService: InvitationsService,
  ) {}

  listMembers(user: JwtPayload) {
    return this.membersService.listMembers(user.companyId);
  }

  getMember(user: JwtPayload, memberId: string) {
    return this.membersService.getMemberById(user.companyId, memberId);
  }

  createMember(user: JwtPayload, dto: CreateMemberDto) {
    return this.membersService.createMember(user.companyId, user.sub, dto);
  }

  updateMember(user: JwtPayload, memberId: string, dto: UpdateMemberDto) {
    return this.membersService.updateMember(
      user.companyId,
      user.sub,
      memberId,
      dto,
    );
  }

  deactivateMember(user: JwtPayload, memberId: string) {
    return this.membersService.deactivateMember(
      user.companyId,
      user.sub,
      memberId,
    );
  }

  reactivateMember(user: JwtPayload, memberId: string) {
    return this.membersService.reactivateMember(
      user.companyId,
      user.sub,
      memberId,
    );
  }

  assignRole(user: JwtPayload, memberId: string, dto: AssignRoleDto) {
    return this.membersService.assignRole(
      user.companyId,
      user.sub,
      memberId,
      dto.roleId,
    );
  }

  listRoles(user: JwtPayload) {
    return this.rolesService.listRoles(user.companyId);
  }

  createRole(user: JwtPayload, dto: CreateRoleDto) {
    return this.rolesService.createRole(user.companyId, user.sub, dto);
  }

  updateRole(user: JwtPayload, roleId: string, dto: UpdateRoleDto) {
    return this.rolesService.updateRole(user.companyId, user.sub, roleId, dto);
  }

  deleteRole(user: JwtPayload, roleId: string) {
    return this.rolesService.deleteRole(user.companyId, user.sub, roleId);
  }

  listPermissions() {
    return this.permissionsService.listAvailablePermissions();
  }

  myPermissions(user: JwtPayload) {
    return this.permissionsService.getMyPermissions(user);
  }

  inviteMember(user: JwtPayload, dto: InviteMemberDto) {
    return this.invitationsService.inviteMember(user.companyId, user.sub, dto);
  }

  listInvitations(user: JwtPayload) {
    return this.invitationsService.listPendingInvitations(user.companyId);
  }

  acceptInvitation(user: JwtPayload, token: string) {
    return this.invitationsService.acceptInvitation(user, token);
  }

  resendInvitation(user: JwtPayload, invitationId: string) {
    return this.invitationsService.resendInvitation(
      user.companyId,
      user.sub,
      invitationId,
    );
  }

  cancelInvitation(user: JwtPayload, invitationId: string) {
    return this.invitationsService.cancelInvitation(
      user.companyId,
      user.sub,
      invitationId,
    );
  }
}
