import { IsOptional, IsString, IsBoolean, IsIn } from 'class-validator';

export class UpdateBookingDto {
  @IsOptional()
  @IsIn(['pending', 'confirmed', 'cancelled'])
  status?: string;

  @IsOptional()
  @IsBoolean()
  checkedIn?: boolean;

  @IsOptional()
  @IsString()
  notes?: string;
}
