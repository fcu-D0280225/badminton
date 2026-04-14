import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Venue } from './venue.entity';

@Entity('venue_notes')
export class VenueNote {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Venue, (venue) => venue.notes)
  @JoinColumn()
  venue: Venue;

  @Column()
  venueId: number;

  @Column({ type: 'text' })
  content: string;

  @Column({ default: 'public' })
  visibility: string; // public (給所有人看), organizer (只給團主看), player (只給臨打看)

  @Column({ type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;
}
