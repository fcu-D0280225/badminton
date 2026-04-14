import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { randomUUID } from 'crypto';
import { PaymentRecord } from '../entities/payment-record.entity';
import { CreatePaymentRecordDto } from './dto/create-payment-record.dto';
import { UpdatePaymentRecordDto } from './dto/update-payment-record.dto';

@Injectable()
export class BillingService {
  constructor(
    @InjectRepository(PaymentRecord)
    private readonly repo: Repository<PaymentRecord>,
    private readonly dataSource: DataSource,
  ) {}

  // ─── IDOR helper ─────────────────────────────────────────────────────────────
  // 只回傳 404，不暴露「該記錄屬於其他 venue」的資訊
  private async findOneOrFail(
    id: number,
    venueId: number,
  ): Promise<PaymentRecord> {
    const record = await this.repo.findOne({ where: { id, venueId } });
    if (!record) throw new NotFoundException(`收費記錄 #${id} 不存在`);
    return record;
  }

  // ─── 建立單筆 ─────────────────────────────────────────────────────────────────
  async create(
    dto: CreatePaymentRecordDto,
    venueId: number,
  ): Promise<PaymentRecord> {
    const { recurring: _recurring, ...data } = dto;
    const record = this.repo.create({
      ...data,
      venueId,
      paymentStatus: data.paymentStatus ?? 'unpaid',
      paidAt:
        data.paymentStatus && data.paymentStatus !== 'unpaid'
          ? new Date()
          : null,
    });
    return this.repo.save(record);
  }

  // ─── 建立定期預約系列（5 筆，transaction 保證原子性）────────────────────────
  async createRecurringSeries(
    dto: CreatePaymentRecordDto,
    venueId: number,
  ): Promise<PaymentRecord[]> {
    const {
      recurring: _r,
      paymentStatus: _ps,
      paidByNote: _pbn,
      ...baseData
    } = dto;
    const groupId = randomUUID();

    return this.dataSource.transaction(async (manager) => {
      const records: PaymentRecord[] = [];
      for (let i = 0; i < 5; i++) {
        const d = new Date(baseData.date + 'T00:00:00');
        d.setDate(d.getDate() + i * 7);
        const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

        const record = manager.create(PaymentRecord, {
          ...baseData,
          venueId,
          date: dateStr,
          recurringGroupId: groupId,
          paymentStatus: 'unpaid',
          paidAt: null,
        });
        records.push(await manager.save(record));
      }
      return records;
    });
  }

  // ─── 查詢列表 ─────────────────────────────────────────────────────────────────
  async findAll(
    venueId: number,
    opts: { unpaidOnly?: boolean; date?: string } = {},
  ): Promise<PaymentRecord[]> {
    const qb = this.repo
      .createQueryBuilder('r')
      .where('r.venueId = :venueId', { venueId })
      .orderBy('r.date', 'DESC')
      .addOrderBy('r.startTime', 'ASC');

    if (opts.unpaidOnly) {
      qb.andWhere("r.paymentStatus = 'unpaid'");
    }
    if (opts.date) {
      qb.andWhere('r.date = :date', { date: opts.date });
    }
    return qb.getMany();
  }

  // ─── 查詢單筆 ─────────────────────────────────────────────────────────────────
  async findOne(id: number, venueId: number): Promise<PaymentRecord> {
    return this.findOneOrFail(id, venueId);
  }

  // ─── 更新 ─────────────────────────────────────────────────────────────────────
  async update(
    id: number,
    venueId: number,
    dto: UpdatePaymentRecordDto,
  ): Promise<PaymentRecord> {
    const record = await this.findOneOrFail(id, venueId);

    // 第一次標記已付款時自動填入 paidAt
    if (
      dto.paymentStatus &&
      dto.paymentStatus !== 'unpaid' &&
      record.paymentStatus === 'unpaid'
    ) {
      (dto as any).paidAt = new Date();
    }

    Object.assign(record, dto);
    return this.repo.save(record);
  }

  // ─── 刪除單筆 ─────────────────────────────────────────────────────────────────
  async delete(id: number, venueId: number): Promise<void> {
    await this.findOneOrFail(id, venueId);
    await this.repo.delete({ id, venueId });
  }

  // ─── 刪除定期系列 ─────────────────────────────────────────────────────────────
  async deleteRecurringSeries(groupId: string, venueId: number): Promise<void> {
    const count = await this.repo.count({
      where: { recurringGroupId: groupId, venueId },
    });
    if (count === 0)
      throw new NotFoundException(`定期預約系列 ${groupId} 不存在`);
    await this.repo.delete({ recurringGroupId: groupId, venueId });
  }

  // ─── CSV 匯出 ─────────────────────────────────────────────────────────────────
  async exportCsv(venueId: number, month: string): Promise<string> {
    // month: YYYY-MM，後端計算邊界，不做 UTC 轉換（DATE 欄位無時區）
    const [year, mon] = month.split('-').map(Number);
    const startDate = `${year}-${String(mon).padStart(2, '0')}-01`;
    const lastDay = new Date(year, mon, 0).getDate(); // mon 已是 1-based
    const endDate = `${year}-${String(mon).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

    const records = await this.repo
      .createQueryBuilder('r')
      .where('r.venueId = :venueId', { venueId })
      .andWhere('r.date >= :start AND r.date <= :end', {
        start: startDate,
        end: endDate,
      })
      .orderBy('r.date', 'ASC')
      .addOrderBy('r.startTime', 'ASC')
      .getMany();

    const header =
      'date,team_name,court_number,start_time,end_time,amount,payment_status,paid_at,paid_by_note';
    const rows = records.map((r) =>
      [
        r.date,
        r.teamName,
        r.courtNumber ?? '',
        r.startTime,
        r.endTime,
        r.amount,
        r.paymentStatus,
        r.paidAt ? r.paidAt.toISOString() : '',
        r.paidByNote ?? '',
      ].join(','),
    );

    return [header, ...rows].join('\n');
  }

  // ─── 場地利用率分析 ───────────────────────────────────────────────────────────
  async getAnalytics(venueId: number, month: string) {
    const [year, mon] = month.split('-').map(Number);
    const startDate = `${year}-${String(mon).padStart(2, '0')}-01`;
    const lastDay = new Date(year, mon, 0).getDate();
    const endDate = `${year}-${String(mon).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

    const baseWhere =
      'r.venueId = :venueId AND r.date >= :start AND r.date <= :end';
    const params = { venueId, start: startDate, end: endDate };

    // 月收費總覽
    const summary = await this.repo
      .createQueryBuilder('r')
      .select('SUM(r.amount)', 'totalRevenue')
      .addSelect('COUNT(r.id)', 'totalCount')
      .addSelect(
        "SUM(CASE WHEN r.paymentStatus = 'unpaid' THEN r.amount ELSE 0 END)",
        'unpaidAmount',
      )
      .addSelect(
        "SUM(CASE WHEN r.paymentStatus = 'unpaid' THEN 1 ELSE 0 END)",
        'unpaidCount',
      )
      .where(baseWhere, params)
      .getRawOne();

    // 各球隊費用排名
    const teamStats = await this.repo
      .createQueryBuilder('r')
      .select('r.teamName', 'teamName')
      .addSelect('SUM(r.amount)', 'total')
      .addSelect('COUNT(r.id)', 'count')
      .where(baseWhere, params)
      .groupBy('r.teamName')
      .orderBy('total', 'DESC')
      .getRawMany();

    // 各時段使用次數（以 startTime 分組）
    const timeSlotStats = await this.repo
      .createQueryBuilder('r')
      .select('r.startTime', 'startTime')
      .addSelect('COUNT(r.id)', 'count')
      .where(baseWhere, params)
      .groupBy('r.startTime')
      .orderBy('count', 'DESC')
      .getRawMany();

    return {
      month,
      totalRevenue: Number(summary?.totalRevenue ?? 0),
      totalCount: Number(summary?.totalCount ?? 0),
      unpaidAmount: Number(summary?.unpaidAmount ?? 0),
      unpaidCount: Number(summary?.unpaidCount ?? 0),
      teamStats,
      timeSlotStats,
    };
  }
}
