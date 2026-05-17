import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import Stripe from 'stripe';
import { Payment } from '../entities/payment.entity';
import { Booking } from '../entities/booking.entity';
import { AuthUser } from '../auth/types';
import {
  isBookingOwnedBy,
  bookingOwnerWhereClauses,
} from '../auth/ownership.helper';

@Injectable()
export class PaymentService {
  constructor(
    @InjectRepository(Payment)
    private paymentRepository: Repository<Payment>,
    @InjectRepository(Booking)
    private bookingRepository: Repository<Booking>,
    @Inject('STRIPE_CLIENT')
    private readonly stripe: InstanceType<typeof Stripe> | null,
    private readonly dataSource: DataSource,
  ) {}

  // 建立付款紀錄（需確認該 booking 屬於 user）
  async createPayment(
    data: Partial<Payment>,
    user?: AuthUser,
  ): Promise<Payment> {
    if (user && data.bookingId) {
      const booking = await this.bookingRepository.findOne({
        where: { id: data.bookingId },
      });
      if (!booking || !isBookingOwnedBy(user, booking)) {
        throw new NotFoundException(`預約 #${data.bookingId} 不存在`);
      }
    }
    const payment = this.paymentRepository.create(data);
    return await this.paymentRepository.save(payment);
  }

  // 取得所有付款紀錄（依 user 角色過濾對應 booking）
  async findAll(user?: AuthUser): Promise<Payment[]> {
    if (!user)
      return await this.paymentRepository.find({ relations: ['booking'] });
    const ownedBookings = await this.bookingRepository.find({
      where: bookingOwnerWhereClauses(user),
      select: ['id'],
    });
    const ids = ownedBookings.map((b) => b.id);
    if (ids.length === 0) return [];
    return await this.paymentRepository
      .createQueryBuilder('p')
      .leftJoinAndSelect('p.booking', 'booking')
      .where('p.bookingId IN (:...ids)', { ids })
      .getMany();
  }

  // 取得單一付款紀錄
  async findOne(id: number, user?: AuthUser): Promise<Payment> {
    const payment = await this.paymentRepository.findOne({
      where: { id },
      relations: ['booking'],
    });
    if (user && payment && !isBookingOwnedBy(user, payment.booking)) {
      throw new NotFoundException(`付款紀錄 #${id} 不存在`);
    }
    return payment;
  }

  // 取得預約的付款紀錄
  async findByBooking(bookingId: number, user?: AuthUser): Promise<Payment> {
    if (user) {
      const booking = await this.bookingRepository.findOne({
        where: { id: bookingId },
      });
      if (!booking || !isBookingOwnedBy(user, booking)) {
        throw new NotFoundException(`預約 #${bookingId} 不存在`);
      }
    }
    return await this.paymentRepository.findOne({
      where: { bookingId },
      relations: ['booking'],
    });
  }

  // 更新付款狀態
  async updatePayment(
    id: number,
    data: Partial<Payment>,
    user?: AuthUser,
  ): Promise<Payment> {
    if (user) await this.findOne(id, user); // 觸發歸屬檢查
    await this.paymentRepository.update(id, data);
    return await this.findOne(id);
  }

  // 標記為已付款，同時清除預約的保留到期時間
  async markAsPaid(
    id: number,
    paymentMethod?: string,
    transactionId?: string,
    user?: AuthUser,
  ): Promise<Payment> {
    const payment = await this.findOne(id, user);
    if (payment) {
      payment.status = 'paid';
      payment.paidAt = new Date();
      if (paymentMethod) {
        payment.paymentMethod = paymentMethod;
      }
      if (transactionId) {
        payment.transactionId = transactionId;
      }
      const saved = await this.paymentRepository.save(payment);

      // 付款成功 → 清除保留倒數，並將預約升為 confirmed
      await this.bookingRepository.update(payment.bookingId, {
        holdExpiresAt: null,
        status: 'confirmed',
      });

      return saved;
    }
    return null;
  }

  // 建立 Stripe Checkout Session
  async createCheckoutSession(
    paymentId: number,
    user: AuthUser,
  ): Promise<string> {
    if (!this.stripe) {
      throw new ServiceUnavailableException('線上付款功能未啟用');
    }
    const payment = await this.paymentRepository.findOne({
      where: { id: paymentId },
      relations: ['booking'],
    });
    if (!payment) throw new NotFoundException('Payment not found');
    if (!isBookingOwnedBy(user, payment.booking)) throw new ForbiddenException();
    if (payment.status !== 'unpaid')
      throw new BadRequestException('Payment already initiated');

    const session = await this.stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'twd',
            unit_amount: Math.round(payment.amount), // TWD zero-decimal
            product_data: { name: `場地預約 #${payment.bookingId}` },
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${process.env.FRONTEND_URL}/booking/${payment.bookingId}?paid=true`,
      cancel_url: `${process.env.FRONTEND_URL}/booking/${payment.bookingId}?paid=false`,
      metadata: { paymentId: String(payment.id) }, // session-level metadata
    });

    await this.paymentRepository.update(paymentId, {
      status: 'processing',
      gatewayOrderId: session.id,
    });

    return session.url!;
  }

  // Webhook: 標記付款成功（含 hold-expiry race condition 處理）
  async markAsPaidByGateway(
    paymentId: number,
    txnId: string,
  ): Promise<void> {
    if (!this.stripe) {
      throw new ServiceUnavailableException('線上付款功能未啟用');
    }
    const stripe = this.stripe;
    await this.dataSource.transaction(async (manager) => {
      const payment = await manager.findOne(Payment, {
        where: { id: paymentId },
        relations: ['booking'],
      });
      if (!payment) return; // idempotency: already processed
      if (payment.status === 'paid') return;

      // Hold-expiry race: booking cancelled 在 webhook 到達前
      if (payment.booking.status === 'cancelled') {
        if (payment.status === 'refunding') return; // idempotency guard
        await manager.update(Payment, paymentId, { status: 'refunding' });
        await stripe.refunds.create({ payment_intent: txnId });
        await manager.update(Payment, paymentId, { status: 'refunded' });
        return;
      }

      await manager.update(Payment, paymentId, {
        status: 'paid',
        paidAt: new Date(),
        transactionId: txnId,
      });
      await manager.update(Booking, payment.bookingId, { status: 'confirmed' });
    });
  }

  // Webhook: 標記付款失敗（session expired）
  async markAsFailedByGateway(paymentId: number): Promise<void> {
    const payment = await this.paymentRepository.findOne({
      where: { id: paymentId },
    });
    if (!payment || payment.status !== 'processing') return; // idempotency
    await this.paymentRepository.update(paymentId, { status: 'failed' });
  }
}
