import { renderCalendar } from './calendar.js';
import { createToast } from './toast.js';
import { initNavigation } from './navigation.js';
import { initLessonActions } from './lessons.js';
import { initLogin } from './login.js';
import { initVocabulary } from './vocabulary.js';
import { initHsk } from './hsk.js';
import { initPractice } from './practice.js';
import { initMockExam } from './mock-exam.js';
import { initMaterials } from './materials.js';
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
  initVocabulary();
  initHsk();
  initPractice({ onStart: (type) => { if (type === 'translation' || type === 'sentence-order') window.location.hash = type; else showToast('Bài luyện tập đã sẵn sàng ✦'); } });
  initMockExam({ onStart: () => showToast('Đề thi thử đã được mở') });
  initMaterials({ onOpen: () => showToast('Tài liệu đã được mở') });
  renderDashboardProgress();
  initRouter({ toast: showToast });
}

document.addEventListener('DOMContentLoaded', initDashboard);
