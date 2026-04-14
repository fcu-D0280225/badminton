import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Payment } from '../entities/payment.entity';
import { Booking } from '../entities/booking.entity';

@Injectable()
export class PaymentService {
  constructor(
    @InjectRepository(Payment)
    private paymentRepository: Repository<Payment>,
    @InjectRepository(Booking)
    private bookingRepository: Repository<Booking>,
  ) {}

  // 建立付款紀錄
  async createPayment(data: Partial<Payment>): Promise<Payment> {
    const payment = this.paymentRepository.create(data);
    return await this.paymentRepository.save(payment);
  }

  // 取得所有付款紀錄
  async findAll(): Promise<Payment[]> {
    return await this.paymentRepository.find({
      relations: ['booking'],
    });
  }

  // 取得單一付款紀錄
  async findOne(id: number): Promise<Payment> {
    return await this.paymentRepository.findOne({
      where: { id },
      relations: ['booking'],
    });
  }

  // 取得預約的付款紀錄
  async findByBooking(bookingId: number): Promise<Payment> {
    return await this.paymentRepository.findOne({
      where: { bookingId },
      relations: ['booking'],
    });
  }

  // 更新付款狀態
  async updatePayment(id: number, data: Partial<Payment>): Promise<Payment> {
    await this.paymentRepository.update(id, data);
    return await this.findOne(id);
  }

  // 標記為已付款
  async markAsPaid(
    id: number,
    paymentMethod?: string,
    transactionId?: string,
  ): Promise<Payment> {
    const payment = await this.findOne(id);
    if (payment) {
      payment.status = 'paid';
      payment.paidAt = new Date();
      if (paymentMethod) {
        payment.paymentMethod = paymentMethod;
      }
      if (transactionId) {
        payment.transactionId = transactionId;
      }
      return await this.paymentRepository.save(payment);
    }
    return null;
  }
}
