# TODOS

## 收費管理

### ~~T1 — 未收款 banner 改用 analytics API 取正確總額~~ ✅ 已解決
**2026-04-01：** `renderBillingHero()` 改為永遠 fetch 全月所有記錄（無 unpaidOnly filter），client-side 計算 hero 數字，list 再 client-side filter。數字和篩選狀態脫鉤。

### T1 原始說明
**What:** 收費管理頁頂部的「未收款總覽 banner」目前顯示當前篩選結果的未付款數，應改為獨立呼叫 `/billing/analytics?month=YYYY-MM`，永遠顯示本月全部未付款總額（不受「只看未付款」filter 影響）。
**Why:** 現在若用戶勾選「只看未付款」，banner 數字準確；但若取消勾選看全部，banner 數字反而包含已付款 → 容易讓用戶困惑。
**Pros:** 數字永遠代表「本月還有多少錢沒收到」，和 filter 狀態無關。
**Cons:** 每次進入收費 tab 多一次 API call。
**Context:** 從 /plan-design-review Pass 7 決策。
**Depends on:** 無

### ~~T2 — 收費管理加「本月收款進度」視覺化~~ ✅ 已完成 2026-04-05
**2026-04-05：** 在英雄卡底部加收款進度條（純 CSS），顯示已收/總額百分比。有未收款和全部收完兩種狀態都有進度條。

## 預約日曆

### ~~T4 — 日曆 A+C 混合視圖~~ ✅ 已完成 2026-04-01
**2026-04-01：** 月視圖每格顯示 4 條密度時段條（早/午/晚/夜，綠/橙/紅），點日期切換至週視圖（08:00–20:00 時段格，預訂塊依付款狀態上色），週視圖可左右翻週，返回鈕回月視圖。

## MVP 產品化（2026-05）

### T5 — 會員自助預約頁面（客戶端）
**What:** 建立會員端介面，讓球友可以自己查詢空檔、下單預約。
**Why:** 目前只有館方後台，沒有客戶端，場館無法真正上線營運。
**Scope:**
- 查詢指定日期可用時段
- 線上填寫資料送出預約
- 查看自己的預約歷史
**Depends on:** 無（後端 booking API 已完成）

---

### T6 — 線上金流串接（綠界 / 藍新）
**What:** 整合台灣主流金流，讓客戶可在線上付款，館方自動收到通知。
**Why:** 目前收款全靠手動確認匯款，無法做到真正的自動化收款。
**Scope:**
- 綠界 ECPay 或藍新 NewebPay 後端串接
- 付款成功 webhook → 自動更新 booking status = confirmed
- 付款失敗 / 逾時 → 觸發 hold 自動取消機制
**Depends on:** T5

---

### T7 — Email / Line 預約確認通知
**What:** 預約成立、取消、付款成功時自動發通知給客戶。
**Why:** 現在沒有通知，客戶不知道預約狀態，館方也要手動聯絡。
**Scope:**
- Email：使用 nodemailer 或 SendGrid
- Line：Line Notify 或 Messaging API
- 觸發點：booking created / confirmed / cancelled
**Depends on:** T5

---

### T8 — Google OAuth 登入 + 身份選擇 onboarding
**What:** 支援 Google 帳號登入，第一次登入選擇身份（館方/會員），依 role 導向對應介面。
**Why:** 降低登入門檻，減少帳號管理成本。
**Scope:** 見 memory 中的設計決策（Passport Google Strategy + onboarding flow）
**Depends on:** T5（需要會員介面才有意義）

---

### T9 — 會員儲值點數系統
**What:** 會員可預先儲值，訂場時直接扣點，館方不需每次手動收款。
**Why:** 提高會員黏著度，同時減少館方收款行政成本。
**Scope:**
- 儲值紀錄 entity（amount、balance、transactionType）
- 訂場扣點邏輯（先扣點數，不足再走金流）
- 會員端查看餘額 / 儲值紀錄
**Depends on:** T6（金流）

---

## P2 中期目標

### T10 — 動態定價（尖峰 / 離峰）
**What:** 館方可設定不同時段、星期的收費規則，系統自動套用正確金額。
**Why:** 台灣羽球場普遍有尖峰/離峰差價，目前系統固定費率不符實務。
**Scope:**
- 收費規則設定介面（時間段 × 星期幾 × 價格）
- 預約建立時自動計算費用
- 收費管理頁顯示計算依據
**Depends on:** T5

---

### T11 — 多場館管理
**What:** 單一帳號管理多個場館，帳務、預約分館檢視，也可跨館聚合報表。
**Why:** 未來授權連鎖品牌或多館業者，是企業版的核心功能。
**Scope:**
- Venue entity 支援 parent/group 關係
- 切換場館的 UI
- 跨館報表彙整
**Depends on:** T10

---

### T12 — 報表與 CSV 匯出
**What:** 月結報表、收款明細、預約統計，可一鍵匯出 CSV/Excel。
**Why:** 館方月底需要對帳、報稅，目前只能手動截圖或複製資料。
**Scope:**
- 月結報表頁（收入、預約數、會員活躍度）
- `/billing/export?month=YYYY-MM` API endpoint
- 前端「匯出 CSV」按鈕
**Depends on:** 無（現有 billing API 即可擴充）

---

## P3 長期目標

### T13 — Line Bot 訂場通知
**What:** 透過 Line Official Account，讓會員用 Line 查詢空檔、收預約確認/提醒。
**Why:** 台灣用戶 Line 滲透率極高，比 Email 通知開信率高出數倍。
**Scope:**
- Line Messaging API 串接
- 預約確認 / 24 小時前提醒推播
- 查詢指令（如「明天幾點有空」）
**Depends on:** T7

---

### T14 — 教練課排程模組
**What:** 支援場館內的教練課預約，與場地預約共用時段、互不衝突。
**Why:** 許多羽球場附設教學課程，目前無法在同一系統管理。
**Scope:**
- Coach entity（教練資料、可用時段）
- 教練課預約（綁定教練 + 場地）
- 學員管理（課程進度、已上課數）
**Depends on:** T10（動態定價）

---

### T15 — 開放 API
**What:** 提供 REST API 讓第三方系統（ERP、POS、行事曆）串接場館資料。
**Why:** 企業版客戶通常有既有系統，需要資料互通；也是未來 marketplace 的基礎。
**Scope:**
- API Key 管理介面
- 限速（rate limiting）與 scope 權限控制
- API 文件（Swagger / OpenAPI）
**Depends on:** T11（多館）

---

## 設計系統

### ~~T3 — 建立 DESIGN.md~~ ✅ 已完成 2026-04-01

### T3 原始說明
**What:** 記錄設計決策：色彩（#10b981 primary）、字型（Noto Sans TC）、間距、圓角規範。
**Why:** 目前設計決策都散在 styles.css 裡，M2/M3 開發時難以保持一致性。
**Pros:** 讓 /plan-design-review 和 /design-consultation 有基準文件。
**Cons:** 需要 30 分鐘整理，但 CSS variables 已在 styles.css 定義好。
**Context:** 從 /plan-design-review 系統審計發現缺失。
**Depends on:** 無
