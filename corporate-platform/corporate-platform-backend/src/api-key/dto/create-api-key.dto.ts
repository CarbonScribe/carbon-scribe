import {
  ArrayMaxSize,
  IsArray,
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Max,
  Min,
} from 'class-validator';

export class CreateApiKeyDto {
  @IsString()
  @Length(3, 100)
  name: string;

  @IsArray()
  @ArrayMaxSize(100)
  @IsString({ each: true })
  permissions: string[];

  @IsOptional()
  @IsDateString()
  expiresAt?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100000)
  rateLimit?: number;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  ipWhitelist?: string[];

  @IsOptional()
  @IsIn(['live', 'test'])
  environment?: 'live' | 'test';
}
