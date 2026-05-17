import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { VenueController } from './venue.controller';
import { VenueService } from './venue.service';

/**
 * BADM-T11: VenueController PUT /:id 的 cross-venue parent 守門測試。
 * 該守門在 controller 層執行，service spec 蓋不到。
 */

const mockVenueService = {
  updateVenue: jest.fn(),
  getChildren: jest.fn(),
  getGroupTree: jest.fn(),
};

// venue user A：可管理 venueIds = [7, 8]
const userA = {
  id: 1,
  username: 'a',
  role: 'venue',
  entityId: 7,
  venueIds: [7, 8],
};

// venue user B：可管理 venueIds = [99]（與 A 完全不同）
// 用來模擬「A 試圖把自家場館掛到 B 的場館下」
// 實際呼叫時 user 仍是 A，只是 parent 指向 99
describe('VenueController (BADM-T11 cross-venue parent guard)', () => {
  let controller: VenueController;

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [VenueController],
      providers: [{ provide: VenueService, useValue: mockVenueService }],
    }).compile();
    controller = moduleRef.get(VenueController);
  });

  describe('PUT /api/venues/:id with parentVenueId', () => {
    it('通過：A 對自家 venue 設 parent 為 A 也有 ownership 的另一 venue → service 被呼叫', async () => {
      mockVenueService.updateVenue.mockResolvedValue({
        id: 7,
        parentVenueId: 8,
      });
      const result = await controller.updateVenue(userA as any, '7', {
        parentVenueId: 8,
      } as any);
      expect(mockVenueService.updateVenue).toHaveBeenCalledWith(7, {
        parentVenueId: 8,
      });
      expect(result).toEqual({ id: 7, parentVenueId: 8 });
    });

    it('403：A 對自家 venue 設 parent 為 A 無 ownership 的 venue → service 不會被呼叫', async () => {
      await expect(
        controller.updateVenue(userA as any, '7', {
          parentVenueId: 99,
        } as any),
      ).rejects.toThrow(ForbiddenException);
      expect(mockVenueService.updateVenue).not.toHaveBeenCalled();
    });

    it('通過：parent = null（解除）跳過守門、service 被呼叫', async () => {
      mockVenueService.updateVenue.mockResolvedValue({
        id: 7,
        parentVenueId: null,
      });
      const result = await controller.updateVenue(userA as any, '7', {
        parentVenueId: null,
      } as any);
      expect(mockVenueService.updateVenue).toHaveBeenCalledWith(7, {
        parentVenueId: null,
      });
      expect(result).toEqual({ id: 7, parentVenueId: null });
    });

    it('通過：body 不含 parentVenueId（只改 name）→ 跳過守門', async () => {
      mockVenueService.updateVenue.mockResolvedValue({ id: 7, name: 'new' });
      await controller.updateVenue(userA as any, '7', { name: 'new' } as any);
      expect(mockVenueService.updateVenue).toHaveBeenCalledWith(7, {
        name: 'new',
      });
    });

    it('403：child venue 自身不是 A 擁有（既有 assertOwnsVenue 守門 sanity check）', async () => {
      // user A 試圖更新 venueId=99（A 沒擁有）
      await expect(
        controller.updateVenue(userA as any, '99', { name: 'x' } as any),
      ).rejects.toThrow(ForbiddenException);
      expect(mockVenueService.updateVenue).not.toHaveBeenCalled();
    });

    it('403：非 venue 角色不能更新場館', async () => {
      const playerUser = {
        id: 10,
        username: 'p',
        role: 'player',
        entityId: 5,
      };
      await expect(
        controller.updateVenue(playerUser as any, '7', { name: 'x' } as any),
      ).rejects.toThrow(ForbiddenException);
      expect(mockVenueService.updateVenue).not.toHaveBeenCalled();
    });
  });

  describe('GET /api/venues/:id/children', () => {
    it('呼叫 service.getChildren 並回傳結果', async () => {
      mockVenueService.getChildren.mockResolvedValue([{ id: 2 }, { id: 3 }]);
      const out = await controller.getChildren('1');
      expect(mockVenueService.getChildren).toHaveBeenCalledWith(1);
      expect(out).toEqual([{ id: 2 }, { id: 3 }]);
    });
  });

  describe('GET /api/venues/:id/group-tree', () => {
    it('呼叫 service.getGroupTree 並回傳 root + tree', async () => {
      const payload = {
        root: { id: 1, name: 'R' },
        tree: { id: 1, name: 'R', children: [] },
      };
      mockVenueService.getGroupTree.mockResolvedValue(payload);
      const out = await controller.getGroupTree('1');
      expect(mockVenueService.getGroupTree).toHaveBeenCalledWith(1);
      expect(out).toEqual(payload);
    });
  });
});
