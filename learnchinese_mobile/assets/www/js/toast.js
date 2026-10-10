export function createToast(selector = '#toast') {
  const toast = document.querySelector(selector);
  if (!toast) return () => {};

  return (message) => {
    toast.textContent = message;
    toast.classList.add('show');
    window.setTimeout(() => toast.classList.remove('show'), 2400);
  };
}
