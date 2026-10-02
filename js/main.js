import { renderCalendar } from './calendar.js';
import { createToast } from './toast.js';
import { initNavigation } from './navigation.js';
import { initLogin } from './login.js';
import { initRouter } from './router.js';
import { renderDashboardProgress } from './dashboard-progress.js';
import { initStreak } from './streak.js';
import { renderDashboardActivityAndBadges } from './recent-activity.js';
import { renderDashboardSrsBanner } from './srs-service.js';

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

  try { initStreak({ toast: showToast }); } catch (err) { console.error(err); }
  try { renderCalendar(); } catch (err) { console.error(err); }
  try { renderDashboardSrsBanner('#dashboardSrsWidget'); } catch (err) { console.error(err); }
  try { initNavigation(); } catch (err) { console.error(err); }
  try { initPinyinToggle(); } catch (err) { console.error(err); }

  // Đăng nhập / đăng xuất phải làm mới cả biểu đồ hoạt động, lịch học, hoạt động gần đây, huy hiệu và chuỗi ngày học
  try {
    initLogin({
      toast: showToast,
      onAuthChanged: () => {
        try { renderDashboardProgress(); } catch (err) { console.error(err); }
        try { renderCalendar(); } catch (err) { console.error(err); }
        try { renderDashboardActivityAndBadges({ toast: showToast }); } catch (err) { console.error(err); }
        try { renderDashboardSrsBanner('#dashboardSrsWidget'); } catch (err) { console.error(err); }
        window.dispatchEvent(new CustomEvent('auth-changed'));
      }
    });
  } catch (err) { console.error(err); }

  try { renderDashboardProgress(); } catch (err) { console.error(err); }
  try { renderDashboardActivityAndBadges({ toast: showToast }); } catch (err) { console.error(err); }
  try { initRouter({ toast: showToast }); } catch (err) { console.error(err); }

  const brandVideos = document.querySelectorAll('.topbar-brand-video, video');
  brandVideos.forEach((v) => {
    v.muted = true;
    v.play().catch(() => {});
  });
}

document.addEventListener('DOMContentLoaded', initDashboard);
