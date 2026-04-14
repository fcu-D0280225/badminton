import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // 啟用 CORS（允許所有來源，方便手機訪問）
  app.enableCors({
    origin: true, // 允許所有來源
    credentials: true,
  });

  // 啟用驗證管道
  app.useGlobalPipes(new ValidationPipe());

  await app.listen(3010, '0.0.0.0');
  console.log('後端伺服器運行在 http://0.0.0.0:3010');
}
bootstrap();
