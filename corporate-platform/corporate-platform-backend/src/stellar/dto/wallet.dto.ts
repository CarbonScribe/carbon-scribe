import { IsString, IsNotEmpty, IsEnum } from 'class-validator';
import { WalletStatus } from '../interfaces/stellar.interface';

export class CreateWalletDto {
  @IsString()
  @IsNotEmpty()
  companyId: string;
}

export class WalletResponseDto {
  id: string;
  companyId: string;
  publicKey: string;
  status: WalletStatus;
  createdAt: Date;
  updatedAt: Date;
}

export class WalletStatusUpdateDto {
  @IsEnum(WalletStatus)
  @IsNotEmpty()
  status: WalletStatus;
}
