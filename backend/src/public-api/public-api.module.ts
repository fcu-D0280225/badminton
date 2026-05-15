import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ApiKeysModule } from '../api-keys/api-keys.module';
import { VenueModule } from '../venue/venue.module';
import { BookingModule } from '../booking/booking.module';
import { Venue } from '../entities/venue.entity';
import { PublicApiController } from './public-api.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([Venue]),
    ApiKeysModule,
    VenueModule,
    BookingModule,
  ],
  controllers: [PublicApiController],
})
export class PublicApiModule {}
