import {
  BadRequestException,
  Controller,
  Headers,
  Inject,
  Post,
  Req,
} from '@nestjs/common';
import { RawBodyRequest } from '@nestjs/common';
import Stripe from 'stripe';
import { PaymentService } from './payment.service';

@Controller('stripe')
export class StripeWebhookController {
  constructor(
    @Inject('STRIPE_CLIENT') private readonly stripe: InstanceType<typeof Stripe>,
    private readonly paymentService: PaymentService,
  ) {}

  @Post('webhook')
  async handleWebhook(
    @Headers('stripe-signature') sig: string,
    @Req() req: RawBodyRequest<Request>,
  ): Promise<void> {
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
      const paymentId = Number(session.metadata?.paymentId);
      const txnId = session.payment_intent as string;
      await this.paymentService.markAsPaidByGateway(paymentId, txnId);
    }

    if (event.type === 'checkout.session.expired') {
      const session = event.data.object as any;
      const paymentId = Number(session.metadata?.paymentId);
      await this.paymentService.markAsFailedByGateway(paymentId);
    }
  }
}
