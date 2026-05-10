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
import { BookingParticipantService } from './booking-participant.service';
import { Booking } from '../entities/booking.entity';
import { BookingParticipant } from '../entities/booking-participant.entity';
import { CreateBookingDto } from './dto/create-booking.dto';
import { CreateRecurringBookingDto } from './dto/create-recurring-booking.dto';
import { UpdateBookingDto } from './dto/update-booking.dto';

@UseGuards(JwtAuthGuard)
@Controller('api/bookings')
export class BookingController {
  constructor(
    private readonly bookingService: BookingService,
    private readonly participantService: BookingParticipantService,
  ) {}

  // 建立單筆預約 — SEC-005: 走 CreateBookingDto 白名單，request body 多餘欄位由
  // 全域 ValidationPipe (forbidNonWhitelisted=true) 直接 400 拒絕。
  @Post()
  async createBooking(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateBookingDto,
  ): Promise<Booking> {
    return await this.bookingService.createBooking(dto, user);
  }

  // 建立重複預約（回傳建立的所有預約）
  @Post('recurring')
  async createRecurring(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateRecurringBookingDto,
  ): Promise<Booking[]> {
    return await this.bookingService.createRecurringBookings(dto, user);
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

  // SEC-005: 走 UpdateBookingDto 白名單；checkedIn 改走 /:id/checkin、notes 走
  // /:id/notes，避免 request body 直接寫入 holdExpiresAt / recurringGroupId 等內部欄位。
  @Put(':id')
  async updateBooking(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateBookingDto,
  ): Promise<Booking> {
    return await this.bookingService.updateBooking(+id, dto, user);
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
    return await this.participantService.getParticipants(+id, user);
  }

  @Post(':id/participants')
  async addParticipant(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() data: { name: string; phone?: string },
  ): Promise<BookingParticipant> {
    return await this.participantService.addParticipant(+id, data, user);
  }

  @Delete(':id/participants/:participantId')
  async removeParticipant(
    @CurrentUser() user: AuthUser,
    @Param('participantId') participantId: string,
  ): Promise<void> {
    return await this.participantService.removeParticipant(+participantId, user);
  }

  @Put(':id/participants/:participantId/checkin')
  async toggleParticipantCheckin(
    @CurrentUser() user: AuthUser,
    @Param('participantId') participantId: string,
  ): Promise<BookingParticipant> {
    return await this.participantService.toggleParticipantCheckin(
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
    return await this.participantService.updateParticipantPayment(
      +participantId,
      data,
      user,
    );
  }
}
