import { IsInt, IsOptional, IsString, IsIn, Min, Max } from 'class-validator';
import { CreateBookingDto } from './create-booking.dto';

// SEC-005: 重複預約建立 DTO — 在 CreateBookingDto 之上加重複欄位。
export class CreateRecurringBookingDto extends CreateBookingDto {
  @IsInt()
  @Min(1)
  @Max(52)
  recurringWeeks: number;

  @IsOptional()
  @IsString()
  @IsIn(['weekly', 'biweekly'], {
    message: 'recurringType 必須為 weekly 或 biweekly',
  })
  recurringType?: string;
}
