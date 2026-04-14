import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { NotFoundException } from '@nestjs/common';
import { BillingService } from './billing.service';
import { PaymentRecord } from '../entities/payment-record.entity';

const mockRepo = () => ({
  create: jest.fn(),
  save: jest.fn(),
  findOne: jest.fn(),
  find: jest.fn(),
  count: jest.fn(),
  delete: jest.fn(),
  createQueryBuilder: jest.fn(),
});

const mockDataSource = () => ({
  transaction: jest.fn(),
});

describe('BillingService', () => {
  let service: BillingService;
  let repo: ReturnType<typeof mockRepo>;
  let dataSource: ReturnType<typeof mockDataSource>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BillingService,
        { provide: getRepositoryToken(PaymentRecord), useFactory: mockRepo },
        { provide: DataSource, useFactory: mockDataSource },
      ],
    }).compile();

    service = module.get<BillingService>(BillingService);
    repo = module.get(getRepositoryToken(PaymentRecord));
    dataSource = module.get(DataSource);
  });

  // ─── create ──────────────────────────────────────────────────────────────────
  describe('create', () => {
    it('should create a single payment record', async () => {
      const dto = {
        teamName: '飛翔隊',
        date: '2026-04-10',
        startTime: '18:00',
        endTime: '20:00',
        amount: 1200,
      };
      const saved = {
        id: 1,
        ...dto,
        venueId: 1,
        paymentStatus: 'unpaid',
        paidAt: null,
      };
      repo.create.mockReturnValue(saved);
      repo.save.mockResolvedValue(saved);

      const result = await service.create(dto as any, 1);
      expect(result).toEqual(saved);
      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({ venueId: 1 }),
      );
    });

    it('should set paidAt when creating with paymentStatus cash', async () => {
      const dto = {
        teamName: '飛翔隊',
        date: '2026-04-10',
        startTime: '18:00',
        endTime: '20:00',
        amount: 1200,
        paymentStatus: 'cash',
      };
      repo.create.mockReturnValue({ ...dto, venueId: 1, paidAt: new Date() });
      repo.save.mockResolvedValue({ ...dto, venueId: 1, paidAt: new Date() });

      await service.create(dto as any, 1);
      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({ paidAt: expect.any(Date) }),
      );
    });
  });

  // ─── createRecurringSeries ────────────────────────────────────────────────────
  describe('createRecurringSeries', () => {
    it('should create 5 records in a transaction', async () => {
      const records: any[] = [];
      dataSource.transaction.mockImplementation(async (cb: any) => {
        const manager = {
          create: (entity: any, data: any) => ({ ...data }),
          save: async (record: any) => {
            records.push(record);
            return record;
          },
        };
        return cb(manager);
      });

      const dto = {
        teamName: '飛翔隊',
        date: '2026-04-07',
        startTime: '18:00',
        endTime: '20:00',
        amount: 1200,
      };
      const result = await service.createRecurringSeries(dto as any, 1);

      expect(result).toHaveLength(5);
      expect(result[0].date).toBe('2026-04-07');
      expect(result[1].date).toBe('2026-04-14');
      expect(result[4].date).toBe('2026-05-05');
    });

    it('should rollback all records if transaction fails', async () => {
      dataSource.transaction.mockImplementation(async (cb: any) => {
        const manager = {
          create: (_: any, data: any) => data,
          save: jest.fn().mockRejectedValue(new Error('DB error')),
        };
        return cb(manager);
      });

      const dto = {
        teamName: '飛翔隊',
        date: '2026-04-07',
        startTime: '18:00',
        endTime: '20:00',
        amount: 1200,
      };
      await expect(
        service.createRecurringSeries(dto as any, 1),
      ).rejects.toThrow('DB error');
    });

    it('should assign the same recurringGroupId to all 5 records', async () => {
      const records: any[] = [];
      dataSource.transaction.mockImplementation(async (cb: any) => {
        const manager = {
          create: (_: any, data: any) => data,
          save: async (r: any) => {
            records.push(r);
            return r;
          },
        };
        return cb(manager);
      });

      const dto = {
        teamName: '飛翔隊',
        date: '2026-04-07',
        startTime: '18:00',
        endTime: '20:00',
        amount: 1200,
      };
      await service.createRecurringSeries(dto as any, 1);
      const groupIds = records.map((r) => r.recurringGroupId);
      expect(new Set(groupIds).size).toBe(1); // 全部同一個 groupId
    });
  });

  // ─── findOne — IDOR 防護 ──────────────────────────────────────────────────────
  describe('findOne', () => {
    it('should return a record belonging to the venue', async () => {
      const record = { id: 1, venueId: 1, teamName: '飛翔隊' };
      repo.findOne.mockResolvedValue(record);
      const result = await service.findOne(1, 1);
      expect(result).toEqual(record);
      expect(repo.findOne).toHaveBeenCalledWith({
        where: { id: 1, venueId: 1 },
      });
    });

    it('should throw NotFoundException when accessing another venue record (IDOR)', async () => {
      repo.findOne.mockResolvedValue(null); // venueId 不匹配，回 null
      await expect(service.findOne(1, 2)).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException for non-existent record', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(service.findOne(999, 1)).rejects.toThrow(NotFoundException);
    });
  });

  // ─── update — paidAt 自動填入 ────────────────────────────────────────────────
  describe('update', () => {
    it('should set paidAt when status changes from unpaid to cash', async () => {
      const existing = {
        id: 1,
        venueId: 1,
        paymentStatus: 'unpaid',
        paidAt: null,
      };
      repo.findOne.mockResolvedValue(existing);
      repo.save.mockImplementation(async (r: any) => r);

      const result = await service.update(1, 1, { paymentStatus: 'cash' });
      expect(result.paidAt).toBeInstanceOf(Date);
    });

    it('should set paidAt when status changes from unpaid to transfer', async () => {
      const existing = {
        id: 1,
        venueId: 1,
        paymentStatus: 'unpaid',
        paidAt: null,
      };
      repo.findOne.mockResolvedValue(existing);
      repo.save.mockImplementation(async (r: any) => r);

      const result = await service.update(1, 1, { paymentStatus: 'transfer' });
      expect(result.paidAt).toBeInstanceOf(Date);
    });

    it('should NOT overwrite paidAt when already paid', async () => {
      const originalPaidAt = new Date('2026-04-01');
      const existing = {
        id: 1,
        venueId: 1,
        paymentStatus: 'cash',
        paidAt: originalPaidAt,
      };
      repo.findOne.mockResolvedValue(existing);
      repo.save.mockImplementation(async (r: any) => r);

      await service.update(1, 1, { paymentStatus: 'transfer' });
      // paidAt 不應被 update，因為原本就不是 unpaid
      expect(existing.paidAt).toBe(originalPaidAt);
    });

    it('should throw NotFoundException when updating another venue record (IDOR)', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(
        service.update(1, 99, { paymentStatus: 'cash' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ─── delete ──────────────────────────────────────────────────────────────────
  describe('delete', () => {
    it('should delete a record belonging to the venue', async () => {
      repo.findOne.mockResolvedValue({ id: 1, venueId: 1 });
      repo.delete.mockResolvedValue({ affected: 1 });
      await service.delete(1, 1);
      expect(repo.delete).toHaveBeenCalledWith({ id: 1, venueId: 1 });
    });

    it('should throw NotFoundException when deleting another venue record (IDOR)', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(service.delete(1, 99)).rejects.toThrow(NotFoundException);
    });
  });

  // ─── deleteRecurringSeries ────────────────────────────────────────────────────
  describe('deleteRecurringSeries', () => {
    it('should delete all records in the series', async () => {
      repo.count.mockResolvedValue(5);
      repo.delete.mockResolvedValue({ affected: 5 });
      await service.deleteRecurringSeries('group-uuid', 1);
      expect(repo.delete).toHaveBeenCalledWith({
        recurringGroupId: 'group-uuid',
        venueId: 1,
      });
    });

    it('should throw NotFoundException if series does not belong to venue', async () => {
      repo.count.mockResolvedValue(0);
      await expect(
        service.deleteRecurringSeries('group-uuid', 99),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
