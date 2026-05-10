import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
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
  const app = await NestFactory.create(AppModule);

  // 啟用 CORS — 允許清單模式（dev port + 區網 IP + CORS_ORIGINS env 自訂）
  app.enableCors({
    origin: buildCorsOrigin(),
    credentials: true,
  });

  // 啟用驗證管道（SEC-005 mass assignment 防護）
  // - whitelist: 只保留 DTO 列出的欄位（其餘 silently 剝除）
  // - forbidNonWhitelisted: 客戶端送出 DTO 未列欄位直接 400 拒絕
  // - transform: plain object → DTO class instance，啟用 class-validator 進階驗證
  // 注意：僅當 @Body 型別為帶有 class-validator 裝飾子的 class 時生效；inline
  // type alias（如 { name: string }）不受此 pipe 約束。
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  await app.listen(3010, '0.0.0.0');
  console.log('後端伺服器運行在 http://0.0.0.0:3010');
}
bootstrap();
