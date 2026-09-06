export function initNavigation({ menuSelector = '#menuButton', sidebarSelector = '#sidebar' } = {}) {
  const menuButton = document.querySelector(menuSelector);
  const sidebar = document.querySelector(sidebarSelector);
  if (!menuButton || !sidebar) return;

  menuButton.addEventListener('click', () => sidebar.classList.toggle('open'));

  document.querySelectorAll('.nav-item[data-route]').forEach((item) => {
    item.addEventListener('click', () => {
      sidebar.classList.remove('open');
    });
  });
}
