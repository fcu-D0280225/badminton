import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Player } from './player.entity';
import { Venue } from './venue.entity';
import { Organizer } from './organizer.entity';

@Entity('ratings')
export class Rating {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Player, (player) => player.ratings)
  @JoinColumn()
  player: Player;

  @Column()
  playerId: number;

  @ManyToOne(() => Venue, { nullable: true })
  @JoinColumn()
  venue: Venue;

  @Column({ nullable: true })
  venueId: number;

  @ManyToOne(() => Organizer, { nullable: true })
  @JoinColumn()
  organizer: Organizer;

  @Column({ nullable: true })
  organizerId: number;

  @Column({ type: 'int' })
  score: number; // 1-5

  @Column({ type: 'text', nullable: true })
  comment: string;

  @Column({ type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;
}
