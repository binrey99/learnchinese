import { renderCalendar } from './calendar.js';
import { createToast } from './toast.js';
import { initNavigation } from './navigation.js';
import { initLogin } from './login.js';
import { initRouter } from './router.js';
import { renderDashboardProgress } from './dashboard-progress.js';

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
  renderCalendar();
  initNavigation();
  initPinyinToggle();

  const showToast = createToast();
  // Đăng nhập / đăng xuất phải làm mới cả biểu đồ hoạt động lẫn lịch học theo tháng
  initLogin({
    toast: showToast,
    onAuthChanged: () => {
      renderDashboardProgress();
      renderCalendar();
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
