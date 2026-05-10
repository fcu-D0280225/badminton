import { IsString, IsOptional, IsIn, Min } from 'class-validator';

export class UpdatePaymentDto {
  @IsOptional()
  @Min(0)
  amount?: number;

  @IsOptional()
  @IsString()
  @IsIn(['unpaid', 'processing', 'refunding', 'paid', 'refunded', 'failed'])
  status?: 'unpaid' | 'processing' | 'refunding' | 'paid' | 'refunded' | 'failed';

  @IsOptional()
  @IsString()
  paymentMethod?: string;

  @IsOptional()
  @IsString()
  transactionId?: string;
}
