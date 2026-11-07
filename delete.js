#!/usr/bin/env node
/**
 * 本地删除脚本：移除一条收藏，同时删除 public/media/ 下的视频与封面
 *
 * 用法：
 *   node delete.js <id> [--yes] [--push]
 *   node delete.js                 # 列出所有收藏及其 id
 *
 *   --yes   跳过确认直接删除
 *   --push  删除后自动 git add / commit / push，触发 GitHub Pages 重新部署
 *
 * 站点是纯静态的，不存在任何删除接口，只有同时持有仓库写权限的人能执行本脚本。
 */
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { execSync } = require('child_process');

const DATA_FILE = path.join(__dirname, 'public', 'data', 'videos.json');
const MEDIA_DIR = path.join(__dirname, 'public', 'media');

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

function readData() {
  try {
    const d = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    return Array.isArray(d) ? d : [];
  } catch (e) {
    return [];
  }
}

function printList(list) {
  console.log(`\n  当前共 ${list.length} 条收藏：\n`);
  list.forEach((v, i) => {
    console.log(`  ${String(i + 1).padStart(2)}. ${v.title}`);
    console.log(`      id: ${v.id}`);
    console.log(`      作者: ${v.author || '-'} · 发布日期: ${v.publishDate || '-'}\n`);
  });
  console.log('  删除用法：node delete.js <id> [--push]\n');
}

// 记录里的相对路径（media/xxx.mp4）对应 public/ 下的真实文件
function localPathFromUrl(url) {
  if (typeof url !== 'string') return null;
  if (!url.startsWith('media/')) return null;
  return path.join(__dirname, 'public', url);
}

function gitPush(title) {
  try {
    execSync('git add -A "public/media" "public/data/videos.json"', { stdio: 'inherit' });
    execSync(`git commit -m "移除: ${title.replace(/"/g, "'")}"`, { stdio: 'inherit' });
    execSync('git push', { stdio: 'inherit' });
    console.log('  ✓ 已推送到 GitHub，Pages 将自动重新部署');
  } catch (e) {
    console.log('  ! git 推送未完成（可能无改动或未配置远程），本地文件已更新');
  }
}

(async function main() {
  const args = parseArgs(process.argv.slice(2));
  const list = readData();

  const id = args._[0];
  if (!id) {
    printList(list);
    process.exit(list.length ? 0 : 1);
  }

  const index = list.findIndex(v => String(v.id) === String(id));
  if (index === -1) fail('未找到 id 为 ' + id + ' 的收藏');

  const record = list[index];
  const videoPath = localPathFromUrl(record.videoUrl);
  const coverPath = localPathFromUrl(record.coverImage);

  console.log(`\n  即将删除：「${record.title}」`);
  console.log(`  作者: ${record.author || '-'} · 发布日期: ${record.publishDate || '-'}`);
  console.log(`  视频文件: ${videoPath ? 'public/' + record.videoUrl : '非本地文件（需手动处理）'}`);
  if (coverPath) console.log(`  封面文件: public/${record.coverImage}`);

  if (!args.yes) {
    const ans = await ask('\n  确认删除？(y/N) ');
    if (!/^y(es)?$/i.test(ans)) fail('已取消');
  }

  for (const p of [videoPath, coverPath].filter(Boolean)) {
    if (fs.existsSync(p)) {
      fs.unlinkSync(p);
      console.log(`  ✓ 已删除 ${path.relative(__dirname, p)}`);
    }
  }

  list.splice(index, 1);
  fs.writeFileSync(DATA_FILE, JSON.stringify(list, null, 2), 'utf8');
  console.log(`\n  ✓ 记录已移除，当前剩余 ${list.length} 条\n`);

  if (args.push) gitPush(record.title);
  else console.log('  提示：加 --push 可自动提交并推送，触发 GitHub Pages 部署。\n');
})().catch(err => {
  console.error('\n✗ 删除失败：' + (err && err.message ? err.message : err) + '\n');
  process.exit(1);
});
