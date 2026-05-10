import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Booking } from './booking.entity';

@Entity('payments')
export class Payment {
  @PrimaryGeneratedColumn()
  id: number;

  @OneToOne(() => Booking, (booking) => booking.payment)
  @JoinColumn()
  booking: Booking;

  @Column()
  bookingId: number;

  @Column('decimal', { precision: 10, scale: 2 })
  amount: number;

  @Column({
    type: 'enum',
    enum: ['unpaid', 'processing', 'refunding', 'paid', 'refunded', 'failed'],
    default: 'unpaid',
  })
  status: 'unpaid' | 'processing' | 'refunding' | 'paid' | 'refunded' | 'failed';

  @Column({ type: 'text', nullable: true })
  paymentMethod: string;

  @Column({ type: 'text', nullable: true })
  transactionId: string;

  @Column({ type: 'datetime', nullable: true })
  paidAt: Date;

  @Index({ unique: true, sparse: true })
  @Column({ nullable: true })
  gatewayOrderId: string;

  @Column({ nullable: true, type: 'text' })
  webhookPayload: string;

  @Column({ type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;
}
