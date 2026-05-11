import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { MemberWallet } from './member-wallet.entity';

@Entity('wallet_transactions')
export class WalletTransaction {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => MemberWallet, (w) => w.transactions)
  @JoinColumn()
  wallet: MemberWallet;

  @Index()
  @Column()
  walletId: number;

  @Column({
    type: 'enum',
    enum: ['topup', 'deduct', 'refund', 'manual_topup'],
  })
  type: 'topup' | 'deduct' | 'refund' | 'manual_topup';

  // 永遠為正數；deduct/refund 的方向由 type 決定
  @Column('decimal', { precision: 10, scale: 2 })
  amount: number;

  // 這筆交易後的餘額快照（稽核用）
  @Column('decimal', { precision: 10, scale: 2 })
  balanceAfter: number;

  @Index()
  @Column({ nullable: true })
  bookingId: number | null;

  @Column({ nullable: true })
  stripeSessionId: string | null;

  @Column({ type: 'text', nullable: true })
  note: string | null;

  @Column()
  createdByAccountId: number;

  @Column({ type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;
}
