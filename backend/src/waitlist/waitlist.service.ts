import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Waitlist } from '../entities/waitlist.entity';
import { AuthUser } from '../auth/types';
import { ownsOrganizer, ownsPlayer } from '../auth/ownership.helper';

@Injectable()
export class WaitlistService {
  constructor(
    @InjectRepository(Waitlist)
    private waitlistRepository: Repository<Waitlist>,
  ) {}

  // 加入候補名單
  async joinWaitlist(
    data: {
      venueId: number;
      date: string;
      timeSlot: string;
      playerId?: number;
      organizerId?: number;
    },
    user?: AuthUser,
  ): Promise<Waitlist> {
    if (user) this.assertJoinAllowed(data, user);
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

  // 查詢某時段的候補名單（venue 必須是該場地擁有者）
  async getWaitlist(
    venueId: number,
    date: string,
    timeSlot: string,
    user?: AuthUser,
  ): Promise<Waitlist[]> {
    if (user) {
      // 只有 venue 看得到該場次完整候補名單
      if (user.role !== 'venue' || user.entityId !== venueId) {
        throw new NotFoundException('找不到候補名單');
      }
    }
    return await this.waitlistRepository.find({
      where: { venueId, date, timeSlot, status: 'waiting' },
      order: { position: 'ASC' },
    });
  }

  // 查詢特定臨打的所有候補
  async getByPlayer(playerId: number, user?: AuthUser): Promise<Waitlist[]> {
    if (user && !ownsPlayer(user, playerId)) {
      throw new NotFoundException(`臨打 #${playerId} 不存在`);
    }
    return await this.waitlistRepository.find({
      where: { playerId },
      order: { createdAt: 'DESC' },
    });
  }

  // 查詢特定團主的所有候補
  async getByOrganizer(organizerId: number, user?: AuthUser): Promise<Waitlist[]> {
    if (user && !ownsOrganizer(user, organizerId)) {
      throw new NotFoundException(`團主 #${organizerId} 不存在`);
    }
    return await this.waitlistRepository.find({
      where: { organizerId },
      order: { createdAt: 'DESC' },
    });
  }

  // 離開候補名單
  async leaveWaitlist(id: number, user?: AuthUser): Promise<void> {
    if (user) {
      const entry = await this.waitlistRepository.findOne({ where: { id } });
      if (!entry) throw new NotFoundException(`候補 #${id} 不存在`);
      const okPlayer = entry.playerId != null && ownsPlayer(user, entry.playerId);
      const okOrg = entry.organizerId != null && ownsOrganizer(user, entry.organizerId);
      const okVenue = user.role === 'venue' && user.entityId === entry.venueId;
      if (!okPlayer && !okOrg && !okVenue) {
        throw new NotFoundException(`候補 #${id} 不存在`);
      }
    }
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

  // ── 私有：加入候補時禁止偽造他人身分 ───────────────────────────
  private assertJoinAllowed(
    data: { playerId?: number; organizerId?: number },
    user: AuthUser,
  ): void {
    switch (user.role) {
      case 'player':
        if (data.playerId !== user.entityId) {
          throw new ForbiddenException('只能以自己的身分加入候補');
        }
        return;
      case 'organizer':
        if (data.organizerId !== user.entityId) {
          throw new ForbiddenException('只能以自己的身分加入候補');
        }
        return;
      case 'member': {
        const okPlayer =
          user.linkedEntityId != null && data.playerId === user.linkedEntityId;
        const okOrg = data.organizerId === user.entityId;
        if (!okPlayer && !okOrg) {
          throw new ForbiddenException('只能以自己的身分加入候補');
        }
        return;
      }
      case 'venue':
      case 'booker':
        // venue 不會為自己候補；booker 走 booking flow
        throw new ForbiddenException('此角色無法加入候補');
      default:
        throw new ForbiddenException('未知的角色');
    }
  }
}
