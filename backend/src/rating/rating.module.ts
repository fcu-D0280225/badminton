import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RatingController } from './rating.controller';
import { RatingService } from './rating.service';
import { Rating } from '../entities/rating.entity';
import { Player } from '../entities/player.entity';
import { Venue } from '../entities/venue.entity';
import { Organizer } from '../entities/organizer.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Rating, Player, Venue, Organizer])],
  controllers: [RatingController],
  providers: [RatingService],
  exports: [RatingService],
})
export class RatingModule {}
