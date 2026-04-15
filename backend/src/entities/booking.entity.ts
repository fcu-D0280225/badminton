import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { Venue } from './venue.entity';
import { Organizer } from './organizer.entity';
import { Player } from './player.entity';
import { Payment } from './payment.entity';
import { Booker } from './booker.entity';
import { BookingParticipant } from './booking-participant.entity';

@Entity('bookings')
export class Booking {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Venue, (venue) => venue.bookings)
  venue: Venue;

  @Column()
  venueId: number;

  @ManyToOne(() => Organizer, (organizer) => organizer.bookings, {
    nullable: true,
  })
  organizer: Organizer;

  @Column({ nullable: true })
  organizerId: number;

  @ManyToOne(() => Player, (player) => player.bookings, { nullable: true })
  player: Player;

  @Column({ nullable: true })
  playerId: number;

  @ManyToOne(() => Booker, (booker) => booker.bookings, { nullable: true })
  booker: Booker;

  @Column({ nullable: true })
  bookerId: number;

  @Column()
  date: string; // YYYY-MM-DD

  @Column()
  timeSlot: string; // HH:MM-HH:MM

  @Column({ type: 'text', nullable: true })
  notes: string;

  @Column({ default: 'pending' })
  status: string; // pending, confirmed, cancelled

  @Column({ default: false })
  checkedIn: boolean; // 是否已報到

  @Column({ nullable: true })
  recurringGroupId: string; // UUID，將重複預約的一組 booking 串在一起

  @Column({ nullable: true })
  recurringType: string; // 'weekly' | 'biweekly' | null

  @OneToOne(() => Payment, (payment) => payment.booking, { nullable: true })
  @JoinColumn()
  payment: Payment;

  @OneToMany(() => BookingParticipant, (p) => p.booking)
  participants: BookingParticipant[];

  @Column({ type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;
}
