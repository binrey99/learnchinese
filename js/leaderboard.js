import { supabase } from './supabase.js';

const escapeHtml = (value = '') => String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');

export async function initLeaderboard({ selector = '[data-leaderboard]' } = {}) {
  const container = document.querySelector(selector);
  if (!container) return;
  container.innerHTML = '<p class="practice-loading">Đang tải bảng vinh danh...</p>';
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) { container.innerHTML = '<div class="mastered-quiz-empty"><h2>🏆 Leaderboard</h2><p>Đăng nhập để xem các từ bạn đã chinh phục.</p></div>'; return; }
  const { data: mastery, error } = await supabase.from('vocabulary_mastery').select('vocabulary_id, correct_answers, achieved_at').eq('user_id', user.id).gte('correct_answers', 5).order('achieved_at', { ascending: false });
  if (error) { container.innerHTML = '<p class="practice-loading">Không thể tải Leaderboard. Hãy chạy bản cập nhật SQL cho vocabulary_mastery.</p>'; return; }
  if (!mastery.length) { container.innerHTML = '<div class="mastered-quiz-empty"><h2>🏆 Leaderboard</h2><p>Chọn đúng một từ 5 lần trong phần Kiểm tra từ đã thuộc để đưa từ đó vào đây.</p></div>'; return; }
  const { data: words, error: wordError } = await supabase.from('vocabulary').select('id, vocab, vietnamese_meaning').in('id', mastery.map((item) => item.vocabulary_id));
  if (wordError) throw wordError;
  const wordMap = new Map(words.map((word) => [String(word.id), word]));
  container.innerHTML = `<section class="leaderboard"><div class="leaderboard-title"><span>🏆</span><div><h2>${mastery.length} từ đã chinh phục</h2><p>Mỗi từ đều có ít nhất 5 câu trả lời đúng.</p></div></div><ol>${mastery.map((item, index) => { const word = wordMap.get(String(item.vocabulary_id)); return `<li><b>${index + 1}</b><strong>${escapeHtml(word?.vocab || '')}</strong><span>${escapeHtml(word?.vietnamese_meaning || '')}</span><em>5/5 ✓</em></li>`; }).join('')}</ol></section>`;
}
