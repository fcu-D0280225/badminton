import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToMany,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
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

  /**
   * 取消退款免退期限（小時）。
   * null = 任何時間取消皆可退款（無限制）。
   * 例如 24 = 活動開始前 24 小時內取消，錢包付款不退款。
   */
  @Column({ type: 'int', nullable: true, default: null })
  cancellationPolicyHours: number | null;

  /**
   * 母場館 ID（BADM-T11 集團架構骨架）。
   * 連鎖場館組織層級用：null 表示獨立或為集團 root。
   * 不影響 ownership / IDOR：子場館不會自動繼承權限。
   */
  @Column({ type: 'int', nullable: true, default: null })
  parentVenueId: number | null;

  @ManyToOne(() => Venue, (v) => v.children, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'parentVenueId' })
  parent: Venue | null;

  @OneToMany(() => Venue, (v) => v.parent)
  children: Venue[];

  @OneToMany(() => Booking, (booking) => booking.venue)
  bookings: Booking[];

  @OneToMany(() => VenueNote, (note) => note.venue)
  notes: VenueNote[];

  @Column({ type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;
}
