import {
  BadRequestException,
  Controller,
  Headers,
  Inject,
  Post,
  Req,
  ServiceUnavailableException,
} from '@nestjs/common';
import { RawBodyRequest } from '@nestjs/common';
import Stripe from 'stripe';
import { PaymentService } from './payment.service';
import { WalletService } from '../wallet/wallet.service';

@Controller('stripe')
export class StripeWebhookController {
  constructor(
    @Inject('STRIPE_CLIENT') private readonly stripe: InstanceType<typeof Stripe> | null,
    private readonly paymentService: PaymentService,
    private readonly walletService: WalletService,
  ) {}

  @Post('webhook')
  async handleWebhook(
    @Headers('stripe-signature') sig: string,
    @Req() req: RawBodyRequest<Request>,
  ): Promise<void> {
    if (!this.stripe) {
      throw new ServiceUnavailableException('線上付款功能未啟用');
    }
    let event: any;
    try {
      event = this.stripe.webhooks.constructEvent(
        req.rawBody!,
        sig,
        process.env.STRIPE_WEBHOOK_SECRET!,
      );
    } catch {
      throw new BadRequestException('Invalid webhook signature');
    }

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as any;

      // 錢包線上充值
      if (session.metadata?.walletTopupAccountId) {
        const accountId = Number(session.metadata.walletTopupAccountId);
        const amount = Number(session.metadata.walletTopupAmount);
        await this.walletService.processStripeTopup(
          accountId,
          amount,
          session.id,
        );
      } else {
        // 一般預約付款
        const paymentId = Number(session.metadata?.paymentId);
        const txnId = session.payment_intent as string;
        await this.paymentService.markAsPaidByGateway(paymentId, txnId);
      }
    }

    if (event.type === 'checkout.session.expired') {
      const session = event.data.object as any;
      // 錢包充值 session 過期不需特殊處理（無狀態機）
      if (!session.metadata?.walletTopupAccountId) {
        const paymentId = Number(session.metadata?.paymentId);
        await this.paymentService.markAsFailedByGateway(paymentId);
      }
    }
  }
}
