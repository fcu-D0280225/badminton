import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Organizer } from '../entities/organizer.entity';
import { Booking } from '../entities/booking.entity';
import { Venue } from '../entities/venue.entity';
import { Player } from '../entities/player.entity';
import { OrganizerNote } from '../entities/organizer-note.entity';

@Injectable()
export class OrganizerService {
  constructor(
    @InjectRepository(Organizer)
    private organizerRepository: Repository<Organizer>,
    @InjectRepository(Booking)
    private bookingRepository: Repository<Booking>,
    @InjectRepository(Venue)
    private venueRepository: Repository<Venue>,
    @InjectRepository(Player)
    private playerRepository: Repository<Player>,
    @InjectRepository(OrganizerNote)
    private organizerNoteRepository: Repository<OrganizerNote>,
  ) {}

  // 建立團主
  async createOrganizer(data: Partial<Organizer>): Promise<Organizer> {
    const organizer = this.organizerRepository.create(data);
    return await this.organizerRepository.save(organizer);
  }

  // 取得所有團主
  async findAll(): Promise<Organizer[]> {
    return await this.organizerRepository.find();
  }

  // 取得單一團主
  async findOne(id: number): Promise<Organizer> {
    return await this.organizerRepository.findOne({
      where: { id },
      relations: ['bookings', 'notes'],
    });
  }

  // 取得團主的預約紀錄（含館方資料）
  async getBookings(organizerId: number): Promise<Booking[]> {
    return await this.bookingRepository.find({
      where: { organizerId },
      relations: ['venue', 'payment'],
      order: { date: 'DESC', timeSlot: 'ASC' },
    });
  }

  // 取得團主的臨打資訊
  async getPlayers(organizerId: number): Promise<Player[]> {
    const bookings = await this.bookingRepository.find({
      where: { organizerId },
      relations: ['player'],
    });

    const playerIds = bookings
      .map((b) => b.playerId)
      .filter((id) => id !== null);

    if (playerIds.length === 0) {
      return [];
    }

    return await this.playerRepository
      .createQueryBuilder('player')
      .where('player.id IN (:...ids)', { ids: playerIds })
      .getMany();
  }

  // 取得團主的臨打預約紀錄
  async getPlayerBookings(organizerId: number): Promise<Booking[]> {
    return await this.bookingRepository.find({
      where: { organizerId },
      relations: ['player', 'venue'],
      order: { date: 'DESC', timeSlot: 'ASC' },
    });
  }

  // 建立備註
  async createNote(
    organizerId: number,
    content: string,
    visibility: string,
  ): Promise<OrganizerNote> {
    const note = this.organizerNoteRepository.create({
      organizerId,
      content,
      visibility,
    });
    return await this.organizerNoteRepository.save(note);
  }

  // 取得備註
  async getNotes(
    organizerId: number,
    visibility?: string,
  ): Promise<OrganizerNote[]> {
    const query = this.organizerNoteRepository
      .createQueryBuilder('note')
      .where('note.organizerId = :organizerId', { organizerId });

    if (visibility) {
      query.andWhere('note.visibility = :visibility', { visibility });
    }

    return await query.orderBy('note.createdAt', 'DESC').getMany();
  }

  // 更新備註
  async updateNote(
    id: number,
    data: Partial<OrganizerNote>,
  ): Promise<OrganizerNote> {
    await this.organizerNoteRepository.update(id, data);
    return await this.organizerNoteRepository.findOne({ where: { id } });
  }

  // 刪除備註
  async deleteNote(id: number): Promise<void> {
    await this.organizerNoteRepository.delete(id);
  }
}
