import { supabase } from './supabase.js';
import { normalizeLevel, sortLevels } from './levels.js';
import { pinyin } from 'https://esm.sh/pinyin-pro@3.27.0';
import { recordScore, SCORE_RULES } from './score-service.js';
import { awardLuluExp } from './lulu.js';

export const PAGE_SIZE = 20;

export const vocabulary = [
  { id: 'sample-1', hanzi: '你好', pinyin: 'ni3 hao3', meaning: 'xin chào', level: 'HSK 1' },
  { id: 'sample-2', hanzi: '学习', pinyin: 'xue2 xi2', meaning: 'học tập', level: 'HSK 1' },
  { id: 'sample-3', hanzi: '努力', pinyin: 'nu3 li4', meaning: 'nỗ lực', level: 'HSK 2' },
  { id: 'sample-4', hanzi: '提高', pinyin: 'ti2 gao1', meaning: 'nâng cao', level: 'HSK 3' },
  { id: 'sample-5', hanzi: '环境', pinyin: 'huan2 jing4', meaning: 'môi trường', level: 'HSK 4' },
  { id: 'sample-6', hanzi: '解决', pinyin: 'jie3 jue2', meaning: 'giải quyết', level: 'HSK 5' },
  { id: 'sample-7', hanzi: '可持续', pinyin: 'ke3 chi2 xu4', meaning: 'bền vững', level: 'HSK 6' },
  { id: 'sample-8', hanzi: '车间', pinyin: 'che1 jian1', meaning: 'phân xưởng', level: 'Công xưởng' },
  { id: 'sample-9', hanzi: '安全帽', pinyin: 'an1 quan2 mao4', meaning: 'mũ bảo hộ', level: 'Công xưởng' },
  { id: 'sample-10', hanzi: '生产线', pinyin: 'sheng1 chan3 xian4', meaning: 'dây chuyền sản xuất', level: 'Công xưởng' },
  { id: 'sample-11', hanzi: '质量检查', pinyin: 'zhi4 liang4 jian3 cha2', meaning: 'kiểm tra chất lượng', level: 'Công xưởng' }
];

const categories = ['HSK 1', 'HSK 2', 'HSK 3', 'HSK 4', 'HSK 5', 'HSK 6', 'Công xưởng'];

function escapeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function toPinyin(hanzi) {
  return pinyin(hanzi, { toneType: 'symbol' });
}

export function extractChineseSentence(example) {
  if (!example || typeof example !== 'string') return '';
  const text = example.trim();

  // Bỏ tiền tố như "EXAMPLE:", "Ví dụ:", "VD:"
  const clean = text.replace(/^(example|ví\s*dụ|vd|câu\s*ví\s*dụ)\s*[:：\-]\s*/i, '').trim();

  // 1. Phân tách bằng dấu gạch chéo '/' (Ví dụ: "我爱你。/Wǒ ài nǐ./Tôi yêu bạn.")
  if (clean.includes('/')) {
    const parts = clean.split('/');
    for (const part of parts) {
      const trimmed = part.trim();
      if (/[\u4e00-\u9fa5]/.test(trimmed)) {
        const match = trimmed.match(/^[\u4e00-\u9fa5\u3000-\u303f\uff00-\uffef\s,.?!:;，。？！：；“”‘’…]+/);
        return (match ? match[0] : trimmed).trim();
      }
    }
  }

  // 2. Phân tách bằng dấu xuống dòng
  if (clean.includes('\n')) {
    const lines = clean.split(/\r?\n/);
    for (const line of lines) {
      const trimmed = line.trim();
      if (/[\u4e00-\u9fa5]/.test(trimmed) && !/^[a-zA-Z]/.test(trimmed)) {
        const match = trimmed.match(/^[\u4e00-\u9fa5\u3000-\u303f\uff00-\uffef\s,.?!:;，。？！：；“”‘’…]+/);
        return (match ? match[0] : trimmed).trim();
      }
    }
  }

  // 3. Trích xuất chuỗi chữ Hán liên tục kèm dấu câu tiếng Trung
  const match = clean.match(/[\u4e00-\u9fa5][\u4e00-\u9fa5\u3000-\u303f\uff00-\uffef\s,.?!:;，。？！：；“”‘’…]*/);
  if (match) {
    return match[0].trim();
  }

  return clean;
}

async function trackVocabularyView(vocabularyId) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !vocabularyId) return;
  const { error } = await supabase.from('learning_activity').insert({
    user_id: user.id, activity_type: 'vocabulary_view', vocabulary_id: vocabularyId
  });
  if (error) console.warn('Unable to record vocabulary view:', error.message);
  recordScore({ category: 'vocabulary', points: SCORE_RULES.VOCABULARY_VIEW, description: 'Xem từ vựng' });
  awardLuluExp(2, { source: 'Xem từ vựng' });
}

async function loadMasteredVocabulary(userId) {
  if (!userId) return new Set();
  const { data, error } = await supabase
    .from('vocabulary_mastery')
    .select('vocabulary_id')
    .eq('user_id', userId);
  if (error) throw error;
  return new Set(data.map((item) => String(item.vocabulary_id)));
}

async function saveMasteredVocabulary(userId, vocabularyId, isMastered) {
  if (!userId) return;
  if (isMastered) {
    const { error } = await supabase.from('vocabulary_mastery').upsert({
      user_id: userId,
      vocabulary_id: vocabularyId,
      mastered_at: new Date().toISOString()
    }, { onConflict: 'user_id,vocabulary_id' });
    if (error) throw error;
    recordScore({ category: 'vocabulary', points: SCORE_RULES.VOCABULARY_PRACTICE, description: 'Đánh dấu thuộc từ vựng' });
    awardLuluExp(20, { source: 'Thuộc từ vựng', foodDrop: true });
    return;
  }
  const { error } = await supabase
    .from('vocabulary_mastery')
    .delete()
    .eq('user_id', userId)
    .eq('vocabulary_id', vocabularyId);
  if (error) throw error;
}

/**
 * Phân trang từ Supabase: chỉ lấy đúng 20 từ cho trang hiện tại và tổng số từ theo cấp độ
 */
async function fetchVocabularyPage(category, page = 1) {
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  let query = supabase
    .from('vocabulary')
    .select('id, book_level, vocab, english_meaning, vietnamese_meaning, word_type, Example', { count: 'exact' });

  const noSpace = category.replace(/\s+/g, '');
  if (noSpace !== category) {
    query = query.or(`book_level.eq.${category},book_level.eq.${noSpace}`);
  } else {
    query = query.eq('book_level', category);
  }

  const { data, count, error } = await query
    .order('id', { ascending: true })
    .range(from, to);

  if (error) throw error;

  const rows = (data || []).map((word) => ({
    id: word.id,
    hanzi: word.vocab,
    pinyin: toPinyin(word.vocab),
    english: word.english_meaning || '',
    meaning: word.vietnamese_meaning,
    level: normalizeLevel(word.book_level),
    wordType: word.word_type,
    example: word.Example || word.example || word.component || ''
  }));

  return {
    words: rows,
    total: count !== null && count !== undefined ? count : rows.length
  };
}

/**
 * Fallback dữ liệu mẫu khi offline hoặc lỗi kết nối Supabase
 */
function getFallbackVocabularyPage(category, page = 1) {
  const filtered = vocabulary.filter((word) => normalizeLevel(word.level) === normalizeLevel(category));
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE;
  return {
    words: filtered.slice(from, to),
    total: filtered.length
  };
}

/**
 * Tạo danh sách các số trang hiển thị thân thiện (bao gồm dấu ...)
 */
function getPaginationPages(current, total) {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }
  if (current <= 4) {
    return [1, 2, 3, 4, 5, '...', total];
  }
  if (current >= total - 3) {
    return [1, '...', total - 4, total - 3, total - 2, total - 1, total];
  }
  return [1, '...', current - 1, current, current + 1, '...', total];
}

/**
 * Render thanh điều hướng phân trang
 */
function renderPaginationHtml(page, totalPages, totalWords) {
  if (totalWords <= 0) return '';
  if (totalPages <= 1) {
    return `
      <div class="vocabulary-pagination" role="navigation" aria-label="Phân trang từ vựng">
        <div class="vocabulary-pagination-info">
          Hiển thị <strong>${totalWords}</strong> từ
        </div>
      </div>
    `;
  }

  const startWord = (page - 1) * PAGE_SIZE + 1;
  const endWord = Math.min(page * PAGE_SIZE, totalWords);
  const pages = getPaginationPages(page, totalPages);

  const pagesHtml = pages.map((p) => {
    if (p === '...') {
      return '<span class="vocab-page-ellipsis">…</span>';
    }
    const isActive = p === page;
    return `<button type="button" class="vocab-page-btn${isActive ? ' active' : ''}" data-page="${p}" ${isActive ? 'aria-current="page" disabled' : ''}>${p}</button>`;
  }).join('');

  return `
    <div class="vocabulary-pagination" role="navigation" aria-label="Phân trang từ vựng">
      <div class="vocabulary-pagination-info">
        Hiển thị <strong>${startWord}–${endWord}</strong> trong tổng số <strong>${totalWords}</strong> từ
      </div>
      <div class="vocabulary-pagination-controls">
        <button type="button" class="vocab-page-btn vocab-page-nav" data-page="first" ${page <= 1 ? 'disabled' : ''} aria-label="Trang đầu" title="Trang đầu">«</button>
        <button type="button" class="vocab-page-btn vocab-page-nav" data-page="prev" ${page <= 1 ? 'disabled' : ''} aria-label="Trang trước" title="Trang trước">‹ Trước</button>
        <div class="vocab-page-numbers">
          ${pagesHtml}
        </div>
        <button type="button" class="vocab-page-btn vocab-page-nav" data-page="next" ${page >= totalPages ? 'disabled' : ''} aria-label="Trang sau" title="Trang sau">Sau ›</button>
        <button type="button" class="vocab-page-btn vocab-page-nav" data-page="last" ${page >= totalPages ? 'disabled' : ''} aria-label="Trang cuối" title="Trang cuối">»</button>
      </div>
    </div>
  `;
}

export async function initVocabulary({ selector = '[data-vocabulary]', toast } = {}) {
  const container = document.querySelector(selector);
  if (!container) return;

  const availableCategories = sortLevels(categories);
  let currentCategory = availableCategories[0] || 'HSK 1';
  let currentPage = 1;
  let totalWords = 0;
  let totalPages = 1;
  let currentWords = [];
  let isLoading = false;
  let user = null;
  let masteredVocabularyIds = new Set();

  // State riêng cho chế độ Thẻ (Flashcard)
  let activeMode = 'list'; // 'list' | 'flashcard'
  let fcCategory = currentCategory;
  let fcPage = 1;
  let fcTotalWords = 0;
  let fcTotalPages = 1;
  let fcRawWords = [];
  let fcFilteredWords = [];
  let fcCurrentIndex = 0;
  let fcIsFlipped = false;
  let fcFilter = 'all'; // 'all' | 'unlearned' | 'mastered'
  let fcAutoAudio = false;
  let fcIsLoading = false;

  try {
    const { data: { user: loggedInUser } } = await supabase.auth.getUser();
    user = loggedInUser;
    if (user?.id) {
      masteredVocabularyIds = await loadMasteredVocabulary(user.id);
    }
  } catch (error) {
    console.warn('Unable to load user or mastered vocabulary:', error.message);
  }

  // Khung giao diện:
  // 1. Thanh 2 Tab chuyển đổi nhanh: Từ vựng & Thẻ
  // 2. Panel Từ vựng (giữ nguyên 100% nội dung và giao diện cũ)
  // 3. Panel Thẻ Flashcard 3D mới
  container.innerHTML = `
    <div class="vocab-mode-tabs" role="tablist" aria-label="Chọn chế độ học">
      <button type="button" class="vocab-mode-tab active" data-mode-tab="list" role="tab" aria-selected="true">
        <span class="mode-tab-icon">📖</span>
        <div class="mode-tab-text">
          <strong>Từ vựng</strong>
          <small>Danh sách & tra cứu chi tiết</small>
        </div>
      </button>
      <button type="button" class="vocab-mode-tab" data-mode-tab="flashcard" role="tab" aria-selected="false">
        <span class="mode-tab-icon">🗂️</span>
        <div class="mode-tab-text">
          <strong>Thẻ (Flashcard 3D)</strong>
          <small>Lật thẻ 2 mặt ghi nhớ nhanh</small>
        </div>
      </button>
    </div>

    <!-- PANEL 1: TỪ VỰNG (GIỮ NGUYÊN GIAO DIỆN & NỘI DUNG CŨ) -->
    <div class="vocab-mode-panel" data-mode-panel="list">
      <div class="vocabulary-tabs" role="tablist">
        ${availableCategories.map((category, index) => `
          <button type="button" class="vocabulary-tab${index === 0 ? ' active' : ''}" data-vocabulary-category="${escapeHtml(category)}">${escapeHtml(category)}</button>
        `).join('')}
      </div>
      <div class="vocabulary-list-wrap">
        <div class="vocabulary-list" data-vocabulary-list></div>
        <div class="vocabulary-loading-overlay" data-vocabulary-overlay hidden>
          <span class="vocabulary-loading-spinner"></span> Đang tải từ vựng...
        </div>
      </div>
      <div class="vocabulary-pagination-container" data-vocabulary-pagination-container></div>
      <div class="vocabulary-detail" data-vocabulary-detail hidden></div>
    </div>

    <!-- PANEL 2: THẺ FLASHCARD 3D (GIAO DIỆN MỚI) -->
    <div class="vocab-mode-panel" data-mode-panel="flashcard" hidden>
      <!-- Chọn cấp độ HSK cho bộ thẻ -->
      <div class="vocabulary-tabs fc-level-tabs" role="tablist">
        ${availableCategories.map((category, index) => `
          <button type="button" class="vocabulary-tab fc-level-tab${index === 0 ? ' active' : ''}" data-fc-category="${escapeHtml(category)}">${escapeHtml(category)}</button>
        `).join('')}
      </div>

      <!-- Thanh công cụ lọc & điều khiển bộ thẻ -->
      <div class="fc-toolbar">
        <div class="fc-filter-pills" role="group" aria-label="Bộ lọc thẻ">
          <button type="button" class="fc-filter-pill active" data-fc-filter="all">Tất cả</button>
          <button type="button" class="fc-filter-pill" data-fc-filter="unlearned">Chưa thuộc ☆</button>
          <button type="button" class="fc-filter-pill" data-fc-filter="mastered">Đã thuộc ★</button>
        </div>

        <div class="fc-deck-tools">
          <div class="fc-set-selector">
            <button type="button" class="fc-set-nav-btn" id="fcPrevSetBtn" title="Bộ thẻ trước">‹ Bộ trước</button>
            <span class="fc-set-badge" id="fcSetBadge">Bộ 1 / 1</span>
            <button type="button" class="fc-set-nav-btn" id="fcNextSetBtn" title="Bộ thẻ tiếp theo">Bộ sau ›</button>
          </div>
          <button type="button" class="fc-action-chip" id="fcShuffleBtn" title="Xáo trộn ngẫu nhiên các thẻ trong bộ">🔀 Trộn thẻ</button>
          <button type="button" class="fc-action-chip" id="fcAutoSpeakBtn" aria-pressed="false" title="Tự động phát âm khi mở thẻ mới">🔊 Tự phát âm</button>
        </div>
      </div>

      <!-- Thanh tiến trình -->
      <div class="fc-progress-card">
        <div class="fc-progress-meta">
          <span id="fcCardPosition">Thẻ <strong>1</strong> / 20</span>
          <span class="fc-mastered-pill" id="fcDeckMasteredInfo">★ Đã thuộc: <strong>0</strong> / 20 từ</span>
        </div>
        <div class="fc-progress-bar-track">
          <div class="fc-progress-bar-fill" id="fcProgressBarFill" style="width: 5%;"></div>
        </div>
      </div>

      <!-- Khu vực sân khấu Thẻ 3D -->
      <div class="fc-stage-wrapper">
        <div class="fc-empty-state" id="fcEmptyState" hidden>
          <span class="fc-empty-icon">🗂️</span>
          <h3 id="fcEmptyTitle">Không có thẻ nào phù hợp</h3>
          <p id="fcEmptyDesc">Thử chuyển sang bộ lọc "Tất cả" hoặc chọn bộ thẻ khác nhé.</p>
          <button type="button" class="primary-button" id="fcResetFilterBtn">Xem tất cả thẻ trong bộ</button>
        </div>

        <div class="fc-scene" id="fcScene">
          <div class="fc-card-3d" id="fcCard3d" tabindex="0" role="button" aria-label="Thẻ từ vựng 3D - Bấm để lật thẻ">
            <!-- Mặt trước: Chữ Hán -->
            <div class="fc-card-face fc-card-front">
              <div class="fc-card-header">
                <div class="fc-card-badges">
                  <span class="fc-level-tag" id="fcFrontLevel">HSK 1</span>
                  <span class="fc-type-tag" id="fcFrontWordType" hidden></span>
                </div>
                <div class="fc-card-corner-btns">
                  <button type="button" class="fc-corner-btn" id="fcFrontSpeakBtn" title="Nghe phát âm" aria-label="Nghe phát âm">🔊</button>
                  <button type="button" class="fc-corner-btn fc-corner-star" id="fcFrontStarBtn" title="Đánh dấu thuộc từ" aria-label="Đánh dấu thuộc từ">☆</button>
                </div>
              </div>

              <div class="fc-front-body">
                <span class="fc-front-pinyin vocabulary-pinyin" id="fcFrontPinyin">nǐ hǎo</span>
                <h2 class="fc-front-hanzi" id="fcFrontHanzi">你好</h2>
              </div>

              <div class="fc-card-footer">
                <span class="fc-flip-guide">👆 Chạm để lật mặt • 👈👉 Vuốt trái / phải để chuyển thẻ</span>
              </div>
            </div>

            <!-- Mặt sau: Pinyin + Nghĩa + Ví dụ -->
            <div class="fc-card-face fc-card-back">
              <div class="fc-card-header">
                <div class="fc-back-head-info">
                  <strong class="fc-back-hanzi" id="fcBackHanzi">你好</strong>
                  <span class="fc-back-pinyin" id="fcBackPinyin">nǐ hǎo</span>
                  <span class="fc-type-tag" id="fcBackWordType" hidden></span>
                </div>
                <div class="fc-card-corner-btns">
                  <button type="button" class="fc-corner-btn" id="fcBackSpeakBtn" title="Nghe phát âm" aria-label="Nghe phát âm">🔊</button>
                  <button type="button" class="fc-corner-btn fc-corner-star" id="fcBackStarBtn" title="Đánh dấu thuộc từ" aria-label="Đánh dấu thuộc từ">☆</button>
                </div>
              </div>

              <div class="fc-back-body">
                <div class="fc-meaning-card">
                  <span class="fc-field-label">NGHĨA TIẾNG VIỆT</span>
                  <h3 class="fc-meaning-vi" id="fcBackMeaning">xin chào</h3>
                  <p class="fc-meaning-en" id="fcBackEnglish" hidden></p>
                </div>

                <div class="fc-example-card" id="fcBackExampleBox" hidden>
                  <div class="fc-example-top">
                    <span class="fc-field-label">💬 CÂU VÍ DỤ</span>
                    <button type="button" class="fc-example-audio-btn" id="fcBackExampleSpeakBtn">🔊 Nghe câu</button>
                  </div>
                  <p class="fc-example-content" id="fcBackExampleText"></p>
                </div>
              </div>

              <div class="fc-card-footer">
                <span class="fc-flip-guide">🔄 Chạm để lật lại • 👈👉 Vuốt trái / phải để chuyển thẻ</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Các nút điều khiển chính dưới thẻ -->
      <div class="fc-main-controls" id="fcMainControls">
        <button type="button" class="fc-ctrl-btn fc-ctrl-prev" id="fcPrevBtn">
          <span>←</span> <strong>Thẻ trước</strong>
        </button>
        <button type="button" class="fc-ctrl-btn fc-ctrl-flip" id="fcFlipBtn">
          <span>🔄</span> <strong>Lật thẻ</strong>
        </button>
        <button type="button" class="fc-ctrl-btn fc-ctrl-master" id="fcMasterBtn">
          <span id="fcMasterBtnIcon">☆</span> <strong id="fcMasterBtnText">Đánh dấu thuộc</strong>
        </button>
        <button type="button" class="fc-ctrl-btn fc-ctrl-next" id="fcNextBtn">
          <strong>Thẻ tiếp</strong> <span>→</span>
        </button>
      </div>

      <!-- Lưới danh sách thu nhỏ của 20 thẻ trong bộ -->
      <div class="fc-deck-overview">
        <div class="fc-deck-overview-head">
          <h4>Danh sách thẻ trong bộ hiện tại</h4>
          <small>Nhấn vào từ bất kỳ để mở nhanh thẻ đó</small>
        </div>
        <div class="fc-mini-grid" id="fcMiniGrid"></div>
      </div>
    </div>
  `;

  const listPanel = container.querySelector('[data-mode-panel="list"]');
  const flashcardPanel = container.querySelector('[data-mode-panel="flashcard"]');
  const list = container.querySelector('[data-vocabulary-list]');
  const overlay = container.querySelector('[data-vocabulary-overlay]');
  const paginationContainer = container.querySelector('[data-vocabulary-pagination-container]');
  const detail = container.querySelector('[data-vocabulary-detail]');

  const pageCache = new Map();
  let activeRequestId = 0;

  // =========================================================================
  // XỬ LÝ PHÁT ÂM DÙNG CHUNG CHO CẢ TỪ VỰNG & THẺ
  // =========================================================================
  let pronunciationAudio = null;
  const closeDetail = () => {
    window.speechSynthesis?.cancel();
    pronunciationAudio?.pause();
    pronunciationAudio = null;
    detail.hidden = true;
    detail.innerHTML = '';
  };

  const playAudioFallback = (hanzi, status) => {
    try {
      pronunciationAudio?.pause();
      pronunciationAudio = new Audio(`https://dict.youdao.com/dictvoice?audio=${encodeURIComponent(hanzi)}&le=zh`);
      if (status) {
        pronunciationAudio.onplay = () => { status.textContent = 'Đang phát âm...'; };
        pronunciationAudio.onended = () => { status.textContent = ''; };
        pronunciationAudio.onerror = () => { status.textContent = 'Không thể tải audio phát âm.'; };
      }
      pronunciationAudio.play().catch(() => {
        if (status) status.textContent = 'Không thể phát âm thanh.';
      });
    } catch (_) {
      if (status) status.textContent = 'Không thể phát âm thanh.';
    }
  };

  const speak = (hanzi, status) => {
    if (!hanzi) return;

    window.speechSynthesis?.cancel();
    pronunciationAudio?.pause();

    if ('speechSynthesis' in window) {
      try {
        const utterance = new SpeechSynthesisUtterance(hanzi);
        utterance.lang = 'zh-CN';
        utterance.rate = 0.85;

        const voices = window.speechSynthesis.getVoices();
        const zhVoice = voices.find(
          (v) => v.lang === 'zh-CN' || v.lang === 'zh_CN' || v.lang.startsWith('zh') || v.name.includes('Chinese')
        );
        if (zhVoice) {
          utterance.voice = zhVoice;
        }

        if (status) status.textContent = 'Đang phát âm...';

        utterance.onend = () => {
          if (status) status.textContent = '';
        };

        let started = false;
        utterance.onstart = () => {
          started = true;
        };

        utterance.onerror = (e) => {
          console.warn('SpeechSynthesis utterance error, falling back:', e);
          playAudioFallback(hanzi, status);
        };

        window.speechSynthesis.speak(utterance);

        setTimeout(() => {
          if (!window.speechSynthesis.speaking && !started) {
            playAudioFallback(hanzi, status);
          }
        }, 400);

        return;
      } catch (err) {
        console.warn('SpeechSynthesis error, falling back to audio:', err);
      }
    }

    playAudioFallback(hanzi, status);
  };

  // =========================================================================
  // CHUYỂN ĐỔI GIỮA 2 TAB: TỪ VỰNG & THẺ
  // =========================================================================
  container.querySelectorAll('[data-mode-tab]').forEach((tabBtn) => {
    tabBtn.addEventListener('click', () => {
      const targetMode = tabBtn.dataset.modeTab;
      if (targetMode === activeMode) return;
      activeMode = targetMode;

      container.querySelectorAll('[data-mode-tab]').forEach((btn) => {
        const isCurrent = btn.dataset.modeTab === activeMode;
        btn.classList.toggle('active', isCurrent);
        btn.setAttribute('aria-selected', String(isCurrent));
      });

      if (activeMode === 'list') {
        listPanel.hidden = false;
        flashcardPanel.hidden = true;
        renderWordsList(currentWords);
      } else {
        listPanel.hidden = true;
        flashcardPanel.hidden = false;
        closeDetail();
        if (fcRawWords.length === 0) {
          loadFlashcardSet(fcCategory, fcPage);
        } else {
          applyFlashcardFilter(false);
        }
      }
    });
  });

  // =========================================================================
  // PHẦN 1: DANH SÁCH TỪ VỰNG (GIỮ NGUYÊN NỘI DUNG & GIAO DIỆN CŨ)
  // =========================================================================
  const renderWordsList = (words) => {
    if (!words.length) {
      list.innerHTML = '<p class="vocabulary-loading">Chưa có từ vựng cho nhóm này.</p>';
      return;
    }

    list.innerHTML = words.map((word, index) => `
      <article class="vocabulary-item" role="button" tabindex="0" data-vocabulary-index="${index}">
        <div class="vocabulary-main-row">
          <div class="vocabulary-hanzi">
            <span class="vocabulary-pinyin">${escapeHtml(word.pinyin || toPinyin(word.hanzi))}</span>
            <strong>${escapeHtml(word.hanzi)}</strong>
          </div>
          <div class="vocabulary-meanings">
            ${word.english ? `<span class="vocabulary-english">${escapeHtml(word.english)}</span>` : ''}
            <span class="vocabulary-vietnamese">${escapeHtml(word.meaning)}</span>
            ${word.wordType ? `<span class="vocabulary-tag">${escapeHtml(word.wordType)}</span>` : ''}
          </div>
        </div>
        ${word.example ? `
          <div class="vocabulary-component" data-speak-example role="button" tabindex="0" title="Nhấp vào để nghe đọc câu chữ Hán">
            <span class="vocabulary-component-label">Example:</span>
            <span>${escapeHtml(word.example)}</span>
          </div>
        ` : ''}
        <button class="vocabulary-row-speak" type="button" aria-label="Phát âm ${escapeHtml(word.hanzi)}" data-speak-row>🔊</button>
        <button class="vocabulary-row-mastered${masteredVocabularyIds.has(String(word.id)) ? ' is-mastered' : ''}" type="button" aria-label="${masteredVocabularyIds.has(String(word.id)) ? 'Bỏ đánh dấu đã thuộc' : 'Đánh dấu đã thuộc'}" aria-pressed="${masteredVocabularyIds.has(String(word.id))}" data-mastered-row>${masteredVocabularyIds.has(String(word.id)) ? '★' : '☆'}</button>
      </article>
    `).join('');
  };

  const showOverlay = () => {
    if (overlay) {
      overlay.hidden = false;
      overlay.classList.add('active');
    }
  };

  const hideOverlay = () => {
    if (overlay) {
      overlay.hidden = true;
      overlay.classList.remove('active');
    }
  };

  const loadPage = async (category, page = 1, shouldScroll = false) => {
    const requestId = ++activeRequestId;
    currentCategory = category;
    currentPage = page;

    const cacheKey = `${category}:${page}`;
    if (pageCache.has(cacheKey)) {
      const cached = pageCache.get(cacheKey);
      currentWords = cached.words;
      totalWords = cached.total;
      totalPages = Math.max(1, Math.ceil(totalWords / PAGE_SIZE));
      hideOverlay();
      isLoading = false;
      renderWordsList(currentWords);
      paginationContainer.innerHTML = renderPaginationHtml(currentPage, totalPages, totalWords);
      if (shouldScroll) {
        const listWrap = container.querySelector('.vocabulary-list-wrap');
        listWrap?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
      return;
    }

    isLoading = true;

    if (currentWords.length > 0) {
      showOverlay();
    } else {
      list.innerHTML = '<p class="vocabulary-loading"><span class="vocabulary-loading-spinner"></span> Đang tải dữ liệu từ vựng...</p>';
    }

    try {
      let result = null;
      try {
        result = await fetchVocabularyPage(category, page);
      } catch (error) {
        console.warn('Supabase fetch failed, falling back:', error.message);
        result = getFallbackVocabularyPage(category, page);
      }

      if (requestId !== activeRequestId) return;

      pageCache.set(cacheKey, result);

      currentWords = result.words;
      totalWords = result.total;
      totalPages = Math.max(1, Math.ceil(totalWords / PAGE_SIZE));
      if (currentPage > totalPages) currentPage = totalPages;

      renderWordsList(currentWords);
      paginationContainer.innerHTML = renderPaginationHtml(currentPage, totalPages, totalWords);

      if (shouldScroll) {
        const listWrap = container.querySelector('.vocabulary-list-wrap');
        listWrap?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    } finally {
      if (requestId === activeRequestId) {
        hideOverlay();
        isLoading = false;
      }
    }
  };

  // Đổi tab cấp độ (Danh sách từ vựng)
  container.querySelectorAll('[data-vocabulary-category]').forEach((tab) => {
    tab.addEventListener('click', () => {
      if (isLoading) return;
      const targetCategory = tab.dataset.vocabularyCategory;
      if (targetCategory === currentCategory) return;

      container.querySelectorAll('[data-vocabulary-category]').forEach((item) => item.classList.remove('active'));
      tab.classList.add('active');
      loadPage(targetCategory, 1, false);
    });
  });

  // Điều hướng phân trang
  paginationContainer.addEventListener('click', (event) => {
    const btn = event.target.closest('[data-page]');
    if (!btn || btn.disabled || isLoading) return;

    const action = btn.dataset.page;
    let targetPage = currentPage;

    if (action === 'first') {
      targetPage = 1;
    } else if (action === 'prev') {
      targetPage = Math.max(1, currentPage - 1);
    } else if (action === 'next') {
      targetPage = Math.min(totalPages, currentPage + 1);
    } else if (action === 'last') {
      targetPage = totalPages;
    } else {
      targetPage = Number(action);
    }

    if (targetPage !== currentPage && targetPage >= 1 && targetPage <= totalPages) {
      loadPage(currentCategory, targetPage, true);
    }
  });

  const showDetail = (word) => {
    trackVocabularyView(word.id);
    detail.hidden = false;
    detail.innerHTML = `
      <div class="vocabulary-detail-backdrop" data-close-vocabulary-detail></div>
      <section class="vocabulary-detail-card" role="dialog" aria-modal="true" aria-labelledby="vocabulary-detail-title">
        <button class="vocabulary-detail-close" type="button" aria-label="Đóng" data-close-vocabulary-detail>×</button>
        <div class="vocabulary-detail-header">
          <div class="vocabulary-detail-word"><span class="vocabulary-detail-pinyin">${escapeHtml(word.pinyin || toPinyin(word.hanzi))}</span><h2 id="vocabulary-detail-title">${escapeHtml(word.hanzi)}</h2></div>
          <button class="vocabulary-speak" type="button" aria-label="Phát âm ${escapeHtml(word.hanzi)}" data-speak-vocabulary>🔊</button>
        </div>
        <p>${escapeHtml(word.english || word.pinyin || '')}</p>
        <p class="vocabulary-pronunciation-status" aria-live="polite" data-pronunciation-status></p>
        <table><tbody>
          <tr><th>Nghĩa</th><td>${escapeHtml(word.meaning)}</td></tr>
          <tr><th>Từ loại</th><td>${escapeHtml(word.wordType || 'Chưa cập nhật')}</td></tr>
          <tr>
            <th>Example</th>
            <td class="vocabulary-detail-example-cell">
              <span>${escapeHtml(word.example || 'Chưa cập nhật')}</span>
              ${word.example ? `<button type="button" class="vocabulary-example-speak-btn" data-speak-modal-example title="Nghe câu chữ Hán">🔊 Nghe câu</button>` : ''}
            </td>
          </tr>
        </tbody></table>
      </section>`;
    detail.querySelector('[data-speak-vocabulary]').addEventListener('click', () => {
      speak(word.hanzi, detail.querySelector('[data-pronunciation-status]'));
    });
    const modalExampleBtn = detail.querySelector('[data-speak-modal-example]');
    if (modalExampleBtn) {
      modalExampleBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const chineseSentence = extractChineseSentence(word.example);
        if (chineseSentence) {
          modalExampleBtn.classList.add('is-speaking');
          speak(chineseSentence, detail.querySelector('[data-pronunciation-status]'));
          setTimeout(() => modalExampleBtn.classList.remove('is-speaking'), 1200);
        }
      });
    }
    detail.querySelectorAll('[data-close-vocabulary-detail]').forEach((button) => button.addEventListener('click', closeDetail));
  };

  // Xử lý click trên danh sách: thuộc từ, phát âm, mở chi tiết
  list.addEventListener('click', (event) => {
    const item = event.target.closest('[data-vocabulary-index]');
    if (!item) return;
    const index = Number(item.dataset.vocabularyIndex);
    const word = currentWords[index];
    if (!word) return;

    const masteredBtn = event.target.closest('[data-mastered-row]');
    if (masteredBtn) {
      if (!user) {
        toast?.('Vui lòng đăng nhập để lưu từ vựng đã thuộc!');
        return;
      }
      const vocabularyId = String(word.id);
      const isMastered = !masteredVocabularyIds.has(vocabularyId);
      if (isMastered) masteredVocabularyIds.add(vocabularyId); else masteredVocabularyIds.delete(vocabularyId);

      masteredBtn.classList.toggle('is-mastered', isMastered);
      masteredBtn.setAttribute('aria-pressed', isMastered);
      masteredBtn.setAttribute('aria-label', isMastered ? 'Bỏ đánh dấu đã thuộc' : 'Đánh dấu đã thuộc');
      masteredBtn.textContent = isMastered ? '★' : '☆';

      saveMasteredVocabulary(user.id, word.id, isMastered).catch((error) => {
        if (isMastered) masteredVocabularyIds.delete(vocabularyId); else masteredVocabularyIds.add(vocabularyId);
        masteredBtn.classList.toggle('is-mastered', !isMastered);
        masteredBtn.setAttribute('aria-pressed', !isMastered);
        masteredBtn.setAttribute('aria-label', !isMastered ? 'Bỏ đánh dấu đã thuộc' : 'Đánh dấu đã thuộc');
        masteredBtn.textContent = !isMastered ? '★' : '☆';
        console.warn('Unable to save mastered vocabulary:', error.message);
      });
      return;
    }

    const speakBtn = event.target.closest('[data-speak-row]');
    if (speakBtn) {
      event.stopPropagation();
      speakBtn.classList.add('is-speaking');
      speak(word.hanzi, {
        set textContent(message) {
          speakBtn.setAttribute('aria-label', message);
          if (!message) speakBtn.classList.remove('is-speaking');
        }
      });
      setTimeout(() => speakBtn.classList.remove('is-speaking'), 700);
      return;
    }

    const exampleBox = event.target.closest('[data-speak-example], .vocabulary-component');
    if (exampleBox) {
      event.stopPropagation();
      const chineseSentence = extractChineseSentence(word.example);
      if (chineseSentence) {
        exampleBox.classList.add('is-speaking');
        speak(chineseSentence, {
          set textContent(message) {
            if (!message) exampleBox.classList.remove('is-speaking');
          }
        });
        setTimeout(() => exampleBox.classList.remove('is-speaking'), 1200);
      }
      return;
    }

    showDetail(word);
  });

  list.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    const exampleBox = event.target.closest('[data-speak-example], .vocabulary-component');
    if (exampleBox) {
      event.preventDefault();
      event.stopPropagation();
      const item = event.target.closest('[data-vocabulary-index]');
      if (!item) return;
      const index = Number(item.dataset.vocabularyIndex);
      const word = currentWords[index];
      if (!word) return;
      const chineseSentence = extractChineseSentence(word.example);
      if (chineseSentence) {
        exampleBox.classList.add('is-speaking');
        speak(chineseSentence);
        setTimeout(() => exampleBox.classList.remove('is-speaking'), 1200);
      }
      return;
    }
    if (event.target.closest('[data-speak-row], [data-mastered-row]')) return;
    const item = event.target.closest('[data-vocabulary-index]');
    if (!item) return;
    event.preventDefault();
    const index = Number(item.dataset.vocabularyIndex);
    const word = currentWords[index];
    if (word) showDetail(word);
  });

  // =========================================================================
  // PHẦN 2: GIAO DIỆN THẺ FLASHCARD 3D MỚI
  // =========================================================================
  const fcScene = container.querySelector('#fcScene');
  const fcCard3d = container.querySelector('#fcCard3d');
  const fcEmptyState = container.querySelector('#fcEmptyState');
  const fcMainControls = container.querySelector('#fcMainControls');
  const fcSetBadge = container.querySelector('#fcSetBadge');
  const fcPrevSetBtn = container.querySelector('#fcPrevSetBtn');
  const fcNextSetBtn = container.querySelector('#fcNextSetBtn');
  const fcShuffleBtn = container.querySelector('#fcShuffleBtn');
  const fcAutoSpeakBtn = container.querySelector('#fcAutoSpeakBtn');
  const fcResetFilterBtn = container.querySelector('#fcResetFilterBtn');

  const fcCardPosition = container.querySelector('#fcCardPosition');
  const fcDeckMasteredInfo = container.querySelector('#fcDeckMasteredInfo');
  const fcProgressBarFill = container.querySelector('#fcProgressBarFill');

  const fcFrontLevel = container.querySelector('#fcFrontLevel');
  const fcFrontWordType = container.querySelector('#fcFrontWordType');
  const fcFrontPinyin = container.querySelector('#fcFrontPinyin');
  const fcFrontHanzi = container.querySelector('#fcFrontHanzi');
  const fcFrontSpeakBtn = container.querySelector('#fcFrontSpeakBtn');
  const fcFrontStarBtn = container.querySelector('#fcFrontStarBtn');

  const fcBackHanzi = container.querySelector('#fcBackHanzi');
  const fcBackPinyin = container.querySelector('#fcBackPinyin');
  const fcBackWordType = container.querySelector('#fcBackWordType');
  const fcBackSpeakBtn = container.querySelector('#fcBackSpeakBtn');
  const fcBackStarBtn = container.querySelector('#fcBackStarBtn');
  const fcBackMeaning = container.querySelector('#fcBackMeaning');
  const fcBackEnglish = container.querySelector('#fcBackEnglish');
  const fcBackExampleBox = container.querySelector('#fcBackExampleBox');
  const fcBackExampleText = container.querySelector('#fcBackExampleText');
  const fcBackExampleSpeakBtn = container.querySelector('#fcBackExampleSpeakBtn');

  const fcPrevBtn = container.querySelector('#fcPrevBtn');
  const fcFlipBtn = container.querySelector('#fcFlipBtn');
  const fcMasterBtn = container.querySelector('#fcMasterBtn');
  const fcMasterBtnIcon = container.querySelector('#fcMasterBtnIcon');
  const fcMasterBtnText = container.querySelector('#fcMasterBtnText');
  const fcNextBtn = container.querySelector('#fcNextBtn');
  const fcMiniGrid = container.querySelector('#fcMiniGrid');

  const updateFlashcardView = (triggerAudio = false) => {
    const masteredInRaw = fcRawWords.filter((w) => masteredVocabularyIds.has(String(w.id))).length;
    if (fcDeckMasteredInfo) {
      fcDeckMasteredInfo.innerHTML = `★ Đã thuộc: <strong>${masteredInRaw}</strong> / ${fcRawWords.length} từ`;
    }
    if (fcSetBadge) {
      fcSetBadge.textContent = `Bộ ${fcPage} / ${fcTotalPages}`;
    }
    if (fcPrevSetBtn) fcPrevSetBtn.disabled = fcPage <= 1 || fcIsLoading;
    if (fcNextSetBtn) fcNextSetBtn.disabled = fcPage >= fcTotalPages || fcIsLoading;

    if (!fcFilteredWords.length) {
      if (fcScene) fcScene.hidden = true;
      if (fcMainControls) fcMainControls.hidden = true;
      if (fcEmptyState) fcEmptyState.hidden = false;
      if (fcCardPosition) fcCardPosition.innerHTML = 'Thẻ <strong>0</strong> / 0';
      if (fcProgressBarFill) fcProgressBarFill.style.width = '0%';
      if (fcMiniGrid) fcMiniGrid.innerHTML = '';
      return;
    }

    if (fcScene) fcScene.hidden = false;
    if (fcMainControls) fcMainControls.hidden = false;
    if (fcEmptyState) fcEmptyState.hidden = true;

    if (fcCurrentIndex >= fcFilteredWords.length) fcCurrentIndex = 0;
    if (fcCurrentIndex < 0) fcCurrentIndex = fcFilteredWords.length - 1;

    const word = fcFilteredWords[fcCurrentIndex];
    const isMastered = masteredVocabularyIds.has(String(word.id));
    const py = word.pinyin || toPinyin(word.hanzi);

    // Cập nhật thanh tiến trình
    const total = fcFilteredWords.length;
    const pos = fcCurrentIndex + 1;
    const pct = Math.round((pos / total) * 100);
    if (fcCardPosition) fcCardPosition.innerHTML = `Thẻ <strong>${pos}</strong> / ${total}`;
    if (fcProgressBarFill) fcProgressBarFill.style.width = `${pct}%`;

    // Đặt lại trạng thái mặt trước khi sang thẻ mới
    fcIsFlipped = false;
    fcCard3d?.classList.remove('is-flipped');

    // Mặt trước
    if (fcFrontLevel) fcFrontLevel.textContent = word.level || fcCategory;
    if (fcFrontWordType) {
      if (word.wordType) {
        fcFrontWordType.textContent = word.wordType;
        fcFrontWordType.hidden = false;
      } else {
        fcFrontWordType.hidden = true;
      }
    }
    if (fcFrontPinyin) fcFrontPinyin.textContent = py;
    if (fcFrontHanzi) fcFrontHanzi.textContent = word.hanzi;

    // Mặt sau
    if (fcBackHanzi) fcBackHanzi.textContent = word.hanzi;
    if (fcBackPinyin) fcBackPinyin.textContent = py;
    if (fcBackWordType) {
      if (word.wordType) {
        fcBackWordType.textContent = word.wordType;
        fcBackWordType.hidden = false;
      } else {
        fcBackWordType.hidden = true;
      }
    }
    if (fcBackMeaning) fcBackMeaning.textContent = word.meaning;
    if (fcBackEnglish) {
      if (word.english) {
        fcBackEnglish.textContent = `🇬🇧 ${word.english}`;
        fcBackEnglish.hidden = false;
      } else {
        fcBackEnglish.hidden = true;
      }
    }
    if (fcBackExampleBox) {
      if (word.example) {
        fcBackExampleText.textContent = word.example;
        fcBackExampleBox.hidden = false;
      } else {
        fcBackExampleBox.hidden = true;
      }
    }

    // Trạng thái nút thuộc từ
    [fcFrontStarBtn, fcBackStarBtn].forEach((btn) => {
      if (!btn) return;
      btn.classList.toggle('is-mastered', isMastered);
      btn.textContent = isMastered ? '★' : '☆';
      btn.setAttribute('aria-pressed', String(isMastered));
    });

    if (fcMasterBtn) {
      fcMasterBtn.classList.toggle('is-mastered', isMastered);
      if (fcMasterBtnIcon) fcMasterBtnIcon.textContent = isMastered ? '★' : '☆';
      if (fcMasterBtnText) fcMasterBtnText.textContent = isMastered ? 'Đã thuộc từ này' : 'Đánh dấu thuộc';
    }

    // Cập nhật lưới thu nhỏ
    if (fcMiniGrid) {
      fcMiniGrid.innerHTML = fcFilteredWords.map((item, idx) => {
        const itemMastered = masteredVocabularyIds.has(String(item.id));
        const isCurrent = idx === fcCurrentIndex;
        return `
          <button type="button" class="fc-mini-item${isCurrent ? ' active' : ''}${itemMastered ? ' is-mastered' : ''}" data-fc-jump="${idx}">
            <span class="fc-mini-num">${idx + 1}</span>
            <strong class="fc-mini-hanzi">${escapeHtml(item.hanzi)}</strong>
            ${itemMastered ? '<span class="fc-mini-star">★</span>' : ''}
          </button>
        `;
      }).join('');
    }

    if (triggerAudio && fcAutoAudio) {
      speak(word.hanzi);
    }
  };

  const applyFlashcardFilter = (resetIndex = true) => {
    if (fcFilter === 'unlearned') {
      fcFilteredWords = fcRawWords.filter((w) => !masteredVocabularyIds.has(String(w.id)));
    } else if (fcFilter === 'mastered') {
      fcFilteredWords = fcRawWords.filter((w) => masteredVocabularyIds.has(String(w.id)));
    } else {
      fcFilteredWords = [...fcRawWords];
    }
    if (resetIndex) fcCurrentIndex = 0;
    updateFlashcardView(false);
  };

  const loadFlashcardSet = async (category, page = 1) => {
    fcCategory = category;
    fcPage = page;
    fcIsLoading = true;

    const cacheKey = `${category}:${page}`;
    if (pageCache.has(cacheKey)) {
      const cached = pageCache.get(cacheKey);
      fcRawWords = [...cached.words];
      fcTotalWords = cached.total;
      fcTotalPages = Math.max(1, Math.ceil(fcTotalWords / PAGE_SIZE));
      fcIsLoading = false;
      applyFlashcardFilter(true);
      return;
    }

    try {
      let result = null;
      try {
        result = await fetchVocabularyPage(category, page);
      } catch (err) {
        result = getFallbackVocabularyPage(category, page);
      }
      pageCache.set(cacheKey, result);
      fcRawWords = [...result.words];
      fcTotalWords = result.total;
      fcTotalPages = Math.max(1, Math.ceil(fcTotalWords / PAGE_SIZE));
    } finally {
      fcIsLoading = false;
      applyFlashcardFilter(true);
    }
  };

  // Lật thẻ 3D
  const toggleFlipCard = () => {
    if (!fcFilteredWords.length) return;
    fcIsFlipped = !fcIsFlipped;
    fcCard3d?.classList.toggle('is-flipped', fcIsFlipped);
    const currentWord = fcFilteredWords[fcCurrentIndex];
    if (fcIsFlipped && currentWord) {
      trackVocabularyView(currentWord.id);
      if (fcAutoAudio) speak(currentWord.hanzi);
    }
  };

  // Đánh dấu đã thuộc trên thẻ Flashcard
  const toggleCurrentCardMastered = () => {
    if (!fcFilteredWords.length) return;
    if (!user) {
      toast?.('Vui lòng đăng nhập để lưu trạng thái thuộc từ!');
      return;
    }
    const word = fcFilteredWords[fcCurrentIndex];
    if (!word) return;

    const vocabId = String(word.id);
    const isMastered = !masteredVocabularyIds.has(vocabId);
    if (isMastered) masteredVocabularyIds.add(vocabId);
    else masteredVocabularyIds.delete(vocabId);

    updateFlashcardView(false);

    saveMasteredVocabulary(user.id, word.id, isMastered).catch((err) => {
      console.warn('Lỗi lưu thuộc từ:', err.message);
      if (isMastered) masteredVocabularyIds.delete(vocabId);
      else masteredVocabularyIds.add(vocabId);
      updateFlashcardView(false);
    });
  };

  let isCardAnimating = false;
  let ignoreNextClick = false;

  const goToNextCard = () => {
    if (!fcFilteredWords.length || isCardAnimating) return;
    isCardAnimating = true;
    fcScene?.classList.remove('swipe-in-right', 'swipe-in-left', 'swipe-out-right');
    fcScene?.classList.add('swipe-out-left');
    setTimeout(() => {
      fcCurrentIndex = (fcCurrentIndex + 1) % fcFilteredWords.length;
      updateFlashcardView(true);
      fcScene?.classList.remove('swipe-out-left');
      fcScene?.classList.add('swipe-in-right');
      setTimeout(() => {
        fcScene?.classList.remove('swipe-in-right');
        isCardAnimating = false;
      }, 180);
    }, 140);
  };

  const goToPrevCard = () => {
    if (!fcFilteredWords.length || isCardAnimating) return;
    isCardAnimating = true;
    fcScene?.classList.remove('swipe-in-right', 'swipe-in-left', 'swipe-out-left');
    fcScene?.classList.add('swipe-out-right');
    setTimeout(() => {
      fcCurrentIndex = (fcCurrentIndex - 1 + fcFilteredWords.length) % fcFilteredWords.length;
      updateFlashcardView(true);
      fcScene?.classList.remove('swipe-out-right');
      fcScene?.classList.add('swipe-in-left');
      setTimeout(() => {
        fcScene?.classList.remove('swipe-in-left');
        isCardAnimating = false;
      }, 180);
    }, 140);
  };

  // Thao tác vuốt trái / vuốt phải (Touch & Mouse Drag) để chuyển thẻ
  let swipeStartX = 0;
  let swipeStartY = 0;
  let swipeCurrentX = 0;
  let isSwiping = false;
  let isMouseDown = false;

  const handleSwipeStart = (x, y) => {
    swipeStartX = x;
    swipeStartY = y;
    swipeCurrentX = x;
    isSwiping = false;
    if (fcScene) fcScene.style.transition = 'none';
  };

  const handleSwipeMove = (x, y) => {
    swipeCurrentX = x;
    const dx = swipeCurrentX - swipeStartX;
    const dy = y - swipeStartY;

    if (Math.abs(dx) > 12 && Math.abs(dx) > Math.abs(dy)) {
      isSwiping = true;
      const clampedDx = Math.max(-130, Math.min(130, dx * 0.55));
      const tilt = clampedDx * 0.035;
      if (fcScene) {
        fcScene.style.transform = `translateX(${clampedDx}px) rotate(${tilt}deg)`;
      }
    }
  };

  const handleSwipeEnd = () => {
    const dx = swipeCurrentX - swipeStartX;
    if (fcScene) {
      fcScene.style.transition = '';
      fcScene.style.transform = '';
    }

    if (isSwiping) {
      ignoreNextClick = true;
      setTimeout(() => {
        ignoreNextClick = false;
      }, 260);

      if (dx <= -45) {
        // Vuốt sang trái -> Thẻ tiếp theo
        goToNextCard();
      } else if (dx >= 45) {
        // Vuốt sang phải -> Thẻ trước đó
        goToPrevCard();
      }
    }
    isSwiping = false;
  };

  fcScene?.addEventListener('touchstart', (e) => {
    if (e.target.closest('button') || !e.touches.length) return;
    handleSwipeStart(e.touches[0].clientX, e.touches[0].clientY);
  }, { passive: true });

  fcScene?.addEventListener('touchmove', (e) => {
    if (!e.touches.length) return;
    handleSwipeMove(e.touches[0].clientX, e.touches[0].clientY);
  }, { passive: true });

  fcScene?.addEventListener('touchend', () => {
    handleSwipeEnd();
  });

  fcScene?.addEventListener('touchcancel', () => {
    handleSwipeEnd();
  });

  // Hỗ trợ kéo chuột trái/phải trên máy tính
  fcScene?.addEventListener('mousedown', (e) => {
    if (e.button !== 0 || e.target.closest('button')) return;
    isMouseDown = true;
    handleSwipeStart(e.clientX, e.clientY);
  });

  window.addEventListener('mousemove', (e) => {
    if (!isMouseDown || activeMode !== 'flashcard') return;
    handleSwipeMove(e.clientX, e.clientY);
  });

  window.addEventListener('mouseup', () => {
    if (!isMouseDown) return;
    isMouseDown = false;
    handleSwipeEnd();
  });

  // Sự kiện click vào thẻ để lật
  fcCard3d?.addEventListener('click', (e) => {
    if (ignoreNextClick || e.target.closest('button')) return;
    toggleFlipCard();
  });

  // Sự kiện phát âm mặt trước & mặt sau
  [fcFrontSpeakBtn, fcBackSpeakBtn].forEach((btn) => {
    btn?.addEventListener('click', (e) => {
      e.stopPropagation();
      const word = fcFilteredWords[fcCurrentIndex];
      if (word) speak(word.hanzi);
    });
  });

  // Sự kiện phát âm câu ví dụ mặt sau
  fcBackExampleSpeakBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    const word = fcFilteredWords[fcCurrentIndex];
    if (!word?.example) return;
    const sentence = extractChineseSentence(word.example);
    if (sentence) speak(sentence);
  });

  // Sự kiện ngôi sao trên góc thẻ & nút Đánh dấu thuộc bên dưới
  [fcFrontStarBtn, fcBackStarBtn, fcMasterBtn].forEach((btn) => {
    btn?.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleCurrentCardMastered();
    });
  });

  // Nút Lật thẻ, Thẻ trước, Thẻ tiếp
  fcFlipBtn?.addEventListener('click', toggleFlipCard);
  fcPrevBtn?.addEventListener('click', goToPrevCard);
  fcNextBtn?.addEventListener('click', goToNextCard);

  // Chuyển cấp độ HSK trong phần Thẻ
  container.querySelectorAll('[data-fc-category]').forEach((tab) => {
    tab.addEventListener('click', () => {
      if (fcIsLoading) return;
      const targetCat = tab.dataset.fcCategory;
      if (targetCat === fcCategory) return;
      container.querySelectorAll('[data-fc-category]').forEach((t) => t.classList.remove('active'));
      tab.classList.add('active');
      loadFlashcardSet(targetCat, 1);
    });
  });

  // Bộ lọc Tất cả / Chưa thuộc / Đã thuộc
  container.querySelectorAll('[data-fc-filter]').forEach((pill) => {
    pill.addEventListener('click', () => {
      const targetFilter = pill.dataset.fcFilter;
      if (targetFilter === fcFilter) return;
      fcFilter = targetFilter;
      container.querySelectorAll('[data-fc-filter]').forEach((p) => p.classList.remove('active'));
      pill.classList.add('active');
      applyFlashcardFilter(true);
    });
  });

  fcResetFilterBtn?.addEventListener('click', () => {
    fcFilter = 'all';
    container.querySelectorAll('[data-fc-filter]').forEach((p) => {
      p.classList.toggle('active', p.dataset.fcFilter === 'all');
    });
    applyFlashcardFilter(true);
  });

  // Chuyển bộ 20 từ trước / sau
  fcPrevSetBtn?.addEventListener('click', () => {
    if (fcPage > 1 && !fcIsLoading) {
      loadFlashcardSet(fcCategory, fcPage - 1);
    }
  });
  fcNextSetBtn?.addEventListener('click', () => {
    if (fcPage < fcTotalPages && !fcIsLoading) {
      loadFlashcardSet(fcCategory, fcPage + 1);
    }
  });

  // Trộn ngẫu nhiên bộ thẻ
  fcShuffleBtn?.addEventListener('click', () => {
    if (fcFilteredWords.length <= 1) return;
    fcFilteredWords = [...fcFilteredWords].sort(() => Math.random() - 0.5);
    fcCurrentIndex = 0;
    updateFlashcardView(true);
    toast?.('Đã trộn ngẫu nhiên bộ thẻ! 🔀');
  });

  // Bật/tắt tự động phát âm
  fcAutoSpeakBtn?.addEventListener('click', () => {
    fcAutoAudio = !fcAutoAudio;
    fcAutoSpeakBtn.classList.toggle('active', fcAutoAudio);
    fcAutoSpeakBtn.setAttribute('aria-pressed', String(fcAutoAudio));
    toast?.(fcAutoAudio ? 'Đã bật tự động phát âm 🔊' : 'Đã tắt tự động phát âm 🔇');
  });

  // Nhảy nhanh đến thẻ bất kỳ từ lưới thu nhỏ
  fcMiniGrid?.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-fc-jump]');
    if (!btn) return;
    const idx = Number(btn.dataset.fcJump);
    if (!Number.isNaN(idx) && idx >= 0 && idx < fcFilteredWords.length) {
      fcCurrentIndex = idx;
      updateFlashcardView(true);
    }
  });

  // Hỗ trợ bàn phím khi đang mở tab Thẻ
  fcCard3d?.addEventListener('keydown', (e) => {
    if (activeMode !== 'flashcard') return;
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      toggleFlipCard();
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      fcNextBtn?.click();
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      fcPrevBtn?.click();
    }
  });

  // Tải trang đầu tiên cho Danh sách từ vựng
  await loadPage(currentCategory, 1, false);
}
