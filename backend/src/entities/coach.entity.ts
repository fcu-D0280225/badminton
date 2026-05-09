import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Venue } from './venue.entity';

/** 場館註冊的教練；歸屬 venue（一個 venue 可有多位教練） */
@Entity('coaches')
@Index(['venueId', 'active'])
export class Coach {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  venueId: number;

  @ManyToOne(() => Venue, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'venueId' })
  venue: Venue;

  @Column()
  name: string;

  @Column({ nullable: true })
  contact: string;

  /** 教練每小時授課費（給場館看，可作為定價依據） */
  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  hourlyRate: number;

  @Column({ type: 'text', nullable: true })
  bio: string;

  @Column({ default: true })
  active: boolean;

  @Column({ type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;
}
