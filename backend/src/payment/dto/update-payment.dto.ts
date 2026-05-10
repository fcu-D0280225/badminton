import { IsString, IsOptional, IsIn, Min } from 'class-validator';

export class UpdatePaymentDto {
  @IsOptional()
  @Min(0)
  amount?: number;

  @IsOptional()
  @IsString()
  @IsIn(['unpaid', 'paid', 'refunded'])
  status?: string;

  @IsOptional()
  @IsString()
  paymentMethod?: string;

  @IsOptional()
  @IsString()
  transactionId?: string;
}
