import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
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

const mockStripe = {
  checkout: {
    sessions: {
      create: jest.fn(),
    },
  },
  refunds: {
    create: jest.fn(),
  },
  webhooks: {
    constructEvent: jest.fn(),
  },
};

const mockDataSource = {
  transaction: jest.fn(),
};

const venueUser = { id: 1, role: 'venue', entityId: 7, venueIds: [7], username: 'v' };
const orgUser = { id: 2, role: 'organizer', entityId: 3, username: 'o' };

describe('PaymentService', () => {
  let service: PaymentService;
  let paymentRepo: ReturnType<typeof mockRepo>;
  let bookingRepo: ReturnType<typeof mockRepo>;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentService,
        { provide: getRepositoryToken(Payment), useFactory: mockRepo },
        { provide: getRepositoryToken(Booking), useFactory: mockRepo },
        { provide: 'STRIPE_CLIENT', useValue: mockStripe },
        { provide: DataSource, useValue: mockDataSource },
      ],
    }).compile();

    service = module.get(PaymentService);
    paymentRepo = module.get(getRepositoryToken(Payment));
    bookingRepo = module.get(getRepositoryToken(Booking));
  });

  // ─── 原有測試 ───────────────────────────────────────────────────────────

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

  // ─── T1–T3: createCheckoutSession ─────────────────────────────────────

  describe('createCheckoutSession', () => {
    it('T1 — 正常流程：回傳 URL，status 設為 processing', async () => {
      const payment = {
        id: 10,
        bookingId: 42,
        amount: 500,
        status: 'unpaid',
        booking: { venueId: 7, status: 'pending' }, // venueUser owns venueId 7
      };
      paymentRepo.findOne.mockResolvedValue(payment);
      mockStripe.checkout.sessions.create.mockResolvedValue({
        id: 'cs_test_abc123',
        url: 'https://checkout.stripe.com/pay/cs_test_abc123',
      });
      paymentRepo.update.mockResolvedValue({ affected: 1 });

      const url = await service.createCheckoutSession(10, venueUser as any);

      expect(url).toBe('https://checkout.stripe.com/pay/cs_test_abc123');
      expect(mockStripe.checkout.sessions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: { paymentId: '10' },
          line_items: [expect.objectContaining({
            price_data: expect.objectContaining({
              unit_amount: 500, // TWD zero-decimal, Math.round(500)
            }),
          })],
        }),
      );
      expect(paymentRepo.update).toHaveBeenCalledWith(10, {
        status: 'processing',
        gatewayOrderId: 'cs_test_abc123',
      });
    });

    it('T2 — 非 owner 呼叫拋 ForbiddenException', async () => {
      // venueUser (venueIds: [7]) but booking belongs to venueId 99
      paymentRepo.findOne.mockResolvedValue({
        id: 10,
        bookingId: 42,
        amount: 500,
        status: 'unpaid',
        booking: { venueId: 99, status: 'pending' }, // different venue
      });

      await expect(
        service.createCheckoutSession(10, venueUser as any),
      ).rejects.toThrow(ForbiddenException);
    });

    it('T3 — status 非 unpaid 拋 BadRequestException', async () => {
      paymentRepo.findOne.mockResolvedValue({
        id: 10,
        bookingId: 42,
        amount: 500,
        status: 'processing',
        booking: { venueId: 7 }, // owned by venueUser
      });

      await expect(
        service.createCheckoutSession(10, venueUser as any),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ─── T4–T6: markAsPaidByGateway ───────────────────────────────────────

  describe('markAsPaidByGateway', () => {
    it('T4 — 正常流程：status→paid，booking→confirmed', async () => {
      const payment = {
        id: 10,
        bookingId: 42,
        status: 'processing',
        booking: { status: 'pending' },
      };
      mockDataSource.transaction.mockImplementation(async (cb: (manager: any) => Promise<void>) => {
        const manager = {
          findOne: jest.fn().mockResolvedValue(payment),
          update: jest.fn().mockResolvedValue({ affected: 1 }),
        };
        await cb(manager);
        expect(manager.update).toHaveBeenCalledWith(Payment, 10, expect.objectContaining({ status: 'paid' }));
        expect(manager.update).toHaveBeenCalledWith(Booking, 42, { status: 'confirmed' });
      });

      await service.markAsPaidByGateway(10, 'pi_test_xyz');
      expect(mockDataSource.transaction).toHaveBeenCalled();
    });

    it('T5 — hold 過期 race: booking cancelled → refund + status→refunded', async () => {
      const payment = {
        id: 10,
        bookingId: 42,
        status: 'processing',
        booking: { status: 'cancelled' },
      };
      const mockManager = {
        findOne: jest.fn().mockResolvedValue(payment),
        update: jest.fn().mockResolvedValue({ affected: 1 }),
      };
      mockDataSource.transaction.mockImplementation(async (cb: (manager: any) => Promise<void>) => {
        await cb(mockManager);
      });
      mockStripe.refunds.create.mockResolvedValue({ id: 're_test' });

      await service.markAsPaidByGateway(10, 'pi_test_xyz');

      expect(mockManager.update).toHaveBeenCalledWith(Payment, 10, { status: 'refunding' });
      expect(mockStripe.refunds.create).toHaveBeenCalledWith({ payment_intent: 'pi_test_xyz' });
      expect(mockManager.update).toHaveBeenCalledWith(Payment, 10, { status: 'refunded' });
    });

    it('T6 — 重複呼叫（idempotency）：status=paid 時第二次無效', async () => {
      const paidPayment = {
        id: 10,
        bookingId: 42,
        status: 'paid',
        booking: { status: 'confirmed' },
      };
      const mockManager = {
        findOne: jest.fn().mockResolvedValue(paidPayment),
        update: jest.fn(),
      };
      mockDataSource.transaction.mockImplementation(async (cb: (manager: any) => Promise<void>) => {
        await cb(mockManager);
      });

      await service.markAsPaidByGateway(10, 'pi_test_xyz');

      expect(mockManager.update).not.toHaveBeenCalled();
    });
  });
});
