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
      type: 'mysql',
      host: process.env.MYSQL_HOST || 'localhost',
      port: parseInt(process.env.MYSQL_PORT || '3306', 10),
      username: process.env.MYSQL_USER || 'app_user',
      password: process.env.MYSQL_PASSWORD || 'AppUser@2026!',
      database: process.env.MYSQL_DATABASE || 'badminton',
      entities: [__dirname + '/**/*.entity{.ts,.js}'],
      synchronize: true,
      autoLoadEntities: true,
      charset: 'utf8mb4',
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
