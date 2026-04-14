import { Controller, Get, Post, Body, Param } from '@nestjs/common';
import { PlayerService } from './player.service';
import { Player } from '../entities/player.entity';

@Controller('api/players')
export class PlayerController {
  constructor(private readonly playerService: PlayerService) {}

  @Post()
  async createPlayer(@Body() data: Partial<Player>): Promise<Player> {
    return await this.playerService.createPlayer(data);
  }

  @Get()
  async findAll(): Promise<Player[]> {
    return await this.playerService.findAll();
  }

  @Get(':id')
  async findOne(@Param('id') id: string): Promise<Player> {
    return await this.playerService.findOne(+id);
  }

  @Get(':id/booking-history')
  async getBookingHistory(@Param('id') id: string) {
    return await this.playerService.getBookingHistory(+id);
  }

  @Get(':id/credit-score')
  async getCreditScore(@Param('id') id: string) {
    return await this.playerService.getCreditScore(+id);
  }

  @Get(':id/venue-bookings-notes')
  async getVenueBookingsWithNotes(@Param('id') id: string) {
    return await this.playerService.getVenueBookingsWithNotes(+id);
  }

  @Get(':id/organizer-bookings-notes')
  async getOrganizerBookingsWithNotes(@Param('id') id: string) {
    return await this.playerService.getOrganizerBookingsWithNotes(+id);
  }
}
