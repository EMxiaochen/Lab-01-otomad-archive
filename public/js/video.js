(function () {
  const id = new URLSearchParams(window.location.search).get('id');
  if (!id) {
    document.querySelector('.detail-wrap').innerHTML =
      '<div class="empty"><p>无效的视频 ID</p></div>';
    return;
  }

  const player = document.getElementById('player');

  async function load() {
    try {
      const res = await fetch('data/videos.json', { cache: 'no-cache' });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const list = await res.json();
      const v = (Array.isArray(list) ? list : []).find(x => String(x.id) === id);
      if (!v) throw new Error('未找到');

      document.title = v.title + ' · EM丶小陈的Lab=01音MAD收藏集';

      // 播放器
      if (v.videoUrl) {
        player.innerHTML = `
          <video controls playsinline preload="metadata"
            ${v.coverImage ? `poster="${escapeAttr(v.coverImage)}"` : ''}
            src="${escapeAttr(v.videoUrl)}"></video>
        `;
      } else {
        player.innerHTML = '<div class="player-empty">该收藏暂无可播放的视频文件</div>';
      }

      document.getElementById('title').textContent = v.title;
      document.getElementById('author').textContent = v.author || '-';
      document.getElementById('publishDate').textContent = v.publishDate || '-';
      document.getElementById('createdAt').textContent =
        v.createdAt ? new Date(v.createdAt).toLocaleString('zh-CN') : '-';

      const orig = document.getElementById('originalUrl');
      if (v.originalUrl) {
        orig.innerHTML = `<a href="${escapeAttr(v.originalUrl)}" target="_blank" rel="noopener">打开原链接 ↗</a>`;
      } else {
        orig.textContent = '-';
      }

      const desc = document.getElementById('desc');
      desc.textContent = v.description || '';
      desc.style.display = v.description ? 'block' : 'none';

      const tags = document.getElementById('tags');
      if (v.tags && v.tags.length) {
        tags.innerHTML = v.tags.map(t => `<span class="tag">${escapeHtml(t)}</span>`).join('');
      } else {
        tags.innerHTML = '';
      }
    } catch (e) {
      document.querySelector('.detail-wrap').innerHTML =
        '<div class="empty"><p>视频不存在或加载失败</p></div>';
    }
  }

  function escapeHtml(s) {
    const d = document.createElement('div');
    d.textContent = s == null ? '' : String(s);
    return d.innerHTML;
  }
  function escapeAttr(s) {
    return String(s).replace(/"/g, '&quot;');
  }

  load();
})();
