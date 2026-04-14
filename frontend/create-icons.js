// 簡單的圖標生成腳本（需要安裝 sharp）
// 如果沒有 sharp，可以手動創建 192x192 和 512x512 的 PNG 圖片

const fs = require('fs');
const path = require('path');

// 創建一個簡單的 SVG 圖標（可以用作臨時方案）
const svgIcon = `
<svg width="192" height="192" xmlns="http://www.w3.org/2000/svg">
  <rect width="192" height="192" fill="#667eea"/>
  <text x="96" y="120" font-size="80" text-anchor="middle" fill="white">🏸</text>
</svg>
`;

// 將 SVG 保存（瀏覽器可以直接使用 SVG 作為圖標）
const publicDir = path.join(__dirname, 'public');

// 創建 SVG 圖標
fs.writeFileSync(path.join(publicDir, 'icon.svg'), svgIcon);

console.log('圖標已創建！');
console.log('注意：PWA 需要 PNG 格式的圖標');
console.log('建議：使用線上工具將 SVG 轉換為 192x192 和 512x512 的 PNG');
console.log('或使用圖片編輯軟體創建圖標');
