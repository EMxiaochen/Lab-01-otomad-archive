#!/usr/bin/env node
/**
 * 本地上传脚本：把视频放进 public/media/，随 GitHub Pages 一起发布
 *
 * 用法：
 *   node upload.js <视频文件.mp4> --title="标题" --author="作者" --publish-date=YYYY-MM-DD \
 *        [--url=原视频链接] [--desc=简介] [--tags=标签1,标签2] [--cover=封面图] [--push]
 *
 *   缺省 --title/--author/--publish-date 时会进入交互式问答。
 *   --push 会在写入后自动 git add / commit / push，触发 GitHub Pages 重新部署。
 *
 * 注意：GitHub 单文件硬限制 100MB（超过会被拒绝 push），
 *      Pages 站点总量建议控制在 1GB 以内。
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const readline = require('readline');
const { execFileSync, execSync } = require('child_process');

require('dotenv').config({ path: path.join(__dirname, '.env') });

const DATA_FILE = path.join(__dirname, 'public', 'data', 'videos.json');
const MEDIA_DIR = path.join(__dirname, 'public', 'media');
const parsedMax = parseInt(process.env.MAX_FILE_SIZE_MB, 10);
const MAX_MB = Number.isFinite(parsedMax) && parsedMax > 0 ? parsedMax : 100;

function fail(msg) {
  console.error('\n✗ ' + msg + '\n');
  process.exit(1);
}

function parseArgs(argv) {
  const args = { _: [] };
  argv.forEach(a => {
    if (a.startsWith('--')) {
      const [k, ...rest] = a.slice(2).split('=');
      args[k] = rest.length ? rest.join('=') : true;
    } else {
      args._.push(a);
    }
  });
  return args;
}

function ask(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => rl.question(question, ans => { rl.close(); resolve(ans.trim()); }));
}

async function readMeta(args) {
  const meta = {
    title: args.title,
    author: args.author,
    publishDate: args['publish-date'],
    originalUrl: args.url || '',
    description: args.desc || '',
    tags: args.tags ? String(args.tags).split(/[,，]/).map(s => s.trim()).filter(Boolean) : []
  };
  if (!meta.title) meta.title = await ask('标题：');
  if (!meta.author) meta.author = await ask('作者：');
  if (!meta.publishDate) meta.publishDate = await ask('最早发布日期（YYYY-MM-DD）：');
  if (!meta.title) fail('标题不能为空');
  if (!meta.author) fail('作者不能为空');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(meta.publishDate)) fail('发布日期格式应为 YYYY-MM-DD');
  return meta;
}

function readData() {
  try {
    const d = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    return Array.isArray(d) ? d : [];
  } catch (e) {
    return [];
  }
}

function mediaTotalMB() {
  try {
    return fs.readdirSync(MEDIA_DIR)
      .filter(f => /\.(mp4|jpg|jpeg|png|webp)$/i.test(f))
      .reduce((sum, f) => sum + fs.statSync(path.join(MEDIA_DIR, f)).size, 0) / 1024 / 1024;
  } catch (e) {
    return 0;
  }
}

function tryMakeCover(videoPath, coverPath) {
  for (const cmd of ['ffmpeg', 'ffmpeg.exe']) {
    try {
      execFileSync(cmd, ['-y', '-ss', '1', '-i', videoPath, '-frames:v', '1', '-q:v', '3', coverPath],
        { stdio: 'ignore', timeout: 30000 });
      if (fs.existsSync(coverPath)) return true;
    } catch (e) { /* 试下一个 */ }
  }
  return false;
}

function gitPush(files, title) {
  try {
    execSync('git add ' + files.map(f => `"${f}"`).join(' '), { stdio: 'inherit' });
    execSync(`git commit -m "收录: ${title.replace(/"/g, "'")}"`, { stdio: 'inherit' });
    execSync('git push', { stdio: 'inherit' });
    console.log('  ✓ 已推送到 GitHub，Pages 将自动重新部署');
  } catch (e) {
    console.log('  ! git 推送未完成（可能无改动或未配置远程），文件已写入本地');
  }
}

(async function main() {
  const args = parseArgs(process.argv.slice(2));
  const videoPath = args._[0];

  if (!videoPath) {
    fail('用法：node upload.js <视频文件.mp4> --title="标题" --author="作者" --publish-date=YYYY-MM-DD [--push]');
  }
  if (!fs.existsSync(videoPath)) fail('文件不存在：' + videoPath);
  if (!videoPath.toLowerCase().endsWith('.mp4')) fail('仅支持 MP4 文件');

  const sizeMB = fs.statSync(videoPath).size / 1024 / 1024;
  if (sizeMB > MAX_MB) {
    fail(`文件 ${sizeMB.toFixed(1)}MB 超过上限 ${MAX_MB}MB\n   GitHub 对单个文件有 100MB 硬限制，请先压缩视频（如 ffmpeg -crf 28）。`);
  }

  const meta = await readMeta(args);

  fs.mkdirSync(MEDIA_DIR, { recursive: true });
  const id = crypto.randomUUID();
  const fileName = `${id}.mp4`;
  const destVideo = path.join(MEDIA_DIR, fileName);
  fs.copyFileSync(videoPath, destVideo);

  // 封面：优先 --cover；否则用本机 ffmpeg 抽帧
  let coverName = '';
  const coverArg = args.cover && String(args.cover);
  if (coverArg) {
    if (!fs.existsSync(coverArg)) fail('封面文件不存在：' + coverArg);
    const ext = path.extname(coverArg).toLowerCase() || '.jpg';
    coverName = `${id}${ext}`;
    fs.copyFileSync(coverArg, path.join(MEDIA_DIR, coverName));
  } else {
    const tmp = path.join(MEDIA_DIR, `${id}.jpg`);
    if (tryMakeCover(videoPath, tmp)) coverName = `${id}.jpg`;
    else console.log('  ! 未生成封面（本机无 ffmpeg 且未指定 --cover），列表将使用静音预览');
  }

  const record = {
    id,
    title: meta.title,
    originalUrl: meta.originalUrl,
    author: meta.author,
    publishDate: meta.publishDate,
    description: meta.description,
    tags: meta.tags,
    coverImage: coverName ? `media/${coverName}` : '',
    videoFileName: fileName,
    videoUrl: `media/${fileName}`,
    createdAt: new Date().toISOString()
  };

  const list = readData();
  list.unshift(record);
  fs.writeFileSync(DATA_FILE, JSON.stringify(list, null, 2), 'utf8');

  const total = mediaTotalMB();
  console.log(`\n  ✓ 已收录：「${record.title}」`);
  console.log(`    视频文件：public/media/${fileName}（${sizeMB.toFixed(1)} MB）`);
  console.log(`    元信息已写入：public/data/videos.json（当前 ${list.length} 条）`);
  console.log(`    媒体目录总计：${total.toFixed(1)} MB`);
  if (total > 900) console.log('  ! 媒体目录已超过 900MB，接近 GitHub Pages 的 1GB 站点上限');
  console.log('');

  if (args.push) {
    const files = ['public/data/videos.json', `public/media/${fileName}`];
    if (coverName) files.push(`public/media/${coverName}`);
    gitPush(files, record.title);
  } else {
    console.log('  提示：加 --push 可自动提交并推送，触发 GitHub Pages 部署。\n');
  }
})().catch(err => {
  console.error('\n✗ 上传失败：' + (err && err.message ? err.message : err) + '\n');
  process.exit(1);
});
