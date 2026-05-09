import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from 'typeorm';
import { Booking } from './booking.entity';
import { VenueNote } from './venue-note.entity';

@Entity('venues')
export class Venue {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column()
  contact: string;

  @Column({ nullable: true })
  address: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'text', nullable: true })
  openingHours: string;

  @Column({ type: 'text', nullable: true })
  feeInfo: string;

  /** 動態定價的 fallback：所有 pricing_rules 都不匹配時的每小時預設價格 */
  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  defaultPricePerHour: number;

  @OneToMany(() => Booking, (booking) => booking.venue)
  bookings: Booking[];

  @OneToMany(() => VenueNote, (note) => note.venue)
  notes: VenueNote[];

  @Column({ type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;
}
