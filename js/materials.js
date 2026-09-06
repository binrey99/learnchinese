export const materials = [
  { id: 'grammar', title: 'Ngữ pháp tiếng Trung cơ bản', type: 'PDF', size: '2.4 MB' },
  { id: 'hsk-vocabulary', title: 'Danh sách từ vựng HSK 1-3', type: 'PDF', size: '1.8 MB' },
  { id: 'pronunciation', title: 'Bảng thanh điệu và phát âm', type: 'Bài viết', size: '5 phút đọc' }
];

export function initMaterials({ selector = '[data-materials]', onOpen } = {}) {
  const container = document.querySelector(selector);
  if (!container) return;

  container.innerHTML = materials.map((material) => `
    <article class="material-item">
      <strong>${material.title}</strong>
      <span>${material.type} · ${material.size}</span>
      <button type="button" data-material-id="${material.id}">Mở tài liệu</button>
    </article>
  `).join('');

  container.querySelectorAll('[data-material-id]').forEach((button) => {
    button.addEventListener('click', () => onOpen?.(button.dataset.materialId));
  });
}
