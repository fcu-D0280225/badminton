import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthUser } from '../auth/types';
import { PlayerService } from './player.service';
import { Player } from '../entities/player.entity';

@UseGuards(JwtAuthGuard)
@Controller('api/players')
export class PlayerController {
  constructor(private readonly playerService: PlayerService) {}

  @Post()
  async createPlayer(
    @CurrentUser() user: AuthUser,
    @Body() data: Partial<Player>,
  ): Promise<Player> {
    return await this.playerService.createPlayer(data, user);
  }

  @Get()
  async findAll(@CurrentUser() user: AuthUser): Promise<Player[]> {
    return await this.playerService.findAll(user);
  }

  @Get(':id')
  async findOne(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
  ): Promise<Player> {
    return await this.playerService.findOne(+id, user);
  }

  @Get(':id/booking-history')
  async getBookingHistory(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
  ) {
    return await this.playerService.getBookingHistory(+id, user);
  }

  @Get(':id/credit-score')
  async getCreditScore(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return await this.playerService.getCreditScore(+id, user);
  }

  @Get(':id/venue-bookings-notes')
  async getVenueBookingsWithNotes(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
  ) {
    return await this.playerService.getVenueBookingsWithNotes(+id, user);
  }

  @Get(':id/organizer-bookings-notes')
  async getOrganizerBookingsWithNotes(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
  ) {
    return await this.playerService.getOrganizerBookingsWithNotes(+id, user);
  }
}
