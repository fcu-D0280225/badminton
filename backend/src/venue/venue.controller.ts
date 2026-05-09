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
  ForbiddenException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthUser } from '../auth/types';
import { getVenueIdsForUser } from '../auth/ownership.helper';
import { VenueService } from './venue.service';
import { Venue } from '../entities/venue.entity';
import { VenueNote } from '../entities/venue-note.entity';

@UseGuards(JwtAuthGuard)
@Controller('api/venues')
export class VenueController {
  constructor(private readonly venueService: VenueService) {}

  private assertVenueRole(user: AuthUser): void {
    if (user.role !== 'venue') {
      throw new ForbiddenException('僅館方帳號可執行此操作');
    }
  }

  private assertOwnsVenue(user: AuthUser, venueId: number): void {
    this.assertVenueRole(user);
    if (!getVenueIdsForUser(user).includes(venueId)) {
      throw new ForbiddenException('無權限存取此場館');
    }
  }

  // 建立場館：僅館方角色
  @Post()
  async createVenue(
    @CurrentUser() user: AuthUser,
    @Body() data: Partial<Venue>,
  ): Promise<Venue> {
    this.assertVenueRole(user);
    return await this.venueService.createVenue(data);
  }

  // 取得所有場館：任何已登入使用者（選館用）
  @Get()
  async findAll(): Promise<Venue[]> {
    return await this.venueService.findAll();
  }

  // 取得單一場館：任何已登入使用者
  @Get(':id')
  async findOne(@Param('id') id: string): Promise<Venue> {
    return await this.venueService.findOne(+id);
  }

  // 更新場館：僅該場館的館方帳號
  @Put(':id')
  async updateVenue(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() data: Partial<Venue>,
  ): Promise<Venue> {
    this.assertOwnsVenue(user, +id);
    return await this.venueService.updateVenue(+id, data);
  }

  // 取得場館預約：僅該場館的館方帳號
  @Get(':id/bookings')
  async getBookings(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Query('date') date?: string,
    @Query('playerName') playerName?: string,
    @Query('timeSlot') timeSlot?: string,
  ) {
    this.assertOwnsVenue(user, +id);
    return await this.venueService.getBookings(+id, {
      date,
      playerName,
      timeSlot,
    });
  }

  // 取得可用時段：任何已登入使用者（預約時選擇）
  @Get(':id/available-time-slots')
  async getAvailableTimeSlots(
    @Param('id') id: string,
    @Query('date') date: string,
  ) {
    return await this.venueService.getAvailableTimeSlots(+id, date);
  }

  // 新增場館備註：僅該場館的館方帳號
  @Post(':id/notes')
  async createNote(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() data: { content: string; visibility?: string },
  ): Promise<VenueNote> {
    this.assertOwnsVenue(user, +id);
    return await this.venueService.createNote(
      +id,
      data.content,
      data.visibility || 'public',
    );
  }

  // 取得場館備註：館方（自己場館）或其他已登入使用者（只看 public）
  @Get(':id/notes')
  async getNotes(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Query('visibility') visibility?: string,
  ): Promise<VenueNote[]> {
    const isOwner = user.role === 'venue' && getVenueIdsForUser(user).includes(+id);
    const effectiveVisibility = isOwner ? visibility : 'public';
    return await this.venueService.getNotes(+id, effectiveVisibility);
  }

  // 更新備註：僅館方（透過 noteId 找場館再驗 ownership）
  @Put('notes/:noteId')
  async updateNote(
    @CurrentUser() user: AuthUser,
    @Param('noteId') noteId: string,
    @Body() data: Partial<VenueNote>,
  ): Promise<VenueNote> {
    this.assertVenueRole(user);
    const note = await this.venueService.getNoteById(+noteId);
    this.assertOwnsVenue(user, note.venueId);
    return await this.venueService.updateNote(+noteId, data);
  }

  // 刪除備註：僅館方
  @Delete('notes/:noteId')
  async deleteNote(
    @CurrentUser() user: AuthUser,
    @Param('noteId') noteId: string,
  ): Promise<void> {
    this.assertVenueRole(user);
    const note = await this.venueService.getNoteById(+noteId);
    this.assertOwnsVenue(user, note.venueId);
    return await this.venueService.deleteNote(+noteId);
  }
}
