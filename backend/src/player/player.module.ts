import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PlayerController } from './player.controller';
import { PlayerService } from './player.service';
import { Player } from '../entities/player.entity';
import { Booking } from '../entities/booking.entity';
import { Rating } from '../entities/rating.entity';
import { VenueNote } from '../entities/venue-note.entity';
import { OrganizerNote } from '../entities/organizer-note.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Player,
      Booking,
      Rating,
      VenueNote,
      OrganizerNote,
    ]),
  ],
  controllers: [PlayerController],
  providers: [PlayerService],
  exports: [PlayerService],
})
export class PlayerModule {}
