import { supabase } from './supabase.js';

const LOCAL_SCORES_KEY = 'mandarinly_local_scores';
const CACHED_STREAK_KEY = 'mandarinly_cached_streak';
const CACHED_STREAK_INFO_KEY = 'mandarinly_cached_streak_info';

const pad = (n) => String(n).padStart(2, '0');

/**
 * Chuyển đổi timestamp bất kỳ sang chuỗi YYYY-MM-DD theo múi giờ địa phương của người dùng
 */
export function toLocalDateKey(dateInput) {
  if (!dateInput) return null;
  const d = new Date(dateInput);
  if (Number.isNaN(d.getTime())) return null;
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * Đọc điểm và hoạt động lưu tạm trong localStorage
 */
function readLocalActivities() {
  try {
    const list = JSON.parse(localStorage.getItem(LOCAL_SCORES_KEY) || '[]');
    return Array.isArray(list) ? list : [];
  } catch (err) {
    console.warn('[Streak] Lỗi đọc localStorage:', err);
    return [];
  }
}

/**
 * Thu thập tất cả các ngày (YYYY-MM-DD) người dùng từng có hoạt động học tập
 * từ cả Supabase (nếu đã đăng nhập) và localStorage (khách / ngoại tuyến).
 */
export async function fetchAllActiveDates() {
  const activeDateSet = new Set();

  // 1. Lấy dữ liệu từ localStorage trước
  const localList = readLocalActivities();
  localList.forEach((item) => {
    const key = toLocalDateKey(item?.created_at);
    if (key) activeDateSet.add(key);
  });

  // 2. Nếu đã đăng nhập, lấy dữ liệu thật từ Supabase
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      // Đọc bảng leaderboard_scores (mọi bài học, trò chơi, luyện tập đều ghi nhận tại đây)
      const { data: scores, error: scoresError } = await supabase
        .from('leaderboard_scores')
        .select('created_at')
        .eq('user_id', user.id);

      if (!scoresError && Array.isArray(scores)) {
        scores.forEach((row) => {
          const key = toLocalDateKey(row.created_at);
          if (key) activeDateSet.add(key);
        });
      }

      // Đọc thêm bảng learning_activity nếu có
      try {
        const { data: acts, error: actsError } = await supabase
          .from('learning_activity')
          .select('created_at')
          .eq('user_id', user.id);

        if (!actsError && Array.isArray(acts)) {
          acts.forEach((row) => {
            const key = toLocalDateKey(row.created_at);
            if (key) activeDateSet.add(key);
          });
        }
      } catch (_) {}
    }
  } catch (err) {
    console.warn('[Streak] Lỗi khi tải dữ liệu từ Supabase:', err);
  }

  return activeDateSet;
}

/**
 * Thuật toán tính chuỗi ngày học liên tục (Streak):
 * - Nếu hôm nay đã học: streak bắt đầu từ hôm nay và đếm lùi về trước.
 * - Nếu hôm nay chưa học nhưng hôm qua có học: chuỗi của hôm qua vẫn được BẢO LƯU (để người học kịp học hôm nay).
 * - Nếu cả hôm nay và hôm qua đều không học: chuỗi bị ngắt và trở về 0.
 */
export function calculateStreak(activeDateSet) {
  const today = new Date();
  const todayKey = toLocalDateKey(today);

  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayKey = toLocalDateKey(yesterday);

  const studiedToday = activeDateSet.has(todayKey);
  const studiedYesterday = activeDateSet.has(yesterdayKey);

  // Nếu cả hôm nay và hôm qua đều không có hoạt động -> chuỗi về 0
  if (!studiedToday && !studiedYesterday) {
    return {
      streak: 0,
      studiedToday: false,
      studiedYesterday: false,
      totalActiveDays: activeDateSet.size,
      activeDateSet
    };
  }

  // Đếm chuỗi lùi về các ngày trước
  let streak = 0;
  const checkDate = new Date(today);

  // Nếu hôm nay chưa học, bắt đầu đếm từ hôm qua
  if (!studiedToday) {
    checkDate.setDate(checkDate.getDate() - 1);
  }

  while (true) {
    const key = toLocalDateKey(checkDate);
    if (activeDateSet.has(key)) {
      streak += 1;
      checkDate.setDate(checkDate.getDate() - 1);
    } else {
      break;
    }
  }

  return {
    streak,
    studiedToday,
    studiedYesterday,
    totalActiveDays: activeDateSet.size,
    activeDateSet
  };
}

/**
 * Lấy số ngày streak đã cache để hiển thị tức thì không bị giật
 */
export function getCachedStreak() {
  try {
    const cached = localStorage.getItem(CACHED_STREAK_KEY);
    if (cached !== null) return parseInt(cached, 10) || 0;
  } catch (_) {}
  return 0;
}

/**
 * Cập nhật giao diện topbar streak badge
 */
export function updateStreakUI(streakData) {
  const streakPill = document.querySelector('.topbar-streak');
  if (!streakPill) return;

  const textEl = streakPill.querySelector('strong') || streakPill;
  const { streak, studiedToday, totalActiveDays } = streakData;

  // Cập nhật số ngày
  textEl.textContent = `${streak} ngày`;

  // Cập nhật tooltip và class trạng thái
  streakPill.classList.remove('is-active', 'is-pending', 'is-zero');

  let titleText = '';
  if (studiedToday) {
    streakPill.classList.add('is-active');
    titleText = `Chuỗi học tập: ${streak} ngày liên tục! Bạn đã học bài hôm nay ✨`;
  } else if (streak > 0) {
    streakPill.classList.add('is-pending');
    titleText = `Chuỗi học tập: ${streak} ngày! Học ngay hôm nay để duy trì chuỗi 🔥`;
  } else {
    streakPill.classList.add('is-zero');
    titleText = `Chuỗi học tập: 0 ngày. Bắt đầu bài học đầu tiên hôm nay nhé! 🔥`;
  }
  streakPill.setAttribute('title', titleText);
  streakPill.setAttribute('aria-label', titleText);

  // Lưu vào cache
  try {
    localStorage.setItem(CACHED_STREAK_KEY, String(streak));
    localStorage.setItem(CACHED_STREAK_INFO_KEY, JSON.stringify({
      streak,
      studiedToday,
      totalActiveDays,
      updatedAt: new Date().toISOString()
    }));
  } catch (_) {}

  // Cập nhật popover nếu đang mở
  updatePopoverContent(streakData);
}

/**
 * Cập nhật nội dung cửa sổ bật nhỏ (Streak Popover)
 */
function updatePopoverContent(streakData) {
  const popover = document.querySelector('#streakPopover');
  if (!popover) return;

  const daysEl = popover.querySelector('#streakPopDays');
  const statusEl = popover.querySelector('#streakPopStatus');
  const totalDaysEl = popover.querySelector('#streakPopTotalDays');
  const hintEl = popover.querySelector('#streakPopHint');

  const { streak, studiedToday, totalActiveDays } = streakData;

  if (daysEl) daysEl.textContent = `Chuỗi ${streak} ngày liên tục`;
  if (totalDaysEl) totalDaysEl.textContent = `${totalActiveDays} ngày`;

  if (statusEl) {
    statusEl.textContent = studiedToday
      ? 'Hôm nay: Đã học bài hoàn thành! ✨'
      : (streak > 0 ? 'Hôm nay: Chưa học, hãy học để giữ chuỗi! 🔥' : 'Hôm nay: Chưa có hoạt động nào');
  }

  if (hintEl) {
    if (studiedToday) {
      hintEl.textContent = 'Tuyệt vời! Hãy quay lại vào ngày mai để tiếp tục nâng cao chuỗi ngày học của bạn nhé 🐾';
    } else if (streak > 0) {
      hintEl.textContent = 'Hoàn thành bất kỳ bài tập, từ vựng hay trò chơi nào hôm nay để không bị đứt chuỗi nhé!';
    } else {
      hintEl.textContent = 'Chỉ cần học 1 bài từ vựng hoặc chơi 1 mini-game để kích hoạt ngọn lửa chuỗi ngày học!';
    }
  }
}

/**
 * Gắn Popover vào topbar streak để người dùng có thể bấm vào xem chi tiết
 */
function setupStreakPopover(getLatestData) {
  const streakPill = document.querySelector('.topbar-streak');
  if (!streakPill || streakPill.dataset.popoverBound) return;
  streakPill.dataset.popoverBound = 'true';
  streakPill.style.cursor = 'pointer';

  // Tạo phần tử popover nếu chưa có
  let popover = document.querySelector('#streakPopover');
  if (!popover) {
    popover = document.createElement('div');
    popover.id = 'streakPopover';
    popover.className = 'streak-popover';
    popover.hidden = true;
    popover.innerHTML = `
      <div class="streak-popover-header">
        <span class="streak-popover-flame">🔥</span>
        <div class="streak-popover-title-wrap">
          <strong id="streakPopDays">Chuỗi ngày học</strong>
          <span id="streakPopStatus">Đang kiểm tra...</span>
        </div>
      </div>
      <div class="streak-popover-stats">
        <div class="streak-stat-item">
          <span>Tổng số ngày học:</span>
          <strong id="streakPopTotalDays">0 ngày</strong>
        </div>
      </div>
      <p class="streak-popover-hint" id="streakPopHint">Hãy học bài mỗi ngày để tích lũy chuỗi ngày học bền bỉ!</p>
    `;
    streakPill.parentElement.style.position = 'relative';
    streakPill.parentElement.appendChild(popover);
  }

  // Bấm vào pill để toggle popover
  streakPill.addEventListener('click', (e) => {
    e.stopPropagation();
    const isHidden = popover.hidden;
    popover.hidden = !isHidden;
    if (popover.hidden === false) {
      const data = getLatestData();
      if (data) updatePopoverContent(data);
    }
  });

  // Bấm ra ngoài để đóng
  document.addEventListener('click', (e) => {
    if (!popover.hidden && !popover.contains(e.target) && !streakPill.contains(e.target)) {
      popover.hidden = true;
    }
  });
}

/**
 * Khởi tạo hệ thống theo dõi Chuỗi ngày học (Streak)
 */
export async function initStreak({ toast } = {}) {
  // 1. Áp dụng ngay dữ liệu cache để tránh giật giao diện
  const cachedStreak = getCachedStreak();
  let latestData = {
    streak: cachedStreak,
    studiedToday: false,
    totalActiveDays: cachedStreak,
    activeDateSet: new Set()
  };
  updateStreakUI(latestData);

  // 2. Thiết lập Popover tương tác
  setupStreakPopover(() => latestData);

  // 3. Hàm làm mới và tính toán lại chuỗi thực tế
  const refreshStreak = async () => {
    try {
      const activeDateSet = await fetchAllActiveDates();
      latestData = calculateStreak(activeDateSet);
      updateStreakUI(latestData);
      window.dispatchEvent(new CustomEvent('streak-recalculated', { detail: latestData }));
      return latestData;
    } catch (err) {
      console.warn('[Streak] Lỗi tính streak thực tế:', err);
      return latestData;
    }
  };

  // Tính toán ngay lần đầu
  await refreshStreak();

  // 4. Lắng nghe các sự kiện hoạt động học tập mới để tự động cập nhật ngay lập tức
  window.addEventListener('activity-recorded', async () => {
    const oldStudiedToday = latestData.studiedToday;
    const newData = await refreshStreak();

    // Nếu đây là hoạt động đầu tiên trong ngày giúp kích hoạt / duy trì chuỗi
    if (!oldStudiedToday && newData.studiedToday) {
      toast?.(`🔥 Chuỗi ngày học: ${newData.streak} ngày liên tiếp! Tuyệt vời! ✨`);
    }
  });

  // Lắng nghe khi người dùng đăng nhập / đăng xuất
  window.addEventListener('auth-changed', refreshStreak);

  // Lắng nghe khi quay lại tab (phòng trường hợp sang ngày mới)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      refreshStreak();
    }
  });

  return {
    getStreak: () => latestData,
    refresh: refreshStreak
  };
}
