import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Venue } from './venue.entity';
import { Coach } from './coach.entity';

/** 教練課場次：(教練, 場地, 日期, 時段) — 與一般 booking 分離以保留 capacity / fee 等差異欄位 */
@Entity('coach_classes')
@Index(['venueId', 'date'])
@Index(['coachId'])
export class CoachClass {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  venueId: number;

  @ManyToOne(() => Venue, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'venueId' })
  venue: Venue;

  @Column()
  coachId: number;

  @ManyToOne(() => Coach, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'coachId' })
  coach: Coach;

  @Column()
  date: string; // YYYY-MM-DD

  @Column()
  timeSlot: string; // HH:MM-HH:MM

  /** 報名上限；null 代表不限 */
  @Column({ type: 'int', nullable: true })
  capacity: number;

  /** 學員每人費用 */
  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  feePerStudent: number;

  /** open=接受報名 / closed=額滿或停止收 / cancelled=取消 */
  @Column({ type: 'varchar', length: 16, default: 'open' })
  status: string;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @Column({ type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;
}
