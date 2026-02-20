import {
    IsOptional,
    IsString,
    IsInt,
    Min,
    IsIn,
    IsDateString,
} from 'class-validator';
import { Type } from 'class-transformer';

export class OrderQueryDto {
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    page?: number = 1;

    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    limit?: number = 10;

    @IsOptional()
    @IsString()
    @IsIn(['pending', 'processing', 'completed', 'failed', 'refunded'])
    status?: string;

    @IsOptional()
    @IsString()
    @IsIn(['createdAt', 'total', 'status'])
    sortBy?: string = 'createdAt';

    @IsOptional()
    @IsString()
    @IsIn(['asc', 'desc'])
    sortOrder?: 'asc' | 'desc' = 'desc';

    @IsOptional()
    @IsString()
    search?: string;

    @IsOptional()
    @IsDateString()
    startDate?: string;

    @IsOptional()
    @IsDateString()
    endDate?: string;
}
