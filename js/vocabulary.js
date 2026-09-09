import { supabase } from './supabase.js';
import { pinyin } from 'https://esm.sh/pinyin-pro@3.27.0';
import { recordScore, SCORE_RULES } from './score-service.js';

export const vocabulary = [
  { hanzi: '你好', pinyin: 'ni3 hao3', meaning: 'xin chào', level: 'HSK 1' },
  { hanzi: '学习', pinyin: 'xue2 xi2', meaning: 'học tập', level: 'HSK 1' },
  { hanzi: '努力', pinyin: 'nu3 li4', meaning: 'nỗ lực', level: 'HSK 2' },
  { hanzi: '提高', pinyin: 'ti2 gao1', meaning: 'nâng cao', level: 'HSK 3' },
  { hanzi: '环境', pinyin: 'huan2 jing4', meaning: 'môi trường', level: 'HSK 4' },
  { hanzi: '解决', pinyin: 'jie3 jue2', meaning: 'giải quyết', level: 'HSK 5' },
  { hanzi: '可持续', pinyin: 'ke3 chi2 xu4', meaning: 'bền vững', level: 'HSK 6' },
  { hanzi: '车间', pinyin: 'che1 jian1', meaning: 'phân xưởng', level: 'Công xưởng' },
  { hanzi: '安全帽', pinyin: 'an1 quan2 mao4', meaning: 'mũ bảo hộ', level: 'Công xưởng' },
  { hanzi: '生产线', pinyin: 'sheng1 chan3 xian4', meaning: 'dây chuyền sản xuất', level: 'Công xưởng' },
  { hanzi: '质量检查', pinyin: 'zhi4 liang4 jian3 cha2', meaning: 'kiểm tra chất lượng', level: 'Công xưởng' }
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
    return;
  }
  const { error } = await supabase
    .from('vocabulary_mastery')
    .delete()
    .eq('user_id', userId)
    .eq('vocabulary_id', vocabularyId);
  if (error) throw error;
}

async function loadVocabularyFromSupabase() {
  const pageSize = 1000;
  const rows = [];

  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from('vocabulary')
      .select('id, book_level, vocab, english_meaning, vietnamese_meaning, word_type, component')
      .order('id', { ascending: true })
      .range(from, from + pageSize - 1);

    if (error) throw error;
    rows.push(...data);
    if (data.length < pageSize) break;
  }

  return rows.map((word) => ({
    id: word.id,
    hanzi: word.vocab,
    pinyin: toPinyin(word.vocab),
    english: word.english_meaning || '',
    meaning: word.vietnamese_meaning,
    level: word.book_level,
    wordType: word.word_type,
    component: word.component
  }));
}

export async function initVocabulary({ selector = '[data-vocabulary]' } = {}) {
  const container = document.querySelector(selector);
  if (!container) return;

  let words = vocabulary;
  let availableCategories = categories;
  let user = null;
  let masteredVocabularyIds = new Set();
  container.innerHTML = '<p class="vocabulary-loading">Đang tải dữ liệu từ vựng...</p>';

  try {
    const remoteVocabulary = await loadVocabularyFromSupabase();
    if (remoteVocabulary.length) {
      words = remoteVocabulary;
      availableCategories = [...new Set(remoteVocabulary.map((word) => word.level).filter(Boolean))];
    }
  } catch (error) {
    console.error('Unable to load vocabulary from Supabase:', error.message);
    container.innerHTML = '<p class="vocabulary-loading">Chưa kết nối được dữ liệu online, đang dùng dữ liệu mẫu.</p>';
  }

  if (!words.length || !availableCategories.length) {
    container.innerHTML = '<p class="vocabulary-loading">Chưa có từ vựng trong cơ sở dữ liệu.</p>';
    return;
  }

  try {
    const { data: { user: loggedInUser } } = await supabase.auth.getUser();
    user = loggedInUser;
    masteredVocabularyIds = await loadMasteredVocabulary(user?.id);
  } catch (error) {
    console.warn('Unable to load mastered vocabulary:', error.message);
  }

  container.innerHTML = `<div class="vocabulary-tabs" role="tablist">${availableCategories.map((category, index) => `<button type="button" class="vocabulary-tab${index === 0 ? ' active' : ''}" data-vocabulary-category="${escapeHtml(category)}">${escapeHtml(category)}</button>`).join('')}</div><div class="vocabulary-list" data-vocabulary-list></div><div class="vocabulary-detail" data-vocabulary-detail hidden></div>`;

  const list = container.querySelector('[data-vocabulary-list]');
  const renderCategory = (category) => {
    const categoryWords = words.filter((word) => word.level.trim() === category);
    list.innerHTML = categoryWords.map((word) => `
      <article class="vocabulary-item" role="button" tabindex="0" data-vocabulary-index="${words.indexOf(word)}">
        <div class="vocabulary-hanzi"><span class="vocabulary-pinyin">${escapeHtml(word.pinyin || toPinyin(word.hanzi))}</span><strong>${escapeHtml(word.hanzi)}</strong></div>
        <span>${escapeHtml(word.english || '')}</span>
        <button class="vocabulary-row-speak" type="button" aria-label="Phát âm ${escapeHtml(word.hanzi)}" data-speak-row>🔊</button>
        <button class="vocabulary-row-mastered${masteredVocabularyIds.has(String(word.id)) ? ' is-mastered' : ''}" type="button" aria-label="${masteredVocabularyIds.has(String(word.id)) ? 'Bỏ đánh dấu đã thuộc' : 'Đánh dấu đã thuộc'}" aria-pressed="${masteredVocabularyIds.has(String(word.id))}" data-mastered-row>${masteredVocabularyIds.has(String(word.id)) ? '★' : '☆'}</button>
        <small>${escapeHtml(word.meaning)}${word.wordType ? ` · ${escapeHtml(word.wordType)}` : ''}</small>
      </article>
    `).join('') || '<p class="vocabulary-loading">Chưa có từ vựng cho nhóm này.</p>';
  };

  container.querySelectorAll('[data-vocabulary-category]').forEach((tab) => {
    tab.addEventListener('click', () => {
      container.querySelectorAll('.vocabulary-tab').forEach((item) => item.classList.remove('active'));
      tab.classList.add('active');
      renderCategory(tab.dataset.vocabularyCategory);
    });
  });

  const detail = container.querySelector('[data-vocabulary-detail]');
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

    // 1. Thử Web Speech API của trình duyệt (chuẩn, không phụ thuộc mạng, không bị chặn CORS)
    if ('speechSynthesis' in window) {
      try {
        const utterance = new SpeechSynthesisUtterance(hanzi);
        utterance.lang = 'zh-CN';
        utterance.rate = 0.85;

        // Chọn giọng tiếng Trung chuẩn nếu trình duyệt đã nạp danh sách giọng
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

        // Nếu trình duyệt chưa tải xong voice hoặc không phát được, dự phòng fallback sau 400ms
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

    // 2. Dự phòng bằng audio online
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
          <tr><th>Component</th><td>${escapeHtml(word.component || 'Chưa cập nhật')}</td></tr>
        </tbody></table>
      </section>`;
    detail.querySelector('[data-speak-vocabulary]').addEventListener('click', () => {
      speak(word.hanzi, detail.querySelector('[data-pronunciation-status]'));
    });
    detail.querySelectorAll('[data-close-vocabulary-detail]').forEach((button) => button.addEventListener('click', closeDetail));
  };

  list.addEventListener('click', (event) => {
    const item = event.target.closest('[data-vocabulary-index]');
    if (!item) return;
    const word = words[Number(item.dataset.vocabularyIndex)];
    if (event.target.closest('[data-mastered-row]')) {
      if (!user) return;
      const vocabularyId = String(word.id);
      const isMastered = !masteredVocabularyIds.has(vocabularyId);
      if (isMastered) masteredVocabularyIds.add(vocabularyId); else masteredVocabularyIds.delete(vocabularyId);
      renderCategory(container.querySelector('.vocabulary-tab.active')?.dataset.vocabularyCategory || availableCategories[0]);
      saveMasteredVocabulary(user.id, word.id, isMastered).catch((error) => {
        if (isMastered) masteredVocabularyIds.delete(vocabularyId); else masteredVocabularyIds.add(vocabularyId);
        renderCategory(container.querySelector('.vocabulary-tab.active')?.dataset.vocabularyCategory || availableCategories[0]);
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
    showDetail(words[Number(item.dataset.vocabularyIndex)]);
  });

  renderCategory(availableCategories[0]);
}
