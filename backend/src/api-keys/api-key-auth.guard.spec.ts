import {
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ApiKeyAuthGuard } from './api-key-auth.guard';
import { ApiKeysService } from './api-keys.service';
import type { ApiKey } from '../entities/api-key.entity';

const mkContext = (
  headers: Record<string, string | undefined>,
  reflectorMeta: any[] = [],
): { ctx: ExecutionContext; req: any } => {
  const req: any = { headers };
  const ctx = {
    switchToHttp: () => ({ getRequest: () => req }),
    getHandler: () => ({}),
    getClass: () => ({}),
  } as unknown as ExecutionContext;
  return { ctx, req };
};

const mkApiKey = (overrides: Partial<ApiKey> = {}): ApiKey =>
  ({
    id: 'uuid-1',
    name: 'partner',
    keyHash: 'h',
    keyPrefix: 'pk_live_abcd1234',
    scopes: ['bookings:read'],
    venueIds: [5, 7],
    createdByAccountId: 11,
    createdBy: undefined as any,
    expiresAt: null,
    lastUsedAt: null,
    revokedAt: null,
    createdAt: new Date(),
    ...overrides,
  }) as ApiKey;

describe('ApiKeyAuthGuard', () => {
  let guard: ApiKeyAuthGuard;
  let apiKeysService: { verify: jest.Mock };
  let reflector: { getAllAndMerge: jest.Mock };

  beforeEach(() => {
    apiKeysService = { verify: jest.fn() };
    reflector = { getAllAndMerge: jest.fn().mockReturnValue([]) };
    guard = new ApiKeyAuthGuard(
      apiKeysService as unknown as ApiKeysService,
      reflector as unknown as Reflector,
    );
  });

  it('缺 X-API-Key header → UnauthorizedException', async () => {
    const { ctx } = mkContext({});
    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
    expect(apiKeysService.verify).not.toHaveBeenCalled();
  });

  it('verify 回 null（key 不存在 / 已撤銷 / 過期）→ Unauthorized', async () => {
    apiKeysService.verify.mockResolvedValue(null);
    const { ctx } = mkContext({ 'x-api-key': 'pk_live_xxx' });
    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
  });

  it('合法 key → 通過、req.apiKey 與 req.user 都被設定', async () => {
    apiKeysService.verify.mockResolvedValue(mkApiKey());
    const { ctx, req } = mkContext({ 'x-api-key': 'pk_live_abcd1234567890' });
    const ok = await guard.canActivate(ctx);
    expect(ok).toBe(true);
    expect(req.apiKey).toBeDefined();
    expect(req.user.role).toBe('venue');
    expect(req.user.venueIds).toEqual([5, 7]);
    expect(req.user.entityId).toBe(5); // 第一個 venueId
    expect(req.user.username).toContain('api-key:');
  });

  it('scope 不足 → ForbiddenException', async () => {
    apiKeysService.verify.mockResolvedValue(
      mkApiKey({ scopes: ['venues:read'] }),
    );
    reflector.getAllAndMerge.mockReturnValue(['bookings:read']);
    const { ctx } = mkContext({ 'x-api-key': 'pk_live_abcd1234567890' });
    await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
  });

  it('scope 全部滿足 → 通過', async () => {
    apiKeysService.verify.mockResolvedValue(
      mkApiKey({ scopes: ['bookings:read', 'venues:read'] }),
    );
    reflector.getAllAndMerge.mockReturnValue(['bookings:read']);
    const { ctx } = mkContext({ 'x-api-key': 'pk_live_abcd1234567890' });
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
  });

  it('apiKey.venueIds 為空陣列 → ForbiddenException（防呆，避免 entityId=0 兜底）', async () => {
    // 語意改為「空 = 全部所屬」後 service 端會 materialise 入庫，
    // 空陣列理論上不該發生；若仍出現（歷史資料 / 人為改 DB），guard 應直接拒絕，
    // 否則 ownership.helper 會用 entityId=0 查詢，可能誤判。
    apiKeysService.verify.mockResolvedValue(mkApiKey({ venueIds: [] }));
    const { ctx } = mkContext({ 'x-api-key': 'pk_live_abcd1234567890' });
    await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
  });
});
