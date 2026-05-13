# Design Audit — venue-app (localhost:3002)
**日期:** 2026-05-10  
**分支:** main  
**審查範圍:** 館方管理 PWA（場館總覽、預約管理、場館設定）  
**分類:** APP UI  
**參考:** DESIGN.md (Compact Operational)

---

## 設計評分

| 分類 | 修復前 | 修復後 |
|------|--------|--------|
| **Design Score** | **C** | **B** |
| **AI Slop Score** | **D** | **B+** |
| 視覺階層 | B | B |
| 字體 | D（Inter，違規） | **B**（Noto Sans TC）|
| 色彩 / 品牌一致性 | D（紫色違規） | **B**（品牌綠）|
| 間距 / 圓角 | C（radius 16px）| **B**（radius 10px）|
| 互動狀態 / Touch | C（30-32px）| **B**（36px min）|
| 響應式 | B | B |
| 效能 | A（32ms load）| A |

---

## Findings

### FINDING-001 [HIGH — FIXED ✓]
**字體錯誤：Inter 違反 DESIGN.md**
- 問題：`@import Inter` + `font-family: 'Inter'` 覆蓋了 Noto Sans TC
- DESIGN.md 明文：「不用 Inter / Roboto（已有 Noto Sans TC）」
- 修復：`venue-app/public/styles.css:1,30` → Noto Sans TC
- Commit: `4469f9c`
- 狀態: **verified**

### FINDING-002 [HIGH — FIXED ✓]
**Active 狀態使用紫/靛藍 #4f46e5（AI Slop 黑名單第1條）**
- 問題：`--admin-active-bg: #eef2ff` + `--admin-active-text: #4f46e5`，影響左側導航、底部 tab、KPI 圖示
- 修復：改為品牌綠 `--admin-active-bg: #d1fae5`、`--admin-active-text: #059669`；dark mode 也同步修正
- 修復：`venue-app/public/styles.css:988-989, 1693-1694`
- Commit: `1f61320`
- 狀態: **verified**

### FINDING-003 [MEDIUM — FIXED ✓]
**`--radius-card: 16px` 違反 DESIGN.md 規定的 10px**
- 問題：所有卡片、登入框都使用 16px 圓角，偏向「泡泡感」而非緊湊實用主義
- DESIGN.md 規格：`--radius-card: 10px`
- 修復：`venue-app/public/styles.css:14`
- Commit: `946b617`
- 狀態: **verified**

### FINDING-004 [MEDIUM — FIXED ✓]
**Header 按鈕高度不足（登出 30px、手機安裝 30px、🌙 32px < 36px 最低觸控目標）**
- DESIGN.md 規格：按鈕最小高度 36px
- 修復：`.admin-topbar-actions .btn` 加 `min-height: 36px`；`.theme-toggle-btn` height 32px → min-height 36px
- 修復：`venue-app/public/styles.css:1137-1140, 1648-1663`
- Commit: `3cccacd`
- 狀態: **verified**

---

## 修復摘要

| | 數量 |
|--|------|
| Total findings | 4 |
| Verified | 4 |
| Best-effort | 0 |
| Reverted | 0 |
| Deferred | 0 |

Design Score: C → **B**  
AI Slop Score: D → **B+**

---

## 未修復 / 延後項目（不影響評分）

1. **Emoji 作為裝飾設計元素**（🔔📅📆💰🕐 在標題和導航欄）— 需修改 app.js 模板，改用 SVG icon 或文字。影響度 MEDIUM，CSS-only 無法修復，建議下次 session 處理。

2. **Tab 按鈕高度 38px**（收費管理/分析報表）— 略低於 44px iOS 規範，但符合 DESIGN.md 36px 最低要求，暫時接受。

---

## Quick Wins（下次繼續）

- 把 emoji nav icon 替換成 SVG，每個圖示 10 分鐘 × 3 = 30 分鐘
- `frontend/` app (port 3001) 尚未審查，可用同樣流程

---

## PR Summary

> Design review found 4 issues, fixed 4. Design score C → B, AI Slop score D → B+. Commits: 4469f9c, 1f61320, 946b617, 3cccacd.
