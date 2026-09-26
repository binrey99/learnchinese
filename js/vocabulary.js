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

export async function initVocabulary({ selector = '[data-vocabulary]' } = {}) {
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

  try {
    const { data: { user: loggedInUser } } = await supabase.auth.getUser();
    user = loggedInUser;
    if (user?.id) {
      masteredVocabularyIds = await loadMasteredVocabulary(user.id);
    }
  } catch (error) {
    console.warn('Unable to load user or mastered vocabulary:', error.message);
  }

  // Khung giao diện: Tabs cấp độ, Vùng danh sách kèm loading overlay, Vùng phân trang, Modal chi tiết
  container.innerHTML = `
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
  `;

  const list = container.querySelector('[data-vocabulary-list]');
  const overlay = container.querySelector('[data-vocabulary-overlay]');
  const paginationContainer = container.querySelector('[data-vocabulary-pagination-container]');
  const detail = container.querySelector('[data-vocabulary-detail]');

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
          <div class="vocabulary-component">
            <span class="vocabulary-component-label">Example:</span>
            <span>${escapeHtml(word.example)}</span>
          </div>
        ` : ''}
        <button class="vocabulary-row-speak" type="button" aria-label="Phát âm ${escapeHtml(word.hanzi)}" data-speak-row>🔊</button>
        <button class="vocabulary-row-mastered${masteredVocabularyIds.has(String(word.id)) ? ' is-mastered' : ''}" type="button" aria-label="${masteredVocabularyIds.has(String(word.id)) ? 'Bỏ đánh dấu đã thuộc' : 'Đánh dấu đã thuộc'}" aria-pressed="${masteredVocabularyIds.has(String(word.id))}" data-mastered-row>${masteredVocabularyIds.has(String(word.id)) ? '★' : '☆'}</button>
      </article>
    `).join('');
  };

  const pageCache = new Map();
  let activeRequestId = 0;

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

      // Bỏ qua kết quả nếu người dùng đã chuyển thao tác khác
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

  // Đổi tab cấp độ
  container.querySelectorAll('[data-vocabulary-category]').forEach((tab) => {
    tab.addEventListener('click', () => {
      if (isLoading) return;
      const targetCategory = tab.dataset.vocabularyCategory;
      if (targetCategory === currentCategory) return;

      container.querySelectorAll('.vocabulary-tab').forEach((item) => item.classList.remove('active'));
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

  // Xử lý phát âm
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
          <tr><th>Example</th><td>${escapeHtml(word.example || 'Chưa cập nhật')}</td></tr>
        </tbody></table>
      </section>`;
    detail.querySelector('[data-speak-vocabulary]').addEventListener('click', () => {
      speak(word.hanzi, detail.querySelector('[data-pronunciation-status]'));
    });
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
      if (!user) return;
      const vocabularyId = String(word.id);
      const isMastered = !masteredVocabularyIds.has(vocabularyId);
      if (isMastered) masteredVocabularyIds.add(vocabularyId); else masteredVocabularyIds.delete(vocabularyId);

      // Cập nhật giao diện ngay lập tức
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

    showDetail(word);
  });

  list.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    if (event.target.closest('[data-speak-row], [data-mastered-row]')) return;
    const item = event.target.closest('[data-vocabulary-index]');
    if (!item) return;
    event.preventDefault();
    const index = Number(item.dataset.vocabularyIndex);
    const word = currentWords[index];
    if (word) showDetail(word);
  });

  // Tải trang đầu tiên
  await loadPage(currentCategory, 1, false);
}
