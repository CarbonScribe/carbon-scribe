import { IsNotEmpty, IsString, IsOptional } from 'class-validator';

export class RefreshTokenDto {
  @IsString()
  @IsNotEmpty()
  refreshToken: string;

  @IsOptional()
  @IsString()
  deviceId?: string;
}
