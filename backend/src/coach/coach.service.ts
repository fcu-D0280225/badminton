import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Coach } from '../entities/coach.entity';
import { CoachClass } from '../entities/coach-class.entity';

const TIME_RE = /^\d{2}:\d{2}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const SLOT_RE = /^\d{2}:\d{2}-\d{2}:\d{2}$/;
const CLASS_STATUSES = ['open', 'closed', 'cancelled'] as const;

@Injectable()
export class CoachService {
  constructor(
    @InjectRepository(Coach)
    private coachRepo: Repository<Coach>,
    @InjectRepository(CoachClass)
    private classRepo: Repository<CoachClass>,
  ) {}

  // ── Coach CRUD ───────────────────────────────────────────────────
  async listCoaches(venueIds: number[]): Promise<Coach[]> {
    if (!venueIds.length) return [];
    return this.coachRepo.find({
      where: { venueId: In(venueIds) },
      order: { active: 'DESC', createdAt: 'ASC' },
    });
  }

  async getCoach(id: number, venueIds: number[]): Promise<Coach> {
    const c = await this.coachRepo.findOne({ where: { id } });
    if (!c || !venueIds.includes(c.venueId)) {
      throw new NotFoundException(`教練 #${id} 不存在`);
    }
    return c;
  }

  async createCoach(venueId: number, data: Partial<Coach>): Promise<Coach> {
    if (!data.name) throw new BadRequestException('name 必填');
    return this.coachRepo.save(this.coachRepo.create({ ...data, venueId }));
  }

  async updateCoach(
    id: number,
    venueIds: number[],
    data: Partial<Coach>,
  ): Promise<Coach> {
    const c = await this.getCoach(id, venueIds);
    Object.assign(c, data);
    return this.coachRepo.save(c);
  }

  async deleteCoach(id: number, venueIds: number[]): Promise<void> {
    const c = await this.getCoach(id, venueIds);
    await this.coachRepo.delete(c.id);
  }

  // ── CoachClass CRUD ──────────────────────────────────────────────
  async listClasses(
    venueIds: number[],
    opts: { coachId?: number; from?: string; to?: string } = {},
  ): Promise<CoachClass[]> {
    if (!venueIds.length) return [];
    const qb = this.classRepo
      .createQueryBuilder('c')
      .leftJoinAndSelect('c.coach', 'coach')
      .where('c.venueId IN (:...venueIds)', { venueIds })
      .orderBy('c.date', 'DESC')
      .addOrderBy('c.timeSlot', 'ASC');
    if (opts.coachId) qb.andWhere('c.coachId = :coachId', { coachId: opts.coachId });
    if (opts.from) qb.andWhere('c.date >= :from', { from: opts.from });
    if (opts.to) qb.andWhere('c.date <= :to', { to: opts.to });
    return qb.getMany();
  }

  async getClass(id: number, venueIds: number[]): Promise<CoachClass> {
    const c = await this.classRepo.findOne({
      where: { id },
      relations: ['coach'],
    });
    if (!c || !venueIds.includes(c.venueId)) {
      throw new NotFoundException(`教練課場次 #${id} 不存在`);
    }
    return c;
  }

  async createClass(
    venueId: number,
    data: Partial<CoachClass>,
  ): Promise<CoachClass> {
    this.validateClass(data);
    if (!data.coachId) throw new BadRequestException('coachId 必填');
    // 確保 coach 屬於同 venue
    const coach = await this.coachRepo.findOne({ where: { id: data.coachId } });
    if (!coach || coach.venueId !== venueId) {
      throw new NotFoundException('指定的教練不屬於此場館');
    }
    return this.classRepo.save(this.classRepo.create({ ...data, venueId }));
  }

  async updateClass(
    id: number,
    venueIds: number[],
    data: Partial<CoachClass>,
  ): Promise<CoachClass> {
    const c = await this.getClass(id, venueIds);
    this.validateClass({ ...c, ...data });
    if (data.coachId && data.coachId !== c.coachId) {
      const coach = await this.coachRepo.findOne({ where: { id: data.coachId } });
      if (!coach || coach.venueId !== c.venueId) {
        throw new NotFoundException('指定的教練不屬於此場館');
      }
    }
    Object.assign(c, data);
    return this.classRepo.save(c);
  }

  async deleteClass(id: number, venueIds: number[]): Promise<void> {
    const c = await this.getClass(id, venueIds);
    await this.classRepo.delete(c.id);
  }

  private validateClass(data: Partial<CoachClass>): void {
    if (data.date != null && !DATE_RE.test(data.date)) {
      throw new BadRequestException('date 格式錯誤');
    }
    if (data.timeSlot != null && !SLOT_RE.test(data.timeSlot)) {
      throw new BadRequestException('timeSlot 格式錯誤');
    }
    if (data.capacity != null) {
      if (!Number.isInteger(data.capacity) || data.capacity < 1) {
        throw new BadRequestException('capacity 須為正整數或 null');
      }
    }
    if (data.feePerStudent != null) {
      const fee = parseFloat(data.feePerStudent as any);
      if (!Number.isFinite(fee) || fee < 0) {
        throw new BadRequestException('feePerStudent 須為非負數');
      }
    }
    if (data.status != null && !CLASS_STATUSES.includes(data.status as any)) {
      throw new BadRequestException(`status 必須是 ${CLASS_STATUSES.join('/')}`);
    }
  }
}
