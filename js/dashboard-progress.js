import { supabase } from './supabase.js';

const LOCAL_SCORES_KEY = 'mandarinly_local_scores';
const dayLabels = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];

/**
 * Mỗi nhóm dưới đây là một cột trong biểu đồ, gom từ cột category của bảng
 * leaderboard_scores - nơi mọi hoạt động học tập đều được ghi kèm created_at.
 */
const SERIES = [
  { key: 'vocabulary', label: 'Từ vựng', categories: ['vocabulary'] },
  { key: 'sentences', label: 'Dịch & xếp câu', categories: ['translation', 'sentence_order'] },
  { key: 'games', label: 'Trò chơi & thi', categories: ['game', 'mock_exam', 'streak'] }
];
const SERIES_TAGS = { vocabulary: 'i', sentences: 'em', games: 'u' };
const SERIES_OF_CATEGORY = new Map(
  SERIES.flatMap((series) => series.categories.map((category) => [category, series.key]))
);

// Tránh gắn sự kiện làm mới nhiều lần dù hàm render được gọi lại
let listenersBound = false;

const panelHeading = (description) => `<div class="panel-heading"><div><h2>Hoạt động học tập</h2><p>${description}</p></div></div>`;
const pad = (value) => String(value).padStart(2, '0');
const toDateKey = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

function readLocalScores() {
  try {
    const cached = JSON.parse(localStorage.getItem(LOCAL_SCORES_KEY) || '[]');
    return Array.isArray(cached) ? cached : [];
  } catch (error) {
    console.warn('Không đọc được điểm lưu tạm trên máy:', error);
    return [];
  }
}

function startOfSevenDays() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - 6);
  return start;
}

function createBuckets(start) {
  const buckets = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return {
      date,
      key: toDateKey(date),
      counts: { vocabulary: 0, sentences: 0, games: 0 },
      total: 0,
      points: 0
    };
  });

  return { buckets, byKey: new Map(buckets.map((bucket) => [bucket.key, bucket])) };
}

function toActivity({ category, points, occurredAt }) {
  return { category: String(category || ''), points: Number(points) || 0, occurredAt };
}

/** Hoạt động thật của người đang đăng nhập, lấy từ Supabase. */
async function loadRemoteActivities(userId, start) {
  const { data, error } = await supabase
    .from('leaderboard_scores')
    .select('category, points, created_at')
    .eq('user_id', userId)
    .gte('created_at', start.toISOString())
    .order('created_at');

  if (error) throw error;

  return (data || []).map((row) => toActivity({
    category: row.category,
    points: row.points,
    occurredAt: row.created_at
  }));
}

/** Dữ liệu ghi tạm trên máy: dùng cho khách hoặc khi Supabase chưa có dữ liệu. */
function loadLocalActivities(start) {
  return readLocalScores()
    .filter((item) => {
      const occurredAt = new Date(item?.created_at);
      return !Number.isNaN(occurredAt.getTime()) && occurredAt >= start;
    })
    .map((item) => toActivity({
      category: item.category,
      points: item.points,
      occurredAt: item.created_at
    }));
}

/**
 * Quay lại dashboard hoặc mở lại tab thì nạp lại số liệu mới nhất,
 * để biểu đồ không bị cũ sau khi vừa học xong một bài.
 */
function bindRefreshListeners() {
  if (listenersBound) return;
  listenersBound = true;

  const refreshIfDashboardVisible = () => {
    const dashboard = document.querySelector('.content-wrap');
    if (dashboard && !dashboard.hidden) renderDashboardProgress();
  };

  window.addEventListener('hashchange', () => {
    if ((window.location.hash.replace('#', '') || 'dashboard') === 'dashboard') refreshIfDashboardVisible();
  });
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) refreshIfDashboardVisible();
  });
}

function renderChart(panel, { buckets, activities, source, signedIn }) {
  const { buckets: list, byKey } = buckets;

  activities.forEach((item) => {
    const bucket = byKey.get(toDateKey(new Date(item.occurredAt)));
    const seriesKey = SERIES_OF_CATEGORY.get(item.category);
    if (!bucket || !seriesKey) return;
    bucket.counts[seriesKey] += 1;
    bucket.total += 1;
    bucket.points += item.points;
  });

  const seriesTotals = SERIES.map((series) => ({
    ...series,
    total: list.reduce((sum, bucket) => sum + bucket.counts[series.key], 0)
  }));
  const totalCount = list.reduce((sum, bucket) => sum + bucket.total, 0);
  const totalPoints = list.reduce((sum, bucket) => sum + bucket.points, 0);
  const max = Math.max(1, ...list.map((bucket) => bucket.total));

  const sourceLabel = source === 'supabase' ? 'dữ liệu thật từ Supabase' : 'dữ liệu lưu trên máy này';
  const details = [`${totalCount} lượt học`, `${totalPoints} điểm`];
  if (source === 'local' && !signedIn) details.push('đăng nhập để đồng bộ lên Supabase');
  const description = totalCount
    ? `7 ngày gần nhất · ${details.join(' · ')} · ${sourceLabel}`
    : `7 ngày gần nhất · chưa có hoạt động nào · ${sourceLabel}`;

  const legend = seriesTotals
    .map((series) => `<span><i></i>${series.label}: ${series.total} lượt</span>`)
    .join('');

  const days = list.map((bucket) => {
    const bars = SERIES.map((series) => {
      const tag = SERIES_TAGS[series.key];
      const height = (bucket.counts[series.key] / max) * 100;
      return `<${tag} style="height:${height.toFixed(1)}%"></${tag}>`;
    }).join('');
    const label = dayLabels[bucket.date.getDay()];
    const title = `${label} ${pad(bucket.date.getDate())}/${pad(bucket.date.getMonth() + 1)} · ${bucket.total} lượt · ${bucket.points} điểm`;
    return `<div class="real-chart-day" title="${title}"><b>${bucket.total || ''}</b><div class="real-chart-bars">${bars}</div><small>${label}</small></div>`;
  }).join('');

  panel.innerHTML = `${panelHeading(description)}
      <div class="activity-legend">${legend}</div>
      <div class="real-chart" role="img" aria-label="Biểu đồ hoạt động học tập 7 ngày gần nhất, ${sourceLabel}">${days}</div>`;
}

export async function renderDashboardProgress({ panelSelector = '#progress' } = {}) {
  const panel = document.querySelector(panelSelector);
  if (!panel) return;

  bindRefreshListeners();

  const start = startOfSevenDays();

  let user = null;
  try {
    const { data } = await supabase.auth.getUser();
    user = data?.user || null;
  } catch (error) {
    console.warn('Không lấy được tài khoản đang đăng nhập:', error?.message || error);
  }

  let activities = [];
  let source = 'supabase';

  if (user) {
    try {
      activities = await loadRemoteActivities(user.id, start);
    } catch (error) {
      console.warn('Không tải được hoạt động học tập từ Supabase:', error?.message || error);
    }
  }

  // Khách, hoặc Supabase chưa có dữ liệu: hiển thị số liệu ghi tạm trên máy
  if (!activities.length) {
    const local = loadLocalActivities(start);
    if (local.length) {
      activities = local;
      source = 'local';
    } else if (!user) {
      panel.innerHTML = panelHeading('Đăng nhập để xem tiến độ cá nhân');
      return;
    }
  }

  renderChart(panel, { buckets: createBuckets(start), activities, source, signedIn: Boolean(user) });
}

