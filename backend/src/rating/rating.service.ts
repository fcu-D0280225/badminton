import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Rating } from '../entities/rating.entity';

@Injectable()
export class RatingService {
  constructor(
    @InjectRepository(Rating)
    private ratingRepository: Repository<Rating>,
  ) {}

  // 建立評分
  async createRating(data: Partial<Rating>): Promise<Rating> {
    // 驗證分數範圍
    if (data.score < 1 || data.score > 5) {
      throw new Error('評分必須在 1-5 之間');
    }

    const rating = this.ratingRepository.create(data);
    return await this.ratingRepository.save(rating);
  }

  // 取得所有評分
  async findAll(): Promise<Rating[]> {
    return await this.ratingRepository.find({
      relations: ['player', 'venue', 'organizer'],
    });
  }

  // 取得單一評分
  async findOne(id: number): Promise<Rating> {
    return await this.ratingRepository.findOne({
      where: { id },
      relations: ['player', 'venue', 'organizer'],
    });
  }

  // 取得臨打對館方的評分
  async getVenueRatings(venueId: number): Promise<Rating[]> {
    return await this.ratingRepository.find({
      where: { venueId },
      relations: ['player'],
      order: { createdAt: 'DESC' },
    });
  }

  // 取得臨打對團主的評分
  async getOrganizerRatings(organizerId: number): Promise<Rating[]> {
    return await this.ratingRepository.find({
      where: { organizerId },
      relations: ['player'],
      order: { createdAt: 'DESC' },
    });
  }

  // 取得臨打的評分紀錄
  async getPlayerRatings(playerId: number): Promise<Rating[]> {
    return await this.ratingRepository.find({
      where: { playerId },
      relations: ['venue', 'organizer'],
      order: { createdAt: 'DESC' },
    });
  }

  // 更新評分
  async updateRating(id: number, data: Partial<Rating>): Promise<Rating> {
    if (data.score && (data.score < 1 || data.score > 5)) {
      throw new Error('評分必須在 1-5 之間');
    }

    await this.ratingRepository.update(id, data);
    return await this.findOne(id);
  }

  // 刪除評分
  async deleteRating(id: number): Promise<void> {
    await this.ratingRepository.delete(id);
  }

  // 取得平均評分
  async getAverageRating(
    venueId?: number,
    organizerId?: number,
  ): Promise<number> {
    const query = this.ratingRepository.createQueryBuilder('rating');

    if (venueId) {
      query.where('rating.venueId = :venueId', { venueId });
    } else if (organizerId) {
      query.where('rating.organizerId = :organizerId', { organizerId });
    }

    const result = await query.select('AVG(rating.score)', 'avg').getRawOne();

    if (result?.avg != null) {
      return parseFloat(parseFloat(result.avg).toFixed(2));
    }
    return 0;
  }
}
