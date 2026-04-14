import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { BookingService } from './booking.service';
import { Booking } from '../entities/booking.entity';

@UseGuards(JwtAuthGuard)
@Controller('api/bookings')
export class BookingController {
  constructor(private readonly bookingService: BookingService) {}

  // 建立單筆預約
  @Post()
  async createBooking(
    @Body() data: Partial<Booking> & { amount?: number },
  ): Promise<Booking> {
    return await this.bookingService.createBooking(data);
  }

  // 建立重複預約（回傳建立的所有預約）
  @Post('recurring')
  async createRecurring(
    @Body()
    data: Partial<Booking> & {
      amount?: number;
      recurringWeeks: number;
      recurringType?: string;
    },
  ): Promise<Booking[]> {
    return await this.bookingService.createRecurringBookings(data);
  }

  @Get()
  async findAll(): Promise<Booking[]> {
    return await this.bookingService.findAll();
  }

  @Get(':id')
  async findOne(@Param('id') id: string): Promise<Booking> {
    return await this.bookingService.findOne(+id);
  }

  // 查詢重複預約群組
  @Get('recurring/:groupId')
  async findRecurringGroup(
    @Param('groupId') groupId: string,
  ): Promise<Booking[]> {
    return await this.bookingService.findRecurringGroup(groupId);
  }

  @Put(':id')
  async updateBooking(
    @Param('id') id: string,
    @Body() data: Partial<Booking>,
  ): Promise<Booking> {
    return await this.bookingService.updateBooking(+id, data);
  }

  @Put(':id/checkin')
  async toggleCheckin(@Param('id') id: string): Promise<Booking> {
    const booking = await this.bookingService.findOne(+id);
    return await this.bookingService.updateBooking(+id, {
      checkedIn: !booking.checkedIn,
    });
  }

  @Put(':id/notes')
  async updateNotes(
    @Param('id') id: string,
    @Body() data: { notes: string },
  ): Promise<Booking> {
    return await this.bookingService.updateBooking(+id, { notes: data.notes });
  }

  // 取消整個重複預約群組（只取消今天以後）
  @Delete('recurring/:groupId')
  async cancelRecurringGroup(
    @Param('groupId') groupId: string,
  ): Promise<{ cancelled: number }> {
    return await this.bookingService.cancelRecurringGroup(groupId);
  }

  @Delete(':id')
  async deleteBooking(@Param('id') id: string): Promise<void> {
    return await this.bookingService.deleteBooking(+id);
  }
}
