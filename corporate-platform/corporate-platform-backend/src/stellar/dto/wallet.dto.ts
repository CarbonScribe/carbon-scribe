import { IsString, IsNotEmpty, IsEnum, IsOptional, IsArray, IsNumber, IsObject } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { WalletStatus } from '../interfaces/stellar.interface';

export class CreateWalletDto {
  @ApiProperty({ description: 'Company ID to associate with the wallet' })
  @IsString()
  @IsNotEmpty()
  companyId: string;
}

export class WalletResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  companyId: string;

  @ApiProperty()
  publicKey: string;

  @ApiProperty({ enum: WalletStatus })
  status: WalletStatus;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

export class WalletStatusUpdateDto {
  @ApiProperty({ enum: WalletStatus, description: 'New wallet status' })
  @IsEnum(WalletStatus)
  @IsNotEmpty()
  status: WalletStatus;
}
