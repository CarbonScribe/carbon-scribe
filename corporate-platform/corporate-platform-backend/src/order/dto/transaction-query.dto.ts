import {
    IsOptional,
    IsString,
    IsInt,
    Min,
    IsIn,
    IsDateString,
} from 'class-validator';
import { Type } from 'class-transformer';

export class TransactionQueryDto {
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
    @IsIn(['purchase', 'retirement'])
    type?: string;

    @IsOptional()
    @IsDateString()
    startDate?: string;

    @IsOptional()
    @IsDateString()
    endDate?: string;
}
