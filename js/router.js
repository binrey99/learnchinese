import { initVocabulary } from './vocabulary.js';
import { initWriting } from './writing.js';
import { initHsk } from './hsk.js';
import { initPractice } from './practice.js';
import { initTranslation } from './translation.js';
import { initMockExam } from './mock-exam.js';
import { initMaterials } from './materials.js';
import { renderProfile } from './profile.js';
import { initLeaderboard } from './leaderboard.js';
import { initSentenceOrder } from './sentence-order.js';
import { initGame } from './game.js';
import { initBattle } from './battle.js';
import { initLulu } from './lulu.js';

const pages = {
  vocabulary: {
    title: 'Từ vựng & Thẻ',
    description: 'Tra cứu danh sách từ vựng và ôn luyện phản xạ qua thẻ ghi nhớ Flashcard 3D theo cấp độ HSK.',
    template: '<div class="page-list" data-vocabulary></div>'
  },
  writing: {
    title: 'Tập viết chữ Hán',
    description: 'Luyện viết từng nét chữ Hán trên ô kẻ 米字格 chuẩn mực theo từng cấp độ.',
    template: '<div class="page-list" data-writing></div>'
  },
  hsk: {
    title: 'Tập viết chữ Hán',
    description: 'Luyện viết từng nét chữ Hán trên ô kẻ 米字格 chuẩn mực theo từng cấp độ.',
    template: '<div class="page-list" data-writing></div>'
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
  },
  battle: {
    title: 'Đấu trường 1v1',
    description: 'Thi đấu trực tiếp thời gian thực với đối thủ qua các dạng câu hỏi tiếng Trung.',
    template: '<div data-battle></div>'
  },
  lulu: {
    title: 'Nuôi LuLu',
    description: 'Chăm sóc bé Capybara LuLu, cho ăn, tắm suối nước nóng và cùng nhau học tiếng Trung.',
    template: '<div data-lulu></div>'
  }
};

export function initRouter({ toast } = {}) {
  const dashboard = document.querySelector('.content-wrap');
  const pageView = document.querySelector('#pageView');
  if (!dashboard || !pageView) return;

  let currentRoute = null;

  const render = () => {
    let route = window.location.hash.replace('#', '') || 'dashboard';

    // Xử lý khi đăng nhập OAuth Google chuyển hướng về có chứa access_token trong hash
    if (route.startsWith('access_token') || route.startsWith('error_description') || route.startsWith('refresh_token')) {
      route = 'dashboard';
      setTimeout(() => {
        history.replaceState(null, document.title, window.location.pathname + window.location.search);
      }, 500);
    }

    const page = pages[route];
    const isDashboard = !page;

    dashboard.hidden = !isDashboard;
    pageView.hidden = isDashboard;
    document.querySelectorAll('.nav-item[data-route]').forEach((item) => {
      item.classList.toggle('active', item.dataset.route === route);
    });

    if (isDashboard) {
      currentRoute = null;
      return;
    }

    // Tránh render lại nếu đang ở cùng route (giữ nguyên state)
    if (route === currentRoute) return;
    currentRoute = route;

    pageView.innerHTML = `
      ${page.template}
    `;

    // Scroll về đầu trang khi chuyển route
    window.scrollTo({ top: 0, behavior: 'smooth' });

    const options = { toast };
    try {
      if (route === 'vocabulary') initVocabulary(options);
      if (route === 'writing' || route === 'hsk') initWriting(options);
      if (route === 'practice') initPractice({ onStart: (type) => { if (type === 'translation' || type === 'sentence-order') window.location.hash = type; else toast?.('Bài luyện tập đã sẵn sàng ✦'); } });
      if (route === 'translation') initTranslation(options);
      if (route === 'sentence-order') initSentenceOrder(options);
      if (route === 'mock-exam') initMockExam({ onStart: () => toast?.('Đề thi thử đã được mở') });
      if (route === 'materials') initMaterials({ onOpen: () => toast?.('Tài liệu đã được mở') });
      if (route === 'profile') renderProfile(options);
      if (route === 'leaderboard') initLeaderboard(options);
      if (route === 'game') initGame(options);
      if (route === 'battle') initBattle(options);
      if (route === 'lulu') initLulu(options);
    } catch (err) {
      console.error('[Router] Lỗi khi khởi tạo trang:', route, err);
    }
  };

  // Lắng nghe hashchange (khi hash thay đổi sang route khác)
  window.addEventListener('hashchange', render);

  // Fix: Lắng nghe click để xử lý trường hợp hash không thay đổi
  // (hashchange không fire) khi user click lại cùng một route
  document.addEventListener('click', (e) => {
    const link = e.target.closest('a[href^="#"]');
    if (!link) return;
    const targetHash = link.getAttribute('href').replace('#', '');
    if (!targetHash || targetHash === 'top') return;
    if (window.location.hash === `#${targetHash}`) {
      e.preventDefault();
      render();
    }
  });

  // Render ngay khi khởi tạo để xử lý trường hợp load thẳng vào một route
  render();
}
