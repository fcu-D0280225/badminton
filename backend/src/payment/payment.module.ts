import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import Stripe from 'stripe';
import { PaymentController } from './payment.controller';
import { PaymentService } from './payment.service';
import { StripeWebhookController } from './stripe-webhook.controller';
import { Payment } from '../entities/payment.entity';
import { Booking } from '../entities/booking.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Payment, Booking])],
  controllers: [PaymentController, StripeWebhookController],
  providers: [
    {
      provide: 'STRIPE_CLIENT',
      useFactory: () =>
        new Stripe(process.env.STRIPE_SECRET_KEY!, {
          apiVersion: '2026-04-22.dahlia',
        }),
    },
    PaymentService,
  ],
  exports: [PaymentService],
})
export class PaymentModule {}
