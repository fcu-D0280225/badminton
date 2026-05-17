import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { EnrollmentService } from './enrollment.service';
import { CoachClass } from '../entities/coach-class.entity';
import { CoachClassEnrollment } from '../entities/coach-class-enrollment.entity';
import { Player } from '../entities/player.entity';

const mockRepo = () => ({
  find: jest.fn(),
  findOne: jest.fn(),
  create: jest.fn((d) => d),
  save: jest.fn((d) => Promise.resolve({ id: 1, ...d })),
  delete: jest.fn(),
  count: jest.fn(),
  createQueryBuilder: jest.fn(),
});

type Repo = ReturnType<typeof mockRepo>;

describe('EnrollmentService', () => {
  let service: EnrollmentService;
  let enrollmentRepo: Repo;
  let classRepo: Repo;
  let playerRepo: Repo;

  beforeEach(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        EnrollmentService,
        {
          provide: getRepositoryToken(CoachClassEnrollment),
          useFactory: mockRepo,
        },
        { provide: getRepositoryToken(CoachClass), useFactory: mockRepo },
        { provide: getRepositoryToken(Player), useFactory: mockRepo },
      ],
    }).compile();
    service = moduleRef.get(EnrollmentService);
    enrollmentRepo = moduleRef.get(getRepositoryToken(CoachClassEnrollment));
    classRepo = moduleRef.get(getRepositoryToken(CoachClass));
    playerRepo = moduleRef.get(getRepositoryToken(Player));
  });

  // ── enroll ───────────────────────────────────────────────────────
  describe('enroll', () => {
    const baseClass = {
      id: 10,
      venueId: 7,
      status: 'open',
      capacity: 5,
      feePerStudent: 500,
    };

    it('happy path: insert new enrollment with default amount=class.feePerStudent', async () => {
      classRepo.findOne.mockResolvedValue({ ...baseClass });
      playerRepo.findOne.mockResolvedValue({ id: 33 });
      enrollmentRepo.count.mockResolvedValue(0);
      enrollmentRepo.findOne.mockResolvedValue(null);

      const out = await service.enroll(10, 33, [7]);
      expect(enrollmentRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          coachClassId: 10,
          playerId: 33,
          status: 'enrolled',
          checkedInAt: null,
          paymentStatus: 'pending',
          amount: 500,
        }),
      );
      expect(enrollmentRepo.save).toHaveBeenCalled();
      expect(out).toBeDefined();
    });

    it('explicit amount overrides feePerStudent default', async () => {
      classRepo.findOne.mockResolvedValue({ ...baseClass });
      playerRepo.findOne.mockResolvedValue({ id: 33 });
      enrollmentRepo.count.mockResolvedValue(0);
      enrollmentRepo.findOne.mockResolvedValue(null);

      await service.enroll(10, 33, [7], { amount: 250 });
      expect(enrollmentRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ amount: 250 }),
      );
    });

    it('class not in venueIds → NotFoundException (no existence leak)', async () => {
      classRepo.findOne.mockResolvedValue({ ...baseClass, venueId: 99 });
      await expect(service.enroll(10, 33, [7])).rejects.toThrow(
        NotFoundException,
      );
    });

    it('class not found → NotFoundException', async () => {
      classRepo.findOne.mockResolvedValue(null);
      await expect(service.enroll(10, 33, [7])).rejects.toThrow(
        NotFoundException,
      );
    });

    it('empty venueIds → NotFoundException via assertClassOwned', async () => {
      classRepo.findOne.mockResolvedValue({ ...baseClass });
      await expect(service.enroll(10, 33, [])).rejects.toThrow(
        NotFoundException,
      );
    });

    it('class.status=closed → BadRequest', async () => {
      classRepo.findOne.mockResolvedValue({ ...baseClass, status: 'closed' });
      await expect(service.enroll(10, 33, [7])).rejects.toThrow(
        BadRequestException,
      );
    });

    it('class.status=cancelled → BadRequest', async () => {
      classRepo.findOne.mockResolvedValue({
        ...baseClass,
        status: 'cancelled',
      });
      await expect(service.enroll(10, 33, [7])).rejects.toThrow(
        BadRequestException,
      );
    });

    it('capacity full (enrolled count >= capacity) → BadRequest', async () => {
      classRepo.findOne.mockResolvedValue({ ...baseClass, capacity: 5 });
      playerRepo.findOne.mockResolvedValue({ id: 33 });
      enrollmentRepo.count.mockResolvedValue(5);
      enrollmentRepo.findOne.mockResolvedValue(null);
      await expect(service.enroll(10, 33, [7])).rejects.toThrow(
        BadRequestException,
      );
    });

    it('capacity calc excludes cancelled (6 enrolled / cap=6 / 3 cancelled still full)', async () => {
      // count mock returns the "enrolled-only" number; assert that the service
      // queries with status:'enrolled' filter
      classRepo.findOne.mockResolvedValue({ ...baseClass, capacity: 6 });
      playerRepo.findOne.mockResolvedValue({ id: 33 });
      enrollmentRepo.count.mockResolvedValue(6);
      enrollmentRepo.findOne.mockResolvedValue(null);
      await expect(service.enroll(10, 33, [7])).rejects.toThrow(
        BadRequestException,
      );
      expect(enrollmentRepo.count).toHaveBeenCalledWith({
        where: { coachClassId: 10, status: 'enrolled' },
      });
    });

    it('capacity=null → no limit, allow enroll', async () => {
      classRepo.findOne.mockResolvedValue({ ...baseClass, capacity: null });
      playerRepo.findOne.mockResolvedValue({ id: 33 });
      enrollmentRepo.findOne.mockResolvedValue(null);
      // even if count mock not set, capacity branch should be skipped
      await service.enroll(10, 33, [7]);
      expect(enrollmentRepo.count).not.toHaveBeenCalled();
      expect(enrollmentRepo.save).toHaveBeenCalled();
    });

    it('existing enrolled enrollment → BadRequest 學員已報名', async () => {
      classRepo.findOne.mockResolvedValue({ ...baseClass });
      playerRepo.findOne.mockResolvedValue({ id: 33 });
      enrollmentRepo.count.mockResolvedValue(0);
      enrollmentRepo.findOne.mockResolvedValue({
        id: 50,
        coachClassId: 10,
        playerId: 33,
        status: 'enrolled',
        checkedInAt: null,
        paymentStatus: 'pending',
        amount: 500,
      });
      await expect(service.enroll(10, 33, [7])).rejects.toThrow(
        /已報名/,
      );
    });

    it('existing cancelled enrollment → reactivate (reset checkedInAt/paymentStatus, apply new amount, NOT a new INSERT)', async () => {
      classRepo.findOne.mockResolvedValue({ ...baseClass });
      playerRepo.findOne.mockResolvedValue({ id: 33 });
      enrollmentRepo.count.mockResolvedValue(0);
      const existing = {
        id: 50,
        coachClassId: 10,
        playerId: 33,
        status: 'cancelled',
        checkedInAt: new Date('2026-01-01'),
        paymentStatus: 'paid',
        amount: 100,
      };
      enrollmentRepo.findOne.mockResolvedValue(existing);
      enrollmentRepo.save.mockImplementation((d) => Promise.resolve(d));

      const out = await service.enroll(10, 33, [7], { amount: 600 });
      // Critical: must NOT call create() — would trigger UNIQUE index violation
      expect(enrollmentRepo.create).not.toHaveBeenCalled();
      expect(enrollmentRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 50,
          status: 'enrolled',
          checkedInAt: null,
          paymentStatus: 'pending',
          amount: 600,
        }),
      );
      expect(out.status).toBe('enrolled');
    });

    it('player not found → NotFoundException', async () => {
      classRepo.findOne.mockResolvedValue({ ...baseClass });
      playerRepo.findOne.mockResolvedValue(null);
      enrollmentRepo.count.mockResolvedValue(0);
      await expect(service.enroll(10, 999, [7])).rejects.toThrow(
        NotFoundException,
      );
    });

    it('invalid playerId (0 / non-integer) → BadRequest', async () => {
      await expect(service.enroll(10, 0, [7])).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.enroll(10, 1.5 as any, [7])).rejects.toThrow(
        BadRequestException,
      );
    });

    it('negative amount in enroll() → BadRequest', async () => {
      classRepo.findOne.mockResolvedValue({ ...baseClass });
      playerRepo.findOne.mockResolvedValue({ id: 33 });
      enrollmentRepo.count.mockResolvedValue(0);
      enrollmentRepo.findOne.mockResolvedValue(null);
      await expect(
        service.enroll(10, 33, [7], { amount: -5 }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ── cancel ───────────────────────────────────────────────────────
  describe('cancel', () => {
    it('enrolled → cancelled', async () => {
      const enrollment = {
        id: 50,
        status: 'enrolled',
        coachClass: { id: 10, venueId: 7 },
      };
      enrollmentRepo.findOne.mockResolvedValue(enrollment);
      enrollmentRepo.save.mockImplementation((d) => Promise.resolve(d));
      const out = await service.cancel(50, [7]);
      expect(out.status).toBe('cancelled');
    });

    it('already cancelled → idempotent (still cancelled)', async () => {
      const enrollment = {
        id: 50,
        status: 'cancelled',
        coachClass: { id: 10, venueId: 7 },
      };
      enrollmentRepo.findOne.mockResolvedValue(enrollment);
      enrollmentRepo.save.mockImplementation((d) => Promise.resolve(d));
      const out = await service.cancel(50, [7]);
      expect(out.status).toBe('cancelled');
    });

    it('cross-venue → NotFoundException', async () => {
      enrollmentRepo.findOne.mockResolvedValue({
        id: 50,
        status: 'enrolled',
        coachClass: { id: 10, venueId: 99 },
      });
      await expect(service.cancel(50, [7])).rejects.toThrow(NotFoundException);
    });

    it('empty venueIds → NotFoundException (no DB query)', async () => {
      await expect(service.cancel(50, [])).rejects.toThrow(NotFoundException);
      expect(enrollmentRepo.findOne).not.toHaveBeenCalled();
    });

    it('enrollment not found → NotFoundException', async () => {
      enrollmentRepo.findOne.mockResolvedValue(null);
      await expect(service.cancel(999, [7])).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ── checkin / undoCheckin ────────────────────────────────────────
  describe('checkin', () => {
    it('enrolled & not yet checked in → writes checkedInAt', async () => {
      const enrollment = {
        id: 50,
        status: 'enrolled',
        checkedInAt: null,
        coachClass: { id: 10, venueId: 7 },
      };
      enrollmentRepo.findOne.mockResolvedValue(enrollment);
      enrollmentRepo.save.mockImplementation((d) => Promise.resolve(d));
      const out = await service.checkin(50, [7]);
      expect(out.checkedInAt).toBeInstanceOf(Date);
    });

    it('cancelled status → BadRequest (cannot checkin)', async () => {
      enrollmentRepo.findOne.mockResolvedValue({
        id: 50,
        status: 'cancelled',
        checkedInAt: null,
        coachClass: { id: 10, venueId: 7 },
      });
      await expect(service.checkin(50, [7])).rejects.toThrow(
        BadRequestException,
      );
    });

    it('already checked-in → BadRequest', async () => {
      enrollmentRepo.findOne.mockResolvedValue({
        id: 50,
        status: 'enrolled',
        checkedInAt: new Date(),
        coachClass: { id: 10, venueId: 7 },
      });
      await expect(service.checkin(50, [7])).rejects.toThrow(
        BadRequestException,
      );
    });

    it('cross-venue → NotFoundException', async () => {
      enrollmentRepo.findOne.mockResolvedValue({
        id: 50,
        status: 'enrolled',
        checkedInAt: null,
        coachClass: { id: 10, venueId: 99 },
      });
      await expect(service.checkin(50, [7])).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('undoCheckin', () => {
    it('clears checkedInAt to null', async () => {
      enrollmentRepo.findOne.mockResolvedValue({
        id: 50,
        status: 'enrolled',
        checkedInAt: new Date(),
        coachClass: { id: 10, venueId: 7 },
      });
      enrollmentRepo.save.mockImplementation((d) => Promise.resolve(d));
      const out = await service.undoCheckin(50, [7]);
      expect(out.checkedInAt).toBeNull();
    });

    it('idempotent on a not-checked-in enrollment (current impl: silently sets null)', async () => {
      enrollmentRepo.findOne.mockResolvedValue({
        id: 50,
        status: 'enrolled',
        checkedInAt: null,
        coachClass: { id: 10, venueId: 7 },
      });
      enrollmentRepo.save.mockImplementation((d) => Promise.resolve(d));
      const out = await service.undoCheckin(50, [7]);
      expect(out.checkedInAt).toBeNull();
    });

    it('cross-venue → NotFoundException', async () => {
      enrollmentRepo.findOne.mockResolvedValue({
        id: 50,
        status: 'enrolled',
        checkedInAt: new Date(),
        coachClass: { id: 10, venueId: 99 },
      });
      await expect(service.undoCheckin(50, [7])).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ── updatePayment ────────────────────────────────────────────────
  describe('updatePayment', () => {
    const baseEnrollment = () => ({
      id: 50,
      status: 'enrolled',
      paymentStatus: 'pending',
      amount: 500,
      coachClass: { id: 10, venueId: 7 },
    });

    it.each(['pending', 'paid', 'refunded'])(
      'accepts status=%s',
      async (status) => {
        enrollmentRepo.findOne.mockResolvedValue(baseEnrollment());
        enrollmentRepo.save.mockImplementation((d) => Promise.resolve(d));
        const out = await service.updatePayment(50, [7], status as any);
        expect(out.paymentStatus).toBe(status);
      },
    );

    it('rejects invalid paymentStatus value', async () => {
      // PAYMENT_STATUSES check runs BEFORE assertOwnsEnrollment, so no need to mock findOne
      await expect(
        service.updatePayment(50, [7], 'foo' as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('cross-venue → NotFoundException', async () => {
      enrollmentRepo.findOne.mockResolvedValue({
        ...baseEnrollment(),
        coachClass: { id: 10, venueId: 99 },
      });
      await expect(service.updatePayment(50, [7], 'paid')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('negative amount → BadRequest', async () => {
      enrollmentRepo.findOne.mockResolvedValue(baseEnrollment());
      await expect(
        service.updatePayment(50, [7], 'paid', -1),
      ).rejects.toThrow(BadRequestException);
    });

    it('amount=0 → allowed', async () => {
      enrollmentRepo.findOne.mockResolvedValue(baseEnrollment());
      enrollmentRepo.save.mockImplementation((d) => Promise.resolve(d));
      const out = await service.updatePayment(50, [7], 'paid', 0);
      expect(out.amount).toBe(0);
      expect(out.paymentStatus).toBe('paid');
    });

    it('amount undefined → keeps existing amount', async () => {
      const existing = baseEnrollment();
      enrollmentRepo.findOne.mockResolvedValue(existing);
      enrollmentRepo.save.mockImplementation((d) => Promise.resolve(d));
      const out = await service.updatePayment(50, [7], 'paid');
      expect(out.amount).toBe(500);
    });
  });

  // ── listByClass / listByPlayer ───────────────────────────────────
  describe('listByClass', () => {
    it('cross-venue → NotFoundException', async () => {
      classRepo.findOne.mockResolvedValue({ id: 10, venueId: 99 });
      await expect(service.listByClass(10, [7])).rejects.toThrow(
        NotFoundException,
      );
    });

    it('empty venueIds → returns [] (early exit, no DB hit)', async () => {
      const out = await service.listByClass(10, []);
      expect(out).toEqual([]);
      expect(classRepo.findOne).not.toHaveBeenCalled();
    });

    it('class owned → queries enrollments filtered by classId only (includes cancelled)', async () => {
      classRepo.findOne.mockResolvedValue({ id: 10, venueId: 7 });
      const rows = [
        { id: 1, coachClassId: 10, playerId: 33, status: 'enrolled' },
        { id: 2, coachClassId: 10, playerId: 34, status: 'cancelled' },
      ];
      const qb: any = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue(rows),
      };
      enrollmentRepo.createQueryBuilder.mockReturnValue(qb);
      const out = await service.listByClass(10, [7]);
      expect(qb.where).toHaveBeenCalledWith('e.coachClassId = :classId', {
        classId: 10,
      });
      // no status filter → cancelled rows are included (matches frontend expectation)
      expect(out).toEqual(rows);
    });
  });

  describe('listByPlayer', () => {
    it('returns only rows for the given playerId (no cross-player leak)', async () => {
      const rows = [
        { id: 1, playerId: 33, coachClassId: 10 },
        { id: 2, playerId: 33, coachClassId: 11 },
      ];
      const qb: any = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue(rows),
      };
      enrollmentRepo.createQueryBuilder.mockReturnValue(qb);
      const out = await service.listByPlayer(33);
      expect(qb.where).toHaveBeenCalledWith('e.playerId = :playerId', {
        playerId: 33,
      });
      expect(out).toEqual(rows);
    });

    it('falsy playerId → returns [] without DB hit', async () => {
      const out = await service.listByPlayer(0);
      expect(out).toEqual([]);
      expect(enrollmentRepo.createQueryBuilder).not.toHaveBeenCalled();
    });
  });
});
