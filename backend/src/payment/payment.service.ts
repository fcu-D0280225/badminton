import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Payment } from '../entities/payment.entity';
import { Booking } from '../entities/booking.entity';
import { AuthUser } from '../auth/types';
import { isBookingOwnedBy, bookingOwnerWhereClauses } from '../auth/ownership.helper';

@Injectable()
export class PaymentService {
  constructor(
    @InjectRepository(Payment)
    private paymentRepository: Repository<Payment>,
    @InjectRepository(Booking)
    private bookingRepository: Repository<Booking>,
  ) {}

  // 建立付款紀錄（需確認該 booking 屬於 user）
  async createPayment(data: Partial<Payment>, user?: AuthUser): Promise<Payment> {
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
    if (!user) return await this.paymentRepository.find({ relations: ['booking'] });
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
}
