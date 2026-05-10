import { IsInt, IsOptional, IsIn, Min } from 'class-validator';
import { CreateBookingDto } from './create-booking.dto';

export class CreateRecurringBookingDto extends CreateBookingDto {
  @IsInt()
  @Min(1)
  recurringWeeks: number;

  @IsOptional()
  @IsIn(['weekly', 'biweekly'])
  recurringType?: string;
}
