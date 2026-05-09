import {
  Entity,
  PrimaryColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Account } from './account.entity';
import { Venue } from './venue.entity';

/**
 * 多場館 pivot：venue 角色帳號可綁定多個 venue。
 * 既有單一場館帳號的 entityId 對應 isPrimary=true 的列。
 */
@Entity('account_venues')
@Index(['accountId'])
@Index(['venueId'])
export class AccountVenue {
  @PrimaryColumn()
  accountId: number;

  @PrimaryColumn()
  venueId: number;

  @Column({ default: false })
  isPrimary: boolean;

  @Column({ type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;

  @ManyToOne(() => Account, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'accountId' })
  account: Account;

  @ManyToOne(() => Venue, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'venueId' })
  venue: Venue;
}
