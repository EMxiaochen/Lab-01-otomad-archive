/**
 * 网页上传：用 GitHub 令牌直接向仓库提交视频与元信息
 * 只有拥有该仓库写权限的令牌才能成功提交，其他人粘贴自己的令牌会被拒绝。
 */
const TOKEN_KEY = 'lab01:github-pat';
const BRANCH = 'main';
const MAX_MB = 100;

const { owner, repo } = repoInfo();
let token = '';

function repoInfo() {
  const host = location.hostname;
  const seg = location.pathname.split('/').filter(Boolean)[0] || '';
  if (host.endsWith('.github.io')) return { owner: host.split('.')[0], repo: seg };
  return { owner: 'EMxiaochen', repo: 'Lab-01-otomad-archive' };
}

function apiUrl(path) {
  return `https://api.github.com/repos/${owner}/${repo}${path}`;
}

async function api(path, options = {}) {
  const headers = {
    Accept: 'application/vnd.github+json',
    Authorization: 'Bearer ' + token,
    'X-GitHub-Api-Version': '2022-11-28'
  };
  if (options.body) headers['Content-Type'] = 'application/json';

  let res;
  try {
    res = await fetch(apiUrl(path), { ...options, headers });
  } catch (e) {
    throw new Error('网络请求失败，请检查网络或稍后重试');
  }

  if (!res.ok) {
    let msg = `请求失败（HTTP ${res.status}）`;
    try {
      const detail = await res.json();
      if (detail && detail.message) msg = detail.message;
    } catch (e) { /* 忽略解析失败 */ }
    const err = new Error(msg);
    err.status = res.status;
    throw err;
  }
  return res.json();
}

function setProgress(percent, text) {
  document.getElementById('progressWrap').style.display = 'block';
  document.getElementById('progressFill').style.width = percent + '%';
  document.getElementById('progressText').textContent = text;
}

function showResult(type, html) {
  const box = document.getElementById('result');
  box.className = 'result-msg ' + type;
  box.innerHTML = html;
  box.style.display = 'block';
}

function bytesToBase64(bytes) {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function utf8ToBase64(str) {
  return bytesToBase64(new TextEncoder().encode(str));
}

function fileToBase64(file, onProgress) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onprogress = e => {
      if (e.lengthComputable && onProgress) onProgress(e.loaded / e.total);
    };
    reader.onload = () => resolve(String(reader.result).split(',')[1] || '');
    reader.onerror = () => reject(new Error('无法读取文件'));
    reader.readAsDataURL(file);
  });
}

async function extractCover(file) {
  const url = URL.createObjectURL(file);
  try {
    const video = document.createElement('video');
    video.src = url;
    video.muted = true;
    video.playsInline = true;
    await new Promise((resolve, reject) => {
      video.onloadedmetadata = resolve;
      video.onerror = () => reject(new Error('无法解析视频'));
    });
    const target = Math.min(1, Math.max(0, (video.duration || 0) * 0.1));
    video.currentTime = target;
    await new Promise(resolve => {
      video.onseeked = resolve;
      setTimeout(resolve, 1500);
    });
    const width = 640;
    const ratio = video.videoHeight && video.videoWidth ? video.videoHeight / video.videoWidth : 9 / 16;
    const height = Math.round(width * ratio);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    canvas.getContext('2d').drawImage(video, 0, 0, width, height);
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.82));
    if (!blob) return '';
    const bytes = new Uint8Array(await blob.arrayBuffer());
    return bytesToBase64(bytes);
  } catch (e) {
    return '';
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function verifyToken(t) {
  token = t;
  const info = await api('');
  if (!info.permissions || !info.permissions.push) {
    throw new Error('该令牌没有写权限，只有仓库所有者可以上传');
  }
  return info;
}

function maskToken(t) {
  return t.slice(0, 12) + '…' + t.slice(-4);
}

function showUploadScreen() {
  document.getElementById('authScreen').style.display = 'none';
  document.getElementById('uploadScreen').style.display = 'flex';
  document.getElementById('tokenMask').textContent = maskToken(token);
  loadList();
}

/* ---------------- 事件绑定 ---------------- */

const tokenInput = document.getElementById('tokenInput');
const authErr = document.getElementById('authErr');
const authBtn = document.getElementById('authBtn');

authBtn.addEventListener('click', async () => {
  const value = tokenInput.value.trim();
  authErr.textContent = '';
  if (!value) {
    authErr.textContent = '请先粘贴令牌';
    return;
  }
  authBtn.disabled = true;
  authBtn.textContent = '验证中…';
  try {
    await verifyToken(value);
    localStorage.setItem(TOKEN_KEY, value);
    showUploadScreen();
  } catch (e) {
    authErr.textContent = e.status === 401 ? '令牌无效或已过期' : e.message;
    token = '';
  } finally {
    authBtn.disabled = false;
    authBtn.textContent = '验证并进入';
  }
});

tokenInput.addEventListener('keydown', e => {
  if (e.key === 'Enter') authBtn.click();
});

document.getElementById('forgetBtn').addEventListener('click', () => {
  localStorage.removeItem(TOKEN_KEY);
  token = '';
  document.getElementById('uploadScreen').style.display = 'none';
  document.getElementById('authScreen').style.display = 'block';
  tokenInput.value = '';
});

const fileInput = document.getElementById('fileInput');
const dropZone = document.getElementById('dropZone');
const fileNameBox = document.getElementById('fileName');
let pickedFile = null;

function setFile(file) {
  document.getElementById('result').style.display = 'none';
  if (!file) return;
  if (!file.name.toLowerCase().endsWith('.mp4')) {
    showResult('err', '仅支持 MP4 文件');
    return;
  }
  const sizeMB = file.size / 1024 / 1024;
  if (sizeMB > MAX_MB) {
    showResult('err', `文件 ${sizeMB.toFixed(1)}MB，超过 ${MAX_MB}MB 上限，请先压缩`);
    return;
  }
  pickedFile = file;
  fileNameBox.textContent = `${file.name}（${sizeMB.toFixed(1)} MB）`;
  if (sizeMB > 50) {
    showResult('warn', `文件 ${sizeMB.toFixed(1)}MB 较大，上传需要较长时间，建议先压缩到 50MB 以内再传（播放也更流畅）`);
  }
}

async function withTimer(text, fn) {
  const start = Date.now();
  const tick = setInterval(() => {
    const sec = Math.round((Date.now() - start) / 1000);
    document.getElementById('progressText').textContent = `${text}，已用 ${sec} 秒（勿关闭页面）`;
  }, 1000);
  try {
    return await fn();
  } finally {
    clearInterval(tick);
  }
}

dropZone.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', () => setFile(fileInput.files[0]));
['dragenter', 'dragover'].forEach(ev =>
  dropZone.addEventListener(ev, e => { e.preventDefault(); dropZone.classList.add('dragover'); })
);
['dragleave', 'drop'].forEach(ev =>
  dropZone.addEventListener(ev, e => { e.preventDefault(); dropZone.classList.remove('dragover'); })
);
dropZone.addEventListener('drop', e => {
  const f = e.dataTransfer.files && e.dataTransfer.files[0];
  setFile(f);
});

const uploadBtn = document.getElementById('uploadBtn');
const uploadBtnText = document.getElementById('uploadBtnText');

uploadBtn.addEventListener('click', async () => {
  const title = document.getElementById('title').value.trim();
  const author = document.getElementById('author').value.trim();
  const publishDate = document.getElementById('publishDate').value;
  const originalUrl = document.getElementById('originalUrl').value.trim();
  const tagsRaw = document.getElementById('tags').value.trim();
  const description = document.getElementById('description').value.trim();

  if (!pickedFile) return showResult('err', '请先选择视频文件');
  if (!title) return showResult('err', '标题不能为空');
  if (!author) return showResult('err', '作者不能为空');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(publishDate)) return showResult('err', '请填写最早发布日期');

  document.getElementById('result').style.display = 'none';
  uploadBtn.disabled = true;
  uploadBtnText.textContent = '上传中…';
  setProgress(5, '读取文件…');

  try {
    const sizeMB = pickedFile.size / 1024 / 1024;
    const videoB64 = await fileToBase64(pickedFile, r => setProgress(5 + r * 20, '读取文件…'));

    setProgress(30, '生成封面…');
    const coverB64 = await extractCover(pickedFile);

    const id = makeUuid();
    const videoName = `${id}.mp4`;
    const coverName = coverB64 ? `${id}.jpg` : '';

    let list = [];
    try {
      const res = await fetch(apiUrl('/contents/public/data/videos.json?ref=' + BRANCH), {
        headers: { Authorization: 'Bearer ' + token, Accept: 'application/vnd.github.raw+json' }
      });
      if (res.ok) list = await res.json();
    } catch (e) { /* 读取失败则按空列表处理 */ }

    const record = {
      id,
      title,
      originalUrl,
      author,
      publishDate,
      description,
      tags: tagsRaw ? tagsRaw.split(/[,，]/).map(s => s.trim()).filter(Boolean) : [],
      coverImage: coverName ? `media/${coverName}` : '',
      videoFileName: videoName,
      videoUrl: `media/${videoName}`,
      createdAt: new Date().toISOString()
    };
    list.unshift(record);

    setProgress(45, '提交视频（' + sizeMB.toFixed(1) + 'MB）…');
    const videoBlob = await withTimer('提交视频 ' + sizeMB.toFixed(1) + 'MB', () =>
      api('/git/blobs', {
        method: 'POST',
        body: JSON.stringify({ content: videoB64, encoding: 'base64' })
      })
    );

    let coverBlob = null;
    if (coverB64) {
      coverBlob = await api('/git/blobs', {
        method: 'POST',
        body: JSON.stringify({ content: coverB64, encoding: 'base64' })
      });
    }

    const jsonBlob = await api('/git/blobs', {
      method: 'POST',
      body: JSON.stringify({ content: utf8ToBase64(JSON.stringify(list, null, 2)), encoding: 'base64' })
    });

    setProgress(70, '写入记录…');
    const ref = await api('/git/ref/heads/' + BRANCH);
    const headSha = ref.object.sha;
    const headCommit = await api('/git/commits/' + headSha);

    const treeItems = [
      { path: `public/media/${videoName}`, mode: '100644', type: 'blob', sha: videoBlob.sha },
      { path: 'public/data/videos.json', mode: '100644', type: 'blob', sha: jsonBlob.sha }
    ];
    if (coverBlob) {
      treeItems.push({ path: `public/media/${coverName}`, mode: '100644', type: 'blob', sha: coverBlob.sha });
    }

    const tree = await api('/git/trees', {
      method: 'POST',
      body: JSON.stringify({ base_tree: headCommit.tree.sha, tree: treeItems })
    });

    const commit = await api('/git/commits', {
      method: 'POST',
      body: JSON.stringify({
        message: `收录：${title}`,
        tree: tree.sha,
        parents: [headSha]
      })
    });

    setProgress(85, '发布…');
    await api('/git/refs/heads/' + BRANCH, {
      method: 'PATCH',
      body: JSON.stringify({ sha: commit.sha, force: false })
    });

    setProgress(100, '完成');
    showResult('ok', `已收录「${title}」，GitHub Pages 正在部署，约 1 分钟后可在站点看到。`);
    loadList();
    document.getElementById('uploadBtn').classList.add('success');
    uploadBtnText.textContent = '上传完成';
    pickedFile = null;
    fileInput.value = '';
    fileNameBox.textContent = '';
    setTimeout(() => {
      uploadBtn.classList.remove('success');
      uploadBtn.disabled = false;
      uploadBtnText.textContent = '上传并发布';
    }, 4000);
  } catch (e) {
    document.getElementById('progressWrap').style.display = 'none';
    uploadBtn.disabled = false;
    uploadBtnText.textContent = '上传并发布';

    if (e.status === 401) {
      localStorage.removeItem(TOKEN_KEY);
      token = '';
      document.getElementById('uploadScreen').style.display = 'none';
      document.getElementById('authScreen').style.display = 'block';
      authErr.textContent = '令牌已失效，请重新创建并粘贴';
      tokenInput.value = '';
      return;
    }

    const hint = e.status === 403 ? '当前令牌无权写入该仓库' :
      e.status === 413 ? '文件过大，GitHub 拒绝了请求，请压缩到 50MB 以内' :
      e.status === 409 || e.status === 422 ? '仓库刚刚有新提交，请重试' : e.message;
    showResult('err', '上传失败：' + hint);
  }
});

function makeUuid() {
  if (crypto.randomUUID) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/* ---------------- 已收录列表 / 删除 ---------------- */

let cachedList = [];

function escapeHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderList() {
  const box = document.getElementById('videoList');
  const count = document.getElementById('videoCount');
  count.textContent = cachedList.length;

  if (!cachedList.length) {
    box.innerHTML = '<div class="list-empty">还没有收录内容</div>';
    return;
  }

  box.innerHTML = cachedList.map(item => `
    <div class="video-row" data-id="${escapeHtml(item.id)}">
      <div class="row-main">
        <div class="row-title">${escapeHtml(item.title)}</div>
        <div class="row-meta">${escapeHtml(item.author)} · ${escapeHtml(item.publishDate)}</div>
      </div>
      <button class="btn-del" data-id="${escapeHtml(item.id)}">删除</button>
    </div>
  `).join('');

  box.querySelectorAll('.btn-del').forEach(btn => {
    btn.addEventListener('click', () => deleteVideo(btn.dataset.id));
  });
}

async function loadList() {
  const box = document.getElementById('listMsg');
  box.textContent = '';
  try {
    const res = await fetch(apiUrl('/contents/public/data/videos.json?ref=' + BRANCH), {
      headers: { Authorization: 'Bearer ' + token, Accept: 'application/vnd.github.raw+json' }
    });
    if (!res.ok) throw new Error(res.status === 404 ? '数据文件不存在' : `读取列表失败（HTTP ${res.status}）`);
    const data = await res.json();
    cachedList = Array.isArray(data) ? data : [];
    renderList();
  } catch (e) {
    document.getElementById('videoList').innerHTML = '<div class="list-empty">读取失败</div>';
    box.textContent = e.message;
  }
}

async function deleteVideo(id) {
  const item = cachedList.find(v => v.id === id);
  if (!item) return;
  const ok = confirm(`确定删除「${item.title}」？\n视频文件和封面会一并删除，且不可恢复。`);
  if (!ok) return;

  const msg = document.getElementById('listMsg');
  msg.textContent = '';
  const btn = document.querySelector(`.btn-del[data-id="${id}"]`);
  if (btn) {
    btn.disabled = true;
    btn.textContent = '删除中…';
  }

  try {
    const nextList = cachedList.filter(v => v.id !== id);

    const jsonBlob = await api('/git/blobs', {
      method: 'POST',
      body: JSON.stringify({ content: utf8ToBase64(JSON.stringify(nextList, null, 2)), encoding: 'base64' })
    });

    const ref = await api('/git/ref/heads/' + BRANCH);
    const headCommit = await api('/git/commits/' + ref.object.sha);

    const paths = new Set();
    if (item.videoUrl) paths.add('public/' + String(item.videoUrl).replace(/^\/+/, ''));
    if (item.videoFileName) paths.add('public/media/' + item.videoFileName);
    if (item.coverImage) paths.add('public/' + String(item.coverImage).replace(/^\/+/, ''));

    const treeItems = [{ path: 'public/data/videos.json', mode: '100644', type: 'blob', sha: jsonBlob.sha }];
    paths.forEach(p => treeItems.push({ path: p, mode: '100644', type: 'blob', sha: null }));

    const tree = await api('/git/trees', {
      method: 'POST',
      body: JSON.stringify({ base_tree: headCommit.tree.sha, tree: treeItems })
    });

    const commit = await api('/git/commits', {
      method: 'POST',
      body: JSON.stringify({ message: `删除：${item.title}`, tree: tree.sha, parents: [ref.object.sha] })
    });

    await api('/git/refs/heads/' + BRANCH, {
      method: 'PATCH',
      body: JSON.stringify({ sha: commit.sha, force: false })
    });

    cachedList = nextList;
    renderList();
    showResult('ok', `已删除「${item.title}」，站点约 1 分钟后更新。`);
  } catch (e) {
    if (btn) {
      btn.disabled = false;
      btn.textContent = '删除';
    }
    msg.textContent = '删除失败：' + (e.status === 403 ? '当前令牌无写入权限' : e.message);
  }
}

document.getElementById('refreshBtn').addEventListener('click', loadList);

/* 启动时尝试复用已保存的令牌 */
(async function init() {
  const saved = localStorage.getItem(TOKEN_KEY);
  if (!saved) return;
  try {
    await verifyToken(saved);
    showUploadScreen();
  } catch (e) {
    localStorage.removeItem(TOKEN_KEY);
  }
})();
