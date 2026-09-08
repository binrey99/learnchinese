import { supabase } from './supabase.js';

export const SCORE_RULES = {
  VOCABULARY_VIEW: 2,
  VOCABULARY_PRACTICE: 10,
  VOCABULARY_MASTERED: 50,
  TRANSLATION_CORRECT: 15,
  SENTENCE_ORDER_CORRECT: 15,
  GAME_MEMORY_FINISH: 30,
  GAME_MATCH_ROUND: 25,
  MOCK_EXAM_COMPLETED: 100,
  DAILY_STREAK: 20
};

// Dữ liệu học viên mẫu cộng đồng để bảng xếp hạng luôn sinh động
const COMMUNITY_SEEDS = [
  {
    userId: 'seed_ha_nguyen',
    displayName: 'Hà Nguyễn',
    avatarUrl: 'picture/student.jpg',
    baseWeek: 480,
    baseDay: 85,
    baseAll: 2450,
    breakdown: { vocabulary: 120, translation: 150, sentence_order: 90, game: 120 }
  },
  {
    userId: 'seed_minh_vu',
    displayName: 'Minh Vũ',
    avatarUrl: 'picture/main_picture.png',
    baseWeek: 420,
    baseDay: 60,
    baseAll: 1980,
    breakdown: { vocabulary: 100, translation: 135, sentence_order: 105, game: 80 }
  },
  {
    userId: 'seed_linh_dan',
    displayName: 'Linh Đan',
    avatarUrl: 'picture/vocabulary.png',
    baseWeek: 350,
    baseDay: 75,
    baseAll: 1620,
    breakdown: { vocabulary: 90, translation: 120, sentence_order: 60, game: 80 }
  },
  {
    userId: 'seed_bao_an',
    displayName: 'Bảo An',
    avatarUrl: 'picture/practice.png',
    baseWeek: 280,
    baseDay: 40,
    baseAll: 1240,
    breakdown: { vocabulary: 80, translation: 90, sentence_order: 60, game: 50 }
  },
  {
    userId: 'seed_tuan_kien',
    displayName: 'Tuấn Kiên',
    avatarUrl: 'picture/HSK.png',
    baseWeek: 210,
    baseDay: 30,
    baseAll: 960,
    breakdown: { vocabulary: 60, translation: 75, sentence_order: 45, game: 30 }
  }
];

function getStartOfDay() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function getStartOfWeek() {
  const d = new Date();
  const day = d.getDay();
  // Monday as start of week: 0 (Sun) -> diff = 6; 1 (Mon) -> diff = 0
  const diff = day === 0 ? 6 : day - 1;
  d.setDate(d.getDate() - diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Ghi nhận điểm thưởng từ các hạng mục hoạt động
 */
export async function recordScore({ category, points, description = '' }) {
  if (!points || points <= 0) return;

  const now = new Date().toISOString();
  let user = null;

  try {
    const { data } = await supabase.auth.getUser();
    user = data?.user || null;
  } catch (_) {}

  // Luôn lưu cache local
  const localScores = JSON.parse(localStorage.getItem('mandarinly_local_scores') || '[]');
  localScores.push({
    category,
    points,
    description,
    created_at: now
  });
  localStorage.setItem('mandarinly_local_scores', JSON.stringify(localScores.slice(-200)));

  // Nếu đã đăng nhập, gửi lên Supabase
  if (user) {
    let name = user.user_metadata?.full_name || user.email?.split('@')[0] || 'Học viên';
    let avatar = user.user_metadata?.avatar_url || 'picture/main_picture.png';

    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name, avatar_url')
        .eq('id', user.id)
        .maybeSingle();

      if (profile?.full_name) name = profile.full_name;
      if (profile?.avatar_url) avatar = profile.avatar_url;
    } catch (_) {}

    try {
      await supabase.from('leaderboard_scores').insert({
        user_id: user.id,
        display_name: name,
        avatar_url: avatar,
        category,
        points,
        description,
        created_at: now
      });
    } catch (err) {
      console.warn('Unable to sync score to Supabase:', err.message);
    }
  }
}

/**
 * Lấy danh sách xếp hạng theo khung giờ ('week' | 'day' | 'all')
 */
export async function getLeaderboardData(timeframe = 'week') {
  let startDate = null;
  if (timeframe === 'day') {
    startDate = getStartOfDay();
  } else if (timeframe === 'week') {
    startDate = getStartOfWeek();
  }

  let currentUser = null;
  try {
    const { data } = await supabase.auth.getUser();
    currentUser = data?.user || null;
  } catch (_) {}

  let remoteScores = [];
  try {
    let query = supabase
      .from('leaderboard_scores')
      .select('user_id, display_name, avatar_url, category, points, created_at');

    if (startDate) {
      query = query.gte('created_at', startDate.toISOString());
    }

    const { data, error } = await query;
    if (!error && data) {
      remoteScores = data;
    }
  } catch (err) {
    console.warn('Leaderboard table not yet initialized or error:', err.message);
  }

  // Tổng hợp điểm theo user
  const userMap = new Map();

  remoteScores.forEach((row) => {
    const uid = row.user_id;
    if (!userMap.has(uid)) {
      userMap.set(uid, {
        userId: uid,
        displayName: row.display_name || 'Học viên',
        avatarUrl: row.avatar_url || 'picture/main_picture.png',
        totalPoints: 0,
        breakdown: { vocabulary: 0, translation: 0, sentence_order: 0, game: 0, mock_exam: 0, streak: 0 }
      });
    }

    const u = userMap.get(uid);
    u.totalPoints += Number(row.points || 0);
    if (u.breakdown[row.category] !== undefined) {
      u.breakdown[row.category] += Number(row.points || 0);
    }
  });

  // Nếu người dùng hiện tại có điểm trong local cache mà chưa có trên Supabase
  if (currentUser) {
    const localScores = JSON.parse(localStorage.getItem('mandarinly_local_scores') || '[]');
    const filteredLocal = localScores.filter((item) => {
      if (!startDate) return true;
      return new Date(item.created_at) >= startDate;
    });

    const localSum = filteredLocal.reduce((acc, curr) => acc + curr.points, 0);

    if (!userMap.has(currentUser.id)) {
      const myName = currentUser.user_metadata?.full_name || currentUser.email?.split('@')[0] || 'Bạn';
      userMap.set(currentUser.id, {
        userId: currentUser.id,
        displayName: `${myName} (Bạn)`,
        avatarUrl: currentUser.user_metadata?.avatar_url || 'picture/main_picture.png',
        totalPoints: Math.max(localSum, 0),
        isMe: true,
        breakdown: { vocabulary: 0, translation: 0, sentence_order: 0, game: 0, mock_exam: 0, streak: 0 }
      });
      filteredLocal.forEach((item) => {
        const u = userMap.get(currentUser.id);
        if (u.breakdown[item.category] !== undefined) {
          u.breakdown[item.category] += item.points;
        }
      });
    } else {
      const me = userMap.get(currentUser.id);
      me.isMe = true;
      me.displayName += ' (Bạn)';
    }
  }

  // Kết hợp hạt giống cộng đồng nếu số lượng người dùng còn ít
  COMMUNITY_SEEDS.forEach((seed) => {
    if (!userMap.has(seed.userId)) {
      const seedPoints =
        timeframe === 'day' ? seed.baseDay : timeframe === 'week' ? seed.baseWeek : seed.baseAll;
      userMap.set(seed.userId, {
        userId: seed.userId,
        displayName: seed.displayName,
        avatarUrl: seed.avatarUrl,
        totalPoints: seedPoints,
        isSeed: true,
        breakdown: seed.breakdown
      });
    }
  });

  // Chuyển thành danh sách và xếp thứ hạng từ cao xuống thấp
  const rankings = Array.from(userMap.values()).sort((a, b) => b.totalPoints - a.totalPoints);

  rankings.forEach((item, index) => {
    item.rank = index + 1;
  });

  const myRecord = rankings.find((item) => item.isMe || (currentUser && item.userId === currentUser.id));

  return {
    timeframe,
    rankings,
    myRecord: myRecord || null,
    totalParticipants: rankings.length
  };
}
