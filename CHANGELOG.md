# Changelog

All notable changes to this project will be documented in this file.

## [0.1.0.0] - 2026-05-11

### Added
- **Stripe 付款閘道（BADM-T06）**：整合 Stripe Checkout，會員可透過信用卡完成場地預約付款
  - `POST /api/payments/:id/checkout-session` — 建立 Checkout Session，回傳付款 URL
  - Stripe Webhook 接收 `checkout.session.completed` / `checkout.session.expired` 事件
  - 付款狀態機：`unpaid → processing → paid`，含 `refunding / refunded / failed`
  - Hold-expiry race condition 保護：預約取消後到達的 webhook 自動觸發退款
- **Payment Entity 擴充**：新增 `gatewayOrderId`（Stripe Session ID）、`webhookPayload` 欄位，status ENUM 擴充至 6 種狀態
- **Migration**：`AddGatewayFieldsAndEnums` — 更新 payments/bookings ENUM，新增 gateway 欄位與唯一索引
- **STRIPE_CLIENT Provider**：Payment Module 使用 `useFactory` 注入 Stripe SDK，方便測試 mock

### Changed
- `main.ts` 啟用 `rawBody: true`（NestExpressApplication）以支援 Stripe Webhook 簽章驗證
- `CreatePaymentDto` / `UpdatePaymentDto` status 型別更新為精確 union type，含新 ENUM 值
- `.env.example` 新增 `STRIPE_SECRET_KEY`、`STRIPE_WEBHOOK_SECRET`、`FRONTEND_URL`

### Fixed
- **SEC-005（Session-3）**：Booking Controller 三支 POST/PUT 改用 DTO，杜絕 `Partial<Booking>` 造成的過量賦值

## [Unreleased]

---

> 版本格式：MAJOR.MINOR.PATCH.MICRO
