import { supabase } from './supabase.js';
import { pinyin } from 'https://esm.sh/pinyin-pro@3.27.0';
import { awardLuluExp } from './lulu.js';


export const practiceTypes = [
  { id: 'mastered-vocabulary', title: 'Kiểm tra từ đã thuộc', description: 'Chọn chữ Hán đúng theo nghĩa tiếng Việt từ các từ bạn đã đánh dấu sao', duration: '5 phút' },
  { id: 'translation', title: 'Luyện dịch', description: 'Dịch câu Trung – Việt và Việt – Trung', duration: '10 phút' },
  { id: 'sentence-order', title: 'Sắp xếp câu', description: 'Sắp xếp các từ thành câu đúng', duration: '12 phút' },
  { id: 'fill-in-blank', title: 'Điền từ vào câu', description: 'Chọn từ phù hợp để hoàn thành câu', duration: '15 phút' },
  { id: 'question-answer', title: 'Hỏi đáp', description: 'Luyện trả lời các câu hỏi tiếng Trung', duration: '12 phút' }
];

const shuffle = (items) => [...items].sort(() => Math.random() - 0.5);
const escapeHtml = (value = '') => String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');

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

      // Update progress bar to include this answered question
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
            ${!correct ? `<span class="feedback-answer">Đáp án đúng: <b>${escapeHtml(word.vocab)}</b> (${escapeHtml(pinyin(word.vocab, { toneType: 'symbol' }))})</span>` : ''}
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
      <strong>${item.title}</strong>
      <span>${item.description} · ${item.duration}</span>
    </button>
  `).join('');
  container.querySelectorAll('[data-practice-id]').forEach((button) => {
    button.addEventListener('click', () => {
      if (button.dataset.practiceId === 'mastered-vocabulary') renderMasteredVocabularyQuiz(container, onStart);
      else onStart?.(button.dataset.practiceId);
    });
  });
}

export function initPractice({ selector = '[data-practice]', onStart } = {}) {
  const container = document.querySelector(selector);
  if (!container) return;
  renderPracticeList(container, onStart);
}
