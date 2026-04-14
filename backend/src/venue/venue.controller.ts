import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { VenueService } from './venue.service';
import { Venue } from '../entities/venue.entity';
import { VenueNote } from '../entities/venue-note.entity';

@UseGuards(JwtAuthGuard)
@Controller('api/venues')
export class VenueController {
  constructor(private readonly venueService: VenueService) {}

  @Post()
  async createVenue(@Body() data: Partial<Venue>): Promise<Venue> {
    return await this.venueService.createVenue(data);
  }

  @Get()
  async findAll(): Promise<Venue[]> {
    return await this.venueService.findAll();
  }

  @Get(':id')
  async findOne(@Param('id') id: string): Promise<Venue> {
    return await this.venueService.findOne(+id);
  }

  @Get(':id/bookings')
  async getBookings(
    @Param('id') id: string,
    @Query('date') date?: string,
    @Query('playerName') playerName?: string,
    @Query('timeSlot') timeSlot?: string,
  ) {
    return await this.venueService.getBookings(+id, {
      date,
      playerName,
      timeSlot,
    });
  }

  @Get(':id/available-time-slots')
  async getAvailableTimeSlots(
    @Param('id') id: string,
    @Query('date') date: string,
  ) {
    return await this.venueService.getAvailableTimeSlots(+id, date);
  }

  @Post(':id/notes')
  async createNote(
    @Param('id') id: string,
    @Body() data: { content: string; visibility?: string },
  ): Promise<VenueNote> {
    return await this.venueService.createNote(
      +id,
      data.content,
      data.visibility || 'public',
    );
  }

  @Get(':id/notes')
  async getNotes(
    @Param('id') id: string,
    @Query('visibility') visibility?: string,
  ): Promise<VenueNote[]> {
    return await this.venueService.getNotes(+id, visibility);
  }

  @Put('notes/:noteId')
  async updateNote(
    @Param('noteId') noteId: string,
    @Body() data: Partial<VenueNote>,
  ): Promise<VenueNote> {
    return await this.venueService.updateNote(+noteId, data);
  }

  @Delete('notes/:noteId')
  async deleteNote(@Param('noteId') noteId: string): Promise<void> {
    return await this.venueService.deleteNote(+noteId);
  }
}
