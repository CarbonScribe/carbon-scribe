import { IsString, IsOptional, IsEnum } from 'class-validator';

export class CheckoutDto {
  @IsOptional()
  @IsEnum(['credit_card', 'wire', 'crypto'])
  paymentMethod?: string = 'credit_card';

  @IsOptional()
  @IsString()
  notes?: string;
}

export class ConfirmCheckoutDto {
  @IsString()
  orderId: string;

  @IsOptional()
  @IsString()
  paymentId?: string;
}

export class OrderQueryDto {
  @IsOptional()
  @IsEnum(['pending', 'processing', 'completed', 'failed', 'refunded'])
  status?: string;

  @IsOptional()
  @IsString()
  startDate?: string;

  @IsOptional()
  @IsString()
  endDate?: string;

  @IsOptional()
  page?: number = 1;

  @IsOptional()
  limit?: number = 10;
}
