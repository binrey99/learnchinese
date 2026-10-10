import { supabase } from './supabase.js';

const LOCAL_SCORES_KEY = 'mandarinly_local_scores';

const pad = (value) => String(value).padStart(2, '0');
const toDateKey = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
const firstDayOfMonth = (year, month) => new Date(year, month, 1, 0, 0, 0, 0);
const firstDayOfNextMonth = (year, month) => new Date(year, month + 1, 1, 0, 0, 0, 0);

// Trạng thái dùng chung giữa các lần render (đổi tháng, đăng nhập/đăng xuất, quay lại dashboard)
let currentView = null;
let listenersBound = false;

function readLocalScores() {
  try {
    const cached = JSON.parse(localStorage.getItem(LOCAL_SCORES_KEY) || '[]');
    return Array.isArray(cached) ? cached : [];
  } catch (error) {
    console.warn('Không đọc được điểm lưu tạm trên máy:', error);
    return [];
  }
}

/**
 * Đếm số hoạt động học tập theo từng ngày trong tháng.
 * - Người đã đăng nhập: đọc leaderboard_scores (mọi hoạt động đều ghi một dòng điểm kèm created_at).
 * - Luôn gộp thêm cache local (mandarinly_local_scores) để khách hoặc lúc mất mạng vẫn thấy lịch học.
 */
async function loadMonthlyActivity(year, month) {
  const start = firstDayOfMonth(year, month);
  const end = firstDayOfNextMonth(year, month);
  const activity = new Map();
  let signedIn = false;

  const addActivity = (occurredAt) => {
    const date = new Date(occurredAt);
    if (Number.isNaN(date.getTime()) || date < start || date >= end) return;
    const key = toDateKey(date);
    activity.set(key, (activity.get(key) || 0) + 1);
  };

  try {
    const { data: { user } } = await supabase.auth.getUser();
    signedIn = Boolean(user);

    if (user) {
      const { data, error } = await supabase
        .from('leaderboard_scores')
        .select('created_at')
        .eq('user_id', user.id)
        .gte('created_at', start.toISOString())
        .lt('created_at', end.toISOString());

      if (error) throw error;
      (data || []).forEach((row) => addActivity(row.created_at));
    }
  } catch (error) {
    console.warn('Không tải được hoạt động học tập theo tháng:', error?.message || error);
  }

  readLocalScores().forEach((item) => addActivity(item.created_at));

  return { activity, signedIn };
}

function renderView(view) {
  const { days, monthLabel, summary, nextButton } = view.elements;
  const today = new Date();
  const todayKey = toDateKey(today);

  if (monthLabel) monthLabel.textContent = `Tháng ${view.month + 1}, ${view.year}`;

  const firstDay = firstDayOfMonth(view.year, view.month);
  const daysInMonth = new Date(view.year, view.month + 1, 0).getDate();
  const leadingBlanks = (firstDay.getDay() + 6) % 7; // Cột đầu tuần là Thứ Hai
  const totalCells = Math.ceil((leadingBlanks + daysInMonth) / 7) * 7;

  let activeDays = 0;
  let activeCount = 0;
  const cells = [];

  for (let index = 0; index < totalCells; index += 1) {
    const dayNumber = index - leadingBlanks + 1;
    const date = new Date(view.year, view.month, dayNumber);
    const key = toDateKey(date);
    const belongsToMonth = dayNumber >= 1 && dayNumber <= daysInMonth;
    const count = view.activity.get(key) || 0;

    if (belongsToMonth && count) {
      activeDays += 1;
      activeCount += count;
    }

    const classes = [];
    if (!belongsToMonth) classes.push('muted');
    if (count) classes.push('done');
    if (key === todayKey) classes.push('today');

    const title = count ? ` title="${count} hoạt động học tập"` : '';
    cells.push(`<span class="${classes.join(' ')}"${title}>${date.getDate()}</span>`);
  }

  days.innerHTML = cells.join('');

  if (nextButton) {
    // Hoạt động học tập không thể ở tương lai nên chặn xem trước các tháng sau tháng hiện tại
    nextButton.disabled = view.year === today.getFullYear() && view.month === today.getMonth();
  }

  if (summary) {
    if (view.loading) summary.textContent = 'Đang tải hoạt động học tập…';
    else if (activeDays) summary.textContent = `${activeDays} ngày có hoạt động · ${activeCount} lượt học trong tháng`;
    else if (!view.signedIn) summary.textContent = 'Đăng nhập để lịch học ghi lại hoạt động của bạn';
    else summary.textContent = 'Tháng này chưa có hoạt động nào. Bắt đầu một bài học nhé!';
  }
}

async function refreshView(view = currentView) {
  if (!view) return;

  view.loading = true;
  renderView(view);

  const { activity, signedIn } = await loadMonthlyActivity(view.year, view.month);
  view.activity = activity;
  view.signedIn = signedIn;
  view.loading = false;
  renderView(view);
}

function changeMonth(step) {
  if (!currentView) return;

  const target = new Date(currentView.year, currentView.month + step, 1);
  currentView.year = target.getFullYear();
  currentView.month = target.getMonth();
  currentView.activity = new Map();
  refreshView();
}

/**
 * Vẽ lịch học theo tháng thật của máy người dùng kèm dấu ngày có hoạt động.
 * Gọi lại hàm này (ví dụ sau khi đăng nhập) sẽ chỉ nạp lại dữ liệu, không nhân đôi sự kiện.
 */
export function renderCalendar({
  daysSelector = '#calendarDays',
  monthLabelSelector = '#calendarMonthLabel',
  summarySelector = '#calendarSummary',
  prevSelector = '[data-calendar-prev]',
  nextSelector = '[data-calendar-next]'
} = {}) {
  const days = document.querySelector(daysSelector);
  if (!days) return;

  const now = new Date();
  if (!currentView) {
    currentView = {
      year: now.getFullYear(),
      month: now.getMonth(),
      activity: new Map(),
      loading: true,
      signedIn: false,
      elements: {}
    };
  }

  currentView.elements = {
    days,
    monthLabel: document.querySelector(monthLabelSelector),
    summary: document.querySelector(summarySelector),
    prevButton: document.querySelector(prevSelector),
    nextButton: document.querySelector(nextSelector)
  };

  if (!listenersBound) {
    listenersBound = true;
    currentView.elements.prevButton?.addEventListener('click', () => changeMonth(-1));
    currentView.elements.nextButton?.addEventListener('click', () => changeMonth(1));

    const refreshIfDashboardVisible = () => {
      const dashboard = document.querySelector('.content-wrap');
      if (dashboard && !dashboard.hidden) refreshView();
    };

    window.addEventListener('hashchange', () => {
      if ((window.location.hash.replace('#', '') || 'dashboard') === 'dashboard') refreshIfDashboardVisible();
    });
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) refreshIfDashboardVisible();
    });
  }

  return refreshView(currentView);
}
