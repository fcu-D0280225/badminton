import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
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
import { PricingModule } from './pricing/pricing.module';
import { CoachModule } from './coach/coach.module';
import { WalletModule } from './wallet/wallet.module';
import { EmailModule } from './email/email.module';
import { ApiKeysModule } from './api-keys/api-keys.module';

@Module({
  imports: [
    // 全域限流：預設 60 次/分鐘，登入端點在 auth.controller.ts 覆寫為 5 次/分鐘
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 60 }]),
    AuthModule,
    TypeOrmModule.forRoot({
      type: 'mysql',
      host: process.env.MYSQL_HOST || 'localhost',
      port: parseInt(process.env.MYSQL_PORT || '3306', 10),
      username: process.env.MYSQL_USER || 'app_user',
      password: process.env.MYSQL_PASSWORD,
      database: process.env.MYSQL_DATABASE || 'badminton',
      entities: [__dirname + '/**/*.entity{.ts,.js}'],
      migrations: [__dirname + '/migrations/*{.ts,.js}'],
      // 預設 OFF — 防 production 自動 DROP 欄位。dev 用 TYPEORM_SYNC=true 開啟。
      synchronize: process.env.TYPEORM_SYNC === 'true',
      // production 啟動時自動 apply pending migrations
      migrationsRun: process.env.TYPEORM_MIGRATIONS_RUN !== 'false',
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
    PricingModule,
    CoachModule,
    WalletModule,
    EmailModule,
    ApiKeysModule,
  ],
  controllers: [AppController],
  providers: [AppService, { provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
