import {
  Controller,
  Get,
  Post,
  Param,
  UseGuards,
  ForbiddenException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthUser } from '../auth/types';
import { WalletService } from './wallet.service';

@Controller('api/wallet')
@UseGuards(JwtAuthGuard)
export class WalletController {
  constructor(private readonly walletService: WalletService) {}

  // GET /api/wallet — 查詢自己的餘額 + 最近 20 筆交易（lazy 建立錢包）
  @Get()
  async getMyWallet(@CurrentUser() user: AuthUser) {
    if (user.role !== 'member') {
      throw new ForbiddenException('僅會員帳號可查詢個人錢包');
    }
    return await this.walletService.getWallet(user.id);
  }

  // POST /api/wallet/pay-booking/:bookingId — 用錢包支付特定預約
  @Post('pay-booking/:bookingId')
  async payBooking(
    @Param('bookingId') bookingId: string,
    @CurrentUser() user: AuthUser,
  ) {
    if (user.role !== 'member') {
      throw new ForbiddenException('僅會員帳號可使用錢包付款');
    }
    return await this.walletService.payBooking(+bookingId, user);
  }
}
