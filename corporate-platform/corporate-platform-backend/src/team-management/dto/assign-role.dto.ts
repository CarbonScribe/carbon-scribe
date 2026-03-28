import { IsString } from 'class-validator';

export class AssignRoleDto {
  @IsString()
  roleId: string;
}
