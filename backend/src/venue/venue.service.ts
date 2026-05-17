import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Venue } from '../entities/venue.entity';
import { Booking } from '../entities/booking.entity';
import { Payment } from '../entities/payment.entity';
import { VenueNote } from '../entities/venue-note.entity';

/** 集團樹深度上限：防呆，避免循環檢查失誤導致無窮遞迴 */
const MAX_GROUP_TREE_DEPTH = 10;

export interface VenueGroupNode {
  id: number;
  name: string;
  children: VenueGroupNode[];
}

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

  // 更新館方基本資訊（白名單欄位，避免任意 column 被覆寫）
  async updateVenue(id: number, data: Partial<Venue>): Promise<Venue> {
    const allowed: Array<keyof Venue> = [
      'name',
      'contact',
      'address',
      'description',
      'openingHours',
      'feeInfo',
      'cancellationPolicyHours',
      'parentVenueId',
    ];
    const patch: Partial<Venue> = {};
    for (const key of allowed) {
      if (data[key] !== undefined) {
        (patch as any)[key] = data[key];
      }
    }

    // BADM-T11: 設定 parentVenueId 時的防呆
    if (Object.prototype.hasOwnProperty.call(patch, 'parentVenueId')) {
      const nextParent = patch.parentVenueId;
      if (nextParent !== null && nextParent !== undefined) {
        const parentId = Number(nextParent);
        if (!Number.isFinite(parentId)) {
          throw new BadRequestException('parentVenueId 格式不正確');
        }
        if (parentId === id) {
          throw new BadRequestException('場館不能將自己設為母場館');
        }
        const parent = await this.venueRepository.findOne({
          where: { id: parentId },
        });
        if (!parent) {
          throw new NotFoundException('指定的母場館不存在');
        }
        // 從新 parent 往上爬，若回到自己即為循環
        let cursor: Venue | null = parent;
        let depth = 0;
        while (cursor && cursor.parentVenueId != null) {
          if (cursor.parentVenueId === id) {
            throw new BadRequestException('不可建立循環的母子場館關係');
          }
          depth++;
          if (depth > MAX_GROUP_TREE_DEPTH) {
            throw new BadRequestException('集團層級過深（超過上限）');
          }
          cursor = await this.venueRepository.findOne({
            where: { id: cursor.parentVenueId },
          });
        }
        patch.parentVenueId = parentId;
      } else {
        patch.parentVenueId = null;
      }
    }

    if (Object.keys(patch).length > 0) {
      await this.venueRepository.update(id, patch);
    }
    return await this.venueRepository.findOne({ where: { id } });
  }

  // 取得指定 parent 底下的所有子場館（BADM-T11）
  async getChildren(parentId: number): Promise<Venue[]> {
    return await this.venueRepository.find({
      where: { parentVenueId: parentId },
      order: { id: 'ASC' },
    });
  }

  // 取得整個集團樹（root + 後代）。供前端顯示「集團架構」用。
  async getGroupTree(
    venueId: number,
  ): Promise<{ root: Venue; tree: VenueGroupNode }> {
    const start = await this.venueRepository.findOne({
      where: { id: venueId },
    });
    if (!start) {
      throw new NotFoundException('場館不存在');
    }

    // 爬到 root
    let root: Venue = start;
    let depth = 0;
    const visited = new Set<number>([root.id]);
    while (root.parentVenueId != null) {
      depth++;
      if (depth > MAX_GROUP_TREE_DEPTH) break;
      const next = await this.venueRepository.findOne({
        where: { id: root.parentVenueId },
      });
      if (!next) break;
      if (visited.has(next.id)) break; // 防循環（理論上 updateVenue 已擋）
      visited.add(next.id);
      root = next;
    }

    // 自 root 遞迴展開
    const tree = await this.buildGroupSubtree(root, 0, new Set<number>());
    return { root, tree };
  }

  private async buildGroupSubtree(
    node: Venue,
    depth: number,
    seen: Set<number>,
  ): Promise<VenueGroupNode> {
    if (depth >= MAX_GROUP_TREE_DEPTH || seen.has(node.id)) {
      return { id: node.id, name: node.name, children: [] };
    }
    seen.add(node.id);
    const children = await this.venueRepository.find({
      where: { parentVenueId: node.id },
      order: { id: 'ASC' },
    });
    const childNodes: VenueGroupNode[] = [];
    for (const c of children) {
      childNodes.push(await this.buildGroupSubtree(c, depth + 1, seen));
    }
    return { id: node.id, name: node.name, children: childNodes };
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

  // 取得單一備註（供 controller 驗 ownership 用）
  async getNoteById(id: number): Promise<VenueNote> {
    return await this.venueNoteRepository.findOne({ where: { id } });
  }

  // 刪除備註
  async deleteNote(id: number): Promise<void> {
    await this.venueNoteRepository.delete(id);
  }
}
