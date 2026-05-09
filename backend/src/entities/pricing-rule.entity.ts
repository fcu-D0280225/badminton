import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Venue } from './venue.entity';

/**
 * 動態定價規則：venue 設定 (週幾, 時段) → 每小時單價。
 * 預約建立時系統自動套用：依 priority 由高到低尋找第一個匹配的 active 規則。
 * dayOfWeek = -1 代表所有星期（用於通用規則）。
 */
@Entity('pricing_rules')
@Index(['venueId', 'active'])
export class PricingRule {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  venueId: number;

  @ManyToOne(() => Venue, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'venueId' })
  venue: Venue;

  /** 0=Sun, 1=Mon ... 6=Sat；-1 代表任意星期 */
  @Column({ type: 'tinyint' })
  dayOfWeek: number;

  /** HH:MM 時段起點（含） */
  @Column({ type: 'varchar', length: 5 })
  startTime: string;

  /** HH:MM 時段終點（不含；採半開區間 [start, end)） */
  @Column({ type: 'varchar', length: 5 })
  endTime: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  pricePerHour: number;

  /** 衝突時的優先級，數字越大越優先 */
  @Column({ type: 'int', default: 0 })
  priority: number;

  @Column({ default: true })
  active: boolean;

  @Column({ type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;
}
