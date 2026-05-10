import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { PaymentService } from './payment.service';
import { Payment } from '../entities/payment.entity';
import { Booking } from '../entities/booking.entity';

const mockRepo = () => ({
  find: jest.fn(),
  findOne: jest.fn(),
  create: jest.fn((d) => d),
  save: jest.fn((d) => Promise.resolve({ id: 1, ...d })),
  update: jest.fn(),
  createQueryBuilder: jest.fn(),
});

const venueUser = { id: 1, role: 'venue', entityId: 7, venueIds: [7], username: 'v' };
const orgUser = { id: 2, role: 'organizer', entityId: 3, username: 'o' };

describe('PaymentService', () => {
  let service: PaymentService;
  let paymentRepo: ReturnType<typeof mockRepo>;
  let bookingRepo: ReturnType<typeof mockRepo>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentService,
        { provide: getRepositoryToken(Payment), useFactory: mockRepo },
        { provide: getRepositoryToken(Booking), useFactory: mockRepo },
      ],
    }).compile();

    service = module.get(PaymentService);
    paymentRepo = module.get(getRepositoryToken(Payment));
    bookingRepo = module.get(getRepositoryToken(Booking));
  });

  describe('markAsPaid', () => {
    it('sets status=paid, paidAt, and upgrades booking to confirmed', async () => {
      const payment = { id: 1, bookingId: 10, status: 'unpaid', booking: { venueId: 7 } };
      paymentRepo.findOne.mockResolvedValue(payment);
      paymentRepo.save.mockResolvedValue({ ...payment, status: 'paid', paidAt: expect.any(Date) });
      bookingRepo.update.mockResolvedValue({ affected: 1 });

      const result = await service.markAsPaid(1, 'cash', undefined, venueUser as any);

      expect(paymentRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'paid', paidAt: expect.any(Date) }),
      );
      expect(bookingRepo.update).toHaveBeenCalledWith(10, {
        holdExpiresAt: null,
        status: 'confirmed',
      });
      expect(result.status).toBe('paid');
    });

    it('stores paymentMethod and transactionId when provided', async () => {
      const payment = { id: 1, bookingId: 10, status: 'unpaid', booking: { venueId: 7 } };
      paymentRepo.findOne.mockResolvedValue(payment);
      paymentRepo.save.mockImplementation((p) => Promise.resolve(p));
      bookingRepo.update.mockResolvedValue({ affected: 1 });

      await service.markAsPaid(1, 'transfer', 'TXN-001', venueUser as any);

      expect(paymentRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ paymentMethod: 'transfer', transactionId: 'TXN-001' }),
      );
    });

    it('throws NotFoundException when payment belongs to another venue (IDOR)', async () => {
      paymentRepo.findOne.mockResolvedValue({
        id: 1,
        bookingId: 10,
        status: 'unpaid',
        booking: { venueId: 99 }, // different venue
      });

      await expect(service.markAsPaid(1, undefined, undefined, venueUser as any)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('returns null when payment not found', async () => {
      paymentRepo.findOne.mockResolvedValue(null);
      const result = await service.markAsPaid(999);
      expect(result).toBeNull();
    });
  });

  describe('createPayment', () => {
    it('creates payment for booking owned by user', async () => {
      bookingRepo.findOne.mockResolvedValue({ id: 5, venueId: 7 });
      paymentRepo.create.mockReturnValue({ bookingId: 5, amount: 300 });
      paymentRepo.save.mockResolvedValue({ id: 1, bookingId: 5, amount: 300 });

      const result = await service.createPayment(
        { bookingId: 5, amount: 300 } as any,
        venueUser as any,
      );

      expect(result.bookingId).toBe(5);
    });

    it('throws NotFoundException for booking not owned by user', async () => {
      bookingRepo.findOne.mockResolvedValue({ id: 5, venueId: 99 });

      await expect(
        service.createPayment({ bookingId: 5, amount: 300 } as any, venueUser as any),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('findByBooking', () => {
    it('returns payment for owned booking', async () => {
      bookingRepo.findOne.mockResolvedValue({ id: 5, organizerId: 3 });
      paymentRepo.findOne.mockResolvedValue({ id: 1, bookingId: 5, amount: 200 });

      const result = await service.findByBooking(5, orgUser as any);
      expect(result.bookingId).toBe(5);
    });

    it('throws NotFoundException for booking not owned by organizer', async () => {
      bookingRepo.findOne.mockResolvedValue({ id: 5, organizerId: 99 });

      await expect(service.findByBooking(5, orgUser as any)).rejects.toThrow(NotFoundException);
    });
  });
});
