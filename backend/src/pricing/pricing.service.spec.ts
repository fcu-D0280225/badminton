import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException } from '@nestjs/common';
import { PricingService } from './pricing.service';
import { PricingRule } from '../entities/pricing-rule.entity';
import { Venue } from '../entities/venue.entity';

const mockRepo = () => ({
  find: jest.fn(),
  findOne: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  delete: jest.fn(),
  update: jest.fn(),
});

describe('PricingService.resolveAmount', () => {
  let service: PricingService;
  let ruleRepo: ReturnType<typeof mockRepo>;
  let venueRepo: ReturnType<typeof mockRepo>;

  beforeEach(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        PricingService,
        { provide: getRepositoryToken(PricingRule), useFactory: mockRepo },
        { provide: getRepositoryToken(Venue), useFactory: mockRepo },
      ],
    }).compile();
    service = moduleRef.get(PricingService);
    ruleRepo = moduleRef.get(getRepositoryToken(PricingRule));
    venueRepo = moduleRef.get(getRepositoryToken(Venue));
  });

  it('回 0 when timeSlot 格式錯誤', async () => {
    ruleRepo.find.mockResolvedValue([]);
    venueRepo.findOne.mockResolvedValue({ defaultPricePerHour: 500 });
    const r = await service.resolveAmount(1, '2026-05-09', 'bad-slot');
    expect(r).toEqual({
      amount: 0,
      pricePerHour: 0,
      ruleId: null,
      source: 'zero',
    });
  });

  it('匹配規則 → 套用 rule pricePerHour × 小時', async () => {
    // 2026-05-09 是週六（getDay = 6）
    ruleRepo.find.mockResolvedValue([
      {
        id: 1,
        venueId: 1,
        dayOfWeek: 6,
        startTime: '18:00',
        endTime: '22:00',
        pricePerHour: 800,
        priority: 10,
        active: true,
      },
      {
        id: 2,
        venueId: 1,
        dayOfWeek: -1,
        startTime: '00:00',
        endTime: '24:00',
        pricePerHour: 500,
        priority: 0,
        active: true,
      },
    ]);
    const r = await service.resolveAmount(1, '2026-05-09', '19:00-21:00');
    expect(r.ruleId).toBe(1);
    expect(r.pricePerHour).toBe(800);
    expect(r.amount).toBe(1600); // 800 × 2h
    expect(r.source).toBe('rule');
  });

  it('priority 較高的規則先勝（priority desc）', async () => {
    ruleRepo.find.mockResolvedValue([
      {
        id: 1,
        venueId: 1,
        dayOfWeek: -1,
        startTime: '00:00',
        endTime: '24:00',
        pricePerHour: 1000,
        priority: 100,
        active: true,
      },
      {
        id: 2,
        venueId: 1,
        dayOfWeek: -1,
        startTime: '00:00',
        endTime: '24:00',
        pricePerHour: 500,
        priority: 0,
        active: true,
      },
    ]);
    const r = await service.resolveAmount(1, '2026-05-09', '10:00-11:00');
    expect(r.ruleId).toBe(1);
    expect(r.amount).toBe(1000);
  });

  it('沒匹配規則 → fallback venue.defaultPricePerHour', async () => {
    ruleRepo.find.mockResolvedValue([
      {
        id: 1,
        venueId: 1,
        dayOfWeek: 1 /* 週一 */,
        startTime: '18:00',
        endTime: '22:00',
        pricePerHour: 800,
        priority: 10,
        active: true,
      },
    ]);
    venueRepo.findOne.mockResolvedValue({ defaultPricePerHour: '450' });
    // 2026-05-09 週六，不會匹配 dayOfWeek=1
    const r = await service.resolveAmount(1, '2026-05-09', '19:00-20:00');
    expect(r.source).toBe('venue_default');
    expect(r.pricePerHour).toBe(450);
    expect(r.amount).toBe(450);
    expect(r.ruleId).toBeNull();
  });

  it('規則只覆蓋部分時段 → booking 不完全落內 → 不套', async () => {
    ruleRepo.find.mockResolvedValue([
      {
        id: 1,
        venueId: 1,
        dayOfWeek: -1,
        startTime: '18:00',
        endTime: '20:00',
        pricePerHour: 800,
        priority: 10,
        active: true,
      },
    ]);
    venueRepo.findOne.mockResolvedValue({ defaultPricePerHour: '500' });
    // booking 19:00-21:00 跨越規則邊界
    const r = await service.resolveAmount(1, '2026-05-09', '19:00-21:00');
    expect(r.source).toBe('venue_default');
    expect(r.pricePerHour).toBe(500);
    expect(r.amount).toBe(1000);
  });

  it('預設與規則皆無 → 0', async () => {
    ruleRepo.find.mockResolvedValue([]);
    venueRepo.findOne.mockResolvedValue({ defaultPricePerHour: 0 });
    const r = await service.resolveAmount(1, '2026-05-09', '10:00-11:00');
    expect(r).toEqual({
      amount: 0,
      pricePerHour: 0,
      ruleId: null,
      source: 'zero',
    });
  });

  it('half-hour booking 也能正確計費', async () => {
    ruleRepo.find.mockResolvedValue([]);
    venueRepo.findOne.mockResolvedValue({ defaultPricePerHour: 600 });
    // 19:00-19:30 = 0.5h × 600 = 300
    const r = await service.resolveAmount(1, '2026-05-09', '19:00-19:30');
    expect(r.amount).toBe(300);
  });
});

describe('PricingService.validate', () => {
  let service: PricingService;

  beforeEach(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        PricingService,
        { provide: getRepositoryToken(PricingRule), useFactory: mockRepo },
        { provide: getRepositoryToken(Venue), useFactory: mockRepo },
      ],
    }).compile();
    service = moduleRef.get(PricingService);
  });

  it('rejects invalid dayOfWeek', async () => {
    await expect(
      service.create(1, {
        dayOfWeek: 99,
        startTime: '10:00',
        endTime: '12:00',
        pricePerHour: 500,
      } as any),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects invalid time format', async () => {
    await expect(
      service.create(1, {
        dayOfWeek: 0,
        startTime: '25:99',
        endTime: '12:00',
        pricePerHour: 500,
      } as any),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects start >= end', async () => {
    await expect(
      service.create(1, {
        dayOfWeek: 0,
        startTime: '20:00',
        endTime: '18:00',
        pricePerHour: 500,
      } as any),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects negative price', async () => {
    await expect(
      service.create(1, {
        dayOfWeek: 0,
        startTime: '10:00',
        endTime: '12:00',
        pricePerHour: -1,
      } as any),
    ).rejects.toThrow(BadRequestException);
  });
});
