import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { CoachService } from './coach.service';
import { Coach } from '../entities/coach.entity';
import { CoachClass } from '../entities/coach-class.entity';

const mockRepo = () => ({
  find: jest.fn(),
  findOne: jest.fn(),
  create: jest.fn(d => d),
  save: jest.fn(d => Promise.resolve({ id: 1, ...d })),
  delete: jest.fn(),
  createQueryBuilder: jest.fn(),
});

describe('CoachService', () => {
  let service: CoachService;
  let coachRepo: ReturnType<typeof mockRepo>;
  let classRepo: ReturnType<typeof mockRepo>;

  beforeEach(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        CoachService,
        { provide: getRepositoryToken(Coach), useFactory: mockRepo },
        { provide: getRepositoryToken(CoachClass), useFactory: mockRepo },
      ],
    }).compile();
    service = moduleRef.get(CoachService);
    coachRepo = moduleRef.get(getRepositoryToken(Coach));
    classRepo = moduleRef.get(getRepositoryToken(CoachClass));
  });

  describe('getCoach (ownership)', () => {
    it('returns coach when belongs to one of user venueIds', async () => {
      coachRepo.findOne.mockResolvedValue({ id: 5, venueId: 12, name: 'A' });
      const out = await service.getCoach(5, [7, 12]);
      expect(out.id).toBe(5);
    });

    it('throws NotFoundException when coach belongs to another venue', async () => {
      coachRepo.findOne.mockResolvedValue({ id: 5, venueId: 99, name: 'A' });
      await expect(service.getCoach(5, [7, 12])).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when coach does not exist', async () => {
      coachRepo.findOne.mockResolvedValue(null);
      await expect(service.getCoach(5, [7])).rejects.toThrow(NotFoundException);
    });
  });

  describe('createCoach', () => {
    it('rejects without name', async () => {
      await expect(service.createCoach(7, {})).rejects.toThrow(BadRequestException);
    });
  });

  describe('createClass cross-venue safety', () => {
    it('throws when coach belongs to a different venue', async () => {
      coachRepo.findOne.mockResolvedValue({ id: 9, venueId: 99 });
      await expect(
        service.createClass(7, {
          coachId: 9,
          date: '2026-05-09',
          timeSlot: '18:00-20:00',
          feePerStudent: 500,
        } as any),
      ).rejects.toThrow(NotFoundException);
    });

    it('rejects invalid timeSlot', async () => {
      coachRepo.findOne.mockResolvedValue({ id: 9, venueId: 7 });
      await expect(
        service.createClass(7, { coachId: 9, date: '2026-05-09', timeSlot: 'bad' } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects invalid status', async () => {
      coachRepo.findOne.mockResolvedValue({ id: 9, venueId: 7 });
      await expect(
        service.createClass(7, {
          coachId: 9,
          date: '2026-05-09',
          timeSlot: '18:00-20:00',
          status: 'something_weird',
        } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects negative fee', async () => {
      coachRepo.findOne.mockResolvedValue({ id: 9, venueId: 7 });
      await expect(
        service.createClass(7, {
          coachId: 9,
          date: '2026-05-09',
          timeSlot: '18:00-20:00',
          feePerStudent: -1,
        } as any),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
