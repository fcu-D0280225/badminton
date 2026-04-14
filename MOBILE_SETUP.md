# 手機安裝指南

## 方式一：通過 WiFi 訪問（推薦）

### 步驟 1：確保手機和電腦在同一 WiFi 網路
- 手機和電腦必須連接到同一個 WiFi 路由器

### 步驟 2：啟動服務器
```bash
npm run dev
```

啟動後會顯示：
```
前端伺服器運行在:
  本地: http://localhost:3001
  網路: http://192.168.x.x:3001  (這是你電腦的 IP)
```

### 步驟 3：在手機瀏覽器訪問
1. 打開手機瀏覽器（Chrome、Safari 等）
2. 輸入顯示的網路地址，例如：`http://192.168.1.100:3001`
3. 等待頁面載入

### 步驟 4：安裝為 App（PWA）
**Android (Chrome):**
1. 點擊瀏覽器右上角的三點選單
2. 選擇「添加到主畫面」或「安裝應用程式」
3. 確認安裝

**iPhone (Safari):**
1. 點擊底部的分享按鈕（方框+箭頭）
2. 向下滾動，選擇「加入主畫面」
3. 確認添加

## 方式二：使用 ngrok（外網訪問）

如果需要從任何地方訪問（不限制 WiFi）：

### 1. 安裝 ngrok
```bash
npm install -g ngrok
```

### 2. 啟動服務器
```bash
npm run dev
```

### 3. 在另一個終端啟動 ngrok
```bash
ngrok http 3001
```

### 4. 使用 ngrok 提供的網址
ngrok 會顯示一個公開網址，例如：`https://abc123.ngrok.io`
在手機瀏覽器輸入這個網址即可訪問

## 方式三：部署到雲端服務器

如果希望永久訪問，可以部署到：
- Heroku
- Vercel
- Railway
- 自己的服務器

## 注意事項

1. **防火牆設定**：確保電腦防火牆允許 3000 和 3001 端口的連接
2. **後端 API**：前端會自動檢測並連接到正確的後端地址
3. **首次訪問**：第一次訪問可能需要幾秒鐘載入
4. **離線功能**：安裝為 PWA 後，部分功能可以在離線狀態下使用

## 疑難排解

### 無法連接？

**1. Windows 防火牆設定（最常見原因）**

打開 PowerShell（以管理員身份），執行：
```powershell
# 允許 3000, 3001, 3002 端口
netsh advfirewall firewall add rule name="Badminton Backend" dir=in action=allow protocol=tcp localport=3000
netsh advfirewall firewall add rule name="Badminton Frontend" dir=in action=allow protocol=tcp localport=3001
netsh advfirewall firewall add rule name="Badminton Venue" dir=in action=allow protocol=tcp localport=3002
```

或手動設定：
1. 搜尋「Windows Defender 防火牆」
2. 點擊「進階設定」
3. 選擇「輸入規則」→「新增規則」
4. 選擇「連接埠」→ TCP → 特定本機連接埠：`3000,3001,3002`
5. 允許連線 → 完成

**2. 確認 IP 地址正確**

在 PowerShell 執行：
```powershell
ipconfig
```
找到「IPv4 位址」，例如 `192.168.1.100`

**3. 確認手機和電腦在同一 WiFi**
- 手機和電腦必須連接同一個路由器
- 公司/學校 WiFi 可能有隔離設定，嘗試用手機熱點

**4. 確認服務器正在運行**
- 終端機應該顯示「前端伺服器運行在...」
- 嘗試在電腦瀏覽器訪問 http://localhost:3001 確認正常

**5. 嘗試關閉防火牆測試（臨時）**
```powershell
# 暫時關閉防火牆（測試用）
netsh advfirewall set allprofiles state off

# 測試完成後重新開啟
netsh advfirewall set allprofiles state on
```

### 找不到「添加到主畫面」？
- Android：確保使用 Chrome 瀏覽器
- iPhone：確保使用 Safari 瀏覽器
- 某些瀏覽器可能不支援 PWA 安裝

### API 請求失敗？
- 確認後端服務器也在運行（端口 3000）
- 檢查後端 CORS 設定是否正確
