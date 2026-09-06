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

function initDashboard() {
  renderCalendar();
  initNavigation();

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
