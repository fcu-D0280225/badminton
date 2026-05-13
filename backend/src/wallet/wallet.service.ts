import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, QueryRunner, Repository } from 'typeorm';
import Stripe from 'stripe';
import { MemberWallet } from '../entities/member-wallet.entity';
import { WalletTransaction } from '../entities/wallet-transaction.entity';
import { Booking } from '../entities/booking.entity';
import { Payment } from '../entities/payment.entity';
import { Venue } from '../entities/venue.entity';
import { Account } from '../entities/account.entity';
import { EmailService } from '../email/email.service';
import { AuthUser } from '../auth/types';

@Injectable()
export class WalletService {
  constructor(
    @InjectRepository(MemberWallet)
    private walletRepository: Repository<MemberWallet>,
    @InjectRepository(WalletTransaction)
    private txRepository: Repository<WalletTransaction>,
    @InjectRepository(Booking)
    private bookingRepository: Repository<Booking>,
    @InjectRepository(Payment)
    private paymentRepository: Repository<Payment>,
    @InjectRepository(Venue)
    private venueRepository: Repository<Venue>,
    @InjectRepository(Account)
    private accountRepository: Repository<Account>,
    @Inject('STRIPE_CLIENT')
    private readonly stripe: InstanceType<typeof Stripe>,
    private emailService: EmailService,
    private dataSource: DataSource,
  ) {}

  // ── Lazy 建立錢包（D7：INSERT + catch dup key，race-safe）─────────
  async getOrCreateWallet(accountId: number): Promise<MemberWallet> {
    try {
      const wallet = this.walletRepository.create({ accountId, balance: 0 });
      return await this.walletRepository.save(wallet);
    } catch (err: any) {
      // MySQL ER_DUP_ENTRY (code 1062) or TypeORM UniqueConstraintViolationError
      if (
        err?.code === 'ER_DUP_ENTRY' ||
        err?.message?.includes('Duplicate entry')
      ) {
        return await this.walletRepository.findOne({ where: { accountId } });
      }
      throw err;
    }
  }

  // ── 取得自己的錢包（含最近 20 筆交易）───────────────────────────
  async getWallet(
    accountId: number,
  ): Promise<{ wallet: MemberWallet; transactions: WalletTransaction[] }> {
    const wallet = await this.getOrCreateWallet(accountId);
    const transactions = await this.txRepository.find({
      where: { walletId: wallet.id },
      order: { createdAt: 'DESC' },
      take: 20,
    });
    return { wallet, transactions };
  }

  // ── 場館手動加值（現金補登）──────────────────────────────────────
  async manualTopup(
    targetAccountId: number,
    amount: number,
    note: string | undefined,
    operatorAccountId: number,
  ): Promise<WalletTransaction> {
    // 驗證操作者是 venue role
    const operator = await this.accountRepository.findOne({
      where: { id: operatorAccountId },
    });
    if (!operator || operator.role !== 'venue') {
      throw new ForbiddenException('僅館方帳號可執行手動加值');
    }

    // 驗證目標是 member role
    const targetAccount = await this.accountRepository.findOne({
      where: { id: targetAccountId },
    });
    if (!targetAccount || targetAccount.role !== 'member') {
      throw new NotFoundException(`帳號 #${targetAccountId} 不存在或非會員`);
    }

    const wallet = await this.getOrCreateWallet(targetAccountId);

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      const locked = await this.lockWallet(queryRunner, wallet.id);
      const newBalance = Number(locked.balance) + Number(amount);

      await queryRunner.manager.update(MemberWallet, wallet.id, {
        balance: newBalance,
      });
      const tx = await queryRunner.manager.save(
        queryRunner.manager.create(WalletTransaction, {
          walletId: wallet.id,
          type: 'manual_topup',
          amount,
          balanceAfter: newBalance,
          bookingId: null,
          stripeSessionId: null,
          note: note ?? null,
          createdByAccountId: operatorAccountId,
        }),
      );
      await queryRunner.commitTransaction();
      return tx;
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  // ── 會員用錢包支付預約（D5 TOCTOU 保護）────────────────────────
  async payBooking(bookingId: number, user: AuthUser): Promise<MemberWallet> {
    if (user.role !== 'member') {
      throw new ForbiddenException('僅會員帳號可使用錢包付款');
    }

    const wallet = await this.getOrCreateWallet(user.id);

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      // (1) SELECT payment FOR UPDATE → status check
      const payment = await queryRunner.manager
        .getRepository(Payment)
        .createQueryBuilder('p')
        .setLock('pessimistic_write')
        .where('p.bookingId = :bookingId', { bookingId })
        .getOne();

      if (!payment) {
        throw new NotFoundException(`預約 #${bookingId} 的付款記錄不存在`);
      }
      if (payment.status !== 'unpaid') {
        throw new ConflictException(`預約 #${bookingId} 已完成付款，無法重複扣款`);
      }

      // 驗證 booking 歸屬
      const booking = await queryRunner.manager.findOne(Booking, {
        where: { id: bookingId },
      });
      if (!booking) {
        throw new NotFoundException(`預約 #${bookingId} 不存在`);
      }
      const ownsBooking =
        booking.organizerId === user.entityId ||
        (user.linkedEntityId != null &&
          booking.playerId === user.linkedEntityId);
      if (!ownsBooking) {
        throw new ForbiddenException('無權限支付此預約');
      }

      // (2) SELECT wallet FOR UPDATE → balance check
      const lockedWallet = await this.lockWallet(queryRunner, wallet.id);
      if (Number(lockedWallet.balance) < Number(payment.amount)) {
        throw new BadRequestException(
          `錢包餘額不足（餘額：${lockedWallet.balance}，需要：${payment.amount}）`,
        );
      }

      // (3) 扣款
      const newBalance = Number(lockedWallet.balance) - Number(payment.amount);
      await queryRunner.manager.update(MemberWallet, wallet.id, {
        balance: newBalance,
      });
      await queryRunner.manager.save(
        queryRunner.manager.create(WalletTransaction, {
          walletId: wallet.id,
          type: 'deduct',
          amount: payment.amount,
          balanceAfter: newBalance,
          bookingId,
          stripeSessionId: null,
          note: null,
          createdByAccountId: user.id,
        }),
      );
      await queryRunner.manager.update(Payment, payment.id, {
        status: 'paid',
      });

      await queryRunner.commitTransaction();

      return await this.walletRepository.findOne({ where: { id: wallet.id } });
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  // ── 取消預約時退款（若為錢包付款）──────────────────────────────
  async refundIfWalletPaid(bookingId: number): Promise<void> {
    // 查是否存在 deduct 類型的 wallet_transaction
    const deductTx = await this.txRepository.findOne({
      where: { bookingId, type: 'deduct' },
    });
    if (!deductTx) {
      // 非錢包付款（Stripe 或未付款），no-op
      return;
    }

    // 取得 booking 資訊，計算是否在取消退款政策期限內
    const booking = await this.bookingRepository.findOne({
      where: { id: bookingId },
    });
    if (!booking) return;

    const venue = await this.venueRepository.findOne({
      where: { id: booking.venueId },
    });

    if (venue?.cancellationPolicyHours != null) {
      // 解析 booking 開始時間：date "YYYY-MM-DD" + timeSlot "HH:MM-HH:MM" 首段
      const startTimeStr = booking.timeSlot.split('-')[0]; // "HH:MM"
      const [hours, minutes] = startTimeStr.split(':').map(Number);
      const bookingStart = new Date(`${booking.date}T00:00:00`);
      bookingStart.setHours(hours, minutes, 0, 0);

      const diffHours =
        (bookingStart.getTime() - Date.now()) / (1000 * 60 * 60);

      if (diffHours < venue.cancellationPolicyHours) {
        // 在免退款期限內，不退款
        await this.txRepository.save(
          this.txRepository.create({
            walletId: deductTx.walletId,
            type: 'refund',
            amount: 0,
            balanceAfter: deductTx.balanceAfter,
            bookingId,
            stripeSessionId: null,
            note: `取消退款政策限制：預約開始前 ${venue.cancellationPolicyHours} 小時內不退款`,
            createdByAccountId: deductTx.createdByAccountId,
          }),
        );
        return;
      }
    }

    // 正常退款
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      const lockedWallet = await this.lockWallet(queryRunner, deductTx.walletId);
      const newBalance = Number(lockedWallet.balance) + Number(deductTx.amount);

      await queryRunner.manager.update(MemberWallet, deductTx.walletId, {
        balance: newBalance,
      });
      await queryRunner.manager.save(
        queryRunner.manager.create(WalletTransaction, {
          walletId: deductTx.walletId,
          type: 'refund',
          amount: deductTx.amount,
          balanceAfter: newBalance,
          bookingId,
          stripeSessionId: null,
          note: null,
          createdByAccountId: deductTx.createdByAccountId,
        }),
      );

      await queryRunner.commitTransaction();
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  // ── Stripe 線上充值：建立 Checkout Session ───────────────────────
  async createTopupSession(
    accountId: number,
    amount: number,
  ): Promise<{ url: string }> {
    await this.getOrCreateWallet(accountId);

    const session = await this.stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'twd',
            unit_amount: Math.round(amount), // TWD zero-decimal
            product_data: { name: `錢包儲值 ${amount} 元` },
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${process.env.FRONTEND_URL}/wallet?topup=success`,
      cancel_url: `${process.env.FRONTEND_URL}/wallet?topup=cancel`,
      metadata: {
        walletTopupAccountId: String(accountId),
        walletTopupAmount: String(amount),
      },
    });

    return { url: session.url! };
  }

  // ── Stripe 線上充值：Webhook 處理（冪等，防重複到帳）──────────────
  async processStripeTopup(
    accountId: number,
    amount: number,
    stripeSessionId: string,
  ): Promise<void> {
    // 冪等防護：同一 stripeSessionId 已存在就跳過
    const existing = await this.txRepository.findOne({
      where: { stripeSessionId, type: 'topup' },
    });
    if (existing) return;

    const wallet = await this.getOrCreateWallet(accountId);

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      const locked = await this.lockWallet(queryRunner, wallet.id);
      const newBalance = Number(locked.balance) + Number(amount);

      await queryRunner.manager.update(MemberWallet, wallet.id, {
        balance: newBalance,
      });
      await queryRunner.manager.save(
        queryRunner.manager.create(WalletTransaction, {
          walletId: wallet.id,
          type: 'topup',
          amount,
          balanceAfter: newBalance,
          bookingId: null,
          stripeSessionId,
          note: null,
          createdByAccountId: accountId,
        }),
      );
      await queryRunner.commitTransaction();

      // 儲值成功 email 通知
      const account = await this.accountRepository.findOne({
        where: { id: accountId },
      });
      if (account?.email) {
        await this.emailService.notifyWalletTopup({
          to: account.email,
          amount,
          balance: newBalance,
        });
      }
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  // ── 場館查看所有 member 錢包餘額列表（D6 不附 transactions）──────
  async listMemberWallets(): Promise<
    { accountId: number; username: string; balance: number }[]
  > {
    const wallets = await this.walletRepository.find({
      order: { accountId: 'ASC' },
    });

    if (wallets.length === 0) return [];

    const accountIds = wallets.map((w) => w.accountId);
    const accounts = await this.accountRepository
      .createQueryBuilder('a')
      .where('a.id IN (:...ids)', { ids: accountIds })
      .select(['a.id', 'a.username'])
      .getMany();

    const usernameMap = new Map(accounts.map((a) => [a.id, a.username]));

    return wallets.map((w) => ({
      accountId: w.accountId,
      username: usernameMap.get(w.accountId) ?? '',
      balance: Number(w.balance),
    }));
  }

  // ── 場館查看特定 member 錢包餘額 + 交易紀錄 ──────────────────────
  async getMemberWallet(
    targetAccountId: number,
  ): Promise<{ wallet: MemberWallet; transactions: WalletTransaction[] }> {
    const wallet = await this.walletRepository.findOne({
      where: { accountId: targetAccountId },
    });
    if (!wallet) {
      throw new NotFoundException(`帳號 #${targetAccountId} 尚未建立錢包`);
    }
    const transactions = await this.txRepository.find({
      where: { walletId: wallet.id },
      order: { createdAt: 'DESC' },
      take: 50,
    });
    return { wallet, transactions };
  }

  // ── 私有：SELECT wallet FOR UPDATE ───────────────────────────────
  private async lockWallet(
    queryRunner: QueryRunner,
    walletId: number,
  ): Promise<MemberWallet> {
    return queryRunner.manager
      .getRepository(MemberWallet)
      .createQueryBuilder('w')
      .setLock('pessimistic_write')
      .where('w.id = :id', { id: walletId })
      .getOne();
  }
}
