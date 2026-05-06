import { Injectable, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Not, LessThan } from 'typeorm';
import { randomUUID } from 'crypto';
import { Booking } from '../entities/booking.entity';
import { Payment } from '../entities/payment.entity';
import { Account } from '../entities/account.entity';
import { BookingParticipant } from '../entities/booking-participant.entity';
import { WaitlistService } from '../waitlist/waitlist.service';
import { PushService } from '../push/push.service';

/** 預約保留時間（分鐘）：pending 狀態下未付款超過此時間自動取消 */
const HOLD_MINUTES = 15;

@Injectable()
export class BookingService {
  constructor(
    @InjectRepository(Booking)
    private bookingRepository: Repository<Booking>,
    @InjectRepository(Payment)
    private paymentRepository: Repository<Payment>,
    @InjectRepository(Account)
    private accountRepository: Repository<Account>,
    @InjectRepository(BookingParticipant)
    private participantRepository: Repository<BookingParticipant>,
    private waitlistService: WaitlistService,
    private pushService: PushService,
  ) {}

  // ── 建立單筆預約（內部共用）──────────────────────────────────────
  async createBooking(
    data: Partial<Booking> & { amount?: number },
  ): Promise<Booking> {
    const { amount, ...bookingData } = data;

    // 重複預約檢查：同一成員不可重複預約同場次
    await this.assertNoDuplicate(bookingData);

    // 設定保留到期時間（僅 pending 狀態）
    const holdExpiresAt = new Date();
    holdExpiresAt.setMinutes(holdExpiresAt.getMinutes() + HOLD_MINUTES);

    const booking = await this.bookingRepository.save(
      this.bookingRepository.create({ ...bookingData, holdExpiresAt }),
    );

    const payment = this.paymentRepository.create({
      bookingId: booking.id,
      amount: amount ?? 0,
      status: 'unpaid',
    });
    await this.paymentRepository.save(payment);

    // 推播：通知預約者已建立
    await this.notifyBookingCreated(booking);

    return await this.findOne(booking.id);
  }

  // ── 建立重複預約 ─────────────────────────────────────────────────
  async createRecurringBookings(
    data: Partial<Booking> & {
      amount?: number;
      recurringWeeks: number;
      recurringType?: string;
    },
  ): Promise<Booking[]> {
    const {
      recurringWeeks,
      recurringType = 'weekly',
      amount,
      ...baseData
    } = data;
    const interval = recurringType === 'biweekly' ? 14 : 7;
    const groupId = randomUUID();
    const bookings: Booking[] = [];

    for (let i = 0; i < recurringWeeks; i++) {
      const base = new Date(baseData.date + 'T00:00:00');
      base.setDate(base.getDate() + i * interval);
      const dateStr = base.toISOString().split('T')[0];

      const booking = await this.createBooking({
        ...baseData,
        date: dateStr,
        recurringGroupId: groupId,
        recurringType,
        amount,
      });
      bookings.push(booking);
    }
    return bookings;
  }

  // ── 取得所有預約 ─────────────────────────────────────────────────
  async findAll(): Promise<Booking[]> {
    return await this.bookingRepository.find({
      relations: ['venue', 'organizer', 'player', 'booker', 'payment', 'participants'],
    });
  }

  // ── 取得單一預約 ─────────────────────────────────────────────────
  async findOne(id: number): Promise<Booking> {
    return await this.bookingRepository.findOne({
      where: { id },
      relations: ['venue', 'organizer', 'player', 'booker', 'payment', 'participants'],
    });
  }

  // ── 取得同一重複預約群組 ─────────────────────────────────────────
  async findRecurringGroup(groupId: string): Promise<Booking[]> {
    return await this.bookingRepository.find({
      where: { recurringGroupId: groupId },
      relations: ['venue', 'payment'],
      order: { date: 'ASC' },
    });
  }

  // ── 更新預約 ─────────────────────────────────────────────────────
  async updateBooking(id: number, data: Partial<Booking>): Promise<Booking> {
    const before = await this.findOne(id);
    await this.bookingRepository.update(id, data);
    const after = await this.findOne(id);

    // 取消時：通知候補名單第一位
    if (data.status === 'cancelled' && before.status !== 'cancelled') {
      await this.triggerWaitlistNotification(after);
      await this.notifyBookingCancelled(after);
    }

    return after;
  }

  // ── 取消重複預約群組（只取消今天以後的）────────────────────────
  async cancelRecurringGroup(groupId: string): Promise<{ cancelled: number }> {
    const today = new Date().toISOString().split('T')[0];
    const bookings = await this.bookingRepository.find({
      where: { recurringGroupId: groupId },
    });

    let cancelled = 0;
    for (const b of bookings) {
      if (b.date >= today && b.status !== 'cancelled') {
        await this.updateBooking(b.id, { status: 'cancelled' });
        cancelled++;
      }
    }
    return { cancelled };
  }

  // ── 刪除預約（含付款記錄）──────────────────────────────────────
  async deleteBooking(id: number): Promise<void> {
    const booking = await this.findOne(id);
    if (booking?.status !== 'cancelled') {
      await this.triggerWaitlistNotification(booking);
    }
    if (booking?.payment) {
      await this.paymentRepository.delete(booking.payment.id);
    }
    await this.bookingRepository.delete(id);
  }

  // ── 掃描並釋出過期保留（由 HoldExpiryService 的 cron 呼叫）─────
  async releaseExpiredHolds(): Promise<number> {
    const now = new Date();
    const expired = await this.bookingRepository.find({
      where: {
        status: 'pending',
        holdExpiresAt: LessThan(now),
      },
    });

    for (const booking of expired) {
      await this.updateBooking(booking.id, {
        status: 'cancelled',
        holdExpiresAt: null,
      });
      // 推播：告知預約者保留時間已到
      await this.notifyHoldExpired(booking);
    }

    return expired.length;
  }

  // ── 私有：重複預約檢查 ─────────────────────────────────────────
  private async assertNoDuplicate(data: Partial<Booking>): Promise<void> {
    const { venueId, date, timeSlot, playerId, organizerId, bookerId } = data;
    if (!venueId || !date || !timeSlot) return;

    // 只需要有任一身份欄位就檢查
    const memberConditions: object[] = [];
    if (playerId)    memberConditions.push({ venueId, date, timeSlot, playerId,    status: Not('cancelled') });
    if (organizerId) memberConditions.push({ venueId, date, timeSlot, organizerId, status: Not('cancelled') });
    if (bookerId)    memberConditions.push({ venueId, date, timeSlot, bookerId,    status: Not('cancelled') });

    if (memberConditions.length === 0) return;

    const existing = await this.bookingRepository.findOne({
      where: memberConditions as any,
    });

    if (existing) {
      throw new ConflictException(
        `同一場次已有預約（id: ${existing.id}），不可重複預約`,
      );
    }
  }

  // ── 私有：取消後觸發候補通知 ────────────────────────────────────
  private async triggerWaitlistNotification(booking: Booking): Promise<void> {
    if (!booking?.venueId || !booking?.date || !booking?.timeSlot) return;

    const first = await this.waitlistService.getFirstWaiting(
      booking.venueId,
      booking.date,
      booking.timeSlot,
    );
    if (!first) return;

    await this.waitlistService.markNotified(first.id);

    const accountId = await this.resolveAccountId(
      first.playerId,
      first.organizerId,
    );
    if (!accountId) return;

    await this.pushService.notifyAccount(accountId, {
      title: '🏸 候補有缺額了！',
      body: `${booking.date} ${booking.timeSlot} 的場次有空位，快去預約！`,
      url: '/',
    });
  }

  // ── 私有：預約建立推播 ─────────────────────────────────────────
  private async notifyBookingCreated(booking: Booking): Promise<void> {
    const accountId = await this.resolveAccountId(
      booking.playerId,
      booking.organizerId,
    );
    if (!accountId) return;
    await this.pushService.notifyAccount(accountId, {
      title: '🏸 預約確認',
      body: `${booking.date} ${booking.timeSlot} 預約已建立，請於 ${HOLD_MINUTES} 分鐘內完成付款`,
      url: '/',
    });
  }

  // ── 私有：取消預約推播 ─────────────────────────────────────────
  private async notifyBookingCancelled(booking: Booking): Promise<void> {
    const accountId = await this.resolveAccountId(
      booking.playerId,
      booking.organizerId,
    );
    if (!accountId) return;
    await this.pushService.notifyAccount(accountId, {
      title: '🏸 預約已取消',
      body: `${booking.date} ${booking.timeSlot} 的預約已被取消`,
      url: '/',
    });
  }

  // ── 私有：保留到期推播 ─────────────────────────────────────────
  private async notifyHoldExpired(booking: Booking): Promise<void> {
    const accountId = await this.resolveAccountId(
      booking.playerId,
      booking.organizerId,
    );
    if (!accountId) return;
    await this.pushService.notifyAccount(accountId, {
      title: '🏸 預約保留已到期',
      body: `${booking.date} ${booking.timeSlot} 因逾 ${HOLD_MINUTES} 分鐘未付款，預約已自動取消`,
      url: '/',
    });
  }

  // ── 取得 booker 的所有預約 ──────────────────────────────────────
  async findByBooker(bookerId: number): Promise<Booking[]> {
    return await this.bookingRepository.find({
      where: { bookerId },
      relations: ['venue', 'payment', 'participants'],
      order: { date: 'DESC' },
    });
  }

  // ── 參與者管理 ─────────────────────────────────────────────────
  async getParticipants(bookingId: number): Promise<BookingParticipant[]> {
    return await this.participantRepository.find({
      where: { bookingId },
      order: { addedAt: 'ASC' },
    });
  }

  async addParticipant(
    bookingId: number,
    data: { name: string; phone?: string },
  ): Promise<BookingParticipant> {
    return await this.participantRepository.save(
      this.participantRepository.create({
        bookingId,
        name: data.name,
        phone: data.phone,
      }),
    );
  }

  async removeParticipant(participantId: number): Promise<void> {
    await this.participantRepository.delete(participantId);
  }

  async toggleParticipantCheckin(
    participantId: number,
  ): Promise<BookingParticipant> {
    const p = await this.participantRepository.findOne({
      where: { id: participantId },
    });
    p.checkedIn = !p.checkedIn;
    return await this.participantRepository.save(p);
  }

  async updateParticipantPayment(
    participantId: number,
    data: { paymentStatus?: string; amount?: number },
  ): Promise<BookingParticipant> {
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

  // ── 私有：從 playerId/organizerId 找 accountId ─────────────────
  private async resolveAccountId(
    playerId?: number,
    organizerId?: number,
  ): Promise<number | null> {
    if (!playerId && !organizerId) return null;
    try {
      if (playerId) {
        const acc = await this.accountRepository.findOne({
          where: [
            { role: 'player', entityId: playerId },
            { role: 'member', linkedEntityId: playerId },
          ],
        });
        if (acc) return acc.id;
      }
      if (organizerId) {
        const acc = await this.accountRepository.findOne({
          where: [
            { role: 'organizer', entityId: organizerId },
            { role: 'member', entityId: organizerId },
          ],
        });
        if (acc) return acc.id;
      }
    } catch {
      /* push 失敗不影響主流程 */
    }
    return null;
  }
}
