import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
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

  @Post()
  async create(
    @Body() data: { name: string; contact: string },
  ): Promise<Booker> {
    return await this.bookerService.create(data);
  }

  @Get()
  async findAll(): Promise<Booker[]> {
    return await this.bookerService.findAll();
  }

  @Get(':id')
  async findOne(@Param('id') id: string): Promise<Booker> {
    return await this.bookerService.findOne(+id);
  }

  @Get(':id/bookings')
  async getBookings(@Param('id') id: string): Promise<Booking[]> {
    return await this.bookingService.findByBooker(+id);
  }
}
