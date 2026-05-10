import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PricingRule } from '../entities/pricing-rule.entity';
import { Venue } from '../entities/venue.entity';

const TIME_RE = /^\d{2}:\d{2}$/;

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

function parseSlot(slot: string): { startMin: number; endMin: number } | null {
  // "HH:MM-HH:MM"
  const parts = slot.split('-');
  if (parts.length !== 2) return null;
  if (!TIME_RE.test(parts[0]) || !TIME_RE.test(parts[1])) return null;
  return { startMin: toMinutes(parts[0]), endMin: toMinutes(parts[1]) };
}

@Injectable()
export class PricingService {
  constructor(
    @InjectRepository(PricingRule)
    private ruleRepo: Repository<PricingRule>,
    @InjectRepository(Venue)
    private venueRepo: Repository<Venue>,
  ) {}

  // ── CRUD ─────────────────────────────────────────────────────────
  async listForVenue(venueId: number): Promise<PricingRule[]> {
    return this.ruleRepo.find({
      where: { venueId },
      order: { priority: 'DESC', createdAt: 'ASC' },
    });
  }

  async create(
    venueId: number,
    data: Partial<PricingRule>,
  ): Promise<PricingRule> {
    this.validate(data);
    const rule = this.ruleRepo.create({ ...data, venueId });
    return this.ruleRepo.save(rule);
  }

  async update(
    id: number,
    venueId: number,
    data: Partial<PricingRule>,
  ): Promise<PricingRule> {
    const existing = await this.ruleRepo.findOne({ where: { id, venueId } });
    if (!existing) throw new NotFoundException(`定價規則 #${id} 不存在`);
    this.validate({ ...existing, ...data });
    Object.assign(existing, data);
    return this.ruleRepo.save(existing);
  }

  async delete(id: number, venueId: number): Promise<void> {
    const rule = await this.ruleRepo.findOne({ where: { id, venueId } });
    if (!rule) throw new NotFoundException(`定價規則 #${id} 不存在`);
    await this.ruleRepo.delete(id);
  }

  // ── 預設價格（Venue 上）─────────────────────────────────────────
  async getDefaultPrice(venueId: number): Promise<number> {
    const v = await this.venueRepo.findOne({ where: { id: venueId } });
    if (!v) throw new NotFoundException(`場館 #${venueId} 不存在`);
    return parseFloat((v.defaultPricePerHour as any) ?? 0);
  }

  async setDefaultPrice(venueId: number, price: number): Promise<void> {
    if (typeof price !== 'number' || price < 0) {
      throw new BadRequestException('預設單價需為非負數');
    }
    await this.venueRepo.update(venueId, { defaultPricePerHour: price });
  }

  // ── Resolver ────────────────────────────────────────────────────
  /**
   * 計算此預約的金額：
   *   1. 解析 timeSlot → 計算時長 (hours)
   *   2. 找 active 規則中 (dayOfWeek 匹配 OR -1) 且時段重疊的最高 priority 規則
   *   3. 沒匹配 → 使用 venue.defaultPricePerHour
   *   4. 都沒設 → 0
   * 回傳 amount = pricePerHour × hours，四捨五入到整數
   */
  async resolveAmount(
    venueId: number,
    date: string, // YYYY-MM-DD
    timeSlot: string, // HH:MM-HH:MM
  ): Promise<{
    amount: number;
    pricePerHour: number;
    ruleId: number | null;
    source: 'rule' | 'venue_default' | 'zero';
  }> {
    const slot = parseSlot(timeSlot);
    if (!slot) {
      return { amount: 0, pricePerHour: 0, ruleId: null, source: 'zero' };
    }
    const hours = (slot.endMin - slot.startMin) / 60;
    if (hours <= 0) {
      return { amount: 0, pricePerHour: 0, ruleId: null, source: 'zero' };
    }

    const dow = new Date(date + 'T00:00:00').getDay(); // 0=Sun

    const rules = await this.ruleRepo.find({
      where: { venueId, active: true },
      order: { priority: 'DESC', createdAt: 'ASC' },
    });
    for (const r of rules) {
      if (r.dayOfWeek !== -1 && r.dayOfWeek !== dow) continue;
      const ruleStart = toMinutes(r.startTime);
      const ruleEnd = toMinutes(r.endTime);
      // booking 時段必須完全落在規則時段內（避免跨越多規則時計算混亂）
      if (slot.startMin >= ruleStart && slot.endMin <= ruleEnd) {
        const pph = parseFloat((r.pricePerHour as any) ?? 0);
        return {
          amount: Math.round(pph * hours),
          pricePerHour: pph,
          ruleId: r.id,
          source: 'rule',
        };
      }
    }

    const def = await this.getDefaultPrice(venueId);
    if (def > 0) {
      return {
        amount: Math.round(def * hours),
        pricePerHour: def,
        ruleId: null,
        source: 'venue_default',
      };
    }
    return { amount: 0, pricePerHour: 0, ruleId: null, source: 'zero' };
  }

  // ── 驗證 ────────────────────────────────────────────────────────
  private validate(data: Partial<PricingRule>): void {
    if (data.dayOfWeek != null) {
      const d = data.dayOfWeek;
      if (!Number.isInteger(d) || d < -1 || d > 6) {
        throw new BadRequestException('dayOfWeek 必須是 -1 (任意) 或 0~6');
      }
    }
    if (data.startTime != null && !TIME_RE.test(data.startTime)) {
      throw new BadRequestException('startTime 必須是 HH:MM 格式');
    }
    if (data.endTime != null && !TIME_RE.test(data.endTime)) {
      throw new BadRequestException('endTime 必須是 HH:MM 格式');
    }
    if (data.startTime && data.endTime) {
      if (toMinutes(data.startTime) >= toMinutes(data.endTime)) {
        throw new BadRequestException('startTime 必須早於 endTime');
      }
    }
    if (data.pricePerHour != null) {
      const p = parseFloat(data.pricePerHour as any);
      if (!Number.isFinite(p) || p < 0) {
        throw new BadRequestException('pricePerHour 必須為非負數');
      }
    }
  }
}
