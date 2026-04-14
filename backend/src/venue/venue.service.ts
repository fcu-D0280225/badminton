import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Venue } from '../entities/venue.entity';
import { Booking } from '../entities/booking.entity';
import { Payment } from '../entities/payment.entity';
import { VenueNote } from '../entities/venue-note.entity';

@Injectable()
export class VenueService {
  constructor(
    @InjectRepository(Venue)
    private venueRepository: Repository<Venue>,
    @InjectRepository(Booking)
    private bookingRepository: Repository<Booking>,
    @InjectRepository(Payment)
    private paymentRepository: Repository<Payment>,
    @InjectRepository(VenueNote)
    private venueNoteRepository: Repository<VenueNote>,
  ) {}

  // 建立館方
  async createVenue(data: Partial<Venue>): Promise<Venue> {
    const venue = this.venueRepository.create(data);
    return await this.venueRepository.save(venue);
  }

  // 取得所有館方
  async findAll(): Promise<Venue[]> {
    return await this.venueRepository.find();
  }

  // 取得單一館方
  async findOne(id: number): Promise<Venue> {
    return await this.venueRepository.findOne({
      where: { id },
      relations: ['bookings', 'notes'],
    });
  }

  // 取得館方的預約紀錄（含付款資訊）
  async getBookings(
    venueId: number,
    filters?: {
      date?: string;
      playerName?: string;
      timeSlot?: string;
    },
  ): Promise<Booking[]> {
    const query = this.bookingRepository
      .createQueryBuilder('booking')
      .leftJoinAndSelect('booking.payment', 'payment')
      .leftJoinAndSelect('booking.organizer', 'organizer')
      .leftJoinAndSelect('booking.player', 'player')
      .where('booking.venueId = :venueId', { venueId });

    if (filters?.date) {
      query.andWhere('booking.date = :date', { date: filters.date });
    }

    if (filters?.timeSlot) {
      query.andWhere('booking.timeSlot = :timeSlot', {
        timeSlot: filters.timeSlot,
      });
    }

    if (filters?.playerName) {
      query.andWhere(
        '(player.name LIKE :playerName OR organizer.name LIKE :playerName)',
        { playerName: `%${filters.playerName}%` },
      );
    }

    return await query
      .orderBy('booking.date', 'DESC')
      .addOrderBy('booking.timeSlot', 'ASC')
      .getMany();
  }

  // 取得可用時間段
  async getAvailableTimeSlots(
    venueId: number,
    date: string,
  ): Promise<string[]> {
    const bookings = await this.bookingRepository.find({
      where: { venueId, date, status: 'confirmed' },
      select: ['timeSlot'],
    });

    const bookedSlots = bookings.map((b) => b.timeSlot);
    // 預設時間段（可根據需求調整）
    const allSlots = [
      '09:00-10:00',
      '10:00-11:00',
      '11:00-12:00',
      '13:00-14:00',
      '14:00-15:00',
      '15:00-16:00',
      '16:00-17:00',
      '17:00-18:00',
      '18:00-19:00',
      '19:00-20:00',
      '20:00-21:00',
      '21:00-22:00',
    ];

    return allSlots.filter((slot) => !bookedSlots.includes(slot));
  }

  // 建立備註
  async createNote(
    venueId: number,
    content: string,
    visibility: string,
  ): Promise<VenueNote> {
    const note = this.venueNoteRepository.create({
      venueId,
      content,
      visibility,
    });
    return await this.venueNoteRepository.save(note);
  }

  // 取得備註
  async getNotes(venueId: number, visibility?: string): Promise<VenueNote[]> {
    const query = this.venueNoteRepository
      .createQueryBuilder('note')
      .where('note.venueId = :venueId', { venueId });

    if (visibility) {
      query.andWhere('note.visibility = :visibility', { visibility });
    }

    return await query.orderBy('note.createdAt', 'DESC').getMany();
  }

  // 更新備註
  async updateNote(id: number, data: Partial<VenueNote>): Promise<VenueNote> {
    await this.venueNoteRepository.update(id, data);
    return await this.venueNoteRepository.findOne({ where: { id } });
  }

  // 刪除備註
  async deleteNote(id: number): Promise<void> {
    await this.venueNoteRepository.delete(id);
  }
}
