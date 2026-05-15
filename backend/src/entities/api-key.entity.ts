import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Account } from './account.entity';

/**
 * 對外開放 API 的 API Key（BADM-T15）。
 * - 不存明文：keyHash 為 sha256(plaintext)，僅在建立當下回傳一次明文給呼叫端
 * - keyPrefix：明文前 16 字（含 `pk_live_` 前綴 8 + 隨機 8），供後台辨識
 * - scopes：權限字串陣列（e.g. ['bookings:read', 'venues:read']）
 * - venueIds：限定可存取的場館 id；空陣列 = 該 key 可存取「建立者所屬」全部場館
 */
@Entity('api_keys')
export class ApiKey {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** 訂閱識別名，e.g. 「合作夥伴 X 整合」 */
  @Column({ type: 'varchar', length: 255 })
  name: string;

  /** sha256(plaintext) — 不存明文 */
  @Column({ type: 'varchar', length: 255 })
  keyHash: string;

  /** 明文前 16 字（含 `pk_live_` 前綴），用於候選查找與後台辨識 */
  @Index('IDX_api_keys_keyPrefix')
  @Column({ type: 'varchar', length: 32 })
  keyPrefix: string;

  /** 權限字串陣列。空陣列 = 無權限（DB 預設） */
  @Column({ type: 'simple-array', default: '' })
  scopes: string[];

  /** 場館 id 白名單。空陣列 = 視同建立者帳號的全部 venueIds */
  @Column({ type: 'simple-array', default: '' })
  venueIds: number[];

  /** 建立者 account.id；FK 至 accounts */
  @Column({ type: 'int' })
  createdByAccountId: number;

  @ManyToOne(() => Account, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'createdByAccountId' })
  createdBy: Account;

  @Column({ type: 'datetime', nullable: true, default: null })
  expiresAt: Date | null;

  @Column({ type: 'datetime', nullable: true, default: null })
  lastUsedAt: Date | null;

  @Index('IDX_api_keys_revokedAt')
  @Column({ type: 'datetime', nullable: true, default: null })
  revokedAt: Date | null;

  @Column({ type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;
}
