/**
 * TypeORM CLI DataSource
 *
 * 給 typeorm CLI 用（migration:generate / migration:run / migration:revert）。
 * 本檔不會被 NestJS app 載入，僅供 npm scripts 中以 ts-node 直接呼叫。
 *
 * 用法（見 package.json 的 migration:* scripts）：
 *   npm run migration:generate -- src/migrations/AddSomething
 *   npm run migration:run
 *   npm run migration:revert
 *   npm run migration:show
 */

import 'dotenv/config';
import 'reflect-metadata';
import { DataSource } from 'typeorm';

export default new DataSource({
  type: 'mysql',
  host: process.env.MYSQL_HOST || 'localhost',
  port: parseInt(process.env.MYSQL_PORT || '3306', 10),
  username: process.env.MYSQL_USER || 'app_user',
  password: process.env.MYSQL_PASSWORD,
  database: process.env.MYSQL_DATABASE || 'badminton',
  entities: [__dirname + '/**/*.entity{.ts,.js}'],
  migrations: [__dirname + '/migrations/*{.ts,.js}'],
  charset: 'utf8mb4',
  // CLI 用：synchronize 永遠 false，避免 generate 時意外觸發 DDL
  synchronize: false,
});
