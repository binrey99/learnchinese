import { renderCalendar } from './calendar.js';
import { createToast } from './toast.js';
import { initNavigation } from './navigation.js';
import { initLogin } from './login.js';
import { initRouter } from './router.js';
import { renderDashboardProgress } from './dashboard-progress.js';
import { initStreak } from './streak.js';

function initPinyinToggle() {
  const toggle = document.querySelector('#pinyinToggle');
  if (!toggle) return;

  const isShow = localStorage.getItem('showPinyin') === 'true';
  toggle.checked = isShow;
  document.body.classList.toggle('show-pinyin', isShow);

  toggle.addEventListener('change', () => {
    const checked = toggle.checked;
    localStorage.setItem('showPinyin', String(checked));
    document.body.classList.toggle('show-pinyin', checked);
    window.dispatchEvent(new CustomEvent('pinyin-toggle-change', { detail: { showPinyin: checked } }));
  });
}

function initDashboard() {
  const showToast = createToast();

  initStreak({ toast: showToast });
  renderCalendar();
  initNavigation();
  initPinyinToggle();

  // Đăng nhập / đăng xuất phải làm mới cả biểu đồ hoạt động, lịch học và chuỗi ngày học
  initLogin({
    toast: showToast,
    onAuthChanged: () => {
      renderDashboardProgress();
      renderCalendar();
      window.dispatchEvent(new CustomEvent('auth-changed'));
    }
  });
  renderDashboardProgress();
  initRouter({ toast: showToast });

  const brandVideos = document.querySelectorAll('.topbar-brand-video, video');
  brandVideos.forEach((v) => {
    v.muted = true;
    v.play().catch(() => {});
  });
}

document.addEventListener('DOMContentLoaded', initDashboard);
