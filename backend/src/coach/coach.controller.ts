import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  ForbiddenException,
  ParseIntPipe,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthUser } from '../auth/types';
import { getVenueIdsForUser } from '../auth/ownership.helper';
import { CoachService } from './coach.service';
import { Coach } from '../entities/coach.entity';
import { CoachClass } from '../entities/coach-class.entity';

@ApiTags('coach')
@ApiBearerAuth('jwt')
@UseGuards(JwtAuthGuard)
@Controller('api')
export class CoachController {
  constructor(private readonly coachService: CoachService) {}

  private assertVenue(user: AuthUser): number[] {
    if (user.role !== 'venue') {
      throw new ForbiddenException('僅館方帳號可管理教練');
    }
    return getVenueIdsForUser(user);
  }

  // 寫入時必指定一個 venueId（默認 entityId 主場館）
  private resolveSingleVenue(user: AuthUser, raw?: string): number {
    const ids = this.assertVenue(user);
    if (!raw) return user.entityId;
    const venueId = parseInt(raw, 10);
    if (Number.isNaN(venueId) || !ids.includes(venueId)) {
      throw new ForbiddenException('無權限存取此場館');
    }
    return venueId;
  }

  // ── Coaches ─────────────────────────────────────────────────────
  @ApiOperation({ summary: '列出館方可見的所有教練' })
  @Get('coaches')
  async listCoaches(@CurrentUser() user: AuthUser) {
    return this.coachService.listCoaches(this.assertVenue(user));
  }

  @Get('coaches/:id')
  async getCoach(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.coachService.getCoach(id, this.assertVenue(user));
  }

  @Post('coaches')
  async createCoach(
    @CurrentUser() user: AuthUser,
    @Body() data: Partial<Coach>,
    @Query('venueId') venueIdRaw?: string,
  ) {
    return this.coachService.createCoach(
      this.resolveSingleVenue(user, venueIdRaw),
      data,
    );
  }

  @Patch('coaches/:id')
  async updateCoach(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() data: Partial<Coach>,
  ) {
    return this.coachService.updateCoach(id, this.assertVenue(user), data);
  }

  @Delete('coaches/:id')
  async deleteCoach(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
  ) {
    await this.coachService.deleteCoach(id, this.assertVenue(user));
    return { success: true };
  }

  // ── Coach Classes ───────────────────────────────────────────────
  @ApiOperation({ summary: '列出教練排課（支援 coachId / from / to 過濾）' })
  @Get('coach-classes')
  async listClasses(
    @CurrentUser() user: AuthUser,
    @Query('coachId') coachIdRaw?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.coachService.listClasses(this.assertVenue(user), {
      coachId: coachIdRaw ? parseInt(coachIdRaw, 10) : undefined,
      from,
      to,
    });
  }

  @Get('coach-classes/:id')
  async getClass(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.coachService.getClass(id, this.assertVenue(user));
  }

  @Post('coach-classes')
  async createClass(
    @CurrentUser() user: AuthUser,
    @Body() data: Partial<CoachClass>,
    @Query('venueId') venueIdRaw?: string,
  ) {
    return this.coachService.createClass(
      this.resolveSingleVenue(user, venueIdRaw),
      data,
    );
  }

  @Patch('coach-classes/:id')
  async updateClass(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() data: Partial<CoachClass>,
  ) {
    return this.coachService.updateClass(id, this.assertVenue(user), data);
  }

  @Delete('coach-classes/:id')
  async deleteClass(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
  ) {
    await this.coachService.deleteClass(id, this.assertVenue(user));
    return { success: true };
  }
}
