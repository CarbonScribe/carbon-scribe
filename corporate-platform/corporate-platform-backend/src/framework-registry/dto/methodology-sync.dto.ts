import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class TriggerMethodologySyncDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  startTokenId?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  endTokenId?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  syncedFromBlock?: number;
}

export class MethodologyListQueryDto {
  @IsOptional()
  @IsString()
  registry?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  offset?: number;
}
