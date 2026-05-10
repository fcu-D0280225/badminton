import {
  IsInt,
  IsOptional,
  IsPositive,
  IsString,
  IsIn,
  Matches,
  Min,
  IsNumber,
  MaxLength,
} from 'class-validator';

// SEC-005: 白名單 DTO 防 mass assignment — 客戶端僅能寫入此處列出的欄位，
// holdExpiresAt / recurringGroupId / createdAt / id / checkedIn 等敏感欄位
// 一律由 server 控制，不接受 request body 注入。
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
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'date 格式必須為 YYYY-MM-DD' })
  date: string;

  @IsString()
  @Matches(/^\d{2}:\d{2}-\d{2}:\d{2}$/, {
    message: 'timeSlot 格式必須為 HH:MM-HH:MM',
  })
  timeSlot: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;

  @IsOptional()
  @IsString()
  @IsIn(['pending', 'confirmed', 'cancelled'], {
    message: 'status 必須為 pending、confirmed 或 cancelled',
  })
  status?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  amount?: number;
}
