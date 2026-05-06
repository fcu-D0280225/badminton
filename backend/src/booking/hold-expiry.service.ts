import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { BookingService } from './booking.service';

@Injectable()
export class HoldExpiryService {
  private readonly logger = new Logger(HoldExpiryService.name);

  constructor(private readonly bookingService: BookingService) {}

  /** 每分鐘掃描一次，自動取消逾時未付款的 pending 預約 */
  @Cron(CronExpression.EVERY_MINUTE)
  async handleExpiredHolds(): Promise<void> {
    const count = await this.bookingService.releaseExpiredHolds();
    if (count > 0) {
      this.logger.log(`已自動取消 ${count} 筆逾時未付款的保留預約`);
    }
  }
}
