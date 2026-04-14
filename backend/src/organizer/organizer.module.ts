import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrganizerController } from './organizer.controller';
import { OrganizerService } from './organizer.service';
import { Organizer } from '../entities/organizer.entity';
import { Booking } from '../entities/booking.entity';
import { Venue } from '../entities/venue.entity';
import { Player } from '../entities/player.entity';
import { OrganizerNote } from '../entities/organizer-note.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Organizer,
      Booking,
      Venue,
      Player,
      OrganizerNote,
    ]),
  ],
  controllers: [OrganizerController],
  providers: [OrganizerService],
  exports: [OrganizerService],
})
export class OrganizerModule {}
