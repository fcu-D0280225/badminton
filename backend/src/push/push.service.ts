import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import * as webpush from 'web-push';
import { PushSubscriptionEntity } from '../entities/push-subscription.entity';
import { Waitlist } from '../entities/waitlist.entity';

const VAPID_FILE = './vapid-keys.json';

@Injectable()
export class PushService implements OnModuleInit {
  private readonly logger = new Logger(PushService.name);
  private vapidPublicKey: string;

  constructor(
    @InjectRepository(PushSubscriptionEntity)
    private subRepository: Repository<PushSubscriptionEntity>,
  ) {}

  onModuleInit() {
    let keys: { publicKey: string; privateKey: string };

    if (existsSync(VAPID_FILE)) {
      keys = JSON.parse(readFileSync(VAPID_FILE, 'utf-8'));
    } else {
      keys = webpush.generateVAPIDKeys();
      writeFileSync(VAPID_FILE, JSON.stringify(keys, null, 2));
      this.logger.log(`已產生 VAPID 金鑰，儲存於 ${VAPID_FILE}`);
    }

    this.vapidPublicKey = keys.publicKey;
    webpush.setVapidDetails(
      'mailto:admin@badminton.local',
      keys.publicKey,
      keys.privateKey,
    );
    this.logger.log('Web Push 初始化完成');
  }

  getVapidPublicKey(): string {
    return this.vapidPublicKey;
  }

  // 儲存訂閱（同一 endpoint 更新，避免重複）
  async subscribe(
    accountId: number,
    sub: { endpoint: string; keys: { p256dh: string; auth: string } },
  ) {
    const existing = await this.subRepository.findOne({
      where: { endpoint: sub.endpoint },
    });
    if (existing) {
      await this.subRepository.update(existing.id, {
        accountId,
        p256dh: sub.keys.p256dh,
        auth: sub.keys.auth,
      });
      return existing;
    }
    return await this.subRepository.save(
      this.subRepository.create({
        accountId,
        endpoint: sub.endpoint,
        p256dh: sub.keys.p256dh,
        auth: sub.keys.auth,
      }),
    );
  }

  // 取消訂閱
  async unsubscribe(endpoint: string): Promise<void> {
    await this.subRepository.delete({ endpoint });
  }

  // 對單一 accountId 發送通知
  async notifyAccount(
    accountId: number,
    payload: { title: string; body: string; url?: string },
  ) {
    const subs = await this.subRepository.find({ where: { accountId } });
    const message = JSON.stringify(payload);

    for (const sub of subs) {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          message,
        );
      } catch (err) {
        // 訂閱已失效（410/404），自動清除
        if (err.statusCode === 410 || err.statusCode === 404) {
          await this.subRepository.delete(sub.id);
        }
      }
    }
  }

  // 候補通知：有空位了
  async notifyWaitlistOpen(
    _entry: Waitlist,
    _venueId: number,
    _date: string,
    _timeSlot: string,
  ) {
    // 候補者可能是 player 或 organizer，需由外部傳入 accountId
    // 此方法供 BookingService 呼叫時傳入對應的 accountId
  }

  // 直接發送給多個 accountIds
  async notifyAccounts(
    accountIds: number[],
    payload: { title: string; body: string; url?: string },
  ) {
    await Promise.all(accountIds.map((id) => this.notifyAccount(id, payload)));
  }
}
