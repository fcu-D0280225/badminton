import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import Stripe from 'stripe';
import { MemberWallet } from '../entities/member-wallet.entity';
import { WalletTransaction } from '../entities/wallet-transaction.entity';
import { Booking } from '../entities/booking.entity';
import { Payment } from '../entities/payment.entity';
import { Venue } from '../entities/venue.entity';
import { Account } from '../entities/account.entity';
import { WalletService } from './wallet.service';
import { WalletController } from './wallet.controller';
import { VenueWalletController } from './venue-wallet.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      MemberWallet,
      WalletTransaction,
      Booking,
      Payment,
      Venue,
      Account,
    ]),
  ],
  controllers: [WalletController, VenueWalletController],
  providers: [
    {
      provide: 'STRIPE_CLIENT',
      useFactory: () =>
        new Stripe(process.env.STRIPE_SECRET_KEY!, {
          apiVersion: '2026-04-22.dahlia',
        }),
    },
    WalletService,
  ],
  exports: [WalletService],
})
export class WalletModule {}
