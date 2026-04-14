import {
  IsString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsIn,
  IsBoolean,
  Matches,
  Min,
} from 'class-validator';

export class CreatePaymentRecordDto {
  @IsString()
  @IsNotEmpty({ message: '球隊名稱不可為空' })
  teamName: string;

  @IsString()
  @IsOptional()
  courtNumber?: string;

  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'date 格式必須為 YYYY-MM-DD' })
  date: string;

  @IsString()
  @Matches(/^\d{2}:\d{2}$/, { message: 'startTime 格式必須為 HH:MM' })
  startTime: string;

  @IsString()
  @Matches(/^\d{2}:\d{2}$/, { message: 'endTime 格式必須為 HH:MM' })
  endTime: string;

  @IsNumber()
  @Min(0)
  amount: number;

  @IsString()
  @IsOptional()
  @IsIn(['unpaid', 'cash', 'transfer'], {
    message: 'paymentStatus 必須為 unpaid、cash 或 transfer',
  })
  paymentStatus?: string;

  @IsString()
  @IsOptional()
  paidByNote?: string;

  @IsBoolean()
  @IsOptional()
  recurring?: boolean; // true = 建立往後 4 週共 5 筆定期記錄
}
