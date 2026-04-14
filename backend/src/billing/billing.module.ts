import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BillingController } from './billing.controller';
import { BillingService } from './billing.service';
import { PaymentRecord } from '../entities/payment-record.entity';

@Module({
  imports: [TypeOrmModule.forFeature([PaymentRecord])],
  controllers: [BillingController],
  providers: [BillingService],
})
export class BillingModule {}
