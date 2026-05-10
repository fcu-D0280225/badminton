import {
  IsInt,
  IsPositive,
  IsString,
  IsOptional,
  IsNumber,
  Min,
  Matches,
} from 'class-validator';

export class CreateBookingDto {
  @IsInt()
  @IsPositive()
  venueId: number;

  @IsOptional()
  @IsInt()
  @IsPositive()
  organizerId?: number;

  @IsOptional()
  @IsInt()
  @IsPositive()
  playerId?: number;

  @IsOptional()
  @IsInt()
  @IsPositive()
  bookerId?: number;

  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'date must be YYYY-MM-DD' })
  date: string;

  @IsString()
  @Matches(/^\d{2}:\d{2}-\d{2}:\d{2}$/, {
    message: 'timeSlot must be HH:MM-HH:MM',
  })
  timeSlot: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  amount?: number;
}
