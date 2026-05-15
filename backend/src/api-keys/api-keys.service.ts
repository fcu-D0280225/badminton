import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { createHash, randomBytes } from 'crypto';
import { ApiKey } from '../entities/api-key.entity';
import { AuthUser } from '../auth/types';
import { CreateApiKeyDto } from './dto/create-api-key.dto';

export const API_KEY_PLAINTEXT_PREFIX = 'pk_live_';

export type ApiKeyPublic = Omit<ApiKey, 'keyHash'>;

export interface CreateApiKeyResult {
  apiKey: ApiKeyPublic;
  /** 一次性明文 key — 僅在建立當下回傳，之後再也查不到 */
  plaintext: string;
}

/**
 * BADM-T15: API Key 管理 service
 *
 * 安全性慣例：
 * - 不存明文：明文僅在 create 當下回傳一次，DB 只存 sha256(plaintext)
 * - prefix 索引：verify 時先以 keyPrefix 收斂候選，再做 hash 比對
 * - 任何被 revoke 的 key（revokedAt != null）一律拒絕
 * - 過期 key（expiresAt < now）一律拒絕
 * - 所有 ownership 操作（list / revoke）以 createdByAccountId 為界，使用者只能管自己建的
 */
@Injectable()
export class ApiKeysService {
  constructor(
    @InjectRepository(ApiKey)
    private readonly apiKeyRepo: Repository<ApiKey>,
  ) {}

  // ── 建立 ─────────────────────────────────────────────────────────
  async create(
    dto: CreateApiKeyDto,
    user: AuthUser,
  ): Promise<CreateApiKeyResult> {
    if (user.role !== 'venue') {
      throw new ForbiddenException('僅館方帳號可建立 API Key');
    }

    // 建立者當下所屬場館（venue 角色 login 時帶下來；應永遠至少 1 筆）
    const ownerVenueIds = user.venueIds ?? [];
    if (ownerVenueIds.length === 0) {
      // 防呆：理論上 venue 角色一定有 venueIds（auth.service 用 entityId fallback）
      throw new ForbiddenException('建立者帳號未綁定任何場館，無法發出 API Key');
    }

    // venueIds 語意（使用者拍板）：
    // - 省略 / 空陣列 → materialise 為建立者當下所屬全部場館入庫（行為穩定）
    // - 顯式指定 → 每個都必須屬於建立者，否則拒絕（防 admin 自己越權發 key）
    let venueIds: number[];
    if (!dto.venueIds || dto.venueIds.length === 0) {
      venueIds = [...ownerVenueIds];
    } else {
      const ownerSet = new Set(ownerVenueIds);
      const illegal = dto.venueIds.filter((v) => !ownerSet.has(v));
      if (illegal.length > 0) {
        throw new ForbiddenException(
          `API Key 的 venueIds 含建立者未綁定的場館：${illegal.join(', ')}`,
        );
      }
      venueIds = [...dto.venueIds];
    }

    const plaintext = this.generatePlaintextKey();
    const keyPrefix = plaintext.slice(0, 16);
    const keyHash = this.hashKey(plaintext);

    const entity = this.apiKeyRepo.create({
      name: dto.name,
      scopes: dto.scopes,
      venueIds,
      keyHash,
      keyPrefix,
      createdByAccountId: user.id,
      expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
    });
    const saved = await this.apiKeyRepo.save(entity);
    return { apiKey: this.stripHash(saved), plaintext };
  }

  // ── 列出（限自己建立的）─────────────────────────────────────────
  async list(user: AuthUser): Promise<ApiKeyPublic[]> {
    if (user.role !== 'venue') {
      throw new ForbiddenException('僅館方帳號可使用 API Key 管理');
    }
    const rows = await this.apiKeyRepo.find({
      where: { createdByAccountId: user.id },
      order: { createdAt: 'DESC' },
    });
    return rows.map((r) => this.stripHash(r));
  }

  // ── 撤銷（軟刪除：設 revokedAt）─────────────────────────────────
  async revoke(id: string, user: AuthUser): Promise<void> {
    if (user.role !== 'venue') {
      throw new ForbiddenException('僅館方帳號可撤銷 API Key');
    }
    const row = await this.apiKeyRepo.findOne({
      where: { id, createdByAccountId: user.id },
    });
    // 不洩存在性（SEC-001 慣例）：他人 key / 不存在 一律 404
    if (!row) throw new NotFoundException(`API Key ${id} 不存在`);
    if (row.revokedAt) return; // 已撤銷視為 no-op
    row.revokedAt = new Date();
    await this.apiKeyRepo.save(row);
  }

  // ── 驗證（供 ApiKeyAuthGuard 呼叫）──────────────────────────────
  /**
   * 比對 plaintext key 是否有效；若有效，更新 lastUsedAt 並回傳完整 entity。
   * 任何失敗（找不到 / 已撤銷 / 已過期 / hash 不符）一律回 null（不洩存在性）。
   */
  async verify(plaintext: string): Promise<ApiKey | null> {
    if (!plaintext || typeof plaintext !== 'string') return null;
    if (!plaintext.startsWith(API_KEY_PLAINTEXT_PREFIX)) return null;
    const keyPrefix = plaintext.slice(0, 16);
    if (keyPrefix.length < 16) return null;
    const keyHash = this.hashKey(plaintext);

    // 用 prefix 收斂候選 — 結合 keyHash 完整匹配（理論上只會 0 / 1 筆）
    const candidate = await this.apiKeyRepo.findOne({
      where: {
        keyPrefix,
        keyHash,
        revokedAt: IsNull(),
      },
    });
    if (!candidate) return null;
    if (candidate.expiresAt && candidate.expiresAt.getTime() <= Date.now()) {
      return null;
    }

    // 異步更新 lastUsedAt，不阻塞主流程（即使失敗也忽略）
    this.apiKeyRepo
      .update(candidate.id, { lastUsedAt: new Date() })
      .catch(() => undefined);

    return candidate;
  }

  // ── 私有 ─────────────────────────────────────────────────────────
  /**
   * 產生 plaintext key：`pk_live_` + 24 byte 隨機 base64url（≈ 32 字）。
   * 整段長度 ≈ 40 字、足夠熵且 URL safe。
   */
  private generatePlaintextKey(): string {
    const raw = randomBytes(24).toString('base64url');
    return `${API_KEY_PLAINTEXT_PREFIX}${raw}`;
  }

  /** sha256(plaintext) — hex；server-side secret，不對外暴露 */
  private hashKey(plaintext: string): string {
    return createHash('sha256').update(plaintext, 'utf8').digest('hex');
  }

  private stripHash(row: ApiKey): ApiKeyPublic {
    // 保留 entity 結構但移除 keyHash，避免任何時刻 leak
    const { keyHash, ...rest } = row;
    void keyHash;
    return rest;
  }
}
