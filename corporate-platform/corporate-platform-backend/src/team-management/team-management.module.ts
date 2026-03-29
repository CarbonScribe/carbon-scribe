import { Module } from '@nestjs/common';
import { TeamManagementController } from './team-management.controller';
import { TeamManagementService } from './team-management.service';
import { MembersService } from './services/members.service';
import { RolesService } from './services/roles.service';
import { PermissionsService } from './services/permissions.service';
import { InvitationsService } from './services/invitations.service';

@Module({
  controllers: [TeamManagementController],
  providers: [
    TeamManagementService,
    MembersService,
    RolesService,
    PermissionsService,
    InvitationsService,
  ],
  exports: [TeamManagementService],
})
export class TeamManagementModule {}
