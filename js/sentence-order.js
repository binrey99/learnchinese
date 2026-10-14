import { supabase } from './supabase.js';
import { recordScore, SCORE_RULES } from './score-service.js';
import { awardLuluExp } from './lulu.js';
import { recordMistakeWord } from './srs-service.js';


const levels = ['HSK 1', 'HSK 2', 'HSK 3', 'HSK 4', 'HSK 5', 'HSK 6'];
const lessonCount = 10;
const exerciseTable = 'sentence_order_exercises';
const escapeHtml = (value = '') => String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
const normalizeChinese = (value = '') => String(value).replace(/[\s，。！？、；：、“”‘’,.!?;:'"-]/g, '');
const shuffle = (items) => [...items].sort(() => Math.random() - 0.5);

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

function isEquivalentSentenceOrder(userStr = '', targetStr = '') {
  const u = normalizeChinese(userStr);
  const t = normalizeChinese(targetStr);
  if (!u || !t) return false;
  if (u === t) return true;

  // Chấp nhận đảo vị trí [Trạng ngữ chỉ thời gian] + [Chủ ngữ] ở đầu câu (VD: 今天我... <-> 我今天...)
  const timeWords = ['今天', '明天', '昨天', '现在', '每天', '今年', '明年', '去年', '早上', '上午', '中午', '下午', '晚上', '周末', '平时', '以前', '以后'];
  const subjects = ['我', '你', '他', '她', '它', '我们', '你们', '他们', '她们', '咱们', '爸爸', '妈妈', '老师', '大家', '小王', '小李'];

  for (const tw of timeWords) {
    for (const sb of subjects) {
      if (t.startsWith(tw + sb) && u === sb + tw + t.slice((tw + sb).length)) return true;
      if (t.startsWith(sb + tw) && u === tw + sb + t.slice((sb + tw).length)) return true;
    }
  }
  return false;
}

const getUser = async () => (await supabase.auth.getUser()).data.user;

async function getProgress(userId, level) {
  if (!userId) return [];
  const { data, error } = await supabase.from('sentence_order_progress').select('lesson, question_index, is_correct').eq('user_id', userId).eq('level', level);
  if (error) throw error;
  return data;
}

async function getExercises(level, lesson) {
  const { data, error } = await supabase.from(exerciseTable).select('id, level, lesson, question_vi, answer_zh, words, explanation').eq('level', level).eq('lesson', lesson).order('id');
  if (error) throw error;
  return data;
}

async function saveProgress(userId, level, lesson, questionIndex, isCorrect, alreadyRewarded = false) {
  if (isCorrect && !alreadyRewarded) {
    recordScore({ category: 'sentence_order', points: SCORE_RULES.SENTENCE_ORDER_CORRECT, description: `Sắp xếp đúng ${level} - Bài ${lesson}` });
    awardLuluExp(10, { source: 'Sắp xếp câu tiếng Trung' });
  }
  if (!userId) return;
  const { error } = await supabase.from('sentence_order_progress').upsert({ user_id: userId, level, lesson, question_index: questionIndex, is_correct: isCorrect }, { onConflict: 'user_id,level,lesson,question_index' });
  if (error) throw error;
}

function parseWords(words) {
  if (Array.isArray(words)) return words;
  try { return JSON.parse(words); } catch { return String(words || '').split(/[，,\s]+/).filter(Boolean); }
}

export function initSentenceOrder({ selector = '[data-sentence-order]', toast } = {}) {
  const container = document.querySelector(selector);
  if (!container) return;
  let selectedLevel = levels[0];
  let user = null;
  let progress = [];

  const renderOverview = async () => {
    container.innerHTML = '<p class="practice-loading">Đang tải tiến độ sắp xếp câu...</p>';
    try { user = await getUser(); progress = await getProgress(user?.id, selectedLevel); } catch (error) { console.error(error); progress = []; }
    const doneFor = (lesson) => progress.filter((item) => item.lesson === lesson).length;
    container.innerHTML = `<div class="translation-levels" role="tablist">${levels.map((level) => `<button type="button" class="translation-level${level === selectedLevel ? ' active' : ''}" data-order-level="${level}">${level}</button>`).join('')}</div><div class="translation-summary"><article><span>Câu đã làm</span><strong>${progress.length}</strong><small>câu đã lưu</small></article><article><span>Trả lời đúng</span><strong>${progress.filter((item) => item.is_correct).length}</strong><small>trong ${selectedLevel}</small></article><article><span>Tiến độ</span><strong>${Math.round(progress.length / 200 * 100)}%</strong><small>10 bài · 20 câu/bài</small></article></div><h2 class="translation-heading">${selectedLevel} · Sắp xếp câu</h2><div class="translation-lessons">${Array.from({ length: lessonCount }, (_, index) => { const lesson = index + 1; return `<button type="button" class="translation-lesson${doneFor(lesson) === 20 ? ' completed' : ''}" data-order-lesson="${lesson}"><strong>Bài ${lesson}</strong><span>${doneFor(lesson)}/20 câu</span><b>→</b></button>`; }).join('')}</div>`;
    container.querySelectorAll('[data-order-level]').forEach((button) => button.addEventListener('click', () => { selectedLevel = button.dataset.orderLevel; renderOverview(); }));
    container.querySelectorAll('[data-order-lesson]').forEach((button) => button.addEventListener('click', () => renderLesson(Number(button.dataset.orderLesson))));
  };

  const renderLesson = async (lesson) => {
    container.innerHTML = '<p class="practice-loading">Đang tải câu hỏi...</p>';
    let exercises;
    try { exercises = await getExercises(selectedLevel, lesson); } catch (error) { container.innerHTML = `<p class="practice-loading">Không tải được dữ liệu: ${escapeHtml(error.message)}</p>`; return; }
    if (!exercises.length) { container.innerHTML = '<p class="practice-loading">Bài này chưa có câu hỏi trên Supabase.</p>'; return; }
    let index = 0;
    const answerStates = new Map(progress.filter((item) => item.lesson === lesson).map((item) => [item.question_index - 1, item.is_correct]));
    const rewardedQuestions = new Set(
      progress.filter((item) => item.lesson === lesson && item.is_correct).map((item) => item.question_index - 1)
    );

    const renderQuestion = () => {
      const exercise = exercises[index];
      const available = shuffle(parseWords(exercise.words)).map((word, wordIndex) => ({
        word,
        pinyin: toPinyin(word),
        wordIndex
      }));
      const selected = [];
      let isChecked = false;

      const draw = () => {
        const remaining = available.filter((item) => !selected.some((chosen) => chosen.wordIndex === item.wordIndex));
        container.innerHTML = `
          <section class="sentence-order-session">
            <div class="translation-session-head">
              <button type="button" data-back-order>← Danh sách bài</button>
              <span>${selectedLevel} · Bài ${lesson}</span>
            </div>
            <nav class="translation-question-nav" aria-label="Danh sách câu hỏi">
              <div><strong>Câu ${index + 1}/${exercises.length}</strong><span>Việt → Trung</span></div>
              <section>${exercises.map((_, questionIndex) => `<button type="button" class="translation-question-number${questionIndex === index ? ' active' : ''}${answerStates.has(questionIndex) ? (answerStates.get(questionIndex) ? ' correct' : ' incorrect') : ''}" data-go-order-question="${questionIndex}">${questionIndex + 1}</button>`).join('')}</section>
            </nav>
            <h2>Sắp xếp câu tiếng Trung</h2>
            <p class="translation-prompt">${escapeHtml(exercise.question_vi)}</p>
            <p class="quiz-instruction">Kéo thả hoặc bấm vào từng từ để ghép câu (bấm lại từ trên khay để bỏ chọn)</p>
            <div class="order-answer" data-drop-zone="answer">
              ${selected.length
                ? selected.map((item, position) => `
                  <button type="button" class="order-word-chip" draggable="${!isChecked}" data-selected-index="${position}">
                    <span class="game-pinyin">${escapeHtml(item.pinyin)}</span>
                    <strong>${escapeHtml(item.word)}</strong>
                  </button>`).join('')
                : '<span class="order-placeholder">Kéo hoặc bấm các từ bên dưới vào đây để tạo thành câu</span>'}
            </div>
            <div class="order-words" data-drop-zone="words">
              ${remaining.length
                ? remaining.map((item) => `
                  <button type="button" class="order-word-chip" draggable="${!isChecked}" data-source-index="${item.wordIndex}">
                    <span class="game-pinyin">${escapeHtml(item.pinyin)}</span>
                    <strong>${escapeHtml(item.word)}</strong>
                  </button>`).join('')
                : '<span class="order-words-empty">Đã chọn hết các từ (bấm từ ở trên để bỏ chọn)</span>'}
            </div>
            <div class="translation-action-row" style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;">
              <button type="button" class="translation-check" data-check-order ${selected.length && !isChecked ? '' : 'disabled'}>Kiểm tra</button>
              <button type="button" class="btn btn-outline btn-sm" data-reset-order ${selected.length ? '' : 'disabled'} style="padding:10px 16px;border-radius:12px;font-weight:700;">↺ Đặt lại</button>
            </div>
            <div class="translation-feedback" data-order-feedback></div>
          </section>`;

        container.querySelector('[data-back-order]').addEventListener('click', renderOverview);
        container.querySelectorAll('[data-go-order-question]').forEach((button) =>
          button.addEventListener('click', () => {
            index = Number(button.dataset.goOrderQuestion);
            renderQuestion();
          })
        );

        container.querySelector('[data-reset-order]')?.addEventListener('click', () => {
          selected.length = 0;
          isChecked = false;
          draw();
        });

        let dragging = null;
        container.querySelectorAll('[data-source-index], [data-selected-index]').forEach((button) => {
          button.addEventListener('dragstart', (event) => {
            if (isChecked) {
              event.preventDefault();
              return;
            }
            dragging =
              button.dataset.sourceIndex !== undefined
                ? { from: 'words', index: Number(button.dataset.sourceIndex) }
                : { from: 'answer', index: Number(button.dataset.selectedIndex) };
            event.dataTransfer.effectAllowed = 'move';
            button.classList.add('dragging');
          });
          button.addEventListener('dragend', () => button.classList.remove('dragging'));
        });

        // Tap support keeps the exercise usable on touch-only phones.
        container.querySelectorAll('[data-source-index]').forEach((button) =>
          button.addEventListener('click', () => {
            if (isChecked) return;
            const item = available.find((word) => word.wordIndex === Number(button.dataset.sourceIndex));
            if (item && !selected.some((chosen) => chosen.wordIndex === item.wordIndex)) {
              speakChinese(item.word);
              selected.push(item);
              draw();
            }
          })
        );

        container.querySelectorAll('[data-selected-index]').forEach((button) =>
          button.addEventListener('click', () => {
            if (isChecked) return;
            selected.splice(Number(button.dataset.selectedIndex), 1);
            draw();
          })
        );

        container.querySelectorAll('[data-drop-zone]').forEach((zone) => {
          zone.addEventListener('dragover', (event) => {
            if (isChecked) return;
            event.preventDefault();
            zone.classList.add('drag-over');
          });
          zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
          zone.addEventListener('drop', (event) => {
            event.preventDefault();
            zone.classList.remove('drag-over');
            if (!dragging || isChecked) return;
            const destination = zone.dataset.dropZone;
            if (dragging.from === 'words' && destination === 'answer') {
              const item = available.find((word) => word.wordIndex === dragging.index);
              if (item && !selected.some((chosen) => chosen.wordIndex === item.wordIndex)) {
                const targetBtn = event.target.closest('[data-selected-index]');
                if (targetBtn && targetBtn.dataset.selectedIndex !== undefined) {
                  const targetPos = Number(targetBtn.dataset.selectedIndex);
                  selected.splice(targetPos, 0, item);
                } else {
                  selected.push(item);
                }
              }
            } else if (dragging.from === 'answer' && destination === 'words') {
              selected.splice(dragging.index, 1);
            } else if (dragging.from === 'answer' && destination === 'answer') {
              const targetBtn = event.target.closest('[data-selected-index]');
              const [item] = selected.splice(dragging.index, 1);
              if (targetBtn && targetBtn.dataset.selectedIndex !== undefined) {
                const targetPos = Number(targetBtn.dataset.selectedIndex);
                selected.splice(targetPos, 0, item);
              } else {
                selected.push(item);
              }
            }
            dragging = null;
            draw();
          });
        });

        container.querySelector('[data-check-order]').addEventListener('click', async () => {
          if (isChecked || !selected.length) return;
          isChecked = true;
          const userSentence = selected.map((item) => item.word).join('');
          const correct = isEquivalentSentenceOrder(userSentence, exercise.answer_zh);
          const answerPinyin = toPinyin(exercise.answer_zh);

          const checkBtn = container.querySelector('[data-check-order]');
          if (checkBtn) checkBtn.disabled = true;

          if (correct) {
            speakChinese(exercise.answer_zh);
          } else if (exercise.answer_zh) {
            recordMistakeWord({
              hanzi: exercise.answer_zh,
              pinyin: answerPinyin,
              meaning: exercise.question_vi,
              level: selectedLevel,
              example: exercise.explanation || '',
              source: `Sắp xếp câu ${selectedLevel}`
            });
          }

          answerStates.set(index, correct);
          const qNavBtn = container.querySelector(`[data-go-order-question="${index}"]`);
          if (qNavBtn) {
            qNavBtn.classList.remove('correct', 'incorrect');
            qNavBtn.classList.add(correct ? 'correct' : 'incorrect');
          }

          const feedback = container.querySelector('[data-order-feedback]');
          feedback.innerHTML = `
            <strong class="${correct ? 'correct' : 'incorrect'}">${correct ? 'Chính xác! 🎉' : 'Chưa đúng (Đã lưu vào Sổ tay từ hay sai)'}</strong>
            <p style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:6px;">
              <span>Đáp án: <b>${escapeHtml(exercise.answer_zh)}</b></span>
              <button type="button" class="speed-speak-btn" data-speak-order title="Nghe phát âm câu" style="width:30px;height:30px;font-size:14px;">🔊</button>
            </p>
            ${answerPinyin ? `<p class="game-pinyin" style="margin:2px 0 6px;font-size:13px;color:#28543b;font-weight:600;">${escapeHtml(answerPinyin)}</p>` : ''}
            <small>${escapeHtml(exercise.explanation || '')}</small>
            <div style="display:flex;gap:10px;margin-top:10px;flex-wrap:wrap;">
              ${!correct ? '<button type="button" class="btn btn-outline btn-sm" data-retry-order>Thử lại câu này</button>' : ''}
              <button type="button" data-next-order>${index === exercises.length - 1 ? 'Hoàn thành bài' : 'Câu tiếp theo →'}</button>
            </div>
          `;

          feedback.querySelector('[data-speak-order]')?.addEventListener('click', () => speakChinese(exercise.answer_zh));
          feedback.querySelector('[data-retry-order]')?.addEventListener('click', () => {
            selected.length = 0;
            isChecked = false;
            draw();
          });

          const alreadyRewarded = rewardedQuestions.has(index);
          if (correct) rewardedQuestions.add(index);
          try {
            await saveProgress(user?.id, selectedLevel, lesson, index + 1, correct, alreadyRewarded);
          } catch (error) {
            toast?.('Không thể lưu tiến độ: ' + error.message);
          }

          feedback.querySelector('[data-next-order]')?.addEventListener('click', () => {
            if (index === exercises.length - 1) renderOverview();
            else {
              index += 1;
              renderQuestion();
            }
          });
        });
      };
      draw();
    };
    renderQuestion();
  };
  renderOverview();
}
