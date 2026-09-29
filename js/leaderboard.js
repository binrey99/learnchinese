import { getLeaderboardData } from './score-service.js';
import { supabase } from './supabase.js';
import { getLearnerTitle } from './profile.js';

const escapeHtml = (value = '') =>
  String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

const SEED_PROFILES = {
  seed_minh_vu: {
    motto: '千里之行，始于足下 (Hành trình vạn dặm khởi đầu từ một bước chân)',
    goal: 'Chinh phục HSK 4 & Top 1 Bảng xếp hạng',
    specialty: '✍️ Luyện dịch câu & Ngữ pháp nâng cao',
    vocabCount: 168
  },
  seed_linh_dan: {
    motto: '熟能生巧 (Trăm hay không bằng tay quen)',
    goal: 'Học 20 từ mới mỗi ngày cùng Capybara LuLu',
    specialty: '📖 Flashcard & Nhớ từ siêu tốc',
    vocabCount: 142
  },
  seed_bao_an: {
    motto: '学而时习之，不亦说乎？ (Học và thường xuyên ôn luyện, chẳng vui lắm sao?)',
    goal: 'Đấu trường 1v1 bất bại & Chuỗi 30 ngày',
    specialty: '🎮 Mini Game & Phản xạ nhanh',
    vocabCount: 115
  },
  seed_tuan_kien: {
    motto: '持之以恒，金石为开 (Kiên trì bền bỉ, vàng đá cũng mở)',
    goal: 'Đạt điểm tối đa thi thử HSK 3',
    specialty: '✎ Luyện đề HSK & Tập viết chữ Hán',
    vocabCount: 96
  }
};

const MOTTO_LIST = [
  '千里之行，始于足下 (Hành trình vạn dặm khởi đầu từ một bước chân)',
  '熟能生巧 (Trăm hay không bằng tay quen)',
  '学而时习之，不亦说乎？ (Học và thường xuyên ôn luyện)',
  '持之以恒，金石为开 (Kiên trì bền bỉ, ắt chạm tới thành công)',
  '水滴石穿 (Nước chảy đá mòn - kiên trì tích lũy kiến thức)'
];

function getLearnerSpecialty(breakdown = {}) {
  const map = [
    { label: '📖 Học Từ vựng HSK', score: breakdown.vocabulary || 0 },
    { label: '✍️ Luyện dịch tiếng Trung', score: breakdown.translation || 0 },
    { label: '🧩 Sắp xếp câu', score: breakdown.sentence_order || 0 },
    { label: '🎮 Mini Game phản xạ', score: breakdown.game || 0 },
    { label: '✎ Luyện đề thi thử', score: breakdown.mock_exam || 0 },
    { label: '🔥 Chuỗi học tập kiên trì', score: breakdown.streak || 0 }
  ];
  map.sort((a, b) => b.score - a.score);
  return map[0]?.score > 0 ? map[0].label : '🌱 Học tập toàn diện';
}

function getLearnerBadges(learner) {
  const bd = learner.breakdown || {};
  const badges = [];

  if (learner.rank === 1) {
    badges.push({ icon: '👑', name: 'Quán Quân BXH', desc: 'Đang dẫn đầu bảng xếp hạng', color: '#f59e0b' });
  } else if (learner.rank === 2) {
    badges.push({ icon: '🥈', name: 'Á Quân BXH', desc: 'Vị trí thứ 2 bảng xếp hạng', color: '#64748b' });
  } else if (learner.rank === 3) {
    badges.push({ icon: '🥉', name: 'Quý Quân BXH', desc: 'Vị trí thứ 3 bảng xếp hạng', color: '#b45309' });
  } else if (learner.rank <= 10) {
    badges.push({ icon: '🌟', name: 'Top 10 Xuất Sắc', desc: 'Top 10 học viên dẫn đầu', color: '#059669' });
  }

  if (learner.totalPoints >= 1000) {
    badges.push({ icon: '🏆', name: 'Học Bá Hoàng Kim', desc: 'Tích lũy trên 1,000 điểm', color: '#eab308' });
  } else if (learner.totalPoints >= 300) {
    badges.push({ icon: '🎖️', name: 'Nỗ Lực Vượt Bậc', desc: 'Tích lũy trên 300 điểm', color: '#3b82f6' });
  }

  if ((bd.vocabulary || 0) >= 80) {
    badges.push({ icon: '📖', name: 'Kho Tàng Từ Vựng', desc: `${bd.vocabulary}đ từ vựng`, color: '#6366f1' });
  }

  if ((bd.translation || 0) >= 100) {
    badges.push({ icon: '✍️', name: 'Chiến Thần Luyện Dịch', desc: `${bd.translation}đ luyện dịch`, color: '#10b981' });
  }

  if ((bd.sentence_order || 0) >= 60) {
    badges.push({ icon: '🧩', name: 'Bậc Thầy Ngữ Pháp', desc: `${bd.sentence_order}đ sắp xếp câu`, color: '#d97706' });
  }

  if ((bd.game || 0) >= 80) {
    badges.push({ icon: '🎮', name: 'Cao Thủ Trò Chơi', desc: `${bd.game}đ mini game`, color: '#8b5cf6' });
  }

  if ((bd.mock_exam || 0) >= 100) {
    badges.push({ icon: '✎', name: 'Kỳ Thủ HSK', desc: `${bd.mock_exam}đ thi thử`, color: '#0284c7' });
  }

  if ((bd.streak || 0) >= 15) {
    badges.push({ icon: '🔥', name: 'Kỷ Luật Thép', desc: 'Học tập đều đặn mỗi ngày', color: '#ef4444' });
  }

  if (badges.length === 0) {
    badges.push({ icon: '☘️', name: 'Tân Binh Đầy Nỗ Lực', desc: 'Đang bắt đầu hành trình chinh phục tiếng Trung', color: '#10b981' });
  }

  return badges;
}

function showLearnerModal(learner, activeTimeframe) {
  let modalOverlay = document.getElementById('learnerProfileModal');
  if (!modalOverlay) {
    modalOverlay = document.createElement('div');
    modalOverlay.id = 'learnerProfileModal';
    modalOverlay.className = 'learner-modal-overlay';
    document.body.appendChild(modalOverlay);
  }

  const titleInfo = getLearnerTitle(learner.totalPoints);
  const badges = getLearnerBadges(learner);
  const bd = learner.breakdown || {};
  const specialty = getLearnerSpecialty(bd);

  const seedInfo = SEED_PROFILES[learner.userId];
  const hashVal = String(learner.userId || learner.displayName).split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const motto = seedInfo?.motto || MOTTO_LIST[hashVal % MOTTO_LIST.length];
  const goal = seedInfo?.goal || 'Nâng cao vốn từ và phản xạ giao tiếp tiếng Trung mỗi ngày';
  let vocabCount = seedInfo?.vocabCount || Math.max(Math.round((bd.vocabulary || 0) / 2), 0);

  const timeframeLabel = activeTimeframe === 'day' ? 'Hôm nay' : activeTimeframe === 'week' ? 'Tuần này' : 'Toàn thời gian';

  const total = Math.max(learner.totalPoints, 1);
  const vocabPct = Math.round(((bd.vocabulary || 0) / total) * 100);
  const transPct = Math.round(((bd.translation || 0) / total) * 100);
  const orderPct = Math.round(((bd.sentence_order || 0) / total) * 100);
  const gamePct = Math.round(((bd.game || 0) / total) * 100);
  const examPct = Math.round(((bd.mock_exam || 0) / total) * 100);
  const streakPct = Math.round(((bd.streak || 0) / total) * 100);

  const rankMedal = learner.rank === 1 ? '🥇' : learner.rank === 2 ? '🥈' : learner.rank === 3 ? '🥉' : `#${learner.rank}`;

  modalOverlay.innerHTML = `
    <div class="learner-modal-card" role="dialog" aria-modal="true" aria-labelledby="learnerModalName">
      <!-- Modal Header -->
      <div class="learner-modal-header">
        <button type="button" class="learner-modal-close" aria-label="Đóng" id="closeLearnerModalBtn">✕</button>
        <div class="learner-avatar-wrapper">
          <img class="learner-avatar-img" src="${escapeHtml(learner.avatarUrl)}" alt="${escapeHtml(learner.displayName)}">
          <span class="learner-rank-medal rank-${learner.rank <= 3 ? learner.rank : 'normal'}">${rankMedal}</span>
        </div>
      </div>

      <!-- Modal Body -->
      <div class="learner-modal-body">
        <div class="learner-name-wrap">
          <div class="learner-name-line">
            <h3 id="learnerModalName" class="learner-name">${escapeHtml(learner.displayName)}</h3>
            ${learner.isMe ? '<span class="me-tag">Bạn</span>' : ''}
          </div>
          <div class="learner-tier-badge" style="background-color: ${titleInfo.color}15; color: ${titleInfo.color}; border: 1px solid ${titleInfo.color}40;">
            ${titleInfo.badge} • ${titleInfo.title}
          </div>
          <p class="learner-motto">“${escapeHtml(motto)}”</p>
        </div>

        <!-- 3-Col Stats Grid -->
        <div class="learner-stats-grid">
          <div class="learner-stat-card">
            <span class="stat-icon">🏆</span>
            <div class="stat-meta">
              <span class="stat-number">${learner.totalPoints.toLocaleString()}</span>
              <span class="stat-label">Tổng điểm</span>
            </div>
          </div>
          <div class="learner-stat-card">
            <span class="stat-icon">🎖️</span>
            <div class="stat-meta">
              <span class="stat-number">#${learner.rank}</span>
              <span class="stat-label">Hạng (${timeframeLabel})</span>
            </div>
          </div>
          <div class="learner-stat-card">
            <span class="stat-icon">📚</span>
            <div class="stat-meta">
              <span class="stat-number" id="learnerVocabMasteredCount">${vocabCount}+</span>
              <span class="stat-label">Từ đã thuộc</span>
            </div>
          </div>
        </div>

        <!-- Focus & Goal Strip -->
        <div class="learner-focus-strip">
          <div class="focus-row">
            <span class="focus-label">🎯 Mục tiêu:</span>
            <span class="focus-val">${escapeHtml(goal)}</span>
          </div>
          <div class="focus-row">
            <span class="focus-label">⚡ Thế mạnh:</span>
            <span class="focus-val">${escapeHtml(specialty)}</span>
          </div>
        </div>

        <!-- Breakdown Section -->
        <div class="learner-section-block">
          <div class="learner-section-title">
            <span>📊 Phân bổ điểm (${timeframeLabel})</span>
            <small>${learner.totalPoints.toLocaleString()} điểm</small>
          </div>

          <!-- Stacked progress bar -->
          <div class="learner-stacked-bar" title="Tỷ lệ phân bổ điểm">
            ${vocabPct > 0 ? `<div class="bar-seg seg-vocab" style="width: ${vocabPct}%" title="Từ vựng: ${vocabPct}%"></div>` : ''}
            ${transPct > 0 ? `<div class="bar-seg seg-trans" style="width: ${transPct}%" title="Luyện dịch: ${transPct}%"></div>` : ''}
            ${orderPct > 0 ? `<div class="bar-seg seg-order" style="width: ${orderPct}%" title="Sắp xếp câu: ${orderPct}%"></div>` : ''}
            ${gamePct > 0 ? `<div class="bar-seg seg-game" style="width: ${gamePct}%" title="Trò chơi: ${gamePct}%"></div>` : ''}
            ${examPct > 0 ? `<div class="bar-seg seg-exam" style="width: ${examPct}%" title="Thi thử: ${examPct}%"></div>` : ''}
            ${streakPct > 0 ? `<div class="bar-seg seg-streak" style="width: ${streakPct}%" title="Chuỗi ngày: ${streakPct}%"></div>` : ''}
          </div>

          <!-- Breakdown 2-col Grid -->
          <div class="learner-breakdown-grid">
            <div class="bd-item">
              <div class="bd-left"><span class="bd-dot dot-vocab"></span> 📖 Từ vựng HSK</div>
              <strong>${(bd.vocabulary || 0).toLocaleString()} <small>đ</small></strong>
            </div>
            <div class="bd-item">
              <div class="bd-left"><span class="bd-dot dot-trans"></span> ✍️ Luyện dịch</div>
              <strong>${(bd.translation || 0).toLocaleString()} <small>đ</small></strong>
            </div>
            <div class="bd-item">
              <div class="bd-left"><span class="bd-dot dot-order"></span> 🧩 Sắp xếp câu</div>
              <strong>${(bd.sentence_order || 0).toLocaleString()} <small>đ</small></strong>
            </div>
            <div class="bd-item">
              <div class="bd-left"><span class="bd-dot dot-game"></span> 🎮 Trò chơi mini</div>
              <strong>${(bd.game || 0).toLocaleString()} <small>đ</small></strong>
            </div>
            <div class="bd-item">
              <div class="bd-left"><span class="bd-dot dot-exam"></span> ✎ Thi thử HSK</div>
              <strong>${(bd.mock_exam || 0).toLocaleString()} <small>đ</small></strong>
            </div>
            <div class="bd-item">
              <div class="bd-left"><span class="bd-dot dot-streak"></span> 🔥 Điểm chuỗi Streak</div>
              <strong>${(bd.streak || 0).toLocaleString()} <small>đ</small></strong>
            </div>
          </div>
        </div>

        <!-- Badges Section -->
        <div class="learner-section-block">
          <div class="learner-section-title">
            <span>🏅 Huy hiệu & Thành tựu nổi bật</span>
            <small>${badges.length} huy hiệu</small>
          </div>
          <div class="learner-badges-wrap">
            ${badges
              .map(
                (b) => `
              <div class="badge-chip" title="${escapeHtml(b.desc)}">
                <span class="badge-chip-icon">${b.icon}</span>
                <div class="badge-chip-info">
                  <strong>${escapeHtml(b.name)}</strong>
                  <span>${escapeHtml(b.desc)}</span>
                </div>
              </div>
            `
              )
              .join('')}
          </div>
        </div>

        <!-- Footer / Action Buttons -->
        <div class="learner-modal-footer">
          ${
            learner.isMe
              ? `
            <button type="button" class="btn-learner-profile" id="goToMyProfileBtn">
              <span>👤 Xem trang cá nhân của bạn</span>
              <span>→</span>
            </button>
          `
              : `
            <div class="learner-cheer-note">
              <span>🌟 Hãy chăm chỉ tích lũy điểm để thăng hạng cùng <strong>${escapeHtml(learner.displayName)}</strong> nhé!</span>
            </div>
          `
          }
          <button type="button" class="btn-learner-close-sub" id="closeLearnerModalBtn2">Đóng</button>
        </div>
      </div>
    </div>
  `;

  requestAnimationFrame(() => {
    modalOverlay.classList.add('open');
    document.body.style.overflow = 'hidden';
  });

  const closeModal = () => {
    modalOverlay.classList.remove('open');
    document.body.style.overflow = '';
  };

  modalOverlay.querySelector('#closeLearnerModalBtn')?.addEventListener('click', closeModal);
  modalOverlay.querySelector('#closeLearnerModalBtn2')?.addEventListener('click', closeModal);

  modalOverlay.addEventListener('click', (e) => {
    if (e.target === modalOverlay) closeModal();
  });

  const onKeydown = (e) => {
    if (e.key === 'Escape' && modalOverlay.classList.contains('open')) {
      closeModal();
      document.removeEventListener('keydown', onKeydown);
    }
  };
  document.addEventListener('keydown', onKeydown);

  modalOverlay.querySelector('#goToMyProfileBtn')?.addEventListener('click', () => {
    closeModal();
    window.location.hash = '#profile';
  });

  // Query Supabase for real user extras
  if (learner.userId && !learner.userId.startsWith('seed_')) {
    (async () => {
      try {
        const { count: masteredCount, error: vErr } = await supabase
          .from('vocabulary_mastery')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', learner.userId);

        if (!vErr && masteredCount !== null) {
          const el = modalOverlay.querySelector('#learnerVocabMasteredCount');
          if (el) el.textContent = `${masteredCount} từ`;
        }

        const { data: prof } = await supabase
          .from('profiles')
          .select('bio, full_name')
          .eq('id', learner.userId)
          .maybeSingle();

        if (prof?.bio) {
          const mottoEl = modalOverlay.querySelector('.learner-motto');
          if (mottoEl) mottoEl.textContent = `“${prof.bio}”`;
        }
      } catch (_) {}
    })();
  }
}

export async function initLeaderboard({ selector = '[data-leaderboard]' } = {}) {
  const container = document.querySelector(selector);
  if (!container) return;

  let activeTimeframe = 'week'; // 'week' | 'day' | 'all'

  async function render() {
    container.innerHTML = `
      <div class="leaderboard-loading">
        <div class="game-spinner"></div>
        <p>Đang tải bảng xếp hạng thành tích...</p>
      </div>
    `;

    const data = await getLeaderboardData(activeTimeframe);
    const { rankings, myRecord, totalParticipants } = data;

    const top3 = rankings.slice(0, 3);
    const rest = rankings.slice(3);

    // Format podium: order 2nd, 1st, 3rd for visual height curve
    const rank1 = top3.find((r) => r.rank === 1) || null;
    const rank2 = top3.find((r) => r.rank === 2) || null;
    const rank3 = top3.find((r) => r.rank === 3) || null;

    container.innerHTML = `
      <div class="leaderboard-page-wrap">
        <!-- Timeframe Tabs Toolbar -->
        <div class="leaderboard-header-bar">
          <div class="leaderboard-tabs" role="tablist">
            <button type="button" class="lb-tab ${activeTimeframe === 'week' ? 'active' : ''}" data-tf="week">
              📅 Tuần này
            </button>
            <button type="button" class="lb-tab ${activeTimeframe === 'day' ? 'active' : ''}" data-tf="day">
              ⏱️ Hôm nay
            </button>
            <button type="button" class="lb-tab ${activeTimeframe === 'all' ? 'active' : ''}" data-tf="all">
              🌐 Toàn thời gian
            </button>
          </div>

          <div class="leaderboard-summary-pill">
            <span>Tổng cộng: <strong>${totalParticipants}</strong> học viên</span>
          </div>
        </div>

        <!-- Top 3 Podium -->
        <div class="leaderboard-podium">
          <!-- Rank 2 -->
          ${
            rank2
              ? `
            <div class="podium-col rank-2 clickable" role="button" tabindex="0" data-user-id="${escapeHtml(rank2.userId)}" title="Nhấp xem thông tin của ${escapeHtml(rank2.displayName)}">
              <div class="podium-avatar-wrap">
                <img class="podium-avatar" src="${escapeHtml(rank2.avatarUrl)}" alt="${escapeHtml(rank2.displayName)}">
                <span class="podium-medal silver">🥈</span>
              </div>
              <strong class="podium-name">${escapeHtml(rank2.displayName)}</strong>
              <div class="podium-points">${rank2.totalPoints.toLocaleString()} <small>điểm</small></div>
              <span class="podium-view-hint">👆 Xem chi tiết</span>
              <div class="podium-step step-2"><span>2</span></div>
            </div>
          `
              : '<div class="podium-col empty"></div>'
          }

          <!-- Rank 1 -->
          ${
            rank1
              ? `
            <div class="podium-col rank-1 clickable" role="button" tabindex="0" data-user-id="${escapeHtml(rank1.userId)}" title="Nhấp xem thông tin của ${escapeHtml(rank1.displayName)}">
              <div class="podium-crown">👑</div>
              <div class="podium-avatar-wrap">
                <img class="podium-avatar" src="${escapeHtml(rank1.avatarUrl)}" alt="${escapeHtml(rank1.displayName)}">
                <span class="podium-medal gold">🥇</span>
              </div>
              <strong class="podium-name">${escapeHtml(rank1.displayName)}</strong>
              <div class="podium-points">${rank1.totalPoints.toLocaleString()} <small>điểm</small></div>
              <span class="podium-view-hint">👆 Xem chi tiết</span>
              <div class="podium-step step-1"><span>1</span></div>
            </div>
          `
              : '<div class="podium-col empty"></div>'
          }

          <!-- Rank 3 -->
          ${
            rank3
              ? `
            <div class="podium-col rank-3 clickable" role="button" tabindex="0" data-user-id="${escapeHtml(rank3.userId)}" title="Nhấp xem thông tin của ${escapeHtml(rank3.displayName)}">
              <div class="podium-avatar-wrap">
                <img class="podium-avatar" src="${escapeHtml(rank3.avatarUrl)}" alt="${escapeHtml(rank3.displayName)}">
                <span class="podium-medal bronze">🥉</span>
              </div>
              <strong class="podium-name">${escapeHtml(rank3.displayName)}</strong>
              <div class="podium-points">${rank3.totalPoints.toLocaleString()} <small>điểm</small></div>
              <span class="podium-view-hint">👆 Xem chi tiết</span>
              <div class="podium-step step-3"><span>3</span></div>
            </div>
          `
              : '<div class="podium-col empty"></div>'
          }
        </div>

        <!-- Full Rankings Table -->
        <div class="leaderboard-list-card">
          <div class="lb-table-head">
            <span class="col-rank">Hạng</span>
            <span class="col-learner">Học viên</span>
            <span class="col-stats">Hạng mục nổi bật</span>
            <span class="col-score">Điểm thành tích</span>
          </div>

          <div class="lb-rows">
            ${rankings
              .map((item) => {
                const isMeClass = item.isMe ? 'is-me' : '';
                const bd = item.breakdown || {};
                return `
                  <div class="lb-row clickable ${isMeClass}" role="button" tabindex="0" data-user-id="${escapeHtml(item.userId)}" title="Nhấp xem thông tin của ${escapeHtml(item.displayName)}">
                    <div class="col-rank">
                      ${
                        item.rank === 1
                          ? '<span class="rank-badge gold">1</span>'
                          : item.rank === 2
                          ? '<span class="rank-badge silver">2</span>'
                          : item.rank === 3
                          ? '<span class="rank-badge bronze">3</span>'
                          : `<span class="rank-badge normal">${item.rank}</span>`
                      }
                    </div>
                    <div class="col-learner">
                      <img class="lb-avatar" src="${escapeHtml(item.avatarUrl)}" alt="${escapeHtml(item.displayName)}">
                      <div class="lb-user-info">
                        <strong>${escapeHtml(item.displayName)}</strong>
                        ${item.isMe ? '<span class="me-tag">Bạn</span>' : ''}
                      </div>
                    </div>
                    <div class="col-stats">
                      ${bd.vocabulary ? `<span class="cat-pill vocab" title="Từ vựng">📖 ${bd.vocabulary}đ</span>` : ''}
                      ${bd.translation ? `<span class="cat-pill trans" title="Luyện dịch">✍️ ${bd.translation}đ</span>` : ''}
                      ${bd.sentence_order ? `<span class="cat-pill order" title="Sắp xếp câu">🧩 ${bd.sentence_order}đ</span>` : ''}
                      ${bd.game ? `<span class="cat-pill game" title="Trò chơi">🎮 ${bd.game}đ</span>` : ''}
                      ${bd.mock_exam ? `<span class="cat-pill exam" title="Thi thử">✎ ${bd.mock_exam}đ</span>` : ''}
                      ${bd.streak ? `<span class="cat-pill streak" title="Chuỗi Streak">🔥 ${bd.streak}đ</span>` : ''}
                    </div>
                    <div class="col-score">
                      <div class="col-score-meta">
                        <strong>${item.totalPoints.toLocaleString()}</strong>
                        <small>điểm</small>
                      </div>
                      <span class="lb-view-arrow" aria-hidden="true">›</span>
                    </div>
                  </div>
                `;
              })
              .join('')}
          </div>
        </div>

        <!-- Scoring Rules Guide -->
        <div class="scoring-rules-banner">
          <div class="rules-title">💡 Cách tích điểm xếp hạng:</div>
          <div class="rules-grid">
            <div class="rule-item"><span>📖 Học từ vựng</span><strong>+2đ / từ</strong></div>
            <div class="rule-item"><span>⭐ Thuộc từ vựng</span><strong>+10đ / quiz</strong></div>
            <div class="rule-item"><span>✍️ Luyện dịch câu</span><strong>+15đ / câu đúng</strong></div>
            <div class="rule-item"><span>🧩 Sắp xếp câu</span><strong>+15đ / câu đúng</strong></div>
            <div class="rule-item"><span>🎮 Trò chơi mini</span><strong>+25 ~ 50đ / ván</strong></div>
            <div class="rule-item"><span>✎ Thi thử HSK</span><strong>+100đ / đề thi</strong></div>
          </div>
        </div>

        <!-- My Rank Sticky Footer -->
        ${
          myRecord
            ? `
          <div class="my-rank-banner clickable" role="button" tabindex="0" data-user-id="${escapeHtml(myRecord.userId)}" title="Nhấp xem thông tin chi tiết của bạn">
            <div class="my-rank-left">
              <span class="my-rank-pos">#${myRecord.rank}</span>
              <div>
                <strong>Thứ hạng của bạn (${activeTimeframe === 'week' ? 'Tuần này' : activeTimeframe === 'day' ? 'Hôm nay' : 'Toàn thời gian'})</strong>
                <p>Nhấp vào đây để xem chi tiết điểm và huy hiệu của bạn ✨</p>
              </div>
            </div>
            <div class="my-rank-right">
              <strong>${myRecord.totalPoints.toLocaleString()}</strong>
              <span>điểm thành tích ›</span>
            </div>
          </div>
        `
            : ''
        }
      </div>
    `;

    // Event listeners for timeframe tabs
    container.querySelectorAll('.lb-tab').forEach((btn) => {
      btn.addEventListener('click', () => {
        activeTimeframe = btn.dataset.tf;
        render();
      });
    });

    // Wire up clicks to open learner modal
    const attachClickToOpenModal = (elem, learner) => {
      elem.addEventListener('click', () => showLearnerModal(learner, activeTimeframe));
      elem.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          showLearnerModal(learner, activeTimeframe);
        }
      });
    };

    if (rank1) {
      const el = container.querySelector('.podium-col.rank-1');
      if (el) attachClickToOpenModal(el, rank1);
    }
    if (rank2) {
      const el = container.querySelector('.podium-col.rank-2');
      if (el) attachClickToOpenModal(el, rank2);
    }
    if (rank3) {
      const el = container.querySelector('.podium-col.rank-3');
      if (el) attachClickToOpenModal(el, rank3);
    }

    const rowElements = container.querySelectorAll('.lb-row.clickable');
    rowElements.forEach((row) => {
      const uid = row.dataset.userId;
      const learner = rankings.find((r) => String(r.userId) === String(uid));
      if (learner) attachClickToOpenModal(row, learner);
    });

    if (myRecord) {
      const myBanner = container.querySelector('.my-rank-banner.clickable');
      if (myBanner) attachClickToOpenModal(myBanner, myRecord);
    }
  }

  render();
}

