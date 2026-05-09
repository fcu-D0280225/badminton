import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Organizer } from '../entities/organizer.entity';
import { Booking } from '../entities/booking.entity';
import { Venue } from '../entities/venue.entity';
import { Player } from '../entities/player.entity';
import { OrganizerNote } from '../entities/organizer-note.entity';
import { AuthUser } from '../auth/types';
import { ownsOrganizer } from '../auth/ownership.helper';

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

  // 建立團主（venue/admin 才允許）
  async createOrganizer(data: Partial<Organizer>, user?: AuthUser): Promise<Organizer> {
    if (user && user.role !== 'venue') {
      throw new ForbiddenException('僅館方帳號可建立團主');
    }
    const organizer = this.organizerRepository.create(data);
    return await this.organizerRepository.save(organizer);
  }

  // 取得所有團主：venue 可看全部；organizer/member 只看自己；其他空陣列
  async findAll(user?: AuthUser): Promise<Organizer[]> {
    if (!user) return await this.organizerRepository.find();
    if (user.role === 'venue') return await this.organizerRepository.find();
    if (user.role === 'organizer' || user.role === 'member') {
      const o = await this.organizerRepository.findOne({ where: { id: user.entityId } });
      return o ? [o] : [];
    }
    return [];
  }

  // 取得單一團主
  async findOne(id: number, user?: AuthUser): Promise<Organizer> {
    if (user) await this.assertReadable(id, user);
    return await this.organizerRepository.findOne({
      where: { id },
      relations: ['bookings', 'notes'],
    });
  }

  // 取得團主的預約紀錄（含館方資料）
  async getBookings(organizerId: number, user?: AuthUser): Promise<Booking[]> {
    if (user) await this.assertReadable(organizerId, user);
    const rows = await this.bookingRepository.find({
      where: { organizerId },
      relations: ['venue', 'payment'],
      order: { date: 'DESC', timeSlot: 'ASC' },
    });
    // venue 角色：只回該場地的預約
    if (user?.role === 'venue') return rows.filter((b) => b.venueId === user.entityId);
    return rows;
  }

  // 取得團主的臨打資訊
  async getPlayers(organizerId: number, user?: AuthUser): Promise<Player[]> {
    if (user) await this.assertReadable(organizerId, user);
    const bookings = await this.bookingRepository.find({
      where: { organizerId },
      relations: ['player'],
    });

    const playerIds = bookings
      .filter((b) => user?.role !== 'venue' || b.venueId === user.entityId)
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
  async getPlayerBookings(organizerId: number, user?: AuthUser): Promise<Booking[]> {
    if (user) await this.assertReadable(organizerId, user);
    const rows = await this.bookingRepository.find({
      where: { organizerId },
      relations: ['player', 'venue'],
      order: { date: 'DESC', timeSlot: 'ASC' },
    });
    if (user?.role === 'venue') return rows.filter((b) => b.venueId === user.entityId);
    return rows;
  }

  // 建立備註
  async createNote(
    organizerId: number,
    content: string,
    visibility: string,
    user?: AuthUser,
  ): Promise<OrganizerNote> {
    if (user) await this.assertReadable(organizerId, user);
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
    user?: AuthUser,
  ): Promise<OrganizerNote[]> {
    if (user) await this.assertReadable(organizerId, user);
    const query = this.organizerNoteRepository
      .createQueryBuilder('note')
      .where('note.organizerId = :organizerId', { organizerId });

    if (visibility) {
      query.andWhere('note.visibility = :visibility', { visibility });
    }

    return await query.orderBy('note.createdAt', 'DESC').getMany();
  }

  // 更新備註：必須是該 organizer / venue / member 才能改自己 organizer 名下的 note
  async updateNote(
    id: number,
    data: Partial<OrganizerNote>,
    user?: AuthUser,
  ): Promise<OrganizerNote> {
    if (user) await this.assertNoteWritable(id, user);
    await this.organizerNoteRepository.update(id, data);
    return await this.organizerNoteRepository.findOne({ where: { id } });
  }

  // 刪除備註
  async deleteNote(id: number, user?: AuthUser): Promise<void> {
    if (user) await this.assertNoteWritable(id, user);
    await this.organizerNoteRepository.delete(id);
  }

  // ── 私有：是否可讀取此 organizerId 的資料 ──────────────────────
  private async assertReadable(organizerId: number, user: AuthUser): Promise<void> {
    if (user.role === 'venue') {
      // venue 只能讀取「曾在自己場地預約過」的 organizer
      const booked = await this.bookingRepository.findOne({
        where: { organizerId, venueId: user.entityId },
      });
      if (!booked) throw new NotFoundException(`團主 #${organizerId} 不存在`);
      return;
    }
    if (ownsOrganizer(user, organizerId)) return;
    throw new NotFoundException(`團主 #${organizerId} 不存在`);
  }

  private async assertNoteWritable(noteId: number, user: AuthUser): Promise<void> {
    const note = await this.organizerNoteRepository.findOne({ where: { id: noteId } });
    if (!note) throw new NotFoundException(`備註 #${noteId} 不存在`);
    await this.assertReadable(note.organizerId, user);
  }
}
