import { supabase } from './supabase.js';
import { normalizeLevel, sortLevels } from './levels.js';
import { pinyin } from 'https://esm.sh/pinyin-pro@3.27.0';

// Danh sách các avatar có sẵn trong hệ thống
const PRESET_AVATARS = [
  { id: 'main', name: 'Capybara Chăm Chỉ', url: 'picture/main_picture.png' },
  { id: 'student', name: 'Học Viên Gương Mẫu', url: 'picture/student.jpg' },
  { id: 'eat', name: 'LuLu Dễ Thương', url: 'picture/eat.jpg' },
  { id: 'vocabulary', name: 'Capybara Từ Vựng', url: 'picture/vocabulary.png' },
  { id: 'hsk', name: 'Capybara HSK', url: 'picture/HSK.png' },
  { id: 'practice', name: 'Capybara Luyện Tập', url: 'picture/practice.png' },
  { id: 'mock_exam', name: 'Capybara Thi Thử', url: 'picture/mock-exam.png' },
  { id: 'goodbye', name: 'Capybara Vẫy Chào', url: 'picture/goodbye.jpg' }
];

function escapeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function toPinyin(hanzi) {
  try {
    return pinyin(hanzi, { toneType: 'symbol' });
  } catch (_) {
    return '';
  }
}

function speakWord(hanzi) {
  if (!hanzi) return;
  window.speechSynthesis?.cancel();
  if ('speechSynthesis' in window) {
    try {
      const utterance = new SpeechSynthesisUtterance(hanzi);
      utterance.lang = 'zh-CN';
      utterance.rate = 0.85;
      const voices = window.speechSynthesis.getVoices();
      const zhVoice = voices.find(
        (v) => v.lang === 'zh-CN' || v.lang === 'zh_CN' || v.lang.startsWith('zh') || v.name.includes('Chinese')
      );
      if (zhVoice) utterance.voice = zhVoice;
      window.speechSynthesis.speak(utterance);
      return;
    } catch (_) {}
  }
  const audio = new Audio(`https://dict.youdao.com/dictvoice?audio=${encodeURIComponent(hanzi)}&le=zh`);
  audio.play().catch(() => {});
}

function getLearnerTitle(points = 0) {
  if (points >= 1000) return { title: 'Bậc Thầy Tiếng Trung', badge: '👑 Hạng Hoàng Kim', color: '#eab308' };
  if (points >= 500) return { title: 'Cao Thủ Mandarinly', badge: '🥇 Hạng Bạch Kim', color: '#f59e0b' };
  if (points >= 200) return { title: 'Học Bá Tiềm Năng', badge: '🥈 Hạng Vàng', color: '#10b981' };
  if (points >= 50) return { title: 'Tập Sự Chăm Chỉ', badge: '🥉 Hạng Bạc', color: '#3b82f6' };
  return { title: 'Tân Binh Khởi Đầu', badge: '☘️ Hạng Đồng', color: '#6b7280' };
}

// Nén và căn chỉnh ảnh người dùng tải lên thành ảnh vuông gọn nhẹ (256x256)
function compressAndCropImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const size = 256;
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');

        // Cắt vuông tâm ảnh (Center-crop)
        const minDim = Math.min(img.width, img.height);
        const startX = (img.width - minDim) / 2;
        const startY = (img.height - minDim) / 2;

        ctx.drawImage(img, startX, startY, minDim, minDim, 0, 0, size, size);
        resolve(canvas.toDataURL('image/jpeg', 0.85));
      };
      img.onerror = () => reject(new Error('Không thể đọc file ảnh.'));
      img.src = e.target.result;
    };
    reader.onerror = () => reject(new Error('Không thể tải file.'));
    reader.readAsDataURL(file);
  });
}

// Tải danh sách chi tiết các từ vựng đã thuộc từ Supabase
async function loadMasteredVocabularies(userId) {
  if (!userId) return [];

  // 1. Lấy danh sách ID từ bảng vocabulary_mastery
  const { data: masteryList, error: masteryErr } = await supabase
    .from('vocabulary_mastery')
    .select('vocabulary_id, mastered_at')
    .eq('user_id', userId)
    .order('mastered_at', { ascending: false });

  if (masteryErr) {
    console.error('Lỗi khi tải vocabulary_mastery:', masteryErr);
    return [];
  }

  if (!masteryList || masteryList.length === 0) return [];

  const vocabIds = masteryList.map((m) => m.vocabulary_id);
  const masteryMap = new Map();
  masteryList.forEach((m) => {
    masteryMap.set(String(m.vocabulary_id), m.mastered_at);
  });

  // 2. Lấy thông tin từ vựng từ bảng vocabulary
  let vocabRows = [];
  try {
    const { data, error } = await supabase
      .from('vocabulary')
      .select('id, book_level, vocab, english_meaning, vietnamese_meaning, word_type, component')
      .in('id', vocabIds);

    if (!error && data) vocabRows = data;
  } catch (err) {
    console.warn('Không thể truy vấn bảng vocabulary:', err);
  }

  const results = vocabRows.map((w) => ({
    id: w.id,
    hanzi: w.vocab,
    pinyin: toPinyin(w.vocab),
    meaning: w.vietnamese_meaning || w.english_meaning || '',
    english: w.english_meaning || '',
    level: normalizeLevel(w.book_level || 'HSK'),
    wordType: w.word_type || '',
    component: w.component || '',
    masteredAt: masteryMap.get(String(w.id))
  }));

  // Sắp xếp từ thuộc gần nhất lên trước
  results.sort((a, b) => {
    const timeA = a.masteredAt ? new Date(a.masteredAt).getTime() : 0;
    const timeB = b.masteredAt ? new Date(b.masteredAt).getTime() : 0;
    return timeB - timeA;
  });

  return results;
}

export async function renderProfile(options = {}) {
  const selector = typeof options === 'string' ? options : (options.selector || '#profileContent');
  const toast = typeof options === 'object' ? options.toast : null;

  const container = document.querySelector(selector);
  if (!container) return;

  container.innerHTML = `
    <div class="profile-loading-box">
      <div class="profile-spinner"></div>
      <p>Đang tải thông tin hồ sơ và thành tích học tập...</p>
    </div>
  `;

  let user = null;
  try {
    const { data } = await supabase.auth.getUser();
    user = data?.user || null;
  } catch (err) {
    console.warn('Lỗi lấy thông tin user:', err);
  }

  if (!user) {
    container.innerHTML = `
      <div class="profile-empty">
        <div class="profile-empty-icon">🔒</div>
        <strong>Bạn chưa đăng nhập</strong>
        <span>Hãy đăng nhập tài khoản để xem hồ sơ, thống kê thành tích và đổi ảnh đại diện của bạn.</span>
        <div class="profile-empty-actions">
          <button type="button" class="primary-button" id="profileOpenLoginBtn">Đăng nhập ngay</button>
          <a class="secondary-button" href="#dashboard">Về dashboard</a>
        </div>
      </div>
    `;
    document.querySelector('#profileOpenLoginBtn')?.addEventListener('click', () => {
      document.querySelector('#loginTrigger')?.click();
    });
    return;
  }

  // Lấy dữ liệu hồ sơ từ bảng profiles
  let profile = null;
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('email, full_name, avatar_url, bio, created_at')
      .eq('id', user.id)
      .maybeSingle();
    if (!error) profile = data;
  } catch (err) {
    console.warn('Không thể tải profile từ bảng profiles:', err);
  }

  // Lấy dữ liệu điểm số và thành tích từ leaderboard_scores
  let scoreRecords = [];
  try {
    const { data, error } = await supabase
      .from('leaderboard_scores')
      .select('category, points, description, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    if (!error && data) scoreRecords = data;
  } catch (err) {
    console.warn('Không thể tải leaderboard_scores:', err);
  }

  // Dự phòng gộp thêm điểm từ localStorage
  const localScores = JSON.parse(localStorage.getItem('mandarinly_local_scores') || '[]');
  const combinedScores = [...scoreRecords];
  if (scoreRecords.length === 0 && localScores.length > 0) {
    combinedScores.push(...localScores);
  }

  // Lấy số từ vựng đã thuộc từ vocabulary_mastery
  let masteredCount = 0;
  try {
    const { count, error } = await supabase
      .from('vocabulary_mastery')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id);
    if (!error && typeof count === 'number') {
      masteredCount = count;
    }
  } catch (err) {
    console.warn('Không thể tải vocabulary_mastery:', err);
  }

  // Tính toán số liệu thống kê
  const totalPoints = combinedScores.reduce((acc, row) => acc + Number(row.points || 0), 0);
  const translationPoints = combinedScores
    .filter((r) => r.category === 'translation' || r.category === 'sentence_order')
    .reduce((acc, r) => acc + Number(r.points || 0), 0);
  const gamePoints = combinedScores
    .filter((r) => r.category === 'game' || r.category === 'battle')
    .reduce((acc, r) => acc + Number(r.points || 0), 0);
  const examPoints = combinedScores
    .filter((r) => r.category === 'mock_exam')
    .reduce((acc, r) => acc + Number(r.points || 0), 0);

  const learnerInfo = getLearnerTitle(totalPoints);

  const name = profile?.full_name || user.user_metadata?.full_name || user.email?.split('@')[0] || 'Học viên';
  const email = profile?.email || user.email || '';
  let avatarUrl = profile?.avatar_url || user.user_metadata?.avatar_url || localStorage.getItem('mandarinly_user_avatar') || 'picture/main_picture.png';
  const joinedDate = profile?.created_at || user.created_at;
  const joined = joinedDate ? new Date(joinedDate).toLocaleDateString('vi-VN') : 'Gần đây';

  // Định nghĩa danh sách Huy Hiệu Thành Tích
  const BADGES = [
    {
      id: 'first_step',
      icon: '🌱',
      name: 'Bước Đầu Khám Phá',
      desc: 'Tích lũy 10 điểm học tập đầu tiên',
      target: 10,
      current: Math.min(totalPoints, 10),
      unlocked: totalPoints >= 10
    },
    {
      id: 'vocab_5',
      icon: '📖',
      name: 'Vốn Từ Khởi Động',
      desc: 'Thuộc từ 5 từ vựng HSK trở lên',
      target: 5,
      current: Math.min(masteredCount, 5),
      unlocked: masteredCount >= 5
    },
    {
      id: 'vocab_20',
      icon: '📚',
      name: 'Bậc Thầy Từ Vựng',
      desc: 'Đánh dấu thuộc 20 từ vựng',
      target: 20,
      current: Math.min(masteredCount, 20),
      unlocked: masteredCount >= 20
    },
    {
      id: 'translator',
      icon: '✍️',
      name: 'Thông Dịch Viên',
      desc: 'Đạt từ 50 điểm bài tập dịch & câu',
      target: 50,
      current: Math.min(translationPoints, 50),
      unlocked: translationPoints >= 50
    },
    {
      id: 'gamer',
      icon: '🎮',
      name: 'Chiến Thần Đấu Trường',
      desc: 'Đạt 50 điểm trò chơi hoặc đấu 1v1',
      target: 50,
      current: Math.min(gamePoints, 50),
      unlocked: gamePoints >= 50
    },
    {
      id: 'exam_master',
      icon: '📝',
      name: 'Sẵn Sàng HSK',
      desc: 'Hoàn thành bài thi thử tiếng Trung',
      target: 100,
      current: Math.min(examPoints, 100),
      unlocked: examPoints >= 100
    },
    {
      id: 'scholar_500',
      icon: '🥇',
      name: 'Học Bá Mandarinly',
      desc: 'Đạt mốc 500 điểm tích lũy',
      target: 500,
      current: Math.min(totalPoints, 500),
      unlocked: totalPoints >= 500
    },
    {
      id: 'legend_1000',
      icon: '👑',
      name: 'Huyền Thoại Ngôn Ngữ',
      desc: 'Tích lũy xuất sắc 1000 điểm toàn năng',
      target: 1000,
      current: Math.min(totalPoints, 1000),
      unlocked: totalPoints >= 1000
    }
  ];

  const unlockedBadgesCount = BADGES.filter((b) => b.unlocked).length;

  container.innerHTML = `
    <div class="profile-layout">
      <!-- Thẻ thông tin học viên -->
      <section class="profile-card">
        <div class="profile-avatar-wrapper">
          <img class="profile-avatar-large" id="profileAvatarImg" src="${escapeHtml(avatarUrl)}" alt="Ảnh đại diện của ${escapeHtml(name)}">
          <button class="profile-avatar-change-btn" id="openAvatarBtn" type="button" title="Thay đổi ảnh đại diện">
            <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none">
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path>
              <circle cx="12" cy="13" r="4"></circle>
            </svg>
            <span>Đổi ảnh</span>
          </button>
        </div>

        <div class="profile-details">
          <div class="profile-badge-row">
            <span class="profile-badge">HỒ SƠ HỌC VIÊN</span>
            <span class="profile-rank-pill" style="border-color:${learnerInfo.color};color:${learnerInfo.color}">${learnerInfo.badge}</span>
          </div>
          <h2>${escapeHtml(name)}</h2>
          <p class="profile-email">${escapeHtml(email)}</p>

          <div class="profile-meta-grid">
            <div class="meta-item">
              <span class="meta-label">Danh hiệu</span>
              <strong class="meta-value" style="color:${learnerInfo.color}">${learnerInfo.title}</strong>
            </div>
            <div class="meta-item">
              <span class="meta-label">Ngày tham gia</span>
              <strong class="meta-value">${joined}</strong>
            </div>
            <div class="meta-item">
              <span class="meta-label">Huy hiệu đạt được</span>
              <strong class="meta-value text-gold">${unlockedBadgesCount} / ${BADGES.length} ✦</strong>
            </div>
          </div>
        </div>
      </section>

      <!-- Các thẻ thống kê số liệu thành tích -->
      <section class="profile-stats-section">
        <h3 class="profile-section-title">Thống kê học tập</h3>
        <div class="profile-stats-grid">
          <div class="profile-stat-box stat-points">
            <div class="stat-icon">🏆</div>
            <div class="stat-info">
              <span class="stat-num">${totalPoints.toLocaleString('vi-VN')}</span>
              <span class="stat-name">Tổng điểm tích lũy</span>
            </div>
          </div>

          <div class="profile-stat-box stat-vocab clickable" id="openMasteredVocabCard" role="button" tabindex="0" title="Bấm để xem danh sách từ vựng đã thuộc">
            <div class="stat-icon">📚</div>
            <div class="stat-info">
              <div class="stat-num-row">
                <span class="stat-num">${masteredCount}</span>
                <span class="stat-click-badge">Xem từ ➜</span>
              </div>
              <span class="stat-name">Từ vựng đã thuộc</span>
            </div>
          </div>

          <div class="profile-stat-box stat-trans">
            <div class="stat-icon">✍️</div>
            <div class="stat-info">
              <span class="stat-num">${translationPoints}</span>
              <span class="stat-name">Điểm dịch & ngữ pháp</span>
            </div>
          </div>

          <div class="profile-stat-box stat-games">
            <div class="stat-icon">⚔️</div>
            <div class="stat-info">
              <span class="stat-num">${gamePoints}</span>
              <span class="stat-name">Điểm trò chơi & thi đấu</span>
            </div>
          </div>
        </div>
      </section>

      <!-- Bộ sưu tập Huy Hiệu Thành Tích -->
      <section class="profile-badges-section">
        <div class="profile-section-head">
          <div>
            <h3 class="profile-section-title">Bộ sưu tập huy hiệu</h3>
            <p class="profile-section-subtitle">Chinh phục các cột mốc học tập để mở khóa huy hiệu vinh danh</p>
          </div>
          <span class="badges-counter-pill">${unlockedBadgesCount}/${BADGES.length} Hoàn thành</span>
        </div>

        <div class="profile-badges-grid">
          ${BADGES.map((b) => {
            const percent = Math.min(100, Math.round((b.current / b.target) * 100));
            return `
              <div class="badge-card ${b.unlocked ? 'is-unlocked' : 'is-locked'}">
                <div class="badge-icon-wrap">
                  <span class="badge-emoji">${b.icon}</span>
                  ${b.unlocked ? '<span class="badge-check">✓</span>' : ''}
                </div>
                <div class="badge-body">
                  <div class="badge-title-row">
                    <h4>${escapeHtml(b.name)}</h4>
                    <span class="badge-status-tag">${b.unlocked ? 'ĐÃ ĐẠT ✦' : 'CHƯA ĐẠT'}</span>
                  </div>
                  <p class="badge-desc">${escapeHtml(b.desc)}</p>
                  <div class="badge-progress-box">
                    <div class="badge-progress-bar">
                      <div class="badge-progress-fill" style="width: ${percent}%;"></div>
                    </div>
                    <div class="badge-progress-labels">
                      <span>${b.current}/${b.target}</span>
                      <span>${percent}%</span>
                    </div>
                  </div>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </section>

      <!-- Lịch sử hoạt động gần đây -->
      <section class="profile-activity-section">
        <h3 class="profile-section-title">Nhật ký hoạt động gần đây</h3>
        ${
          combinedScores.length > 0
            ? `
            <div class="profile-timeline">
              ${combinedScores.slice(0, 8).map((act) => {
                const dateStr = act.created_at ? new Date(act.created_at).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' }) : 'Gần đây';
                let catIcon = '✦';
                if (act.category === 'vocabulary') catIcon = 'Aa';
                else if (act.category === 'translation') catIcon = '✍️';
                else if (act.category === 'sentence_order') catIcon = '🧩';
                else if (act.category === 'game') catIcon = '🎮';
                else if (act.category === 'mock_exam') catIcon = '📝';
                return `
                  <div class="timeline-row">
                    <span class="timeline-icon">${catIcon}</span>
                    <div class="timeline-content">
                      <strong>${escapeHtml(act.description || 'Hoạt động học tập')}</strong>
                      <small>${dateStr}</small>
                    </div>
                    <span class="timeline-points">+${act.points} điểm</span>
                  </div>
                `;
              }).join('')}
            </div>
          `
            : '<p class="profile-empty-text">Chưa có hoạt động nào được ghi nhận. Hãy bắt đầu học bài để tích lũy thành tích nhé!</p>'
        }
      </section>
    </div>

    <!-- Modal Xem Danh Sách Từ Vựng Đã Thuộc -->
    <div class="mastered-vocab-modal" id="masteredVocabModal" hidden>
      <div class="mastered-vocab-backdrop" id="closeMasteredVocabBackdrop"></div>
      <div class="mastered-vocab-card" role="dialog" aria-modal="true" aria-labelledby="masteredVocabTitle">
        <div class="mastered-vocab-header">
          <div class="mastered-vocab-title-box">
            <div class="title-icon">📚</div>
            <div>
              <h3 id="masteredVocabTitle">Từ vựng đã thuộc</h3>
              <p class="mastered-vocab-subtitle" id="masteredVocabSubtitle">Danh sách từ bạn đã đánh dấu hoàn thành</p>
            </div>
          </div>
          <button class="mastered-vocab-close" id="closeMasteredVocabBtn" type="button" aria-label="Đóng">×</button>
        </div>

        <!-- Bộ lọc & Tìm kiếm -->
        <div class="mastered-vocab-toolbar">
          <div class="mastered-search-wrap">
            <span class="search-icon">🔍</span>
            <input type="text" id="masteredVocabSearchInput" placeholder="Tìm kiếm theo chữ Hán, Pinyin hoặc nghĩa...">
          </div>
          <div class="mastered-level-tabs" id="masteredLevelTabs">
            <button type="button" class="level-tab active" data-level="all">Tất cả</button>
          </div>
        </div>

        <div class="mastered-vocab-body" id="masteredVocabBody">
          <div class="mastered-loading-state">
            <div class="profile-spinner"></div>
            <p>Đang tải danh sách từ vựng đã thuộc...</p>
          </div>
        </div>

        <div class="mastered-vocab-footer">
          <span class="mastered-footer-count" id="masteredFooterCount">Tổng số: ${masteredCount} từ</span>
          <div class="mastered-footer-actions">
            <button type="button" class="secondary-button" id="closeMasteredVocabFooterBtn">Đóng</button>
            <a href="#vocabulary" class="primary-button" id="goToVocabBtn">Ôn tập từ vựng ➜</a>
          </div>
        </div>
      </div>
    </div>

    <!-- Modal Thay Đổi Ảnh Đại Diện -->
    <div class="avatar-modal" id="avatarModal" hidden>
      <div class="avatar-modal-backdrop" id="closeAvatarModalBackdrop"></div>
      <div class="avatar-modal-card" role="dialog" aria-modal="true" aria-labelledby="avatarModalTitle">
        <div class="avatar-modal-header">
          <h3 id="avatarModalTitle">Thay đổi ảnh đại diện</h3>
          <button class="avatar-modal-close" id="closeAvatarModalBtn" type="button" aria-label="Đóng">×</button>
        </div>

        <div class="avatar-modal-body">
          <!-- Ảnh xem trước -->
          <div class="avatar-preview-box">
            <img class="avatar-preview-img" id="avatarPreviewImg" src="${escapeHtml(avatarUrl)}" alt="Xem trước ảnh">
            <span class="avatar-preview-label">Ảnh hiển thị</span>
          </div>

          <!-- Tab 1: Bộ sưu tập có sẵn -->
          <div class="avatar-picker-section">
            <label class="avatar-picker-label">1. Chọn từ bộ sưu tập dễ thương</label>
            <div class="preset-avatar-grid">
              ${PRESET_AVATARS.map((item) => `
                <button type="button" class="preset-avatar-btn${item.url === avatarUrl ? ' active' : ''}" data-preset-url="${item.url}" title="${item.name}">
                  <img src="${item.url}" alt="${item.name}">
                  <span>${item.name}</span>
                </button>
              `).join('')}
            </div>
          </div>

          <!-- Tab 2: Tải ảnh từ thiết bị -->
          <div class="avatar-picker-section">
            <label class="avatar-picker-label">2. Hoặc tải ảnh từ máy tính của bạn</label>
            <div class="custom-avatar-upload">
              <input type="file" id="customAvatarFile" accept="image/png, image/jpeg, image/webp" hidden>
              <label for="customAvatarFile" class="custom-upload-btn">
                <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                  <polyline points="17 8 12 3 7 8"></polyline>
                  <line x1="12" y1="3" x2="12" y2="15"></line>
                </svg>
                <span>Tải ảnh lên (PNG, JPG, WebP)</span>
              </label>
              <small class="upload-hint">Ảnh sẽ tự động được căn chỉnh vuông và tối ưu dung lượng.</small>
            </div>
          </div>

          <p class="avatar-modal-error" id="avatarModalError" hidden></p>
        </div>

        <div class="avatar-modal-footer">
          <button type="button" class="secondary-button" id="cancelAvatarBtn">Hủy</button>
          <button type="button" class="primary-button" id="saveAvatarBtn">
            <span class="btn-spinner" id="avatarSaveSpinner" hidden></span>
            <span id="saveAvatarText">Lưu ảnh đại diện</span>
          </button>
        </div>
      </div>
    </div>
  `;

  // =========================================================================
  // XỬ LÝ SỰ KIỆN CHO MODAL TỪ VỰNG ĐÃ THUỘC
  // =========================================================================
  const openVocabCard = container.querySelector('#openMasteredVocabCard');
  const vocabModal = container.querySelector('#masteredVocabModal');
  const closeVocabBtn = container.querySelector('#closeMasteredVocabBtn');
  const closeVocabFooterBtn = container.querySelector('#closeMasteredVocabFooterBtn');
  const closeVocabBackdrop = container.querySelector('#closeMasteredVocabBackdrop');
  const vocabBody = container.querySelector('#masteredVocabBody');
  const vocabSearchInput = container.querySelector('#masteredVocabSearchInput');
  const levelTabsContainer = container.querySelector('#masteredLevelTabs');
  const footerCount = container.querySelector('#masteredFooterCount');
  const subtitleCount = container.querySelector('#masteredVocabSubtitle');
  const goToVocabBtn = container.querySelector('#goToVocabBtn');

  let cachedMasteredWords = null;
  let activeLevelFilter = 'all';

  const closeVocabModal = () => {
    vocabModal.hidden = true;
  };

  const renderVocabList = (words) => {
    const query = vocabSearchInput?.value.trim().toLowerCase() || '';

    let filtered = words;
    if (activeLevelFilter !== 'all') {
      filtered = filtered.filter((w) => w.level.trim().toLowerCase() === activeLevelFilter.toLowerCase());
    }
    if (query) {
      filtered = filtered.filter(
        (w) =>
          w.hanzi.toLowerCase().includes(query) ||
          w.pinyin.toLowerCase().includes(query) ||
          w.meaning.toLowerCase().includes(query) ||
          w.english.toLowerCase().includes(query)
      );
    }

    if (footerCount) footerCount.textContent = `Hiển thị: ${filtered.length} / ${words.length} từ`;

    if (filtered.length === 0) {
      vocabBody.innerHTML = `
        <div class="mastered-empty-state">
          <span class="empty-icon">🔍</span>
          <strong>Không tìm thấy từ vựng phù hợp</strong>
          <p>${query ? 'Thử tìm kiếm với từ khóa khác nhé.' : 'Bạn chưa có từ vựng nào thuộc cấp độ này.'}</p>
        </div>
      `;
      return;
    }

    vocabBody.innerHTML = `
      <div class="mastered-vocab-grid">
        ${filtered.map((word) => `
          <div class="mastered-card" data-hanzi="${escapeHtml(word.hanzi)}">
            <div class="mastered-card-top">
              <div class="mastered-hanzi-wrap">
                <span class="mastered-pinyin">${escapeHtml(word.pinyin)}</span>
                <strong class="mastered-hanzi">${escapeHtml(word.hanzi)}</strong>
              </div>
              <div class="mastered-card-badges">
                <span class="mastered-level-tag">${escapeHtml(word.level)}</span>
                <span class="mastered-star" title="Đã thuộc">★</span>
              </div>
            </div>

            <div class="mastered-meaning">
              <span>${escapeHtml(word.meaning)}</span>
              ${word.wordType ? `<small class="mastered-type">(${escapeHtml(word.wordType)})</small>` : ''}
            </div>

            <div class="mastered-card-bottom">
              <button type="button" class="mastered-speak-btn" data-speak-hanzi="${escapeHtml(word.hanzi)}" title="Phát âm tiếng Trung">
                <span class="speaker-icon">🔊</span>
                <span>Nghe</span>
              </button>
              ${word.masteredAt ? `<span class="mastered-date">Thuộc ngày ${new Date(word.masteredAt).toLocaleDateString('vi-VN')}</span>` : ''}
            </div>
          </div>
        `).join('')}
      </div>
    `;

    // Gắn sự kiện phát âm
    vocabBody.querySelectorAll('[data-speak-hanzi]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const hanzi = btn.dataset.speakHanzi;
        speakWord(hanzi);
        btn.classList.add('is-speaking');
        setTimeout(() => btn.classList.remove('is-speaking'), 800);
      });
    });
  };

  const openMasteredVocab = async () => {
    vocabModal.hidden = false;

    if (!cachedMasteredWords) {
      vocabBody.innerHTML = `
        <div class="mastered-loading-state">
          <div class="profile-spinner"></div>
          <p>Đang tải danh sách từ vựng đã thuộc...</p>
        </div>
      `;

      try {
        cachedMasteredWords = await loadMasteredVocabularies(user.id);
      } catch (err) {
        console.error('Lỗi khi tải từ vựng:', err);
        cachedMasteredWords = [];
      }
    }

    if (subtitleCount) {
      subtitleCount.textContent = `Bạn đã hoàn thành và ghi nhớ ${cachedMasteredWords.length} từ vựng`;
    }

    // Tạo các nút lọc theo cấp độ nếu có
    if (levelTabsContainer && cachedMasteredWords.length > 0) {
      const levels = ['all', ...sortLevels([...new Set(cachedMasteredWords.map((w) => w.level).filter(Boolean))])];
      levelTabsContainer.innerHTML = levels
        .map(
          (lvl) =>
            `<button type="button" class="level-tab${lvl === activeLevelFilter ? ' active' : ''}" data-level="${escapeHtml(lvl)}">${lvl === 'all' ? 'Tất cả' : escapeHtml(lvl)}</button>`
        )
        .join('');

      levelTabsContainer.querySelectorAll('.level-tab').forEach((tab) => {
        tab.addEventListener('click', () => {
          levelTabsContainer.querySelectorAll('.level-tab').forEach((t) => t.classList.remove('active'));
          tab.classList.add('active');
          activeLevelFilter = tab.dataset.level;
          renderVocabList(cachedMasteredWords);
        });
      });
    }

    if (cachedMasteredWords.length === 0) {
      vocabBody.innerHTML = `
        <div class="mastered-empty-state">
          <span class="empty-icon">📖</span>
          <strong>Chưa có từ vựng nào được đánh dấu đã thuộc</strong>
          <p>Hãy vào mục Từ vựng, học và bấm biểu tượng ngôi sao (★) để thêm vào danh sách đã thuộc nhé!</p>
          <a href="#vocabulary" class="primary-button" id="emptyVocabLink">Khám phá từ vựng ngay</a>
        </div>
      `;
      vocabBody.querySelector('#emptyVocabLink')?.addEventListener('click', closeVocabModal);
      return;
    }

    renderVocabList(cachedMasteredWords);
  };

  openVocabCard?.addEventListener('click', openMasteredVocab);
  openVocabCard?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      openMasteredVocab();
    }
  });

  closeVocabBtn?.addEventListener('click', closeVocabModal);
  closeVocabFooterBtn?.addEventListener('click', closeVocabModal);
  closeVocabBackdrop?.addEventListener('click', closeVocabModal);
  goToVocabBtn?.addEventListener('click', closeVocabModal);

  vocabSearchInput?.addEventListener('input', () => {
    if (cachedMasteredWords) renderVocabList(cachedMasteredWords);
  });

  // =========================================================================
  // XỬ LÝ SỰ KIỆN CHO MODAL THAY ĐỔI ẢNH ĐẠI DIỆN
  // =========================================================================
  const modal = container.querySelector('#avatarModal');
  const openBtn = container.querySelector('#openAvatarBtn');
  const closeBtn = container.querySelector('#closeAvatarModalBtn');
  const cancelBtn = container.querySelector('#cancelAvatarBtn');
  const backdrop = container.querySelector('#closeAvatarModalBackdrop');
  const previewImg = container.querySelector('#avatarPreviewImg');
  const profileAvatarImg = container.querySelector('#profileAvatarImg');
  const presetBtns = container.querySelectorAll('[data-preset-url]');
  const fileInput = container.querySelector('#customAvatarFile');
  const saveBtn = container.querySelector('#saveAvatarBtn');
  const errorText = container.querySelector('#avatarModalError');
  const spinner = container.querySelector('#avatarSaveSpinner');
  const saveText = container.querySelector('#saveAvatarText');

  let selectedAvatarUrl = avatarUrl;

  const openModal = () => {
    selectedAvatarUrl = profileAvatarImg.src;
    previewImg.src = selectedAvatarUrl;
    presetBtns.forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.presetUrl === selectedAvatarUrl || selectedAvatarUrl.endsWith(btn.dataset.presetUrl));
    });
    if (errorText) {
      errorText.hidden = true;
      errorText.textContent = '';
    }
    modal.hidden = false;
  };

  const closeModal = () => {
    modal.hidden = true;
  };

  openBtn?.addEventListener('click', openModal);
  closeBtn?.addEventListener('click', closeModal);
  cancelBtn?.addEventListener('click', closeModal);
  backdrop?.addEventListener('click', closeModal);

  // Chọn avatar mẫu
  presetBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      presetBtns.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      selectedAvatarUrl = btn.dataset.presetUrl;
      previewImg.src = selectedAvatarUrl;
      if (fileInput) fileInput.value = '';
    });
  });

  // Tải ảnh từ thiết bị
  fileInput?.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      if (errorText) {
        errorText.hidden = false;
        errorText.textContent = 'Vui lòng chọn file hình ảnh hợp lệ.';
      }
      return;
    }

    try {
      presetBtns.forEach((b) => b.classList.remove('active'));
      const compressedDataUrl = await compressAndCropImage(file);
      selectedAvatarUrl = compressedDataUrl;
      previewImg.src = selectedAvatarUrl;
      if (errorText) errorText.hidden = true;
    } catch (err) {
      if (errorText) {
        errorText.hidden = false;
        errorText.textContent = err.message || 'Không thể xử lý ảnh tải lên.';
      }
    }
  });

  // Lưu ảnh đại diện lên Supabase
  saveBtn?.addEventListener('click', async () => {
    if (!selectedAvatarUrl) return;

    saveBtn.disabled = true;
    spinner.hidden = false;
    saveText.textContent = 'Đang lưu...';
    if (errorText) errorText.hidden = true;

    try {
      // 1. Cập nhật vào auth.users (user_metadata)
      const { error: authError } = await supabase.auth.updateUser({
        data: { avatar_url: selectedAvatarUrl }
      });
      if (authError) console.warn('Cập nhật user_metadata cảnh báo:', authError.message);

      // 2. Cập nhật / chèn vào bảng profiles
      const { error: profileError } = await supabase.from('profiles').upsert({
        id: user.id,
        email: user.email,
        full_name: name,
        avatar_url: selectedAvatarUrl,
        updated_at: new Date().toISOString()
      });
      if (profileError) {
        console.warn('Cập nhật bảng profiles cảnh báo:', profileError.message);
      }

      // 3. Cập nhật avatar trên các bảng điểm nếu có
      try {
        await supabase
          .from('leaderboard_scores')
          .update({ avatar_url: selectedAvatarUrl })
          .eq('user_id', user.id);
      } catch (_) {}

      // 4. Cập nhật giao diện lập tức và lưu cache đồng bộ
      profileAvatarImg.src = selectedAvatarUrl;
      localStorage.setItem('mandarinly_user_avatar', selectedAvatarUrl);
      window.dispatchEvent(new CustomEvent('profile-avatar-updated', { detail: { avatarUrl: selectedAvatarUrl } }));

      // Cập nhật các vị trí avatar khác trên trang (như sidebar / topbar)
      const miniAvatar = document.querySelector('.profile-mini .avatar');
      if (miniAvatar) {
        miniAvatar.innerHTML = `<img src="${selectedAvatarUrl}" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`;
      }

      closeModal();
      toast?.('Đã cập nhật ảnh đại diện thành công! ✨');
    } catch (err) {
      console.error('Lỗi khi lưu avatar lên Supabase:', err);
      if (errorText) {
        errorText.hidden = false;
        errorText.textContent = 'Có lỗi xảy ra khi lưu ảnh. Vui lòng thử lại!';
      }
    } finally {
      saveBtn.disabled = false;
      spinner.hidden = true;
      saveText.textContent = 'Lưu ảnh đại diện';
    }
  });
}
