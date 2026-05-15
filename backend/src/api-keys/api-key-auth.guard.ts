import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ApiKeysService } from './api-keys.service';
import { SCOPES_METADATA_KEY } from './scopes.decorator';
import type { ApiKeyScope } from './dto/create-api-key.dto';
import type { ApiKey } from '../entities/api-key.entity';
import type { AuthUser } from '../auth/types';

/**
 * BADM-T15: 對外公開 API 走此 guard。
 *
 * - 從 `X-API-Key` header 取 plaintext，呼叫 ApiKeysService.verify
 * - 驗證通過：
 *     1. 將 ApiKey 物件掛到 `request.apiKey`
 *     2. 同時合成一個 venue 角色 AuthUser 掛到 `request.user`，
 *        venueIds 套用 apiKey.venueIds（空陣列保留為空 → 與 JWT venue 的「無 venue」對等）
 *        — 既有 ownership.helper 可直接吃此結構，無須改 service layer
 * - 失敗：
 *     - 缺 header / 格式錯 → 401
 *     - 已撤銷 / 過期 → 401（不洩存在性）
 *     - scope 不足 → 403
 */
@Injectable()
export class ApiKeyAuthGuard implements CanActivate {
  constructor(
    private readonly apiKeysService: ApiKeysService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const headerRaw =
      req.headers?.['x-api-key'] ?? req.headers?.['X-API-Key'];
    const plaintext = Array.isArray(headerRaw) ? headerRaw[0] : headerRaw;
    if (!plaintext || typeof plaintext !== 'string') {
      throw new UnauthorizedException('缺少 X-API-Key header');
    }

    const apiKey = await this.apiKeysService.verify(plaintext);
    if (!apiKey) {
      throw new UnauthorizedException('API Key 無效或已撤銷');
    }

    // Scope 檢查（class + method merge）
    const required = this.reflector.getAllAndMerge<ApiKeyScope[]>(
      SCOPES_METADATA_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (required && required.length > 0) {
      const missing = required.filter((s) => !apiKey.scopes?.includes(s));
      if (missing.length > 0) {
        throw new ForbiddenException(
          `API Key 缺少必要 scope：${missing.join(', ')}`,
        );
      }
    }

    req.apiKey = apiKey;
    req.user = this.synthesizeAuthUser(apiKey);
    return true;
  }

  /**
   * 將 ApiKey 映射成一個 venue 角色 AuthUser，讓既有 ownership helper /
   * controller 邏輯（assertOwnsVenue / bookingOwnerWhereClauses）可以無痛吃。
   * - id / entityId 來自合成（用於除錯而非授權）
   * - venueIds 直接套用 apiKey.venueIds（service 端已 materialise，理論上不會為空）
   *
   * 防呆：service 改為建立時 materialise venueIds，空陣列理論上不會發生；
   * 若 DB 仍出現空陣列（歷史資料或人為直接寫入），直接拒絕避免後續 ownership
   * helper 用 entityId=0 兜底而誤判。
   */
  private synthesizeAuthUser(apiKey: ApiKey): AuthUser {
    const venueIds = apiKey.venueIds ?? [];
    if (venueIds.length === 0) {
      throw new ForbiddenException('此 API Key 未綁定任何場館');
    }
    return {
      id: apiKey.createdByAccountId,
      username: `api-key:${apiKey.keyPrefix}`,
      role: 'venue',
      entityId: venueIds[0],
      venueIds,
    };
  }
}
