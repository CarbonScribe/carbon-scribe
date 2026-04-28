import { IsArray, IsIn, IsOptional, IsString } from 'class-validator';

export class ContractCallDto {
  @IsOptional()
  @IsString()
  contractId?: string;

  @IsOptional()
  @IsIn(['carbonAsset', 'retirementTracker'])
  contractAlias?: 'carbonAsset' | 'retirementTracker';

  @IsString()
  methodName: string;

  @IsOptional()
  @IsArray()
  args?: unknown[];
}
