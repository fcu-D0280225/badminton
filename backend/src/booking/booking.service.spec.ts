import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { In } from 'typeorm';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { BookingService } from './booking.service';
import { Booking } from '../entities/booking.entity';
import { Payment } from '../entities/payment.entity';
import { Account } from '../entities/account.entity';
import { BookingParticipant } from '../entities/booking-participant.entity';
import { WaitlistService } from '../waitlist/waitlist.service';
import { PushService } from '../push/push.service';
import { AuthUser } from '../auth/types';

const mockRepo = () => ({
  create: jest.fn(),
  save: jest.fn(),
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
  let participantRepo: ReturnType<typeof mockRepo>;

  beforeEach(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        BookingService,
        { provide: getRepositoryToken(Booking), useFactory: mockRepo },
        { provide: getRepositoryToken(Payment), useFactory: mockRepo },
        { provide: getRepositoryToken(Account), useFactory: mockRepo },
        {
          provide: getRepositoryToken(BookingParticipant),
          useFactory: mockRepo,
        },
        { provide: WaitlistService, useValue: { getFirstWaiting: jest.fn(), markNotified: jest.fn() } },
        { provide: PushService, useValue: { notifyAccount: jest.fn() } },
      ],
    }).compile();

    service = moduleRef.get<BookingService>(BookingService);
    bookingRepo = moduleRef.get(getRepositoryToken(Booking));
    participantRepo = moduleRef.get(getRepositoryToken(BookingParticipant));
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

  describe('createBooking ownership enforcement', () => {
    it('rejects player trying to book as another player', async () => {
      await expect(
        service.createBooking({ playerId: 99, venueId: 1 }, mkUser('player', 5)),
      ).rejects.toThrow(ForbiddenException);
    });

    it('rejects organizer impersonating other organizer', async () => {
      await expect(
        service.createBooking(
          { organizerId: 99, venueId: 1 },
          mkUser('organizer', 3),
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('rejects venue creating booking at another venue', async () => {
      await expect(
        service.createBooking({ venueId: 99 }, mkUser('venue', 7)),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('participant operations', () => {
    it('throws NotFoundException when accessing participants of unowned booking', async () => {
      bookingRepo.findOne.mockResolvedValue({ id: 1, venueId: 8 });
      await expect(
        service.getParticipants(1, mkUser('venue', 7)),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when removing participant from unowned booking', async () => {
      participantRepo.findOne.mockResolvedValue({ id: 5, bookingId: 1 });
      bookingRepo.findOne.mockResolvedValue({ id: 1, venueId: 8 });
      await expect(
        service.removeParticipant(5, mkUser('venue', 7)),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
