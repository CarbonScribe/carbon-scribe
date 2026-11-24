import { IsNotEmpty, IsString } from 'class-validator';
import { IsStrongPassword } from '../password-policy';

export class ResetPasswordDto {
  @IsString()
  @IsNotEmpty()
  token: string;

  @IsStrongPassword()
  newPassword: string;
}
