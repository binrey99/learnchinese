export const hskLevels = [
  { level: 1, title: 'HSK 1', words: 150, progress: 100, status: 'Đã hoàn thành' },
  { level: 2, title: 'HSK 2', words: 300, progress: 100, status: 'Đã hoàn thành' },
  { level: 3, title: 'HSK 3', words: 600, progress: 68, status: 'Đang học' },
  { level: 4, title: 'HSK 4', words: 1200, progress: 0, status: 'Chưa bắt đầu' },
  { level: 5, title: 'HSK 5', words: 2500, progress: 0, status: 'Chưa bắt đầu' },
  { level: 6, title: 'HSK 6', words: 5000, progress: 0, status: 'Chưa bắt đầu' }
];

export function initHsk({ selector = '[data-hsk]' } = {}) {
  const container = document.querySelector(selector);
  if (!container) return;

  container.innerHTML = hskLevels.map((item) => `
    <article class="hsk-item" data-level="${item.level}">
      <strong>${item.title}</strong>
      <span>${item.words} từ</span>
      <progress value="${item.progress}" max="100"></progress>
      <small>${item.status} · ${item.progress}%</small>
    </article>
  `).join('');
}
