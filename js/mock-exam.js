import { recordScore, SCORE_RULES } from './score-service.js';

export const mockExams = [
  { id: 'hsk-1', title: 'Đề thi thử HSK 1', sections: 2, questions: 40, duration: 40 },
  { id: 'hsk-2', title: 'Đề thi thử HSK 2', sections: 2, questions: 60, duration: 55 },
  { id: 'hsk-3', title: 'Đề thi thử HSK 3', sections: 3, questions: 80, duration: 90 }
];

export function initMockExam({ selector = '[data-mock-exam]', onStart } = {}) {
  const container = document.querySelector(selector);
  if (!container) return;

  container.innerHTML = mockExams.map((exam) => `
    <article class="mock-exam-item">
      <strong>${exam.title}</strong>
      <span>${exam.sections} phần · ${exam.questions} câu · ${exam.duration} phút</span>
      <button type="button" data-exam-id="${exam.id}">Bắt đầu thi</button>
    </article>
  `).join('');

  container.querySelectorAll('[data-exam-id]').forEach((button) => {
    button.addEventListener('click', () => {
      const exam = mockExams.find((e) => e.id === button.dataset.examId);
      recordScore({ category: 'mock_exam', points: SCORE_RULES.MOCK_EXAM_COMPLETED, description: `Bắt đầu ${exam?.title || 'Thi thử'}` });
      onStart?.(button.dataset.examId);
    });
  });
}
