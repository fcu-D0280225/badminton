import { NestFactory } from '@nestjs/core';
import { AppModule } from './src/app.module';
import { AuthService } from './src/auth/auth.service';

async function seed() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const authService = app.get(AuthService);

  try {
    await authService.register({
      role: 'venue',
      username: 'admin',
      password: '0000',
      name: '管理館方',
      contact: 'admin',
    });
    console.log('✓ 館方帳號建立成功：admin / 0000');
  } catch (e: any) {
    const msg = e?.message || e?.response?.message || '';
    if (typeof msg === 'string' && msg.includes('已被使用')) {
      console.log('- 館方帳號 admin 已存在，略過');
    } else {
      throw e;
    }
  }

  try {
    await authService.register({
      role: 'player',
      username: 'user',
      password: '1111',
      name: '一般使用者',
      contact: 'user',
    });
    console.log('✓ 使用者帳號建立成功：user / 1111');
  } catch (e: any) {
    const msg = e?.message || e?.response?.message || '';
    if (typeof msg === 'string' && msg.includes('已被使用')) {
      console.log('- 使用者帳號 user 已存在，略過');
    } else {
      throw e;
    }
  }

  await app.close();
  console.log('\n種子資料執行完成');
}

seed().catch((err) => {
  console.error('種子執行失敗:', err);
  process.exit(1);
});
