import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken, getDataSourceToken } from '@nestjs/typeorm';
import { In } from 'typeorm';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { BookingService } from './booking.service';
import { Booking } from '../entities/booking.entity';
import { Payment } from '../entities/payment.entity';
import { Account } from '../entities/account.entity';
import { WaitlistService } from '../waitlist/waitlist.service';
import { PushService } from '../push/push.service';
import { PricingService } from '../pricing/pricing.service';
import { WalletService } from '../wallet/wallet.service';
import { AuthUser } from '../auth/types';

const mockRepo = () => ({
  create: jest.fn((d) => d),
  save: jest.fn((d) => Promise.resolve({ id: 1, ...d })),
  findOne: jest.fn(),
  find: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  count: jest.fn(),
});

const mkUser = (
  role: AuthUser['role'],
  entityId: number,
  linkedEntityId?: number,
): AuthUser => ({ id: 1, username: 'u', role, entityId, linkedEntityId });

describe('BookingService (SEC-001 ownership filter)', () => {
  let service: BookingService;
  let bookingRepo: ReturnType<typeof mockRepo>;
  let paymentRepo: ReturnType<typeof mockRepo>;
  let pricingService: { resolveAmount: jest.Mock };
  let pushService: { notifyAccount: jest.Mock };

  beforeEach(async () => {
    pricingService = {
      resolveAmount: jest.fn().mockResolvedValue({ amount: 500, pricePerHour: 250, ruleId: 1, source: 'rule' }),
    };
    pushService = { notifyAccount: jest.fn().mockResolvedValue(undefined) };

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        BookingService,
        { provide: getRepositoryToken(Booking), useFactory: mockRepo },
        { provide: getRepositoryToken(Payment), useFactory: mockRepo },
        { provide: getRepositoryToken(Account), useFactory: mockRepo },
        {
          provide: WaitlistService,
          useValue: { getFirstWaiting: jest.fn(), markNotified: jest.fn() },
        },
        { provide: PushService, useValue: pushService },
        { provide: PricingService, useValue: pricingService },
        {
          provide: WalletService,
          useValue: { refundIfWalletPaid: jest.fn().mockResolvedValue(undefined) },
        },
        {
          provide: getDataSourceToken(),
          useValue: {
            transaction: jest.fn().mockImplementation((cb) => cb({
              create: jest.fn((Entity, d) => d),
              save: jest.fn((d) => Promise.resolve({ id: 99, ...d })),
            })),
          },
        },
      ],
    }).compile();

    service = moduleRef.get<BookingService>(BookingService);
    bookingRepo = moduleRef.get(getRepositoryToken(Booking));
    paymentRepo = moduleRef.get(getRepositoryToken(Payment));
  });

  describe('findAll', () => {
    it('venue user sees only own venue bookings (uses In([entityId]) fallback)', async () => {
      bookingRepo.find.mockResolvedValue([{ id: 1, venueId: 7 }]);
      const out = await service.findAll(mkUser('venue', 7));
      expect(bookingRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({ where: [{ venueId: In([7]) }] }),
      );
      expect(out).toEqual([{ id: 1, venueId: 7 }]);
    });

    it('member sees both organizerId and playerId bookings', async () => {
      bookingRepo.find.mockResolvedValue([]);
      await service.findAll(mkUser('member', 3, 5));
      expect(bookingRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: [{ organizerId: 3 }, { playerId: 5 }],
        }),
      );
    });
  });

  describe('findOne', () => {
    it('returns booking when user owns it', async () => {
      bookingRepo.findOne.mockResolvedValue({ id: 1, venueId: 7 });
      const out = await service.findOne(1, mkUser('venue', 7));
      expect(out).toEqual({ id: 1, venueId: 7 });
    });

    it('multi-venue: returns booking from any owned venue', async () => {
      bookingRepo.findOne.mockResolvedValue({ id: 1, venueId: 12 });
      const user: any = { ...mkUser('venue', 7), venueIds: [7, 12] };
      const out = await service.findOne(1, user);
      expect(out).toEqual({ id: 1, venueId: 12 });
    });

    it('throws NotFoundException on cross-venue access (IDOR)', async () => {
      bookingRepo.findOne.mockResolvedValue({ id: 1, venueId: 8 });
      await expect(service.findOne(1, mkUser('venue', 7))).rejects.toThrow(
        NotFoundException,
      );
    });

    it('returns null silently when booking does not exist (no info leak)', async () => {
      bookingRepo.findOne.mockResolvedValue(null);
      const out = await service.findOne(999, mkUser('venue', 7));
      expect(out).toBeNull();
    });
  });

  describe('updateBooking', () => {
    it('throws NotFoundException when updating booking not owned by user', async () => {
      bookingRepo.findOne.mockResolvedValue({ id: 1, organizerId: 4 });
      await expect(
        service.updateBooking(1, { notes: 'x' }, mkUser('organizer', 3)),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('createBooking — ownership enforcement', () => {
    it('rejects player trying to book as another player', async () => {
      await expect(
        service.createBooking({ playerId: 99, venueId: 1 }, mkUser('player', 5)),
      ).rejects.toThrow(ForbiddenException);
    });

    it('rejects organizer impersonating other organizer', async () => {
      await expect(
        service.createBooking({ organizerId: 99, venueId: 1 }, mkUser('organizer', 3)),
      ).rejects.toThrow(ForbiddenException);
    });

    it('rejects venue creating booking at another venue', async () => {
      await expect(
        service.createBooking({ venueId: 99 }, mkUser('venue', 7)),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('createBooking — happy path', () => {
    const venueUser = mkUser('venue', 7);
    const baseBookingData = {
      venueId: 7,
      date: '2026-06-01',
      timeSlot: '09:00-11:00',
      organizerId: undefined as number,
    };

    const savedBooking = { ...baseBookingData, id: 10, holdExpiresAt: new Date() };

    beforeEach(() => {
      bookingRepo.create.mockImplementation((d) => d);
      // assertNoDuplicate returns early (no member IDs in baseBookingData),
      // so findOne is only called in this.findOne(booking.id) at the end.
      bookingRepo.findOne.mockResolvedValue(savedBooking);
      bookingRepo.save.mockResolvedValue(savedBooking);
      paymentRepo.create.mockImplementation((d) => d);
      paymentRepo.save.mockResolvedValue({ id: 1, bookingId: 10, amount: 500, status: 'unpaid' });
    });

    it('creates booking and payment record', async () => {
      const result = await service.createBooking(baseBookingData, venueUser);
      expect(bookingRepo.save).toHaveBeenCalled();
      expect(paymentRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ bookingId: 10, amount: 500, status: 'unpaid' }),
      );
      expect(result.id).toBe(10);
    });

    it('auto-resolves pricing via PricingService', async () => {
      await service.createBooking(baseBookingData, venueUser);
      expect(pricingService.resolveAmount).toHaveBeenCalledWith(7, '2026-06-01', '09:00-11:00');
    });

    it('falls back to amount=0 when pricing throws', async () => {
      pricingService.resolveAmount.mockRejectedValue(new Error('pricing error'));
      await service.createBooking(baseBookingData, venueUser);
      expect(paymentRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ amount: 0 }),
      );
    });

    it('sets holdExpiresAt on the created booking', async () => {
      await service.createBooking(baseBookingData, venueUser);
      expect(bookingRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ holdExpiresAt: expect.any(Date) }),
      );
    });
  });
});
