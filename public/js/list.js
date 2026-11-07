(function () {
  const grid = document.getElementById('grid');
  const empty = document.getElementById('empty');
  const pagination = document.getElementById('pagination');
  const searchInput = document.getElementById('searchInput');
  const sortSelect = document.getElementById('sortSelect');

  const state = {
    keyword: '',
    sort: 'newest',
    page: 1,
    pageSize: 12,
    total: 0
  };

  let allVideos = [];
  let searchTimer = null;

  function renderCards(videos) {
    grid.innerHTML = '';
    if (!videos.length) {
      empty.style.display = 'block';
      pagination.innerHTML = '';
      return;
    }
    empty.style.display = 'none';

    videos.forEach((v, i) => {
      const card = document.createElement('div');
      card.className = 'card';
      card.style.animationDelay = (i * 0.05) + 's';
      card.addEventListener('click', () => {
        window.location.href = 'video.html?id=' + encodeURIComponent(v.id);
      });

      // 封面 / 静音预览
      const media = v.coverImage
        ? `<img src="${v.coverImage}" alt="" loading="lazy" />`
        : `<video muted loop playsinline preload="metadata" src="${v.videoUrl}"></video>`;

      // hover 时播放静音预览
      const playVideo = (e) => {
        const vid = e.currentTarget.querySelector('video');
        if (vid) vid.play().catch(() => {});
      };
      const pauseVideo = (e) => {
        const vid = e.currentTarget.querySelector('video');
        if (vid) { vid.pause(); vid.currentTime = 0; }
      };

      const tagsHtml = (v.tags && v.tags.length)
        ? `<div class="tag-list" style="margin-top:10px">${v.tags.slice(0, 3).map(t => `<span class="tag">${escapeHtml(t)}</span>`).join('')}</div>`
        : '';

      card.innerHTML = `
        <div class="thumb">
          ${media}
          <div class="play-icon">
            <svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
          </div>
        </div>
        <div class="card-body">
          <div class="card-title">${escapeHtml(v.title)}</div>
          <div class="card-meta">
            <span class="author">${escapeHtml(v.author)}</span>
            <span>${v.publishDate}</span>
          </div>
          ${tagsHtml}
        </div>
      `;
      card.addEventListener('mouseenter', playVideo);
      card.addEventListener('mouseleave', pauseVideo);
      grid.appendChild(card);
    });
  }

  function renderPagination() {
    const totalPages = Math.max(1, Math.ceil(state.total / state.pageSize));
    if (state.total === 0) { pagination.innerHTML = ''; return; }

    pagination.innerHTML = `
      <button id="prevBtn" ${state.page <= 1 ? 'disabled' : ''}>上一页</button>
      <span class="info">第 ${state.page} / ${totalPages} 页 · 共 ${state.total} 条</span>
      <button id="nextBtn" ${state.page >= totalPages ? 'disabled' : ''}>下一页</button>
    `;
    document.getElementById('prevBtn').addEventListener('click', () => goToPage(state.page - 1));
    document.getElementById('nextBtn').addEventListener('click', () => goToPage(state.page + 1));
  }

  function goToPage(p) {
    state.page = p;
    load();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // 客户端筛选 + 排序 + 分页（静态站无服务端接口）
  function query() {
    let list = allVideos.slice();
    const k = state.keyword.trim().toLowerCase();
    if (k) {
      list = list.filter(v =>
        String(v.title || '').toLowerCase().includes(k) ||
        String(v.author || '').toLowerCase().includes(k)
      );
    }
    if (state.sort === 'oldest') {
      list.sort((a, b) => new Date(a.publishDate) - new Date(b.publishDate));
    } else if (state.sort === 'recent') {
      list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    } else {
      list.sort((a, b) => new Date(b.publishDate) - new Date(a.publishDate));
    }

    state.total = list.length;
    const totalPages = Math.max(1, Math.ceil(state.total / state.pageSize));
    if (state.page > totalPages) state.page = totalPages;
    if (state.page < 1) state.page = 1;

    const start = (state.page - 1) * state.pageSize;
    return list.slice(start, start + state.pageSize);
  }

  function load() {
    grid.classList.remove('list-fade');
    void grid.offsetWidth; // reflow
    grid.classList.add('list-fade');

    const items = query();
    renderCards(items);
    renderPagination();
  }

  function escapeHtml(s) {
    const d = document.createElement('div');
    d.textContent = s == null ? '' : String(s);
    return d.innerHTML;
  }

  searchInput.addEventListener('input', (e) => {
    clearTimeout(searchTimer);
    const val = e.target.value.trim();
    searchTimer = setTimeout(() => {
      state.keyword = val;
      state.page = 1;
      load();
    }, 280);
  });

  sortSelect.addEventListener('change', (e) => {
    state.sort = e.target.value;
    state.page = 1;
    load();
  });

  async function init() {
    try {
      const res = await fetch('data/videos.json', { cache: 'no-cache' });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = await res.json();
      allVideos = Array.isArray(data) ? data : [];
      load();
    } catch (e) {
      empty.style.display = 'block';
      empty.querySelector('p').textContent = '收藏数据加载失败，请稍后重试';
      pagination.innerHTML = '';
    }
  }

  init();
})();
