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
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// SEC-005: 白名單 DTO 防 mass assignment — 客戶端僅能寫入此處列出的欄位，
// holdExpiresAt / recurringGroupId / createdAt / id / checkedIn 等敏感欄位
// 一律由 server 控制，不接受 request body 注入。
export class CreateBookingDto {
  @ApiProperty({ description: '場館 ID', example: 1 })
  @IsInt()
  @IsPositive()
  venueId: number;

  @ApiPropertyOptional({ description: '團主 ID（organizer/member 角色用）' })
  @IsOptional()
  @IsInt()
  @IsPositive()
  organizerId?: number;

  @ApiPropertyOptional({ description: '臨打 ID（player/member 角色用）' })
  @IsOptional()
  @IsInt()
  @IsPositive()
  playerId?: number;

  @ApiPropertyOptional({ description: '代訂人 ID（booker 角色用）' })
  @IsOptional()
  @IsInt()
  @IsPositive()
  bookerId?: number;

  @ApiProperty({ description: '日期 YYYY-MM-DD', example: '2026-06-01' })
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'date 格式必須為 YYYY-MM-DD' })
  date: string;

  @ApiProperty({ description: '時段 HH:MM-HH:MM', example: '19:00-20:00' })
  @IsString()
  @Matches(/^\d{2}:\d{2}-\d{2}:\d{2}$/, {
    message: 'timeSlot 格式必須為 HH:MM-HH:MM',
  })
  timeSlot: string;

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

  @ApiPropertyOptional({
    description: '預約金額；未指定時 server 依 pricing 規則計算',
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  amount?: number;
}
