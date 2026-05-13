import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

export interface MailPayload {
  to: string;
  subject: string;
  html: string;
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: nodemailer.Transporter;

  constructor() {
    this.transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.MAIL_FROM,
        pass: process.env.MAIL_PASSWORD,
      },
    });
  }

  async send(payload: MailPayload): Promise<void> {
    try {
      await this.transporter.sendMail({
        from: `羽球場預約系統 <${process.env.MAIL_FROM}>`,
        to: payload.to,
        subject: payload.subject,
        html: payload.html,
      });
    } catch (err) {
      // email 寄送失敗不中斷主流程
      this.logger.warn(`Email 寄送失敗 to=${payload.to}: ${err?.message}`);
    }
  }

  // ── 預約建立通知 ─────────────────────────────────────────────────
  async notifyBookingCreated(opts: {
    to: string;
    date: string;
    timeSlot: string;
    venueName: string;
    bookingId: number;
  }): Promise<void> {
    await this.send({
      to: opts.to,
      subject: `【預約確認】${opts.date} ${opts.timeSlot}`,
      html: `
        <h2>預約已建立</h2>
        <p>您已成功預約 <strong>${opts.venueName}</strong></p>
        <p>日期：${opts.date}　時段：${opts.timeSlot}</p>
        <p>預約編號：#${opts.bookingId}</p>
        <hr>
        <small>羽球場預約系統自動通知，請勿回覆此信</small>
      `,
    });
  }

  // ── 預約取消通知 ─────────────────────────────────────────────────
  async notifyBookingCancelled(opts: {
    to: string;
    date: string;
    timeSlot: string;
    venueName: string;
    bookingId: number;
  }): Promise<void> {
    await this.send({
      to: opts.to,
      subject: `【預約取消】${opts.date} ${opts.timeSlot}`,
      html: `
        <h2>預約已取消</h2>
        <p>您在 <strong>${opts.venueName}</strong> 的預約已被取消</p>
        <p>日期：${opts.date}　時段：${opts.timeSlot}</p>
        <p>預約編號：#${opts.bookingId}</p>
        <hr>
        <small>羽球場預約系統自動通知，請勿回覆此信</small>
      `,
    });
  }

  // ── 候補缺額通知 ─────────────────────────────────────────────────
  async notifyWaitlistAvailable(opts: {
    to: string;
    date: string;
    timeSlot: string;
    venueName: string;
  }): Promise<void> {
    await this.send({
      to: opts.to,
      subject: `【候補通知】${opts.date} ${opts.timeSlot} 有空位了！`,
      html: `
        <h2>候補場次有空位</h2>
        <p><strong>${opts.venueName}</strong> ${opts.date} ${opts.timeSlot} 有人取消，快去預約！</p>
        <hr>
        <small>羽球場預約系統自動通知，請勿回覆此信</small>
      `,
    });
  }

  // ── 錢包儲值完成通知 ─────────────────────────────────────────────
  async notifyWalletTopup(opts: {
    to: string;
    amount: number;
    balance: number;
  }): Promise<void> {
    await this.send({
      to: opts.to,
      subject: `【儲值成功】錢包已入帳 ${opts.amount} 元`,
      html: `
        <h2>錢包儲值成功</h2>
        <p>本次儲值：<strong>${opts.amount} 元</strong></p>
        <p>目前餘額：${opts.balance} 元</p>
        <hr>
        <small>羽球場預約系統自動通知，請勿回覆此信</small>
      `,
    });
  }
}
