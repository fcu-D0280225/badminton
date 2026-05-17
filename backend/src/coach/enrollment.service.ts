import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CoachClass } from '../entities/coach-class.entity';
import { CoachClassEnrollment } from '../entities/coach-class-enrollment.entity';
import { Player } from '../entities/player.entity';

const PAYMENT_STATUSES = ['pending', 'paid', 'refunded'] as const;
type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

@Injectable()
export class EnrollmentService {
  constructor(
    @InjectRepository(CoachClassEnrollment)
    private enrollmentRepo: Repository<CoachClassEnrollment>,
    @InjectRepository(CoachClass)
    private classRepo: Repository<CoachClass>,
    @InjectRepository(Player)
    private playerRepo: Repository<Player>,
  ) {}

  // ── 讀取 ─────────────────────────────────────────────────────────
  async listByClass(
    classId: number,
    venueIds: number[],
  ): Promise<CoachClassEnrollment[]> {
    if (!venueIds.length) return [];
    await this.assertClassOwned(classId, venueIds);
    return this.enrollmentRepo
      .createQueryBuilder('e')
      .leftJoinAndSelect('e.player', 'player')
      .where('e.coachClassId = :classId', { classId })
      .orderBy('e.createdAt', 'ASC')
      .getMany();
  }

  async listByPlayer(playerId: number): Promise<CoachClassEnrollment[]> {
    if (!playerId) return [];
    return this.enrollmentRepo
      .createQueryBuilder('e')
      .leftJoinAndSelect('e.coachClass', 'coachClass')
      .leftJoinAndSelect('coachClass.coach', 'coach')
      .where('e.playerId = :playerId', { playerId })
      .orderBy('e.createdAt', 'DESC')
      .getMany();
  }

  // ── 寫入 ─────────────────────────────────────────────────────────
  async enroll(
    classId: number,
    playerId: number,
    venueIds: number[],
    data: { amount?: number; notes?: string } = {},
  ): Promise<CoachClassEnrollment> {
    if (!playerId || !Number.isInteger(playerId)) {
      throw new BadRequestException('playerId 必填且須為整數');
    }
    const coachClass = await this.assertClassOwned(classId, venueIds);
    if (coachClass.status !== 'open') {
      throw new BadRequestException(
        `課程目前狀態為 ${coachClass.status}，無法報名`,
      );
    }

    const player = await this.playerRepo.findOne({ where: { id: playerId } });
    if (!player) {
      throw new NotFoundException(`學員 #${playerId} 不存在`);
    }

    // capacity 檢查（cancelled 不計）
    if (coachClass.capacity != null) {
      const activeCount = await this.enrollmentRepo.count({
        where: { coachClassId: classId, status: 'enrolled' },
      });
      if (activeCount >= coachClass.capacity) {
        throw new BadRequestException('課程已額滿');
      }
    }

    const amountToSet = this.resolveAmount(data.amount, coachClass);

    const existing = await this.enrollmentRepo.findOne({
      where: { coachClassId: classId, playerId },
    });
    if (existing) {
      if (existing.status === 'enrolled') {
        throw new BadRequestException('學員已報名');
      }
      // status === 'cancelled' → 重新啟用
      existing.status = 'enrolled';
      existing.checkedInAt = null;
      existing.paymentStatus = 'pending';
      existing.amount = amountToSet;
      if (data.notes !== undefined) existing.notes = data.notes;
      return this.enrollmentRepo.save(existing);
    }

    const created = this.enrollmentRepo.create({
      coachClassId: classId,
      playerId,
      status: 'enrolled',
      checkedInAt: null,
      paymentStatus: 'pending',
      amount: amountToSet,
      notes: data.notes ?? null,
    });
    return this.enrollmentRepo.save(created);
  }

  async cancel(
    enrollmentId: number,
    venueIds: number[],
  ): Promise<CoachClassEnrollment> {
    const { enrollment } = await this.assertOwnsEnrollment(
      enrollmentId,
      venueIds,
    );
    enrollment.status = 'cancelled';
    return this.enrollmentRepo.save(enrollment);
  }

  async checkin(
    enrollmentId: number,
    venueIds: number[],
  ): Promise<CoachClassEnrollment> {
    const { enrollment } = await this.assertOwnsEnrollment(
      enrollmentId,
      venueIds,
    );
    if (enrollment.status !== 'enrolled') {
      throw new BadRequestException('學員已退出，無法報到');
    }
    if (enrollment.checkedInAt) {
      throw new BadRequestException('學員已報到');
    }
    enrollment.checkedInAt = new Date();
    return this.enrollmentRepo.save(enrollment);
  }

  async undoCheckin(
    enrollmentId: number,
    venueIds: number[],
  ): Promise<CoachClassEnrollment> {
    const { enrollment } = await this.assertOwnsEnrollment(
      enrollmentId,
      venueIds,
    );
    enrollment.checkedInAt = null;
    return this.enrollmentRepo.save(enrollment);
  }

  async updatePayment(
    enrollmentId: number,
    venueIds: number[],
    status: PaymentStatus,
    amount?: number,
  ): Promise<CoachClassEnrollment> {
    if (!PAYMENT_STATUSES.includes(status)) {
      throw new BadRequestException(
        `paymentStatus 必須是 ${PAYMENT_STATUSES.join('/')}`,
      );
    }
    const { enrollment } = await this.assertOwnsEnrollment(
      enrollmentId,
      venueIds,
    );
    enrollment.paymentStatus = status;
    if (amount !== undefined && amount !== null) {
      const amt = parseFloat(amount as any);
      if (!Number.isFinite(amt) || amt < 0) {
        throw new BadRequestException('amount 須為非負數');
      }
      enrollment.amount = amt as any;
    }
    return this.enrollmentRepo.save(enrollment);
  }

  // ── 內部 ─────────────────────────────────────────────────────────

  /** 驗證 classId 屬於 venueIds，回傳 CoachClass entity；否則丟 NotFoundException */
  private async assertClassOwned(
    classId: number,
    venueIds: number[],
  ): Promise<CoachClass> {
    const c = await this.classRepo.findOne({ where: { id: classId } });
    if (!c || !venueIds.includes(c.venueId)) {
      throw new NotFoundException(`教練課場次 #${classId} 不存在`);
    }
    return c;
  }

  /** 驗證 enrollment 屬於 venueIds（透過 JOIN coachClass.venueId），回傳 enrollment + coachClass */
  private async assertOwnsEnrollment(
    enrollmentId: number,
    venueIds: number[],
  ): Promise<{
    enrollment: CoachClassEnrollment;
    coachClass: CoachClass;
  }> {
    if (!venueIds.length) {
      throw new NotFoundException(`學員報名 #${enrollmentId} 不存在`);
    }
    const enrollment = await this.enrollmentRepo.findOne({
      where: { id: enrollmentId },
      relations: ['coachClass'],
    });
    if (
      !enrollment ||
      !enrollment.coachClass ||
      !venueIds.includes(enrollment.coachClass.venueId)
    ) {
      throw new NotFoundException(`學員報名 #${enrollmentId} 不存在`);
    }
    return { enrollment, coachClass: enrollment.coachClass };
  }

  private resolveAmount(
    explicit: number | undefined,
    coachClass: CoachClass,
  ): number {
    if (explicit !== undefined && explicit !== null) {
      const amt = parseFloat(explicit as any);
      if (!Number.isFinite(amt) || amt < 0) {
        throw new BadRequestException('amount 須為非負數');
      }
      return amt;
    }
    const fee = parseFloat(coachClass.feePerStudent as any);
    return Number.isFinite(fee) ? fee : 0;
  }
}
