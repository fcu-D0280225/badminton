import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { WalletService } from './wallet.service';
import { MemberWallet } from '../entities/member-wallet.entity';
import { WalletTransaction } from '../entities/wallet-transaction.entity';
import { Booking } from '../entities/booking.entity';
import { Payment } from '../entities/payment.entity';
import { Venue } from '../entities/venue.entity';
import { Account } from '../entities/account.entity';

const mockRepo = () => ({
  find: jest.fn(),
  findOne: jest.fn(),
  create: jest.fn((d) => d),
  save: jest.fn((d) => Promise.resolve({ id: 1, ...d })),
  update: jest.fn(),
  createQueryBuilder: jest.fn(() => ({
    setLock: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    getOne: jest.fn(),
    getMany: jest.fn(),
  })),
});

const makeQueryRunner = (overrides: Record<string, any> = {}) => ({
  connect: jest.fn(),
  startTransaction: jest.fn(),
  commitTransaction: jest.fn(),
  rollbackTransaction: jest.fn(),
  release: jest.fn(),
  manager: {
    update: jest.fn(),
    save: jest.fn((d) => Promise.resolve({ id: 99, ...d })),
    create: jest.fn((_, d) => d),
    findOne: jest.fn(),
    getRepository: jest.fn(() => ({
      createQueryBuilder: jest.fn(() => ({
        setLock: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getOne: jest.fn(),
      })),
    })),
  },
  ...overrides,
});

const memberUser = { id: 10, role: 'member', entityId: 3, linkedEntityId: 5, username: 'm' };
const venueUser = { id: 1, role: 'venue', entityId: 7, venueIds: [7], username: 'v' };

describe('WalletService', () => {
  let service: WalletService;
  let walletRepo: ReturnType<typeof mockRepo>;
  let txRepo: ReturnType<typeof mockRepo>;
  let bookingRepo: ReturnType<typeof mockRepo>;
  let paymentRepo: ReturnType<typeof mockRepo>;
  let venueRepo: ReturnType<typeof mockRepo>;
  let accountRepo: ReturnType<typeof mockRepo>;
  let dataSource: { createQueryRunner: jest.Mock };

  beforeEach(async () => {
    jest.clearAllMocks();
    dataSource = { createQueryRunner: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WalletService,
        { provide: getRepositoryToken(MemberWallet), useFactory: mockRepo },
        { provide: getRepositoryToken(WalletTransaction), useFactory: mockRepo },
        { provide: getRepositoryToken(Booking), useFactory: mockRepo },
        { provide: getRepositoryToken(Payment), useFactory: mockRepo },
        { provide: getRepositoryToken(Venue), useFactory: mockRepo },
        { provide: getRepositoryToken(Account), useFactory: mockRepo },
        { provide: DataSource, useValue: dataSource },
      ],
    }).compile();

    service = module.get<WalletService>(WalletService);
    walletRepo = module.get(getRepositoryToken(MemberWallet));
    txRepo = module.get(getRepositoryToken(WalletTransaction));
    bookingRepo = module.get(getRepositoryToken(Booking));
    paymentRepo = module.get(getRepositoryToken(Payment));
    venueRepo = module.get(getRepositoryToken(Venue));
    accountRepo = module.get(getRepositoryToken(Account));
  });

  // ── getOrCreateWallet ─────────────────────────────────────────────

  describe('getOrCreateWallet', () => {
    it('should create a new wallet when none exists', async () => {
      walletRepo.save.mockResolvedValue({ id: 1, accountId: 10, balance: 0 });
      const result = await service.getOrCreateWallet(10);
      expect(result.accountId).toBe(10);
      expect(walletRepo.save).toHaveBeenCalled();
    });

    it('should return existing wallet on ER_DUP_ENTRY', async () => {
      const existing = { id: 1, accountId: 10, balance: 100 };
      walletRepo.save.mockRejectedValue({ code: 'ER_DUP_ENTRY' });
      walletRepo.findOne.mockResolvedValue(existing);
      const result = await service.getOrCreateWallet(10);
      expect(result).toEqual(existing);
    });

    it('should rethrow unknown errors', async () => {
      walletRepo.save.mockRejectedValue(new Error('DB connection lost'));
      await expect(service.getOrCreateWallet(10)).rejects.toThrow('DB connection lost');
    });
  });

  // ── manualTopup ───────────────────────────────────────────────────

  describe('manualTopup', () => {
    it('should throw ForbiddenException if operator is not venue role', async () => {
      accountRepo.findOne.mockResolvedValueOnce({ id: 10, role: 'member' });
      await expect(
        service.manualTopup(20, 500, '現金', 10),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw NotFoundException if target account is not member', async () => {
      accountRepo.findOne
        .mockResolvedValueOnce({ id: 1, role: 'venue' })
        .mockResolvedValueOnce({ id: 20, role: 'organizer' });
      await expect(
        service.manualTopup(20, 500, '現金', 1),
      ).rejects.toThrow(NotFoundException);
    });

    it('should credit wallet and insert manual_topup transaction', async () => {
      accountRepo.findOne
        .mockResolvedValueOnce({ id: 1, role: 'venue' })
        .mockResolvedValueOnce({ id: 20, role: 'member' });
      walletRepo.save.mockResolvedValue({ id: 2, accountId: 20, balance: 200 });

      const qr = makeQueryRunner();
      (qr.manager.getRepository as jest.Mock).mockReturnValue({
        createQueryBuilder: () => ({
          setLock: jest.fn().mockReturnThis(),
          where: jest.fn().mockReturnThis(),
          getOne: jest.fn().mockResolvedValue({ id: 2, balance: 200 }),
        }),
      });
      dataSource.createQueryRunner.mockReturnValue(qr);

      await service.manualTopup(20, 500, '現金補登', 1);

      expect(qr.manager.update).toHaveBeenCalledWith(
        MemberWallet,
        2,
        { balance: 700 },
      );
      expect(qr.commitTransaction).toHaveBeenCalled();
    });
  });

  // ── payBooking ────────────────────────────────────────────────────

  describe('payBooking', () => {
    it('should throw ForbiddenException if user is not member role', async () => {
      walletRepo.save.mockResolvedValue({ id: 1, accountId: 1, balance: 0 });
      await expect(
        service.payBooking(1, venueUser as any),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw ConflictException if payment is already paid', async () => {
      walletRepo.save.mockResolvedValue({ id: 1, accountId: 10, balance: 500 });
      const qr = makeQueryRunner();
      (qr.manager.getRepository as jest.Mock).mockReturnValue({
        createQueryBuilder: () => ({
          setLock: jest.fn().mockReturnThis(),
          where: jest.fn().mockReturnThis(),
          getOne: jest.fn().mockResolvedValue({ id: 5, status: 'paid', amount: 200 }),
        }),
      });
      dataSource.createQueryRunner.mockReturnValue(qr);

      await expect(
        service.payBooking(1, memberUser as any),
      ).rejects.toThrow(ConflictException);
    });

    it('should throw BadRequestException if balance is insufficient', async () => {
      walletRepo.save.mockResolvedValue({ id: 1, accountId: 10, balance: 50 });

      const qr = makeQueryRunner();
      let callCount = 0;
      (qr.manager.getRepository as jest.Mock).mockReturnValue({
        createQueryBuilder: () => ({
          setLock: jest.fn().mockReturnThis(),
          where: jest.fn().mockReturnThis(),
          getOne: jest.fn().mockImplementation(() => {
            callCount++;
            if (callCount === 1)
              return Promise.resolve({ id: 5, status: 'unpaid', amount: 200 });
            return Promise.resolve({ id: 1, balance: 50 });
          }),
        }),
      });
      qr.manager.findOne = jest.fn().mockResolvedValue({
        id: 1,
        organizerId: 3,
        playerId: 5,
      });
      dataSource.createQueryRunner.mockReturnValue(qr);

      await expect(
        service.payBooking(1, memberUser as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('should deduct wallet and mark payment paid on success', async () => {
      walletRepo.save.mockResolvedValue({ id: 1, accountId: 10, balance: 500 });
      walletRepo.findOne.mockResolvedValue({ id: 1, accountId: 10, balance: 300 });

      const qr = makeQueryRunner();
      let callCount = 0;
      (qr.manager.getRepository as jest.Mock).mockReturnValue({
        createQueryBuilder: () => ({
          setLock: jest.fn().mockReturnThis(),
          where: jest.fn().mockReturnThis(),
          getOne: jest.fn().mockImplementation(() => {
            callCount++;
            if (callCount === 1)
              return Promise.resolve({ id: 5, status: 'unpaid', amount: 200 });
            return Promise.resolve({ id: 1, balance: 500 });
          }),
        }),
      });
      qr.manager.findOne = jest.fn().mockResolvedValue({
        id: 1,
        organizerId: 3,
        playerId: 5,
      });
      dataSource.createQueryRunner.mockReturnValue(qr);

      await service.payBooking(1, memberUser as any);

      expect(qr.manager.update).toHaveBeenCalledWith(
        MemberWallet,
        1,
        { balance: 300 },
      );
      expect(qr.commitTransaction).toHaveBeenCalled();
    });
  });

  // ── refundIfWalletPaid ────────────────────────────────────────────

  describe('refundIfWalletPaid', () => {
    it('should no-op if no deduct transaction found', async () => {
      txRepo.findOne.mockResolvedValue(null);
      await service.refundIfWalletPaid(1);
      expect(dataSource.createQueryRunner).not.toHaveBeenCalled();
    });

    it('should skip refund if within cancellationPolicyHours', async () => {
      txRepo.findOne.mockResolvedValue({ id: 1, walletId: 2, amount: 200, bookingId: 1, createdByAccountId: 10, balanceAfter: 300 });
      bookingRepo.findOne.mockResolvedValue({
        id: 1,
        venueId: 7,
        date: new Date(Date.now() + 1000 * 60 * 60).toISOString().split('T')[0], // tomorrow-ish
        timeSlot: '10:00-11:00',
      });
      venueRepo.findOne.mockResolvedValue({ id: 7, cancellationPolicyHours: 48 });

      await service.refundIfWalletPaid(1);

      // Should not open a transaction (saves a 0-amount record instead)
      expect(dataSource.createQueryRunner).not.toHaveBeenCalled();
    });

    it('should refund wallet if outside cancellationPolicyHours', async () => {
      txRepo.findOne.mockResolvedValue({ id: 1, walletId: 2, amount: 200, bookingId: 1, createdByAccountId: 10, balanceAfter: 300 });
      bookingRepo.findOne.mockResolvedValue({
        id: 1,
        venueId: 7,
        date: '2030-12-31',
        timeSlot: '10:00-11:00',
      });
      venueRepo.findOne.mockResolvedValue({ id: 7, cancellationPolicyHours: 1 });

      const qr = makeQueryRunner();
      (qr.manager.getRepository as jest.Mock).mockReturnValue({
        createQueryBuilder: () => ({
          setLock: jest.fn().mockReturnThis(),
          where: jest.fn().mockReturnThis(),
          getOne: jest.fn().mockResolvedValue({ id: 2, balance: 100 }),
        }),
      });
      dataSource.createQueryRunner.mockReturnValue(qr);

      await service.refundIfWalletPaid(1);

      expect(qr.manager.update).toHaveBeenCalledWith(
        MemberWallet,
        2,
        { balance: 300 },
      );
      expect(qr.commitTransaction).toHaveBeenCalled();
    });

    it('should refund wallet when venue has no cancellationPolicyHours (null)', async () => {
      txRepo.findOne.mockResolvedValue({ id: 1, walletId: 2, amount: 200, bookingId: 1, createdByAccountId: 10, balanceAfter: 300 });
      bookingRepo.findOne.mockResolvedValue({
        id: 1,
        venueId: 7,
        date: '2030-12-31',
        timeSlot: '10:00-11:00',
      });
      venueRepo.findOne.mockResolvedValue({ id: 7, cancellationPolicyHours: null });

      const qr = makeQueryRunner();
      (qr.manager.getRepository as jest.Mock).mockReturnValue({
        createQueryBuilder: () => ({
          setLock: jest.fn().mockReturnThis(),
          where: jest.fn().mockReturnThis(),
          getOne: jest.fn().mockResolvedValue({ id: 2, balance: 100 }),
        }),
      });
      dataSource.createQueryRunner.mockReturnValue(qr);

      await service.refundIfWalletPaid(1);

      expect(qr.commitTransaction).toHaveBeenCalled();
    });
  });

  // ── listMemberWallets ─────────────────────────────────────────────

  describe('listMemberWallets', () => {
    it('should return empty array when no wallets exist', async () => {
      walletRepo.find.mockResolvedValue([]);
      const result = await service.listMemberWallets();
      expect(result).toEqual([]);
    });

    it('should return merged wallet + username list', async () => {
      walletRepo.find.mockResolvedValue([
        { accountId: 10, balance: 500 },
        { accountId: 20, balance: 200 },
      ]);
      accountRepo.createQueryBuilder.mockReturnValue({
        setLock: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        getOne: jest.fn(),
        getMany: jest.fn().mockResolvedValue([
          { id: 10, username: 'alice' },
          { id: 20, username: 'bob' },
        ]),
      });

      const result = await service.listMemberWallets();
      expect(result).toEqual([
        { accountId: 10, username: 'alice', balance: 500 },
        { accountId: 20, username: 'bob', balance: 200 },
      ]);
    });
  });
});
