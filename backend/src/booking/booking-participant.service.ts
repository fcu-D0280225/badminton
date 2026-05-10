import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BookingParticipant } from '../entities/booking-participant.entity';
import { Booking } from '../entities/booking.entity';
import { AuthUser } from '../auth/types';
import { isBookingOwnedBy } from '../auth/ownership.helper';

@Injectable()
export class BookingParticipantService {
  constructor(
    @InjectRepository(BookingParticipant)
    private participantRepository: Repository<BookingParticipant>,
    @InjectRepository(Booking)
    private bookingRepository: Repository<Booking>,
  ) {}

  async getParticipants(
    bookingId: number,
    user?: AuthUser,
  ): Promise<BookingParticipant[]> {
    if (user) await this.assertParticipantBookingOwned(bookingId, user);
    return await this.participantRepository.find({
      where: { bookingId },
      order: { addedAt: 'ASC' },
    });
  }

  async addParticipant(
    bookingId: number,
    data: { name: string; phone?: string },
    user?: AuthUser,
  ): Promise<BookingParticipant> {
    if (user) await this.assertParticipantBookingOwned(bookingId, user);
    return await this.participantRepository.save(
      this.participantRepository.create({
        bookingId,
        name: data.name,
        phone: data.phone,
      }),
    );
  }

  async removeParticipant(
    participantId: number,
    user?: AuthUser,
  ): Promise<void> {
    if (user) await this.assertParticipantOwned(participantId, user);
    await this.participantRepository.delete(participantId);
  }

  async toggleParticipantCheckin(
    participantId: number,
    user?: AuthUser,
  ): Promise<BookingParticipant> {
    if (user) await this.assertParticipantOwned(participantId, user);
    const p = await this.participantRepository.findOne({
      where: { id: participantId },
    });
    p.checkedIn = !p.checkedIn;
    return await this.participantRepository.save(p);
  }

  async updateParticipantPayment(
    participantId: number,
    data: { paymentStatus?: string; amount?: number },
    user?: AuthUser,
  ): Promise<BookingParticipant> {
    if (user) await this.assertParticipantOwned(participantId, user);
    const p = await this.participantRepository.findOne({
      where: { id: participantId },
    });
    if (data.paymentStatus !== undefined) {
      const allowed = ['unpaid', 'paid', 'refunded'];
      if (!allowed.includes(data.paymentStatus)) {
        throw new Error(`無效的付款狀態：${data.paymentStatus}`);
      }
      p.paymentStatus = data.paymentStatus;
    }
    if (data.amount !== undefined) {
      p.amount = data.amount;
    }
    return await this.participantRepository.save(p);
  }

  private async assertParticipantBookingOwned(
    bookingId: number,
    user: AuthUser,
  ): Promise<void> {
    const booking = await this.bookingRepository.findOne({
      where: { id: bookingId },
    });
    if (!booking || !isBookingOwnedBy(user, booking)) {
      throw new NotFoundException(`預約 #${bookingId} 不存在`);
    }
  }

  private async assertParticipantOwned(
    participantId: number,
    user: AuthUser,
  ): Promise<void> {
    const p = await this.participantRepository.findOne({
      where: { id: participantId },
    });
    if (!p) throw new NotFoundException(`參與者 #${participantId} 不存在`);
    await this.assertParticipantBookingOwned(p.bookingId, user);
  }
}
