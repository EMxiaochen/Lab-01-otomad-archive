// 亮色 / 暗色主题切换（localStorage 持久化）
(function () {
  const STORAGE_KEY = 'video_archive_theme';
  // 将 light 类加在 html(:root) 上，使 html 背景也跟随主题切换
  const root = document.documentElement;

  // 初始化：读取已保存主题，无则跟随系统
  function initTheme() {
    let saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) {
      saved = window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
    }
    applyTheme(saved);
  }

  function applyTheme(theme) {
    if (theme === 'light') root.classList.add('light');
    else root.classList.remove('light');
    updateToggleIcon(theme);
  }

  function currentTheme() {
    return root.classList.contains('light') ? 'light' : 'dark';
  }

  function toggleTheme() {
    const next = currentTheme() === 'light' ? 'dark' : 'light';
    localStorage.setItem(STORAGE_KEY, next);
    applyTheme(next);
  }

  // 切换按钮图标与 tooltip：图标表示「将切换到」的主题
  // dark 态显示太阳（点击变亮），light 态显示月亮（点击变暗）
  function updateToggleIcon(theme) {
    const btn = document.getElementById('themeToggle');
    if (!btn) return;
    const isLight = theme === 'light';
    btn.innerHTML = isLight
      ? `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>`
      : `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/></svg>`;
    btn.title = isLight ? '切换到暗色模式' : '切换到亮色模式';
  }

  // 绑定切换按钮
  function bind() {
    const btn = document.getElementById('themeToggle');
    if (btn) btn.addEventListener('click', toggleTheme);
  }

  // 在 DOM 就绪前先应用主题（避免闪烁）
  initTheme();
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bind);
  } else {
    bind();
  }
})();
