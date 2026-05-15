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
 * - venueIds：限定可存取的場館 id；建立時若省略或空陣列，service 會 materialise
 *             成建立者當下所屬全部場館後入庫（行為穩定，不會隨日後 admin 加 venue
 *             自動放權）
 */

/**
 * TypeORM `simple-array` 反序列化後一律是 string[]（DB 存 `1,2`，讀回 `['1','2']`）；
 * 直接以 number 與此陣列比對（`includes` / `===`）會永遠 false。這個 transformer
 * 確保 entity 端 read-side 拿到的就是 `number[]`，避免散落多處 `.map(Number)`。
 * 寫入端 typeorm 對 `simple-array` 會自動 `String(x).split(',')`，可直接吃 number[]。
 */
export const numericSimpleArrayTransformer = {
  to: (value: number[] | undefined | null): number[] => value ?? [],
  from: (value: unknown): number[] => {
    if (value == null) return [];
    if (Array.isArray(value)) {
      return value
        .map((v) => (typeof v === 'number' ? v : Number(v)))
        .filter((n) => Number.isFinite(n));
    }
    return [];
  },
};
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

  /**
   * 場館 id 白名單。
   * - service 建立時會 materialise（若呼叫端未指定，會把建立者當下所屬場館入庫）
   * - 入庫時透過 transformer 確保讀回為 number[]（避免 simple-array 反序列化 string[]）
   */
  @Column({
    type: 'simple-array',
    default: '',
    transformer: numericSimpleArrayTransformer,
  })
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
