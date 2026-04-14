# 清除快取指南

如果看到頁面沒有更新，請按照以下步驟清除快取：

## 方法一：硬性重新整理（推薦）

### Chrome / Edge
- **Windows/Linux**: `Ctrl + Shift + R` 或 `Ctrl + F5`
- **Mac**: `Cmd + Shift + R`

### Firefox
- **Windows/Linux**: `Ctrl + Shift + R` 或 `Ctrl + F5`
- **Mac**: `Cmd + Shift + R`

### Safari
- **Mac**: `Cmd + Option + R`

## 方法二：清除瀏覽器快取

### Chrome
1. 按 `F12` 打開開發者工具
2. 右鍵點擊瀏覽器的重新整理按鈕
3. 選擇「清除快取並強制重新整理」

### 或手動清除：
1. 按 `Ctrl + Shift + Delete` (Windows) 或 `Cmd + Shift + Delete` (Mac)
2. 選擇「快取的圖片和檔案」
3. 時間範圍選擇「過去一小時」或「全部時間」
4. 點擊「清除資料」

## 方法三：清除 Service Worker（PWA 快取）

### Chrome
1. 按 `F12` 打開開發者工具
2. 切換到「Application」標籤
3. 左側選擇「Service Workers」
4. 找到你的 Service Worker，點擊「Unregister」
5. 然後選擇「Storage」→「Clear site data」

### 或直接在網址列輸入：
```
chrome://settings/clearBrowserData
```

## 方法四：無痕模式測試

打開無痕/隱私模式視窗來測試，這樣不會使用快取的資料。

## 方法五：重新啟動服務器

如果修改了後端代碼，需要重新啟動服務器：

```bash
# 停止當前服務器（Ctrl + C）
# 然後重新啟動
npm run dev
```

## 注意事項

- 如果使用 PWA，可能需要卸載並重新安裝應用
- 手機上可能需要清除應用資料或重新安裝
- 確保服務器正在運行並已載入最新代碼
