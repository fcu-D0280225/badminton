import { ValidationPipe, BadRequestException } from '@nestjs/common';
import { CreateBookingDto } from './create-booking.dto';
import { CreateRecurringBookingDto } from './create-recurring-booking.dto';
import { UpdateBookingDto } from './update-booking.dto';

// SEC-005: 確認三個 booking DTO 與全域 ValidationPipe (whitelist + forbidNonWhitelisted)
// 共同擋下 mass assignment — holdExpiresAt / recurringGroupId / createdAt / id /
// checkedIn 等敏感欄位不得由 request body 直接注入。
describe('booking DTO mass assignment 防護 (SEC-005)', () => {
  const pipe = new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  });

  const validCreate = {
    venueId: 1,
    organizerId: 2,
    date: '2026-06-01',
    timeSlot: '10:00-12:00',
  };

  describe('CreateBookingDto', () => {
    const meta = (type: any) => ({ type: 'body' as const, metatype: type });

    it('合法 payload 通過驗證', async () => {
      const result = await pipe.transform(validCreate, meta(CreateBookingDto));
      expect(result).toMatchObject(validCreate);
    });

    it.each([
      ['holdExpiresAt', '2026-06-01T10:00:00Z'],
      ['recurringGroupId', 'attacker-supplied-uuid'],
      ['createdAt', '2020-01-01'],
      ['id', 999],
      ['checkedIn', true],
    ])('拒絕注入 %s', async (field, value) => {
      await expect(
        pipe.transform({ ...validCreate, [field]: value }, meta(CreateBookingDto)),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('status 必須為合法值', async () => {
      await expect(
        pipe.transform(
          { ...validCreate, status: 'arbitrary' },
          meta(CreateBookingDto),
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('status=confirmed 合法', async () => {
      const result = await pipe.transform(
        { ...validCreate, status: 'confirmed' },
        meta(CreateBookingDto),
      );
      expect(result.status).toBe('confirmed');
    });

    it('date 格式錯誤被拒', async () => {
      await expect(
        pipe.transform(
          { ...validCreate, date: '2026/06/01' },
          meta(CreateBookingDto),
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('timeSlot 格式錯誤被拒', async () => {
      await expect(
        pipe.transform(
          { ...validCreate, timeSlot: '10am-12pm' },
          meta(CreateBookingDto),
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('venueId 為負數被拒', async () => {
      await expect(
        pipe.transform(
          { ...validCreate, venueId: -1 },
          meta(CreateBookingDto),
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('CreateRecurringBookingDto', () => {
    const meta = (type: any) => ({ type: 'body' as const, metatype: type });
    const validRecurring = { ...validCreate, recurringWeeks: 4 };

    it('合法 payload 通過驗證', async () => {
      const result = await pipe.transform(
        validRecurring,
        meta(CreateRecurringBookingDto),
      );
      expect(result).toMatchObject(validRecurring);
    });

    it('拒絕注入 holdExpiresAt（繼承 CreateBookingDto 白名單）', async () => {
      await expect(
        pipe.transform(
          { ...validRecurring, holdExpiresAt: '2026-06-01T10:00:00Z' },
          meta(CreateRecurringBookingDto),
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('recurringWeeks 必填', async () => {
      await expect(
        pipe.transform(validCreate, meta(CreateRecurringBookingDto)),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('recurringWeeks 上限 52', async () => {
      await expect(
        pipe.transform(
          { ...validRecurring, recurringWeeks: 100 },
          meta(CreateRecurringBookingDto),
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('recurringType 限定 weekly/biweekly', async () => {
      await expect(
        pipe.transform(
          { ...validRecurring, recurringType: 'monthly' },
          meta(CreateRecurringBookingDto),
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('UpdateBookingDto', () => {
    const meta = (type: any) => ({ type: 'body' as const, metatype: type });

    it('status=cancelled 合法', async () => {
      const result = await pipe.transform(
        { status: 'cancelled' },
        meta(UpdateBookingDto),
      );
      expect(result.status).toBe('cancelled');
    });

    it.each([
      ['checkedIn', true],
      ['holdExpiresAt', null],
      ['recurringGroupId', 'forged-uuid'],
      ['createdAt', '2020-01-01'],
      ['id', 999],
      ['organizerId', 999], // 改 organizer 屬越權，需走資源歸屬流程而非 body 注入
      ['playerId', 999],
      ['bookerId', 999],
    ])('拒絕注入 %s', async (field, value) => {
      await expect(
        pipe.transform({ [field]: value }, meta(UpdateBookingDto)),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('status=arbitrary 被拒', async () => {
      await expect(
        pipe.transform({ status: 'foo' }, meta(UpdateBookingDto)),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });
});
