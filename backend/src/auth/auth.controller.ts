import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  UseGuards,
  ForbiddenException,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthService, LoginResult, RegisterDto } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { CurrentUser } from './current-user.decorator';
import { AuthUser } from './types';

@Controller('api/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // 登入限流：5 次/分鐘，防暴力破解
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  @Post('login')
  async login(
    @Body() body: { username: string; password: string },
  ): Promise<LoginResult> {
    return await this.authService.login(body.username, body.password);
  }

  @Post('register')
  async register(@Body() body: RegisterDto): Promise<LoginResult> {
    return await this.authService.register(body);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async getMe(@CurrentUser() user: AuthUser) {
    return await this.authService.getMe(user);
  }

  @Post('link-account')
  @UseGuards(JwtAuthGuard)
  async linkAccount(
    @Body()
    body: {
      role: string;
      entityId: number;
      username: string;
      password: string;
    },
  ) {
    await this.authService.createAccountForEntity(
      body.role as 'venue' | 'organizer' | 'player',
      body.entityId,
      body.username,
      body.password,
    );
    return { success: true };
  }

  // ── 多場館 (FEAT-007) ──────────────────────────────────────────
  // 列出當前 venue 帳號可管理的所有 venue
  @Get('venues')
  @UseGuards(JwtAuthGuard)
  async listMyVenues(@CurrentUser() user: AuthUser) {
    if (user.role !== 'venue') {
      throw new ForbiddenException('僅 venue 角色可使用');
    }
    return await this.authService.listAccountVenues(user.id);
  }

  // 多場館授權已停用：venue 自我授權存在橫向越權風險。
  // 需要多場館管理，請由後台人工操作 account_venues 資料表。
  // @Post('venues/:venueId') — DISABLED (D4 security fix)
  // @Delete('venues/:venueId') — DISABLED (D4 security fix)
}
