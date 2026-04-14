import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Headers,
  UnauthorizedException,
} from '@nestjs/common';
import { PushService } from './push.service';
import { AuthService } from '../auth/auth.service';

@Controller('api/push')
export class PushController {
  constructor(
    private readonly pushService: PushService,
    private readonly authService: AuthService,
  ) {}

  // 取得 VAPID public key（前端訂閱時需要）
  @Get('vapid-public-key')
  getVapidKey() {
    return { publicKey: this.pushService.getVapidPublicKey() };
  }

  // 儲存訂閱
  @Post('subscribe')
  async subscribe(
    @Body()
    body: {
      subscription: {
        endpoint: string;
        keys: { p256dh: string; auth: string };
      };
    },
    @Headers('authorization') authHeader: string,
  ) {
    const accountId = this.extractAccountId(authHeader);
    return await this.pushService.subscribe(accountId, body.subscription);
  }

  // 取消訂閱
  @Delete('unsubscribe')
  async unsubscribe(@Body() body: { endpoint: string }) {
    await this.pushService.unsubscribe(body.endpoint);
    return { ok: true };
  }

  private extractAccountId(authHeader: string): number {
    if (!authHeader?.startsWith('Bearer ')) throw new UnauthorizedException();
    const token = authHeader.slice(7);
    try {
      const payload = JSON.parse(
        Buffer.from(token.split('.')[1], 'base64').toString(),
      );
      return payload.sub;
    } catch {
      throw new UnauthorizedException();
    }
  }
}
