import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthUser } from '../auth/types';
import { WaitlistService } from './waitlist.service';

@UseGuards(JwtAuthGuard)
@Controller('api/waitlist')
export class WaitlistController {
  constructor(private readonly waitlistService: WaitlistService) {}

  // 加入候補
  @Post()
  async join(
    @CurrentUser() user: AuthUser,
    @Body()
    data: {
      venueId: number;
      date: string;
      timeSlot: string;
      playerId?: number;
      organizerId?: number;
    },
  ) {
    return await this.waitlistService.joinWaitlist(data, user);
  }

  // 查詢某時段候補名單
  @Get()
  async getWaitlist(
    @CurrentUser() user: AuthUser,
    @Query('venueId') venueId: string,
    @Query('date') date: string,
    @Query('timeSlot') timeSlot: string,
  ) {
    return await this.waitlistService.getWaitlist(+venueId, date, timeSlot, user);
  }

  // 查詢臨打的候補紀錄
  @Get('player/:playerId')
  async getByPlayer(
    @CurrentUser() user: AuthUser,
    @Param('playerId') playerId: string,
  ) {
    return await this.waitlistService.getByPlayer(+playerId, user);
  }

  // 查詢團主的候補紀錄
  @Get('organizer/:organizerId')
  async getByOrganizer(
    @CurrentUser() user: AuthUser,
    @Param('organizerId') organizerId: string,
  ) {
    return await this.waitlistService.getByOrganizer(+organizerId, user);
  }

  // 離開候補
  @Delete(':id')
  async leave(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
  ) {
    await this.waitlistService.leaveWaitlist(+id, user);
    return { ok: true };
  }
}
