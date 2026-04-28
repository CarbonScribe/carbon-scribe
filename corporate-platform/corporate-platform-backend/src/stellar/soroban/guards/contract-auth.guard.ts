import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';

@Injectable()
export class ContractAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const headerToken = request.headers['x-contract-admin-key'];
    const expectedToken = process.env.CONTRACT_ADMIN_KEY;

    if (user?.role === 'admin') {
      return true;
    }

    if (expectedToken && headerToken && headerToken === expectedToken) {
      return true;
    }

    throw new ForbiddenException(
      'Admin role or contract admin key is required for contract calls',
    );
  }
}
