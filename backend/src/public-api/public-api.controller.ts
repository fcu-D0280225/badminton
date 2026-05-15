import {
  Controller,
  ForbiddenException,
  Get,
  Param,
  ParseIntPipe,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiSecurity,
  ApiTags,
} from '@nestjs/swagger';
import { In, Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { ApiKeyAuthGuard } from '../api-keys/api-key-auth.guard';
import { RequireScopes } from '../api-keys/scopes.decorator';
import { VenueService } from '../venue/venue.service';
import { BookingService } from '../booking/booking.service';
import { Venue } from '../entities/venue.entity';
import { ApiKey } from '../entities/api-key.entity';
import { AuthUser } from '../auth/types';

/**
 * BADM-T15: 對外公開 API（v1）
 *
 * - 透過 X-API-Key 認證（ApiKeyAuthGuard）
 * - 啟用較嚴的 throttler：每 key/IP 每分鐘 60 次
 * - 既有 endpoint 在內部以「合成 venue AuthUser」走原 service，重用 ownership 過濾邏輯
 */
@ApiTags('public-api/v1')
@ApiSecurity('api-key')
@UseGuards(ApiKeyAuthGuard)
@Throttle({ default: { limit: 60, ttl: 60_000 } })
@Controller('api/v1')
export class PublicApiController {
  constructor(
    @InjectRepository(Venue) private readonly venueRepo: Repository<Venue>,
    private readonly venueService: VenueService,
    private readonly bookingService: BookingService,
  ) {}

  // ── GET /api/v1/venues — 列出此 key 可見的場館 ───────────────────
  @ApiOperation({ summary: '列出此 API Key 可存取的場館' })
  @ApiResponse({ status: 200, description: '回傳場館陣列' })
  @RequireScopes('venues:read')
  @Get('venues')
  async listVenues(@Req() req: any): Promise<Venue[]> {
    const venueIds = this.getKeyVenueIds(req);
    if (venueIds.length === 0) return [];
    return await this.venueRepo.find({ where: { id: In(venueIds) } });
  }

  // ── GET /api/v1/venues/:id/available-time-slots ──────────────────
  // 已存在的端點包一層 v1 alias，scope 視同 venues:read
  @ApiOperation({ summary: '取得指定場館某日的可用時段' })
  @ApiQuery({ name: 'date', required: true, example: '2026-06-01' })
  @RequireScopes('venues:read')
  @Get('venues/:id/available-time-slots')
  async getAvailableTimeSlots(
    @Req() req: any,
    @Param('id', ParseIntPipe) id: number,
    @Query('date') date: string,
  ): Promise<string[]> {
    this.assertVenueAccessible(req, id);
    return await this.venueService.getAvailableTimeSlots(id, date);
  }

  // ── GET /api/v1/bookings — 列出此 key 可見的預約 ─────────────────
  @ApiOperation({
    summary: '列出此 API Key 可存取的預約（依場館 id 過濾）',
  })
  @RequireScopes('bookings:read')
  @Get('bookings')
  async listBookings(@Req() req: any) {
    const user = req.user as AuthUser;
    const venueIds = this.getKeyVenueIds(req);
    if (venueIds.length === 0) return [];
    // 既有 BookingService.findAll 已支援 venue role + venueIds 過濾
    return await this.bookingService.findAll(user);
  }

  // ── 私有 ─────────────────────────────────────────────────────────
  private getKeyVenueIds(req: any): number[] {
    const apiKey: ApiKey | undefined = req.apiKey;
    return apiKey?.venueIds ?? [];
  }

  private assertVenueAccessible(req: any, venueId: number): void {
    const ids = this.getKeyVenueIds(req);
    if (!ids.includes(venueId)) {
      // 場館非屬於此 key → 用 403 表示授權範圍不足較貼近語意
      throw new ForbiddenException('此 API Key 無權存取該場館');
    }
  }
}
