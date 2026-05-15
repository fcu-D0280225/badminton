import {
  IsInt,
  IsOptional,
  IsPositive,
  IsString,
  IsIn,
  Matches,
  MaxLength,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

// SEC-005: 更新預約白名單 DTO — checkedIn 走專屬 /:id/checkin 端點、notes 走
// /:id/notes 端點，holdExpiresAt / recurringGroupId / createdAt / id / venue 關聯
// 一律由 server 控制，不接受 request body 注入。
export class UpdateBookingDto {
  @ApiPropertyOptional({ description: '場館 ID' })
  @IsOptional()
  @IsInt()
  @IsPositive()
  venueId?: number;

  @ApiPropertyOptional({ description: '日期 YYYY-MM-DD' })
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'date 格式必須為 YYYY-MM-DD' })
  date?: string;

  @ApiPropertyOptional({ description: '時段 HH:MM-HH:MM' })
  @IsOptional()
  @IsString()
  @Matches(/^\d{2}:\d{2}-\d{2}:\d{2}$/, {
    message: 'timeSlot 格式必須為 HH:MM-HH:MM',
  })
  timeSlot?: string;

  @ApiPropertyOptional({ description: '備註', maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;

  @ApiPropertyOptional({
    description: '預約狀態',
    enum: ['pending', 'confirmed', 'cancelled'],
  })
  @IsOptional()
  @IsString()
  @IsIn(['pending', 'confirmed', 'cancelled'], {
    message: 'status 必須為 pending、confirmed 或 cancelled',
  })
  status?: string;
}
