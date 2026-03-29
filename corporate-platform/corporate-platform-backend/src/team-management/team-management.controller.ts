import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { PermissionsGuard } from '../rbac/guards/permissions.guard';
import { Permissions } from '../rbac/decorators/permissions.decorator';
import {
  ADMIN_USER_MANAGE,
  TEAM_INVITE,
  TEAM_MANAGE_ROLES,
  TEAM_REMOVE,
  TEAM_VIEW,
} from '../rbac/constants/permissions.constants';
import { TeamManagementService } from './team-management.service';
import { CreateMemberDto } from './dto/create-member.dto';
import { UpdateMemberDto } from './dto/update-member.dto';
import { AssignRoleDto } from './dto/assign-role.dto';
import { InviteMemberDto } from './dto/invite-member.dto';
import { CreateRoleDto, UpdateRoleDto } from './dto/manage-role.dto';

@Controller('api/v1/team')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class TeamManagementController {
  constructor(private readonly teamManagementService: TeamManagementService) {}

  @Get('members')
  @Permissions(TEAM_VIEW)
  listMembers(@CurrentUser() user: JwtPayload) {
    return this.teamManagementService.listMembers(user);
  }

  @Get('members/:id')
  @Permissions(TEAM_VIEW)
  getMember(@CurrentUser() user: JwtPayload, @Param('id') memberId: string) {
    return this.teamManagementService.getMember(user, memberId);
  }

  @Post('members')
  @Permissions(ADMIN_USER_MANAGE)
  createMember(@CurrentUser() user: JwtPayload, @Body() dto: CreateMemberDto) {
    return this.teamManagementService.createMember(user, dto);
  }

  @Put('members/:id')
  @Permissions(ADMIN_USER_MANAGE)
  updateMember(
    @CurrentUser() user: JwtPayload,
    @Param('id') memberId: string,
    @Body() dto: UpdateMemberDto,
  ) {
    return this.teamManagementService.updateMember(user, memberId, dto);
  }

  @Delete('members/:id')
  @Permissions(TEAM_REMOVE)
  deactivateMember(
    @CurrentUser() user: JwtPayload,
    @Param('id') memberId: string,
  ) {
    return this.teamManagementService.deactivateMember(user, memberId);
  }

  @Post('members/:id/reactivate')
  @Permissions(TEAM_REMOVE)
  reactivateMember(
    @CurrentUser() user: JwtPayload,
    @Param('id') memberId: string,
  ) {
    return this.teamManagementService.reactivateMember(user, memberId);
  }

  @Post('members/:id/role')
  @Permissions(TEAM_MANAGE_ROLES)
  assignRole(
    @CurrentUser() user: JwtPayload,
    @Param('id') memberId: string,
    @Body() dto: AssignRoleDto,
  ) {
    return this.teamManagementService.assignRole(user, memberId, dto);
  }

  @Get('roles')
  @Permissions(TEAM_VIEW)
  listRoles(@CurrentUser() user: JwtPayload) {
    return this.teamManagementService.listRoles(user);
  }

  @Post('roles')
  @Permissions(TEAM_MANAGE_ROLES)
  createRole(@CurrentUser() user: JwtPayload, @Body() dto: CreateRoleDto) {
    return this.teamManagementService.createRole(user, dto);
  }

  @Put('roles/:id')
  @Permissions(TEAM_MANAGE_ROLES)
  updateRole(
    @CurrentUser() user: JwtPayload,
    @Param('id') roleId: string,
    @Body() dto: UpdateRoleDto,
  ) {
    return this.teamManagementService.updateRole(user, roleId, dto);
  }

  @Delete('roles/:id')
  @Permissions(TEAM_MANAGE_ROLES)
  deleteRole(@CurrentUser() user: JwtPayload, @Param('id') roleId: string) {
    return this.teamManagementService.deleteRole(user, roleId);
  }

  @Get('permissions')
  @Permissions(TEAM_VIEW)
  listPermissions() {
    return this.teamManagementService.listPermissions();
  }

  @Get('permissions/my')
  @Permissions(TEAM_VIEW)
  myPermissions(@CurrentUser() user: JwtPayload) {
    return this.teamManagementService.myPermissions(user);
  }

  @Post('invitations')
  @Permissions(TEAM_INVITE)
  inviteMember(@CurrentUser() user: JwtPayload, @Body() dto: InviteMemberDto) {
    return this.teamManagementService.inviteMember(user, dto);
  }

  @Get('invitations')
  @Permissions(TEAM_VIEW)
  listInvitations(@CurrentUser() user: JwtPayload) {
    return this.teamManagementService.listInvitations(user);
  }

  @Post('invitations/:token/accept')
  acceptInvitation(
    @CurrentUser() user: JwtPayload,
    @Param('token') token: string,
  ) {
    return this.teamManagementService.acceptInvitation(user, token);
  }

  @Post('invitations/:id/resend')
  @Permissions(TEAM_INVITE)
  resendInvitation(
    @CurrentUser() user: JwtPayload,
    @Param('id') invitationId: string,
  ) {
    return this.teamManagementService.resendInvitation(user, invitationId);
  }

  @Delete('invitations/:id')
  @Permissions(TEAM_INVITE)
  cancelInvitation(
    @CurrentUser() user: JwtPayload,
    @Param('id') invitationId: string,
  ) {
    return this.teamManagementService.cancelInvitation(user, invitationId);
  }
}
