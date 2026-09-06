import { supabase } from './supabase.js';

const levels = ['HSK 1', 'HSK 2', 'HSK 3', 'HSK 4', 'HSK 5', 'HSK 6'];
const lessonCount = 10;
const exerciseTable = 'sentence_order_exercises';
const escapeHtml = (value = '') => String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
const normalizeChinese = (value = '') => String(value).replace(/[\s，。！？、；：、“”‘’,.!?;:'"-]/g, '');
const shuffle = (items) => [...items].sort(() => Math.random() - 0.5);

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

async function saveProgress(userId, level, lesson, questionIndex, isCorrect) {
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
    const renderQuestion = () => {
      const exercise = exercises[index];
      const available = shuffle(parseWords(exercise.words)).map((word, wordIndex) => ({ word, wordIndex }));
      const selected = [];
      const draw = () => {
        container.innerHTML = `<section class="sentence-order-session"><div class="translation-session-head"><button type="button" data-back-order>← Danh sách bài</button><span>${selectedLevel} · Bài ${lesson}</span></div><nav class="translation-question-nav" aria-label="Danh sách câu hỏi"><div><strong>Câu ${index + 1}/${exercises.length}</strong><span>Việt → Trung</span></div><section>${exercises.map((_, questionIndex) => `<button type="button" class="translation-question-number${questionIndex === index ? ' active' : ''}${answerStates.has(questionIndex) ? (answerStates.get(questionIndex) ? ' correct' : ' incorrect') : ''}" data-go-order-question="${questionIndex}">${questionIndex + 1}</button>`).join('')}</section></nav><h2>Sắp xếp câu tiếng Trung</h2><p class="translation-prompt">${escapeHtml(exercise.question_vi)}</p><p class="quiz-instruction">Kéo thả các từ theo đúng thứ tự</p><div class="order-answer" data-drop-zone="answer">${selected.length ? selected.map((item, position) => `<button type="button" draggable="true" data-selected-index="${position}">${escapeHtml(item.word)}</button>`).join('') : '<span>Kéo các từ vào đây để tạo thành câu</span>'}</div><div class="order-words" data-drop-zone="words">${available.map((item) => `<button type="button" draggable="true" data-source-index="${item.wordIndex}" ${selected.some((chosen) => chosen.wordIndex === item.wordIndex) ? 'disabled' : ''}>${escapeHtml(item.word)}</button>`).join('')}</div><button type="button" class="translation-check" data-check-order ${selected.length ? '' : 'disabled'}>Kiểm tra</button><div class="translation-feedback" data-order-feedback></div></section>`;
        container.querySelector('[data-back-order]').addEventListener('click', renderOverview);
        container.querySelectorAll('[data-go-order-question]').forEach((button) => button.addEventListener('click', () => { index = Number(button.dataset.goOrderQuestion); renderQuestion(); }));
        let dragging = null;
        container.querySelectorAll('[data-source-index], [data-selected-index]').forEach((button) => {
          button.addEventListener('dragstart', (event) => { dragging = button.dataset.sourceIndex !== undefined ? { from: 'words', index: Number(button.dataset.sourceIndex) } : { from: 'answer', index: Number(button.dataset.selectedIndex) }; event.dataTransfer.effectAllowed = 'move'; button.classList.add('dragging'); });
          button.addEventListener('dragend', () => button.classList.remove('dragging'));
        });
        // Tap support keeps the exercise usable on touch-only phones.
        container.querySelectorAll('[data-source-index]').forEach((button) => button.addEventListener('click', () => { const item = available.find((word) => word.wordIndex === Number(button.dataset.sourceIndex)); if (item && !selected.some((chosen) => chosen.wordIndex === item.wordIndex)) { selected.push(item); draw(); } }));
        container.querySelectorAll('[data-selected-index]').forEach((button) => button.addEventListener('click', () => { selected.splice(Number(button.dataset.selectedIndex), 1); draw(); }));
        container.querySelectorAll('[data-drop-zone]').forEach((zone) => {
          zone.addEventListener('dragover', (event) => { event.preventDefault(); zone.classList.add('drag-over'); });
          zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
          zone.addEventListener('drop', (event) => {
            event.preventDefault(); zone.classList.remove('drag-over'); if (!dragging) return;
            const destination = zone.dataset.dropZone;
            if (dragging.from === 'words' && destination === 'answer') { const item = available.find((word) => word.wordIndex === dragging.index); if (item && !selected.some((chosen) => chosen.wordIndex === item.wordIndex)) selected.push(item); }
            else if (dragging.from === 'answer' && destination === 'words') selected.splice(dragging.index, 1);
            else if (dragging.from === 'answer' && destination === 'answer') { const [item] = selected.splice(dragging.index, 1); selected.push(item); }
            dragging = null; draw();
          });
        });
        container.querySelector('[data-check-order]').addEventListener('click', async () => {
          const correct = normalizeChinese(selected.map((item) => item.word).join('')) === normalizeChinese(exercise.answer_zh);
          answerStates.set(index, correct);
          const feedback = container.querySelector('[data-order-feedback]');
          feedback.innerHTML = `<strong class="${correct ? 'correct' : 'incorrect'}">${correct ? 'Chính xác!' : 'Chưa đúng'}</strong><p>Đáp án: <b>${escapeHtml(exercise.answer_zh)}</b></p><small>${escapeHtml(exercise.explanation || '')}</small><button type="button" data-next-order>${index === exercises.length - 1 ? 'Hoàn thành bài' : 'Câu tiếp theo →'}</button>`;
          try { await saveProgress(user?.id, selectedLevel, lesson, index + 1, correct); } catch (error) { toast?.('Không thể lưu tiến độ: ' + error.message); }
          container.querySelector('[data-next-order]').addEventListener('click', () => { if (index === exercises.length - 1) renderOverview(); else { index += 1; renderQuestion(); } });
        });
      };
      draw();
    };
    renderQuestion();
  };
  renderOverview();
}
