import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  Index,
} from 'typeorm';
import { Booking } from './booking.entity';

@Entity('booking_participants')
@Index(['bookingId'])
export class BookingParticipant {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Booking, (booking) => booking.participants, {
    onDelete: 'CASCADE',
  })
  booking: Booking;

  @Column()
  bookingId: number;

  @Column()
  name: string;

  @Column({ nullable: true })
  phone: string;

  @Column({ default: false })
  checkedIn: boolean;

  @Column({ default: 'unpaid' })
  paymentStatus: string; // unpaid | paid | refunded

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  amount: number;

  @Column({ type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
  addedAt: Date;
}
