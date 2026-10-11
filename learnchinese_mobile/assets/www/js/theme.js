/**
 * LULU CHINESE - THEME CONTROLLER (SÁNG / TỐI)
 * Quản lý trạng thái giao diện Dark Mode & Light Mode
 */

export function initTheme({ toast } = {}) {
  const toggleBtn = document.querySelector('#themeToggleBtn');
  const root = document.documentElement;
  const body = document.body;

  function updateAriaAndTitle(isDark) {
    if (!toggleBtn) return;
    const title = isDark 
      ? 'Chuyển sang Giao diện Sáng (Alt+T)' 
      : 'Chuyển sang Giao diện Tối (Alt+T)';
    toggleBtn.setAttribute('title', title);
    toggleBtn.setAttribute('aria-label', isDark ? 'Chuyển sang Giao diện Sáng' : 'Chuyển sang Giao diện Tối');
    toggleBtn.classList.toggle('is-dark', isDark);
  }

  function applyTheme(theme, notify = false) {
    const isDark = theme === 'dark';
    if (isDark) {
      root.setAttribute('data-theme', 'dark');
      body.classList.add('dark-mode');
      localStorage.setItem('theme', 'dark');
    } else {
      root.setAttribute('data-theme', 'light');
      body.classList.remove('dark-mode');
      localStorage.setItem('theme', 'light');
    }

    updateAriaAndTitle(isDark);

    if (notify && typeof toast === 'function') {
      toast(isDark ? '🌙 Đã chuyển sang Giao diện Tối' : '☀️ Đã chuyển sang Giao diện Sáng');
    }

    window.dispatchEvent(new CustomEvent('theme-changed', { detail: { theme: isDark ? 'dark' : 'light' } }));
  }

  // Khởi tạo theme ban đầu: Ưu tiên thiết lập người dùng đã lưu, nếu chưa có thì theo tùy chọn hệ điều hành
  const savedTheme = localStorage.getItem('theme');
  const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  const initialTheme = savedTheme ? savedTheme : (prefersDark ? 'dark' : 'light');
  applyTheme(initialTheme, false);

  if (toggleBtn) {
    toggleBtn.addEventListener('click', () => {
      const current = root.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
      const next = current === 'dark' ? 'light' : 'dark';
      applyTheme(next, true);
    });
  }

  // Phím tắt nhanh: Alt + T để đổi giao diện
  window.addEventListener('keydown', (e) => {
    if (e.altKey && (e.key === 't' || e.key === 'T')) {
      e.preventDefault();
      const current = root.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
      const next = current === 'dark' ? 'light' : 'dark';
      applyTheme(next, true);
    }
  });

  // Tự động lắng nghe thay đổi giao diện từ thiết bị khi người dùng chưa chọn thủ công
  if (window.matchMedia) {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
      if (!localStorage.getItem('theme')) {
        applyTheme(e.matches ? 'dark' : 'light', false);
      }
    });
  }
}
