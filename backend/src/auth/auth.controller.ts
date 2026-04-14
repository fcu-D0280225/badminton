import { Controller, Post, Get, Body, UseGuards } from '@nestjs/common';
import { AuthService, LoginResult, RegisterDto } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { CurrentUser } from './current-user.decorator';
import { AccountRole } from '../entities/account.entity';

@Controller('api/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

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
  async getMe(@CurrentUser() user: { role: AccountRole; entityId: number }) {
    return await this.authService.getMe(user);
  }

  @Post('link-account')
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
}
