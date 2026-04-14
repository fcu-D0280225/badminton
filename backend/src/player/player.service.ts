import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Player } from '../entities/player.entity';
import { Booking } from '../entities/booking.entity';
import { Rating } from '../entities/rating.entity';
import { VenueNote } from '../entities/venue-note.entity';
import { OrganizerNote } from '../entities/organizer-note.entity';

@Injectable()
export class PlayerService {
  constructor(
    @InjectRepository(Player)
    private playerRepository: Repository<Player>,
    @InjectRepository(Booking)
    private bookingRepository: Repository<Booking>,
    @InjectRepository(Rating)
    private ratingRepository: Repository<Rating>,
    @InjectRepository(VenueNote)
    private venueNoteRepository: Repository<VenueNote>,
    @InjectRepository(OrganizerNote)
    private organizerNoteRepository: Repository<OrganizerNote>,
  ) {}

  // 建立臨打
  async createPlayer(data: Partial<Player>): Promise<Player> {
    const player = this.playerRepository.create(data);
    return await this.playerRepository.save(player);
  }

  // 取得所有臨打
  async findAll(): Promise<Player[]> {
    return await this.playerRepository.find();
  }

  // 取得單一臨打
  async findOne(id: number): Promise<Player> {
    return await this.playerRepository.findOne({
      where: { id },
      relations: ['bookings', 'ratings'],
    });
  }

  // 取得臨打的預約歷程
  async getBookingHistory(playerId: number): Promise<Booking[]> {
    return await this.bookingRepository.find({
      where: { playerId },
      relations: ['venue', 'organizer', 'payment'],
      order: { date: 'DESC', timeSlot: 'ASC' },
    });
  }

  // 取得臨打對館方的預約紀錄和備註
  async getVenueBookingsWithNotes(playerId: number): Promise<any[]> {
    const bookings = await this.bookingRepository.find({
      where: { playerId },
      relations: ['venue'],
    });

    const result = [];

    for (const booking of bookings) {
      if (booking.venueId) {
        const notes = await this.venueNoteRepository.find({
          where: {
            venueId: booking.venueId,
            visibility: 'public',
          },
          order: { createdAt: 'DESC' },
        });

        result.push({
          booking,
          notes,
        });
      }
    }

    return result;
  }

  // ── 信用分數 ──────────────────────────────────────────────────
  async getCreditScore(playerId: number): Promise<{
    score: number;
    grade: string;
    totalBookings: number;
    noShowCount: number;
    cancelCount: number;
    checkinRate: number;
    detail: string;
  }> {
    const bookings = await this.bookingRepository.find({ where: { playerId } });
    const today = new Date().toISOString().split('T')[0];

    const totalBookings = bookings.length;
    // 爽約：已確認、日期已過、未報到、非取消
    const noShowCount = bookings.filter(
      (b) => b.status === 'confirmed' && b.date < today && !b.checkedIn,
    ).length;
    // 取消次數
    const cancelCount = bookings.filter((b) => b.status === 'cancelled').length;
    // 已完成（已報到）
    const checkedInCount = bookings.filter((b) => b.checkedIn).length;
    const completedCount = bookings.filter(
      (b) => b.status === 'confirmed' && b.date < today,
    ).length;
    const checkinRate =
      completedCount > 0
        ? Math.round((checkedInCount / completedCount) * 100)
        : 100;

    // 計分：起始 100，爽約 -15，取消 -3
    const score = Math.max(0, 100 - noShowCount * 15 - cancelCount * 3);

    let grade: string;
    if (score >= 85) grade = 'A';
    else if (score >= 70) grade = 'B';
    else if (score >= 50) grade = 'C';
    else grade = 'D';

    const detail =
      score === 100
        ? '完美紀錄！從未爽約'
        : `爽約 ${noShowCount} 次（-${noShowCount * 15}分），取消 ${cancelCount} 次（-${cancelCount * 3}分）`;

    return {
      score,
      grade,
      totalBookings,
      noShowCount,
      cancelCount,
      checkinRate,
      detail,
    };
  }

  // 取得臨打對團主的預約紀錄和備註
  async getOrganizerBookingsWithNotes(playerId: number): Promise<any[]> {
    const bookings = await this.bookingRepository.find({
      where: { playerId },
      relations: ['organizer'],
    });

    const result = [];

    for (const booking of bookings) {
      if (booking.organizerId) {
        const notes = await this.organizerNoteRepository.find({
          where: {
            organizerId: booking.organizerId,
            visibility: 'public',
          },
          order: { createdAt: 'DESC' },
        });

        result.push({
          booking,
          notes,
        });
      }
    }

    return result;
  }
}
