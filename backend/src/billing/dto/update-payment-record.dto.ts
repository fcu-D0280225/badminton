import {
  IsString,
  IsNumber,
  IsOptional,
  IsIn,
  Matches,
  Min,
} from 'class-validator';

export class UpdatePaymentRecordDto {
  @IsString()
  @IsOptional()
  @IsIn(['unpaid', 'cash', 'transfer'], {
    message: 'paymentStatus 必須為 unpaid、cash 或 transfer',
  })
  paymentStatus?: string;

  @IsString()
  @IsOptional()
  paidByNote?: string;

  @IsString()
  @IsOptional()
  teamName?: string;

  @IsString()
  @IsOptional()
  courtNumber?: string;

  @IsString()
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'date 格式必須為 YYYY-MM-DD' })
  date?: string;

  @IsString()
  @IsOptional()
  @Matches(/^\d{2}:\d{2}$/, { message: 'startTime 格式必須為 HH:MM' })
  startTime?: string;

  @IsString()
  @IsOptional()
  @Matches(/^\d{2}:\d{2}$/, { message: 'endTime 格式必須為 HH:MM' })
  endTime?: string;

  @IsNumber()
  @IsOptional()
  @Min(0)
  amount?: number;
}
