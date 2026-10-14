import { supabase } from './supabase.js';
import { toLocalDateKey, calculateStreak } from './streak.js';

function getLearnerTitle(points = 0) {
  if (points >= 1000) return { title: 'Bậc Thầy Tiếng Trung', badge: '👑 Hạng Hoàng Kim', color: '#eab308' };
  if (points >= 500) return { title: 'Cao Thủ Mandarinly', badge: '🥇 Hạng Bạch Kim', color: '#f59e0b' };
  if (points >= 200) return { title: 'Học Bá Tiềm Năng', badge: '🥈 Hạng Vàng', color: '#10b981' };
  if (points >= 50) return { title: 'Tập Sự Chăm Chỉ', badge: '🥉 Hạng Bạc', color: '#3b82f6' };
  return { title: 'Tân Binh Khởi Đầu', badge: '☘️ Hạng Đồng', color: '#6b7280' };
}

const LOCAL_SCORES_KEY = 'mandarinly_local_scores';
const LOCAL_MASTERED_KEY = 'mandarinly_local_mastered';
const UNLOCKED_BADGES_CACHE_KEY = 'mandarinly_unlocked_badges_v1';

let listenersBound = false;
let currentDashboardFilter = 'all';
let cachedBundle = null;
let globalToast = null;

function escapeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Định dạng thời gian tương đối tiếng Việt thân thiện
 */
export function formatRelativeTime(isoString) {
  if (!isoString) return 'Gần đây';
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return 'Gần đây';

  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);

  if (diffSec < 60) return 'Vừa xong';
  if (diffMin < 60) return `${diffMin} phút trước`;
  if (diffHour < 24 && date.getDate() === now.getDate()) {
    return `${diffHour} giờ trước`;
  }

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (
    date.getDate() === yesterday.getDate() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getFullYear() === yesterday.getFullYear()
  ) {
    const hh = String(date.getHours()).padStart(2, '0');
    const mm = String(date.getMinutes()).padStart(2, '0');
    return `Hôm qua, ${hh}:${mm}`;
  }

  const diffDays = Math.floor(diffHour / 24);
  if (diffDays < 7) return `${diffDays} ngày trước`;

  return date.toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
}

/**
 * Thông tin hiển thị cho từng loại hoạt động
 */
export function getCategoryMeta(category = '', description = '') {
  const descLower = String(description || '').toLowerCase();

  if (category === 'vocabulary') {
    const isMastered = descLower.includes('thuộc');
    return {
      icon: isMastered ? '★' : '📖',
      colorClass: isMastered ? 'yellow' : 'green',
      label: isMastered ? 'Thuộc từ vựng' : 'Học từ vựng',
      route: '#vocabulary',
      group: 'vocab'
    };
  }
  if (category === 'practice') {
    return {
      icon: '🖌️',
      colorClass: 'purple',
      label: 'Tập viết chữ Hán',
      route: '#writing',
      group: 'practice'
    };
  }
  if (category === 'translation') {
    return {
      icon: '✍️',
      colorClass: 'blue',
      label: 'Luyện dịch câu',
      route: '#translation',
      group: 'practice'
    };
  }
  if (category === 'sentence_order') {
    return {
      icon: '🧩',
      colorClass: 'teal',
      label: 'Sắp xếp câu',
      route: '#sentence-order',
      group: 'practice'
    };
  }
  if (category === 'mock_exam') {
    return {
      icon: '📝',
      colorClass: 'orange',
      label: 'Thi thử HSK',
      route: '#mock-exam',
      group: 'game'
    };
  }
  if (category === 'streak') {
    return {
      icon: '🔥',
      colorClass: 'orange',
      label: 'Chuỗi ngày học',
      route: '#dashboard',
      group: 'game'
    };
  }
  if (category === 'game' || category === 'battle') {
    if (descLower.includes('1v1') || descLower.includes('đấu trường')) {
      return {
        icon: '⚔️',
        colorClass: 'red',
        label: 'Đấu trường 1v1',
        route: '#battle',
        group: 'game'
      };
    }
    if (descLower.includes('lulu')) {
      return {
        icon: '🐾',
        colorClass: 'yellow',
        label: 'Học cùng LuLu',
        route: '#lulu',
        group: 'game'
      };
    }
    return {
      icon: '🎮',
      colorClass: 'purple',
      label: 'Trò chơi từ vựng',
      route: '#game',
      group: 'game'
    };
  }

  return {
    icon: '✦',
    colorClass: 'green',
    label: 'Hoạt động học tập',
    route: '#vocabulary',
    group: 'vocab'
  };
}

/**
 * Danh sách 12 Huy hiệu chuẩn dùng chung cho cả Trang chủ, Trang Hoạt động và Hồ sơ
 */
export function buildBadgesList({
  streak = 0,
  totalPoints = 0,
  masteredCount = 0,
  translationPoints = 0,
  gamePoints = 0,
  examPoints = 0,
  writingPoints = 0
} = {}) {
  const raw = [
    {
      id: 'first_step',
      icon: '🌱',
      name: 'Bước Đầu Khám Phá',
      desc: 'Tích lũy 10 điểm học tập đầu tiên',
      target: 10,
      current: Math.min(totalPoints, 10),
      unit: 'điểm',
      route: '#vocabulary'
    },
    {
      id: 'streak_3',
      icon: '🔥',
      name: 'Chăm Chỉ 3 Ngày',
      desc: 'Duy trì chuỗi học 3 ngày liên tiếp',
      target: 3,
      current: Math.min(streak, 3),
      unit: 'ngày',
      route: '#vocabulary'
    },
    {
      id: 'vocab_5',
      icon: '📖',
      name: 'Vốn Từ Khởi Động',
      desc: 'Đánh dấu thuộc từ 5 từ vựng HSK trở lên',
      target: 5,
      current: Math.min(masteredCount, 5),
      unit: 'từ',
      route: '#vocabulary'
    },
    {
      id: 'writing_master',
      icon: '🖌️',
      name: 'Nghệ Nhân Thư Pháp',
      desc: 'Đạt 40 điểm tập viết nét chữ Hán',
      target: 40,
      current: Math.min(writingPoints, 40),
      unit: 'điểm',
      route: '#writing'
    },
    {
      id: 'translator',
      icon: '✍️',
      name: 'Thông Dịch Viên',
      desc: 'Đạt 60 điểm bài tập luyện dịch & xếp câu',
      target: 60,
      current: Math.min(translationPoints, 60),
      unit: 'điểm',
      route: '#practice'
    },
    {
      id: 'gamer',
      icon: '⚔️',
      name: 'Chiến Thần Đấu Trường',
      desc: 'Đạt 60 điểm trò chơi hoặc thi đấu 1v1',
      target: 60,
      current: Math.min(gamePoints, 60),
      unit: 'điểm',
      route: '#game'
    },
    {
      id: 'vocab_20',
      icon: '📚',
      name: 'Bậc Thầy Từ Vựng',
      desc: 'Đánh dấu thuộc 20 từ vựng tiếng Trung',
      target: 20,
      current: Math.min(masteredCount, 20),
      unit: 'từ',
      route: '#vocabulary'
    },
    {
      id: 'streak_7',
      icon: '⚡',
      name: 'Chiến Binh 7 Ngày',
      desc: 'Học tập bền bỉ 7 ngày liên tiếp không nghỉ',
      target: 7,
      current: Math.min(streak, 7),
      unit: 'ngày',
      route: '#vocabulary'
    },
    {
      id: 'exam_master',
      icon: '📝',
      name: 'Chinh Phục Thi Thử',
      desc: 'Hoàn thành bài thi thử năng lực HSK',
      target: 100,
      current: Math.min(examPoints, 100),
      unit: 'điểm',
      route: '#mock-exam'
    },
    {
      id: 'vocab_50',
      icon: '🎓',
      name: 'Từ Điển Sống HSK',
      desc: 'Làm chủ 50 từ vựng trong kho từ HSK',
      target: 50,
      current: Math.min(masteredCount, 50),
      unit: 'từ',
      route: '#vocabulary'
    },
    {
      id: 'scholar_500',
      icon: '🥇',
      name: 'Học Bá LuLu',
      desc: 'Đạt cột mốc 500 điểm tích lũy toàn diện',
      target: 500,
      current: Math.min(totalPoints, 500),
      unit: 'điểm',
      route: '#leaderboard'
    },
    {
      id: 'legend_1000',
      icon: '👑',
      name: 'Huyền Thoại Hán Ngữ',
      desc: 'Tích lũy xuất sắc 1000 điểm toàn năng',
      target: 1000,
      current: Math.min(totalPoints, 1000),
      unit: 'điểm',
      route: '#leaderboard'
    }
  ];

  return raw.map((b) => {
    const percent = Math.min(100, Math.round((b.current / b.target) * 100));
    return {
      ...b,
      percent,
      unlocked: b.current >= b.target
    };
  });
}

function readLocalScores() {
  try {
    const parsed = JSON.parse(localStorage.getItem(LOCAL_SCORES_KEY) || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch (_) {
    return [];
  }
}

/**
 * Tải toàn bộ dữ liệu hoạt động và tính toán huy hiệu của học viên
 */
export async function loadUserActivityAndBadges() {
  let user = null;
  try {
    const { data } = await supabase.auth.getUser();
    user = data?.user || null;
  } catch (_) {}

  let remoteScores = [];
  if (user) {
    try {
      const { data, error } = await supabase
        .from('leaderboard_scores')
        .select('category, points, description, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(150);
      if (!error && Array.isArray(data)) {
        remoteScores = data;
      }
    } catch (_) {}
  }

  const localScores = readLocalScores()
    .slice()
    .sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());

  // Gộp dữ liệu (ưu tiên Supabase khi đã đăng nhập, bổ sung local nếu vừa ghi tức thì)
  const combinedScores = [];
  const seenKeys = new Set();

  const pushUnique = (item) => {
    if (!item) return;
    const ts = item.created_at ? item.created_at.slice(0, 16) : '';
    const key = `${item.category}|${item.points}|${item.description || ''}|${ts}`;
    if (seenKeys.has(key)) return;
    seenKeys.add(key);
    combinedScores.push({
      category: item.category || 'vocabulary',
      points: Number(item.points) || 0,
      description: item.description || 'Hoạt động học tập',
      created_at: item.created_at || new Date().toISOString()
    });
  };

  if (user && remoteScores.length > 0) {
    remoteScores.forEach(pushUnique);
    // Thêm các bản ghi local rất mới (trong vòng 2 phút gần nhất) phòng trường hợp mạng trễ
    const twoMinAgo = Date.now() - 2 * 60 * 1000;
    localScores.forEach((item) => {
      if (new Date(item.created_at || 0).getTime() >= twoMinAgo) {
        pushUnique(item);
      }
    });
  } else {
    localScores.forEach(pushUnique);
  }

  combinedScores.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  // Đếm số từ đã thuộc
  let masteredCount = 0;
  if (user) {
    try {
      const { count, error } = await supabase
        .from('vocabulary_mastery')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id);
      if (!error && typeof count === 'number') {
        masteredCount = count;
      }
    } catch (_) {}
  }
  if (!masteredCount) {
    try {
      const localMastered = JSON.parse(localStorage.getItem(LOCAL_MASTERED_KEY) || '[]');
      if (Array.isArray(localMastered) && localMastered.length > 0) {
        masteredCount = localMastered.length;
      } else {
        // Ước tính từ số lần đánh dấu thuộc từ vựng trong lịch sử điểm
        masteredCount = combinedScores.filter(
          (r) => r.category === 'vocabulary' && String(r.description || '').toLowerCase().includes('thuộc')
        ).length;
      }
    } catch (_) {}
  }

  // Tính toán điểm theo nhóm
  const totalPoints = combinedScores.reduce((sum, r) => sum + Number(r.points || 0), 0);
  const translationPoints = combinedScores
    .filter((r) => r.category === 'translation' || r.category === 'sentence_order')
    .reduce((sum, r) => sum + Number(r.points || 0), 0);
  const gamePoints = combinedScores
    .filter((r) => r.category === 'game' || r.category === 'battle')
    .reduce((sum, r) => sum + Number(r.points || 0), 0);
  const examPoints = combinedScores
    .filter((r) => r.category === 'mock_exam')
    .reduce((sum, r) => sum + Number(r.points || 0), 0);
  const writingPoints = combinedScores
    .filter((r) => r.category === 'practice')
    .reduce((sum, r) => sum + Number(r.points || 0), 0);

  // Tính chuỗi ngày học
  const activeDateSet = new Set();
  combinedScores.forEach((row) => {
    const key = toLocalDateKey(row?.created_at);
    if (key) activeDateSet.add(key);
  });
  const streakInfo = calculateStreak(activeDateSet);

  const badges = buildBadgesList({
    streak: streakInfo.streak,
    totalPoints,
    masteredCount,
    translationPoints,
    gamePoints,
    examPoints,
    writingPoints
  });

  const learnerInfo = getLearnerTitle(totalPoints);

  return {
    user,
    activities: combinedScores,
    totalPoints,
    masteredCount,
    translationPoints,
    gamePoints,
    examPoints,
    writingPoints,
    streak: streakInfo.streak,
    badges,
    learnerInfo
  };
}

/**
 * Kiểm tra xem có huy hiệu nào mới mở khóa để bắn thông báo chúc mừng
 */
function checkNewlyUnlockedBadges(badges, toast) {
  try {
    const unlockedIds = badges.filter((b) => b.unlocked).map((b) => b.id);
    const rawSaved = localStorage.getItem(UNLOCKED_BADGES_CACHE_KEY);

    if (rawSaved === null) {
      localStorage.setItem(UNLOCKED_BADGES_CACHE_KEY, JSON.stringify(unlockedIds));
      return;
    }

    const prevSet = new Set(JSON.parse(rawSaved));
    const newlyUnlocked = badges.filter((b) => b.unlocked && !prevSet.has(b.id));

    localStorage.setItem(UNLOCKED_BADGES_CACHE_KEY, JSON.stringify(unlockedIds));

    if (newlyUnlocked.length > 0 && toast) {
      const first = newlyUnlocked[0];
      toast(`🏅 Mở khóa huy hiệu mới: ${first.icon} ${first.name}!`);
    }
  } catch (_) {}
}

/**
 * Render bảng Hoạt động gần đây trên Trang chủ
 */
function renderRecentActivityCard(panel, bundle) {
  if (!panel) return;

  const { activities, totalPoints, user } = bundle;

  const filters = [
    { id: 'all', label: 'Tất cả' },
    { id: 'vocab', label: 'Từ vựng' },
    { id: 'practice', label: 'Luyện tập' },
    { id: 'game', label: 'Trò chơi & Thi' }
  ];

  const filtered = activities.filter((item) => {
    if (currentDashboardFilter === 'all') return true;
    const meta = getCategoryMeta(item.category, item.description);
    return meta.group === currentDashboardFilter;
  });

  const topItems = filtered.slice(0, 6);
  const subtitle = activities.length
    ? `${activities.length} hoạt động đã ghi nhận · Tổng ${totalPoints.toLocaleString('vi-VN')} điểm`
    : user
      ? 'Bắt đầu học bài đầu tiên hôm nay để ghi dấu cột mốc!'
      : 'Học tập ngay để tích điểm (Đăng nhập để đồng bộ đám mây)';

  panel.innerHTML = `
    <div class="panel-heading activity-panel-heading">
      <div>
        <h2>Hoạt động gần đây</h2>
        <p>${escapeHtml(subtitle)}</p>
      </div>
      <a class="text-link activity-view-all-link" href="#activity">Xem tất cả →</a>
    </div>

    <div class="activity-filter-tabs" role="tablist" aria-label="Lọc hoạt động gần đây">
      ${filters
        .map(
          (f) => `
        <button type="button" class="activity-filter-chip ${currentDashboardFilter === f.id ? 'active' : ''}" data-activity-filter="${f.id}">
          ${f.label}
        </button>
      `
        )
        .join('')}
    </div>

    ${
      topItems.length > 0
        ? `
      <div class="activity-list">
        ${topItems
          .map((item) => {
            const meta = getCategoryMeta(item.category, item.description);
            const relTime = formatRelativeTime(item.created_at);
            return `
            <a class="activity-row activity-row-link" href="${meta.route}" title="Đi tới ${escapeHtml(meta.label)}">
              <div class="activity-icon ${meta.colorClass}">${meta.icon}</div>
              <div class="activity-main-info">
                <strong>${escapeHtml(item.description || meta.label)}</strong>
                <span>${escapeHtml(meta.label)}</span>
              </div>
              <div class="activity-meta-right">
                <b class="activity-points-pill">+${item.points}đ</b>
                <time>${escapeHtml(relTime)}</time>
              </div>
            </a>
          `;
          })
          .join('')}
      </div>
    `
        : `
      <div class="activity-empty-box">
        <div class="activity-empty-icon">🌱</div>
        <strong>${currentDashboardFilter === 'all' ? 'Chưa có hoạt động nào gần đây' : 'Chưa có hoạt động thuộc nhóm này'}</strong>
        <p>Hoàn thành từ vựng, tập viết, dịch câu hoặc chơi trò chơi để tích điểm và mở khóa huy hiệu nhé!</p>
        <div class="activity-empty-actions">
          <a href="#vocabulary" class="activity-quick-cta">📖 Học từ vựng</a>
          <a href="#writing" class="activity-quick-cta">🖌️ Tập viết</a>
          <a href="#game" class="activity-quick-cta">🎮 Chơi game</a>
        </div>
      </div>
    `
    }
  `;

  panel.querySelectorAll('[data-activity-filter]').forEach((btn) => {
    btn.addEventListener('click', () => {
      currentDashboardFilter = btn.dataset.activityFilter || 'all';
      renderRecentActivityCard(panel, bundle);
    });
  });
}

function bindDashboardListeners() {
  if (listenersBound) return;
  listenersBound = true;

  const refreshAll = async () => {
    try {
      const bundle = await loadUserActivityAndBadges();
      cachedBundle = bundle;
      const activityPanel = document.querySelector('#recentActivityPanel');
      if (activityPanel) renderRecentActivityCard(activityPanel, bundle);
    } catch (err) {
      console.warn('Không thể làm mới Hoạt động gần đây:', err);
    }
  };

  window.addEventListener('activity-recorded', () => refreshAll());
  window.addEventListener('auth-changed', () => refreshAll());
  window.addEventListener('hashchange', () => {
    if ((window.location.hash.replace('#', '') || 'dashboard') === 'dashboard') {
      refreshAll();
    }
  });
}

/**
 * Khởi tạo và hiển thị bảng Hoạt động gần đây trên Trang chủ
 */
export async function renderDashboardActivityAndBadges({ toast } = {}) {
  if (toast) globalToast = toast;
  bindDashboardListeners();

  const activityPanel = document.querySelector('#recentActivityPanel');
  const badgesPanel = document.querySelector('#dashboardBadgesPanel');
  if (badgesPanel) badgesPanel.remove();
  if (!activityPanel) return;

  try {
    const bundle = await loadUserActivityAndBadges();
    cachedBundle = bundle;
    renderRecentActivityCard(activityPanel, bundle);
  } catch (err) {
    console.warn('Lỗi khi tải Hoạt động gần đây trang chủ:', err);
  }
}

/**
 * Trang chi tiết #activity ("Xem tất cả" Nhật ký Hoạt động)
 */
export async function initActivityPage({ toast } = {}) {
  if (toast) globalToast = toast;
  const container = document.querySelector('[data-activity-page]');
  if (!container) return;

  container.innerHTML = `
    <div class="profile-loading-box">
      <div class="profile-spinner"></div>
      <p>Đang tải nhật ký hoạt động...</p>
    </div>
  `;

  const bundle = await loadUserActivityAndBadges();
  cachedBundle = bundle;

  const { activities, totalPoints, masteredCount, streak } = bundle;
  let categoryFilter = 'all'; // 'all' | 'vocab' | 'practice' | 'game'

  const renderPageContent = () => {
    const filteredActivities = activities.filter((act) => {
      if (categoryFilter === 'all') return true;
      const meta = getCategoryMeta(act.category, act.description);
      return meta.group === categoryFilter;
    });

    container.innerHTML = `
      <div class="activity-page-wrap">
        <!-- Thanh điều hướng đầu trang -->
        <div class="activity-page-header">
          <div class="activity-page-title-group">
            <a href="#dashboard" class="activity-back-btn">← Trang chủ</a>
            <div>
              <h2>Nhật ký Hoạt động Học tập</h2>
              <p>Theo dõi lịch sử các bài học và điểm thưởng bạn đã đạt được cùng LuLu</p>
            </div>
          </div>
        </div>

        <!-- 3 Thẻ tóm tắt thành tích -->
        <div class="activity-summary-cards" style="grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));">
          <div class="activity-stat-card">
            <span class="activity-stat-emoji">🏆</span>
            <div>
              <strong>${totalPoints.toLocaleString('vi-VN')}</strong>
              <small>Tổng điểm tích lũy</small>
            </div>
          </div>
          <div class="activity-stat-card">
            <span class="activity-stat-emoji">🔥</span>
            <div>
              <strong>${streak} ngày</strong>
              <small>Chuỗi học liên tiếp</small>
            </div>
          </div>
          <div class="activity-stat-card">
            <span class="activity-stat-emoji">📚</span>
            <div>
              <strong>${masteredCount} từ</strong>
              <small>Từ vựng đã thuộc</small>
            </div>
          </div>
        </div>

        <!-- Toàn bộ lịch sử hoạt động -->
        <section class="panel activity-full-section">
          <div class="activity-section-top">
            <div>
              <h3>📜 Nhật ký hoạt động chi tiết (${filteredActivities.length})</h3>
              <p>Tất cả các lượt học từ vựng, tập viết, luyện dịch, thi thử và trò chơi của bạn</p>
            </div>
            <div class="activity-filter-tabs">
              <button type="button" class="activity-filter-chip ${categoryFilter === 'all' ? 'active' : ''}" data-cat-filter="all">Tất cả</button>
              <button type="button" class="activity-filter-chip ${categoryFilter === 'vocab' ? 'active' : ''}" data-cat-filter="vocab">Từ vựng</button>
              <button type="button" class="activity-filter-chip ${categoryFilter === 'practice' ? 'active' : ''}" data-cat-filter="practice">Tập viết & Dịch</button>
              <button type="button" class="activity-filter-chip ${categoryFilter === 'game' ? 'active' : ''}" data-cat-filter="game">Trò chơi & Thi</button>
            </div>
          </div>

          ${
            filteredActivities.length > 0
              ? `
            <div class="activity-list activity-full-list">
              ${filteredActivities
                .slice(0, 60)
                .map((item) => {
                  const meta = getCategoryMeta(item.category, item.description);
                  const relTime = formatRelativeTime(item.created_at);
                  const fullTime = item.created_at
                    ? new Date(item.created_at).toLocaleString('vi-VN', {
                        dateStyle: 'short',
                        timeStyle: 'short'
                      })
                    : '';
                  return `
                  <a class="activity-row activity-row-link" href="${meta.route}">
                    <div class="activity-icon ${meta.colorClass}">${meta.icon}</div>
                    <div class="activity-main-info">
                      <strong>${escapeHtml(item.description || meta.label)}</strong>
                      <span>${escapeHtml(meta.label)} ${fullTime ? `· ${fullTime}` : ''}</span>
                    </div>
                    <div class="activity-meta-right">
                      <b class="activity-points-pill">+${item.points} điểm</b>
                      <time>${escapeHtml(relTime)}</time>
                    </div>
                  </a>
                `;
                })
                .join('')}
            </div>
          `
              : `
            <div class="activity-empty-box">
              <div class="activity-empty-icon">🌱</div>
              <strong>Chưa có hoạt động nào trong danh mục này</strong>
              <p>Hãy chọn một bài học bất kỳ để bắt đầu tích lũy điểm thưởng nhé!</p>
              <div class="activity-empty-actions">
                <a href="#vocabulary" class="activity-quick-cta">📖 Học từ vựng</a>
                <a href="#writing" class="activity-quick-cta">🖌️ Tập viết</a>
                <a href="#practice" class="activity-quick-cta">✍️ Luyện tập</a>
              </div>
            </div>
          `
          }
        </section>
      </div>
    `;

    container.querySelectorAll('[data-cat-filter]').forEach((btn) => {
      btn.addEventListener('click', () => {
        categoryFilter = btn.dataset.catFilter || 'all';
        renderPageContent();
      });
    });
  };

  renderPageContent();
}
