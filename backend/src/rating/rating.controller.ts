import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  ForbiddenException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthUser } from '../auth/types';
import { RatingService } from './rating.service';
import { Rating } from '../entities/rating.entity';

@UseGuards(JwtAuthGuard)
@Controller('api/ratings')
export class RatingController {
  constructor(private readonly ratingService: RatingService) {}

  private assertCanWrite(user: AuthUser): void {
    if (user.role !== 'venue' && user.role !== 'organizer') {
      throw new ForbiddenException('僅館方或團主帳號可新增/修改評分');
    }
  }

  // 建立評分：僅館方或團主
  @Post()
  async createRating(
    @CurrentUser() user: AuthUser,
    @Body() data: Partial<Rating>,
  ): Promise<Rating> {
    this.assertCanWrite(user);
    return await this.ratingService.createRating(data);
  }

  // 取得所有評分：任何已登入使用者
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

  // 更新評分：僅館方或團主
  @Put(':id')
  async updateRating(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() data: Partial<Rating>,
  ): Promise<Rating> {
    this.assertCanWrite(user);
    return await this.ratingService.updateRating(+id, data);
  }

  // 刪除評分：僅館方或團主
  @Delete(':id')
  async deleteRating(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
  ): Promise<void> {
    this.assertCanWrite(user);
    return await this.ratingService.deleteRating(+id);
  }
}
