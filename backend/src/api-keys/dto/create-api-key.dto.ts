import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * BADM-T15: 建立 API Key 的 DTO（白名單欄位，SEC-005）
 * scopes / venueIds 由 client 在建立時宣告；其餘（keyHash / keyPrefix / lastUsedAt
 * / revokedAt / createdByAccountId）一律由 server 控制。
 */
export const SUPPORTED_API_KEY_SCOPES = [
  'bookings:read',
  'bookings:write',
  'venues:read',
] as const;

export type ApiKeyScope = (typeof SUPPORTED_API_KEY_SCOPES)[number];

export class CreateApiKeyDto {
  @ApiProperty({
    description: '識別名稱（顯示用）',
    example: '合作夥伴 X 整合',
    maxLength: 255,
  })
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  name: string;

  @ApiProperty({
    description: '權限 scope 字串列表',
    enum: SUPPORTED_API_KEY_SCOPES,
    isArray: true,
    example: ['bookings:read', 'venues:read'],
  })
  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @IsIn(SUPPORTED_API_KEY_SCOPES as unknown as string[], { each: true })
  scopes: ApiKeyScope[];

  @ApiPropertyOptional({
    description:
      '此 key 可存取的場館 id 白名單；省略或空陣列 = 沿用建立者所屬全部場館',
    type: 'array',
    items: { type: 'number' },
  })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(50)
  @IsInt({ each: true })
  @IsPositive({ each: true })
  venueIds?: number[];

  @ApiPropertyOptional({
    description: '到期時間（ISO 8601）；省略 = 不過期',
    example: '2027-01-01T00:00:00.000Z',
  })
  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}
