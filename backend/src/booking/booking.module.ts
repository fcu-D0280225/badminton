import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { BookingController } from './booking.controller';
import { BookingService } from './booking.service';
import { BookingParticipantService } from './booking-participant.service';
import { HoldExpiryService } from './hold-expiry.service';
import { Booking } from '../entities/booking.entity';
import { Venue } from '../entities/venue.entity';
import { Organizer } from '../entities/organizer.entity';
import { Player } from '../entities/player.entity';
import { Payment } from '../entities/payment.entity';
import { Account } from '../entities/account.entity';
import { Booker } from '../entities/booker.entity';
import { BookingParticipant } from '../entities/booking-participant.entity';
import { WaitlistModule } from '../waitlist/waitlist.module';
import { PushModule } from '../push/push.module';
import { PricingModule } from '../pricing/pricing.module';
import { WalletModule } from '../wallet/wallet.module';
import { EmailModule } from '../email/email.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    TypeOrmModule.forFeature([
      Booking,
      Venue,
      Organizer,
      Player,
      Payment,
      Account,
      Booker,
      BookingParticipant,
    ]),
    WaitlistModule,
    PushModule,
    PricingModule,
    WalletModule,
    EmailModule,
  ],
  controllers: [BookingController],
  providers: [BookingService, BookingParticipantService, HoldExpiryService],
  exports: [BookingService, BookingParticipantService],
})
export class BookingModule {}
