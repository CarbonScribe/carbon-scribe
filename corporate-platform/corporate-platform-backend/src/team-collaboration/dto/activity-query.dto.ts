import {
  IsOptional,
  IsArray,
  IsString,
  IsInt,
  Min,
  IsEnum,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  ACTIVITY_TYPE_ENUM,
  ActivityType,
} from '../interfaces/team-activity.interface';

export class ActivityQueryDto {
  @IsOptional()
  @IsString()
  userId?: string;

  @IsOptional()
  @IsArray()
  @IsEnum(ACTIVITY_TYPE_ENUM, { each: true })
  activityTypes?: ActivityType[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  entityTypes?: string[];

  @IsOptional()
  @Type(() => Date)
  startDate?: Date;

  @IsOptional()
  @Type(() => Date)
  endDate?: Date;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  page?: number = 1;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  limit?: number = 20;
}
