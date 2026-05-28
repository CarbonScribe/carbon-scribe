import { IsArray, IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class ContractCallDto {
  @IsNotEmpty()
  @IsString()
  workflowId: string;

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
