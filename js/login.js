import { supabase } from './supabase.js';

const REMEMBERED_EMAIL_KEY = 'mandarinly-remembered-email';

async function getCurrentProfile(userId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, email, full_name, avatar_url')
    .eq('id', userId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function loadAccounts() {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, email, full_name, avatar_url, created_at, updated_at')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data;
}

export function initLogin({ triggerSelector = '#loginTrigger', modalSelector = '#loginModal', toast, onAuthChanged } = {}) {
  const trigger = document.querySelector(triggerSelector);
  const modal = document.querySelector(modalSelector);
  const form = modal?.querySelector('#loginForm');
  const closeButton = modal?.querySelector('[data-close-login]');
  const errorMessage = modal?.querySelector('#loginError');
  const title = modal?.querySelector('#loginTitle');
  const description = modal?.querySelector('.login-card>p');
  const submitButton = modal?.querySelector('.login-submit');
  const authSwitch = modal?.querySelector('#authSwitch');
  const authSwitchText = modal?.querySelector('#authSwitchText');
  const confirmPasswordField = modal?.querySelector('.confirm-password-field');
  const rememberAccount = modal?.querySelector('#rememberAccount');
  const accountMenu = document.querySelector('#accountMenu');
  const accountEmail = document.querySelector('#accountEmail');
  const logoutButton = document.querySelector('#logoutButton');
  const profileLink = document.querySelector('#profileLink');
  let isRegisterMode = false;

  if (!trigger || !modal || !form) return;

  const closeModal = () => {
    modal.classList.remove('open');
    errorMessage.textContent = '';
    form.reset();
  };

  const updateTrigger = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    const isLoggedIn = Boolean(session);
    const label = isLoggedIn ? 'Đăng xuất' : 'Đăng nhập';
    if (trigger.classList.contains('login-avatar')) {
      trigger.setAttribute('aria-label', label);
      trigger.setAttribute('title', label);
    } else {
      trigger.textContent = label;
    }
    if (accountMenu) accountMenu.hidden = true;
    if (accountEmail) accountEmail.textContent = session?.user?.email || 'Tài khoản';
    trigger.dataset.loggedIn = String(isLoggedIn);
  };

  const updateMode = () => {
    isRegisterMode = !isRegisterMode;
    title.textContent = isRegisterMode ? 'Tạo tài khoản mới' : 'Chào mừng trở lại';
    description.textContent = isRegisterMode ? 'Đăng ký để bắt đầu hành trình học tiếng Trung.' : 'Đăng nhập để tiếp tục hành trình học tiếng Trung.';
    submitButton.textContent = isRegisterMode ? 'Đăng ký' : 'Đăng nhập';
    authSwitchText.textContent = isRegisterMode ? 'Đã có tài khoản?' : 'Chưa có tài khoản?';
    authSwitch.textContent = isRegisterMode ? 'Đăng nhập' : 'Đăng ký ngay';
    confirmPasswordField.hidden = !isRegisterMode;
    errorMessage.textContent = '';
  };

  trigger.addEventListener('click', () => {
    if (trigger.dataset.loggedIn === 'true') {
      if (accountMenu) accountMenu.hidden = !accountMenu.hidden;
      return;
    }

    modal.classList.add('open');
    const emailInput = modal.querySelector('#loginEmail');
    emailInput.value = localStorage.getItem(REMEMBERED_EMAIL_KEY) || '';
    if (rememberAccount) rememberAccount.checked = Boolean(emailInput.value);
    emailInput.focus();
  });

  logoutButton?.addEventListener('click', async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast?.('Không thể đăng xuất, hãy thử lại');
      return;
    }
    await updateTrigger();
    await onAuthChanged?.();
    toast?.('Bạn đã đăng xuất');
  });
  profileLink?.addEventListener('click', () => {
    if (accountMenu) accountMenu.hidden = true;
  });

  closeButton?.addEventListener('click', closeModal);
  authSwitch?.addEventListener('click', updateMode);
  modal.addEventListener('click', (event) => {
    if (event.target === modal) closeModal();
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const email = form.querySelector('#loginEmail').value.trim();
    const password = form.querySelector('#loginPassword').value;
    const fullName = email.split('@')[0];

    if (!email || !email.includes('@')) {
      errorMessage.textContent = 'Vui lòng nhập email hợp lệ.';
      return;
    }

    if (password.length < 6) {
      errorMessage.textContent = 'Mật khẩu cần có ít nhất 6 ký tự.';
      return;
    }

    submitButton.disabled = true;
    errorMessage.textContent = '';

    try {
      if (rememberAccount?.checked) {
        localStorage.setItem(REMEMBERED_EMAIL_KEY, email);
      } else {
        localStorage.removeItem(REMEMBERED_EMAIL_KEY);
      }
      let result;
      if (isRegisterMode) {
      const confirmPassword = form.querySelector('#confirmPassword').value;
      if (password !== confirmPassword) {
        errorMessage.textContent = 'Mật khẩu xác nhận không khớp.';
        return;
      }
        result = await supabase.auth.signUp({ email, password, options: { data: { full_name: fullName } } });
      } else {
        result = await supabase.auth.signInWithPassword({ email, password });
      }

      if (result.error) throw result.error;
      if (isRegisterMode && !result.data.session) {
        closeModal();
        toast?.('Đăng ký thành công, hãy kiểm tra email để xác nhận');
        return;
      }

      let profile = null;
      if (result.data.user) {
        try {
          profile = await getCurrentProfile(result.data.user.id);
        } catch {
          profile = null;
        }
      }
      const profileName = profile?.full_name || fullName;
      const profileNameElement = document.querySelector('.profile-mini strong');
      if (profileNameElement) profileNameElement.textContent = profileName;
      closeModal();
      await updateTrigger();
      await onAuthChanged?.();
      toast?.(isRegisterMode ? 'Đăng ký thành công ✦' : 'Đăng nhập thành công ✦');
    } catch (error) {
      errorMessage.textContent = error.message || 'Không thể đăng nhập. Vui lòng thử lại.';
    } finally {
      submitButton.disabled = false;
    }
  });

  updateTrigger();
}
