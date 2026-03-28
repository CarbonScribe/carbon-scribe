import { IsEmail, IsString } from 'class-validator';

export class InviteMemberDto {
  @IsEmail()
  email: string;

  @IsString()
  roleId: string;
}
