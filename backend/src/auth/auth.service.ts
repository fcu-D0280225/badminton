import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { IsIn, IsNotEmpty, IsString, MinLength } from 'class-validator';
import { Account, AccountRole } from '../entities/account.entity';
import { AccountVenue } from '../entities/account-venue.entity';
import { Venue } from '../entities/venue.entity';
import { Organizer } from '../entities/organizer.entity';
import { Player } from '../entities/player.entity';
import { Booker } from '../entities/booker.entity';

export interface LoginResult {
  access_token: string;
  role: AccountRole;
  entityId: number;
  linkedEntityId?: number;
  venueIds?: number[];
  name: string;
}

export type SelfRegisterRole = Exclude<AccountRole, 'venue'>;

export const SELF_REGISTER_ROLES: SelfRegisterRole[] = [
  'member',
  'player',
  'organizer',
  'booker',
];

export class RegisterDto {
  @IsIn(SELF_REGISTER_ROLES, {
    message: 'venue 帳號需由後台建立，無法自行註冊',
  })
  role: SelfRegisterRole;

  @IsString()
  @IsNotEmpty()
  username: string;

  @IsString()
  @MinLength(1)
  password: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  contact: string;
}

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(Account)
    private accountRepository: Repository<Account>,
    @InjectRepository(AccountVenue)
    private accountVenueRepository: Repository<AccountVenue>,
    @InjectRepository(Venue)
    private venueRepository: Repository<Venue>,
    @InjectRepository(Organizer)
    private organizerRepository: Repository<Organizer>,
    @InjectRepository(Player)
    private playerRepository: Repository<Player>,
    @InjectRepository(Booker)
    private bookerRepository: Repository<Booker>,
    private jwtService: JwtService,
  ) {}

  // venue 角色：列出帳號可管理的所有 venueId（pivot 為主，fallback 至 accounts.entityId）
  async getVenueIdsForAccount(account: Account): Promise<number[]> {
    if (account.role !== 'venue') return undefined;
    const rows = await this.accountVenueRepository.find({
      where: { accountId: account.id },
      select: ['venueId'],
    });
    if (rows.length === 0) return [account.entityId];
    return rows.map((r) => r.venueId);
  }

  async login(username: string, password: string): Promise<LoginResult> {
    const account = await this.accountRepository.findOne({
      where: { username },
    });

    if (!account) {
      throw new UnauthorizedException('帳號或密碼錯誤');
    }

    const isMatch = await bcrypt.compare(password, account.passwordHash);
    if (!isMatch) {
      throw new UnauthorizedException('帳號或密碼錯誤');
    }

    const name = await this.getEntityName(account.role, account.entityId);
    const venueIds = await this.getVenueIdsForAccount(account);
    const payload = {
      sub: account.id,
      username,
      role: account.role,
      entityId: account.entityId,
      linkedEntityId: account.linkedEntityId || undefined,
      venueIds,
    };
    const access_token = this.jwtService.sign(payload);

    return {
      access_token,
      role: account.role,
      entityId: account.entityId,
      linkedEntityId: account.linkedEntityId || undefined,
      venueIds,
      name,
    };
  }

  async register(dto: RegisterDto): Promise<LoginResult> {
    if (!SELF_REGISTER_ROLES.includes(dto.role as SelfRegisterRole)) {
      throw new ForbiddenException('venue 帳號需由後台建立，無法自行註冊');
    }

    const existing = await this.accountRepository.findOne({
      where: { username: dto.username },
    });
    if (existing) {
      throw new ConflictException('此帳號已被使用');
    }

    let entityId: number;
    let linkedEntityId: number | undefined;

    if (dto.role === 'member') {
      // member 同時建立 organizer + player 兩筆記錄
      const organizer = await this.organizerRepository.save(
        this.organizerRepository.create({
          name: dto.name,
          contact: dto.contact,
        }),
      );
      const player = await this.playerRepository.save(
        this.playerRepository.create({ name: dto.name, contact: dto.contact }),
      );
      entityId = organizer.id; // organizerId
      linkedEntityId = player.id; // playerId
    } else if (dto.role === 'booker') {
      const booker = await this.bookerRepository.save(
        this.bookerRepository.create({
          name: dto.name,
          contact: dto.contact,
        }),
      );
      entityId = booker.id;
    } else if (dto.role === 'organizer') {
      const organizer = await this.organizerRepository.save(
        this.organizerRepository.create({
          name: dto.name,
          contact: dto.contact,
        }),
      );
      entityId = organizer.id;
    } else {
      const player = await this.playerRepository.save(
        this.playerRepository.create({ name: dto.name, contact: dto.contact }),
      );
      entityId = player.id;
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);
    await this.accountRepository.save({
      username: dto.username,
      passwordHash,
      role: dto.role,
      entityId,
      linkedEntityId,
    });

    return this.login(dto.username, dto.password);
  }

  async getMe(payload: {
    id?: number;
    role: AccountRole;
    entityId: number;
  }): Promise<{
    role: AccountRole;
    entityId: number;
    name: string;
    venues?: { venueId: number; name: string; isPrimary: boolean }[];
  }> {
    const name = await this.getEntityName(payload.role, payload.entityId);
    const out: any = { role: payload.role, entityId: payload.entityId, name };
    if (payload.role === 'venue' && payload.id) {
      out.venues = await this.listAccountVenues(payload.id);
    }
    return out;
  }

  async createAccountForEntity(
    role: AccountRole,
    entityId: number,
    username: string,
    password: string,
  ): Promise<void> {
    const existing = await this.accountRepository.findOne({
      where: { username },
    });
    if (existing) {
      throw new ConflictException('此帳號已被使用');
    }

    const passwordHash = await bcrypt.hash(password, 10);
    await this.accountRepository.save({
      username,
      passwordHash,
      role,
      entityId,
    });
  }

  // venue 帳號專用建立流程（後台 / seed 用）— 公開 /register 端點不可走此路徑
  async createVenueAccount(input: {
    name: string;
    contact: string;
    username: string;
    password: string;
  }): Promise<void> {
    const existing = await this.accountRepository.findOne({
      where: { username: input.username },
    });
    if (existing) {
      throw new ConflictException('此帳號已被使用');
    }

    const venue = await this.venueRepository.save(
      this.venueRepository.create({
        name: input.name,
        contact: input.contact,
      }),
    );
    const passwordHash = await bcrypt.hash(input.password, 10);
    const account = await this.accountRepository.save({
      username: input.username,
      passwordHash,
      role: 'venue',
      entityId: venue.id,
    });
    // 同步寫 account_venues pivot：新建 venue 帳號的 primary 場館
    await this.accountVenueRepository.save({
      accountId: account.id,
      venueId: venue.id,
      isPrimary: true,
    });
  }

  // 把另一個 venue 加到既有 venue 帳號的可管理清單（管理員/後台用）
  async grantVenueToAccount(accountId: number, venueId: number): Promise<void> {
    const account = await this.accountRepository.findOne({
      where: { id: accountId },
    });
    if (!account) throw new ConflictException('帳號不存在');
    if (account.role !== 'venue') {
      throw new ForbiddenException('僅 venue 角色帳號可綁定多場館');
    }
    const venue = await this.venueRepository.findOne({
      where: { id: venueId },
    });
    if (!venue) throw new ConflictException('場館不存在');
    const existing = await this.accountVenueRepository.findOne({
      where: { accountId, venueId },
    });
    if (existing) return; // idempotent
    await this.accountVenueRepository.save({
      accountId,
      venueId,
      isPrimary: false,
    });
  }

  async revokeVenueFromAccount(
    accountId: number,
    venueId: number,
  ): Promise<void> {
    const row = await this.accountVenueRepository.findOne({
      where: { accountId, venueId },
    });
    if (!row) return;
    if (row.isPrimary) {
      throw new ForbiddenException(
        '不可移除 primary 場館，請改設定其他 primary 後再試',
      );
    }
    await this.accountVenueRepository.delete({ accountId, venueId });
  }

  async listAccountVenues(
    accountId: number,
  ): Promise<{ venueId: number; name: string; isPrimary: boolean }[]> {
    const rows = await this.accountVenueRepository.find({
      where: { accountId },
      relations: ['venue'],
      order: { isPrimary: 'DESC', createdAt: 'ASC' },
    });
    return rows.map((r) => ({
      venueId: r.venueId,
      name: r.venue?.name || '',
      isPrimary: r.isPrimary,
    }));
  }

  private async getEntityName(
    role: AccountRole,
    entityId: number,
  ): Promise<string> {
    if (role === 'venue') {
      const v = await this.venueRepository.findOne({ where: { id: entityId } });
      return v?.name || '';
    }
    if (role === 'organizer' || role === 'member') {
      const o = await this.organizerRepository.findOne({
        where: { id: entityId },
      });
      return o?.name || '';
    }
    if (role === 'booker') {
      const b = await this.bookerRepository.findOne({
        where: { id: entityId },
      });
      return b?.name || '';
    }
    const p = await this.playerRepository.findOne({ where: { id: entityId } });
    return p?.name || '';
  }
}
