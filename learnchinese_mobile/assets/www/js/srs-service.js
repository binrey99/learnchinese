import { pinyin } from 'https://esm.sh/pinyin-pro@3.27.0';
import { recordScore } from './score-service.js';
import { awardLuluExp } from './lulu.js';

const SRS_STORAGE_KEY = 'mandarinly_srs_cards_v1';

// Khoảng cách thời gian ôn tập theo cấp độ SRS (tính bằng phút)
export const SRS_INTERVALS_MINUTES = [1, 10, 1440, 4320, 10080, 20160, 43200];

export const SRS_BOX_LABELS = [
  { box: 0, label: 'Cần khắc phục ngay', color: '#dc2626', bg: '#fef2f2' },
  { box: 1, label: 'Mới làm quen (10p)', color: '#ea580c', bg: '#fff7ed' },
  { box: 2, label: 'Trí nhớ ngắn hạn (1 ngày)', color: '#d97706', bg: '#fffbeb' },
  { box: 3, label: 'Đang củng cố (3 ngày)', color: '#0284c7', bg: '#f0f9ff' },
  { box: 4, label: 'Khá vững (7 ngày)', color: '#0d9488', bg: '#f0fdfa' },
  { box: 5, label: 'Trí nhớ dài hạn (14 ngày)', color: '#16a34a', bg: '#f0fdf4' },
  { box: 6, label: 'Đã làm chủ hoàn toàn (30 ngày)', color: '#15803d', bg: '#dcfce7' }
];

function escapeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function safeToPinyin(hanzi = '') {
  try {
    return pinyin(String(hanzi), { toneType: 'symbol' });
  } catch (_) {
    return '';
  }
}

function readSrsMap() {
  try {
    const raw = localStorage.getItem(SRS_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (_) {
    return {};
  }
}

function writeSrsMap(map) {
  try {
    localStorage.setItem(SRS_STORAGE_KEY, JSON.stringify(map));
  } catch (err) {
    console.warn('Không thể lưu dữ liệu SRS:', err);
  }
}

function emitSrsUpdated(detail = {}) {
  window.dispatchEvent(new CustomEvent('srs-updated', { detail }));
}

/**
 * Lấy danh sách toàn bộ thẻ trong hệ thống SRS & Sổ tay từ hay sai
 */
export function getAllSrsCards() {
  const map = readSrsMap();
  return Object.values(map)
    .filter((item) => item && item.hanzi)
    .sort((a, b) => {
      const nextA = new Date(a.nextReviewAt || 0).getTime();
      const nextB = new Date(b.nextReviewAt || 0).getTime();
      if (nextA !== nextB) return nextA - nextB;
      return (b.mistakeCount || 0) - (a.mistakeCount || 0);
    });
}

/**
 * Kiểm tra xem 1 chữ Hán đã có trong Sổ tay SRS chưa
 */
export function getSrsCard(hanzi) {
  if (!hanzi) return null;
  const key = String(hanzi).trim();
  const map = readSrsMap();
  return map[key] || null;
}

/**
 * Ghi nhận một từ vựng người dùng làm sai (từ Trò chơi, Thi đấu, Luyện dịch, Sắp xếp câu, hoặc đánh dấu thủ công)
 */
export function recordMistakeWord({
  id = null,
  hanzi = '',
  pinyin: py = '',
  meaning = '',
  english = '',
  level = 'HSK 1',
  example = '',
  source = 'Luyện tập'
} = {}) {
  const cleanHanzi = String(hanzi || '').trim();
  if (!cleanHanzi) return null;

  const map = readSrsMap();
  const now = new Date().toISOString();
  const existing = map[cleanHanzi];

  const sources = new Set(Array.isArray(existing?.sources) ? existing.sources : []);
  if (source) sources.add(source);

  const updated = {
    key: cleanHanzi,
    id: id || existing?.id || cleanHanzi,
    hanzi: cleanHanzi,
    pinyin: py || existing?.pinyin || safeToPinyin(cleanHanzi),
    meaning: meaning || existing?.meaning || '',
    english: english || existing?.english || '',
    level: level || existing?.level || 'HSK 1',
    example: example || existing?.example || '',
    mistakeCount: (Number(existing?.mistakeCount) || 0) + 1,
    reviewCount: Number(existing?.reviewCount) || 0,
    correctStreak: 0,
    box: 0,
    easeFactor: Math.max(1.3, (Number(existing?.easeFactor) || 2.5) - 0.2),
    intervalMinutes: 1,
    nextReviewAt: now,
    lastMistakeAt: now,
    lastReviewedAt: existing?.lastReviewedAt || null,
    createdAt: existing?.createdAt || now,
    sources: Array.from(sources).slice(-6),
    bookmarked: Boolean(existing?.bookmarked),
    isMistake: true
  };

  map[cleanHanzi] = updated;
  writeSrsMap(map);
  emitSrsUpdated({ action: 'mistake', card: updated });
  return updated;
}

/**
 * Thêm hoặc bỏ ghim một từ vào Sổ tay Ôn tập Ngắt quãng (SRS)
 */
export function toggleBookmarkSrsWord({
  id = null,
  hanzi = '',
  pinyin: py = '',
  meaning = '',
  english = '',
  level = 'HSK 1',
  example = '',
  source = 'Sổ tay cá nhân'
} = {}) {
  const cleanHanzi = String(hanzi || '').trim();
  if (!cleanHanzi) return { added: false, card: null };

  const map = readSrsMap();
  const existing = map[cleanHanzi];

  if (existing && existing.bookmarked && (existing.mistakeCount || 0) === 0) {
    delete map[cleanHanzi];
    writeSrsMap(map);
    emitSrsUpdated({ action: 'removed', hanzi: cleanHanzi });
    return { added: false, card: null };
  }

  const now = new Date().toISOString();
  const sources = new Set(Array.isArray(existing?.sources) ? existing.sources : []);
  if (source) sources.add(source);

  const card = {
    key: cleanHanzi,
    id: id || existing?.id || cleanHanzi,
    hanzi: cleanHanzi,
    pinyin: py || existing?.pinyin || safeToPinyin(cleanHanzi),
    meaning: meaning || existing?.meaning || '',
    english: english || existing?.english || '',
    level: level || existing?.level || 'HSK 1',
    example: example || existing?.example || '',
    mistakeCount: Number(existing?.mistakeCount) || 0,
    reviewCount: Number(existing?.reviewCount) || 0,
    correctStreak: Number(existing?.correctStreak) || 0,
    box: existing ? Number(existing.box || 0) : 0,
    easeFactor: Number(existing?.easeFactor) || 2.5,
    intervalMinutes: existing?.intervalMinutes || 1,
    nextReviewAt: existing?.nextReviewAt || now,
    lastMistakeAt: existing?.lastMistakeAt || null,
    lastReviewedAt: existing?.lastReviewedAt || null,
    createdAt: existing?.createdAt || now,
    sources: Array.from(sources),
    bookmarked: true,
    isMistake: Boolean(existing?.isMistake)
  };

  map[cleanHanzi] = card;
  writeSrsMap(map);
  emitSrsUpdated({ action: 'bookmarked', card });
  return { added: true, card };
}

/**
 * Xóa 1 từ khỏi Sổ tay SRS / Từ hay sai
 */
export function removeSrsWord(hanzi) {
  const cleanHanzi = String(hanzi || '').trim();
  if (!cleanHanzi) return;
  const map = readSrsMap();
  if (map[cleanHanzi]) {
    delete map[cleanHanzi];
    writeSrsMap(map);
    emitSrsUpdated({ action: 'removed', hanzi: cleanHanzi });
  }
}

/**
 * Ghi nhận kết quả ôn tập ngắt quãng (SM-2 / Leitner)
 */
export function recordSrsReview(hanzi, grade = 'good', wordFallback = {}) {
  const cleanHanzi = String(hanzi || wordFallback?.hanzi || '').trim();
  if (!cleanHanzi) return null;

  const map = readSrsMap();
  const nowDate = new Date();
  const nowIso = nowDate.toISOString();

  const existing = map[cleanHanzi] || {
    key: cleanHanzi,
    id: wordFallback.id || cleanHanzi,
    hanzi: cleanHanzi,
    pinyin: wordFallback.pinyin || safeToPinyin(cleanHanzi),
    meaning: wordFallback.meaning || '',
    english: wordFallback.english || '',
    level: wordFallback.level || 'HSK 1',
    example: wordFallback.example || '',
    mistakeCount: 0,
    reviewCount: 0,
    correctStreak: 0,
    box: 0,
    easeFactor: 2.5,
    intervalMinutes: 1,
    createdAt: nowIso,
    sources: ['Flashcard SRS']
  };

  let box = Number(existing.box) || 0;
  let ease = Number(existing.easeFactor) || 2.5;
  let mistakeCount = Number(existing.mistakeCount) || 0;
  let correctStreak = Number(existing.correctStreak) || 0;
  let intervalMinutes = 1;

  if (grade === 'again') {
    box = 0;
    correctStreak = 0;
    mistakeCount += 1;
    ease = Math.max(1.3, ease - 0.2);
    intervalMinutes = 1;
  } else if (grade === 'hard') {
    box = Math.max(1, box);
    correctStreak += 1;
    ease = Math.max(1.3, ease - 0.15);
    intervalMinutes = box <= 1 ? 10 : Math.round(SRS_INTERVALS_MINUTES[Math.min(box, 6)] * 0.6);
  } else if (grade === 'good') {
    box = Math.min(6, box + 1);
    correctStreak += 1;
    intervalMinutes = SRS_INTERVALS_MINUTES[box] || 1440;
  } else if (grade === 'easy') {
    box = Math.min(6, box + 2);
    correctStreak += 1;
    ease = Math.min(3.0, ease + 0.15);
    intervalMinutes = Math.round((SRS_INTERVALS_MINUTES[box] || 4320) * (ease / 2.5));
  }

  const nextDate = new Date(nowDate.getTime() + intervalMinutes * 60 * 1000);

  const updated = {
    ...existing,
    pinyin: existing.pinyin || wordFallback.pinyin || safeToPinyin(cleanHanzi),
    meaning: existing.meaning || wordFallback.meaning || '',
    english: existing.english || wordFallback.english || '',
    level: existing.level || wordFallback.level || 'HSK 1',
    example: existing.example || wordFallback.example || '',
    box,
    easeFactor: Number(ease.toFixed(2)),
    intervalMinutes,
    mistakeCount,
    correctStreak,
    reviewCount: (Number(existing.reviewCount) || 0) + 1,
    lastReviewedAt: nowIso,
    nextReviewAt: nextDate.toISOString(),
    isMistake: mistakeCount > 0
  };

  map[cleanHanzi] = updated;
  writeSrsMap(map);

  if (grade === 'good' || grade === 'easy') {
    const pts = grade === 'easy' ? 8 : 5;
    recordScore({
      category: 'vocabulary',
      points: pts,
      description: `Ôn tập SRS: ${cleanHanzi} (${updated.meaning || 'Từ vựng'})`
    });
    awardLuluExp(5, { source: 'Ôn tập SRS' });
  }

  emitSrsUpdated({ action: 'reviewed', grade, card: updated });
  return updated;
}

/**
 * Khởi tạo nhanh một gói từ vựng vào SRS (dành cho người mới bắt đầu)
 */
export function seedSrsStarterWords(words = [], sourceLabel = 'Lộ trình SRS') {
  if (!Array.isArray(words) || !words.length) return 0;
  const map = readSrsMap();
  const now = new Date().toISOString();
  let addedCount = 0;

  words.forEach((w) => {
    const cleanHanzi = String(w?.hanzi || w?.vocab || '').trim();
    if (!cleanHanzi || map[cleanHanzi]) return;
    map[cleanHanzi] = {
      key: cleanHanzi,
      id: w.id || cleanHanzi,
      hanzi: cleanHanzi,
      pinyin: w.pinyin || safeToPinyin(cleanHanzi),
      meaning: w.meaning || w.vietnamese_meaning || '',
      english: w.english || w.english_meaning || '',
      level: w.level || w.book_level || 'HSK 1',
      example: w.example || w.Example || '',
      mistakeCount: 0,
      reviewCount: 0,
      correctStreak: 0,
      box: 0,
      easeFactor: 2.5,
      intervalMinutes: 1,
      nextReviewAt: now,
      lastMistakeAt: null,
      lastReviewedAt: null,
      createdAt: now,
      sources: [sourceLabel],
      bookmarked: true,
      isMistake: false
    };
    addedCount++;
  });

  if (addedCount > 0) {
    writeSrsMap(map);
    emitSrsUpdated({ action: 'seeded', count: addedCount });
  }
  return addedCount;
}

/**
 * Thống kê tổng quan SRS & Sổ tay từ hay sai
 */
export function getSrsSummary() {
  const all = getAllSrsCards();
  const nowMs = Date.now();

  const dueCards = all.filter((c) => new Date(c.nextReviewAt || 0).getTime() <= nowMs);
  const mistakeCards = all.filter((c) => (c.mistakeCount || 0) > 0);
  const unresolvedMistakes = mistakeCards.filter((c) => (c.box || 0) < 3);
  const resolvedMistakes = mistakeCards.filter((c) => (c.box || 0) >= 3);
  const masteredSrs = all.filter((c) => (c.box || 0) >= 4);
  const learningSrs = all.filter((c) => (c.box || 0) > 0 && (c.box || 0) < 4);

  return {
    totalCards: all.length,
    dueCount: dueCards.length,
    dueCards,
    mistakeCount: mistakeCards.length,
    mistakeCards,
    unresolvedMistakesCount: unresolvedMistakes.length,
    resolvedMistakesCount: resolvedMistakes.length,
    masteredSrsCount: masteredSrs.length,
    learningSrsCount: learningSrs.length,
    allCards: all
  };
}

/**
 * Định dạng thời gian đến hạn ôn tiếp theo
 */
export function formatDueStatus(nextReviewAt) {
  if (!nextReviewAt) return { text: 'Cần ôn ngay 🔥', isDue: true };
  const targetMs = new Date(nextReviewAt).getTime();
  const diffMs = targetMs - Date.now();

  if (Number.isNaN(targetMs) || diffMs <= 0) {
    return { text: 'Đến hạn ôn ngay 🔥', isDue: true };
  }

  const diffMin = Math.ceil(diffMs / (60 * 1000));
  if (diffMin < 60) {
    return { text: `Sau ${diffMin} phút`, isDue: false };
  }

  const diffHours = Math.ceil(diffMin / 60);
  if (diffHours < 24) {
    return { text: `Sau ${diffHours} giờ`, isDue: false };
  }

  const diffDays = Math.ceil(diffHours / 24);
  return { text: `Sau ${diffDays} ngày`, isDue: false };
}

/**
 * Render giao diện Tab 3: Ôn Tập Ngắt Quãng Thông Minh (SRS) bên trong trang Từ Vựng
 */
export function renderSrsStudyPanel(
  container,
  { speak, toast, getStarterWords, forcedQueue = null, onClearForcedQueue = null } = {}
) {
  if (!container) return;

  let studyMode = 'flashcard'; // 'flashcard' | 'quiz'
  let isAnswerRevealed = false;
  let currentCardIndex = 0;
  let sessionReviewedCount = 0;

  const getActiveQueue = () => {
    const summary = getSrsSummary();
    if (Array.isArray(forcedQueue) && forcedQueue.length > 0) {
      return forcedQueue
        .map((keyOrCard) => {
          const h = typeof keyOrCard === 'string' ? keyOrCard : keyOrCard.hanzi;
          return getSrsCard(h) || keyOrCard;
        })
        .filter(Boolean);
    }
    if (summary.dueCards.length > 0) return summary.dueCards;
    return summary.allCards;
  };

  const renderView = () => {
    const summary = getSrsSummary();
    const queue = getActiveQueue();
    if (currentCardIndex >= queue.length) currentCardIndex = 0;
    const currentCard = queue[currentCardIndex] || null;
    const boxMeta = currentCard
      ? SRS_BOX_LABELS[Math.min(6, Math.max(0, Number(currentCard.box) || 0))]
      : SRS_BOX_LABELS[0];

    let quizOptions = [];
    if (studyMode === 'quiz' && currentCard) {
      const poolMeanings = summary.allCards
        .map((c) => c.meaning)
        .filter((m) => m && m !== currentCard.meaning);
      const fallbackMeanings = [
        'xin chào',
        'học tập',
        'nỗ lực',
        'nâng cao',
        'môi trường',
        'giải quyết',
        'kiểm tra chất lượng',
        'sản phẩm',
        'thời gian',
        'chuẩn bị'
      ].filter((m) => m !== currentCard.meaning);
      const combinedDistractors = [...new Set([...poolMeanings, ...fallbackMeanings])]
        .sort(() => Math.random() - 0.5)
        .slice(0, 3);
      quizOptions = [currentCard.meaning, ...combinedDistractors].sort(() => Math.random() - 0.5);
    }

    container.innerHTML = `
      <div class="srs-workspace">
        <!-- 4 Thẻ thống kê SRS -->
        <div class="srs-stats-row">
          <div class="srs-stat-pill due">
            <span class="srs-stat-icon">🔥</span>
            <div>
              <strong>${summary.dueCount} từ</strong>
              <small>Đến hạn cần ôn ngay</small>
            </div>
          </div>
          <div class="srs-stat-pill mistake">
            <span class="srs-stat-icon">⚠️</span>
            <div>
              <strong>${summary.unresolvedMistakesCount} từ</strong>
              <small>Từ hay sai cần khắc phục</small>
            </div>
          </div>
          <div class="srs-stat-pill learning">
            <span class="srs-stat-icon">🔄</span>
            <div>
              <strong>${summary.learningSrsCount} từ</strong>
              <small>Đang củng cố (1–3 ngày)</small>
            </div>
          </div>
          <div class="srs-stat-pill mastered">
            <span class="srs-stat-icon">🏆</span>
            <div>
              <strong>${summary.masteredSrsCount} từ</strong>
              <small>Trí nhớ dài hạn (≥7 ngày)</small>
            </div>
          </div>
        </div>

        <!-- Thanh công cụ chọn chế độ ôn SRS -->
        <div class="srs-toolbar">
          <div class="srs-mode-switcher" role="group" aria-label="Chế độ ôn SRS">
            <button type="button" class="srs-switch-btn ${studyMode === 'flashcard' ? 'active' : ''}" data-srs-mode="flashcard">
              🗂️ Thẻ lật tự đánh giá (SM-2)
            </button>
            <button type="button" class="srs-switch-btn ${studyMode === 'quiz' ? 'active' : ''}" data-srs-mode="quiz">
              ⚡ Trắc nghiệm phản xạ 4 đáp án
            </button>
          </div>

          <div class="srs-toolbar-actions">
            ${
              forcedQueue
                ? `<button type="button" class="fc-action-chip" id="srsClearCustomQueueBtn">✕ Thoát chế độ ôn riêng (${forcedQueue.length} từ)</button>`
                : ''
            }
            <button type="button" class="fc-action-chip" id="srsSeedWordsBtn" title="Thêm 10 từ vựng HSK vào lộ trình ôn tập thông minh">
              ➕ Nạp thêm 10 từ HSK vào SRS
            </button>
          </div>
        </div>

        ${
          !currentCard
            ? `
          <div class="srs-empty-card">
            <div class="srs-empty-icon">🧠</div>
            <h3>Chưa có từ vựng nào trong lộ trình Ôn tập Ngắt quãng (SRS)</h3>
            <p>Hệ thống SRS (Spaced Repetition SM-2) giúp bạn ôn tập đúng thời điểm sắp quên và tự động thu thập các từ bạn làm sai khi chơi game hoặc làm bài tập.</p>
            <div class="srs-empty-actions">
              <button type="button" class="primary-button" id="srsEmptyStartBtn">
                ⚡ Khởi tạo ngay 10 từ HSK đầu tiên
              </button>
            </div>
          </div>
        `
            : `
          <!-- Khu vực Thẻ Ôn Tập SRS -->
          <div class="srs-stage-card">
            <div class="srs-card-topbar">
              <div class="srs-card-badges">
                <span class="fc-level-tag">${escapeHtml(currentCard.level || 'HSK')}</span>
                <span class="srs-box-badge" style="color:${boxMeta.color};background:${boxMeta.bg}">
                  Cấp SRS ${currentCard.box || 0}/6 · ${boxMeta.label}
                </span>
                ${
                  (currentCard.mistakeCount || 0) > 0
                    ? `<span class="srs-mistake-tag">⚠️ Đã sai ${currentCard.mistakeCount} lần</span>`
                    : ''
                }
              </div>
              <div class="srs-card-progress-text">
                <span>Thẻ <strong>${currentCardIndex + 1}</strong> / ${queue.length}</span>
                ${sessionReviewedCount > 0 ? `<span class="srs-session-done">✓ Đã ôn ${sessionReviewedCount} lượt</span>` : ''}
              </div>
            </div>

            <div class="srs-card-main">
              <span class="srs-card-pinyin ${isAnswerRevealed || studyMode === 'flashcard' ? '' : 'is-masked'}">
                ${escapeHtml(currentCard.pinyin || safeToPinyin(currentCard.hanzi))}
              </span>
              <div class="srs-hanzi-row">
                <h2 class="srs-card-hanzi">${escapeHtml(currentCard.hanzi)}</h2>
                <button type="button" class="srs-speak-btn" id="srsSpeakWordBtn" title="Nghe phát âm">🔊</button>
              </div>
              ${
                Array.isArray(currentCard.sources) && currentCard.sources.length > 0
                  ? `<small class="srs-source-hint">Nguồn: ${escapeHtml(currentCard.sources.join(' · '))}</small>`
                  : ''
              }
            </div>

            ${
              studyMode === 'flashcard'
                ? isAnswerRevealed
                  ? `
                <div class="srs-answer-box">
                  <div class="srs-meaning-block">
                    <span class="srs-label">NGHĨA TIẾNG VIỆT</span>
                    <h3>${escapeHtml(currentCard.meaning || 'Chưa cập nhật')}</h3>
                    ${currentCard.english ? `<p class="srs-english">🇬🇧 ${escapeHtml(currentCard.english)}</p>` : ''}
                  </div>
                  ${
                    currentCard.example
                      ? `<div class="srs-example-block"><strong>Ví dụ:</strong> <span>${escapeHtml(currentCard.example)}</span></div>`
                      : ''
                  }
                </div>

                <div class="srs-rating-prompt">
                  <span>Đánh giá mức độ nhớ của bạn để thuật toán SM-2 hẹn lịch ôn tiếp theo:</span>
                  <div class="srs-rating-grid">
                    <button type="button" class="srs-rate-btn rate-again" data-srs-grade="again">
                      <strong>🔁 Quên rồi</strong>
                      <small>Ôn lại sau 1 phút</small>
                    </button>
                    <button type="button" class="srs-rate-btn rate-hard" data-srs-grade="hard">
                      <strong>😓 Hơi khó</strong>
                      <small>Ôn lại sau 10 phút</small>
                    </button>
                    <button type="button" class="srs-rate-btn rate-good" data-srs-grade="good">
                      <strong>👍 Nhớ được (+5đ)</strong>
                      <small>Sau ${currentCard.box === 0 ? '10 phút' : currentCard.box === 1 ? '1 ngày' : '3–7 ngày'}</small>
                    </button>
                    <button type="button" class="srs-rate-btn rate-easy" data-srs-grade="easy">
                      <strong>⚡ Quá dễ (+8đ)</strong>
                      <small>Nhảy bậc (${currentCard.box <= 1 ? '1–3 ngày' : '7–14 ngày'})</small>
                    </button>
                  </div>
                </div>
              `
                  : `
                <div class="srs-reveal-wrap">
                  <p>Hãy nhẩm nghĩa và cách đọc của chữ Hán trên trước khi lật đáp án</p>
                  <button type="button" class="primary-button srs-reveal-btn" id="srsRevealAnswerBtn">
                    👁️ Lật xem đáp án & Đánh giá trí nhớ
                  </button>
                </div>
              `
                : `
                <!-- Chế độ Trắc nghiệm 4 đáp án -->
                <div class="srs-quiz-section">
                  <p class="srs-quiz-instruction">Chọn nghĩa tiếng Việt chính xác cho chữ Hán trên:</p>
                  <div class="srs-quiz-grid">
                    ${quizOptions
                      .map(
                        (opt) => `
                      <button type="button" class="srs-quiz-opt" data-quiz-opt="${escapeHtml(opt)}">
                        ${escapeHtml(opt)}
                      </button>
                    `
                      )
                      .join('')}
                  </div>
                </div>
              `
            }
          </div>
        `
        }
      </div>
    `;

    container.querySelectorAll('[data-srs-mode]').forEach((btn) => {
      btn.addEventListener('click', () => {
        studyMode = btn.dataset.srsMode;
        isAnswerRevealed = false;
        renderView();
      });
    });

    const handleSeed = async () => {
      if (typeof getStarterWords !== 'function') return;
      const starter = await getStarterWords();
      const added = seedSrsStarterWords(starter, 'Từ vựng HSK');
      if (added > 0) {
        toast?.(`Đã thêm ${added} từ vựng vào lộ trình Ôn tập SRS! 🧠`);
      } else {
        toast?.('Các từ trong trang này đã có sẵn trong lộ trình SRS của bạn!');
      }
      renderView();
    };

    container.querySelector('#srsSeedWordsBtn')?.addEventListener('click', handleSeed);
    container.querySelector('#srsEmptyStartBtn')?.addEventListener('click', handleSeed);

    container.querySelector('#srsClearCustomQueueBtn')?.addEventListener('click', () => {
      if (onClearForcedQueue) onClearForcedQueue();
      renderView();
    });

    container.querySelector('#srsSpeakWordBtn')?.addEventListener('click', () => {
      if (currentCard && speak) speak(currentCard.hanzi);
    });

    container.querySelector('#srsRevealAnswerBtn')?.addEventListener('click', () => {
      isAnswerRevealed = true;
      if (currentCard && speak) speak(currentCard.hanzi);
      renderView();
    });

    container.querySelectorAll('[data-srs-grade]').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (!currentCard) return;
        const grade = btn.dataset.srsGrade;
        const updated = recordSrsReview(currentCard.hanzi, grade, currentCard);
        sessionReviewedCount++;
        isAnswerRevealed = false;
        const dueStatus = formatDueStatus(updated?.nextReviewAt);
        if (grade === 'again') {
          toast?.(`Đã ghi nhận "${currentCard.hanzi}" cần ôn lại ngay!`);
        } else {
          toast?.(`Đã lưu SRS "${currentCard.hanzi}" · Hẹn ôn lại: ${dueStatus.text}`);
        }
        currentCardIndex = (currentCardIndex + 1) % Math.max(1, getActiveQueue().length);
        renderView();
      });
    });

    container.querySelectorAll('[data-quiz-opt]').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (!currentCard) return;
        const chosen = btn.dataset.quizOpt;
        const isCorrect = chosen === currentCard.meaning;

        container.querySelectorAll('[data-quiz-opt]').forEach((b) => {
          b.disabled = true;
          if (b.dataset.quizOpt === currentCard.meaning) {
            b.classList.add('is-correct');
          }
        });

        if (isCorrect) {
          btn.classList.add('is-correct');
          if (speak) speak(currentCard.hanzi);
          recordSrsReview(currentCard.hanzi, 'good', currentCard);
          sessionReviewedCount++;
        } else {
          btn.classList.add('is-wrong');
          recordSrsReview(currentCard.hanzi, 'again', currentCard);
        }

        setTimeout(() => {
          currentCardIndex = (currentCardIndex + 1) % Math.max(1, getActiveQueue().length);
          renderView();
        }, 700);
      });
    });
  };

  renderView();
}

/**
 * Render giao diện Tab 4: Sổ Tay Từ Hay Sai (Mistake Notebook)
 */
export function renderMistakesNotebookPanel(
  container,
  { speak, toast, onPracticeTheseWords, getStarterWords } = {}
) {
  if (!container) return;

  let activeFilter = 'all'; // 'all' | 'due' | 'frequent' | 'resolved'

  const renderNotebook = () => {
    const summary = getSrsSummary();
    const notebookCards = summary.allCards.filter((c) => (c.mistakeCount || 0) > 0 || c.bookmarked);

    const filtered = notebookCards.filter((c) => {
      if (activeFilter === 'due') {
        return new Date(c.nextReviewAt || 0).getTime() <= Date.now() || (c.box || 0) === 0;
      }
      if (activeFilter === 'frequent') {
        return (c.mistakeCount || 0) >= 2;
      }
      if (activeFilter === 'resolved') {
        return (c.box || 0) >= 3;
      }
      return true;
    });

    filtered.sort((a, b) => (b.mistakeCount || 0) - (a.mistakeCount || 0));

    container.innerHTML = `
      <div class="mistakes-notebook-wrap">
        <div class="mistakes-hero-banner">
          <div class="mistakes-hero-info">
            <span class="mistakes-hero-badge">📓 SỔ TAY TỪ HAY SAI & TỪ KHÓ</span>
            <h3>Khắc phục điểm yếu — Biến từ hay sai thành từ nhớ sâu</h3>
            <p>Mọi từ bạn chọn sai trong <strong>Trò chơi, Đấu trường 1v1, Luyện dịch, Sắp xếp câu</strong> hoặc tự đánh dấu đều được lưu tự động tại đây.</p>
          </div>
          <div class="mistakes-hero-actions">
            ${
              notebookCards.length > 0
                ? `
              <button type="button" class="primary-button" id="practiceAllMistakesBtn">
                🚀 Luyện ngay ${Math.min(10, notebookCards.length)} từ hay sai nhất
              </button>
            `
                : `
              <button type="button" class="primary-button" id="seedSampleMistakesBtn">
                ➕ Thêm bộ từ HSK cần lưu ý vào Sổ tay
              </button>
            `
            }
          </div>
        </div>

        <div class="mistakes-toolbar">
          <div class="activity-filter-tabs">
            <button type="button" class="activity-filter-chip ${activeFilter === 'all' ? 'active' : ''}" data-mistake-filter="all">
              Tất cả (${notebookCards.length})
            </button>
            <button type="button" class="activity-filter-chip ${activeFilter === 'due' ? 'active' : ''}" data-mistake-filter="due">
              🔥 Cần khắc phục ngay (${notebookCards.filter((c) => (c.box || 0) === 0 || new Date(c.nextReviewAt || 0).getTime() <= Date.now()).length})
            </button>
            <button type="button" class="activity-filter-chip ${activeFilter === 'frequent' ? 'active' : ''}" data-mistake-filter="frequent">
              ⚠️ Sai nhiều lần (${notebookCards.filter((c) => (c.mistakeCount || 0) >= 2).length})
            </button>
            <button type="button" class="activity-filter-chip ${activeFilter === 'resolved' ? 'active' : ''}" data-mistake-filter="resolved">
              ✓ Đã khắc phục (${notebookCards.filter((c) => (c.box || 0) >= 3).length})
            </button>
          </div>
        </div>

        ${
          filtered.length > 0
            ? `
          <div class="mistakes-cards-grid">
            ${filtered
              .map((card) => {
                const boxMeta = SRS_BOX_LABELS[Math.min(6, Math.max(0, Number(card.box) || 0))];
                const dueInfo = formatDueStatus(card.nextReviewAt);
                const progressPct = Math.min(100, Math.round(((card.box || 0) / 6) * 100));
                return `
                <article class="mistake-item-card ${(card.mistakeCount || 0) >= 2 ? 'is-frequent' : ''}">
                  <div class="mistake-card-top">
                    <div class="mistake-word-block">
                      <span class="mistake-pinyin">${escapeHtml(card.pinyin || safeToPinyin(card.hanzi))}</span>
                      <strong class="mistake-hanzi">${escapeHtml(card.hanzi)}</strong>
                    </div>
                    <div class="mistake-top-badges">
                      <span class="fc-level-tag">${escapeHtml(card.level || 'HSK')}</span>
                      ${
                        (card.mistakeCount || 0) > 0
                          ? `<span class="mistake-count-pill">⚠️ Sai ${card.mistakeCount} lần</span>`
                          : `<span class="mistake-bookmark-pill">📌 Đã ghim</span>`
                      }
                    </div>
                  </div>

                  <div class="mistake-meaning-row">
                    <strong>${escapeHtml(card.meaning || 'Chưa cập nhật nghĩa')}</strong>
                    ${card.english ? `<small>🇬🇧 ${escapeHtml(card.english)}</small>` : ''}
                  </div>

                  ${
                    Array.isArray(card.sources) && card.sources.length > 0
                      ? `
                    <div class="mistake-sources-row">
                      ${card.sources.map((src) => `<span class="mistake-source-chip">${escapeHtml(src)}</span>`).join('')}
                    </div>
                  `
                      : ''
                  }

                  <div class="mistake-srs-bar-box">
                    <div class="mistake-srs-labels">
                      <span style="color:${boxMeta.color};font-weight:700">${boxMeta.label}</span>
                      <span class="${dueInfo.isDue ? 'due-now' : ''}">${dueInfo.text}</span>
                    </div>
                    <div class="dash-badge-mini-bar">
                      <div class="dash-badge-mini-fill" style="width:${Math.max(8, progressPct)}%"></div>
                    </div>
                  </div>

                  <div class="mistake-card-actions">
                    <button type="button" class="mistake-btn-action" data-speak-mistake="${escapeHtml(card.hanzi)}" title="Nghe phát âm">
                      🔊 Nghe
                    </button>
                    <button type="button" class="mistake-btn-action btn-mark-good" data-review-good="${escapeHtml(card.hanzi)}" title="Đánh dấu đã ôn thuộc (+1 cấp SRS)">
                      ✓ Đã nhớ (+5đ)
                    </button>
                    <button type="button" class="mistake-btn-action btn-remove" data-remove-mistake="${escapeHtml(card.hanzi)}" title="Xóa khỏi sổ tay">
                      🗑️
                    </button>
                  </div>
                </article>
              `;
              })
              .join('')}
          </div>
        `
            : `
          <div class="srs-empty-card">
            <div class="srs-empty-icon">✨</div>
            <h3>${activeFilter === 'all' ? 'Sổ tay từ hay sai của bạn đang trống!' : 'Không có từ nào trong bộ lọc này'}</h3>
            <p>Khi bạn trả lời chưa đúng trong Trò chơi, Đấu trường 1v1, Luyện dịch hoặc bấm nút 📌 trên danh sách từ vựng, từ đó sẽ tự động xuất hiện ở đây để bạn ôn lại.</p>
          </div>
        `
        }
      </div>
    `;

    container.querySelectorAll('[data-mistake-filter]').forEach((btn) => {
      btn.addEventListener('click', () => {
        activeFilter = btn.dataset.mistakeFilter || 'all';
        renderNotebook();
      });
    });

    container.querySelector('#practiceAllMistakesBtn')?.addEventListener('click', () => {
      const top10 = notebookCards
        .slice()
        .sort((a, b) => (b.mistakeCount || 0) - (a.mistakeCount || 0))
        .slice(0, 10);
      if (onPracticeTheseWords && top10.length > 0) {
        onPracticeTheseWords(top10);
      }
    });

    container.querySelector('#seedSampleMistakesBtn')?.addEventListener('click', async () => {
      if (typeof getStarterWords === 'function') {
        const words = await getStarterWords();
        seedSrsStarterWords(words, 'Sổ tay cá nhân');
        toast?.('Đã thêm các từ vựng vào Sổ tay Ôn tập! 📓');
        renderNotebook();
      }
    });

    container.querySelectorAll('[data-speak-mistake]').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (speak) speak(btn.dataset.speakMistake);
      });
    });

    container.querySelectorAll('[data-review-good]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const h = btn.dataset.reviewGood;
        recordSrsReview(h, 'good');
        toast?.(`Tuyệt vời! Đã nâng cấp trí nhớ cho từ "${h}" (+5 điểm) ✦`);
        renderNotebook();
      });
    });

    container.querySelectorAll('[data-remove-mistake]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const h = btn.dataset.removeMistake;
        removeSrsWord(h);
        toast?.(`Đã xóa "${h}" khỏi Sổ tay.`);
        renderNotebook();
      });
    });
  };

  renderNotebook();
}

/**
 * Widget thông minh trên Trang chủ: nhắc lịch Ôn tập Ngắt quãng SRS & Từ hay sai
 */
export function renderDashboardSrsBanner(selector = '#dashboardSrsWidget') {
  const banner = document.querySelector(selector);
  if (!banner) return;

  const updateBanner = () => {
    const summary = getSrsSummary();
    const hasDueOrMistakes = summary.dueCount > 0 || summary.unresolvedMistakesCount > 0;

    banner.innerHTML = `
      <div class="srs-dashboard-banner ${hasDueOrMistakes ? 'has-due' : ''}">
        <div class="srs-banner-left">
          <div class="srs-banner-icon">${hasDueOrMistakes ? '🧠' : '📓'}</div>
          <div class="srs-banner-text">
            <div class="srs-banner-title-row">
              <strong>Ôn tập Ngắt quãng (SRS) & Sổ Tay Từ Hay Sai</strong>
              ${
                summary.dueCount > 0
                  ? `<span class="srs-due-pill">🔥 ${summary.dueCount} từ đến hạn ôn</span>`
                  : `<span class="srs-ok-pill">✦ Lịch ôn thông minh SM-2</span>`
              }
              ${
                summary.unresolvedMistakesCount > 0
                  ? `<span class="srs-mistake-pill">⚠️ ${summary.unresolvedMistakesCount} từ hay sai</span>`
                  : ''
              }
            </div>
            <p>
              ${
                hasDueOrMistakes
                  ? `Bạn có <strong>${summary.dueCount}</strong> từ đến hạn ôn tập hôm nay và <strong>${summary.unresolvedMistakesCount}</strong> từ hay sai cần khắc phục để nhớ lâu gấp 5 lần.`
                  : summary.totalCards > 0
                    ? `Tuyệt vời! Bạn đang quản lý <strong>${summary.totalCards}</strong> từ trong bộ nhớ SRS (${summary.masteredSrsCount} từ đã thuộc dài hạn).`
                    : 'Tự động thu thập những từ bạn làm sai khi chơi game, thi đấu, luyện dịch và nhắc lịch ôn tập đúng thời điểm vàng trước khi quên.'
              }
            </p>
          </div>
        </div>
        <div class="srs-banner-actions">
          <button type="button" class="srs-banner-btn primary" data-goto-vocab-tab="srs">
            🧠 Ôn tập SRS (${summary.dueCount || summary.totalCards || 10})
          </button>
          <button type="button" class="srs-banner-btn secondary" data-goto-vocab-tab="mistakes">
            📓 Sổ tay từ hay sai (${summary.mistakeCount})
          </button>
        </div>
      </div>
    `;

    banner.querySelectorAll('[data-goto-vocab-tab]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const targetTab = btn.dataset.gotoVocabTab;
        sessionStorage.setItem('mandarinly_open_vocab_tab', targetTab);
        if (window.location.hash === '#vocabulary') {
          window.dispatchEvent(new CustomEvent('open-vocab-subtab', { detail: { tab: targetTab } }));
        } else {
          window.location.hash = '#vocabulary';
        }
      });
    });
  };

  updateBanner();
  window.addEventListener('srs-updated', updateBanner);
}
