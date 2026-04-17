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
import { WaitlistService } from './waitlist.service';

@UseGuards(JwtAuthGuard)
@Controller('api/waitlist')
export class WaitlistController {
  constructor(private readonly waitlistService: WaitlistService) {}

  // 加入候補
  @Post()
  async join(
    @Body()
    data: {
      venueId: number;
      date: string;
      timeSlot: string;
      playerId?: number;
      organizerId?: number;
    },
  ) {
    return await this.waitlistService.joinWaitlist(data);
  }

  // 查詢某時段候補名單
  @Get()
  async getWaitlist(
    @Query('venueId') venueId: string,
    @Query('date') date: string,
    @Query('timeSlot') timeSlot: string,
  ) {
    return await this.waitlistService.getWaitlist(+venueId, date, timeSlot);
  }

  // 查詢臨打的候補紀錄
  @Get('player/:playerId')
  async getByPlayer(@Param('playerId') playerId: string) {
    return await this.waitlistService.getByPlayer(+playerId);
  }

  // 查詢團主的候補紀錄
  @Get('organizer/:organizerId')
  async getByOrganizer(@Param('organizerId') organizerId: string) {
    return await this.waitlistService.getByOrganizer(+organizerId);
  }

  // 離開候補
  @Delete(':id')
  async leave(@Param('id') id: string) {
    await this.waitlistService.leaveWaitlist(+id);
    return { ok: true };
  }
}
