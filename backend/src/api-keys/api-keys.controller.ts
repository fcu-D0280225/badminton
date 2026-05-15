import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthUser } from '../auth/types';
import { ApiKeysService, CreateApiKeyResult } from './api-keys.service';
import { CreateApiKeyDto } from './dto/create-api-key.dto';

/**
 * BADM-T15: API Key 管理介面（後台）
 *
 * 路徑 /api/admin/api-keys；僅 venue 角色 JWT 可使用。
 */
@ApiTags('admin/api-keys')
@ApiBearerAuth('jwt')
@UseGuards(JwtAuthGuard)
@Controller('api/admin/api-keys')
export class ApiKeysController {
  constructor(private readonly apiKeysService: ApiKeysService) {}

  @ApiOperation({
    summary: '建立新 API Key（明文僅在此 response 回傳一次）',
  })
  @ApiResponse({
    status: 201,
    description:
      'response.plaintext 為一次性明文 key，建立後請立即妥善保存；日後查詢只會看到 keyPrefix。',
  })
  @Post()
  async create(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateApiKeyDto,
  ): Promise<CreateApiKeyResult> {
    return await this.apiKeysService.create(dto, user);
  }

  @ApiOperation({ summary: '列出目前帳號建立過的所有 API Key（不含 hash）' })
  @Get()
  async list(@CurrentUser() user: AuthUser) {
    return await this.apiKeysService.list(user);
  }

  @ApiOperation({ summary: '撤銷指定 API Key（軟刪除）' })
  @ApiResponse({ status: 204, description: '撤銷成功' })
  @ApiResponse({ status: 404, description: 'API Key 不存在或不屬於目前帳號' })
  @HttpCode(204)
  @Delete(':id')
  async revoke(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
  ): Promise<void> {
    await this.apiKeysService.revoke(id, user);
  }
}
