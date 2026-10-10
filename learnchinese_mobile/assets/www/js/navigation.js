const MOBILE_QUERY = '(max-width: 650px)';

/**
 * Điều khiển sidebar: nút hamburger trên điện thoại, backdrop, phím Escape.
 * Ở màn hình rộng (>= 651px) sidebar luôn hiển thị nên nút hamburger bị ẩn bằng CSS.
 */
export function initNavigation({
  menuSelector = '#menuButton',
  sidebarSelector = '#sidebar',
  backdropSelector = '#sidebarBackdrop'
} = {}) {
  const sidebar = document.querySelector(sidebarSelector);
  if (!sidebar) return;

  const menuButton = document.querySelector(menuSelector);
  const backdrop = document.querySelector(backdropSelector);
  const isMobile = () => window.matchMedia(MOBILE_QUERY).matches;

  const setOpen = (open) => {
    sidebar.classList.toggle('open', open);
    backdrop?.classList.toggle('show', open);
    backdrop?.setAttribute('aria-hidden', String(!open));
    document.body.classList.toggle('sidebar-open', open && isMobile());
    menuButton?.setAttribute('aria-expanded', String(open));
  };
  const closeSidebar = () => setOpen(false);

  menuButton?.addEventListener('click', () => setOpen(!sidebar.classList.contains('open')));
  backdrop?.addEventListener('click', closeSidebar);

  // Chọn xong một mục điều hướng thì đóng sidebar để thấy ngay nội dung trên điện thoại
  document.querySelectorAll('.nav-item').forEach((item) => {
    item.addEventListener('click', closeSidebar);
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && sidebar.classList.contains('open')) closeSidebar();
  });

  // Xoay ngang / thu phóng về màn hình lớn thì bỏ trạng thái mở và khoá cuộn trang
  window.addEventListener('resize', () => {
    if (!isMobile()) closeSidebar();
  });

  setOpen(false);
}
