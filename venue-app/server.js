const express = require('express');
const path = require('path');

const app = express();
const PORT = 3002; // 館方 app 使用 3002 端口

// 靜態檔案服務（開發模式：停用快取）
app.use(express.static(path.join(__dirname, 'public'), {
  etag: false,
  lastModified: false,
  setHeaders: (res) => {
    res.setHeader('Cache-Control', 'no-store');
  }
}));

// 所有路由都返回 index.html（SPA 路由）
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  const os = require('os');
  const networkInterfaces = os.networkInterfaces();
  let ipAddress = 'localhost';
  
  // 獲取本機 IP 地址
  for (const interfaceName in networkInterfaces) {
    const addresses = networkInterfaces[interfaceName];
    for (const address of addresses) {
      if (address.family === 'IPv4' && !address.internal) {
        ipAddress = address.address;
        break;
      }
    }
    if (ipAddress !== 'localhost') break;
  }
  
  console.log(`🏢 館方管理系統運行在:`);
  console.log(`  本地: http://localhost:${PORT}`);
  console.log(`  網路: http://${ipAddress}:${PORT}`);
  console.log(`\n手機訪問方式:`);
  console.log(`  1. 確保手機與電腦在同一 WiFi 網路`);
  console.log(`  2. 在網頁上點擊「📱 手機安裝」按鈕，掃描 QR Code`);
  console.log(`  3. 或直接在手機瀏覽器輸入: http://${ipAddress}:${PORT}`);
  console.log(`  4. 打開後選擇「添加到主畫面」即可安裝為 App`);
});
