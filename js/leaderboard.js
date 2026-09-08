import { getLeaderboardData } from './score-service.js';

const escapeHtml = (value = '') =>
  String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

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
            <div class="podium-col rank-2">
              <div class="podium-avatar-wrap">
                <img class="podium-avatar" src="${escapeHtml(rank2.avatarUrl)}" alt="${escapeHtml(rank2.displayName)}">
                <span class="podium-medal silver">🥈</span>
              </div>
              <strong class="podium-name">${escapeHtml(rank2.displayName)}</strong>
              <div class="podium-points">${rank2.totalPoints.toLocaleString()} <small>điểm</small></div>
              <div class="podium-step step-2"><span>2</span></div>
            </div>
          `
              : '<div class="podium-col empty"></div>'
          }

          <!-- Rank 1 -->
          ${
            rank1
              ? `
            <div class="podium-col rank-1">
              <div class="podium-crown">👑</div>
              <div class="podium-avatar-wrap">
                <img class="podium-avatar" src="${escapeHtml(rank1.avatarUrl)}" alt="${escapeHtml(rank1.displayName)}">
                <span class="podium-medal gold">🥇</span>
              </div>
              <strong class="podium-name">${escapeHtml(rank1.displayName)}</strong>
              <div class="podium-points">${rank1.totalPoints.toLocaleString()} <small>điểm</small></div>
              <div class="podium-step step-1"><span>1</span></div>
            </div>
          `
              : '<div class="podium-col empty"></div>'
          }

          <!-- Rank 3 -->
          ${
            rank3
              ? `
            <div class="podium-col rank-3">
              <div class="podium-avatar-wrap">
                <img class="podium-avatar" src="${escapeHtml(rank3.avatarUrl)}" alt="${escapeHtml(rank3.displayName)}">
                <span class="podium-medal bronze">🥉</span>
              </div>
              <strong class="podium-name">${escapeHtml(rank3.displayName)}</strong>
              <div class="podium-points">${rank3.totalPoints.toLocaleString()} <small>điểm</small></div>
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
                  <div class="lb-row ${isMeClass}">
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
                    </div>
                    <div class="col-score">
                      <strong>${item.totalPoints.toLocaleString()}</strong>
                      <small>điểm</small>
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
          <div class="my-rank-banner">
            <div class="my-rank-left">
              <span class="my-rank-pos">#${myRecord.rank}</span>
              <div>
                <strong>Thứ hạng của bạn (${activeTimeframe === 'week' ? 'Tuần này' : activeTimeframe === 'day' ? 'Hôm nay' : 'Toàn thời gian'})</strong>
                <p>Tiếp tục luyện tập và chơi trò chơi để thăng hạng!</p>
              </div>
            </div>
            <div class="my-rank-right">
              <strong>${myRecord.totalPoints.toLocaleString()}</strong>
              <span>điểm thành tích</span>
            </div>
          </div>
        `
            : ''
        }
      </div>
    `;

    // Event listeners for tabs
    container.querySelectorAll('.lb-tab').forEach((btn) => {
      btn.addEventListener('click', () => {
        activeTimeframe = btn.dataset.tf;
        render();
      });
    });
  }

  render();
}
