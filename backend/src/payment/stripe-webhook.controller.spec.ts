import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { StripeWebhookController } from './stripe-webhook.controller';
import { PaymentService } from './payment.service';
import { WalletService } from '../wallet/wallet.service';

const mockStripe = {
  webhooks: {
    constructEvent: jest.fn(),
  },
};

const mockPaymentService = {
  markAsPaidByGateway: jest.fn(),
  markAsFailedByGateway: jest.fn(),
};

const mockWalletService = {
  processStripeTopup: jest.fn(),
};

describe('StripeWebhookController', () => {
  let controller: StripeWebhookController;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [StripeWebhookController],
      providers: [
        { provide: 'STRIPE_CLIENT', useValue: mockStripe },
        { provide: PaymentService, useValue: mockPaymentService },
        { provide: WalletService, useValue: mockWalletService },
      ],
    }).compile();

    controller = module.get<StripeWebhookController>(StripeWebhookController);
  });

  it('T7 — 無效簽章回 400 BadRequestException', async () => {
    mockStripe.webhooks.constructEvent.mockImplementation(() => {
      throw new Error('Signature mismatch');
    });

    const req = { rawBody: Buffer.from('{}') } as any;

    await expect(
      controller.handleWebhook('bad_sig', req),
    ).rejects.toThrow(BadRequestException);
  });

  it('T8 — checkout.session.completed 呼叫 markAsPaidByGateway', async () => {
    const fakeEvent = {
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_test_abc',
          metadata: { paymentId: '42' },
          payment_intent: 'pi_test_abc',
        },
      },
    };
    mockStripe.webhooks.constructEvent.mockReturnValue(fakeEvent);
    mockPaymentService.markAsPaidByGateway.mockResolvedValue(undefined);

    const req = { rawBody: Buffer.from(JSON.stringify(fakeEvent)) } as any;

    await controller.handleWebhook('valid_sig', req);

    expect(mockPaymentService.markAsPaidByGateway).toHaveBeenCalledWith(42, 'pi_test_abc');
  });

  it('T9 — checkout.session.completed 呼叫 processStripeTopup（錢包儲值）', async () => {
    const fakeEvent = {
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_wallet_xyz',
          metadata: { walletTopupAccountId: '10', walletTopupAmount: '500' },
          payment_intent: 'pi_test_xyz',
        },
      },
    };
    mockStripe.webhooks.constructEvent.mockReturnValue(fakeEvent);
    mockWalletService.processStripeTopup.mockResolvedValue(undefined);

    const req = { rawBody: Buffer.from(JSON.stringify(fakeEvent)) } as any;

    await controller.handleWebhook('valid_sig', req);

    expect(mockWalletService.processStripeTopup).toHaveBeenCalledWith(10, 500, 'cs_wallet_xyz');
    expect(mockPaymentService.markAsPaidByGateway).not.toHaveBeenCalled();
  });

  it('T10 — checkout.session.expired 略過錢包充值 session', async () => {
    const fakeEvent = {
      type: 'checkout.session.expired',
      data: {
        object: {
          id: 'cs_wallet_xyz',
          metadata: { walletTopupAccountId: '10', walletTopupAmount: '500' },
        },
      },
    };
    mockStripe.webhooks.constructEvent.mockReturnValue(fakeEvent);

    const req = { rawBody: Buffer.from(JSON.stringify(fakeEvent)) } as any;

    await controller.handleWebhook('valid_sig', req);

    expect(mockPaymentService.markAsFailedByGateway).not.toHaveBeenCalled();
  });
});
