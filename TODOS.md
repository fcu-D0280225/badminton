# TODOS

> 待辦任務統一管理於 claude-cron backlog（`fcu-D0280225/claude-cron`，`backlog/autonomous-tasks.md` → `## badminton`）

---

## 已完成

### ~~T1 — 未收款 banner 改用 analytics API 取正確總額~~ ✅ 已解決
**2026-04-01：** `renderBillingHero()` 改為永遠 fetch 全月所有記錄（無 unpaidOnly filter），client-side 計算 hero 數字，list 再 client-side filter。數字和篩選狀態脫鉤。

### ~~T2 — 收費管理加「本月收款進度」視覺化~~ ✅ 已完成 2026-04-05
**2026-04-05：** 在英雄卡底部加收款進度條（純 CSS），顯示已收/總額百分比。有未收款和全部收完兩種狀態都有進度條。

### ~~T3 — 建立 DESIGN.md~~ ✅ 已完成 2026-04-01

### ~~T4 — 日曆 A+C 混合視圖~~ ✅ 已完成 2026-04-01
**2026-04-01：** 月視圖每格顯示 4 條密度時段條（早/午/晚/夜，綠/橙/紅），點日期切換至週視圖（08:00–20:00 時段格，預訂塊依付款狀態上色），週視圖可左右翻週，返回鈕回月視圖。
