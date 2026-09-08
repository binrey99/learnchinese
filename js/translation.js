import { supabase } from './supabase.js';
import { recordScore, SCORE_RULES } from './score-service.js';

const levels = ['HSK 1', 'HSK 2', 'HSK 3', 'HSK 4', 'HSK 5', 'HSK 6'];
const lessonCount = 10;
const questionsPerLesson = 20;

const escapeHtml = (value = '') => String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
const normalizeChinese = (value = '') => String(value).replace(/[\s，。！？、；：“”‘’,.!?;:'"\-]/g, '').trim();

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

async function saveAnswer(userId, level, lesson, questionIndex, isCorrect) {
  if (!userId) return;
  const { error } = await supabase.from('translation_progress').upsert({
    user_id: userId, level, lesson, question_index: questionIndex, is_correct: isCorrect, direction: 'vi-zh'
  }, { onConflict: 'user_id,level,lesson,question_index' });
  if (error) throw error;
  const { error: activityError } = await supabase.from('learning_activity').insert({
    user_id: userId, activity_type: 'translation_answer', level, lesson, question_index: questionIndex, is_correct: isCorrect
  });
  if (activityError) console.warn('Unable to record learning activity:', activityError.message);
  if (isCorrect) {
    recordScore({ category: 'translation', points: SCORE_RULES.TRANSLATION_CORRECT, description: `Dịch đúng ${level} - Bài ${lesson}` });
  }
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
    const renderQuestion = () => {
      const exercise = exercises[index];
      container.innerHTML = `<div class="translation-session-head"><button type="button" data-back-translation>← Danh sách bài</button><span>${selectedLevel} · Bài ${lesson}</span></div><nav class="translation-question-nav" aria-label="Danh sách câu hỏi"><div><strong>Câu ${index + 1}/${exercises.length}</strong><span>Việt → Trung</span></div><section>${exercises.map((_, questionIndex) => `<button type="button" class="translation-question-number${questionIndex === index ? ' active' : ''}${answerStates.has(questionIndex) ? (answerStates.get(questionIndex) ? ' correct' : ' incorrect') : ''}" data-go-question="${questionIndex}">${questionIndex + 1}</button>`).join('')}</section></nav><section class="translation-question"><p class="translation-count">Câu ${index + 1}/${exercises.length}</p><h2>Dịch sang tiếng Trung</h2><p class="translation-prompt">${escapeHtml(exercise.question_vi)}</p><label for="translationAnswer">Câu trả lời của bạn</label><input id="translationAnswer" autocomplete="off" placeholder="Nhập tiếng Trung..."/><button class="translation-check" type="button" data-check-answer>Kiểm tra</button><div class="translation-feedback" data-feedback></div></section>`;
      const input = container.querySelector('#translationAnswer');
      input.focus();
      const check = async () => {
        const isCorrect = normalizeChinese(input.value) === normalizeChinese(exercise.answer_zh);
        const feedback = container.querySelector('[data-feedback]');
        answerStates.set(index, isCorrect);
        container.querySelector(`[data-go-question="${index}"]`).classList.add(isCorrect ? 'correct' : 'incorrect');
        feedback.innerHTML = `<strong class="${isCorrect ? 'correct' : 'incorrect'}">${isCorrect ? 'Chính xác!' : 'Chưa đúng'}</strong><p>Đáp án: <b>${escapeHtml(exercise.answer_zh)}</b></p><small>${escapeHtml(exercise.explanation || '')}</small><button type="button" data-next-question>${index === exercises.length - 1 ? 'Hoàn thành bài' : 'Câu tiếp theo →'}</button>`;
        try { await saveAnswer(user?.id, selectedLevel, lesson, index + 1, isCorrect); } catch (error) { toast?.('Không thể lưu tiến độ: ' + error.message); }
        container.querySelector('[data-next-question]').addEventListener('click', async () => { if (index === exercises.length - 1) await renderOverview(); else { index += 1; renderQuestion(); } });
      };
      container.querySelector('[data-check-answer]').addEventListener('click', check);
      input.addEventListener('keydown', (event) => { if (event.key === 'Enter') check(); });
      container.querySelector('[data-back-translation]').addEventListener('click', renderOverview);
      container.querySelectorAll('[data-go-question]').forEach((button) => button.addEventListener('click', () => { index = Number(button.dataset.goQuestion); renderQuestion(); }));
    };
    renderQuestion();
  };
  renderOverview();
}
