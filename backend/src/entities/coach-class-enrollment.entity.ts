import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { CoachClass } from './coach-class.entity';
import { Player } from './player.entity';

/**
 * 教練課場次的學員報名紀錄 (player ↔ coach_class 多對多 + 額外狀態欄位)
 * - status: enrolled / cancelled (cancelled 保留 row 做 audit；可由 service 重新 enroll 切回 enrolled)
 * - checkedInAt: 報到時間，null 表示未報到
 * - paymentStatus: pending / paid / refunded
 */
@Entity('coach_class_enrollments')
@Index(['coachClassId'])
@Index(['playerId'])
@Index(['coachClassId', 'playerId'], { unique: true })
export class CoachClassEnrollment {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  coachClassId: number;

  @ManyToOne(() => CoachClass, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'coachClassId' })
  coachClass: CoachClass;

  @Column()
  playerId: number;

  @ManyToOne(() => Player, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'playerId' })
  player: Player;

  /** enrolled = 在席 / cancelled = 已退出（保留紀錄） */
  @Column({ type: 'varchar', length: 16, default: 'enrolled' })
  status: string;

  @Column({ type: 'datetime', nullable: true })
  checkedInAt: Date | null;

  /** pending / paid / refunded */
  @Column({ type: 'varchar', length: 16, default: 'pending' })
  paymentStatus: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  amount: number;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @Column({ type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;
}
