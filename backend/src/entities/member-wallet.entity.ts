import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
  OneToMany,
} from 'typeorm';
import { WalletTransaction } from './wallet-transaction.entity';

@Entity('member_wallets')
export class MemberWallet {
  @PrimaryGeneratedColumn()
  id: number;

  @Index({ unique: true })
  @Column()
  accountId: number;  // FK → accounts.id（member role）

  @Column('decimal', { precision: 10, scale: 2, default: 0 })
  balance: number;

  @OneToMany(() => WalletTransaction, (tx) => tx.wallet)
  transactions: WalletTransaction[];

  @Column({ type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;
}
