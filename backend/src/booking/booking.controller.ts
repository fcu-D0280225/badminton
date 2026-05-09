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
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthUser } from '../auth/types';
import { BookingService } from './booking.service';
import { Booking } from '../entities/booking.entity';
import { BookingParticipant } from '../entities/booking-participant.entity';

@UseGuards(JwtAuthGuard)
@Controller('api/bookings')
export class BookingController {
  constructor(private readonly bookingService: BookingService) {}

  // 建立單筆預約
  @Post()
  async createBooking(
    @CurrentUser() user: AuthUser,
    @Body() data: Partial<Booking> & { amount?: number },
  ): Promise<Booking> {
    return await this.bookingService.createBooking(data, user);
  }

  // 建立重複預約（回傳建立的所有預約）
  @Post('recurring')
  async createRecurring(
    @CurrentUser() user: AuthUser,
    @Body()
    data: Partial<Booking> & {
      amount?: number;
      recurringWeeks: number;
      recurringType?: string;
    },
  ): Promise<Booking[]> {
    return await this.bookingService.createRecurringBookings(data, user);
  }

  @Get()
  async findAll(@CurrentUser() user: AuthUser): Promise<Booking[]> {
    return await this.bookingService.findAll(user);
  }

  @Get(':id')
  async findOne(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
  ): Promise<Booking> {
    return await this.bookingService.findOne(+id, user);
  }

  // 查詢重複預約群組
  @Get('recurring/:groupId')
  async findRecurringGroup(
    @CurrentUser() user: AuthUser,
    @Param('groupId') groupId: string,
  ): Promise<Booking[]> {
    return await this.bookingService.findRecurringGroup(groupId, user);
  }

  @Put(':id')
  async updateBooking(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() data: Partial<Booking>,
  ): Promise<Booking> {
    return await this.bookingService.updateBooking(+id, data, user);
  }

  @Put(':id/checkin')
  async toggleCheckin(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
  ): Promise<Booking> {
    const booking = await this.bookingService.findOne(+id, user);
    return await this.bookingService.updateBooking(
      +id,
      { checkedIn: !booking.checkedIn },
      user,
    );
  }

  @Put(':id/notes')
  async updateNotes(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() data: { notes: string },
  ): Promise<Booking> {
    return await this.bookingService.updateBooking(
      +id,
      { notes: data.notes },
      user,
    );
  }

  // 取消整個重複預約群組（只取消今天以後）
  @Delete('recurring/:groupId')
  async cancelRecurringGroup(
    @CurrentUser() user: AuthUser,
    @Param('groupId') groupId: string,
  ): Promise<{ cancelled: number }> {
    return await this.bookingService.cancelRecurringGroup(groupId, user);
  }

  @Delete(':id')
  async deleteBooking(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
  ): Promise<void> {
    return await this.bookingService.deleteBooking(+id, user);
  }

  // ── 參與者管理 ─────────────────────────────────────────────────
  @Get(':id/participants')
  async getParticipants(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
  ): Promise<BookingParticipant[]> {
    return await this.bookingService.getParticipants(+id, user);
  }

  @Post(':id/participants')
  async addParticipant(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() data: { name: string; phone?: string },
  ): Promise<BookingParticipant> {
    return await this.bookingService.addParticipant(+id, data, user);
  }

  @Delete(':id/participants/:participantId')
  async removeParticipant(
    @CurrentUser() user: AuthUser,
    @Param('participantId') participantId: string,
  ): Promise<void> {
    return await this.bookingService.removeParticipant(+participantId, user);
  }

  @Put(':id/participants/:participantId/checkin')
  async toggleParticipantCheckin(
    @CurrentUser() user: AuthUser,
    @Param('participantId') participantId: string,
  ): Promise<BookingParticipant> {
    return await this.bookingService.toggleParticipantCheckin(
      +participantId,
      user,
    );
  }

  @Put(':id/participants/:participantId/payment')
  async updateParticipantPayment(
    @CurrentUser() user: AuthUser,
    @Param('participantId') participantId: string,
    @Body() data: { paymentStatus?: string; amount?: number },
  ): Promise<BookingParticipant> {
    return await this.bookingService.updateParticipantPayment(
      +participantId,
      data,
      user,
    );
  }
}
