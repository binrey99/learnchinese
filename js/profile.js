import { supabase } from './supabase.js';

export async function renderProfile(selector = '#profileContent') {
  const container = document.querySelector(selector);
  if (!container) return;

  container.innerHTML = '<p class="profile-loading">Đang tải hồ sơ...</p>';
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    container.innerHTML = '<div class="profile-empty"><strong>Bạn chưa đăng nhập</strong><span>Hãy đăng nhập để xem hồ sơ của mình.</span><a class="primary-button" href="#dashboard">Về dashboard</a></div>';
    return;
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('email, full_name, avatar_url, created_at')
    .eq('id', user.id)
    .maybeSingle();

  const name = profile?.full_name || user.user_metadata?.full_name || user.email?.split('@')[0] || 'Học viên';
  const email = profile?.email || user.email || '';
  const avatar = profile?.avatar_url || 'picture/main_picture.png';
  const joined = profile?.created_at ? new Date(profile.created_at).toLocaleDateString('vi-VN') : 'Chưa cập nhật';

  container.innerHTML = `
    <div class="profile-card">
      <img class="profile-avatar-large" src="${avatar}" alt="Ảnh đại diện của ${name}">
      <div class="profile-details">
        <span class="profile-badge">HỒ SƠ HỌC VIÊN</span>
        <h2>${name}</h2>
        <p>${email}</p>
        <div class="profile-meta"><span>Ngày tham gia</span><strong>${joined}</strong></div>
      </div>
    </div>
  `;
}
