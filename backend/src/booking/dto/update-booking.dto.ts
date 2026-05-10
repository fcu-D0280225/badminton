import {
  IsInt,
  IsOptional,
  IsPositive,
  IsString,
  IsIn,
  Matches,
  MaxLength,
} from 'class-validator';

// SEC-005: 更新預約白名單 DTO — checkedIn 走專屬 /:id/checkin 端點、notes 走
// /:id/notes 端點，holdExpiresAt / recurringGroupId / createdAt / id / venue 關聯
// 一律由 server 控制，不接受 request body 注入。
export class UpdateBookingDto {
  @IsOptional()
  @IsInt()
  @IsPositive()
  venueId?: number;

  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'date 格式必須為 YYYY-MM-DD' })
  date?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{2}:\d{2}-\d{2}:\d{2}$/, {
    message: 'timeSlot 格式必須為 HH:MM-HH:MM',
  })
  timeSlot?: string;

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
}
