import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
} from '@nestjs/common';
import { RatingService } from './rating.service';
import { Rating } from '../entities/rating.entity';

@Controller('api/ratings')
export class RatingController {
  constructor(private readonly ratingService: RatingService) {}

  @Post()
  async createRating(@Body() data: Partial<Rating>): Promise<Rating> {
    return await this.ratingService.createRating(data);
  }

  @Get()
  async findAll(): Promise<Rating[]> {
    return await this.ratingService.findAll();
  }

  @Get(':id')
  async findOne(@Param('id') id: string): Promise<Rating> {
    return await this.ratingService.findOne(+id);
  }

  @Get('venue/:venueId')
  async getVenueRatings(@Param('venueId') venueId: string): Promise<Rating[]> {
    return await this.ratingService.getVenueRatings(+venueId);
  }

  @Get('organizer/:organizerId')
  async getOrganizerRatings(
    @Param('organizerId') organizerId: string,
  ): Promise<Rating[]> {
    return await this.ratingService.getOrganizerRatings(+organizerId);
  }

  @Get('player/:playerId')
  async getPlayerRatings(
    @Param('playerId') playerId: string,
  ): Promise<Rating[]> {
    return await this.ratingService.getPlayerRatings(+playerId);
  }

  @Get('average/venue/:venueId')
  async getVenueAverageRating(
    @Param('venueId') venueId: string,
  ): Promise<number> {
    return await this.ratingService.getAverageRating(+venueId, null);
  }

  @Get('average/organizer/:organizerId')
  async getOrganizerAverageRating(
    @Param('organizerId') organizerId: string,
  ): Promise<number> {
    return await this.ratingService.getAverageRating(null, +organizerId);
  }

  @Put(':id')
  async updateRating(
    @Param('id') id: string,
    @Body() data: Partial<Rating>,
  ): Promise<Rating> {
    return await this.ratingService.updateRating(+id, data);
  }

  @Delete(':id')
  async deleteRating(@Param('id') id: string): Promise<void> {
    return await this.ratingService.deleteRating(+id);
  }
}
