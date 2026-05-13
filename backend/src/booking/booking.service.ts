import {
  Injectable,
  ConflictException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository, Not, LessThan } from 'typeorm';
import { randomUUID } from 'crypto';
import { Booking } from '../entities/booking.entity';
import { Payment } from '../entities/payment.entity';
import { Account } from '../entities/account.entity';
import { WaitlistService } from '../waitlist/waitlist.service';
import { PushService } from '../push/push.service';
import { PricingService } from '../pricing/pricing.service';
import { WalletService } from '../wallet/wallet.service';
import { EmailService } from '../email/email.service';
import { AuthUser } from '../auth/types';
import {
  bookingOwnerWhereClauses,
  isBookingOwnedBy,
  getVenueIdsForUser,
} from '../auth/ownership.helper';

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
    private waitlistService: WaitlistService,
    private pushService: PushService,
    private pricingService: PricingService,
    private walletService: WalletService,
    private emailService: EmailService,
    private dataSource: DataSource,
  ) {}

  // ── 建立單筆預約（內部共用）──────────────────────────────────────
  async createBooking(
    data: Partial<Booking> & { amount?: number },
    user?: AuthUser,
  ): Promise<Booking> {
    const { amount, ...bookingData } = data;

    if (user) this.assertCreateAllowed(bookingData, user);

    // 重複預約檢查：同一成員不可重複預約同場次
    await this.assertNoDuplicate(bookingData);

    // 動態定價：未指定 amount 時自動套用規則 + venue 預設價格
    let resolvedAmount = amount;
    if (
      resolvedAmount == null &&
      bookingData.venueId &&
      bookingData.date &&
      bookingData.timeSlot
    ) {
      try {
        const quote = await this.pricingService.resolveAmount(
          bookingData.venueId,
          bookingData.date,
          bookingData.timeSlot,
        );
        resolvedAmount = quote.amount;
      } catch {
        resolvedAmount = 0; // pricing 失敗不擋預約建立
      }
    }

    // 設定保留到期時間（僅 pending 狀態）
    const holdExpiresAt = new Date();
    holdExpiresAt.setMinutes(holdExpiresAt.getMinutes() + HOLD_MINUTES);

    const booking = await this.bookingRepository.save(
      this.bookingRepository.create({ ...bookingData, holdExpiresAt }),
    );

    const payment = this.paymentRepository.create({
      bookingId: booking.id,
      amount: resolvedAmount ?? 0,
      status: 'unpaid',
    });
    await this.paymentRepository.save(payment);

    // 推播：通知預約者已建立
    await this.notifyBookingCreated(booking);

    return await this.findOne(booking.id);
  }

  // ── 建立重複預約（全系列原子性：任一週失敗即全部回滾）──────────
  async createRecurringBookings(
    data: Partial<Booking> & {
      amount?: number;
      recurringWeeks: number;
      recurringType?: string;
    },
    user?: AuthUser,
  ): Promise<Booking[]> {
    const {
      recurringWeeks,
      recurringType = 'weekly',
      amount,
      ...baseData
    } = data;
    const interval = recurringType === 'biweekly' ? 14 : 7;
    const groupId = randomUUID();

    // Step 1: 在 transaction 外預先驗證 + 解析定價（避免在 transaction 內做外部呼叫）
    const weekData: Array<{ date: string; resolvedAmount: number }> = [];
    for (let i = 0; i < recurringWeeks; i++) {
      const base = new Date(baseData.date + 'T00:00:00');
      base.setDate(base.getDate() + i * interval);
      const dateStr = base.toISOString().split('T')[0];

      if (user) this.assertCreateAllowed({ ...baseData, date: dateStr }, user);
      await this.assertNoDuplicate({ ...baseData, date: dateStr });

      let resolvedAmount = amount;
      if (
        resolvedAmount == null &&
        baseData.venueId &&
        baseData.timeSlot
      ) {
        try {
          const quote = await this.pricingService.resolveAmount(
            baseData.venueId,
            dateStr,
            baseData.timeSlot,
          );
          resolvedAmount = quote.amount;
        } catch {
          resolvedAmount = 0;
        }
      }
      weekData.push({ date: dateStr, resolvedAmount: resolvedAmount ?? 0 });
    }

    // Step 2: 所有 DB 寫入包在同一個 transaction，任一週失敗全系列回滾
    const savedBookings = await this.dataSource.transaction(
      async (manager: EntityManager) => {
        const results: Booking[] = [];
        for (const { date, resolvedAmount } of weekData) {
          const holdExpiresAt = new Date();
          holdExpiresAt.setMinutes(holdExpiresAt.getMinutes() + HOLD_MINUTES);

          const booking = await manager.save(
            manager.create(Booking, {
              ...baseData,
              date,
              recurringGroupId: groupId,
              recurringType,
              holdExpiresAt,
            }),
          );
          await manager.save(
            manager.create(Payment, {
              bookingId: booking.id,
              amount: resolvedAmount,
              status: 'unpaid',
            }),
          );
          results.push(booking);
        }
        return results;
      },
    );

    // Step 3: transaction 成功後載入關聯 + 發推播
    const fullBookings: Booking[] = [];
    for (const b of savedBookings) {
      const full = await this.findOne(b.id);
      await this.notifyBookingCreated(full);
      fullBookings.push(full);
    }
    return fullBookings;
  }

  // ── 取得所有預約（依 user 角色過濾）─────────────────────────────
  async findAll(user?: AuthUser): Promise<Booking[]> {
    const where = user ? bookingOwnerWhereClauses(user) : undefined;
    return await this.bookingRepository.find({
      where,
      relations: [
        'venue',
        'organizer',
        'player',
        'booker',
        'payment',
        'participants',
      ],
    });
  }

  // ── 取得單一預約 ─────────────────────────────────────────────────
  async findOne(id: number, user?: AuthUser): Promise<Booking> {
    const booking = await this.bookingRepository.findOne({
      where: { id },
      relations: [
        'venue',
        'organizer',
        'player',
        'booker',
        'payment',
        'participants',
      ],
    });
    if (user && booking && !isBookingOwnedBy(user, booking)) {
      throw new NotFoundException(`預約 #${id} 不存在`);
    }
    return booking;
  }

  // ── 取得同一重複預約群組 ─────────────────────────────────────────
  async findRecurringGroup(
    groupId: string,
    user?: AuthUser,
  ): Promise<Booking[]> {
    const rows = await this.bookingRepository.find({
      where: { recurringGroupId: groupId },
      relations: ['venue', 'organizer', 'player', 'booker', 'payment'],
      order: { date: 'ASC' },
    });
    if (!user) return rows;
    return rows.filter((b) => isBookingOwnedBy(user, b));
  }

  // ── 更新預約 ─────────────────────────────────────────────────────
  async updateBooking(
    id: number,
    data: Partial<Booking>,
    user?: AuthUser,
  ): Promise<Booking> {
    const before = await this.findOne(id, user); // 觸發歸屬檢查
    if (!before) throw new NotFoundException(`預約 #${id} 不存在`);
    // 館方手動確認時清除保留到期時間，避免 cron 自動取消
    if (data.status === 'confirmed') {
      data = { ...data, holdExpiresAt: null };
    }
    await this.bookingRepository.update(id, data);
    const after = await this.findOne(id);

    // 取消時：退款（若為錢包付款）+ 通知候補名單第一位
    if (data.status === 'cancelled' && before.status !== 'cancelled') {
      await this.walletService.refundIfWalletPaid(id);
      await this.triggerWaitlistNotification(after);
      await this.notifyBookingCancelled(after);
    }

    return after;
  }

  // ── 取消重複預約群組（只取消今天以後的）────────────────────────
  async cancelRecurringGroup(
    groupId: string,
    user?: AuthUser,
  ): Promise<{ cancelled: number }> {
    const today = new Date().toISOString().split('T')[0];
    const bookings = await this.bookingRepository.find({
      where: { recurringGroupId: groupId },
    });

    let cancelled = 0;
    for (const b of bookings) {
      if (user && !isBookingOwnedBy(user, b)) continue;
      if (b.date >= today && b.status !== 'cancelled') {
        await this.updateBooking(b.id, { status: 'cancelled' });
        cancelled++;
      }
    }
    return { cancelled };
  }

  // ── 刪除預約（含付款記錄）──────────────────────────────────────
  async deleteBooking(id: number, user?: AuthUser): Promise<void> {
    const booking = await this.findOne(id, user); // 觸發歸屬檢查
    if (!booking) throw new NotFoundException(`預約 #${id} 不存在`);
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
    if (playerId)
      memberConditions.push({
        venueId,
        date,
        timeSlot,
        playerId,
        status: Not('cancelled'),
      });
    if (organizerId)
      memberConditions.push({
        venueId,
        date,
        timeSlot,
        organizerId,
        status: Not('cancelled'),
      });
    if (bookerId)
      memberConditions.push({
        venueId,
        date,
        timeSlot,
        bookerId,
        status: Not('cancelled'),
      });

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
    const account = await this.accountRepository.findOne({
      where: { id: accountId },
    });
    if (account?.email) {
      await this.emailService.notifyWaitlistAvailable({
        to: account.email,
        date: booking.date,
        timeSlot: booking.timeSlot,
        venueName: booking.venue?.name ?? `場館 #${booking.venueId}`,
      });
    }
  }

  // ── 私有：預約建立推播 + Email ────────────────────────────────
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
    const account = await this.accountRepository.findOne({
      where: { id: accountId },
    });
    if (account?.email) {
      await this.emailService.notifyBookingCreated({
        to: account.email,
        date: booking.date,
        timeSlot: booking.timeSlot,
        venueName: booking.venue?.name ?? `場館 #${booking.venueId}`,
        bookingId: booking.id,
      });
    }
  }

  // ── 私有：取消預約推播 + Email ────────────────────────────────
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
    const account = await this.accountRepository.findOne({
      where: { id: accountId },
    });
    if (account?.email) {
      await this.emailService.notifyBookingCancelled({
        to: account.email,
        date: booking.date,
        timeSlot: booking.timeSlot,
        venueName: booking.venue?.name ?? `場館 #${booking.venueId}`,
        bookingId: booking.id,
      });
    }
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

  // ── 私有：建立預約時禁止偽造他人身分 ───────────────────────────
  private assertCreateAllowed(data: Partial<Booking>, user: AuthUser): void {
    switch (user.role) {
      case 'venue':
        if (!getVenueIdsForUser(user).includes(data.venueId)) {
          throw new ForbiddenException('只能在自己（任一綁定）的場地建立預約');
        }
        return;
      case 'organizer':
        if (data.organizerId !== user.entityId) {
          throw new ForbiddenException('organizer 只能以自己的身分建立預約');
        }
        return;
      case 'player':
        if (data.playerId !== user.entityId) {
          throw new ForbiddenException('player 只能以自己的身分建立預約');
        }
        return;
      case 'member': {
        const okOrg = data.organizerId === user.entityId;
        const okPlayer =
          user.linkedEntityId != null && data.playerId === user.linkedEntityId;
        if (!okOrg && !okPlayer) {
          throw new ForbiddenException('member 只能以自己的身分建立預約');
        }
        return;
      }
      case 'booker':
        if (data.bookerId !== user.entityId) {
          throw new ForbiddenException('booker 只能以自己的身分建立預約');
        }
        return;
      default:
        throw new ForbiddenException('未知的角色');
    }
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
