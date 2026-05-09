import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthUser } from '../auth/types';
import { PaymentService } from './payment.service';
import { Payment } from '../entities/payment.entity';

@UseGuards(JwtAuthGuard)
@Controller('api/payments')
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  @Post()
  async createPayment(
    @CurrentUser() user: AuthUser,
    @Body() data: Partial<Payment>,
  ): Promise<Payment> {
    return await this.paymentService.createPayment(data, user);
  }

  @Get()
  async findAll(@CurrentUser() user: AuthUser): Promise<Payment[]> {
    return await this.paymentService.findAll(user);
  }

  @Get(':id')
  async findOne(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
  ): Promise<Payment> {
    return await this.paymentService.findOne(+id, user);
  }

  @Get('booking/:bookingId')
  async findByBooking(
    @CurrentUser() user: AuthUser,
    @Param('bookingId') bookingId: string,
  ): Promise<Payment> {
    return await this.paymentService.findByBooking(+bookingId, user);
  }

  @Put(':id')
  async updatePayment(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() data: Partial<Payment>,
  ): Promise<Payment> {
    return await this.paymentService.updatePayment(+id, data, user);
  }

  @Put(':id/mark-paid')
  async markAsPaid(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() data: { paymentMethod?: string; transactionId?: string },
  ): Promise<Payment> {
    return await this.paymentService.markAsPaid(
      +id,
      data.paymentMethod,
      data.transactionId,
      user,
    );
  }
}
