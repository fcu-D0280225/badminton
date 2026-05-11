import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { WalletController } from './wallet.controller';
import { WalletService } from './wallet.service';

const mockWalletService = {
  getWallet: jest.fn(),
  payBooking: jest.fn(),
};

const memberUser = { id: 10, role: 'member', entityId: 3, linkedEntityId: 5, username: 'm' };
const venueUser = { id: 1, role: 'venue', entityId: 7, venueIds: [7], username: 'v' };

describe('WalletController', () => {
  let controller: WalletController;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [WalletController],
      providers: [{ provide: WalletService, useValue: mockWalletService }],
    }).compile();

    controller = module.get<WalletController>(WalletController);
  });

  describe('GET /api/wallet', () => {
    it('should return wallet data for member user', async () => {
      const mockData = { wallet: { balance: 500 }, transactions: [] };
      mockWalletService.getWallet.mockResolvedValue(mockData);

      const result = await controller.getMyWallet(memberUser as any);

      expect(mockWalletService.getWallet).toHaveBeenCalledWith(memberUser.id);
      expect(result).toEqual(mockData);
    });

    it('should throw ForbiddenException for non-member user', async () => {
      await expect(
        controller.getMyWallet(venueUser as any),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('POST /api/wallet/pay-booking/:bookingId', () => {
    it('should call payBooking for member user', async () => {
      const mockWallet = { id: 1, balance: 300 };
      mockWalletService.payBooking.mockResolvedValue(mockWallet);

      const result = await controller.payBooking('42', memberUser as any);

      expect(mockWalletService.payBooking).toHaveBeenCalledWith(42, memberUser);
      expect(result).toEqual(mockWallet);
    });

    it('should throw ForbiddenException for non-member user', async () => {
      await expect(
        controller.payBooking('42', venueUser as any),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});
