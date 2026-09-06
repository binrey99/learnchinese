import { supabase } from './supabase.js';

const dayLabels = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
const panelHeading = (description) => `<div class="panel-heading"><div><h2>Hoạt động học tập</h2><p>${description}</p></div></div>`;

function getSevenDayBuckets(start) {
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return { date, vocabulary: 0, practice: 0 };
  });
}

function addToBuckets(buckets, start, occurredAt, type) {
  const offset = Math.floor((new Date(occurredAt) - start) / 86400000);
  if (buckets[offset]) buckets[offset][type] += 1;
}

async function loadActivities(userId, start) {
  const { data, error } = await supabase
    .from('learning_activity')
    .select('activity_type, occurred_at')
    .eq('user_id', userId)
    .gte('occurred_at', start.toISOString())
    .order('occurred_at');

  if (!error) {
    return data.map((item) => ({
      type: item.activity_type === 'vocabulary_view' ? 'vocabulary' : 'practice',
      occurredAt: item.occurred_at
    }));
  }

  // Existing projects may only have translation_progress. Its answered_at
  // timestamp can still be used to display completed translation questions.
  const { data: progress, error: progressError } = await supabase
    .from('translation_progress')
    .select('answered_at')
    .eq('user_id', userId)
    .gte('answered_at', start.toISOString())
    .order('answered_at');

  if (progressError) throw progressError;
  return progress.map((item) => ({ type: 'practice', occurredAt: item.answered_at }));
}

export async function renderDashboardProgress() {
  const panel = document.querySelector('#progress');
  if (!panel) return;

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    panel.innerHTML = panelHeading('Đăng nhập để xem tiến độ cá nhân');
    return;
  }

  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - 6);

  try {
    const activities = await loadActivities(user.id, start);
    const buckets = getSevenDayBuckets(start);
    activities.forEach((item) => addToBuckets(buckets, start, item.occurredAt, item.type));

    const viewed = activities.filter((item) => item.type === 'vocabulary').length;
    const practice = activities.filter((item) => item.type === 'practice').length;
    const max = Math.max(1, ...buckets.map((item) => item.vocabulary + item.practice));

    panel.innerHTML = `${panelHeading('7 ngày gần nhất · dữ liệu tài khoản của bạn')}
      <div class="activity-legend"><span><i></i>Từ vựng đã xem: ${viewed}</span><span><i></i>Câu dịch đã làm: ${practice}</span></div>
      <div class="real-chart" role="img" aria-label="Biểu đồ hoạt động học tập 7 ngày gần nhất">${buckets.map((item) => {
        const total = item.vocabulary + item.practice;
        return `<div class="real-chart-day"><b>${total || ''}</b><div class="real-chart-bars"><i style="height:${item.vocabulary / max * 100}%"></i><em style="height:${item.practice / max * 100}%"></em></div><small>${dayLabels[item.date.getDay()]}</small></div>`;
      }).join('')}</div>`;
  } catch (error) {
    console.error('Unable to load dashboard progress:', error);
    panel.innerHTML = panelHeading('Chưa tải được dữ liệu tiến độ. Hãy kiểm tra quyền truy cập Supabase.');
  }
}
