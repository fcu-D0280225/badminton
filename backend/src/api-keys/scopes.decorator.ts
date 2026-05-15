import { SetMetadata } from '@nestjs/common';
import type { ApiKeyScope } from './dto/create-api-key.dto';

export const SCOPES_METADATA_KEY = 'apiKey:requiredScopes';

/**
 * 標記此 endpoint 需要的 scope。可同時宣告多個 scope，
 * ApiKeyAuthGuard 會檢查 apiKey.scopes 必須包含**全部**指定 scope。
 */
export const RequireScopes = (...scopes: ApiKeyScope[]) =>
  SetMetadata(SCOPES_METADATA_KEY, scopes);
