import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Waitlist } from '../entities/waitlist.entity';

@Injectable()
export class WaitlistService {
  constructor(
    @InjectRepository(Waitlist)
    private waitlistRepository: Repository<Waitlist>,
  ) {}

  // 加入候補名單
  async joinWaitlist(data: {
    venueId: number;
    date: string;
    timeSlot: string;
    playerId?: number;
    organizerId?: number;
  }): Promise<Waitlist> {
    // 計算候補順位
    const count = await this.waitlistRepository.count({
      where: {
        venueId: data.venueId,
        date: data.date,
        timeSlot: data.timeSlot,
        status: 'waiting',
      },
    });

    const entry = this.waitlistRepository.create({
      ...data,
      status: 'waiting',
      position: count + 1,
    });
    return await this.waitlistRepository.save(entry);
  }

  // 查詢某時段的候補名單
  async getWaitlist(
    venueId: number,
    date: string,
    timeSlot: string,
  ): Promise<Waitlist[]> {
    return await this.waitlistRepository.find({
      where: { venueId, date, timeSlot, status: 'waiting' },
      order: { position: 'ASC' },
    });
  }

  // 查詢特定臨打的所有候補
  async getByPlayer(playerId: number): Promise<Waitlist[]> {
    return await this.waitlistRepository.find({
      where: { playerId },
      order: { createdAt: 'DESC' },
    });
  }

  // 查詢特定團主的所有候補
  async getByOrganizer(organizerId: number): Promise<Waitlist[]> {
    return await this.waitlistRepository.find({
      where: { organizerId },
      order: { createdAt: 'DESC' },
    });
  }

  // 離開候補名單
  async leaveWaitlist(id: number): Promise<void> {
    await this.waitlistRepository.delete(id);
  }

  // 取得第一位候補（供取消預約時觸發用）
  async getFirstWaiting(
    venueId: number,
    date: string,
    timeSlot: string,
  ): Promise<Waitlist | null> {
    return await this.waitlistRepository.findOne({
      where: { venueId, date, timeSlot, status: 'waiting' },
      order: { position: 'ASC' },
    });
  }

  // 標記為已通知
  async markNotified(id: number): Promise<void> {
    await this.waitlistRepository.update(id, { status: 'notified' });
  }

  // 標記為已確認（候補者成功預約後）
  async markConfirmed(id: number): Promise<void> {
    await this.waitlistRepository.update(id, { status: 'confirmed' });
  }
}
