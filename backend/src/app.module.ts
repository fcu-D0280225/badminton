import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { VenueModule } from './venue/venue.module';
import { OrganizerModule } from './organizer/organizer.module';
import { PlayerModule } from './player/player.module';
import { BookingModule } from './booking/booking.module';
import { PaymentModule } from './payment/payment.module';
import { RatingModule } from './rating/rating.module';
import { WaitlistModule } from './waitlist/waitlist.module';
import { PushModule } from './push/push.module';
import { BillingModule } from './billing/billing.module';
import { BookerModule } from './booker/booker.module';

@Module({
  imports: [
    AuthModule,
    TypeOrmModule.forRoot({
      type: 'sqljs',
      location: './database.db',
      autoSave: true,
      entities: [__dirname + '/**/*.entity{.ts,.js}'],
      synchronize: true,
      autoLoadEntities: true,
    }),
    VenueModule,
    OrganizerModule,
    PlayerModule,
    BookingModule,
    PaymentModule,
    RatingModule,
    WaitlistModule,
    PushModule,
    BillingModule,
    BookerModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
