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
  const description = modal?.querySelector('#loginSubtitle') || modal?.querySelector('.login-card>p');
  const submitButton = modal?.querySelector('.login-submit');
  const authSwitch = modal?.querySelector('#authSwitch');
  const authSwitchText = modal?.querySelector('#authSwitchText');
  const authSwitchWrap = modal?.querySelector('#authSwitchWrap');
  const googleLoginBtn = modal?.querySelector('#googleLoginBtn');
  const oauthDivider = modal?.querySelector('#oauthDivider');
  const confirmPasswordField = modal?.querySelector('.confirm-password-field');
  const rememberAccount = modal?.querySelector('#rememberAccount');
  const accountMenu = document.querySelector('#accountMenu');
  const accountEmail = document.querySelector('#accountEmail');
  const logoutButton = document.querySelector('#logoutButton');
  const profileLink = document.querySelector('#profileLink');

  // OTP Form Elements
  const otpForm = modal?.querySelector('#otpForm');
  const otpEmailDisplay = modal?.querySelector('#otpEmailDisplay');
  const otpCodeInput = modal?.querySelector('#otpCodeInput');
  const otpError = modal?.querySelector('#otpError');
  const otpSubmitBtn = modal?.querySelector('#otpSubmitBtn');
  const otpResendBtn = modal?.querySelector('#otpResendBtn');
  const otpBackBtn = modal?.querySelector('#otpBackBtn');

  // Forgot Password Elements
  const openForgotPwdBtn = modal?.querySelector('#openForgotPwdBtn');
  const forgotPasswordForm = modal?.querySelector('#forgotPasswordForm');
  const forgotEmailInput = modal?.querySelector('#forgotEmailInput');
  const sendForgotCodeBtn = modal?.querySelector('#sendForgotCodeBtn');
  const forgotError1 = modal?.querySelector('#forgotError1');
  const forgotStep1 = modal?.querySelector('#forgotStep1');
  const forgotStep2 = modal?.querySelector('#forgotStep2');
  const forgotOtpInput = modal?.querySelector('#forgotOtpInput');
  const forgotNewPassword = modal?.querySelector('#forgotNewPassword');
  const forgotError2 = modal?.querySelector('#forgotError2');
  const submitResetPwdBtn = modal?.querySelector('#submitResetPwdBtn');
  const forgotBackBtn = modal?.querySelector('#forgotBackBtn');

  let isRegisterMode = false;
  let isOtpMode = false;
  let pendingEmail = '';
  let countdownTimer = null;
  let countdownSeconds = 60;

  if (!trigger || !modal || !form) return;

  const startOtpCountdown = () => {
    clearInterval(countdownTimer);
    countdownSeconds = 60;
    if (otpResendBtn) {
      otpResendBtn.disabled = true;
      otpResendBtn.innerHTML = `Gửi lại mã (<span id="otpCountdown">${countdownSeconds}</span>s)`;
    }
    countdownTimer = setInterval(() => {
      countdownSeconds--;
      const span = modal.querySelector('#otpCountdown');
      if (span) span.textContent = countdownSeconds;
      if (countdownSeconds <= 0) {
        clearInterval(countdownTimer);
        if (otpResendBtn) {
          otpResendBtn.disabled = false;
          otpResendBtn.textContent = 'Gửi lại mã OTP';
        }
      }
    }, 1000);
  };

  const switchToOtpMode = (email) => {
    isOtpMode = true;
    pendingEmail = email;
    form.hidden = true;
    if (authSwitchWrap) authSwitchWrap.hidden = true;
    if (oauthDivider) oauthDivider.hidden = true;
    if (googleLoginBtn) googleLoginBtn.hidden = true;
    if (forgotPasswordForm) forgotPasswordForm.hidden = true;
    if (otpForm) otpForm.hidden = false;

    if (title) title.textContent = 'Xác thực tài khoản';
    if (description) description.textContent = 'Nhập mã OTP gồm 6 chữ số để kích hoạt tài khoản của bạn.';
    if (otpEmailDisplay) otpEmailDisplay.textContent = email;
    if (otpError) otpError.textContent = '';
    if (otpCodeInput) {
      otpCodeInput.value = '';
      setTimeout(() => otpCodeInput.focus(), 150);
    }
    startOtpCountdown();
  };

  const switchToForgotMode = () => {
    isOtpMode = false;
    form.hidden = true;
    if (authSwitchWrap) authSwitchWrap.hidden = true;
    if (oauthDivider) oauthDivider.hidden = true;
    if (googleLoginBtn) googleLoginBtn.hidden = true;
    if (otpForm) otpForm.hidden = true;
    if (forgotPasswordForm) forgotPasswordForm.hidden = false;

    if (title) title.textContent = 'Đặt lại mật khẩu';
    if (description) description.textContent = 'Khôi phục quyền truy cập vào tài khoản học tập của bạn.';

    if (forgotStep1) forgotStep1.hidden = false;
    if (forgotStep2) forgotStep2.hidden = true;
    if (forgotError1) forgotError1.textContent = '';
    if (forgotError2) forgotError2.textContent = '';
    const emailVal = form.querySelector('#loginEmail')?.value.trim() || '';
    if (forgotEmailInput) {
      forgotEmailInput.value = emailVal;
      setTimeout(() => forgotEmailInput.focus(), 150);
    }
  };

  const exitOtpMode = () => {
    isOtpMode = false;
    clearInterval(countdownTimer);
    if (otpForm) otpForm.hidden = true;
    if (forgotPasswordForm) forgotPasswordForm.hidden = true;
    if (form) form.hidden = false;
    if (authSwitchWrap) authSwitchWrap.hidden = false;
    if (oauthDivider) oauthDivider.hidden = false;
    if (googleLoginBtn) googleLoginBtn.hidden = false;

    isRegisterMode = false;
    if (title) title.textContent = 'Chào mừng trở lại';
    if (description) description.textContent = 'Đăng nhập để tiếp tục hành trình học tiếng Trung.';
    if (submitButton) submitButton.textContent = 'Đăng nhập';
    if (authSwitchText) authSwitchText.textContent = 'Chưa có tài khoản?';
    if (authSwitch) authSwitch.textContent = 'Đăng ký ngay';
    if (confirmPasswordField) confirmPasswordField.hidden = true;
    if (errorMessage) errorMessage.textContent = '';
    if (otpError) otpError.textContent = '';
  };

  const closeModal = () => {
    modal.classList.remove('open');
    if (errorMessage) errorMessage.textContent = '';
    if (otpError) otpError.textContent = '';
    clearInterval(countdownTimer);
    exitOtpMode();
    form.reset();
    otpForm?.reset();
    forgotPasswordForm?.reset();
  };

  const updateTrigger = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    const isLoggedIn = Boolean(session);
    const label = 'Hồ sơ học viên';
    if (trigger.classList.contains('login-avatar')) {
      trigger.setAttribute('aria-label', label);
      trigger.setAttribute('title', label);
      const avatarUrl = localStorage.getItem('mandarinly_user_avatar') || session?.user?.user_metadata?.avatar_url;
      if (avatarUrl) {
        trigger.innerHTML = `<img src="${avatarUrl}" alt="Avatar" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`;
      } else {
        trigger.innerHTML = `<svg class="login-avatar-icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="3.5"></circle><path d="M5.5 20c.7-3.5 2.9-5.3 6.5-5.3s5.8 1.8 6.5 5.3"></path></svg>`;
      }
    } else {
      trigger.textContent = label;
    }
    if (accountMenu) accountMenu.hidden = true;
    if (accountEmail) accountEmail.textContent = session?.user?.email || 'Tài khoản';
    trigger.dataset.loggedIn = String(isLoggedIn);
  };

  window.addEventListener('profile-avatar-updated', (e) => {
    if (e.detail?.avatarUrl && trigger.classList.contains('login-avatar')) {
      trigger.innerHTML = `<img src="${e.detail.avatarUrl}" alt="Avatar" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`;
    }
  });

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

  trigger.addEventListener('click', (e) => {
    e.preventDefault();
    if (accountMenu) accountMenu.hidden = true;
    if (window.location.hash === '#profile') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      window.location.hash = '#profile';
    }
  });

  window.addEventListener('open-login-modal', () => {
    exitOtpMode();
    modal.classList.add('open');
    const emailInput = modal.querySelector('#loginEmail');
    if (emailInput) {
      emailInput.value = localStorage.getItem(REMEMBERED_EMAIL_KEY) || '';
      if (rememberAccount) rememberAccount.checked = Boolean(emailInput.value);
      emailInput.focus();
    }
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

  // Filter numeric input for OTP (chuẩn 6 chữ số)
  otpCodeInput?.addEventListener('input', (e) => {
    e.target.value = e.target.value.replace(/\D/g, '').slice(0, 6);
  });

  // Google OAuth Login handler
  googleLoginBtn?.addEventListener('click', async () => {
    try {
      googleLoginBtn.disabled = true;
      if (errorMessage) errorMessage.textContent = '';
      const redirectUrl = window.location.origin + window.location.pathname;
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectUrl
        }
      });
      if (error) throw error;
    } catch (err) {
      if (errorMessage) errorMessage.textContent = err.message || 'Không thể kết nối đến Google. Vui lòng thử lại.';
      googleLoginBtn.disabled = false;
    }
  });

  // Back from OTP to login
  otpBackBtn?.addEventListener('click', () => {
    exitOtpMode();
  });

  // Open Forgot Password mode
  openForgotPwdBtn?.addEventListener('click', (e) => {
    e.preventDefault();
    switchToForgotMode();
  });

  // Back from Forgot Password to login
  forgotBackBtn?.addEventListener('click', () => {
    exitOtpMode();
  });

  // Filter numeric input for Forgot Password OTP (6 digits)
  forgotOtpInput?.addEventListener('input', (e) => {
    e.target.value = e.target.value.replace(/\D/g, '').slice(0, 6);
  });

  // Send reset password OTP code
  sendForgotCodeBtn?.addEventListener('click', async () => {
    const email = forgotEmailInput?.value.trim() || '';
    if (!email || !email.includes('@')) {
      if (forgotError1) forgotError1.textContent = 'Vui lòng nhập địa chỉ email hợp lệ.';
      return;
    }
    if (forgotError1) forgotError1.textContent = '';
    sendForgotCodeBtn.disabled = true;
    sendForgotCodeBtn.textContent = 'Đang gửi mã...';

    try {
      const redirectUrl = window.location.origin + window.location.pathname;
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: redirectUrl
      });

      if (error) {
        if (forgotError1) forgotError1.textContent = error.message || 'Không thể gửi mã đặt lại mật khẩu.';
        return;
      }

      toast?.('Mã OTP đặt lại mật khẩu đã được gửi về email của bạn! 📩');
      if (forgotStep1) forgotStep1.hidden = true;
      if (forgotStep2) forgotStep2.hidden = false;
      setTimeout(() => forgotOtpInput?.focus(), 150);
    } catch (err) {
      if (forgotError1) forgotError1.textContent = err.message || 'Có lỗi xảy ra, vui lòng thử lại.';
    } finally {
      sendForgotCodeBtn.disabled = false;
      sendForgotCodeBtn.textContent = 'Gửi mã xác nhận';
    }
  });

  // Submit reset password with OTP + new password
  forgotPasswordForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = forgotEmailInput?.value.trim() || '';
    const token = forgotOtpInput?.value.trim() || '';
    const newPassword = forgotNewPassword?.value || '';

    if (!email || !email.includes('@')) {
      if (forgotError2) forgotError2.textContent = 'Địa chỉ email không hợp lệ.';
      return;
    }

    if (token.length !== 6) {
      if (forgotError2) forgotError2.textContent = 'Vui lòng nhập đầy đủ mã OTP 6 chữ số.';
      return;
    }

    if (newPassword.length < 6) {
      if (forgotError2) forgotError2.textContent = 'Mật khẩu mới phải có ít nhất 6 ký tự.';
      return;
    }

    if (submitResetPwdBtn) {
      submitResetPwdBtn.disabled = true;
      submitResetPwdBtn.textContent = 'Đang đặt lại mật khẩu...';
    }
    if (forgotError2) forgotError2.textContent = '';

    try {
      const { error: verifyError } = await supabase.auth.verifyOtp({
        email,
        token,
        type: 'recovery'
      });

      if (verifyError) {
        const msg = verifyError.message?.toLowerCase() || '';
        if (msg.includes('expired') || msg.includes('invalid') || msg.includes('token')) {
          forgotError2.textContent = 'Mã OTP không chính xác hoặc đã hết hạn. Hãy kiểm tra lại.';
        } else {
          forgotError2.textContent = verifyError.message || 'Mã xác thực không hợp lệ.';
        }
        return;
      }

      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (updateError) {
        forgotError2.textContent = updateError.message || 'Không thể cập nhật mật khẩu mới.';
        return;
      }

      closeModal();
      await updateTrigger();
      await onAuthChanged?.();
      toast?.('Đặt lại mật khẩu thành công! 🔑✨');
    } catch (err) {
      if (forgotError2) forgotError2.textContent = err.message || 'Có lỗi xảy ra, vui lòng thử lại.';
    } finally {
      if (submitResetPwdBtn) {
        submitResetPwdBtn.disabled = false;
        submitResetPwdBtn.textContent = 'Xác nhận đổi mật khẩu';
      }
    }
  });

  // Resend OTP handler
  otpResendBtn?.addEventListener('click', async () => {
    if (countdownSeconds > 0) return;
    otpResendBtn.disabled = true;
    otpResendBtn.textContent = 'Đang gửi lại mã...';
    if (otpError) otpError.textContent = '';

    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: pendingEmail
      });

      if (error) {
        if (otpError) otpError.textContent = error.message || 'Không thể gửi lại mã lúc này. Vui lòng thử lại sau.';
        otpResendBtn.disabled = false;
        otpResendBtn.textContent = 'Gửi lại mã OTP';
        return;
      }

      toast?.('Đã gửi lại mã OTP về email của bạn! 📩');
      startOtpCountdown();
    } catch (err) {
      if (otpError) otpError.textContent = err.message || 'Có lỗi xảy ra khi gửi lại mã.';
      otpResendBtn.disabled = false;
      otpResendBtn.textContent = 'Gửi lại mã OTP';
    }
  });

  // OTP Form Submission
  otpForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const token = otpCodeInput?.value.trim() || '';

    if (token.length !== 6) {
      if (otpError) otpError.textContent = 'Vui lòng nhập đầy đủ mã OTP gồm 6 chữ số.';
      return;
    }

    if (otpSubmitBtn) {
      otpSubmitBtn.disabled = true;
      otpSubmitBtn.textContent = 'Đang xác thực...';
    }
    if (otpError) otpError.textContent = '';

    try {
      const { data, error } = await supabase.auth.verifyOtp({
        email: pendingEmail,
        token,
        type: 'signup'
      });

      if (error) {
        const msg = error.message?.toLowerCase() || '';
        if (msg.includes('expired') || msg.includes('invalid') || msg.includes('token')) {
          otpError.textContent = 'Mã OTP không chính xác hoặc đã hết hạn. Hãy kiểm tra lại hoặc bấm "Gửi lại mã".';
        } else {
          otpError.textContent = error.message || 'Mã xác thực không hợp lệ. Vui lòng thử lại.';
        }
        return;
      }

      clearInterval(countdownTimer);
      closeModal();

      let profile = null;
      if (data?.user) {
        try {
          profile = await getCurrentProfile(data.user.id);
        } catch {
          profile = null;
        }
      }
      const profileName = profile?.full_name || pendingEmail.split('@')[0];
      const profileNameElement = document.querySelector('.profile-mini strong');
      if (profileNameElement) profileNameElement.textContent = profileName;

      await updateTrigger();
      await onAuthChanged?.();
      toast?.('Kích hoạt tài khoản thành công! Chào mừng bạn ✦');
    } catch (err) {
      if (otpError) otpError.textContent = err.message || 'Lỗi xác thực mã OTP. Vui lòng thử lại.';
    } finally {
      if (otpSubmitBtn) {
        otpSubmitBtn.disabled = false;
        otpSubmitBtn.textContent = 'Xác nhận mã OTP';
      }
    }
  });

  // Main Login / Register form submission
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

      if (result.error) {
        // Nếu đăng nhập báo Email not confirmed -> Chuyển sang OTP mode hoặc cung cấp link kích hoạt
        const errMsg = result.error.message?.toLowerCase() || '';
        if (errMsg.includes('email not confirmed')) {
          errorMessage.innerHTML = `
            Email chưa được xác nhận kích hoạt.<br>
            <button type="button" class="login-otp-link" id="loginOtpLink">👉 Nhập mã OTP kích hoạt ngay</button>
          `;
          modal.querySelector('#loginOtpLink')?.addEventListener('click', () => {
            switchToOtpMode(email);
          });
          return;
        }
        throw result.error;
      }

      // Khi đăng ký mà chưa có session -> Cần xác thực email qua OTP
      if (isRegisterMode && !result.data.session) {
        switchToOtpMode(email);
        toast?.('Mã OTP xác thực đã được gửi về email của bạn! 📩');
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
      const msg = error.message?.toLowerCase() || '';
      if (msg.includes('invalid login credentials')) {
        errorMessage.textContent = 'Email hoặc mật khẩu không chính xác.';
      } else if (msg.includes('user already registered')) {
        errorMessage.textContent = 'Email này đã được đăng ký. Vui lòng chuyển sang Đăng nhập.';
      } else {
        errorMessage.textContent = error.message || 'Không thể thực hiện yêu cầu. Vui lòng thử lại.';
      }
    } finally {
      submitButton.disabled = false;
    }
  });

  // Tự động lắng nghe trạng thái auth nếu user xác nhận qua đường link email ở tab khác
  supabase.auth.onAuthStateChange(async (event, session) => {
    if (event === 'PASSWORD_RECOVERY') {
      if (modal.classList.contains('open')) {
        closeModal();
      }
      await updateTrigger();
      await onAuthChanged?.();
      window.location.hash = '#profile';
      toast?.('Xác thực thành công! Hãy nhập mật khẩu mới của bạn bên dưới.');
      setTimeout(() => {
        const pwdCard = document.querySelector('.profile-security-card');
        const newPwdInput = document.querySelector('#newPasswordInput');
        pwdCard?.scrollIntoView({ behavior: 'smooth' });
        newPwdInput?.focus();
      }, 600);
    } else if (event === 'SIGNED_IN') {
      if (modal.classList.contains('open')) {
        closeModal();
      }
      await updateTrigger();
      await onAuthChanged?.();
    } else if (event === 'SIGNED_OUT') {
      await updateTrigger();
      await onAuthChanged?.();
    }
  });

  updateTrigger();
}
