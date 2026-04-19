# Badminton — 資料庫 Schema 與建置指南

羽球預約系統（Monorepo），包含 NestJS Backend、Express Frontend/Venue App、Vite + React Client 四個子專案。

---

## 一、資料庫 Schema

- **資料庫**：MySQL 8（字元集 `utf8mb4`）
- **ORM**：TypeORM（`synchronize: true`，啟動時自動建表）
- **Entity 路徑**：`backend/src/entities/*.entity.ts`
- **預設 database 名稱**：`badminton`

### Table 總覽

| # | Table | 用途 |
|---|-------|------|
| 1 | `accounts` | 系統帳號（登入用） |
| 2 | `venues` | 館方 |
| 3 | `organizers` | 團主 |
| 4 | `players` | 臨打 |
| 5 | `bookers` | 預約者 |
| 6 | `bookings` | 預約單 |
| 7 | `booking_participants` | 預約參與者 |
| 8 | `payments` | 付款（對應 booking） |
| 9 | `payment_records` | 付款紀錄（館方專用） |
| 10 | `ratings` | 臨打評分 |
| 11 | `waitlists` | 候補單 |
| 12 | `venue_notes` | 館方備註 |
| 13 | `organizer_notes` | 團主備註 |
| 14 | `push_subscriptions` | Web Push 訂閱 |

### 1. accounts
| 欄位 | 型別 | 說明 |
|------|------|------|
| id | int PK auto | |
| username | string UNIQUE | 帳號 |
| passwordHash | string | bcrypt |
| role | enum | `venue` / `organizer` / `player` / `member` / `booker` |
| entityId | int | 對應角色的主體 ID |
| linkedEntityId | int nullable | member 角色：organizerId 或 playerId |
| createdAt | datetime | default CURRENT_TIMESTAMP |

### 2. venues
`id / name / contact / address / description / createdAt`
關聯：1:N → `bookings`、1:N → `venue_notes`

### 3. organizers
`id / name / contact / description / createdAt`
關聯：1:N → `bookings`、1:N → `organizer_notes`

### 4. players
`id / name / contact / createdAt`
關聯：1:N → `bookings`、1:N → `ratings`

### 5. bookers
`id / name / contact / createdAt`
關聯：1:N → `bookings`

### 6. bookings
| 欄位 | 型別 | 說明 |
|------|------|------|
| id | int PK | |
| venueId | int FK | → venues |
| organizerId | int FK nullable | → organizers |
| playerId | int FK nullable | → players |
| bookerId | int FK nullable | → bookers |
| date | string | `YYYY-MM-DD` |
| timeSlot | string | `HH:MM-HH:MM` |
| notes | text nullable | |
| status | string | `pending` / `confirmed` / `cancelled` |
| checkedIn | boolean | default false |
| recurringGroupId | string nullable | UUID |
| recurringType | string nullable | `weekly` / `biweekly` |
| createdAt | datetime | |

### 7. booking_participants
`id / bookingId (FK CASCADE) / name / phone / checkedIn / addedAt`
索引：`bookingId`

### 8. payments
`id / bookingId FK / amount decimal(10,2) / status (unpaid/paid/refunded) / paymentMethod / transactionId / paidAt / createdAt`

### 9. payment_records
館方自建付款紀錄（獨立於 bookings）：
`id / venueId / teamName / courtNumber / date / startTime / endTime / amount decimal(10,2) / paymentStatus (unpaid/cash/transfer) / paidAt / paidByNote / recurringGroupId / createdAt / updatedAt`
索引：`(venueId, date)`、`(recurringGroupId)`

### 10. ratings
`id / playerId FK / venueId FK nullable / organizerId FK nullable / score (1-5) / comment / createdAt`

### 11. waitlists
`id / venueId / date / timeSlot / playerId nullable / organizerId nullable / status (waiting/notified/confirmed/expired) / position / createdAt`

### 12. venue_notes
`id / venueId FK / content / visibility (public/organizer/player) / createdAt`

### 13. organizer_notes
`id / organizerId FK / content / visibility (public/player) / createdAt`

### 14. push_subscriptions
`id / accountId FK / endpoint varchar(500) UNIQUE / p256dh / auth / createdAt`

---

## 二、建置與啟動

### 環境需求
- **Node.js**：20.x（`.nvmrc` 指定 `20`）
- **MySQL**：8.x
- **套件管理**：npm

### 子專案與 Port

| 子專案 | 技術 | Port | 目錄 |
|--------|------|------|------|
| Backend | NestJS + TypeORM | **3010** | `backend/` |
| Frontend（團主 / 臨打） | Express + PWA | **3001** | `frontend/` |
| Venue App（館方） | Express + PWA | **3002** | `venue-app/` |
| Client | Vite + React | **5173** | `client/` |

### 環境變數（`backend/.env`）

```bash
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_USER=app_user
MYSQL_PASSWORD=AppUser@2026!
MYSQL_DATABASE=badminton

JWT_SECRET=badminton-booking-secret-key
JWT_EXPIRES_IN=7d

# Web Push（選用）
VAPID_PUBLIC_KEY=<from backend/vapid-keys.json>
VAPID_PRIVATE_KEY=<from backend/vapid-keys.json>
```

### 安裝依賴（Monorepo 一次裝）

```bash
npm run install-all
# 等同於 root + backend + frontend 各跑 npm install
```

### 開發模式

並行啟動 backend + frontend：
```bash
npm run dev
```

個別啟動：
```bash
# Backend（watch 模式）
cd backend && npm run start:dev

# Frontend
cd frontend && npm run dev

# Venue App
cd venue-app && npm run dev

# Client（Vite）
cd client && npm run dev
```

### 種子資料

首次啟動後建立預設帳號：
```bash
cd backend && npm run seed
# admin / 0000 （venue 角色）
# user  / 1111 （player 角色）
```

### 正式模式建置

```bash
# Root
npm run build           # 一次 build backend + frontend

# Backend 獨立
cd backend && npm run build && npm run start:prod

# Client 獨立
cd client && npm run build   # 輸出到 client/dist
```

### 測試

```bash
cd backend
npm test              # unit
npm run test:watch
npm run test:cov
npm run test:e2e
```

### 注意事項

1. `frontend/server.js` 與 `client/vite.config.js` 的 API proxy 目標寫的是 `http://localhost:3000`，但 backend 實際執行於 **3010**，部署時需確認是否要調整。
2. TypeORM `synchronize: true` 僅適合開發，正式環境應改用 migration。
3. 初始 seed 帳號密碼為 `0000` / `1111`，正式環境務必更改。
