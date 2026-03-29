import { Injectable, CanActivate, ExecutionContext, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { Request } from 'express';
import { WalletService } from '../services/wallet.service';
import { WalletStatus } from '../interfaces/stellar.interface';

interface RequestWithCompany extends Request {
  companyId?: string;
  user?: { companyId: string };
}

@Injectable()
export class StellarAuthGuard implements CanActivate {
  constructor(private readonly walletService: WalletService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithCompany>();
    
    // Get companyId from request (set by tenant middleware or from user)
    const companyId = request.companyId || request.user?.companyId;
    
    if (!companyId) {
      throw new UnauthorizedException('Company ID not found in request');
    }

    // Check if wallet exists
    const wallet = await this.walletService.getWalletByCompanyId(companyId).catch(() => null);
    
    if (!wallet) {
      throw new UnauthorizedException(`No wallet found for company ${companyId}`);
    }

    // Check wallet status
    if (wallet.status === WalletStatus.LOCKED) {
      throw new ForbiddenException('Wallet is locked');
    }

    if (wallet.status === WalletStatus.PENDING) {
      throw new ForbiddenException('Wallet is pending activation');
    }

    // Attach wallet info to request for later use
    (request as any).wallet = wallet;

    return true;
  }
}
