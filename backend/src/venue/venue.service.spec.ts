import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { VenueService } from './venue.service';
import { Venue } from '../entities/venue.entity';
import { Booking } from '../entities/booking.entity';
import { Payment } from '../entities/payment.entity';
import { VenueNote } from '../entities/venue-note.entity';

/**
 * BADM-T11: VenueService parent/group chain 防呆與樹狀查詢測試
 *
 * 沿用 coach.service.spec.ts 的 mock pattern：jest mock Repository。
 */

const mockRepo = () => ({
  find: jest.fn(),
  findOne: jest.fn(),
  create: jest.fn((d) => d),
  save: jest.fn((d) => Promise.resolve({ id: 1, ...d })),
  update: jest.fn().mockResolvedValue({ affected: 1 }),
  delete: jest.fn(),
  createQueryBuilder: jest.fn(),
});

describe('VenueService (BADM-T11)', () => {
  let service: VenueService;
  let venueRepo: ReturnType<typeof mockRepo>;

  beforeEach(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        VenueService,
        { provide: getRepositoryToken(Venue), useFactory: mockRepo },
        { provide: getRepositoryToken(Booking), useFactory: mockRepo },
        { provide: getRepositoryToken(Payment), useFactory: mockRepo },
        { provide: getRepositoryToken(VenueNote), useFactory: mockRepo },
      ],
    }).compile();
    service = moduleRef.get(VenueService);
    venueRepo = moduleRef.get(getRepositoryToken(Venue));
  });

  // ---------------- updateVenue parentVenueId 防呆 ----------------

  describe('updateVenue parentVenueId 防呆', () => {
    it('throws BadRequestException 當設定自己為自己的母場館', async () => {
      await expect(
        service.updateVenue(5, { parentVenueId: 5 } as any),
      ).rejects.toThrow(BadRequestException);
      // 不應該呼叫 update
      expect(venueRepo.update).not.toHaveBeenCalled();
    });

    it('throws NotFoundException 當指定的母場館不存在', async () => {
      // parent lookup 回 null
      venueRepo.findOne.mockResolvedValue(null);
      await expect(
        service.updateVenue(5, { parentVenueId: 99 } as any),
      ).rejects.toThrow(NotFoundException);
      expect(venueRepo.update).not.toHaveBeenCalled();
    });

    it('throws BadRequestException 二層循環：A→B 後試把 B 設為 A 的母', async () => {
      // 情境：B.parent = A 已成立；現呼叫 updateVenue(A, {parentVenueId: B})
      // findOne 連續：
      //   1) lookup parent B → 回 B (parentVenueId = A)
      //   2) cycle walker: B.parentVenueId == id(A) → 立刻 throw（不會再 findOne）
      venueRepo.findOne.mockImplementation(({ where }: any) => {
        if (where.id === 2) return Promise.resolve({ id: 2, parentVenueId: 1 });
        return Promise.resolve(null);
      });
      await expect(
        service.updateVenue(1, { parentVenueId: 2 } as any),
      ).rejects.toThrow(/循環/);
      expect(venueRepo.update).not.toHaveBeenCalled();
    });

    it('throws BadRequestException 三層循環：A→B→C 後試把 C 設為 A 的母', async () => {
      // chain: B.parent=A, C.parent=B；現要 A.parent=C → cycle
      // walker 從 C 往上：C.parentVenueId=B（B != A, depth=1）→ lookup B
      // B.parentVenueId=A → A === id(A) → throw
      venueRepo.findOne.mockImplementation(({ where }: any) => {
        if (where.id === 3) return Promise.resolve({ id: 3, parentVenueId: 2 });
        if (where.id === 2) return Promise.resolve({ id: 2, parentVenueId: 1 });
        if (where.id === 1) return Promise.resolve({ id: 1, parentVenueId: null });
        return Promise.resolve(null);
      });
      await expect(
        service.updateVenue(1, { parentVenueId: 3 } as any),
      ).rejects.toThrow(/循環/);
      expect(venueRepo.update).not.toHaveBeenCalled();
    });

    it('通過：深層樹無循環，A→B→C，新 D 掛到 A 之下', async () => {
      // id=4 (D), parentVenueId=1 (A)
      // lookup parent A → A.parentVenueId = null → walker loop 不執行
      // 應該 update + 再 findOne 回 D
      let findOneCalls = 0;
      venueRepo.findOne.mockImplementation(({ where }: any) => {
        findOneCalls++;
        if (where.id === 1) return Promise.resolve({ id: 1, parentVenueId: null });
        if (where.id === 4) return Promise.resolve({ id: 4, parentVenueId: 1, name: 'D' });
        return Promise.resolve(null);
      });
      const result = await service.updateVenue(4, { parentVenueId: 1 } as any);
      expect(venueRepo.update).toHaveBeenCalledWith(4, { parentVenueId: 1 });
      expect(result?.id).toBe(4);
      // sanity: parent lookup + 最後 reload = 至少 2 次
      expect(findOneCalls).toBeGreaterThanOrEqual(2);
    });

    it('通過：將現有 parent 解除為 null', async () => {
      venueRepo.findOne.mockImplementation(({ where }: any) => {
        if (where.id === 5) return Promise.resolve({ id: 5, parentVenueId: null, name: 'X' });
        return Promise.resolve(null);
      });
      const result = await service.updateVenue(5, { parentVenueId: null } as any);
      expect(venueRepo.update).toHaveBeenCalledWith(5, { parentVenueId: null });
      expect(result?.id).toBe(5);
    });

    it('不觸發 parent 驗證：patch 不含 parentVenueId（只改 name）', async () => {
      venueRepo.findOne.mockResolvedValue({ id: 5, name: 'renamed' });
      await service.updateVenue(5, { name: 'renamed' } as any);
      // 應該只有 reload 一次 findOne（沒 parent lookup）
      expect(venueRepo.findOne).toHaveBeenCalledTimes(1);
      expect(venueRepo.update).toHaveBeenCalledWith(5, { name: 'renamed' });
    });

    it('throws BadRequestException：parentVenueId 設為非數字字串', async () => {
      // Number('abc') = NaN → !isFinite → throw
      await expect(
        service.updateVenue(5, { parentVenueId: 'abc' as any }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException：parent chain 過深 (> MAX_DEPTH=10)', async () => {
      // 建一條長度 12 的鏈：v12 → v11 → ... → v1（v_n.parent = v_(n-1)）
      // 現在嘗試 v0.parent = v12（v0 是新節點）→ walker 從 v12 一路向上
      venueRepo.findOne.mockImplementation(({ where }: any) => {
        const id = where.id;
        if (id >= 1 && id <= 12) {
          return Promise.resolve({
            id,
            parentVenueId: id === 1 ? null : id - 1,
          });
        }
        if (id === 100) return Promise.resolve({ id: 100, parentVenueId: 12, name: 'v0' });
        return Promise.resolve(null);
      });
      await expect(
        service.updateVenue(100, { parentVenueId: 12 } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('白名單：data 中含非允許欄位（如 id），不會被 patch', async () => {
      venueRepo.findOne.mockResolvedValue({ id: 5, name: 'unchanged' });
      await service.updateVenue(5, { id: 999, name: 'newname' } as any);
      expect(venueRepo.update).toHaveBeenCalledWith(5, { name: 'newname' });
    });
  });

  // ---------------- getChildren ----------------

  describe('getChildren', () => {
    it('回傳對應 parentVenueId = id 的所有 venue', async () => {
      const children = [
        { id: 2, name: 'B', parentVenueId: 1 },
        { id: 3, name: 'C', parentVenueId: 1 },
      ];
      venueRepo.find.mockResolvedValue(children);
      const out = await service.getChildren(1);
      expect(venueRepo.find).toHaveBeenCalledWith({
        where: { parentVenueId: 1 },
        order: { id: 'ASC' },
      });
      expect(out).toEqual(children);
    });

    it('沒有 children 時回 []', async () => {
      venueRepo.find.mockResolvedValue([]);
      const out = await service.getChildren(1);
      expect(out).toEqual([]);
    });
  });

  // ---------------- getGroupTree ----------------

  describe('getGroupTree', () => {
    it('throws NotFoundException 當場館不存在', async () => {
      venueRepo.findOne.mockResolvedValue(null);
      await expect(service.getGroupTree(999)).rejects.toThrow(NotFoundException);
    });

    it('單一場館無 parent 也無 children → tree.children=[]、root=自己', async () => {
      venueRepo.findOne.mockImplementation(({ where }: any) => {
        if (where.id === 1) return Promise.resolve({ id: 1, name: 'A', parentVenueId: null });
        return Promise.resolve(null);
      });
      venueRepo.find.mockResolvedValue([]); // no children

      const out = await service.getGroupTree(1);
      expect(out.root.id).toBe(1);
      expect(out.tree).toEqual({ id: 1, name: 'A', children: [] });
    });

    it('場館有 parent 但無 children → 爬到 root 並從 root 展開含目前 node', async () => {
      // chain: A(1) ← B(2) ← C(3)（input C，root 是 A）
      const venues: Record<number, any> = {
        1: { id: 1, name: 'A', parentVenueId: null },
        2: { id: 2, name: 'B', parentVenueId: 1 },
        3: { id: 3, name: 'C', parentVenueId: 2 },
      };
      venueRepo.findOne.mockImplementation(({ where }: any) =>
        Promise.resolve(venues[where.id] ?? null),
      );
      // find: children lookup by parentVenueId
      venueRepo.find.mockImplementation(({ where }: any) => {
        const pid = where.parentVenueId;
        const kids: any[] = [];
        if (pid === 1) kids.push(venues[2]);
        if (pid === 2) kids.push(venues[3]);
        return Promise.resolve(kids);
      });

      const out = await service.getGroupTree(3);
      expect(out.root.id).toBe(1);
      expect(out.tree.id).toBe(1);
      expect(out.tree.children).toHaveLength(1);
      expect(out.tree.children[0].id).toBe(2);
      expect(out.tree.children[0].children).toHaveLength(1);
      expect(out.tree.children[0].children[0].id).toBe(3);
      expect(out.tree.children[0].children[0].children).toEqual([]);
    });

    it('多 child 場館 → tree 從 root 展開含所有 sibling', async () => {
      // root R(1) 下有 A(2), B(3), C(4)；input = A
      const venues: Record<number, any> = {
        1: { id: 1, name: 'R', parentVenueId: null },
        2: { id: 2, name: 'A', parentVenueId: 1 },
        3: { id: 3, name: 'B', parentVenueId: 1 },
        4: { id: 4, name: 'C', parentVenueId: 1 },
      };
      venueRepo.findOne.mockImplementation(({ where }: any) =>
        Promise.resolve(venues[where.id] ?? null),
      );
      venueRepo.find.mockImplementation(({ where }: any) => {
        if (where.parentVenueId === 1)
          return Promise.resolve([venues[2], venues[3], venues[4]]);
        return Promise.resolve([]);
      });

      const out = await service.getGroupTree(2);
      expect(out.root.id).toBe(1);
      expect(out.tree.children.map((c: any) => c.id).sort()).toEqual([2, 3, 4]);
    });

    it('深度超過 MAX_DEPTH=10 不爆炸（不無窮 loop）', async () => {
      // 建 chain 長 15：v1 → v2 → ... → v15，input = v15
      // 預期：root 爬到 MAX_DEPTH 就 break，不無窮 loop
      const venues: Record<number, any> = {};
      for (let i = 1; i <= 15; i++) {
        venues[i] = { id: i, name: `v${i}`, parentVenueId: i === 1 ? null : i - 1 };
      }
      venueRepo.findOne.mockImplementation(({ where }: any) =>
        Promise.resolve(venues[where.id] ?? null),
      );
      venueRepo.find.mockImplementation(({ where }: any) => {
        const pid = where.parentVenueId;
        const child = venues[pid + 1];
        return Promise.resolve(child ? [child] : []);
      });

      // 在合理時間（5s）內完成即代表沒無窮 loop
      const start = Date.now();
      const out = await service.getGroupTree(15);
      expect(Date.now() - start).toBeLessThan(5000);
      // 接受任一行為：截斷或完整都不爆炸
      expect(out).toBeDefined();
      expect(out.tree).toBeDefined();
    });

    it('若 DB 中存在循環（理論上 updateVenue 會擋，但底層損毀）→ 不無窮 loop', async () => {
      // A(1) ↔ B(2) 互指（DB 損壞情境）
      const venues: Record<number, any> = {
        1: { id: 1, name: 'A', parentVenueId: 2 },
        2: { id: 2, name: 'B', parentVenueId: 1 },
      };
      venueRepo.findOne.mockImplementation(({ where }: any) =>
        Promise.resolve(venues[where.id] ?? null),
      );
      venueRepo.find.mockResolvedValue([]); // 不在意 children

      const start = Date.now();
      const out = await service.getGroupTree(1);
      expect(Date.now() - start).toBeLessThan(5000);
      expect(out).toBeDefined();
    });
  });
});
