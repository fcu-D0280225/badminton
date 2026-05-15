import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { createHash } from 'crypto';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import {
  ApiKeysService,
  API_KEY_PLAINTEXT_PREFIX,
} from './api-keys.service';
import { ApiKey } from '../entities/api-key.entity';
import { AuthUser } from '../auth/types';

const mkUser = (overrides: Partial<AuthUser> = {}): AuthUser => ({
  id: 11,
  username: 'venue-acc',
  role: 'venue',
  entityId: 5,
  venueIds: [5, 7],
  ...overrides,
});

// 簡易 in-memory repo mock：只覆蓋 service 用到的方法
const mkRepo = () => {
  const rows: ApiKey[] = [];
  return {
    rows,
    create: jest.fn((d: Partial<ApiKey>) => ({ ...d }) as ApiKey),
    save: jest.fn(async (d: ApiKey) => {
      const idx = rows.findIndex((r) => r.id === d.id);
      const saved: ApiKey = {
        id: d.id ?? `id-${rows.length + 1}`,
        createdAt: d.createdAt ?? new Date(),
        revokedAt: d.revokedAt ?? null,
        expiresAt: d.expiresAt ?? null,
        lastUsedAt: d.lastUsedAt ?? null,
        ...d,
      } as ApiKey;
      if (idx >= 0) rows[idx] = saved;
      else rows.push(saved);
      return saved;
    }),
    find: jest.fn(async ({ where, order }: any) => {
      let list = rows.filter((r) =>
        Object.entries(where).every(([k, v]) => (r as any)[k] === v),
      );
      if (order?.createdAt === 'DESC') {
        list = [...list].sort(
          (a, b) =>
            (b.createdAt?.getTime?.() ?? 0) - (a.createdAt?.getTime?.() ?? 0),
        );
      }
      return list;
    }),
    findOne: jest.fn(async ({ where }: any) => {
      // 支援 IsNull() — 我們不真正解析，呼叫端會在測試中設定 revokedAt:null
      return (
        rows.find((r) =>
          Object.entries(where).every(([k, v]: [string, any]) => {
            // typeorm IsNull 操作符在這 mock 中以「值為 undefined / IsNull obj」處理
            if (
              v &&
              typeof v === 'object' &&
              (v as any)._type === 'isNull'
            ) {
              return (r as any)[k] == null;
            }
            return (r as any)[k] === v;
          }),
        ) ?? null
      );
    }),
    update: jest.fn(async (id: string, patch: Partial<ApiKey>) => {
      const row = rows.find((r) => r.id === id);
      if (row) Object.assign(row, patch);
      return { affected: row ? 1 : 0 };
    }),
  };
};

// 將 typeorm 的 IsNull() 模擬出來
jest.mock('typeorm', () => {
  const actual = jest.requireActual('typeorm');
  return {
    ...actual,
    IsNull: () => ({ _type: 'isNull' }),
  };
});

describe('ApiKeysService', () => {
  let service: ApiKeysService;
  let repo: ReturnType<typeof mkRepo>;

  beforeEach(async () => {
    repo = mkRepo();
    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        ApiKeysService,
        { provide: getRepositoryToken(ApiKey), useValue: repo },
      ],
    }).compile();
    service = moduleRef.get(ApiKeysService);
  });

  describe('create', () => {
    it('回傳明文 key + 儲存 hash，不儲存明文', async () => {
      const result = await service.create(
        { name: '夥伴 A', scopes: ['bookings:read'] },
        mkUser(),
      );
      expect(result.plaintext.startsWith(API_KEY_PLAINTEXT_PREFIX)).toBe(true);
      expect(result.plaintext.length).toBeGreaterThan(20);
      // DB row 存的是 hash，不是明文
      const stored = repo.rows[0];
      expect(stored.keyHash).not.toBe(result.plaintext);
      expect(stored.keyHash).toBe(
        createHash('sha256').update(result.plaintext, 'utf8').digest('hex'),
      );
      // keyPrefix = plaintext 前 16 字（含 pk_live_）
      expect(stored.keyPrefix).toBe(result.plaintext.slice(0, 16));
      expect(stored.keyPrefix.startsWith(API_KEY_PLAINTEXT_PREFIX)).toBe(true);
      // returned apiKey 物件不含 keyHash
      expect((result.apiKey as any).keyHash).toBeUndefined();
    });

    it('帶 venueIds 與 expiresAt', async () => {
      const result = await service.create(
        {
          name: '夥伴 B',
          scopes: ['bookings:read', 'venues:read'],
          venueIds: [5, 7],
          expiresAt: '2027-01-01T00:00:00.000Z',
        },
        mkUser(),
      );
      const stored = repo.rows[0];
      expect(stored.venueIds).toEqual([5, 7]);
      expect(stored.expiresAt).toEqual(new Date('2027-01-01T00:00:00.000Z'));
      expect(result.apiKey.scopes).toEqual(['bookings:read', 'venues:read']);
    });

    it('venueIds 省略 → 空陣列', async () => {
      await service.create(
        { name: 'X', scopes: ['venues:read'] },
        mkUser(),
      );
      expect(repo.rows[0].venueIds).toEqual([]);
    });

    it('非 venue 角色拒絕建立', async () => {
      await expect(
        service.create(
          { name: 'X', scopes: ['venues:read'] },
          mkUser({ role: 'player' }),
        ),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('list', () => {
    it('只回傳建立者本人 keys，不含 hash', async () => {
      await service.create(
        { name: 'A', scopes: ['venues:read'] },
        mkUser({ id: 11 }),
      );
      await service.create(
        { name: 'B', scopes: ['venues:read'] },
        mkUser({ id: 99 }),
      );
      const list = await service.list(mkUser({ id: 11 }));
      expect(list).toHaveLength(1);
      expect(list[0].name).toBe('A');
      expect((list[0] as any).keyHash).toBeUndefined();
    });

    it('非 venue 拒絕', async () => {
      await expect(service.list(mkUser({ role: 'organizer' }))).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('revoke', () => {
    it('設定 revokedAt，再 verify 不過', async () => {
      const r = await service.create(
        { name: 'A', scopes: ['venues:read'] },
        mkUser(),
      );
      const id = repo.rows[0].id;

      // 撤銷前可驗證
      const ok = await service.verify(r.plaintext);
      expect(ok).not.toBeNull();

      await service.revoke(id, mkUser());
      expect(repo.rows[0].revokedAt).toBeInstanceOf(Date);

      // 撤銷後 verify 回 null
      const failed = await service.verify(r.plaintext);
      expect(failed).toBeNull();
    });

    it('別人建立的 key → NotFoundException（不洩存在性）', async () => {
      await service.create(
        { name: 'A', scopes: ['venues:read'] },
        mkUser({ id: 11 }),
      );
      const id = repo.rows[0].id;
      await expect(service.revoke(id, mkUser({ id: 99 }))).rejects.toThrow(
        NotFoundException,
      );
    });

    it('不存在的 id → NotFoundException', async () => {
      await expect(
        service.revoke('does-not-exist', mkUser()),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('verify', () => {
    it('合法明文 → 回傳 entity + 更新 lastUsedAt', async () => {
      const r = await service.create(
        {
          name: 'A',
          scopes: ['bookings:read'],
          venueIds: [5],
        },
        mkUser(),
      );
      const out = await service.verify(r.plaintext);
      expect(out).not.toBeNull();
      expect(out!.scopes).toEqual(['bookings:read']);
      expect(out!.venueIds).toEqual([5]);
      // 異步更新 lastUsedAt — 等一個 tick
      await new Promise((resolve) => setImmediate(resolve));
      expect(repo.update).toHaveBeenCalled();
    });

    it('prefix 索引命中：兩個 key 同前綴錯一字也不過', async () => {
      const r = await service.create(
        { name: 'A', scopes: ['venues:read'] },
        mkUser(),
      );
      // 改一個字（保持 prefix 相同，hash 完全不同）
      const tampered =
        r.plaintext.slice(0, 16) + r.plaintext.slice(16).split('').reverse().join('');
      const out = await service.verify(tampered);
      expect(out).toBeNull();
    });

    it('過期 key 拒絕', async () => {
      const r = await service.create(
        {
          name: 'A',
          scopes: ['venues:read'],
          expiresAt: new Date(Date.now() - 1000).toISOString(),
        },
        mkUser(),
      );
      const out = await service.verify(r.plaintext);
      expect(out).toBeNull();
    });

    it('沒帶 pk_live_ 前綴 → 直接拒絕', async () => {
      const out = await service.verify('random-not-our-key');
      expect(out).toBeNull();
    });

    it('空字串 / 非字串 → 拒絕', async () => {
      expect(await service.verify('')).toBeNull();
      expect(await service.verify(null as any)).toBeNull();
      expect(await service.verify(undefined as any)).toBeNull();
    });
  });
});
