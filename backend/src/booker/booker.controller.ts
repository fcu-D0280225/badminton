import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  ForbiddenException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthUser } from '../auth/types';
import { BookerService } from './booker.service';
import { BookingService } from '../booking/booking.service';
import { Booker } from '../entities/booker.entity';
import { Booking } from '../entities/booking.entity';

@UseGuards(JwtAuthGuard)
@Controller('api/bookers')
export class BookerController {
  constructor(
    private readonly bookerService: BookerService,
    private readonly bookingService: BookingService,
  ) {}

  // 建立 booker：僅館方可建立
  @Post()
  async create(
    @CurrentUser() user: AuthUser,
    @Body() data: { name: string; contact: string },
  ): Promise<Booker> {
    if (user.role !== 'venue') {
      throw new ForbiddenException('僅館方帳號可建立預約人');
    }
    return await this.bookerService.create(data);
  }

  // 取得所有 booker：館方可用；booker 只能看自己
  @Get()
  async findAll(@CurrentUser() user: AuthUser): Promise<Booker[]> {
    if (user.role === 'venue') {
      return await this.bookerService.findAll();
    }
    if (user.role === 'booker') {
      const self = await this.bookerService.findOne(user.entityId);
      return self ? [self] : [];
    }
    throw new ForbiddenException('無權限');
  }

  // 取得單一 booker：館方或本人
  @Get(':id')
  async findOne(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
  ): Promise<Booker> {
    if (user.role !== 'venue' && !(user.role === 'booker' && user.entityId === +id)) {
      throw new ForbiddenException('無權限存取此預約人資料');
    }
    return await this.bookerService.findOne(+id);
  }

  // 取得 booker 的預約：館方或本人
  @Get(':id/bookings')
  async getBookings(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
  ): Promise<Booking[]> {
    if (user.role !== 'venue' && !(user.role === 'booker' && user.entityId === +id)) {
      throw new ForbiddenException('無權限存取此預約人的預約紀錄');
    }
    return await this.bookingService.findByBooker(+id);
  }
}
