import { Test, TestingModule } from '@nestjs/testing';
import { TeamManagementService } from './team-management.service';
import { MembersService } from './services/members.service';
import { RolesService } from './services/roles.service';
import { PermissionsService } from './services/permissions.service';
import { InvitationsService } from './services/invitations.service';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';

describe('TeamManagementService', () => {
  let service: TeamManagementService;

  const membersService = {
    listMembers: jest.fn(),
    getMemberById: jest.fn(),
    createMember: jest.fn(),
    updateMember: jest.fn(),
    deactivateMember: jest.fn(),
    reactivateMember: jest.fn(),
    assignRole: jest.fn(),
  };

  const rolesService = {
    listRoles: jest.fn(),
    createRole: jest.fn(),
    updateRole: jest.fn(),
    deleteRole: jest.fn(),
  };

  const permissionsService = {
    listAvailablePermissions: jest.fn(),
    getMyPermissions: jest.fn(),
  };

  const invitationsService = {
    inviteMember: jest.fn(),
    listPendingInvitations: jest.fn(),
    acceptInvitation: jest.fn(),
    resendInvitation: jest.fn(),
    cancelInvitation: jest.fn(),
  };

  const user: JwtPayload = {
    sub: 'user-1',
    email: 'test@company.com',
    role: 'admin',
    companyId: 'company-1',
    sessionId: 'session-1',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TeamManagementService,
        { provide: MembersService, useValue: membersService },
        { provide: RolesService, useValue: rolesService },
        { provide: PermissionsService, useValue: permissionsService },
        { provide: InvitationsService, useValue: invitationsService },
      ],
    }).compile();

    service = module.get<TeamManagementService>(TeamManagementService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('delegates member listing with tenant company id', async () => {
    membersService.listMembers.mockResolvedValue([]);
    await service.listMembers(user);
    expect(membersService.listMembers).toHaveBeenCalledWith('company-1');
  });

  it('delegates role creation with actor context', async () => {
    const dto = { name: 'Custom Analyst', permissions: ['team:view'] };
    rolesService.createRole.mockResolvedValue({ id: 'role-1' });
    await service.createRole(user, dto as any);
    expect(rolesService.createRole).toHaveBeenCalledWith(
      'company-1',
      'user-1',
      dto,
    );
  });

  it('delegates invitation acceptance with token', async () => {
    invitationsService.acceptInvitation.mockResolvedValue({ success: true });
    await service.acceptInvitation(user, 'token-1');
    expect(invitationsService.acceptInvitation).toHaveBeenCalledWith(
      user,
      'token-1',
    );
  });
});
