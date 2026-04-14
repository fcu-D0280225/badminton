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
import { PaymentService } from './payment.service';
import { Payment } from '../entities/payment.entity';

@UseGuards(JwtAuthGuard)
@Controller('api/payments')
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  @Post()
  async createPayment(@Body() data: Partial<Payment>): Promise<Payment> {
    return await this.paymentService.createPayment(data);
  }

  @Get()
  async findAll(): Promise<Payment[]> {
    return await this.paymentService.findAll();
  }

  @Get(':id')
  async findOne(@Param('id') id: string): Promise<Payment> {
    return await this.paymentService.findOne(+id);
  }

  @Get('booking/:bookingId')
  async findByBooking(@Param('bookingId') bookingId: string): Promise<Payment> {
    return await this.paymentService.findByBooking(+bookingId);
  }

  @Put(':id')
  async updatePayment(
    @Param('id') id: string,
    @Body() data: Partial<Payment>,
  ): Promise<Payment> {
    return await this.paymentService.updatePayment(+id, data);
  }

  @Put(':id/mark-paid')
  async markAsPaid(
    @Param('id') id: string,
    @Body() data: { paymentMethod?: string; transactionId?: string },
  ): Promise<Payment> {
    return await this.paymentService.markAsPaid(
      +id,
      data.paymentMethod,
      data.transactionId,
    );
  }
}
