import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BookerController } from './booker.controller';
import { BookerService } from './booker.service';
import { Booker } from '../entities/booker.entity';
import { BookingModule } from '../booking/booking.module';

@Module({
  imports: [TypeOrmModule.forFeature([Booker]), BookingModule],
  controllers: [BookerController],
  providers: [BookerService],
  exports: [BookerService],
})
export class BookerModule {}
