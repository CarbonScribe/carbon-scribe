import { Injectable } from '@nestjs/common';
import { JwtPayload } from '../../auth/interfaces/jwt-payload.interface';
import { RbacService } from '../../rbac/rbac.service';
import { ALL_PERMISSIONS } from '../../rbac/constants/permissions.constants';

@Injectable()
export class PermissionsService {
  constructor(private readonly rbacService: RbacService) {}

  listAvailablePermissions() {
    return {
      all: ALL_PERMISSIONS.map((permission) => {
        const [category, action] = permission.split(':');
        return {
          key: permission,
          category,
          description: `${category} ${action}`,
        };
      }),
    };
  }

  async getMyPermissions(user: JwtPayload) {
    const permissions = await this.rbacService.getUserPermissions(
      user.sub,
      user.role,
      user.companyId,
    );

    return {
      userId: user.sub,
      companyId: user.companyId,
      role: user.role,
      permissions,
    };
  }
}
