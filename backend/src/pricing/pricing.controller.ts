import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  ForbiddenException,
  ParseIntPipe,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthUser } from '../auth/types';
import { getVenueIdsForUser } from '../auth/ownership.helper';
import { PricingService } from './pricing.service';
import { PricingRule } from '../entities/pricing-rule.entity';

@UseGuards(JwtAuthGuard)
@Controller('api/pricing')
export class PricingController {
  constructor(private readonly pricingService: PricingService) {}

  private resolveVenueId(user: AuthUser, raw?: string): number {
    if (user.role !== 'venue') {
      throw new ForbiddenException('僅館方帳號可管理定價規則');
    }
    const venueId = raw ? parseInt(raw, 10) : user.entityId;
    if (Number.isNaN(venueId)) throw new ForbiddenException('venueId 格式錯誤');
    if (!getVenueIdsForUser(user).includes(venueId)) {
      throw new ForbiddenException('無權限存取此場館');
    }
    return venueId;
  }

  // ── 規則 CRUD ────────────────────────────────────────────────────
  @Get('rules')
  async list(
    @CurrentUser() user: AuthUser,
    @Query('venueId') venueIdRaw?: string,
  ) {
    return this.pricingService.listForVenue(this.resolveVenueId(user, venueIdRaw));
  }

  @Post('rules')
  async create(
    @CurrentUser() user: AuthUser,
    @Body() data: Partial<PricingRule>,
    @Query('venueId') venueIdRaw?: string,
  ) {
    return this.pricingService.create(this.resolveVenueId(user, venueIdRaw), data);
  }

  @Patch('rules/:id')
  async update(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() data: Partial<PricingRule>,
    @Query('venueId') venueIdRaw?: string,
  ) {
    return this.pricingService.update(
      id,
      this.resolveVenueId(user, venueIdRaw),
      data,
    );
  }

  @Delete('rules/:id')
  async delete(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Query('venueId') venueIdRaw?: string,
  ) {
    await this.pricingService.delete(id, this.resolveVenueId(user, venueIdRaw));
    return { success: true };
  }

  // ── 預設單價 ────────────────────────────────────────────────────
  @Get('default')
  async getDefault(
    @CurrentUser() user: AuthUser,
    @Query('venueId') venueIdRaw?: string,
  ) {
    return {
      defaultPricePerHour: await this.pricingService.getDefaultPrice(
        this.resolveVenueId(user, venueIdRaw),
      ),
    };
  }

  @Patch('default')
  async setDefault(
    @CurrentUser() user: AuthUser,
    @Body() body: { defaultPricePerHour: number },
    @Query('venueId') venueIdRaw?: string,
  ) {
    await this.pricingService.setDefaultPrice(
      this.resolveVenueId(user, venueIdRaw),
      body.defaultPricePerHour,
    );
    return { success: true };
  }

  // ── 預覽：給前端「目前這個時段會收多少錢」用 ────────────────────
  @Get('quote')
  async quote(
    @CurrentUser() user: AuthUser,
    @Query('date') date: string,
    @Query('timeSlot') timeSlot: string,
    @Query('venueId') venueIdRaw?: string,
  ) {
    const venueId = this.resolveVenueId(user, venueIdRaw);
    return this.pricingService.resolveAmount(venueId, date, timeSlot);
  }
}
