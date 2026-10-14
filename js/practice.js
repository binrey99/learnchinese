import { supabase } from './supabase.js';
import { normalizeLevel } from './levels.js';
import { pinyin } from 'https://esm.sh/pinyin-pro@3.27.0';
import { awardLuluExp } from './lulu.js';
import { recordScore } from './score-service.js';
import { recordMistakeWord } from './srs-service.js';

export const practiceTypes = [
  {
    id: 'listening-reflex',
    title: '🎧 Luyện nghe phản xạ & Chép chính tả',
    description: 'Nghe phát âm tiếng Trung (tốc độ chuẩn 1.0x & chậm 0.75x) để chọn nghĩa nhanh hoặc gõ lại Pinyin / Chữ Hán',
    duration: '8 phút',
    badge: 'MỚI ✨'
  },
  {
    id: 'mastered-vocabulary',
    title: '⭐ Kiểm tra từ đã thuộc',
    description: 'Chọn chữ Hán đúng theo nghĩa tiếng Việt từ các từ bạn đã đánh dấu sao',
    duration: '5 phút'
  },
  {
    id: 'translation',
    title: '📝 Luyện dịch câu',
    description: 'Dịch câu Trung – Việt và Việt – Trung theo từng bài HSK',
    duration: '10 phút'
  },
  {
    id: 'sentence-order',
    title: '🧩 Sắp xếp câu',
    description: 'Sắp xếp các mảnh từ vựng thành câu tiếng Trung hoàn chỉnh',
    duration: '12 phút'
  }
];

const FALLBACK_LISTENING_WORDS = [
  { hanzi: '你好', pinyin: 'nǐ hǎo', meaning: 'xin chào', level: 'HSK 1' },
  { hanzi: '谢谢', pinyin: 'xiè xie', meaning: 'cảm ơn', level: 'HSK 1' },
  { hanzi: '容易', pinyin: 'róng yì', meaning: 'dễ dàng', level: 'HSK 3' },
  { hanzi: '学习', pinyin: 'xué xí', meaning: 'học tập', level: 'HSK 1' },
  { hanzi: '老师', pinyin: 'lǎo shī', meaning: 'giáo viên', level: 'HSK 1' },
  { hanzi: '朋友', pinyin: 'péng you', meaning: 'bạn bè', level: 'HSK 1' },
  { hanzi: '高兴', pinyin: 'gāo xìng', meaning: 'vui vẻ', level: 'HSK 1' },
  { hanzi: '喝水', pinyin: 'hē shuǐ', meaning: 'uống nước', level: 'HSK 1' },
  { hanzi: '努力', pinyin: 'nǔ lì', meaning: 'nỗ lực', level: 'HSK 2' },
  { hanzi: '帮助', pinyin: 'bāng zhù', meaning: 'giúp đỡ', level: 'HSK 2' },
  { hanzi: '准备', pinyin: 'zhǔn bèi', meaning: 'chuẩn bị', level: 'HSK 2' },
  { hanzi: '希望', pinyin: 'xī wàng', meaning: 'hy vọng', level: 'HSK 2' },
  { hanzi: '时间', pinyin: 'shí jiān', meaning: 'thời gian', level: 'HSK 2' },
  { hanzi: '身体', pinyin: 'shēn tǐ', meaning: 'sức khỏe', level: 'HSK 2' },
  { hanzi: '提高', pinyin: 'tí gāo', meaning: 'nâng cao', level: 'HSK 3' },
  { hanzi: '环境', pinyin: 'huán jìng', meaning: 'môi trường', level: 'HSK 3' },
  { hanzi: '清楚', pinyin: 'qīng chu', meaning: 'rõ ràng', level: 'HSK 3' },
  { hanzi: '简单', pinyin: 'jiǎn dān', meaning: 'đơn giản', level: 'HSK 3' }
];

const shuffle = (items) => [...items].sort(() => Math.random() - 0.5);
const escapeHtml = (value = '') =>
  String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

function toPinyinSymbol(hanzi) {
  try {
    return pinyin(hanzi, { toneType: 'symbol' });
  } catch (_) {
    return '';
  }
}

function toPinyinToneNum(hanzi) {
  try {
    return pinyin(hanzi, { toneType: 'num' });
  } catch (_) {
    return '';
  }
}

function toPinyinNone(hanzi) {
  try {
    return pinyin(hanzi, { toneType: 'none' });
  } catch (_) {
    return '';
  }
}

function normalizePinyinCompare(str = '') {
  return String(str)
    .toLowerCase()
    .trim()
    .replace(/ü/g, 'v')
    .replace(/[^a-z0-9\u00c0-\u024f\u1e00-\u1eff]/gi, '');
}

function stripVietnameseAndToneMarks(str = '') {
  return String(str)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

function playListeningAudio(text, { rate = 0.85, onStart, onEnd } = {}) {
  if (!text) return;
  const finish = () => {
    try {
      onEnd?.();
    } catch (_) {}
  };

  if ('speechSynthesis' in window) {
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'zh-CN';
      utterance.rate = rate;

      const voices = window.speechSynthesis.getVoices();
      const zh = voices.find(
        (v) => v.lang === 'zh-CN' || v.lang === 'zh_CN' || v.lang?.startsWith('zh') || v.name?.includes('Chinese')
      );
      if (zh) utterance.voice = zh;

      let started = false;
      utterance.onstart = () => {
        started = true;
        try {
          onStart?.();
        } catch (_) {}
      };
      utterance.onend = finish;
      utterance.onerror = () => {
        if (!started) playListeningFallback(text, rate, onStart, finish);
        else finish();
      };

      window.speechSynthesis.speak(utterance);
      setTimeout(() => {
        if (!window.speechSynthesis.speaking && !started) {
          playListeningFallback(text, rate, onStart, finish);
        }
      }, 260);
      return;
    } catch (_) {}
  }

  playListeningFallback(text, rate, onStart, finish);
}

function playListeningFallback(text, rate, onStart, onEnd) {
  try {
    const audio = new Audio(`https://dict.youdao.com/dictvoice?audio=${encodeURIComponent(text)}&le=zh`);
    audio.playbackRate = rate <= 0.7 ? 0.72 : 1.0;
    audio.onplay = () => {
      try {
        onStart?.();
      } catch (_) {}
    };
    audio.onended = onEnd;
    audio.onerror = onEnd;
    audio.play().catch(() => onEnd?.());
  } catch (_) {
    onEnd?.();
  }
}

async function loadListeningVocabularyPool() {
  try {
    const { data, error } = await supabase
      .from('vocabulary')
      .select('id, vocab, pinyin, vietnamese_meaning, level')
      .limit(1000);

    if (error || !data || data.length < 6) {
      return FALLBACK_LISTENING_WORDS;
    }

    const cleaned = data
      .map((row) => {
        const hanzi = (row.vocab || '').trim();
        const meaning = (row.vietnamese_meaning || '').trim();
        const level = normalizeLevel(row.level) || 'HSK 1';
        const py = (row.pinyin || '').trim() || toPinyinSymbol(hanzi);
        return { id: row.id, hanzi, pinyin: py, meaning, level };
      })
      .filter((w) => w.hanzi && w.meaning);

    return cleaned.length >= 6 ? cleaned : FALLBACK_LISTENING_WORDS;
  } catch (_) {
    return FALLBACK_LISTENING_WORDS;
  }
}

async function renderListeningReflexPractice(container, onStart) {
  container.innerHTML = `
    <div class="mastered-quiz-empty">
      <div class="quiz-loading-spinner"></div>
      <p class="practice-loading">Đang chuẩn bị phòng Luyện nghe phản xạ...</p>
    </div>
  `;

  const allWords = await loadListeningVocabularyPool();
  let currentMode = 'quiz'; // 'quiz' | 'dictation'
  let currentLevel = 'all';
  let totalQuestions = 10;
  let questions = [];
  let qIndex = 0;
  let score = 0;
  let streak = 0;
  let maxStreak = 0;
  let hintStep = 0;

  const availableLevels = ['all', ...new Set(allWords.map((w) => w.level).filter(Boolean))];

  function buildSessionQuestions() {
    const pool =
      currentLevel === 'all' ? allWords : allWords.filter((w) => w.level === currentLevel);
    const sourcePool = pool.length >= 4 ? pool : allWords;
    questions = shuffle(sourcePool).slice(0, totalQuestions);
    qIndex = 0;
    score = 0;
    streak = 0;
    maxStreak = 0;
    hintStep = 0;
  }

  buildSessionQuestions();

  function renderQuestionView() {
    const word = questions[qIndex];
    if (!word) return;
    hintStep = 0;

    const pySymbol = word.pinyin || toPinyinSymbol(word.hanzi);
    const progressPct = Math.round((qIndex / questions.length) * 100);

    // Sinh 3 đáp án nhiễu cùng cấp độ hoặc độ dài tương đương
    const distractors = shuffle(
      allWords.filter((item) => item.hanzi !== word.hanzi && item.meaning !== word.meaning)
    )
      .sort(
        (a, b) =>
          Math.abs(a.hanzi.length - word.hanzi.length) -
          Math.abs(b.hanzi.length - word.hanzi.length)
      )
      .slice(0, 3);
    const quizOptions = shuffle([word, ...distractors]);

    container.innerHTML = `
      <section class="mastered-quiz listening-reflex-wrap">
        <div class="quiz-header listening-top-bar">
          <button type="button" class="quiz-back" data-back-practice>
            <span class="quiz-back-icon">←</span> Quay lại
          </button>
          <div class="listening-mode-tabs" role="tablist" aria-label="Chế độ luyện nghe">
            <button type="button" class="listening-mode-tab ${currentMode === 'quiz' ? 'active' : ''}" data-listen-mode="quiz">
              ⚡ Nghe chọn nghĩa
            </button>
            <button type="button" class="listening-mode-tab ${currentMode === 'dictation' ? 'active' : ''}" data-listen-mode="dictation">
              ✍️ Nghe chép chính tả
            </button>
          </div>
          <div class="listening-level-filter">
            <select id="listeningLevelSelect" aria-label="Chọn cấp độ HSK">
              ${availableLevels
                .map(
                  (lv) =>
                    `<option value="${escapeHtml(lv)}" ${lv === currentLevel ? 'selected' : ''}>${
                      lv === 'all' ? 'Tất cả cấp độ' : escapeHtml(lv)
                    }</option>`
                )
                .join('')}
            </select>
          </div>
        </div>

        <div class="listening-hud-strip">
          <span>Câu <strong>${qIndex + 1}</strong>/${questions.length}</span>
          <span>Đúng: <strong>${score}</strong></span>
          <span>Combo: <strong class="listening-combo-pill">${streak}x 🔥</strong></span>
        </div>

        <div class="quiz-progress-bar-wrap">
          <div class="quiz-progress-bar" style="width: ${progressPct}%"></div>
        </div>

        <div class="quiz-card listening-stage-card" id="listeningStageCard">
          <span class="quiz-badge">${
            currentMode === 'quiz'
              ? '🎧 Nghe phản xạ (Ẩn chữ Hán)'
              : '✍️ Nghe chép chính tả (Chữ Hán hoặc Pinyin)'
          }</span>

          <div class="listening-audio-stage" id="listeningAudioStage">
            <button type="button" class="listening-main-speaker" id="btnPlayNormal" title="Nghe phát âm chuẩn (1.0x)">
              <span class="speaker-ring"></span>
              <span class="speaker-emoji">🎧</span>
              <div class="listening-wave-bars" id="listeningWaveBars">
                <i></i><i></i><i></i><i></i><i></i>
              </div>
            </button>

            <div class="listening-audio-btns">
              <button type="button" class="listening-ctrl-btn primary" id="btnReplayNormal">
                🔊 Nghe chuẩn (1.0x)
              </button>
              <button type="button" class="listening-ctrl-btn slow" id="btnReplaySlow">
                🐢 Nghe chậm (0.75x)
              </button>
              ${
                currentMode === 'dictation'
                  ? `<button type="button" class="listening-ctrl-btn hint" id="btnListeningHint">💡 Gợi ý</button>`
                  : ''
              }
            </div>
          </div>

          <div class="listening-reveal-box" id="listeningRevealBox" hidden>
            <span class="listening-reveal-pinyin">${escapeHtml(pySymbol)}</span>
            <strong class="listening-reveal-hanzi">${escapeHtml(word.hanzi)}</strong>
            <span class="listening-reveal-meaning">${escapeHtml(word.meaning)}</span>
          </div>

          <div class="listening-hint-banner" id="listeningHintBanner" hidden></div>

          ${
            currentMode === 'quiz'
              ? `
            <div class="quiz-instruction">
              <span>Nghe âm thanh và chọn nghĩa tiếng Việt đúng</span>
            </div>
            <div class="quiz-options listening-quiz-options">
              ${quizOptions
                .map(
                  (opt, idx) => `
                <button type="button" class="quiz-option-btn listening-opt-btn" data-opt-hanzi="${escapeHtml(opt.hanzi)}">
                  <span class="opt-key-badge">${idx + 1}</span>
                  <strong class="listening-opt-meaning">${escapeHtml(opt.meaning)}</strong>
                </button>
              `
                )
                .join('')}
            </div>
          `
              : `
            <form class="listening-dictation-form" id="listeningDictationForm" autocomplete="off">
              <label class="dictation-label" for="dictationInput">
                Nhập <strong>Chữ Hán</strong> (vd: <code>${escapeHtml(word.hanzi)}</code>) hoặc <strong>Pinyin</strong> (vd: <code>${escapeHtml(pySymbol)}</code> / không dấu):
              </label>
              <div class="dictation-input-row">
                <input
                  type="text"
                  id="dictationInput"
                  class="dictation-input"
                  placeholder="Gõ chữ Hán hoặc Pinyin rồi nhấn Enter..."
                   required
                />
                <button type="submit" class="quiz-btn-primary dictation-submit-btn" id="dictationSubmitBtn">
                  Kiểm tra ✓
                </button>
              </div>
            </form>
          `
          }

          <div class="quiz-feedback" id="listeningFeedback" aria-live="polite"></div>
        </div>
      </section>
    `;

    const waveBarsEl = container.querySelector('#listeningWaveBars');
    const stageEl = container.querySelector('#listeningAudioStage');
    const revealBoxEl = container.querySelector('#listeningRevealBox');
    const hintBannerEl = container.querySelector('#listeningHintBanner');
    const feedbackEl = container.querySelector('#listeningFeedback');

    const triggerSpeak = (rate = 0.85) => {
      playListeningAudio(word.hanzi, {
        rate,
        onStart: () => {
          stageEl?.classList.add('is-speaking');
          waveBarsEl?.classList.add('is-active');
        },
        onEnd: () => {
          stageEl?.classList.remove('is-speaking');
          waveBarsEl?.classList.remove('is-active');
        }
      });
    };

    // Tự động phát âm câu hỏi ngay khi hiển thị
    setTimeout(() => triggerSpeak(0.85), 120);

    container.querySelector('[data-back-practice]')?.addEventListener('click', () => {
      if ('speechSynthesis' in window) window.speechSynthesis.cancel();
      renderPracticeList(container, onStart);
    });

    container.querySelectorAll('[data-listen-mode]').forEach((tab) => {
      tab.addEventListener('click', () => {
        const nextMode = tab.dataset.listenMode;
        if (nextMode === currentMode) return;
        currentMode = nextMode;
        buildSessionQuestions();
        renderQuestionView();
      });
    });

    container.querySelector('#listeningLevelSelect')?.addEventListener('change', (e) => {
      currentLevel = e.target.value;
      buildSessionQuestions();
      renderQuestionView();
    });

    container.querySelector('#btnPlayNormal')?.addEventListener('click', () => triggerSpeak(0.85));
    container.querySelector('#btnReplayNormal')?.addEventListener('click', () => triggerSpeak(0.85));
    container.querySelector('#btnReplaySlow')?.addEventListener('click', () => triggerSpeak(0.62));

    container.querySelector('#btnListeningHint')?.addEventListener('click', () => {
      if (!hintBannerEl) return;
      hintStep++;
      hintBannerEl.hidden = false;
      const pyPlain = toPinyinNone(word.hanzi) || pySymbol;
      const maskedPy = pyPlain
        .split(/\s+/)
        .map((syl) => (syl ? syl[0] + '_'.repeat(Math.max(1, syl.length - 1)) : ''))
        .join(' ');
      if (hintStep === 1) {
        hintBannerEl.innerHTML = `💡 <strong>Gợi ý 1:</strong> Nghĩa là <em>"${escapeHtml(word.meaning)}"</em> (${word.hanzi.length} chữ Hán)`;
      } else {
        hintBannerEl.innerHTML = `💡 <strong>Gợi ý 2:</strong> Nghĩa là <em>"${escapeHtml(word.meaning)}"</em> · Khung Pinyin: <code>${escapeHtml(maskedPy)}</code>`;
      }
    });

    function showQuestionResult(isCorrect, subMessage = '') {
      if (revealBoxEl) revealBoxEl.hidden = false;
      const pBar = container.querySelector('.quiz-progress-bar');
      if (pBar) pBar.style.width = `${Math.round(((qIndex + 1) / questions.length) * 100)}%`;

      if (isCorrect) {
        score++;
        streak++;
        if (streak > maxStreak) maxStreak = streak;
        awardLuluExp(8, { source: 'Luyện nghe phản xạ' });
        recordScore({
          category: 'vocab',
          points: currentMode === 'dictation' ? 15 : 10,
          description: `Luyện nghe (${word.hanzi})`
        });
      } else {
        streak = 0;
        recordMistakeWord({
          hanzi: word.hanzi,
          pinyin: pySymbol,
          meaning: word.meaning,
          level: word.level || 'HSK 1',
          source: 'Luyện nghe phản xạ'
        });
      }

      const comboEl = container.querySelector('.listening-combo-pill');
      if (comboEl) comboEl.textContent = `${streak}x 🔥`;

      feedbackEl.className = `quiz-feedback active ${isCorrect ? 'feedback-correct' : 'feedback-wrong'}`;
      feedbackEl.innerHTML = `
        <div class="feedback-info">
          <div class="feedback-icon">${isCorrect ? '🎉' : '💡'}</div>
          <div class="feedback-text">
            <span class="feedback-title">${
              isCorrect ? 'Chính xác! Tai cực thính!' : 'Chưa chính xác!'
            }</span>
            <span class="feedback-answer">
              <b>${escapeHtml(word.hanzi)}</b>
              <span class="quiz-feedback-pinyin">(${escapeHtml(pySymbol)})</span> — ${escapeHtml(word.meaning)}
              ${subMessage ? `<br><small>${escapeHtml(subMessage)}</small>` : ''}
            </span>
          </div>
        </div>
        <button type="button" class="quiz-next-btn" id="btnNextListeningQuestion">
          ${qIndex === questions.length - 1 ? 'Xem kết quả 🏆' : 'Câu tiếp theo →'}
        </button>
      `;

      feedbackEl.querySelector('#btnNextListeningQuestion')?.addEventListener('click', () => {
        if (qIndex === questions.length - 1) {
          renderSessionSummary();
        } else {
          qIndex++;
          renderQuestionView();
        }
      });
    }

    // Xử lý chế độ 1: Nghe chọn nghĩa
    container.querySelectorAll('.listening-opt-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const chosenHanzi = btn.dataset.optHanzi;
        const isCorrect = chosenHanzi === word.hanzi;

        container.querySelectorAll('.listening-opt-btn').forEach((item) => {
          item.disabled = true;
          if (item.dataset.optHanzi === word.hanzi) item.classList.add('correct');
        });
        if (!isCorrect) btn.classList.add('incorrect');

        showQuestionResult(isCorrect);
      });
    });

    // Xử lý chế độ 2: Nghe chép chính tả
    const dictForm = container.querySelector('#listeningDictationForm');
    const dictInput = container.querySelector('#dictationInput');
    const dictSubmit = container.querySelector('#dictationSubmitBtn');
    if (dictInput) {
      setTimeout(() => dictInput.focus(), 80);
      // RẨt tiện lợi: ẩn gợi ý mẫu trong label trước khi nộp
      const labelEl = container.querySelector('.dictation-label');
      if (labelEl) {
        labelEl.innerHTML =
          'Nghe và gõ lại <strong>Chữ Hán</strong> hoặc <strong>Pinyin</strong> (có dấu hoặc không dấu đều được):';
      }
    }

    dictForm?.addEventListener('submit', (e) => {
      e.preventDefault();
      if (!dictInput || dictInput.disabled) return;
      const rawUser = dictInput.value.trim();
      if (!rawUser) return;

      dictInput.disabled = true;
      if (dictSubmit) dictSubmit.disabled = true;

      const exactHanzi = rawUser.replace(/\s+/g, '') === word.hanzi.replace(/\s+/g, '');
      const userToneNorm = normalizePinyinCompare(rawUser);
      const targetSymbolNorm = normalizePinyinCompare(pySymbol);
      const targetNumNorm = normalizePinyinCompare(toPinyinToneNum(word.hanzi));
      const userPlainNorm = stripVietnameseAndToneMarks(rawUser);
      const targetPlainNorm = stripVietnameseAndToneMarks(toPinyinNone(word.hanzi) || pySymbol);

      const isToneMatch =
        userToneNorm && (userToneNorm === targetSymbolNorm || userToneNorm === targetNumNorm);
      const isPlainMatch = userPlainNorm && userPlainNorm === targetPlainNorm;
      const isCorrect = exactHanzi || isToneMatch || isPlainMatch;

      dictInput.classList.add(isCorrect ? 'is-correct' : 'is-wrong');

      let note = '';
      if (exactHanzi) {
        note = 'Bạn gõ chuẩn cả chữ Hán! Xuất sắc!';
      } else if (isToneMatch) {
        note = 'Bạn gõ chuẩn cả Pinyin và thanh điệu!';
      } else if (isPlainMatch) {
        note = `Đúng âm Pinyin! Lưu ý thanh điệu chuẩn là: ${pySymbol}`;
      } else {
        note = `Bạn đã gõ: "${rawUser}"`;
      }

      showQuestionResult(isCorrect, note);
    });
  }

  function renderSessionSummary() {
    const accuracy = questions.length ? Math.round((score / questions.length) * 100) : 0;
    container.innerHTML = `
      <div class="mastered-quiz-empty mastered-quiz-result">
        <div class="quiz-result-icon">${accuracy >= 80 ? '🎧🌟' : accuracy >= 50 ? '🎉' : '💪'}</div>
        <h2>${accuracy >= 80 ? 'Đôi tai vàng tiếng Trung!' : 'Hoàn thành phiên Luyện nghe!'}</h2>
        <p class="quiz-result-score">
          Bạn đã nghe đúng <strong>${score}</strong> / <strong>${questions.length}</strong> câu (${accuracy}%) · Combo cao nhất: <strong>${maxStreak}x 🔥</strong>
        </p>
        <div class="quiz-result-actions">
          <button type="button" class="quiz-btn-primary" data-restart-listening>🔄 Luyện tiếp đề mới</button>
          <button type="button" class="quiz-btn-secondary" data-switch-dictation>
            ${currentMode === 'quiz' ? '✍️ Thử sức Nghe chép chính tả' : '⚡ Chuyển sang Nghe chọn nghĩa'}
          </button>
          <button type="button" class="quiz-btn-secondary" data-back-practice>Quay lại danh sách</button>
        </div>
      </div>
    `;

    container.querySelector('[data-restart-listening]')?.addEventListener('click', () => {
      buildSessionQuestions();
      renderQuestionView();
    });
    container.querySelector('[data-switch-dictation]')?.addEventListener('click', () => {
      currentMode = currentMode === 'quiz' ? 'dictation' : 'quiz';
      buildSessionQuestions();
      renderQuestionView();
    });
    container.querySelector('[data-back-practice]')?.addEventListener('click', () => {
      renderPracticeList(container, onStart);
    });
  }

  renderQuestionView();
}

async function loadMasteredWords() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { words: [], reason: 'Vui lòng đăng nhập để kiểm tra các từ đã thuộc.' };

  const { data: mastery, error: masteryError } = await supabase
    .from('vocabulary_mastery')
    .select('vocabulary_id, correct_answers')
    .eq('user_id', user.id);
  if (masteryError) throw masteryError;
  if (!mastery.length) return { words: [], reason: 'Bạn chưa đánh dấu từ nào. Hãy nhấn ☆ tại trang Từ vựng trước nhé.' };

  const pendingMastery = mastery.filter((item) => (item.correct_answers || 0) < 5);
  if (!pendingMastery.length) return { words: [], reason: 'Tất cả từ đã đánh dấu đã được chinh phục. Hãy xem chúng tại Leaderboard 🏆.' };

  const ids = pendingMastery.map((item) => item.vocabulary_id);
  const { data: words, error: wordsError } = await supabase
    .from('vocabulary')
    .select('id, vocab, vietnamese_meaning')
    .in('id', ids);
  if (wordsError) throw wordsError;

  const { data: candidates, error: candidatesError } = await supabase
    .from('vocabulary')
    .select('id, vocab')
    .limit(1000);
  if (candidatesError) throw candidatesError;
  const correctAnswers = new Map(pendingMastery.map((item) => [String(item.vocabulary_id), item.correct_answers || 0]));
  return { words: words.map((word) => ({ ...word, correctAnswers: correctAnswers.get(String(word.id)) || 0 })), candidates };
}

async function recordCorrectAnswer(userId, word) {
  const correctAnswers = Math.min(5, (word.correctAnswers || 0) + 1);
  const update = { correct_answers: correctAnswers };
  if (correctAnswers === 5 && !word.achievedAt) update.achieved_at = new Date().toISOString();
  const { error } = await supabase
    .from('vocabulary_mastery')
    .update(update)
    .eq('user_id', userId)
    .eq('vocabulary_id', word.id);
  if (error) throw error;
  word.correctAnswers = correctAnswers;
  if (correctAnswers === 5) word.achievedAt = update.achieved_at || word.achievedAt;
  return correctAnswers;
}

async function renderMasteredVocabularyQuiz(container, onStart) {
  container.innerHTML = `
    <div class="mastered-quiz-empty">
      <div class="quiz-loading-spinner"></div>
      <p class="practice-loading">Đang tải các từ đã đánh dấu...</p>
    </div>
  `;
  let quiz;
  try {
    quiz = await loadMasteredWords();
  } catch (error) {
    console.error('Unable to load mastered vocabulary:', error);
    container.innerHTML = `
      <div class="mastered-quiz-empty">
        <div class="quiz-empty-icon">⚠️</div>
        <h2>Không thể tải dữ liệu</h2>
        <p>Đã xảy ra lỗi khi tải từ đã thuộc. Hãy kiểm tra kết nối và thử lại nhé.</p>
        <button type="button" class="quiz-btn-primary" data-back-practice>← Quay lại bài luyện tập</button>
      </div>
    `;
    container.querySelector('[data-back-practice]').addEventListener('click', () => renderPracticeList(container, onStart));
    return;
  }

  if (!quiz.words.length) {
    container.innerHTML = `
      <div class="mastered-quiz-empty">
        <div class="quiz-empty-icon">⭐</div>
        <h2>Kiểm tra từ đã thuộc</h2>
        <p>${escapeHtml(quiz.reason)}</p>
        <button type="button" class="quiz-btn-primary" data-back-practice>← Quay lại bài luyện tập</button>
      </div>
    `;
    container.querySelector('[data-back-practice]').addEventListener('click', () => renderPracticeList(container, onStart));
    return;
  }

  let index = 0;
  let score = 0;
  const { data: { user } } = await supabase.auth.getUser();

  const renderQuestion = () => {
    const word = quiz.words[index];
    const distractors = shuffle(quiz.candidates.filter((item) => String(item.id) !== String(word.id))).slice(0, 3);
    const options = shuffle([word, ...distractors]);
    const progressPercent = Math.round((index / quiz.words.length) * 100);

    container.innerHTML = `
      <section class="mastered-quiz">
        <div class="quiz-header">
          <button type="button" class="quiz-back" data-back-practice>
            <span class="quiz-back-icon">←</span> Quay lại
          </button>
          <div class="quiz-progress-badge">
            <span class="quiz-step-count">Câu <strong>${index + 1}</strong>/${quiz.words.length}</span>
            <span class="quiz-divider">·</span>
            <span class="quiz-score-count">Đúng: <strong>${score}</strong></span>
          </div>
        </div>

        <div class="quiz-progress-bar-wrap">
          <div class="quiz-progress-bar" style="width: ${progressPercent}%"></div>
        </div>

        <div class="quiz-card">
          <span class="quiz-badge">Nghĩa tiếng Việt</span>
          <h2 class="quiz-prompt">${escapeHtml(word.vietnamese_meaning)}</h2>
          <div class="quiz-instruction">
            <span>Chọn từ tiếng Trung đúng</span>
            <span class="quiz-mastery-tag">Đã thuộc ${word.correctAnswers}/5 lần</span>
          </div>

          <div class="quiz-options">
            ${options.map((option) => `
              <button type="button" class="quiz-option-btn" data-option-id="${option.id}">
                <span class="quiz-option-pinyin">${escapeHtml(pinyin(option.vocab, { toneType: 'symbol' }))}</span>
                <strong class="quiz-option-hanzi">${escapeHtml(option.vocab)}</strong>
              </button>
            `).join('')}
          </div>

          <div class="quiz-feedback" aria-live="polite"></div>
        </div>
      </section>
    `;

    container.querySelector('[data-back-practice]').addEventListener('click', () => renderPracticeList(container, onStart));
    
    container.querySelectorAll('[data-option-id]').forEach((button) => button.addEventListener('click', () => {
      const correct = String(button.dataset.optionId) === String(word.id);
      container.querySelectorAll('[data-option-id]').forEach((item) => {
        item.disabled = true;
        if (String(item.dataset.optionId) === String(word.id)) item.classList.add('correct');
      });
      if (!correct) button.classList.add('incorrect'); else score += 1;

      const pBar = container.querySelector('.quiz-progress-bar');
      if (pBar) pBar.style.width = `${Math.round(((index + 1) / quiz.words.length) * 100)}%`;

      const feedback = container.querySelector('.quiz-feedback');
      feedback.className = `quiz-feedback active ${correct ? 'feedback-correct' : 'feedback-wrong'}`;

      if (correct && user) {
        awardLuluExp(10, { source: 'Kiểm tra từ đã thuộc' });
        recordCorrectAnswer(user.id, word).then((count) => {
          const statusText = feedback.querySelector('.feedback-title');
          if (statusText) {
            statusText.textContent = count === 5 ? 'Đã chinh phục từ này! 🏆' : `Chính xác! ${count}/5 ✓`;
          }
        }).catch((error) => console.warn('Unable to save correct answer:', error.message));
      }

      feedback.innerHTML = `
        <div class="feedback-info">
          <div class="feedback-icon">${correct ? '🎉' : '💡'}</div>
          <div class="feedback-text">
            <span class="feedback-title">${correct ? 'Chính xác! Tuyệt vời!' : 'Chưa chính xác!'}</span>
            ${!correct ? `<span class="feedback-answer">Đáp án đúng: <b>${escapeHtml(word.vocab)}</b> <span class="quiz-feedback-pinyin">(${escapeHtml(pinyin(word.vocab, { toneType: 'symbol' }))})</span></span>` : ''}
          </div>
        </div>
        <button type="button" class="quiz-next-btn" data-next-quiz>
          ${index === quiz.words.length - 1 ? 'Xem kết quả' : 'Câu tiếp theo →'}
        </button>
      `;

      feedback.querySelector('[data-next-quiz]').addEventListener('click', () => {
        if (index === quiz.words.length - 1) {
          container.innerHTML = `
            <div class="mastered-quiz-empty mastered-quiz-result">
              <div class="quiz-result-icon">${score === quiz.words.length ? '🌟' : (score >= Math.ceil(quiz.words.length / 2) ? '🎉' : '💪')}</div>
              <h2>${score === quiz.words.length ? 'Tuyệt đỉnh!' : 'Hoàn thành bài kiểm tra!'}</h2>
              <p class="quiz-result-score">Bạn đã trả lời đúng <strong>${score}</strong> / <strong>${quiz.words.length}</strong> từ đã đánh dấu.</p>
              <div class="quiz-result-actions">
                <button type="button" class="quiz-btn-primary" data-restart-quiz>🔄 Làm lại</button>
                <button type="button" class="quiz-btn-secondary" data-back-practice>Quay lại bài luyện tập</button>
              </div>
            </div>
          `;
          container.querySelector('[data-restart-quiz]').addEventListener('click', () => { index = 0; score = 0; renderQuestion(); });
          container.querySelector('[data-back-practice]').addEventListener('click', () => renderPracticeList(container, onStart));
        } else {
          index += 1;
          renderQuestion();
        }
      });
    }));
  };
  renderQuestion();
}

function renderPracticeList(container, onStart) {
  container.innerHTML = practiceTypes.map((item) => `
    <button class="practice-item" type="button" data-practice-id="${item.id}">
      <div class="practice-item-head">
        <strong>${item.title}</strong>
        ${item.badge ? `<span class="practice-new-badge">${escapeHtml(item.badge)}</span>` : ''}
      </div>
      <span>${item.description} · ${item.duration}</span>
    </button>
  `).join('');
  container.querySelectorAll('[data-practice-id]').forEach((button) => {
    button.addEventListener('click', () => {
      const id = button.dataset.practiceId;
      if (id === 'listening-reflex') renderListeningReflexPractice(container, onStart);
      else if (id === 'mastered-vocabulary') renderMasteredVocabularyQuiz(container, onStart);
      else onStart?.(id);
    });
  });
}

export function initPractice({ selector = '[data-practice]', onStart } = {}) {
  const container = document.querySelector(selector);
  if (!container) return;
  renderPracticeList(container, onStart);
}
