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
import { OrganizerService } from './organizer.service';
import { Organizer } from '../entities/organizer.entity';
import { OrganizerNote } from '../entities/organizer-note.entity';

@UseGuards(JwtAuthGuard)
@Controller('api/organizers')
export class OrganizerController {
  constructor(private readonly organizerService: OrganizerService) {}

  @Post()
  async createOrganizer(@Body() data: Partial<Organizer>): Promise<Organizer> {
    return await this.organizerService.createOrganizer(data);
  }

  @Get()
  async findAll(): Promise<Organizer[]> {
    return await this.organizerService.findAll();
  }

  @Get(':id')
  async findOne(@Param('id') id: string): Promise<Organizer> {
    return await this.organizerService.findOne(+id);
  }

  @Get(':id/bookings')
  async getBookings(@Param('id') id: string) {
    return await this.organizerService.getBookings(+id);
  }

  @Get(':id/players')
  async getPlayers(@Param('id') id: string) {
    return await this.organizerService.getPlayers(+id);
  }

  @Get(':id/player-bookings')
  async getPlayerBookings(@Param('id') id: string) {
    return await this.organizerService.getPlayerBookings(+id);
  }

  @Post(':id/notes')
  async createNote(
    @Param('id') id: string,
    @Body() data: { content: string; visibility?: string },
  ): Promise<OrganizerNote> {
    return await this.organizerService.createNote(
      +id,
      data.content,
      data.visibility || 'public',
    );
  }

  @Get(':id/notes')
  async getNotes(
    @Param('id') id: string,
    @Query('visibility') visibility?: string,
  ): Promise<OrganizerNote[]> {
    return await this.organizerService.getNotes(+id, visibility);
  }

  @Put('notes/:noteId')
  async updateNote(
    @Param('noteId') noteId: string,
    @Body() data: Partial<OrganizerNote>,
  ): Promise<OrganizerNote> {
    return await this.organizerService.updateNote(+noteId, data);
  }

  @Delete('notes/:noteId')
  async deleteNote(@Param('noteId') noteId: string): Promise<void> {
    return await this.organizerService.deleteNote(+noteId);
  }
}
