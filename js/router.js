import { initVocabulary } from './vocabulary.js';
import { initHsk } from './hsk.js';
import { initPractice } from './practice.js';
import { initTranslation } from './translation.js';
import { initMockExam } from './mock-exam.js';
import { initMaterials } from './materials.js';
import { renderProfile } from './profile.js';
import { initLeaderboard } from './leaderboard.js';
import { initSentenceOrder } from './sentence-order.js';
import { initGame } from './game.js';

const pages = {
  vocabulary: {
    title: 'Từ vựng',
    description: 'Mở rộng vốn từ và ôn tập theo cấp độ HSK.',
    template: '<div class="page-list" data-vocabulary></div>'
  },
  hsk: {
    title: 'Lộ trình HSK',
    description: 'Theo dõi tiến độ học theo từng cấp độ HSK.',
    template: '<div class="page-list page-list-grid" data-hsk></div>'
  },
  practice: {
    title: 'Luyện tập',
    description: 'Chọn một kỹ năng để bắt đầu phiên luyện tập.',
    template: '<div class="page-list" data-practice></div>'
  },
  translation: {
    title: 'Luyện dịch tiếng Trung',
    description: 'Chọn cấp độ HSK và bắt đầu bài luyện dịch.',
    template: '<div class="page-list" data-translation></div>'
  },
  'sentence-order': {
    title: 'Sắp xếp câu tiếng Trung',
    description: 'Chọn HSK, bài học và sắp xếp các từ thành câu đúng.',
    template: '<div class="page-list" data-sentence-order></div>'
  },
  'mock-exam': {
    title: 'Thi thử',
    description: 'Làm quen với cấu trúc đề thi và kiểm tra năng lực.',
    template: '<div class="page-list" data-mock-exam></div>'
  },
  materials: {
    title: 'Tài liệu',
    description: 'Tài liệu học tập được sắp xếp để bạn tra cứu nhanh.',
    template: '<div class="page-list" data-materials></div>'
  },
  profile: {
    title: 'Hồ sơ của tôi',
    description: 'Quản lý và xem thông tin tài khoản học tập của bạn.',
    template: '<div id="profileContent"></div>'
  },
  leaderboard: {
    title: 'Bảng xếp hạng thành tích',
    description: 'Bảng vinh danh đua top học tập theo Tuần, Ngày và Toàn thời gian từ tất cả hoạt động.',
    template: '<div data-leaderboard></div>'
  },
  game: {
    title: 'Trò chơi tiếng Trung',
    description: 'Vừa chơi vừa học, ghi nhớ từ vựng tiếng Trung dễ dàng và hào hứng.',
    template: '<div data-game></div>'
  }
};

export function initRouter({ toast } = {}) {
  const dashboard = document.querySelector('.content-wrap');
  const pageView = document.querySelector('#pageView');
  if (!dashboard || !pageView) return;

  const render = () => {
    const route = window.location.hash.replace('#', '') || 'dashboard';
    const page = pages[route];
    const isDashboard = !page;

    dashboard.hidden = !isDashboard;
    pageView.hidden = isDashboard;
    document.querySelectorAll('.nav-item[data-route]').forEach((item) => {
      item.classList.toggle('active', item.dataset.route === route);
    });

    if (isDashboard) return;

    pageView.innerHTML = `
      <section class="page-header">
        <div><p class="eyebrow">MANDARINLY WORKSPACE</p><h1>${page.title}</h1><p class="subtitle">${page.description}</p></div>
        <a class="back-link" href="#dashboard">← Về dashboard</a>
      </section>
      ${page.template}
    `;

    const options = { toast };
    if (route === 'vocabulary') initVocabulary(options);
    if (route === 'hsk') initHsk(options);
    if (route === 'practice') initPractice({ onStart: (type) => { if (type === 'translation' || type === 'sentence-order') window.location.hash = type; else toast?.('Bài luyện tập đã sẵn sàng ✦'); } });
    if (route === 'translation') initTranslation(options);
    if (route === 'sentence-order') initSentenceOrder(options);
    if (route === 'mock-exam') initMockExam({ onStart: () => toast?.('Đề thi thử đã được mở') });
    if (route === 'materials') initMaterials({ onOpen: () => toast?.('Tài liệu đã được mở') });
    if (route === 'profile') renderProfile();
    if (route === 'leaderboard') initLeaderboard(options);
    if (route === 'game') initGame(options);
  };

  window.addEventListener('hashchange', render);
  render();
}
