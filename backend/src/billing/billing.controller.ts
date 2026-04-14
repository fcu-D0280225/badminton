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
import { Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { BillingService } from './billing.service';
import { CreatePaymentRecordDto } from './dto/create-payment-record.dto';
import { UpdatePaymentRecordDto } from './dto/update-payment-record.dto';

interface AuthUser {
  id: number;
  username: string;
  role: string;
  entityId: number;
}

@UseGuards(JwtAuthGuard)
@Controller('api/billing')
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  private assertVenueRole(user: AuthUser): void {
    if (user.role !== 'venue') {
      throw new ForbiddenException('僅館方帳號可使用收費管理功能');
    }
  }

  // POST /api/billing/records
  @Post('records')
  async create(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreatePaymentRecordDto,
  ) {
    this.assertVenueRole(user);
    if (dto.recurring) {
      return this.billingService.createRecurringSeries(dto, user.entityId);
    }
    return this.billingService.create(dto, user.entityId);
  }

  // GET /api/billing/records
  @Get('records')
  async findAll(
    @CurrentUser() user: AuthUser,
    @Query('unpaidOnly') unpaidOnly?: string,
    @Query('date') date?: string,
  ) {
    this.assertVenueRole(user);
    return this.billingService.findAll(user.entityId, {
      unpaidOnly: unpaidOnly === 'true',
      date,
    });
  }

  // GET /api/billing/records/export/csv
  @Get('records/export/csv')
  async exportCsv(
    @CurrentUser() user: AuthUser,
    @Query('month') month: string,
    @Res() res: Response,
  ) {
    this.assertVenueRole(user);
    const targetMonth = month ?? new Date().toISOString().slice(0, 7); // 預設當月
    const csv = await this.billingService.exportCsv(user.entityId, targetMonth);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="billing-${targetMonth}.csv"`,
    );
    res.send('\ufeff' + csv); // UTF-8 BOM 確保 Excel 正確顯示中文
  }

  // GET /api/billing/analytics
  @Get('analytics')
  async getAnalytics(
    @CurrentUser() user: AuthUser,
    @Query('month') month?: string,
  ) {
    this.assertVenueRole(user);
    const targetMonth = month ?? new Date().toISOString().slice(0, 7);
    return this.billingService.getAnalytics(user.entityId, targetMonth);
  }

  // GET /api/billing/records/:id
  @Get('records/:id')
  async findOne(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
  ) {
    this.assertVenueRole(user);
    return this.billingService.findOne(id, user.entityId);
  }

  // PATCH /api/billing/records/:id
  @Patch('records/:id')
  async update(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdatePaymentRecordDto,
  ) {
    this.assertVenueRole(user);
    return this.billingService.update(id, user.entityId, dto);
  }

  // DELETE /api/billing/records/recurring/:groupId — 刪除整個系列
  @Delete('records/recurring/:groupId')
  async deleteRecurringSeries(
    @CurrentUser() user: AuthUser,
    @Param('groupId') groupId: string,
  ) {
    this.assertVenueRole(user);
    await this.billingService.deleteRecurringSeries(groupId, user.entityId);
    return { success: true };
  }

  // DELETE /api/billing/records/:id — 刪除單筆
  @Delete('records/:id')
  async delete(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
  ) {
    this.assertVenueRole(user);
    await this.billingService.delete(id, user.entityId);
    return { success: true };
  }
}
