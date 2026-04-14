import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('payment_records')
@Index(['venueId', 'date'])
@Index(['recurringGroupId'])
export class PaymentRecord {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  venueId: number;

  @Column()
  teamName: string;

  @Column({ nullable: true })
  courtNumber: string;

  @Column()
  date: string; // YYYY-MM-DD

  @Column()
  startTime: string; // HH:MM

  @Column()
  endTime: string; // HH:MM

  @Column('decimal', { precision: 10, scale: 2 })
  amount: number;

  // 'unpaid' = 未付款; 'cash' = 已付/現金; 'transfer' = 已付/轉帳
  @Column({ default: 'unpaid' })
  paymentStatus: string;

  @Column({ type: 'datetime', nullable: true })
  paidAt: Date | null;

  @Column({ type: 'text', nullable: true })
  paidByNote: string | null; // 轉帳後四碼、付款人姓名等備註

  @Column({ nullable: true })
  recurringGroupId: string | null; // UUID，定期預約系列共用

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
