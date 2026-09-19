import { renderCalendar } from './calendar.js';
import { createToast } from './toast.js';
import { initNavigation } from './navigation.js';
import { initLessonActions } from './lessons.js';
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
  initLessonActions(showToast);
  initLogin({ toast: showToast, onAuthChanged: renderDashboardProgress });
  renderDashboardProgress();
  initRouter({ toast: showToast });

  const brandVideos = document.querySelectorAll('.topbar-brand-video, video');
  brandVideos.forEach((v) => {
    v.muted = true;
    v.play().catch(() => {});
  });
}

document.addEventListener('DOMContentLoaded', initDashboard);
