import {
  Injectable,
  UnauthorizedException,
  ConflictException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { Account, AccountRole } from '../entities/account.entity';
import { Venue } from '../entities/venue.entity';
import { Organizer } from '../entities/organizer.entity';
import { Player } from '../entities/player.entity';

export interface LoginResult {
  access_token: string;
  role: AccountRole;
  entityId: number;
  linkedEntityId?: number;
  name: string;
}

export interface RegisterDto {
  role: AccountRole;
  username: string;
  password: string;
  name: string;
  contact: string;
}

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(Account)
    private accountRepository: Repository<Account>,
    @InjectRepository(Venue)
    private venueRepository: Repository<Venue>,
    @InjectRepository(Organizer)
    private organizerRepository: Repository<Organizer>,
    @InjectRepository(Player)
    private playerRepository: Repository<Player>,
    private jwtService: JwtService,
  ) {}

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
    const payload = {
      sub: account.id,
      username,
      role: account.role,
      entityId: account.entityId,
    };
    const access_token = this.jwtService.sign(payload);

    return {
      access_token,
      role: account.role,
      entityId: account.entityId,
      linkedEntityId: account.linkedEntityId || undefined,
      name,
    };
  }

  async register(dto: RegisterDto): Promise<LoginResult> {
    const existing = await this.accountRepository.findOne({
      where: { username: dto.username },
    });
    if (existing) {
      throw new ConflictException('此帳號已被使用');
    }

    let entityId: number;
    let linkedEntityId: number | undefined;

    if (dto.role === 'venue') {
      const venue = await this.venueRepository.save(
        this.venueRepository.create({ name: dto.name, contact: dto.contact }),
      );
      entityId = venue.id;
    } else if (dto.role === 'member') {
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
    role: AccountRole;
    entityId: number;
  }): Promise<{ role: AccountRole; entityId: number; name: string }> {
    const name = await this.getEntityName(payload.role, payload.entityId);
    return {
      role: payload.role,
      entityId: payload.entityId,
      name,
    };
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
    const p = await this.playerRepository.findOne({ where: { id: entityId } });
    return p?.name || '';
  }
}
