export function initLessonActions(showToast) {
  document.querySelector('#startButton')?.addEventListener('click', () => {
    showToast('Bài học đã sẵn sàng ✦');
  });

  document.querySelectorAll('.round-arrow').forEach((button) => {
    button.addEventListener('click', () => {
      showToast('Bài học đã được mở ✦');
    });
  });
}
