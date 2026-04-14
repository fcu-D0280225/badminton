const express = require('express');
const path = require('path');
const http = require('http');

const app = express();
const PORT = 3001;
const API_TARGET = 'http://localhost:3000';

// API 代理：將 /api 轉發到後端（使用內建 http，無需額外套件）
app.use('/api', (req, res) => {
  const url = new URL('/api' + req.url, API_TARGET);
  const options = {
    hostname: 'localhost',
    port: 3000,
    path: url.pathname + url.search,
    method: req.method,
    headers: { ...req.headers, host: 'localhost:3000' },
  };
  const proxy = http.request(options, (proxyRes) => {
    res.writeHead(proxyRes.statusCode, proxyRes.headers);
    proxyRes.pipe(res);
  });
  proxy.on('error', (err) => {
    res.status(502).send('Backend unreachable');
  });
  req.pipe(proxy);
});

// 根路徑：預設顯示登入畫面
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});
app.get('/login.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// 主應用（登入後進入）
app.get('/app', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 靜態檔案服務（CSS、JS、圖片等）
app.use(express.static(path.join(__dirname, 'public')));

// 其他路由返回 index.html（SPA 支援）
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
  
  console.log(`前端伺服器運行在:`);
  console.log(`  本地: http://localhost:${PORT}`);
  console.log(`  網路: http://${ipAddress}:${PORT}`);
  console.log(`\n手機訪問方式:`);
  console.log(`  1. 確保手機與電腦在同一 WiFi 網路`);
  console.log(`  2. 在網頁上點擊「📱 手機安裝」按鈕，掃描 QR Code`);
  console.log(`  3. 或直接在手機瀏覽器輸入: http://${ipAddress}:${PORT}`);
  console.log(`  4. 打開後選擇「添加到主畫面」即可安裝為 App`);
});
