import { supabase } from './supabase.js';
import { recordScore, SCORE_RULES } from './score-service.js';
import { awardLuluExp } from './lulu.js';
import { recordMistakeWord } from './srs-service.js';


const levels = ['HSK 1', 'HSK 2', 'HSK 3', 'HSK 4', 'HSK 5', 'HSK 6'];
const lessonCount = 10;
const questionsPerLesson = 20;

const escapeHtml = (value = '') => String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
const normalizeChinese = (value = '') => String(value).replace(/[\s，。！？、；：“”‘’,.!?;:'"\-]/g, '').trim();

function toPinyin(text = '') {
  if (!text) return '';
  try {
    if (window.pinyinPro && typeof window.pinyinPro.pinyin === 'function') {
      return window.pinyinPro.pinyin(String(text), { toneType: 'symbol', nonZh: 'consecutive' });
    }
  } catch (_) {}
  return '';
}

function speakChinese(text, rate = 0.88) {
  if (!text || !('speechSynthesis' in window)) return;
  try {
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(String(text));
    utter.lang = 'zh-CN';
    utter.rate = rate;
    const voices = window.speechSynthesis.getVoices();
    const zhVoice = voices.find((v) => v.lang.includes('zh') || v.lang.includes('CN'));
    if (zhVoice) utter.voice = zhVoice;
    window.speechSynthesis.speak(utter);
  } catch (_) {}
}

function canonicalizeChinese(raw = '') {
  let s = normalizeChinese(raw);
  if (!s) return '';
  const digitMap = { '0': '零', '1': '一', '2': '二', '3': '三', '4': '四', '5': '五', '6': '六', '7': '七', '8': '八', '9': '九' };
  s = s.replace(/[0-9]/g, (d) => digitMap[d] || d);
  s = s
    .replace(/中文/g, '汉语')
    .replace(/星期天/g, '星期日')
    .replace(/礼拜天|礼拜日/g, '星期日')
    .replace(/礼拜/g, '星期')
    .replace(/咱们/g, '我们')
    .replace(/块钱/g, '元')
    .replace(/块/g, '元')
    .replace(/([我你他她它])的(爸爸|妈妈|哥哥|姐姐|弟弟|妹妹|朋友|老师|同学|学校|家|公司)/g, '$1$2');
  return s;
}

function isEquivalentChineseTranslation(userInput = '', targetAnswer = '') {
  const uRaw = normalizeChinese(userInput);
  const tRaw = normalizeChinese(targetAnswer);
  if (!uRaw || !tRaw) return false;
  if (uRaw === tRaw) return true;

  const u = canonicalizeChinese(userInput);
  const t = canonicalizeChinese(targetAnswer);
  if (u === t) return true;

  // Chấp nhận đảo vị trí [Trạng ngữ thời gian] + [Chủ ngữ] ở đầu câu
  const timeWords = ['今天', '明天', '昨天', '现在', '每天', '今年', '明年', '去年', '早上', '上午', '中午', '下午', '晚上', '周末', '平时', '以前', '以后'];
  const subjects = ['我', '你', '他', '她', '它', '我们', '你们', '他们', '她们', '爸爸', '妈妈', '老师', '大家'];

  for (const tw of timeWords) {
    for (const sb of subjects) {
      if (t.startsWith(tw + sb) && u === sb + tw + t.slice((tw + sb).length)) return true;
      if (t.startsWith(sb + tw) && u === tw + sb + t.slice((sb + tw).length)) return true;
    }
  }
  return false;
}

async function getUser() {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

async function getProgress(userId, level) {
  if (!userId) return [];
  const { data, error } = await supabase.from('translation_progress')
    .select('lesson, question_index, is_correct')
    .eq('user_id', userId).eq('level', level);
  if (error) throw error;
  return data;
}

async function getExercises(level, lesson) {
  const { data, error } = await supabase.from('translation_exercises')
    .select('id, level, lesson, question_vi, answer_zh, explanation')
    .eq('level', level).eq('lesson', lesson).order('id');
  if (error) throw error;
  return data;
}

async function saveAnswer(userId, level, lesson, questionIndex, isCorrect, alreadyRewarded = false) {
  if (isCorrect && !alreadyRewarded) {
    recordScore({ category: 'translation', points: SCORE_RULES.TRANSLATION_CORRECT, description: `Dịch đúng ${level} - Bài ${lesson}` });
    awardLuluExp(10, { source: 'Luyện dịch tiếng Trung' });
  }
  if (!userId) return;
  const { error } = await supabase.from('translation_progress').upsert({
    user_id: userId, level, lesson, question_index: questionIndex, is_correct: isCorrect, direction: 'vi-zh'
  }, { onConflict: 'user_id,level,lesson,question_index' });
  if (error) throw error;
  const { error: activityError } = await supabase.from('learning_activity').insert({
    user_id: userId, activity_type: 'translation_answer', level, lesson, question_index: questionIndex, is_correct: isCorrect
  });
  if (activityError) console.warn('Unable to record learning activity:', activityError.message);
}

export async function initTranslation({ selector = '[data-translation]', toast } = {}) {
  const container = document.querySelector(selector);
  if (!container) return;
  let selectedLevel = levels[0];
  let user = null;
  let progress = [];

  const loadProgress = async () => {
    user = await getUser();
    progress = await getProgress(user?.id, selectedLevel);
  };

  const renderOverview = async () => {
    container.innerHTML = '<p class="translation-loading">Đang tải bài luyện dịch...</p>';
    try { await loadProgress(); } catch (error) { console.error(error); progress = []; }
    const answered = progress.length;
    const correct = progress.filter((item) => item.is_correct).length;
    const lessonProgress = (lesson) => progress.filter((item) => item.lesson === lesson).length;
    container.innerHTML = `
      <div class="translation-levels" role="tablist">${levels.map((level) => `<button class="translation-level${level === selectedLevel ? ' active' : ''}" type="button" data-level="${level}">${level}</button>`).join('')}</div>
      <div class="translation-summary">
        <article><span>Câu đã làm</span><strong>${answered}</strong><small>/ ${lessonCount * questionsPerLesson} câu</small></article>
        <article><span>Trả lời đúng</span><strong>${correct}</strong><small>${answered ? Math.round(correct / answered * 100) : 0}% chính xác</small></article>
        <article><span>Tiến độ</span><strong>${Math.round(answered / (lessonCount * questionsPerLesson) * 100)}%</strong><small>${user ? 'Đã lưu vào tài khoản' : 'Đăng nhập để lưu tiến độ'}</small></article>
      </div>
      <h2 class="translation-heading">${selectedLevel} · 10 bài luyện dịch</h2>
      <div class="translation-lessons">${Array.from({ length: lessonCount }, (_, index) => {
        const lesson = index + 1; const done = lessonProgress(lesson);
        return `<button type="button" class="translation-lesson${done === questionsPerLesson ? ' completed' : ''}" data-lesson="${lesson}"><strong>Bài ${lesson}</strong><span>${done}/${questionsPerLesson} câu</span><b>→</b></button>`;
      }).join('')}</div>`;
    container.querySelectorAll('[data-level]').forEach((button) => button.addEventListener('click', () => { selectedLevel = button.dataset.level; renderOverview(); }));
    container.querySelectorAll('[data-lesson]').forEach((button) => button.addEventListener('click', () => renderLesson(Number(button.dataset.lesson))));
  };

  const renderLesson = async (lesson) => {
    container.innerHTML = '<p class="translation-loading">Đang tải câu hỏi...</p>';
    let exercises;
    try { exercises = await getExercises(selectedLevel, lesson); } catch (error) { container.innerHTML = `<p class="translation-loading">Không tải được câu hỏi: ${escapeHtml(error.message)}</p>`; return; }
    if (!exercises.length) { container.innerHTML = '<p class="translation-loading">Bài này chưa có dữ liệu câu hỏi.</p>'; return; }
    let index = 0;
    const answerStates = new Map(progress.filter((item) => item.lesson === lesson).map((item) => [item.question_index - 1, item.is_correct]));
    const rewardedQuestions = new Set(
      progress.filter((item) => item.lesson === lesson && item.is_correct).map((item) => item.question_index - 1)
    );

    const renderQuestion = () => {
      const exercise = exercises[index];
      const answerPinyin = toPinyin(exercise.answer_zh);
      let isChecked = false;

      container.innerHTML = `
        <div class="translation-session-head">
          <button type="button" data-back-translation>← Danh sách bài</button>
          <span>${selectedLevel} · Bài ${lesson}</span>
        </div>
        <nav class="translation-question-nav" aria-label="Danh sách câu hỏi">
          <div><strong>Câu ${index + 1}/${exercises.length}</strong><span>Việt → Trung</span></div>
          <section>${exercises.map((_, questionIndex) => `<button type="button" class="translation-question-number${questionIndex === index ? ' active' : ''}${answerStates.has(questionIndex) ? (answerStates.get(questionIndex) ? ' correct' : ' incorrect') : ''}" data-go-question="${questionIndex}">${questionIndex + 1}</button>`).join('')}</section>
        </nav>
        <section class="translation-question">
          <p class="translation-count">Câu ${index + 1}/${exercises.length}</p>
          <h2>Dịch sang tiếng Trung</h2>
          <p class="translation-prompt">${escapeHtml(exercise.question_vi)}</p>
          <div data-hint-box style="display:none;margin-bottom:10px;padding:8px 12px;border-radius:10px;background:rgba(40,84,59,0.08);font-size:13px;"></div>
          <label for="translationAnswer">Câu trả lời của bạn</label>
          <input id="translationAnswer" autocomplete="off" placeholder="Nhập tiếng Trung (VD: ${escapeHtml((exercise.answer_zh || '').slice(0, 1))}...)"/>
          <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-top:4px;">
            <button class="translation-check" type="button" data-check-answer>Kiểm tra</button>
            <button class="btn btn-outline btn-sm" type="button" data-hint-answer style="padding:10px 14px;border-radius:12px;font-weight:700;">💡 Gợi ý</button>
          </div>
          <div class="translation-feedback" data-feedback></div>
        </section>`;

      const input = container.querySelector('#translationAnswer');
      const checkBtn = container.querySelector('[data-check-answer]');
      const hintBtn = container.querySelector('[data-hint-answer]');
      const hintBox = container.querySelector('[data-hint-box]');
      input.focus();

      hintBtn?.addEventListener('click', () => {
        if (!hintBox) return;
        const cleanZh = normalizeChinese(exercise.answer_zh);
        const prefixHint = cleanZh.slice(0, Math.min(2, Math.max(1, Math.floor(cleanZh.length / 2))));
        hintBox.style.display = 'block';
        hintBox.innerHTML = `💡 <b>Gợi ý:</b> Bắt đầu bằng "<b>${escapeHtml(prefixHint)}...</b>" (${cleanZh.length} chữ Hán)${answerPinyin ? ` · Pinyin: <i>${escapeHtml(answerPinyin)}</i>` : ''}`;
        input.focus();
      });

      const goNext = async () => {
        if (index === exercises.length - 1) await renderOverview();
        else {
          index += 1;
          renderQuestion();
        }
      };

      const check = async () => {
        if (isChecked) {
          await goNext();
          return;
        }
        const trimmed = normalizeChinese(input.value);
        if (!trimmed) {
          toast?.('Vui lòng nhập câu trả lời tiếng Trung trước khi kiểm tra!');
          input.focus();
          return;
        }

        isChecked = true;
        const isCorrect = isEquivalentChineseTranslation(input.value, exercise.answer_zh);
        if (checkBtn) checkBtn.disabled = true;

        if (isCorrect) {
          speakChinese(exercise.answer_zh);
        } else if (exercise.answer_zh) {
          recordMistakeWord({
            hanzi: exercise.answer_zh,
            pinyin: answerPinyin,
            meaning: exercise.question_vi,
            level: selectedLevel,
            example: exercise.explanation || '',
            source: `Luyện dịch ${selectedLevel}`
          });
        }

        const feedback = container.querySelector('[data-feedback]');
        answerStates.set(index, isCorrect);
        const navBtn = container.querySelector(`[data-go-question="${index}"]`);
        if (navBtn) {
          navBtn.classList.remove('correct', 'incorrect');
          navBtn.classList.add(isCorrect ? 'correct' : 'incorrect');
        }

        feedback.innerHTML = `
          <strong class="${isCorrect ? 'correct' : 'incorrect'}">${isCorrect ? 'Chính xác! 🎉' : 'Chưa đúng (Đã lưu vào Sổ tay từ hay sai)'}</strong>
          <p style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:6px;">
            <span>Đáp án: <b>${escapeHtml(exercise.answer_zh)}</b></span>
            <button type="button" class="speed-speak-btn" data-speak-translation title="Nghe phát âm câu" style="width:30px;height:30px;font-size:14px;">🔊</button>
          </p>
          ${answerPinyin ? `<p class="game-pinyin" style="margin:2px 0 6px;font-size:13px;color:#28543b;font-weight:600;">${escapeHtml(answerPinyin)}</p>` : ''}
          <small>${escapeHtml(exercise.explanation || '')}</small>
          <div style="display:flex;gap:10px;margin-top:10px;flex-wrap:wrap;">
            ${!isCorrect ? '<button type="button" class="btn btn-outline btn-sm" data-retry-question>Thử lại câu này</button>' : ''}
            <button type="button" data-next-question>${index === exercises.length - 1 ? 'Hoàn thành bài' : 'Câu tiếp theo (Enter) →'}</button>
          </div>
        `;

        feedback.querySelector('[data-speak-translation]')?.addEventListener('click', () => speakChinese(exercise.answer_zh));
        feedback.querySelector('[data-retry-question]')?.addEventListener('click', () => {
          isChecked = false;
          if (checkBtn) checkBtn.disabled = false;
          feedback.innerHTML = '';
          input.focus();
          input.select();
        });

        const alreadyRewarded = rewardedQuestions.has(index);
        if (isCorrect) rewardedQuestions.add(index);
        try {
          await saveAnswer(user?.id, selectedLevel, lesson, index + 1, isCorrect, alreadyRewarded);
        } catch (error) {
          toast?.('Không thể lưu tiến độ: ' + error.message);
        }

        feedback.querySelector('[data-next-question]')?.addEventListener('click', goNext);
      };

      checkBtn.addEventListener('click', check);
      input.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
          event.preventDefault();
          check();
        }
      });
      container.querySelector('[data-back-translation]').addEventListener('click', renderOverview);
      container.querySelectorAll('[data-go-question]').forEach((button) =>
        button.addEventListener('click', () => {
          index = Number(button.dataset.goQuestion);
          renderQuestion();
        })
      );
    };
    renderQuestion();
  };
  renderOverview();
}
