// 本地预览服务器：仅用于在本机查看静态站点（生产部署走 GitHub Pages）
const express = require('express');
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '.env') });

const app = express();
const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');

app.use(express.static(PUBLIC_DIR));

// 兼容旧链接 /video/:id，重定向到新的查询参数写法
app.get('/video/:id', (req, res) => {
  res.redirect('video.html?id=' + encodeURIComponent(req.params.id));
});

app.listen(PORT, () => {
  console.log(`\n  本地预览：http://localhost:${PORT}\n`);
});
