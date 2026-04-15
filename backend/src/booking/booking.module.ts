import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BookingController } from './booking.controller';
import { BookingService } from './booking.service';
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

@Module({
  imports: [
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
  ],
  controllers: [BookingController],
  providers: [BookingService],
  exports: [BookingService],
})
export class BookingModule {}
