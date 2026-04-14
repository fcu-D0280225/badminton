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

## 設計系統

### ~~T3 — 建立 DESIGN.md~~ ✅ 已完成 2026-04-01

### T3 原始說明
**What:** 記錄設計決策：色彩（#10b981 primary）、字型（Noto Sans TC）、間距、圓角規範。
**Why:** 目前設計決策都散在 styles.css 裡，M2/M3 開發時難以保持一致性。
**Pros:** 讓 /plan-design-review 和 /design-consultation 有基準文件。
**Cons:** 需要 30 分鐘整理，但 CSS variables 已在 styles.css 定義好。
**Context:** 從 /plan-design-review 系統審計發現缺失。
**Depends on:** 無
