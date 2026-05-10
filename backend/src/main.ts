import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

// 預設允許的前端來源（開發環境常用 port）
const DEFAULT_ALLOWED_ORIGINS = [
  'http://localhost:3001', // frontend (member app)
  'http://localhost:3002', // venue-app (admin)
  'http://localhost:5173', // client (vite dev server)
];

// 區網 IP（手機測試用）：允許 192.168.x.x / 10.x.x.x / 172.16-31.x.x 任何 port
const PRIVATE_NETWORK_REGEX =
  /^https?:\/\/(?:192\.168\.\d{1,3}\.\d{1,3}|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(?:1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3})(?::\d{1,5})?$/;

function buildCorsOrigin() {
  const envOrigins = (process.env.CORS_ORIGINS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const allowList = new Set([...DEFAULT_ALLOWED_ORIGINS, ...envOrigins]);

  return (
    origin: string | undefined,
    cb: (err: Error | null, allow?: boolean) => void,
  ) => {
    // 同源請求 / 後端互打（curl、伺服器對伺服器）沒有 Origin header，放行
    if (!origin) return cb(null, true);
    if (allowList.has(origin)) return cb(null, true);
    if (PRIVATE_NETWORK_REGEX.test(origin)) return cb(null, true);
    cb(new Error(`CORS blocked: origin ${origin} not in allow list`));
  };
}

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    rawBody: true,
  });

  // 啟用 CORS — 允許清單模式（dev port + 區網 IP + CORS_ORIGINS env 自訂）
  app.enableCors({
    origin: buildCorsOrigin(),
    credentials: true,
  });

  // 啟用驗證管道
  app.useGlobalPipes(new ValidationPipe());

  await app.listen(3010, '0.0.0.0');
  console.log('後端伺服器運行在 http://0.0.0.0:3010');
}
bootstrap();
