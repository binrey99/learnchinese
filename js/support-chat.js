import { supabase } from './supabase.js';

const STORAGE_MESSAGES_KEY = 'mandarinly_support_messages_v1';
const STORAGE_SESSION_KEY = 'mandarinly_support_session_id';
const STORAGE_GUEST_NAME_KEY = 'mandarinly_support_guest_name';
const STORAGE_READ_COUNT_KEY = 'mandarinly_support_read_ts';
const STORAGE_EXTRA_ADMINS_KEY = 'mandarinly_extra_admin_emails_v1';

/**
 * Danh sách Email Quản trị viên (Admin) mặc định của hệ thống.
 * Chỉ khi đăng nhập bằng email trong danh sách này (hoặc có cột role = 'admin' trong bảng profiles trên Supabase)
 * thì nút "🛡️ Quản lý" và trang #support-admin mới được hiển thị và mở khóa.
 */
export const DEFAULT_ADMIN_EMAILS = [
  'binhnguyen28hn@gmail.com',
  'binhnguyen2810zzz@gmail.com',
  'binhnguyen2810zzzzzz@gmail.com',
  'nvbghostrider99@gmail.com'
];

let realtimeChannel = null;
let currentUserInfo = null;
let isWidgetOpen = false;
let supabaseTableAvailable = true;
let globalToast = null;
let activeAdminSessionId = null;
let adminFilterMode = 'all'; // 'all' | 'unread'
let adminSearchQuery = '';

function escapeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatMessageHtml(rawText = '') {
  return escapeHtml(rawText)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n/g, '<br/>');
}

function getExtraAdminEmails() {
  try {
    const raw = localStorage.getItem(STORAGE_EXTRA_ADMINS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.map((e) => String(e).trim().toLowerCase()).filter(Boolean) : [];
  } catch (_) {
    return [];
  }
}

export function getAllAdminEmails() {
  const set = new Set([
    ...DEFAULT_ADMIN_EMAILS.map((e) => e.toLowerCase()),
    ...getExtraAdminEmails()
  ]);
  return Array.from(set);
}

function addExtraAdminEmail(email) {
  const clean = String(email || '').trim().toLowerCase();
  if (!clean || !clean.includes('@')) return false;
  const list = getExtraAdminEmails();
  if (!list.includes(clean)) {
    list.push(clean);
    localStorage.setItem(STORAGE_EXTRA_ADMINS_KEY, JSON.stringify(list));
  }
  return true;
}

/**
 * Kiểm tra tài khoản đang đăng nhập có phải Quản trị viên (Admin) hay không:
 * 1. Email nằm trong danh sách ADMIN_EMAILS
 * 2. Hoặc user_metadata.role === 'admin'
 * 3. Hoặc bảng public.profiles có cột role === 'admin'
 */
export async function checkIsAdminUser(user) {
  if (!user) return false;
  const email = String(user.email || '').trim().toLowerCase();
  if (email && getAllAdminEmails().includes(email)) {
    return true;
  }
  if (user.user_metadata?.role === 'admin' || user.app_metadata?.role === 'admin') {
    return true;
  }
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle();
    if (!error && data?.role === 'admin') {
      return true;
    }
  } catch (_) {}
  return false;
}

function formatChatTime(isoString) {
  if (!isoString) return 'Vừa xong';
  const d = new Date(isoString);
  if (Number.isNaN(d.getTime())) return 'Vừa xong';
  const now = new Date();
  const isToday =
    d.getDate() === now.getDate() &&
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear();

  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  if (isToday) return `${hh}:${mm}`;
  const dd = String(d.getDate()).padStart(2, '0');
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  return `${hh}:${mm} ${dd}/${mo}`;
}

function playNotificationPing() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;
    [587.33, 880].forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.09);
      gain.gain.setValueAtTime(0.12, now + idx * 0.09);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.09 + 0.18);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + idx * 0.09);
      osc.stop(now + idx * 0.09 + 0.18);
    });
  } catch (_) {}
}

function getOrCreateGuestSessionId() {
  let sid = localStorage.getItem(STORAGE_SESSION_KEY);
  if (!sid) {
    const rand = Math.random().toString(36).substring(2, 8).toUpperCase();
    sid = `guest_${rand}`;
    localStorage.setItem(STORAGE_SESSION_KEY, sid);
  }
  return sid;
}

function syncAdminDomVisibility(isAdmin) {
  const adminHeaderBtn = document.querySelector('#openSupportAdminBtn');
  if (adminHeaderBtn) {
    adminHeaderBtn.hidden = !isAdmin;
  }
  const adminMenuLink = document.querySelector('#supportAdminMenuLink');
  if (adminMenuLink) {
    adminMenuLink.hidden = !isAdmin;
  }
}

export async function resolveCurrentChatUser() {
  try {
    const { data } = await supabase.auth.getUser();
    const user = data?.user;
    if (user) {
      const meta = user.user_metadata || {};
      const emailPrefix = user.email ? user.email.split('@')[0] : 'Học viên';
      const customName = localStorage.getItem(`mandarinly_name_${user.id}`) || meta.full_name || emailPrefix;
      const customAvatar = localStorage.getItem(`mandarinly_avatar_${user.id}`) || meta.avatar_url || 'picture/main_picture.png';
      const isAdmin = await checkIsAdminUser(user);

      currentUserInfo = {
        session_id: `user_${user.id}`,
        user_id: user.id,
        user_name: customName,
        user_email: user.email || '',
        user_avatar: customAvatar,
        is_logged_in: true,
        is_admin: isAdmin
      };
      syncAdminDomVisibility(isAdmin);
      return currentUserInfo;
    }
  } catch (_) {}

  const guestId = getOrCreateGuestSessionId();
  const shortCode = guestId.replace('guest_', '');
  const savedGuestName = localStorage.getItem(STORAGE_GUEST_NAME_KEY) || `Khách #${shortCode}`;
  currentUserInfo = {
    session_id: guestId,
    user_id: null,
    user_name: savedGuestName,
    user_email: 'Chưa đăng nhập',
    user_avatar: 'picture/main_picture.png',
    is_logged_in: false,
    is_admin: false
  };
  syncAdminDomVisibility(false);
  return currentUserInfo;
}

function getLocalMessages() {
  try {
    const raw = localStorage.getItem(STORAGE_MESSAGES_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (_) {
    return [];
  }
}

function saveLocalMessages(list) {
  try {
    const trimmed = list.slice(-500);
    localStorage.setItem(STORAGE_MESSAGES_KEY, JSON.stringify(trimmed));
  } catch (_) {}
}

function upsertMessageToLocal(msg) {
  if (!msg || !msg.id) return;
  const list = getLocalMessages();
  const idx = list.findIndex((item) => item.id === msg.id);
  if (idx >= 0) {
    list[idx] = { ...list[idx], ...msg };
  } else {
    list.push(msg);
  }
  list.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  saveLocalMessages(list);
}

/**
 * Tải tin nhắn từ Supabase (nếu bảng support_messages đã tạo) kết hợp với LocalStorage
 */
export async function fetchSupportMessages(sessionId = null) {
  const localMsgs = getLocalMessages();

  if (supabaseTableAvailable) {
    try {
      let query = supabase
        .from('support_messages')
        .select('*')
        .order('created_at', { ascending: true })
        .limit(300);

      if (sessionId) {
        query = query.eq('session_id', sessionId);
      }

      const { data, error } = await query;
      if (error) {
        if (error.code === '42P01' || String(error.message || '').includes('support_messages')) {
          supabaseTableAvailable = false;
        }
      } else if (Array.isArray(data)) {
        const map = new Map();
        localMsgs.forEach((m) => map.set(m.id, m));
        data.forEach((m) => map.set(m.id, m));
        const merged = Array.from(map.values()).sort(
          (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        );
        saveLocalMessages(merged);
        return sessionId ? merged.filter((m) => m.session_id === sessionId) : merged;
      }
    } catch (_) {}
  }

  return sessionId ? localMsgs.filter((m) => m.session_id === sessionId) : localMsgs;
}

/**
 * Gửi một tin nhắn mới (từ Học viên, Admin hoặc Trợ lý LuLu)
 */
export async function sendSupportMessage({
  sessionId,
  senderRole = 'user',
  content,
  userInfo = null
}) {
  const cleanText = String(content || '').trim();
  if (!cleanText) return null;

  const info = userInfo || currentUserInfo || (await resolveCurrentChatUser());
  const targetSessionId = sessionId || info.session_id;

  const msgObj = {
    id: (typeof crypto !== 'undefined' && crypto.randomUUID)
      ? crypto.randomUUID()
      : `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    session_id: targetSessionId,
    user_id: info.user_id || null,
    sender_role: senderRole,
    user_name: info.user_name || 'Học viên',
    user_email: info.user_email || '',
    user_avatar: info.user_avatar || 'picture/main_picture.png',
    content: cleanText,
    is_read: senderRole !== 'user',
    created_at: new Date().toISOString()
  };

  upsertMessageToLocal(msgObj);

  if (supabaseTableAvailable) {
    try {
      const { error } = await supabase.from('support_messages').insert({
        id: msgObj.id,
        session_id: msgObj.session_id,
        user_id: msgObj.user_id,
        sender_role: msgObj.sender_role,
        user_name: msgObj.user_name,
        user_email: msgObj.user_email,
        user_avatar: msgObj.user_avatar,
        content: msgObj.content,
        is_read: msgObj.is_read,
        created_at: msgObj.created_at
      });
      if (error && (error.code === '42P01' || String(error.message || '').includes('support_messages'))) {
        supabaseTableAvailable = false;
      }
    } catch (_) {}
  }

  if (realtimeChannel) {
    try {
      realtimeChannel.send({
        type: 'broadcast',
        event: 'new_support_msg',
        payload: msgObj
      });
    } catch (_) {}
  }

  return msgObj;
}

const QUICK_FAQS = [
  {
    label: '🧠 Cách học Ôn tập SRS',
    question: 'Làm sao để sử dụng Ôn tập Ngắt quãng SRS và Sổ tay từ hay sai?',
    answer:
      'Chào bạn! 🌷 Bạn vào mục **Từ vựng & Thẻ** sẽ thấy 2 tab mới:\n• **Ôn tập SRS**: Lật thẻ và tự chấm mức độ nhớ (Quên / Khó / Tốt / Dễ), thuật toán SM-2 sẽ tự tính ngày ôn lại.\n• **Sổ Tay Từ Hay Sai**: Tự động lưu các từ bạn trả lời sai khi chơi Game, Thi đấu hoặc Luyện tập để bạn ôn riêng!'
  },
  {
    label: '🔊 Lỗi âm thanh phát âm',
    question: 'Mình bấm vào loa nhưng không nghe được phát âm tiếng Trung?',
    answer:
      'Nếu không nghe được tiếng, bạn hãy kiểm tra:\n1. Trình duyệt có đang bị tắt tiếng (Mute tab) không.\n2. Trên điện thoại iOS/Android, hãy tắt chế độ Im lặng hoặc bấm trực tiếp vào nút 🔊 một lần nữa để kích hoạt giọng đọc Youdao dự phòng nhé!'
  },
  {
    label: '⚔️ Thi đấu & Nuôi LuLu',
    question: 'Làm sao để nhận thức ăn nuôi bé Capybara LuLu?',
    answer:
      'Mỗi khi bạn **Thuộc 3 từ vựng mới**, hoàn thành **Trò chơi**, hoặc chiến thắng trong **Thi đấu 1v1**, hệ thống sẽ thưởng điểm kinh nghiệm và thức ăn (Bánh bao, Cam, Táo, Dưa hấu) để bạn chăm sóc bé LuLu nhé! 🍊🥟'
  },
  {
    label: '👨‍💻 Gặp Admin hỗ trợ',
    question: 'Mình cần liên hệ trực tiếp với Quản trị viên (Admin) trang web.',
    answer:
      'Bạn hãy gõ nội dung cần hỗ trợ vào ô chat bên dưới và bấm **Gửi** nhé! 💬 Tin nhắn của bạn sẽ được chuyển thẳng tới **Hộp thư Quản trị viên (Admin)** để phản hồi trực tiếp tại đây.'
  }
];

function getUnreadAdminRepliesCount(messages, sessionId) {
  const lastReadTs = Number(localStorage.getItem(`${STORAGE_READ_COUNT_KEY}_${sessionId}`) || 0);
  return messages.filter(
    (m) =>
      m.session_id === sessionId &&
      m.sender_role === 'admin' &&
      new Date(m.created_at).getTime() > lastReadTs
  ).length;
}

function markSessionAdminRepliesRead(sessionId) {
  if (!sessionId) return;
  localStorage.setItem(`${STORAGE_READ_COUNT_KEY}_${sessionId}`, String(Date.now()));
}

/**
 * Khởi tạo Khung Chat Hỗ Trợ nổi ở góc dưới bên phải màn hình
 */
export async function initSupportChatWidget({ toast } = {}) {
  globalToast = toast;
  await resolveCurrentChatUser();

  let root = document.querySelector('#supportChatWidgetRoot');
  if (!root) {
    root = document.createElement('div');
    root.id = 'supportChatWidgetRoot';
    root.className = 'support-chat-widget-root';
    document.body.appendChild(root);
  }

  root.innerHTML = `
    <button type="button" class="support-chat-launcher" id="supportChatLauncher" aria-label="Mở khung chat hỗ trợ trực tuyến">
      <span class="support-launcher-avatar">
        <img src="picture/main_picture.png" alt="Hỗ trợ LuLu" />
        <i class="support-online-dot"></i>
      </span>
      <span class="support-launcher-text">
        <strong>Chat Hỗ Trợ</strong>
        <small>LuLu & Admin 24/7</small>
      </span>
      <span class="support-unread-badge" id="supportUnreadBadge" hidden>0</span>
    </button>

    <section class="support-chat-window" id="supportChatWindow" hidden aria-label="Hộp thoại hỗ trợ trực tuyến">
      <header class="support-chat-header">
        <div class="support-header-brand">
          <div class="support-header-avatar">
            <img src="picture/main_picture.png" alt="Admin LuLu Chinese" />
            <i class="support-online-dot"></i>
          </div>
          <div>
            <h3>Hỗ trợ LuLu Chinese</h3>
            <p><span class="support-status-pulse"></span> Quản trị viên trực tuyến</p>
          </div>
        </div>
        <div class="support-header-actions">
          <a
            href="#support-admin"
            class="support-admin-shortcut"
            id="openSupportAdminBtn"
            hidden
            title="Mở trang Quản lý Tin nhắn (Chỉ hiển thị cho tài khoản Admin)"
          >
            🛡️ Quản lý
          </a>
          <button type="button" class="support-close-btn" id="supportChatCloseBtn" aria-label="Thu gọn khung chat">✕</button>
        </div>
      </header>

      <div class="support-guest-bar" id="supportGuestBar" hidden>
        <span>Tên của bạn:</span>
        <input type="text" id="supportGuestNameInput" maxlength="30" placeholder="Nhập tên để Admin tiện xưng hô..." />
      </div>

      <div class="support-chat-messages" id="supportChatMessages"></div>

      <div class="support-quick-faqs" id="supportQuickFaqs">
        ${QUICK_FAQS.map(
          (item, index) => `
          <button type="button" class="support-faq-chip" data-faq-index="${index}">
            ${escapeHtml(item.label)}
          </button>
        `
        ).join('')}
      </div>

      <form class="support-chat-form" id="supportChatForm">
        <input
          type="text"
          id="supportChatInput"
          placeholder="Nhập câu hỏi hoặc nhắn cho Admin..."
          autocomplete="off"
          maxlength="500"
        />
        <button type="submit" class="support-send-btn" aria-label="Gửi tin nhắn">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round">
            <line x1="22" y1="2" x2="11" y2="13"></line>
            <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
          </svg>
        </button>
      </form>
    </section>
  `;

  const launcherBtn = root.querySelector('#supportChatLauncher');
  const chatWindow = root.querySelector('#supportChatWindow');
  const closeBtn = root.querySelector('#supportChatCloseBtn');
  const messagesBox = root.querySelector('#supportChatMessages');
  const chatForm = root.querySelector('#supportChatForm');
  const chatInput = root.querySelector('#supportChatInput');
  const unreadBadge = root.querySelector('#supportUnreadBadge');
  const guestBar = root.querySelector('#supportGuestBar');
  const guestNameInput = root.querySelector('#supportGuestNameInput');
  const openAdminBtn = root.querySelector('#openSupportAdminBtn');

  const updateGuestBar = () => {
    if (!currentUserInfo) return;
    if (!currentUserInfo.is_logged_in) {
      guestBar.hidden = false;
      guestNameInput.value = currentUserInfo.user_name || '';
    } else {
      guestBar.hidden = true;
    }
  };

  guestNameInput?.addEventListener('change', () => {
    const val = guestNameInput.value.trim();
    if (val && currentUserInfo && !currentUserInfo.is_logged_in) {
      currentUserInfo.user_name = val;
      localStorage.setItem(STORAGE_GUEST_NAME_KEY, val);
    }
  });

  const renderUserMessages = async () => {
    await resolveCurrentChatUser();
    updateGuestBar();

    const sessionMsgs = await fetchSupportMessages(currentUserInfo.session_id);
    let badgeCount = getUnreadAdminRepliesCount(sessionMsgs, currentUserInfo.session_id);

    // Nếu đang đăng nhập bằng tài khoản Admin, hiển thị số cuộc hội thoại học viên đang chờ Admin trả lời
    if (currentUserInfo.is_admin) {
      const allMsgs = await fetchSupportMessages(null);
      const waitingThreads = buildConversationThreads(allMsgs).filter((t) => t.needs_reply).length;
      if (openAdminBtn) {
        openAdminBtn.hidden = false;
        openAdminBtn.innerHTML = waitingThreads > 0 ? `🛡️ Quản lý (${waitingThreads})` : `🛡️ Quản lý`;
      }
      if (!isWidgetOpen && waitingThreads > 0) {
        badgeCount = waitingThreads;
      }
    } else if (openAdminBtn) {
      openAdminBtn.hidden = true;
    }

    if (isWidgetOpen && !currentUserInfo.is_admin) {
      markSessionAdminRepliesRead(currentUserInfo.session_id);
      unreadBadge.hidden = true;
    } else if (badgeCount > 0) {
      unreadBadge.textContent = badgeCount > 9 ? '9+' : String(badgeCount);
      unreadBadge.hidden = false;
    } else {
      unreadBadge.hidden = true;
    }

    const welcomeHtml = `
      <div class="support-msg-row support-msg-bot">
        <img class="support-msg-avatar" src="picture/main_picture.png" alt="LuLu" />
        <div class="support-msg-bubble">
          <div class="support-msg-sender">Trợ lý LuLu & Admin</div>
          <div class="support-msg-text">
            Xin chào <strong>${escapeHtml(currentUserInfo.user_name)}</strong>! 👋<br/>
            Bạn cần giải đáp thắc mắc hay góp ý tính năng cho <strong>LuLu Chinese</strong>? Hãy chọn câu hỏi nhanh bên dưới hoặc nhắn trực tiếp cho <strong>Quản trị viên</strong> nhé!
          </div>
        </div>
      </div>
    `;

    const listHtml = sessionMsgs
      .map((msg) => {
        const isMe = msg.sender_role === 'user';
        const isAdmin = msg.sender_role === 'admin';
        const rowClass = isMe ? 'support-msg-user' : isAdmin ? 'support-msg-admin' : 'support-msg-bot';
        const senderLabel = isMe
          ? 'Bạn'
          : isAdmin
          ? '🛡️ Quản trị viên (Admin)'
          : '🤖 Trợ lý LuLu';

        return `
          <div class="support-msg-row ${rowClass}">
            ${!isMe ? `<img class="support-msg-avatar" src="picture/main_picture.png" alt="Admin" />` : ''}
            <div class="support-msg-bubble">
              <div class="support-msg-sender">${senderLabel} <span>• ${formatChatTime(msg.created_at)}</span></div>
              <div class="support-msg-text">${formatMessageHtml(msg.content)}</div>
            </div>
          </div>
        `;
      })
      .join('');

    messagesBox.innerHTML = welcomeHtml + listHtml;
    messagesBox.scrollTop = messagesBox.scrollHeight;
  };

  const toggleWidget = (forceState) => {
    isWidgetOpen = typeof forceState === 'boolean' ? forceState : !isWidgetOpen;
    chatWindow.hidden = !isWidgetOpen;
    launcherBtn.classList.toggle('is-open', isWidgetOpen);
    if (isWidgetOpen) {
      markSessionAdminRepliesRead(currentUserInfo?.session_id);
      unreadBadge.hidden = true;
      renderUserMessages();
      setTimeout(() => chatInput?.focus(), 80);
    }
  };

  launcherBtn.addEventListener('click', () => toggleWidget());
  closeBtn.addEventListener('click', () => toggleWidget(false));
  openAdminBtn?.addEventListener('click', () => {
    toggleWidget(false);
  });

  root.querySelectorAll('[data-faq-index]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const idx = Number(btn.dataset.faqIndex);
      const faq = QUICK_FAQS[idx];
      if (!faq) return;

      await sendSupportMessage({
        sessionId: currentUserInfo.session_id,
        senderRole: 'user',
        content: faq.question,
        userInfo: currentUserInfo
      });
      await renderUserMessages();

      setTimeout(async () => {
        await sendSupportMessage({
          sessionId: currentUserInfo.session_id,
          senderRole: 'bot',
          content: faq.answer,
          userInfo: currentUserInfo
        });
        await renderUserMessages();
        window.dispatchEvent(new CustomEvent('support-messages-updated'));
      }, 350);
    });
  });

  chatForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const text = chatInput.value.trim();
    if (!text) return;
    chatInput.value = '';

    if (!currentUserInfo.is_logged_in && guestNameInput?.value.trim()) {
      currentUserInfo.user_name = guestNameInput.value.trim();
      localStorage.setItem(STORAGE_GUEST_NAME_KEY, currentUserInfo.user_name);
    }

    const existingMsgs = await fetchSupportMessages(currentUserInfo.session_id);
    const hadUserMsgBefore = existingMsgs.some((m) => m.sender_role === 'user');

    await sendSupportMessage({
      sessionId: currentUserInfo.session_id,
      senderRole: 'user',
      content: text,
      userInfo: currentUserInfo
    });

    await renderUserMessages();
    window.dispatchEvent(new CustomEvent('support-messages-updated'));

    if (!hadUserMsgBefore) {
      setTimeout(async () => {
        await sendSupportMessage({
          sessionId: currentUserInfo.session_id,
          senderRole: 'bot',
          content:
            '✅ Tin nhắn của bạn đã được gửi tới **Hộp thư Quản trị viên (Admin)**! Quản lý trang web sẽ phản hồi bạn ngay tại khung chat này nhé.',
          userInfo: currentUserInfo
        });
        await renderUserMessages();
        window.dispatchEvent(new CustomEvent('support-messages-updated'));
      }, 500);
    }
  });

  setupSupportRealtime(() => {
    renderUserMessages();
    window.dispatchEvent(new CustomEvent('support-messages-updated'));
  });

  window.addEventListener('auth-changed', () => {
    renderUserMessages();
  });

  window.addEventListener('storage', (e) => {
    if (e.key === STORAGE_MESSAGES_KEY) {
      renderUserMessages();
      window.dispatchEvent(new CustomEvent('support-messages-updated'));
    }
  });

  renderUserMessages();
}

function setupSupportRealtime(onMessageReceived) {
  if (realtimeChannel) return;

  try {
    realtimeChannel = supabase.channel('realtime:support_chat', {
      config: { broadcast: { self: false } }
    });

    realtimeChannel
      .on('broadcast', { event: 'new_support_msg' }, (payload) => {
        const msg = payload?.payload;
        if (!msg || !msg.id) return;
        upsertMessageToLocal(msg);

        if (
          (currentUserInfo && msg.session_id === currentUserInfo.session_id && msg.sender_role === 'admin') ||
          (currentUserInfo?.is_admin && msg.sender_role === 'user')
        ) {
          playNotificationPing();
          if (msg.sender_role === 'admin' && !isWidgetOpen) {
            globalToast?.('💬 Quản trị viên vừa trả lời tin nhắn của bạn!');
          } else if (currentUserInfo?.is_admin && msg.sender_role === 'user') {
            globalToast?.(`📩 Học viên ${msg.user_name || ''} vừa gửi tin nhắn hỗ trợ!`);
          }
        }

        onMessageReceived?.(msg);
      })
      .subscribe();
  } catch (err) {
    console.warn('[SupportChat] Không thể kết nối kênh realtime:', err);
  }
}

function buildConversationThreads(allMessages) {
  const threadMap = new Map();

  allMessages.forEach((msg) => {
    const sid = msg.session_id || 'unknown';
    if (!threadMap.has(sid)) {
      threadMap.set(sid, {
        session_id: sid,
        user_id: msg.user_id || null,
        user_name: msg.user_name || 'Học viên',
        user_email: msg.user_email || '',
        user_avatar: msg.user_avatar || 'picture/main_picture.png',
        messages: [],
        last_message: null,
        unread_user_count: 0
      });
    }

    const thread = threadMap.get(sid);
    if (msg.sender_role === 'user') {
      if (msg.user_name) thread.user_name = msg.user_name;
      if (msg.user_email) thread.user_email = msg.user_email;
      if (msg.user_avatar) thread.user_avatar = msg.user_avatar;
    }

    thread.messages.push(msg);
    thread.last_message = msg;
  });

  const threads = Array.from(threadMap.values()).map((thread) => {
    thread.messages.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    let lastAdminReplyTime = 0;
    thread.messages.forEach((m) => {
      if (m.sender_role === 'admin') {
        lastAdminReplyTime = Math.max(lastAdminReplyTime, new Date(m.created_at).getTime());
      }
    });
    const unreadFromUser = thread.messages.filter(
      (m) => m.sender_role === 'user' && new Date(m.created_at).getTime() > lastAdminReplyTime
    ).length;

    thread.unread_user_count = unreadFromUser;
    thread.needs_reply = unreadFromUser > 0;
    return thread;
  });

  threads.sort((a, b) => {
    const tA = new Date(a.last_message?.created_at || 0).getTime();
    const tB = new Date(b.last_message?.created_at || 0).getTime();
    return tB - tA;
  });

  return threads;
}

const ADMIN_QUICK_REPLIES = [
  'Chào bạn! Mình là Admin của LuLu Chinese, mình có thể giúp gì cho bạn ạ? 🌸',
  'Cảm ơn bạn đã báo lỗi! Admin đã kiểm tra và khắc phục xong, bạn bấm Ctrl + F5 để tải lại trang nhé.',
  'Cảm ơn góp ý rất hay của bạn! Đội ngũ LuLu Chinese sẽ cập nhật thêm trong bản tới nhé ❤️',
  'Bạn nhớ đăng nhập tài khoản để hệ thống đồng bộ điểm số, chuỗi Streak và từ vựng lên đám mây nhé!'
];

/**
 * Trang Quản lý Hỗ trợ dành riêng cho Quản trị viên (#support-admin)
 * Sẽ kiểm tra quyền Role = 'admin' trước khi cho phép truy cập!
 */
export async function initSupportAdminPage({ toast } = {}) {
  const container = document.querySelector('[data-support-admin]');
  if (!container) return;

  container.innerHTML = `<div class="panel" style="padding: 32px; text-align: center;">Đang kiểm tra quyền Quản trị viên (Admin)...</div>`;

  const userInfo = await resolveCurrentChatUser();

  // CHẶN NGƯỜI DÙNG THƯỜNG / CHƯA ĐĂNG NHẬP TRUY CẬP TRANG QUẢN LÝ
  if (!userInfo.is_admin) {
    container.innerHTML = `
      <div class="panel support-admin-denied" style="max-width: 560px; margin: 40px auto; padding: 36px 28px; text-align: center; border-radius: 24px; border: 1.5px solid #fecaca; background: linear-gradient(135deg, #fff1f2 0%, #ffffff 100%);">
        <div style="font-size: 48px; margin-bottom: 12px;">🔒</div>
        <h2 style="margin: 0 0 8px; color: #991b1b; font-size: 22px; font-weight: 800;">Khu vực dành riêng cho Quản trị viên</h2>
        <p style="color: #475569; font-size: 14px; line-height: 1.6; margin: 0 0 20px;">
          ${
            userInfo.is_logged_in
              ? `Tài khoản hiện tại (<strong>${escapeHtml(userInfo.user_email)}</strong>) đang ở vai trò <strong>Học viên</strong> nên không có quyền truy cập Trung tâm Quản lý Hỗ trợ.`
              : `Bạn chưa đăng nhập. Vui lòng đăng nhập bằng <strong>Tài khoản Quản lý (Admin)</strong> để xem và trả lời tin nhắn của học viên.`
          }
        </p>
        <div style="display: flex; gap: 12px; justify-content: center; flex-wrap: wrap;">
          ${
            !userInfo.is_logged_in
              ? `<button type="button" class="primary-button" id="adminDeniedLoginBtn">🔑 Đăng nhập tài khoản Admin</button>`
              : ''
          }
          <a href="#dashboard" class="srs-banner-btn secondary" style="text-decoration: none;">← Quay về Trang chủ</a>
        </div>
      </div>
    `;

    container.querySelector('#adminDeniedLoginBtn')?.addEventListener('click', () => {
      window.dispatchEvent(new CustomEvent('open-login-modal'));
    });
    return;
  }

  container.innerHTML = `
    <div class="support-admin-shell">
      <div class="support-admin-topbar">
        <div>
          <span class="support-admin-kicker">🛡️ TRUNG TÂM QUẢN TRỊ VIÊN • XÁC THỰC: ${escapeHtml(userInfo.user_email)}</span>
          <h2>Quản lý Tin nhắn & Hỗ trợ Học viên</h2>
          <p>Bạn đang đăng nhập với quyền <strong>Admin</strong>. Mọi tin nhắn học viên gửi từ khung Chat Hỗ Trợ sẽ hiển thị tại đây theo thời gian thực.</p>
        </div>
        <div class="support-admin-stats" id="supportAdminStats"></div>
      </div>

      <div class="panel" style="padding: 14px 20px; border-radius: 18px; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px; background: #f8fafc;">
        <div style="font-size: 13px; color: #334155;">
          <strong>👑 Danh sách Email có quyền Quản lý (Admin):</strong>
          <span id="adminEmailBadgesList" style="display: inline-flex; gap: 6px; flex-wrap: wrap; margin-left: 8px;"></span>
        </div>
        <form id="addAdminEmailForm" style="display: flex; gap: 8px; align-items: center;">
          <input
            type="email"
            id="newAdminEmailInput"
            placeholder="Thêm email quản lý mới..."
            style="border: 1.5px solid #cbd5e1; border-radius: 10px; padding: 6px 12px; font-size: 12.5px; font-family: inherit;"
          />
          <button type="submit" class="srs-banner-btn primary" style="padding: 7px 12px; font-size: 12px;">+ Cấp quyền Admin</button>
        </form>
      </div>

      <div class="support-admin-workspace">
        <aside class="support-admin-sidebar">
          <div class="support-admin-Controls">
            <input
              type="search"
              id="adminThreadSearch"
              class="support-admin-search"
              placeholder="🔍 Tìm theo tên, email hoặc nội dung..."
            />
            <div class="support-admin-filter-tabs">
              <button type="button" class="support-filter-tab active" data-admin-filter="all">Tất cả</button>
              <button type="button" class="support-filter-tab" data-admin-filter="unread">Chờ phản hồi</button>
              <button type="button" class="support-refresh-btn" id="adminRefreshThreadsBtn" title="Làm mới danh sách">↻</button>
            </div>
          </div>
          <div class="support-thread-list" id="supportAdminThreadList"></div>
        </aside>

        <section class="support-admin-chatpane" id="supportAdminChatPane">
          <div class="support-admin-empty">
            <img src="picture/main_picture.png" alt="Chọn hội thoại" />
            <h3>Chọn một cuộc trò chuyện bên trái</h3>
            <p>Khi người dùng nhắn tin ở góc dưới phải trang web, cuộc trò chuyện của họ sẽ xuất hiện ở danh sách bên trái để bạn bấm vào trả lời.</p>
          </div>
        </section>
      </div>
    </div>
  `;

  const statsEl = container.querySelector('#supportAdminStats');
  const threadListEl = container.querySelector('#supportAdminThreadList');
  const chatPaneEl = container.querySelector('#supportAdminChatPane');
  const searchInput = container.querySelector('#adminThreadSearch');
  const refreshBtn = container.querySelector('#adminRefreshThreadsBtn');
  const adminEmailBadgesEl = container.querySelector('#adminEmailBadgesList');
  const addAdminForm = container.querySelector('#addAdminEmailForm');
  const newAdminEmailInput = container.querySelector('#newAdminEmailInput');

  const renderAdminEmailsList = () => {
    if (!adminEmailBadgesEl) return;
    adminEmailBadgesEl.innerHTML = getAllAdminEmails()
      .map(
        (em) =>
          `<span style="background:#dcfce7;color:#166534;padding:3px 9px;border-radius:999px;font-size:11.5px;font-weight:700;border:1px solid #86efac;">${escapeHtml(em)}</span>`
      )
      .join('');
  };

  renderAdminEmailsList();

  addAdminForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = newAdminEmailInput?.value.trim().toLowerCase();
    if (!email) return;
    if (addExtraAdminEmail(email)) {
      newAdminEmailInput.value = '';
      renderAdminEmailsList();
      try {
        await supabase.from('profiles').update({ role: 'admin' }).ilike('email', email);
      } catch (_) {}
      toast?.(`👑 Đã cấp quyền Quản lý (Admin) cho ${email}`);
    }
  });

  const renderAdminUI = async () => {
    const allMessages = await fetchSupportMessages(null);
    const allThreads = buildConversationThreads(allMessages);

    const waitingCount = allThreads.filter((t) => t.needs_reply).length;
    const answeredCount = allThreads.length - waitingCount;

    statsEl.innerHTML = `
      <div class="support-stat-pill">
        <span>Tổng hội thoại</span>
        <strong>${allThreads.length}</strong>
      </div>
      <div class="support-stat-pill is-waiting">
        <span>Chờ Admin trả lời</span>
        <strong>${waitingCount}</strong>
      </div>
      <div class="support-stat-pill is-answered">
        <span>Đã phản hồi</span>
        <strong>${answeredCount}</strong>
      </div>
    `;

    const filteredThreads = allThreads.filter((t) => {
      if (adminFilterMode === 'unread' && !t.needs_reply) return false;
      if (adminSearchQuery) {
        const q = adminSearchQuery.toLowerCase();
        const matchName = (t.user_name || '').toLowerCase().includes(q);
        const matchEmail = (t.user_email || '').toLowerCase().includes(q);
        const matchMsg = t.messages.some((m) => (m.content || '').toLowerCase().includes(q));
        return matchName || matchEmail || matchMsg;
      }
      return true;
    });

    if (!activeAdminSessionId && filteredThreads.length > 0) {
      activeAdminSessionId = filteredThreads[0].session_id;
    }

    if (filteredThreads.length === 0) {
      threadListEl.innerHTML = `
        <div class="support-thread-empty">
          <p>Chưa có cuộc trò chuyện nào trong mục này.</p>
          <small>Hãy thử mở khung "Chat Hỗ Trợ" ở góc dưới bên phải và gửi 1 tin nhắn thử nghiệm!</small>
        </div>
      `;
    } else {
      threadListEl.innerHTML = filteredThreads
        .map((thread) => {
          const isActive = thread.session_id === activeAdminSessionId;
          const lastMsg = thread.last_message;
          const prefix =
            lastMsg?.sender_role === 'admin'
              ? '🛡️ Admin: '
              : lastMsg?.sender_role === 'bot'
              ? '🤖 LuLu: '
              : '';
          return `
            <button
              type="button"
              class="support-thread-item ${isActive ? 'active' : ''} ${thread.needs_reply ? 'is-unread' : ''}"
              data-thread-id="${escapeHtml(thread.session_id)}"
            >
              <img class="support-thread-avatar" src="${escapeHtml(thread.user_avatar || 'picture/main_picture.png')}" alt="${escapeHtml(thread.user_name)}" />
              <div class="support-thread-meta">
                <div class="support-thread-row1">
                  <strong>${escapeHtml(thread.user_name)}</strong>
                  <span>${formatChatTime(lastMsg?.created_at)}</span>
                </div>
                <div class="support-thread-email">${escapeHtml(thread.user_email || thread.session_id)}</div>
                <div class="support-thread-preview">${escapeHtml(prefix + (lastMsg?.content || ''))}</div>
              </div>
              ${
                thread.needs_reply
                  ? `<span class="support-thread-badge">${thread.unread_user_count} mới</span>`
                  : `<span class="support-thread-done">✓</span>`
              }
            </button>
          `;
        })
        .join('');
    }

    threadListEl.querySelectorAll('[data-thread-id]').forEach((btn) => {
      btn.addEventListener('click', () => {
        activeAdminSessionId = btn.dataset.threadId;
        renderAdminUI();
      });
    });

    const selectedThread = allThreads.find((t) => t.session_id === activeAdminSessionId);
    if (!selectedThread) {
      chatPaneEl.innerHTML = `
        <div class="support-admin-empty">
          <img src="picture/main_picture.png" alt="Chọn hội thoại" />
          <h3>Chưa có cuộc hội thoại nào được chọn</h3>
          <p>Khi học viên gửi tin nhắn từ nút <strong>Chat Hỗ Trợ</strong> ở góc dưới phải, tin nhắn sẽ lập tức hiển thị tại đây để bạn trả lời.</p>
        </div>
      `;
      return;
    }

    chatPaneEl.innerHTML = `
      <header class="support-pane-header">
        <div class="support-pane-user">
          <img src="${escapeHtml(selectedThread.user_avatar || 'picture/main_picture.png')}" alt="${escapeHtml(selectedThread.user_name)}" />
          <div>
            <h3>${escapeHtml(selectedThread.user_name)}</h3>
            <p>${escapeHtml(selectedThread.user_email || 'Khách vãng lai')} • Mã phiên: <code>${escapeHtml(selectedThread.session_id)}</code></p>
          </div>
        </div>
        <span class="support-pane-status ${selectedThread.needs_reply ? 'waiting' : 'replied'}">
          ${selectedThread.needs_reply ? '⏳ Đang chờ bạn phản hồi' : '✅ Đã phản hồi'}
        </span>
      </header>

      <div class="support-pane-messages" id="adminPaneMessages">
        ${selectedThread.messages
          .map((m) => {
            const isAdmin = m.sender_role === 'admin';
            const isBot = m.sender_role === 'bot';
            const bubbleClass = isAdmin ? 'admin-bubble' : isBot ? 'bot-bubble' : 'student-bubble';
            const label = isAdmin
              ? '🛡️ Bạn (Quản trị viên)'
              : isBot
              ? '🤖 Trợ lý tự động LuLu'
              : `👤 ${escapeHtml(m.user_name || 'Học viên')}`;
            return `
              <div class="support-pane-msg ${bubbleClass}">
                <div class="support-pane-msg-meta">${label} • ${formatChatTime(m.created_at)}</div>
                <div class="support-pane-msg-body">${formatMessageHtml(m.content)}</div>
              </div>
            `;
          })
          .join('')}
      </div>

      <div class="support-admin-canned">
        <span>Trả lời mẫu nhanh:</span>
        <div class="support-canned-list">
          ${ADMIN_QUICK_REPLIES.map(
            (text, idx) => `
            <button type="button" class="support-canned-chip" data-canned-idx="${idx}">
              ${escapeHtml(text.slice(0, 46))}…
            </button>
          `
          ).join('')}
        </div>
      </div>

      <form class="support-pane-reply-form" id="adminReplyForm">
        <textarea
          id="adminReplyInput"
          rows="2"
          placeholder="Nhập câu trả lời của Quản trị viên cho ${escapeHtml(selectedThread.user_name)} (Nhấn Enter để gửi, Shift+Enter xuống dòng)..."
          required
        ></textarea>
        <button type="submit" class="primary-button support-admin-send-btn">
          Gửi phản hồi ➤
        </button>
      </form>
    `;

    const paneMessagesEl = chatPaneEl.querySelector('#adminPaneMessages');
    if (paneMessagesEl) {
      paneMessagesEl.scrollTop = paneMessagesEl.scrollHeight;
    }

    const replyForm = chatPaneEl.querySelector('#adminReplyForm');
    const replyInput = chatPaneEl.querySelector('#adminReplyInput');

    chatPaneEl.querySelectorAll('[data-canned-idx]').forEach((chip) => {
      chip.addEventListener('click', () => {
        const text = ADMIN_QUICK_REPLIES[Number(chip.dataset.cannedIdx)];
        if (text && replyInput) {
          replyInput.value = text;
          replyInput.focus();
        }
      });
    });

    replyInput?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        replyForm.requestSubmit();
      }
    });

    replyForm?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const replyText = replyInput.value.trim();
      if (!replyText) return;
      replyInput.value = '';

      await sendSupportMessage({
        sessionId: selectedThread.session_id,
        senderRole: 'admin',
        content: replyText,
        userInfo: {
          user_id: selectedThread.user_id,
          user_name: selectedThread.user_name,
          user_email: selectedThread.user_email,
          user_avatar: selectedThread.user_avatar
        }
      });

      toast?.(`✅ Đã gửi phản hồi cho ${selectedThread.user_name}!`);
      await renderAdminUI();
      window.dispatchEvent(new CustomEvent('support-messages-updated'));
    });
  };

  container.querySelectorAll('[data-admin-filter]').forEach((tab) => {
    tab.addEventListener('click', () => {
      adminFilterMode = tab.dataset.adminFilter || 'all';
      container.querySelectorAll('[data-admin-filter]').forEach((t) => t.classList.remove('active'));
      tab.classList.add('active');
      renderAdminUI();
    });
  });

  searchInput?.addEventListener('input', () => {
    adminSearchQuery = searchInput.value.trim();
    renderAdminUI();
  });

  refreshBtn?.addEventListener('click', () => {
    renderAdminUI();
    toast?.('Đã làm mới danh sách tin nhắn hỗ trợ ✦');
  });

  window.addEventListener('support-messages-updated', renderAdminUI);
  renderAdminUI();
}
