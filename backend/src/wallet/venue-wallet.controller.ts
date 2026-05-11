import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  UseGuards,
  ForbiddenException,
  ValidationPipe,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthUser } from '../auth/types';
import { WalletService } from './wallet.service';
import { ManualTopupDto } from './dto/manual-topup.dto';

@Controller('api/wallet/members')
@UseGuards(JwtAuthGuard)
export class VenueWalletController {
  constructor(private readonly walletService: WalletService) {}

  private assertVenue(user: AuthUser): void {
    if (user.role !== 'venue') {
      throw new ForbiddenException('僅館方帳號可執行此操作');
    }
  }

  // GET /api/wallet/members — 所有 member 的 { accountId, username, balance }
  @Get()
  async listMembers(@CurrentUser() user: AuthUser) {
    this.assertVenue(user);
    return await this.walletService.listMemberWallets();
  }

  // GET /api/wallet/members/:accountId — 特定 member 的餘額 + 交易紀錄
  @Get(':accountId')
  async getMember(
    @Param('accountId') accountId: string,
    @CurrentUser() user: AuthUser,
  ) {
    this.assertVenue(user);
    return await this.walletService.getMemberWallet(+accountId);
  }

  // POST /api/wallet/members/:accountId/topup — 手動加值（現金補登）
  @Post(':accountId/topup')
  async topup(
    @Param('accountId') accountId: string,
    @Body(new ValidationPipe({ whitelist: true })) dto: ManualTopupDto,
    @CurrentUser() user: AuthUser,
  ) {
    this.assertVenue(user);
    return await this.walletService.manualTopup(
      +accountId,
      dto.amount,
      dto.note,
      user.id,
    );
  }
}
