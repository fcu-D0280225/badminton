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
  Res,
  ParseIntPipe,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthUser } from '../auth/types';
import { getVenueIdsForUser } from '../auth/ownership.helper';
import { BillingService } from './billing.service';
import { CreatePaymentRecordDto } from './dto/create-payment-record.dto';
import { UpdatePaymentRecordDto } from './dto/update-payment-record.dto';

@ApiTags('billing')
@ApiBearerAuth('jwt')
@UseGuards(JwtAuthGuard)
@Controller('api/billing')
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  private assertVenueRole(user: AuthUser): void {
    if (user.role !== 'venue') {
      throw new ForbiddenException('僅館方帳號可使用收費管理功能');
    }
  }

  // 多場館：從 ?venueId 解析操作對象（必須在使用者綁定清單內），未指定則用 entityId
  private resolveVenueId(user: AuthUser, raw?: string): number {
    if (!raw) return user.entityId;
    const venueId = parseInt(raw, 10);
    if (Number.isNaN(venueId)) {
      throw new ForbiddenException('venueId 格式錯誤');
    }
    if (!getVenueIdsForUser(user).includes(venueId)) {
      throw new ForbiddenException('無權限存取此場館');
    }
    return venueId;
  }

  // BADM-T11 跨館彙整：?venueId=all → 回所有綁定 venueIds、否則同 resolveVenueId
  private resolveVenueScope(user: AuthUser, raw?: string): number | number[] {
    if (raw === 'all') return getVenueIdsForUser(user);
    return this.resolveVenueId(user, raw);
  }

  // POST /api/billing/records
  @ApiOperation({ summary: '建立收費紀錄（單筆或週期系列）' })
  @Post('records')
  async create(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreatePaymentRecordDto,
    @Query('venueId') venueIdRaw?: string,
  ) {
    this.assertVenueRole(user);
    if (dto.recurring) {
      return this.billingService.createRecurringSeries(
        dto,
        this.resolveVenueId(user, venueIdRaw),
      );
    }
    return this.billingService.create(
      dto,
      this.resolveVenueId(user, venueIdRaw),
    );
  }

  // GET /api/billing/records
  @ApiOperation({ summary: '列出收費紀錄（支援 unpaidOnly / date 過濾）' })
  @Get('records')
  async findAll(
    @CurrentUser() user: AuthUser,
    @Query('unpaidOnly') unpaidOnly?: string,
    @Query('date') date?: string,
    @Query('venueId') venueIdRaw?: string,
  ) {
    this.assertVenueRole(user);
    return this.billingService.findAll(
      this.resolveVenueScope(user, venueIdRaw),
      {
        unpaidOnly: unpaidOnly === 'true',
        date,
      },
    );
  }

  // GET /api/billing/records/export/csv
  @ApiOperation({ summary: '匯出當月收費 CSV（含 UTF-8 BOM）' })
  @Get('records/export/csv')
  async exportCsv(
    @CurrentUser() user: AuthUser,
    @Query('month') month: string,
    @Res() res: Response,
    @Query('venueId') venueIdRaw?: string,
  ) {
    this.assertVenueRole(user);
    const targetMonth = month ?? new Date().toISOString().slice(0, 7); // 預設當月
    const csv = await this.billingService.exportCsv(
      this.resolveVenueId(user, venueIdRaw),
      targetMonth,
    );
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="billing-${targetMonth}.csv"`,
    );
    res.send('\ufeff' + csv); // UTF-8 BOM 確保 Excel 正確顯示中文
  }

  // GET /api/billing/analytics
  @ApiOperation({ summary: '取得當月收費統計' })
  @Get('analytics')
  async getAnalytics(
    @CurrentUser() user: AuthUser,
    @Query('month') month?: string,
    @Query('venueId') venueIdRaw?: string,
  ) {
    this.assertVenueRole(user);
    const targetMonth = month ?? new Date().toISOString().slice(0, 7);
    return this.billingService.getAnalytics(
      this.resolveVenueScope(user, venueIdRaw),
      targetMonth,
    );
  }

  // GET /api/billing/records/:id
  @Get('records/:id')
  async findOne(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Query('venueId') venueIdRaw?: string,
  ) {
    this.assertVenueRole(user);
    return this.billingService.findOne(
      id,
      this.resolveVenueId(user, venueIdRaw),
    );
  }

  // PATCH /api/billing/records/:id
  @Patch('records/:id')
  async update(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdatePaymentRecordDto,
    @Query('venueId') venueIdRaw?: string,
  ) {
    this.assertVenueRole(user);
    return this.billingService.update(
      id,
      this.resolveVenueId(user, venueIdRaw),
      dto,
    );
  }

  // DELETE /api/billing/records/recurring/:groupId — 刪除整個系列
  @Delete('records/recurring/:groupId')
  async deleteRecurringSeries(
    @CurrentUser() user: AuthUser,
    @Param('groupId') groupId: string,
    @Query('venueId') venueIdRaw?: string,
  ) {
    this.assertVenueRole(user);
    await this.billingService.deleteRecurringSeries(
      groupId,
      this.resolveVenueId(user, venueIdRaw),
    );
    return { success: true };
  }

  // DELETE /api/billing/records/:id — 刪除單筆
  @Delete('records/:id')
  async delete(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Query('venueId') venueIdRaw?: string,
  ) {
    this.assertVenueRole(user);
    await this.billingService.delete(id, this.resolveVenueId(user, venueIdRaw));
    return { success: true };
  }
}
