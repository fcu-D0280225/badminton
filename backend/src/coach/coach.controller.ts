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
import { EnrollmentService } from './enrollment.service';
import { Coach } from '../entities/coach.entity';
import { CoachClass } from '../entities/coach-class.entity';

@ApiTags('coach')
@ApiBearerAuth('jwt')
@UseGuards(JwtAuthGuard)
@Controller('api')
export class CoachController {
  constructor(
    private readonly coachService: CoachService,
    private readonly enrollmentService: EnrollmentService,
  ) {}

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

  // ── Coach Class Enrollments ─────────────────────────────────────
  @ApiOperation({ summary: '列出某教練課的所有學員報名（含 cancelled）' })
  @Get('coach-classes/:id/enrollments')
  async listEnrollments(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) classId: number,
  ) {
    return this.enrollmentService.listByClass(
      classId,
      this.assertVenue(user),
    );
  }

  @ApiOperation({ summary: '替某學員報名某教練課' })
  @Post('coach-classes/:id/enrollments')
  async createEnrollment(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) classId: number,
    @Body() data: { playerId: number; amount?: number; notes?: string },
  ) {
    return this.enrollmentService.enroll(
      classId,
      data.playerId,
      this.assertVenue(user),
      { amount: data.amount, notes: data.notes },
    );
  }

  @ApiOperation({ summary: '取消學員報名（保留 row 做 audit）' })
  @Delete('enrollments/:enrollmentId')
  async cancelEnrollment(
    @CurrentUser() user: AuthUser,
    @Param('enrollmentId', ParseIntPipe) enrollmentId: number,
  ) {
    return this.enrollmentService.cancel(
      enrollmentId,
      this.assertVenue(user),
    );
  }

  @ApiOperation({ summary: '學員報到（標記 checkedInAt = now）' })
  @Post('enrollments/:enrollmentId/checkin')
  async checkinEnrollment(
    @CurrentUser() user: AuthUser,
    @Param('enrollmentId', ParseIntPipe) enrollmentId: number,
  ) {
    return this.enrollmentService.checkin(
      enrollmentId,
      this.assertVenue(user),
    );
  }

  @ApiOperation({ summary: '取消學員報到（誤點救援）' })
  @Post('enrollments/:enrollmentId/checkin/undo')
  async undoCheckinEnrollment(
    @CurrentUser() user: AuthUser,
    @Param('enrollmentId', ParseIntPipe) enrollmentId: number,
  ) {
    return this.enrollmentService.undoCheckin(
      enrollmentId,
      this.assertVenue(user),
    );
  }

  @ApiOperation({ summary: '更新學員付款狀態（含可選的金額覆寫）' })
  @Patch('enrollments/:enrollmentId/payment')
  async updateEnrollmentPayment(
    @CurrentUser() user: AuthUser,
    @Param('enrollmentId', ParseIntPipe) enrollmentId: number,
    @Body() data: { paymentStatus: 'pending' | 'paid' | 'refunded'; amount?: number },
  ) {
    return this.enrollmentService.updatePayment(
      enrollmentId,
      this.assertVenue(user),
      data.paymentStatus,
      data.amount,
    );
  }

  @ApiOperation({ summary: '取得目前登入學員（player/member）的報名清單' })
  @Get('me/enrollments')
  async listMyEnrollments(@CurrentUser() user: AuthUser) {
    let playerId: number | undefined;
    if (user.role === 'player') {
      playerId = user.entityId;
    } else if (user.role === 'member' && user.linkedEntityId) {
      playerId = user.linkedEntityId;
    }
    if (!playerId) {
      throw new ForbiddenException('僅學員 / 已綁定 player 的會員可使用');
    }
    return this.enrollmentService.listByPlayer(playerId);
  }
}
