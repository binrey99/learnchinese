import { supabase } from './supabase.js';
import { normalizeLevel } from './levels.js';
import { recordScore, SCORE_RULES } from './score-service.js';
import { awardFoodReward } from './lulu.js';
import { recordMistakeWord, getAllSrsCards } from './srs-service.js';
import { pinyin } from 'https://esm.sh/pinyin-pro@3.27.0';

function toPinyin(hanzi) {
  try {
    return pinyin(hanzi, { toneType: 'symbol' });
  } catch (_) {
    return '';
  }
}

const DEFAULT_VOCABULARY = [
  // HSK 1
  { hanzi: '你好', pinyin: 'nǐ hǎo', meaning: 'xin chào', level: 'HSK 1' },
  { hanzi: '谢谢', pinyin: 'xiè xie', meaning: 'cảm ơn', level: 'HSK 1' },
  { hanzi: '再见', pinyin: 'zài jiàn', meaning: 'tạm biệt', level: 'HSK 1' },
  { hanzi: '学习', pinyin: 'xué xí', meaning: 'học tập', level: 'HSK 1' },
  { hanzi: '老师', pinyin: 'lǎo shī', meaning: 'giáo viên', level: 'HSK 1' },
  { hanzi: '朋友', pinyin: 'péng you', meaning: 'bạn bè', level: 'HSK 1' },
  { hanzi: '高兴', pinyin: 'gāo xìng', meaning: 'vui vẻ', level: 'HSK 1' },
  { hanzi: '喝水', pinyin: 'hē shuǐ', meaning: 'uống nước', level: 'HSK 1' },
  { hanzi: '中国', pinyin: 'zhōng guó', meaning: 'Trung Quốc', level: 'HSK 1' },
  { hanzi: '苹果', pinyin: 'píng guǒ', meaning: 'quả táo', level: 'HSK 1' },
  // HSK 2
  { hanzi: '努力', pinyin: 'nǔ lì', meaning: 'nỗ lực', level: 'HSK 2' },
  { hanzi: '帮助', pinyin: 'bāng zhù', meaning: 'giúp đỡ', level: 'HSK 2' },
  { hanzi: '准备', pinyin: 'zhǔn bèi', meaning: 'chuẩn bị', level: 'HSK 2' },
  { hanzi: '希望', pinyin: 'xī wàng', meaning: 'hy vọng', level: 'HSK 2' },
  { hanzi: '运动', pinyin: 'yùn dòng', meaning: 'thể thao', level: 'HSK 2' },
  { hanzi: '旅游', pinyin: 'lǚ yóu', meaning: 'du lịch', level: 'HSK 2' },
  { hanzi: '时间', pinyin: 'shí jiān', meaning: 'thời gian', level: 'HSK 2' },
  { hanzi: '身体', pinyin: 'shēn tǐ', meaning: 'sức khỏe', level: 'HSK 2' },
  { hanzi: '介绍', pinyin: 'jiè shào', meaning: 'giới thiệu', level: 'HSK 2' },
  { hanzi: '便宜', pinyin: 'pián yi', meaning: 'giá rẻ', level: 'HSK 2' },
  // HSK 3
  { hanzi: '提高', pinyin: 'tí gāo', meaning: 'nâng cao', level: 'HSK 3' },
  { hanzi: '环境', pinyin: 'huán jìng', meaning: 'môi trường', level: 'HSK 3' },
  { hanzi: '清楚', pinyin: 'qīng chu', meaning: 'rõ ràng', level: 'HSK 3' },
  { hanzi: '简单', pinyin: 'jiǎn dān', meaning: 'đơn giản', level: 'HSK 3' },
  { hanzi: '参加', pinyin: 'cān jiā', meaning: 'tham gia', level: 'HSK 3' },
  { hanzi: '热情', pinyin: 'rè qíng', meaning: 'nhiệt tình', level: 'HSK 3' },
  { hanzi: '解决', pinyin: 'jiě jué', meaning: 'giải quyết', level: 'HSK 3' },
  { hanzi: '满意', pinyin: 'mǎn yì', meaning: 'hài lòng', level: 'HSK 3' },
  { hanzi: '照顾', pinyin: 'zhào gù', meaning: 'chăm sóc', level: 'HSK 3' },
  { hanzi: '检查', pinyin: 'jiǎn chá', meaning: 'kiểm tra', level: 'HSK 3' },
  // Công xưởng
  { hanzi: '车间', pinyin: 'chē jiān', meaning: 'phân xưởng', level: 'Công xưởng' },
  { hanzi: '安全帽', pinyin: 'ān quán mào', meaning: 'mũ bảo hộ', level: 'Công xưởng' },
  { hanzi: '生产线', pinyin: 'shēng chǎn xiàn', meaning: 'dây chuyền sản xuất', level: 'Công xưởng' },
  { hanzi: '产品', pinyin: 'chǎn pǐn', meaning: 'sản phẩm', level: 'Công xưởng' },
  { hanzi: '仓库', pinyin: 'cāng kù', meaning: 'kho hàng', level: 'Công xưởng' },
  { hanzi: '上班', pinyin: 'shàng bān', meaning: 'đi làm, vào ca', level: 'Công xưởng' },
  { hanzi: '下班', pinyin: 'xià bān', meaning: 'tan làm', level: 'Công xưởng' },
  { hanzi: '交货', pinyin: 'jiāo huò', meaning: 'giao hàng', level: 'Công xưởng' }
];

// Audio synthesizer for sound effects (Zero external assets needed)
class SoundEffects {
  constructor() {
    this.ctx = null;
    this.muted = localStorage.getItem('mandarinly_sound_muted') === 'true';
  }

  initCtx() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  playFlip() {
    if (this.muted) return;
    try {
      this.initCtx();
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(360, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(520, this.ctx.currentTime + 0.08);
      gain.gain.setValueAtTime(0.12, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.08);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.08);
    } catch (_) {}
  }

  playShoot() {
    if (this.muted) return;
    try {
      this.initCtx();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.exponentialRampToValueAtTime(140, now + 0.12);
      gain.gain.setValueAtTime(0.18, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.12);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.12);
    } catch (_) {}
  }

  playPop() {
    if (this.muted) return;
    try {
      this.initCtx();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(750, now);
      osc.frequency.exponentialRampToValueAtTime(980, now + 0.08);
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.08);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.08);
    } catch (_) {}
  }

  playCorrect() {
    if (this.muted) return;
    try {
      this.initCtx();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      [523.25, 659.25, 783.99].forEach((freq, i) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now + i * 0.07);
        gain.gain.setValueAtTime(0.18, now + i * 0.07);
        gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.07 + 0.15);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now + i * 0.07);
        osc.stop(now + i * 0.07 + 0.15);
      });
    } catch (_) {}
  }

  playChomp() {
    if (this.muted) return;
    try {
      this.initCtx();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      // Hai nhịp ngoàm liên tiếp khi hoa ăn thịt rồng
      [0, 0.22].forEach((offset, idx) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = idx === 0 ? 'sawtooth' : 'square';
        osc.frequency.setValueAtTime(idx === 0 ? 310 : 250, now + offset);
        osc.frequency.exponentialRampToValueAtTime(65, now + offset + 0.18);
        gain.gain.setValueAtTime(0.24, now + offset);
        gain.gain.exponentialRampToValueAtTime(0.01, now + offset + 0.19);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now + offset);
        osc.stop(now + offset + 0.19);
      });
    } catch (_) {}
  }

  playWrong() {
    if (this.muted) return;
    try {
      this.initCtx();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(220, now);
      osc.frequency.setValueAtTime(180, now + 0.1);
      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.22);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.22);
    } catch (_) {}
  }

  playVictory() {
    if (this.muted) return;
    try {
      this.initCtx();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      const notes = [440, 554.37, 659.25, 880];
      notes.forEach((freq, idx) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now + idx * 0.1);
        gain.gain.setValueAtTime(0.2, now + idx * 0.1);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.1 + 0.35);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now + idx * 0.1);
        osc.stop(now + idx * 0.1 + 0.35);
      });
    } catch (_) {}
  }

  toggleMute() {
    this.muted = !this.muted;
    localStorage.setItem('mandarinly_sound_muted', String(this.muted));
    return this.muted;
  }
}

const sounds = new SoundEffects();

// Chinese speech pronunciation with robust dual-engine fallback (Web Speech + YouDao audio)
function speakChinese(text, onEnd, opts = {}) {
  const rate = typeof opts === 'number' ? opts : (opts?.rate || 0.85);
  const force = typeof opts === 'object' && Boolean(opts?.force);
  if (!text || (sounds.muted && !force)) return;

  // Engine 1: Web SpeechSynthesis
  if ('speechSynthesis' in window) {
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'zh-CN';
      utterance.rate = rate;

      const voices = window.speechSynthesis.getVoices();
      const zh = voices.find(
        (v) => v.lang === 'zh-CN' || v.lang === 'zh_CN' || v.lang?.startsWith('zh') || v.name?.includes('Chinese')
      );
      if (zh) utterance.voice = zh;
      if (onEnd) utterance.onend = onEnd;

      let started = false;
      utterance.onstart = () => { started = true; };
      utterance.onerror = () => {
        if (!started) playChineseAudioFallback(text, onEnd, rate, force);
      };

      window.speechSynthesis.speak(utterance);

      // Chrome speech synthesis safety fallback
      setTimeout(() => {
        if (!window.speechSynthesis.speaking && !started) {
          playChineseAudioFallback(text, onEnd, rate, force);
        }
      }, 250);
      return;
    } catch (_) {}
  }

  // Engine 2: High quality dictionary CDN audio
  playChineseAudioFallback(text, onEnd, rate, force);
}

function playChineseAudioFallback(text, onEnd, rate = 0.85, force = false) {
  if ((sounds.muted && !force) || !text) return;
  try {
    const audio = new Audio(`https://dict.youdao.com/dictvoice?audio=${encodeURIComponent(text)}&le=zh`);
    audio.playbackRate = Math.max(0.5, Math.min(1.2, rate <= 0.7 ? 0.72 : 1.0));
    if (onEnd) audio.onended = onEnd;
    audio.play().catch(() => {});
  } catch (_) {}
}

const escapeHtml = (value = '') =>
  String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

const shuffle = (items) => [...items].sort(() => Math.random() - 0.5);

// Thứ tự cố định của các cấp độ
const LEVEL_ORDER = ['HSK 1', 'HSK 2', 'HSK 3', 'HSK 4', 'HSK 5', 'HSK 6', 'Công xưởng'];

// Fetch words from Supabase or fallback (toàn bộ, có phân trang)
async function loadGameVocabulary() {
  try {
    const pageSize = 1000;
    const rows = [];

    for (let from = 0; ; from += pageSize) {
      const { data, error } = await supabase
        .from('vocabulary')
        .select('id, vocab, vietnamese_meaning, book_level')
        .order('id', { ascending: true })
        .range(from, from + pageSize - 1);

      if (error) throw error;
      rows.push(...data);
      if (data.length < pageSize) break;
    }

    if (rows.length > 0) {
      const valid = rows
        .filter((w) => w.vocab && w.vietnamese_meaning)
        .map((w) => ({
          id: w.id,
          hanzi: w.vocab.trim(),
          pinyin: toPinyin(w.vocab.trim()),
          meaning: w.vietnamese_meaning.trim(),
          level: normalizeLevel(w.book_level || 'HSK 1')
        }));
      if (valid.length >= 10) return valid;
    }
  } catch (err) {
    console.warn('Cannot load online vocabulary for games, using fallback:', err.message);
  }
  return DEFAULT_VOCABULARY;
}

// Active game timer and animation tracker for cleanup
let activeInterval = null;
let activeAnimFrame = null;
let activeCleanups = [];

function clearActiveGame() {
  if (activeInterval) {
    clearInterval(activeInterval);
    activeInterval = null;
  }
  if (activeAnimFrame) {
    cancelAnimationFrame(activeAnimFrame);
    activeAnimFrame = null;
  }
  activeCleanups.forEach((fn) => {
    try { fn(); } catch (_) {}
  });
  activeCleanups = [];
}
const clearActiveInterval = clearActiveGame;
export const cleanupGame = clearActiveGame;

export async function initGame({ selector = '[data-game]', toast } = {}) {
  const container = document.querySelector(selector);
  if (!container) return;

  clearActiveGame();
  container.innerHTML = `
    <div class="game-loading-state">
      <div class="game-spinner"></div>
      <p>Đang chuẩn bị khu trò chơi...</p>
    </div>
  `;

  const MARKED_LEVEL = '⭐ Đã đánh dấu';
  let userMasteredIds = new Set();

  async function refreshMasteredIds() {
    const set = new Set();
    try {
      const local = JSON.parse(localStorage.getItem('mandarinly_local_mastered') || '[]');
      if (Array.isArray(local)) {
        local.forEach((id) => set.add(String(id)));
      }
    } catch (_) {}

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.id) {
        const { data, error } = await supabase
          .from('vocabulary_mastery')
          .select('vocabulary_id')
          .eq('user_id', user.id);
        if (!error && data) {
          data.forEach((item) => set.add(String(item.vocabulary_id)));
        }
      }
    } catch (_) {}
    userMasteredIds = set;
    return set;
  }

  const [allWords] = await Promise.all([
    loadGameVocabulary(),
    refreshMasteredIds()
  ]);

  // Distinct levels - sắp xếp theo thứ tự cố định
  const levelsInData = new Set(allWords.map((w) => w.level).filter(Boolean));
  const orderedLevels = LEVEL_ORDER.filter((lvl) => levelsInData.has(lvl));
  // Thêm bất kỳ level nào không có trong LEVEL_ORDER (nếu có)
  levelsInData.forEach((lvl) => { if (!LEVEL_ORDER.includes(lvl)) orderedLevels.push(lvl); });
  const availableLevels = ['Tất cả', MARKED_LEVEL, ...orderedLevels];
  let currentLevel = 'Tất cả';
  let currentGameMode = 'memory'; // 'memory' | 'speed' | 'match' | 'catch' | 'shooter'

  function getFilteredWords() {
    if (currentLevel === 'Tất cả') return allWords;
    if (currentLevel === MARKED_LEVEL || currentLevel === 'Đã đánh dấu') {
      const srsCards = getAllSrsCards();
      const srsHanziSet = new Set(srsCards.map((c) => c.hanzi?.trim()).filter(Boolean));

      // Lấy từ allWords nếu có ID trong danh sách đánh dấu sao (vocabulary_mastery) hoặc Hanzi trong SRS notebook
      const matched = allWords.filter(
        (w) => (w.id && userMasteredIds.has(String(w.id))) || srsHanziSet.has(w.hanzi)
      );
      const matchedHanzi = new Set(matched.map((w) => w.hanzi));

      // Bổ sung các thẻ SRS nếu có từ vựng chưa xuất hiện trong allWords
      const srsExtras = srsCards
        .filter((c) => c.hanzi && c.meaning && !matchedHanzi.has(c.hanzi.trim()))
        .map((c) => ({
          id: c.id || null,
          hanzi: c.hanzi.trim(),
          pinyin: c.pinyin || toPinyin(c.hanzi.trim()),
          meaning: c.meaning.trim(),
          level: c.level || 'Đã đánh dấu'
        }));

      return [...matched, ...srsExtras];
    }
    return allWords.filter((w) => w.level === currentLevel);
  }

  function renderLayout() {
    clearActiveGame();

    const highScores = {
      memory: localStorage.getItem('mandarinly_game_best_memory') || '0',
      speed: localStorage.getItem('mandarinly_game_best_speed') || '0',
      match: localStorage.getItem('mandarinly_game_best_match') || '0',
      catch: localStorage.getItem('mandarinly_game_best_catch') || '0',
      shooter: localStorage.getItem('mandarinly_game_best_shooter') || '0'
    };

    container.innerHTML = `
      <div class="game-hub">
        <!-- Top Toolbar -->
        <div class="game-toolbar">
          <div class="game-mode-tabs" role="tablist">
            <button type="button" class="game-mode-tab ${currentGameMode === 'memory' ? 'active' : ''}" data-mode="memory">
              <span class="mode-icon">🎴</span>
              <span class="mode-text">Lật thẻ trí nhớ</span>
            </button>
            <button type="button" class="game-mode-tab ${currentGameMode === 'speed' ? 'active' : ''}" data-mode="speed">
              <span class="mode-icon">⚡</span>
              <span class="mode-text">Đua tốc độ 60s</span>
            </button>
            <button type="button" class="game-mode-tab ${currentGameMode === 'match' ? 'active' : ''}" data-mode="match">
              <span class="mode-icon">🔗</span>
              <span class="mode-text">Nối cặp từ vựng</span>
            </button>
            <button type="button" class="game-mode-tab ${currentGameMode === 'catch' ? 'active' : ''}" data-mode="catch">
              <span class="mode-icon">🎯</span>
              <span class="mode-text">Chạm từ rơi</span>
            </button>
            <button type="button" class="game-mode-tab ${currentGameMode === 'shooter' ? 'active' : ''}" data-mode="shooter">
              <span class="mode-icon">🏹</span>
              <span class="mode-text">Bắn từ vựng</span>
            </button>
          </div>

          <div class="game-actions-bar">
            <div class="game-level-select">
              <label for="gameLevelSelect">Cấp độ:</label>
              <select id="gameLevelSelect">
                ${availableLevels.map((lvl) => `<option value="${lvl}" ${lvl === currentLevel ? 'selected' : ''}>${lvl}</option>`).join('')}
              </select>
            </div>
            <button type="button" class="game-sound-btn" id="gameSoundBtn" title="Bật/Tắt âm thanh">
              ${sounds.muted ? '🔇 Tắt âm' : '🔊 Âm thanh'}
            </button>
          </div>
        </div>

        <!-- High Score Banner -->
        <div class="game-meta-strip">
          <div class="game-meta-badge">
            🏆 Điểm kỷ lục: <strong>${highScores[currentGameMode]}</strong> điểm
          </div>
          <div class="game-meta-guide">
            ${
              currentGameMode === 'memory'
                ? 'Tìm các cặp Chữ Hán và Nghĩa tương ứng.'
                : currentGameMode === 'speed'
                ? 'Chọn đúng nghĩa trong 60 giây. Chuỗi đúng càng dài điểm càng cao!'
                : currentGameMode === 'match'
                ? 'Nối từng cặp chữ Hán và tiếng Việt để ghi điểm.'
                : currentGameMode === 'catch'
                ? 'Chạm nhanh vào chữ Hán rơi xuống khớp với nghĩa mục tiêu! Tốc độ rơi tăng dần theo thời gian.'
                : 'Kéo súng ná xuống để ngắm & bắn nghĩa tiếng Việt trúng chữ Hán tương ứng! Bắn đúng chữ sẽ rụng rơi, bắn trượt sẽ dính lại.'
            }
          </div>
        </div>

        <!-- Game Active Arena -->
        <div class="game-arena" id="gameArena"></div>
      </div>
    `;

    // Bind mode switch
    container.querySelectorAll('.game-mode-tab').forEach((btn) => {
      btn.addEventListener('click', () => {
        currentGameMode = btn.dataset.mode;
        renderLayout();
      });
    });

    // Bind level filter
    const levelSelect = container.querySelector('#gameLevelSelect');
    if (levelSelect) {
      levelSelect.addEventListener('change', async (e) => {
        currentLevel = e.target.value;
        if (currentLevel === MARKED_LEVEL || currentLevel === 'Đã đánh dấu') {
          await refreshMasteredIds();
        }
        startActiveGame();
      });
    }

    // Tự động cập nhật lại game khi người dùng đánh dấu/bỏ đánh dấu từ vựng (SRS / Yêu thích)
    const onSrsUpdated = () => {
      if (currentLevel === MARKED_LEVEL || currentLevel === 'Đã đánh dấu') {
        refreshMasteredIds().then(() => {
          startActiveGame();
        });
      }
    };
    window.addEventListener('srs-updated', onSrsUpdated);
    activeCleanups.push(() => window.removeEventListener('srs-updated', onSrsUpdated));

    // Bind sound toggle
    const soundBtn = container.querySelector('#gameSoundBtn');
    if (soundBtn) {
      soundBtn.addEventListener('click', () => {
        const isMuted = sounds.toggleMute();
        soundBtn.innerHTML = isMuted ? '🔇 Tắt âm' : '🔊 Âm thanh';
        if (toast) toast(isMuted ? 'Đã tắt âm thanh game' : 'Đã bật âm thanh game');
      });
    }

    startActiveGame();
  }

  function renderEmptyState(count = 0, minRequired = 4) {
    if (currentLevel === MARKED_LEVEL || currentLevel === 'Đã đánh dấu') {
      if (count === 0) {
        return `
          <div class="game-empty game-empty-marked">
            <div class="empty-marked-icon">⭐</div>
            <h3>Chưa có từ vựng đã đánh dấu</h3>
            <p>Bạn chưa đánh dấu từ nào. Hãy nhấn biểu tượng ngôi sao <strong>★</strong> hoặc ghim <strong>📌</strong> tại trang <strong>Từ vựng</strong> để tạo danh sách từ riêng và bắt đầu luyện tập!</p>
            <button type="button" class="btn-goto-vocab" data-goto-vocab>
              📖 Đến trang Từ vựng
            </button>
          </div>
        `;
      }
      return `
        <div class="game-empty game-empty-marked">
          <div class="empty-marked-icon">⭐</div>
          <h3>Cần thêm từ vựng đã đánh dấu</h3>
          <p>Bạn hiện có <strong>${count}</strong> từ đã đánh dấu. Trò chơi này cần ít nhất <strong>${minRequired}</strong> từ để bắt đầu. Hãy đánh dấu thêm vài từ tại trang <strong>Từ vựng</strong> nhé!</p>
          <button type="button" class="btn-goto-vocab" data-goto-vocab>
            📖 Đánh dấu thêm từ vựng
          </button>
        </div>
      `;
    }
    return `<div class="game-empty">Cần ít nhất ${minRequired} từ vựng để bắt đầu trò chơi. Hãy chọn cấp độ khác.</div>`;
  }

  function bindGoToVocab(arena) {
    const btn = arena.querySelector('[data-goto-vocab]');
    if (btn) {
      btn.addEventListener('click', () => {
        window.location.hash = '#vocabulary';
      });
    }
  }

  function startActiveGame() {
    clearActiveGame();
    const arena = container.querySelector('#gameArena');
    if (!arena) return;

    if (currentGameMode === 'memory') {
      startMemoryGame(arena);
    } else if (currentGameMode === 'speed') {
      startSpeedGame(arena);
    } else if (currentGameMode === 'match') {
      startMatchGame(arena);
    } else if (currentGameMode === 'catch') {
      startCatchGame(arena);
    } else if (currentGameMode === 'shooter') {
      startShooterGame(arena);
    }
  }

  // ==========================================
  // DỮ LIỆU TỪ VỰNG & CẤU TRÚC NGỮ PHÁP GHÉP CÂU / CỤM TỪ
  // ==========================================
  const SPEED_COMPOUND_DATA = {
    pronouns: [
      { zh: '我', py: 'wǒ', vi: 'tôi', level: 'HSK 1' },
      { zh: '你', py: 'nǐ', vi: 'bạn', level: 'HSK 1' },
      { zh: '他', py: 'tā', vi: 'anh ấy', level: 'HSK 1' },
      { zh: '她', py: 'tā', vi: 'cô ấy', level: 'HSK 1' },
      { zh: '我们', py: 'wǒmen', vi: 'chúng tôi', level: 'HSK 1' },
      { zh: '大家', py: 'dàjiā', vi: 'mọi người', level: 'HSK 1' },
      { zh: '老师', py: 'lǎoshī', vi: 'thầy giáo', level: 'HSK 1' },
      { zh: '朋友', py: 'péngyou', vi: 'bạn bè', level: 'HSK 1' },
      { zh: '妈妈', py: 'māma', vi: 'mẹ', level: 'HSK 1' },
      { zh: '爸爸', py: 'bàba', vi: 'bố', level: 'HSK 1' }
    ],
    verbs: [
      { zh: '吃', py: 'chī', vi: 'ăn', level: 'HSK 1' },
      { zh: '喝', py: 'hē', vi: 'uống', level: 'HSK 1' },
      { zh: '学', py: 'xué', vi: 'học', level: 'HSK 1' },
      { zh: '做', py: 'zuò', vi: 'làm', level: 'HSK 1' },
      { zh: '睡', py: 'shuì', vi: 'ngủ', level: 'HSK 1' },
      { zh: '看', py: 'kàn', vi: 'xem', level: 'HSK 1' },
      { zh: '读', py: 'dú', vi: 'đọc', level: 'HSK 1' },
      { zh: '写', py: 'xiě', vi: 'viết', level: 'HSK 1' },
      { zh: '听', py: 'tīng', vi: 'nghe', level: 'HSK 1' },
      { zh: '说', py: 'shuō', vi: 'nói', level: 'HSK 1' },
      { zh: '买', py: 'mǎi', vi: 'mua', level: 'HSK 1' },
      { zh: '去', py: 'qù', vi: 'đi', level: 'HSK 1' },
      { zh: '来', py: 'lái', vi: 'đến', level: 'HSK 1' },
      { zh: '想', py: 'xiǎng', vi: 'muốn', level: 'HSK 1' },
      { zh: '住', py: 'zhù', vi: 'ở', level: 'HSK 1' },
      { zh: '工作', py: 'gōngzuò', vi: 'làm việc', level: 'HSK 1' },
      { zh: '问', py: 'wèn', vi: 'hỏi', level: 'HSK 2' },
      { zh: '等', py: 'děng', vi: 'đợi', level: 'HSK 2' },
      { zh: '休息', py: 'xiūxi', vi: 'nghỉ ngơi', level: 'HSK 2' },
      { zh: '跑步', py: 'pǎobù', vi: 'chạy bộ', level: 'HSK 2' },
      { zh: '上班', py: 'shàngbān', vi: 'đi làm', level: 'Công xưởng' },
      { zh: '下班', py: 'xiàbān', vi: 'tan làm', level: 'Công xưởng' },
      { zh: '加班', py: 'jiābān', vi: 'tăng ca', level: 'Công xưởng' },
      { zh: '检查', py: 'jiǎnchá', vi: 'kiểm tra', level: 'Công xưởng' }
    ],
    negatives: [
      { zh: '不', py: 'bù', vi: 'không', level: 'HSK 1' },
      { zh: '没', py: 'méi', vi: 'chưa', level: 'HSK 1' }
    ],
    degreeAdverbs: [
      { zh: '很', py: 'hěn', vi: 'rất', level: 'HSK 1' },
      { zh: '太', py: 'tài', vi: 'quá', level: 'HSK 1' },
      { zh: '真', py: 'zhēn', vi: 'thật là', level: 'HSK 2' }
    ],
    adjectives: [
      { zh: '好', py: 'hǎo', vi: 'tốt', level: 'HSK 1' },
      { zh: '大', py: 'dà', vi: 'to', level: 'HSK 1' },
      { zh: '小', py: 'xiǎo', vi: 'nhỏ', level: 'HSK 1' },
      { zh: '多', py: 'duō', vi: 'nhiều', level: 'HSK 1' },
      { zh: '少', py: 'shǎo', vi: 'ít', level: 'HSK 1' },
      { zh: '忙', py: 'máng', vi: 'bận', level: 'HSK 2' },
      { zh: '累', py: 'lèi', vi: 'mệt', level: 'HSK 2' },
      { zh: '热', py: 'rè', vi: 'nóng', level: 'HSK 1' },
      { zh: '冷', py: 'lěng', vi: 'lạnh', level: 'HSK 1' },
      { zh: '贵', py: 'guì', vi: 'đắt', level: 'HSK 2' },
      { zh: '便宜', py: 'piányi', vi: 'rẻ', level: 'HSK 2' },
      { zh: '高兴', py: 'gāoxìng', vi: 'vui vẻ', level: 'HSK 1' },
      { zh: '漂亮', py: 'piàoliang', vi: 'xinh đẹp', level: 'HSK 1' },
      { zh: '快', py: 'kuài', vi: 'nhanh', level: 'HSK 2' },
      { zh: '慢', py: 'màn', vi: 'chậm', level: 'HSK 2' },
      { zh: '远', py: 'yuǎn', vi: 'xa', level: 'HSK 2' },
      { zh: '近', py: 'jìn', vi: 'gần', level: 'HSK 2' }
    ],
    verbObjectList: [
      { zh: '喝水', py: 'hē shuǐ', vi: 'uống nước', level: 'HSK 1' },
      { zh: '喝茶', py: 'hē chá', vi: 'uống trà', level: 'HSK 1' },
      { zh: '吃饭', py: 'chī fàn', vi: 'ăn cơm', level: 'HSK 1' },
      { zh: '吃苹果', py: 'chī píngguǒ', vi: 'ăn táo', level: 'HSK 1' },
      { zh: '看书', py: 'kàn shū', vi: 'đọc sách', level: 'HSK 1' },
      { zh: '看电影', py: 'kàn diànyǐng', vi: 'xem phim', level: 'HSK 1' },
      { zh: '看电视', py: 'kàn diànshì', vi: 'xem ti vi', level: 'HSK 1' },
      { zh: '买东西', py: 'mǎi dōngxi', vi: 'mua đồ', level: 'HSK 1' },
      { zh: '学汉语', py: 'xué hànyǔ', vi: 'học tiếng Trung', level: 'HSK 1' },
      { zh: '写字', py: 'xiě zì', vi: 'viết chữ', level: 'HSK 1' },
      { zh: '打电话', py: 'dǎ diànhuà', vi: 'gọi điện thoại', level: 'HSK 1' },
      { zh: '去学校', py: 'qù xuéxiào', vi: 'đi đến trường', level: 'HSK 1' },
      { zh: '去医院', py: 'qù yīyuàn', vi: 'đi bệnh viện', level: 'HSK 1' },
      { zh: '去商店', py: 'qù shāngdiàn', vi: 'đi cửa hàng', level: 'HSK 1' },
      { zh: '去北京', py: 'qù běijīng', vi: 'đi Bắc Kinh', level: 'HSK 1' },
      { zh: '听音乐', py: 'tīng yīnyuè', vi: 'nghe nhạc', level: 'HSK 2' },
      { zh: '去旅游', py: 'qù lǚyóu', vi: 'đi du lịch', level: 'HSK 2' },
      { zh: '买衣服', py: 'mǎi yīfu', vi: 'mua quần áo', level: 'HSK 2' },
      { zh: '去车间', py: 'qù chējiān', vi: 'đến phân xưởng', level: 'Công xưởng' },
      { zh: '戴安全帽', py: 'dài ānquánmào', vi: 'đội mũ bảo hộ', level: 'Công xưởng' },
      { zh: '检查产品', py: 'jiǎnchá chǎnpǐn', vi: 'kiểm tra sản phẩm', level: 'Công xưởng' }
    ]
  };

  function buildCompoundSpeedQuestion(currentLevel) {
    const isFactory = currentLevel === 'Công xưởng';
    const patterns = [0, 0, 1, 2, 3, 4];
    const chosenPattern = patterns[Math.floor(Math.random() * patterns.length)];

    let verbCandidates = SPEED_COMPOUND_DATA.verbs;
    if (isFactory) {
      verbCandidates = SPEED_COMPOUND_DATA.verbs.filter((v) => v.level === 'Công xưởng' || v.level === 'HSK 1');
    } else if (currentLevel && currentLevel.startsWith('HSK')) {
      verbCandidates = SPEED_COMPOUND_DATA.verbs.filter((v) => v.level !== 'Công xưởng');
    }

    // Pattern 0: [Chủ ngữ] + [Động từ] (Ví dụ: 我吃 -> tôi ăn, tôi làm, tôi học, tôi ngủ)
    if (chosenPattern === 0) {
      const sub = SPEED_COMPOUND_DATA.pronouns[Math.floor(Math.random() * SPEED_COMPOUND_DATA.pronouns.length)];
      const shuffledVerbs = shuffle(verbCandidates);
      const targetVerb = shuffledVerbs[0];
      const correctMeaning = `${sub.vi} ${targetVerb.vi}`;
      const distractorVerbs = shuffledVerbs.slice(1, 4);
      const options = shuffle([correctMeaning, ...distractorVerbs.map((v) => `${sub.vi} ${v.vi}`)]);

      return {
        hanzi: `${sub.zh}${targetVerb.zh}`,
        pinyin: `${sub.py} ${targetVerb.py}`,
        meaning: correctMeaning,
        level: currentLevel,
        options,
        isCompound: true
      };
    }

    // Pattern 1: [Phủ định] + [Động từ] (Ví dụ: 不吃 -> không ăn, không uống, không đi, không làm)
    if (chosenPattern === 1) {
      const adv = SPEED_COMPOUND_DATA.negatives[Math.floor(Math.random() * SPEED_COMPOUND_DATA.negatives.length)];
      const shuffledVerbs = shuffle(verbCandidates);
      const targetVerb = shuffledVerbs[0];
      const correctMeaning = `${adv.vi} ${targetVerb.vi}`;
      const distractorVerbs = shuffledVerbs.slice(1, 4);
      const options = shuffle([correctMeaning, ...distractorVerbs.map((v) => `${adv.vi} ${v.vi}`)]);

      return {
        hanzi: `${adv.zh}${targetVerb.zh}`,
        pinyin: `${adv.py} ${targetVerb.py}`,
        meaning: correctMeaning,
        level: currentLevel,
        options,
        isCompound: true
      };
    }

    // Pattern 2: [Phó từ mức độ] + [Tính từ] (Ví dụ: 很好 -> rất tốt, rất to, rất bận, rất nhiều)
    if (chosenPattern === 2) {
      const adv = SPEED_COMPOUND_DATA.degreeAdverbs[Math.floor(Math.random() * SPEED_COMPOUND_DATA.degreeAdverbs.length)];
      const shuffledAdjs = shuffle(SPEED_COMPOUND_DATA.adjectives);
      const targetAdj = shuffledAdjs[0];
      const correctMeaning = `${adv.vi} ${targetAdj.vi}`;
      const distractorAdjs = shuffledAdjs.slice(1, 4);
      const options = shuffle([correctMeaning, ...distractorAdjs.map((a) => `${adv.vi} ${a.vi}`)]);

      return {
        hanzi: `${adv.zh}${targetAdj.zh}`,
        pinyin: `${adv.py} ${targetAdj.py}`,
        meaning: correctMeaning,
        level: currentLevel,
        options,
        isCompound: true
      };
    }

    // Pattern 3: [Động từ] + [Tân ngữ] (Ví dụ: 喝水 -> uống nước, uống trà, ăn cơm, đọc sách)
    let voCandidates = SPEED_COMPOUND_DATA.verbObjectList;
    if (isFactory) {
      voCandidates = SPEED_COMPOUND_DATA.verbObjectList.filter((vo) => vo.level === 'Công xưởng' || vo.level === 'HSK 1');
    } else if (currentLevel && currentLevel.startsWith('HSK')) {
      voCandidates = SPEED_COMPOUND_DATA.verbObjectList.filter((vo) => vo.level !== 'Công xưởng');
    }
    const shuffledVO = shuffle(voCandidates);
    const targetVO = shuffledVO[0];

    if (chosenPattern === 3) {
      const correctMeaning = targetVO.vi;
      const distractorVOs = shuffledVO.slice(1, 4);
      const options = shuffle([correctMeaning, ...distractorVOs.map((vo) => vo.vi)]);

      return {
        hanzi: targetVO.zh,
        pinyin: targetVO.py,
        meaning: correctMeaning,
        level: currentLevel,
        options,
        isCompound: true
      };
    }

    // Pattern 4: [Đại từ] + [Động từ + Tân ngữ] (Ví dụ: 我喝水 -> tôi uống nước, tôi ăn cơm, tôi đọc sách, tôi mua đồ)
    const sub = SPEED_COMPOUND_DATA.pronouns[Math.floor(Math.random() * SPEED_COMPOUND_DATA.pronouns.length)];
    const correctMeaning = `${sub.vi} ${targetVO.vi}`;
    const distractorVOs = shuffledVO.slice(1, 4);
    const options = shuffle([correctMeaning, ...distractorVOs.map((vo) => `${sub.vi} ${vo.vi}`)]);

    return {
      hanzi: `${sub.zh}${targetVO.zh}`,
      pinyin: `${sub.py} ${targetVO.py}`,
      meaning: correctMeaning,
      level: currentLevel,
      options,
      isCompound: true
    };
  }

  // Sinh danh sách từ vựng kết hợp giữa cụm từ ghép có nghĩa và từ đơn (cho Lật thẻ trí nhớ & Nối cặp từ)
  function generateMixedWordPool(wordsPool, count = 6, currentLevel = 'Tất cả') {
    const result = [];
    const usedHanzi = new Set();
    const usedMeanings = new Set();

    // Số lượng cụm từ ghép mong muốn (~55% số lượng thẻ)
    const compoundTarget = Math.max(1, Math.round(count * 0.55));
    let compoundCount = 0;

    // 1. Thử sinh các cụm từ ghép có nghĩa từ SPEED_COMPOUND_DATA
    for (let attempts = 0; attempts < 35 && compoundCount < compoundTarget; attempts++) {
      const compound = buildCompoundSpeedQuestion(currentLevel);
      if (compound && !usedHanzi.has(compound.hanzi) && !usedMeanings.has(compound.meaning)) {
        usedHanzi.add(compound.hanzi);
        usedMeanings.add(compound.meaning);
        result.push({
          hanzi: compound.hanzi,
          pinyin: compound.pinyin,
          meaning: compound.meaning,
          level: currentLevel
        });
        compoundCount++;
      }
    }

    // 2. Bổ sung các từ đơn từ wordsPool
    const shuffledWords = shuffle(wordsPool);
    for (const w of shuffledWords) {
      if (result.length >= count) break;
      if (!usedHanzi.has(w.hanzi) && !usedMeanings.has(w.meaning)) {
        usedHanzi.add(w.hanzi);
        usedMeanings.add(w.meaning);
        result.push({
          hanzi: w.hanzi,
          pinyin: w.pinyin || toPinyin(w.hanzi),
          meaning: w.meaning,
          level: w.level || currentLevel
        });
      }
    }

    // 3. Nếu vẫn chưa đủ (ví dụ wordsPool có ít từ), sinh thêm cụm từ ghép
    for (let attempts = 0; attempts < 35 && result.length < count; attempts++) {
      const compound = buildCompoundSpeedQuestion(currentLevel);
      if (compound && !usedHanzi.has(compound.hanzi) && !usedMeanings.has(compound.meaning)) {
        usedHanzi.add(compound.hanzi);
        usedMeanings.add(compound.meaning);
        result.push({
          hanzi: compound.hanzi,
          pinyin: compound.pinyin,
          meaning: compound.meaning,
          level: currentLevel
        });
      }
    }

    return shuffle(result);
  }

  function generateSpeedQuestion(wordsPool, currentLevel) {
    // 55% xuất hiện câu ghép cụm từ có nghĩa (như 我吃, 喝水, 很好...), 45% từ đơn lẻ
    const wantCompound = Math.random() < 0.55;

    if (wantCompound) {
      try {
        const compound = buildCompoundSpeedQuestion(currentLevel);
        if (compound) return compound;
      } catch (_) {}
    }

    // Từ đơn (Single word) từ wordsPool
    const targetWord = wordsPool[Math.floor(Math.random() * wordsPool.length)];
    const distractors = wordsPool
      .filter((w) => w.meaning !== targetWord.meaning && w.hanzi !== targetWord.hanzi)
      .sort(() => Math.random() - 0.5)
      .slice(0, 3)
      .map((w) => w.meaning);

    while (distractors.length < 3) {
      const fallbackItem = DEFAULT_VOCABULARY[Math.floor(Math.random() * DEFAULT_VOCABULARY.length)];
      if (!distractors.includes(fallbackItem.meaning) && fallbackItem.meaning !== targetWord.meaning) {
        distractors.push(fallbackItem.meaning);
      }
    }

    return {
      hanzi: targetWord.hanzi,
      pinyin: targetWord.pinyin || toPinyin(targetWord.hanzi),
      meaning: targetWord.meaning,
      level: targetWord.level || currentLevel,
      options: shuffle([targetWord.meaning, ...distractors]),
      isCompound: false
    };
  }

  // ==========================================
  // GAME 1: LẬT THẺ TRÍ NHỚ (MEMORY CARDS)
  // ==========================================
  function startMemoryGame(arena) {
    const wordsPool = getFilteredWords();
    if (wordsPool.length < 4) {
      arena.innerHTML = renderEmptyState(wordsPool.length, 4);
      bindGoToVocab(arena);
      return;
    }

    const pairCount = Math.min(6, wordsPool.length);
    const selectedWords = generateMixedWordPool(wordsPool, pairCount, currentLevel);

    // Create pairs: 1 Hanzi card, 1 Meaning card for each word
    const cards = [];
    selectedWords.forEach((word, index) => {
      cards.push({
        id: `h_${index}`,
        pairId: index,
        type: 'hanzi',
        text: word.hanzi,
        pinyin: word.pinyin || toPinyin(word.hanzi),
        sub: word.pinyin || toPinyin(word.hanzi),
        speakText: word.hanzi
      });
      cards.push({
        id: `m_${index}`,
        pairId: index,
        type: 'meaning',
        text: word.meaning,
        sub: 'Nghĩa',
        speakText: word.hanzi
      });
    });

    const shuffledCards = shuffle(cards);
    let flippedCards = [];
    let matchedPairs = 0;
    let moves = 0;
    let seconds = 0;
    let isLocked = false;

    arena.innerHTML = `
      <div class="memory-game-panel">
        <div class="game-hud">
          <div class="hud-item"><span>⏱️ Thời gian:</span> <strong id="memoryTimer">00:00</strong></div>
          <div class="hud-item"><span>🔄 Lượt lật:</span> <strong id="memoryMoves">0</strong></div>
          <div class="hud-item"><span>✨ Tiến độ:</span> <strong id="memoryMatches">0 / ${pairCount}</strong></div>
          <button type="button" class="game-btn-secondary" id="memoryRestart">Chơi lại ↺</button>
        </div>

        <div class="memory-board grid-${pairCount * 2}">
          ${shuffledCards
            .map(
              (card, idx) => `
            <div class="memory-card" data-card-idx="${idx}" data-pair="${card.pairId}">
              <div class="card-inner">
                <div class="card-front">
                  <img src="picture/card_back.jpg" class="card-cover-img" alt="Mặt sau thẻ bài LuLu" loading="lazy">
                </div>
                <div class="card-back ${card.type}">
                  ${card.type === 'hanzi' ? `<span class="game-pinyin">${escapeHtml(card.pinyin || toPinyin(card.text))}</span>` : ''}
                  <strong class="card-main-text">${escapeHtml(card.text)}</strong>
                  ${card.type === 'meaning' ? `<small class="card-sub-text">Nghĩa</small>` : '<span class="card-speaker-icon" title="Nghe phát âm">🔊</span>'}
                </div>
              </div>
            </div>
          `
            )
            .join('')}
        </div>
      </div>
    `;

    const timerEl = arena.querySelector('#memoryTimer');
    const movesEl = arena.querySelector('#memoryMoves');
    const matchesEl = arena.querySelector('#memoryMatches');
    const restartBtn = arena.querySelector('#memoryRestart');
    const cardEls = arena.querySelectorAll('.memory-card');

    restartBtn.addEventListener('click', () => startMemoryGame(arena));

    activeInterval = setInterval(() => {
      seconds++;
      const mm = String(Math.floor(seconds / 60)).padStart(2, '0');
      const ss = String(seconds % 60).padStart(2, '0');
      if (timerEl) timerEl.textContent = `${mm}:${ss}`;
    }, 1000);

    cardEls.forEach((cardEl) => {
      cardEl.addEventListener('click', () => {
        if (isLocked) return;
        const cardIdx = Number(cardEl.dataset.cardIdx);
        const cardData = shuffledCards[cardIdx];
        if (cardEl.classList.contains('is-matched')) {
          if (cardData.speakText) speakChinese(cardData.speakText);
          return;
        }
        if (cardEl.classList.contains('is-flipped')) return;

        sounds.playFlip();
        cardEl.classList.add('is-flipped');

        // data already captured
        // cardData already defined
        flippedCards.push({ el: cardEl, data: cardData });

        // Không phát âm khi mới lật 1 thẻ lẻ, chỉ phát âm khi lật đúng cặp

        if (flippedCards.length === 2) {
          moves++;
          if (movesEl) movesEl.textContent = moves;
          isLocked = true;

          const [first, second] = flippedCards;
          if (first.data.pairId === second.data.pairId) {
            // Match found!
            matchedPairs++;
            sounds.playCorrect();
            first.el.classList.add('is-matched');
            second.el.classList.add('is-matched');

            // Tự động phát âm chuẩn xác từ tiếng Trung khi lật chính xác 1 từ (khớp cặp)
            const hanziToSpeak = first.data.type === 'hanzi' ? first.data.speakText : second.data.speakText;
            if (hanziToSpeak) {
              setTimeout(() => {
                speakChinese(hanziToSpeak);
              }, 120);
            }
            if (matchesEl) matchesEl.textContent = `${matchedPairs} / ${pairCount}`;
            flippedCards = [];
            isLocked = false;

            if (matchedPairs === pairCount) {
              clearActiveInterval();
              sounds.playVictory();
              recordScore({ category: 'game', points: SCORE_RULES.GAME_MEMORY_FINISH, description: 'Hoàn thành Lật thẻ trí nhớ' });
              const finalScore = Math.max(100, 1000 - moves * 18 - seconds * 8);
              const bestScore = Number(localStorage.getItem('mandarinly_game_best_memory') || 0);
              if (finalScore > bestScore) {
                localStorage.setItem('mandarinly_game_best_memory', String(finalScore));
              }

              setTimeout(() => {
                showVictoryModal(arena, {
                  title: 'Tuyệt đỉnh trí nhớ! 🎴',
                  score: finalScore,
                  stats: [
                    { label: 'Thời gian', value: `${seconds}s` },
                    { label: 'Số lượt lật', value: moves },
                    { label: 'Độ chính xác', value: `${Math.round((pairCount / moves) * 100)}%` }
                  ],
                  onReplay: () => startMemoryGame(arena)
                });
              }, 400);
            }
          } else {
            // No match
            sounds.playWrong();
            setTimeout(() => {
              first.el.classList.remove('is-flipped');
              second.el.classList.remove('is-flipped');
              flippedCards = [];
              isLocked = false;
            }, 850);
          }
        }
      });
    });
  }

  // ==========================================
  // GAME 2: ĐUA TỐC ĐỘ 60S (SPEED BLITZ)
  // ==========================================

  function startSpeedGame(arena) {
    const wordsPool = getFilteredWords();
    if (wordsPool.length < 4) {
      arena.innerHTML = renderEmptyState(wordsPool.length, 4);
      bindGoToVocab(arena);
      return;
    }

    let timeLeft = 60;
    let score = 0;
    let streak = 0;
    let maxStreak = 0;
    let answeredCount = 0;
    let correctCount = 0;
    let isGameOver = false;

    arena.innerHTML = `
      <div class="speed-game-panel">
        <div class="speed-hud">
          <div class="speed-timer-wrap" id="speedTimerWrap">
            <div class="speed-flower-actor" id="speedFlowerActor" title="Hoa ăn thịt sẽ nuốt chửng rồng nếu hết giờ!">
              <img src="picture/flower.jpg" alt="Hoa ăn thịt" class="speed-flower-img" id="speedFlowerImg" />
              <span class="flower-chomp-fx" id="flowerChompFx">NGOÀM! 💥</span>
            </div>
            <div class="speed-timer-track">
              <div class="speed-timer-bar">
                <i id="speedProgress"></i>
              </div>
              <div class="speed-dragon-actor align-right" id="speedDragonActor" style="left: 100%;">
                <div class="dragon-speech-bubble" id="dragonSpeechBubble" aria-live="polite"></div>
                <div class="dragon-fly-rig">
                  <span class="dragon-wind-lines"><i></i><i></i><i></i></span>
                  <img src="picture/lulu_fly.jpg" alt="Chú rồng bay" class="speed-dragon-img" id="speedDragonImg" />
                  <span class="dragon-panic-sweat">💦</span>
                </div>
                <span class="dragon-ground-shadow"></span>
              </div>
            </div>
            <strong class="speed-seconds-pill" id="speedSeconds">60s</strong>
          </div>
          <div class="speed-score-box">
            <span>Điểm số</span>
            <strong id="speedScore">0</strong>
          </div>
          <div class="speed-streak-box">
            <span>Combo</span>
            <strong id="speedStreak">0x</strong>
          </div>
        </div>

        <div class="speed-card" id="speedCard">
          <div class="speed-mode-bar">
            <div class="speed-mode-switch" role="group" aria-label="Chế độ hiển thị câu hỏi">
              <button type="button" class="speed-mode-pill" data-speed-mode="visual">
                👀 Nhìn chữ
              </button>
              <button type="button" class="speed-mode-pill" data-speed-mode="audio">
                🎧 Nghe phản xạ <small>+20%</small>
              </button>
            </div>
            <div class="speed-audio-actions">
              <button type="button" class="speed-speak-btn" id="speedSpeakBtn" title="Phát âm chuẩn (1.0x)">🔊 1.0x</button>
              <button type="button" class="speed-speak-btn speed-slow-btn" id="speedSlowBtn" title="Nghe chậm (0.75x)">🐢 0.75x</button>
            </div>
          </div>
          <div class="speed-word-box">
            <button type="button" class="speed-audio-mystery" id="speedAudioMystery" title="Nhấn để nghe lại phát âm">
              <span class="mystery-headphone-icon">🎧</span>
              <span class="mystery-wave-bars"><i></i><i></i><i></i><i></i><i></i></span>
              <span class="mystery-hint-text">Nghe phát âm &amp; chọn nghĩa đúng</span>
            </button>
            <div class="speed-visual-word" id="speedVisualWord">
              <span class="speed-pinyin game-pinyin" id="speedPinyin"></span>
              <h2 class="speed-hanzi" id="speedHanzi">...</h2>
            </div>
          </div>
          <div class="speed-options" id="speedOptions"></div>
        </div>
      </div>
    `;

    const speedCardEl = arena.querySelector('#speedCard');
    const timerWrapEl = arena.querySelector('#speedTimerWrap');
    const flowerActorEl = arena.querySelector('#speedFlowerActor');
    const dragonActorEl = arena.querySelector('#speedDragonActor');
    const dragonBubbleEl = arena.querySelector('#dragonSpeechBubble');
    const progressEl = arena.querySelector('#speedProgress');
    const secondsEl = arena.querySelector('#speedSeconds');
    const scoreEl = arena.querySelector('#speedScore');
    const streakEl = arena.querySelector('#speedStreak');
    const hanziEl = arena.querySelector('#speedHanzi');
    const pinyinEl = arena.querySelector('#speedPinyin');
    const speakBtn = arena.querySelector('#speedSpeakBtn');
    const slowBtn = arena.querySelector('#speedSlowBtn');
    const mysteryBtn = arena.querySelector('#speedAudioMystery');
    const optionsContainer = arena.querySelector('#speedOptions');

    let isAudioOnly = localStorage.getItem('mandarinly_speed_audio_mode') === 'true';
    let currentTargetWord = null;

    function syncSpeedAudioModeUI() {
      if (speedCardEl) {
        speedCardEl.classList.toggle('is-audio-only', isAudioOnly);
      }
      arena.querySelectorAll('[data-speed-mode]').forEach((btn) => {
        btn.classList.toggle('active', (btn.dataset.speedMode === 'audio') === isAudioOnly);
      });
    }
    syncSpeedAudioModeUI();

    arena.querySelectorAll('[data-speed-mode]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const nextMode = btn.dataset.speedMode === 'audio';
        if (nextMode === isAudioOnly) return;
        isAudioOnly = nextMode;
        localStorage.setItem('mandarinly_speed_audio_mode', String(isAudioOnly));
        if (speedCardEl) speedCardEl.classList.remove('is-revealed');
        syncSpeedAudioModeUI();
        if (isAudioOnly) {
          sayLulu('Chế độ Nghe Phản Xạ! Dỏng tai nghe kỹ nhé! 🎧', 'info', 2200);
          if (currentTargetWord) speakChinese(currentTargetWord.hanzi, null, { rate: 0.85, force: true });
        } else {
          sayLulu('Đã bật lại chế độ nhìn mặt chữ Hán! 👀', 'info', 1800);
        }
      });
    });

    let speechHideTimer = null;
    let lastSpeechText = '';
    let lastSpeechAt = 0;
    let lastActionAt = Date.now();

    function syncBubbleAlignment(pct) {
      if (!dragonActorEl) return;
      dragonActorEl.classList.toggle('align-left', pct < 38);
      dragonActorEl.classList.toggle('align-right', pct > 64);
    }

    function pickLine(lines) {
      if (!lines || !lines.length) return '';
      if (lines.length === 1) return lines[0];
      const candidates = lines.filter((line) => line !== lastSpeechText);
      const pool = candidates.length ? candidates : lines;
      return pool[Math.floor(Math.random() * pool.length)];
    }

    function sayLulu(text, mood = 'info', duration = 2300) {
      if (!dragonBubbleEl || !text) return;
      lastSpeechText = text;
      lastSpeechAt = Date.now();
      if (speechHideTimer) clearTimeout(speechHideTimer);

      dragonBubbleEl.className = `dragon-speech-bubble mood-${mood}`;
      dragonBubbleEl.textContent = text;
      void dragonBubbleEl.offsetWidth;
      dragonBubbleEl.classList.add('is-visible');

      if (duration > 0) {
        speechHideTimer = setTimeout(() => {
          dragonBubbleEl.classList.remove('is-visible');
        }, duration);
      }
    }

    // Tự động tách nền caro của picture/lulu_fly.jpg và picture/flower.jpg bằng Flood-Fill từ viền ảnh
    function makeCheckerboardTransparent(imgEl) {
      if (!imgEl) return;
      const srcKey = imgEl.getAttribute('src');
      if (!window.__luluSpriteCache) window.__luluSpriteCache = new Map();
      if (window.__luluSpriteCache.has(srcKey)) {
        imgEl.src = window.__luluSpriteCache.get(srcKey);
        return;
      }
      const process = () => {
        try {
          const nw = imgEl.naturalWidth;
          const nh = imgEl.naturalHeight;
          if (!nw || !nh) return;
          const maxDim = 240;
          const scale = Math.min(1, maxDim / Math.max(nw, nh));
          const w = Math.max(1, Math.round(nw * scale));
          const h = Math.max(1, Math.round(nh * scale));
          const cvs = document.createElement('canvas');
          cvs.width = w;
          cvs.height = h;
          const ctx = cvs.getContext('2d');
          ctx.drawImage(imgEl, 0, 0, w, h);
          const imgData = ctx.getImageData(0, 0, w, h);
          const data = imgData.data;
          const visited = new Uint8Array(w * h);
          const queue = new Int32Array(w * h);
          let head = 0;
          let tail = 0;

          const isCheckerBg = (idx) => {
            const r = data[idx];
            const g = data[idx + 1];
            const b = data[idx + 2];
            const maxC = Math.max(r, g, b);
            const minC = Math.min(r, g, b);
            // Ô caro xám/trắng có độ bão hòa màu rất thấp (R≈G≈B) và không phải viền đen đậm
            return maxC - minC <= 22 && maxC >= 42;
          };

          const enqueue = (x, y) => {
            if (x < 0 || x >= w || y < 0 || y >= h) return;
            const pos = y * w + x;
            if (visited[pos]) return;
            const idx = pos * 4;
            if (isCheckerBg(idx)) {
              visited[pos] = 1;
              queue[tail++] = pos;
            }
          };

          for (let x = 0; x < w; x++) {
            enqueue(x, 0);
            enqueue(x, h - 1);
          }
          for (let y = 0; y < h; y++) {
            enqueue(0, y);
            enqueue(w - 1, y);
          }

          while (head < tail) {
            const pos = queue[head++];
            const idx = pos * 4;
            data[idx + 3] = 0;
            const x = pos % w;
            const y = (pos - x) / w;
            enqueue(x + 1, y);
            enqueue(x - 1, y);
            enqueue(x, y + 1);
            enqueue(x, y - 1);
          }

          // Làm mượt viền 1px tiếp giáp nền và tự động cắt sát khung nhân vật
          let minX = w, minY = h, maxX = 0, maxY = 0;
          for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
              const pos = y * w + x;
              const idx = pos * 4;
              if (data[idx + 3] > 0) {
                let adjBg = 0;
                if (x > 0 && visited[pos - 1]) adjBg++;
                if (x < w - 1 && visited[pos + 1]) adjBg++;
                if (y > 0 && visited[pos - w]) adjBg++;
                if (y < h - 1 && visited[pos + w]) adjBg++;
                if (adjBg >= 2 && isCheckerBg(idx)) {
                  data[idx + 3] = 0;
                  continue;
                }
                if (x < minX) minX = x;
                if (x > maxX) maxX = x;
                if (y < minY) minY = y;
                if (y > maxY) maxY = y;
              }
            }
          }

          ctx.putImageData(imgData, 0, 0);
          if (maxX > minX && maxY > minY) {
            const cw = maxX - minX + 1;
            const ch = maxY - minY + 1;
            const cropCvs = document.createElement('canvas');
            cropCvs.width = cw;
            cropCvs.height = ch;
            cropCvs.getContext('2d').drawImage(cvs, minX, minY, cw, ch, 0, 0, cw, ch);
            const cleanUrl = cropCvs.toDataURL('image/png');
            window.__luluSpriteCache.set(srcKey, cleanUrl);
            imgEl.src = cleanUrl;
          } else {
            const cleanUrl = cvs.toDataURL('image/png');
            window.__luluSpriteCache.set(srcKey, cleanUrl);
            imgEl.src = cleanUrl;
          }
        } catch (_) {}
      };
      if (imgEl.complete && imgEl.naturalWidth > 0) process();
      else imgEl.addEventListener('load', process, { once: true });
    }

    makeCheckerboardTransparent(arena.querySelector('#speedFlowerImg'));
    makeCheckerboardTransparent(arena.querySelector('#speedDragonImg'));

    function updateTimerUI() {
      if (secondsEl) secondsEl.textContent = `${Math.max(0, timeLeft)}s`;
      const pct = Math.min(100, Math.max(0, (timeLeft / 60) * 100));
      if (progressEl) {
        progressEl.style.width = `${pct}%`;
        progressEl.style.background =
          timeLeft <= 12
            ? 'linear-gradient(90deg, #ef4444 0%, #f97316 100%)'
            : 'linear-gradient(90deg, #3b8256 0%, #4f9d72 60%, #34d399 100%)';
      }
      if (dragonActorEl) {
        dragonActorEl.style.left = `${pct}%`;
      }
      syncBubbleAlignment(pct);
      if (timerWrapEl) {
        timerWrapEl.classList.toggle('is-danger', timeLeft > 0 && timeLeft <= 12);
      }
    }

    function showTimeDelta(delta) {
      const isPositive = delta > 0;
      const deltaEl = document.createElement('span');
      deltaEl.className = `time-delta ${isPositive ? 'plus' : 'minus'}`;
      deltaEl.textContent = isPositive ? `+${delta}s` : `${delta}s`;
      if (timerWrapEl) {
        timerWrapEl.appendChild(deltaEl);
        setTimeout(() => deltaEl.remove(), 750);
      }
      if (dragonActorEl) {
        dragonActorEl.classList.remove('is-boosting', 'is-stumbling');
        void dragonActorEl.offsetWidth;
        dragonActorEl.classList.add(isPositive ? 'is-boosting' : 'is-stumbling');
      }
    }

    function triggerGameOver() {
      if (isGameOver) return;
      clearActiveInterval();
      if (speechHideTimer) clearTimeout(speechHideTimer);
      isGameOver = true;
      timeLeft = 0;
      updateTimerUI();
      if (dragonBubbleEl) dragonBubbleEl.classList.remove('is-visible');

      optionsContainer?.querySelectorAll('button').forEach((b) => (b.disabled = true));

      // Kích hoạt hiệu ứng Hoa ăn thịt nuốt chửng chú rồng khi hết giờ
      if (timerWrapEl) {
        timerWrapEl.classList.remove('is-danger');
        timerWrapEl.classList.add('is-eating');
      }
      if (flowerActorEl) {
        for (let i = 0; i < 8; i++) {
          const crumb = document.createElement('span');
          crumb.className = 'flower-bite-particle';
          crumb.textContent = ['🍃', '✨', '💥', '🍊'][i % 4];
          const angle = (Math.PI * 2 * i) / 8;
          crumb.style.setProperty('--tx', `${Math.round(Math.cos(angle) * 34)}px`);
          crumb.style.setProperty('--ty', `${Math.round(Math.sin(angle) * 28)}px`);
          flowerActorEl.appendChild(crumb);
          setTimeout(() => crumb.remove(), 900);
        }
      }
      sounds.playChomp();

      const earnedPoints = Math.min(100, Math.max(15, Math.round(score * 0.1)));
      recordScore({ category: 'game', points: earnedPoints, description: `Đua tốc độ 60s (${score}đ)` });

      const bestScore = Number(localStorage.getItem('mandarinly_game_best_speed') || 0);
      if (score > bestScore) {
        localStorage.setItem('mandarinly_game_best_speed', String(score));
      }

      setTimeout(() => {
        if (!document.body.contains(arena)) return;
        sounds.playVictory();
        showVictoryModal(arena, {
          title: 'Hết giờ! Hoa ăn thịt đã đớp gọn chú rồng 🦖🌿',
          score: score,
          stats: [
            { label: 'Số câu làm được', value: answeredCount },
            { label: 'Trả lời đúng', value: `${correctCount} câu` },
            { label: 'Combo dài nhất', value: `${maxStreak}x 🔥` },
            {
              label: 'Độ chính xác',
              value: answeredCount ? `${Math.round((correctCount / answeredCount) * 100)}%` : '0%'
            }
          ],
          onReplay: () => startSpeedGame(arena)
        });
      }, 1150);
    }

    function nextQuestion() {
      if (isGameOver) return;
      lastActionAt = Date.now();
      const target = generateSpeedQuestion(wordsPool, currentLevel);
      currentTargetWord = target;

      if (speedCardEl) speedCardEl.classList.remove('is-revealed');
      hanziEl.textContent = target.hanzi;
      pinyinEl.textContent = target.pinyin || toPinyin(target.hanzi);
      speakChinese(target.hanzi, null, { rate: 0.85, force: isAudioOnly });

      speakBtn.onclick = () => speakChinese(target.hanzi, null, { rate: 0.85, force: true });
      if (slowBtn) slowBtn.onclick = () => speakChinese(target.hanzi, null, { rate: 0.62, force: true });
      if (mysteryBtn) mysteryBtn.onclick = () => speakChinese(target.hanzi, null, { rate: 0.85, force: true });

      const options = target.options;

      optionsContainer.innerHTML = options
        .map(
          (opt) => `
        <button type="button" class="speed-opt-btn" data-meaning="${escapeHtml(opt)}">
          ${escapeHtml(opt)}
        </button>
      `
        )
        .join('');

      optionsContainer.querySelectorAll('.speed-opt-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
          if (isGameOver) return;
          lastActionAt = Date.now();
          answeredCount++;
          const chosen = btn.dataset.meaning;
          const isCorrect = chosen === target.meaning;

          if (isAudioOnly && speedCardEl) {
            speedCardEl.classList.add('is-revealed');
          }

          if (isCorrect) {
            correctCount++;
            streak++;
            if (streak > maxStreak) maxStreak = streak;
            sounds.playCorrect();

            const wasInDanger = timeLeft <= 14;
            // Thưởng thêm +3 giây khi trả lời đúng
            timeLeft += 3;
            updateTimerUI();
            showTimeDelta(3);

            // Lời thoại của LuLu theo tiến độ trả lời đúng & Combo
            if (streak >= 6) {
              sayLulu(
                pickLine([
                  `Siêu cấp ${streak}x! Không ai cản nổi! 👑`,
                  'Thần đồng tiếng Trung đây rồi! ⚡',
                  `Combo ${streak}x cháy quá! Bay lên mây luôn! 🌟`,
                  'Đỉnh nóc kịch trần! Hoa hít khói rồi! 🚀'
                ]),
                'combo',
                2200
              );
            } else if (streak >= 3) {
              sayLulu(
                pickLine([
                  `Combo ${streak}x! Giỏi lắm bạn ơi! 🔥`,
                  'Tuyệt vời! Tốc độ tên lửa! 🚀',
                  'Quá chuẩn! LuLu bay vèo vèo luôn! ✨',
                  'Xuất sắc! Bỏ xa hoa ăn thịt rồi! 😎'
                ]),
                'combo',
                2100
              );
            } else if (wasInDanger) {
              sayLulu(
                pickLine([
                  'Hú hồn! Cứu LuLu kịp lúc lắm! 😮‍💨',
                  'May quá! Thoát khỏi miệng hoa rồi! 🪽',
                  'Giỏi lắm! Cố thêm vài câu để bay xa nào! 💪'
                ]),
                'praise',
                2100
              );
            } else if (isAudioOnly) {
              sayLulu(
                pickLine([
                  'Tai thính quá! Nghe chuẩn luôn! 🎧',
                  'Phản xạ nghe đỉnh thật sự! +3s 👂✨',
                  'Chuẩn luôn! Nghe phát bắt trúng ngay! 🍊'
                ]),
                'praise',
                1900
              );
            } else {
              sayLulu(
                pickLine([
                  'Giỏi lắm! +3 giây bay tiếp! 🍊',
                  'Chuẩn luôn! Bay cao nào! ✨',
                  'Đúng rồi! Cứ thế phát huy nhé! 👍',
                  'Tuyệt cú mèo! Nhanh trí lắm! 🌟',
                  'Quá nhạy! Xa bông hoa thêm chút rồi! 🪽'
                ]),
                'praise',
                1900
              );
            }

            const multiplier = Math.min(4, 1 + Math.floor(streak / 3));
            const basePoints = isAudioOnly ? 120 : 100;
            score += basePoints * multiplier;

            btn.classList.add('opt-correct');
            optionsContainer.querySelectorAll('button').forEach((b) => (b.disabled = true));

            scoreEl.textContent = score;
            streakEl.textContent = `${streak}x 🔥`;
            streakEl.classList.add('pulse');
            setTimeout(() => streakEl.classList.remove('pulse'), 300);

            setTimeout(nextQuestion, isAudioOnly ? 460 : 280);
          } else {
            streak = 0;
            sounds.playWrong();
            btn.classList.add('opt-wrong');
            streakEl.textContent = '0x';
            recordMistakeWord({
              hanzi: target.hanzi,
              pinyin: target.pinyin,
              meaning: target.meaning,
              level: target.level || currentLevel,
              source: 'Đua tốc độ 60s'
            });

            // Phạt trừ -3 giây khi trả lời sai
            timeLeft = Math.max(0, timeLeft - 3);
            updateTimerUI();
            showTimeDelta(-3);

            optionsContainer.querySelectorAll('.speed-opt-btn').forEach((b) => {
              b.disabled = true;
              if (b.dataset.meaning === target.meaning) {
                b.classList.add('opt-correct');
              }
            });

            if (timeLeft <= 0) {
              triggerGameOver();
              return;
            }

            if (timeLeft <= 15) {
              sayLulu(
                pickLine([
                  'Ối! Trừ 3 giây là sát miệng hoa rồi! 😱',
                  'Nguy to! Hoa ăn thịt ngay sau lưng kìa! 🆘',
                  'Cẩn thận bạn ơi! Sắp bị hoa đớp rồi! 💦'
                ]),
                'panic',
                2300
              );
            } else {
              sayLulu(
                pickLine([
                  'Ái chà! Lùi mất 3 giây rồi, cố lên! 💪',
                  'Hự! Sai mất tiêu, bình tĩnh chọn lại nhé! 😵',
                  'Suýt đúng rồi! Đừng để hoa đuổi kịp nha! 🌿',
                  'Ối, chao đảo quá! Tập trung nào bạn ơi! 👀'
                ]),
                'oops',
                2100
              );
            }

            setTimeout(nextQuestion, isAudioOnly ? 780 : 600);
          }
        });
      });
    }

    nextQuestion();
    sayLulu(
      pickLine([
        'Bay thôi! Đừng để hoa đớp LuLu nhé! 🍊',
        'Xuất phát! Giúp LuLu bay thật xa nào! ✨'
      ]),
      'info',
      2600
    );

    activeInterval = setInterval(() => {
      timeLeft--;
      updateTimerUI();

      if (timeLeft <= 0) {
        triggerGameOver();
        return;
      }

      const now = Date.now();
      const idleMs = now - lastActionAt;
      const sinceLastSpeech = now - lastSpeechAt;

      // Lời thoại cảnh báo khẩn cấp khi thời gian sắp cạn
      if (timeLeft === 12) {
        sayLulu('Cứu LuLu! Hoa ăn thịt há miệng rồi kìa! 😱', 'panic', 2600);
      } else if (timeLeft === 8 && sinceLastSpeech > 1400) {
        sayLulu('Nhanh lên!! Nó sắp đớp trúng đuôi LuLu rồi! 💦', 'panic', 2400);
      } else if (timeLeft === 4 && sinceLastSpeech > 1200) {
        sayLulu('Á á á! Sát miệng hoa lắm rồi!! 🆘', 'panic', 2400);
      } else if (timeLeft === 22 && sinceLastSpeech > 2200) {
        sayLulu('Nhanh lên bạn ơi! Còn 22 giây thôi! ⏰', 'hurry', 2200);
      } else if (timeLeft === 35 && sinceLastSpeech > 2500) {
        sayLulu(
          score >= 500
            ? 'Phong độ đỉnh quá, giữ vững tốc độ nhé! 🔥'
            : 'Nửa chặng đường rồi, tăng tốc lên nào! ⚡',
          'info',
          2200
        );
      } else if (idleMs >= 4200 && sinceLastSpeech >= 3200) {
        // Nhắc nhở khi người chơi ngập ngừng lâu chưa chọn đáp án
        if (timeLeft <= 15) {
          sayLulu(
            pickLine([
              'Nhanh lên!! Hoa sắp đớp LuLu tới nơi rồi! 😱',
              'Chọn nhanh cứu LuLu với!! 🆘'
            ]),
            'panic',
            2200
          );
        } else {
          sayLulu(
            pickLine([
              'Nhanh lên nào, hoa đang tiến lại gần kìa! ⏳',
              'Chốt đáp án lẹ thôi, LuLu mỏi cánh quá! 🪽',
              'Suy nghĩ nhanh nào, thời gian đang trôi! ⚡'
            ]),
            'hurry',
            2200
          );
        }
      }
    }, 1000);
  }

  // ==========================================
  // GAME 3: NỐI CẶP TỪ VỰNG (WORD MATCH)
  // ==========================================
  function startMatchGame(arena) {
    const wordsPool = getFilteredWords();
    if (wordsPool.length < 4) {
      arena.innerHTML = renderEmptyState(wordsPool.length, 4);
      bindGoToVocab(arena);
      return;
    }

    let round = 1;
    let score = 0;
    const batchSize = Math.min(5, wordsPool.length);

    function renderRound() {
      const selectedWords = generateMixedWordPool(wordsPool, batchSize, currentLevel);
      const hanziList = shuffle(
        selectedWords.map((w, idx) => ({ id: idx, text: w.hanzi, pinyin: w.pinyin || toPinyin(w.hanzi) }))
      );
      const meaningList = shuffle(
        selectedWords.map((w, idx) => ({ id: idx, text: w.meaning }))
      );

      let selectedHanzi = null;
      let selectedMeaning = null;
      let matchedCount = 0;

      arena.innerHTML = `
        <div class="match-game-panel">
          <div class="match-hud">
            <div class="hud-item"><span>Vòng chơi:</span> <strong>Bài ${round}</strong></div>
            <div class="hud-item"><span>Điểm số:</span> <strong id="matchScore">${score}</strong></div>
            <div class="hud-item"><span>Cặp đã nối:</span> <strong id="matchProgress">${matchedCount} / ${batchSize}</strong></div>
            <button type="button" class="game-btn-secondary" id="matchRestart">Làm mới ↺</button>
          </div>

          <div class="match-board">
            <div class="match-column" id="matchHanziCol">
              <h3 class="col-title">Chữ Hán 🀄</h3>
              ${hanziList
                .map(
                  (item) => `
                <button type="button" class="match-card match-hanzi" data-id="${item.id}" data-text="${escapeHtml(item.text)}">
                  <small class="game-pinyin">${escapeHtml(item.pinyin || toPinyin(item.text))}</small>
                  <strong>${escapeHtml(item.text)}</strong>
                </button>
              `
                )
                .join('')}
            </div>

            <div class="match-divider">⮂ ⮄</div>

            <div class="match-column" id="matchMeaningCol">
              <h3 class="col-title">Nghĩa tiếng Việt 🇻🇳</h3>
              ${meaningList
                .map(
                  (item) => `
                <button type="button" class="match-card match-meaning" data-id="${item.id}">
                  <span>${escapeHtml(item.text)}</span>
                </button>
              `
                )
                .join('')}
            </div>
          </div>
        </div>
      `;

      const scoreEl = arena.querySelector('#matchScore');
      const progressEl = arena.querySelector('#matchProgress');
      const restartBtn = arena.querySelector('#matchRestart');
      const hanziButtons = arena.querySelectorAll('.match-hanzi');
      const meaningButtons = arena.querySelectorAll('.match-meaning');

      restartBtn.addEventListener('click', () => startMatchGame(arena));

      function checkPair() {
        if (!selectedHanzi || !selectedMeaning) return;

        const hanziId = selectedHanzi.dataset.id;
        const meaningId = selectedMeaning.dataset.id;

        if (hanziId === meaningId) {
          // Success match
          sounds.playCorrect();
          speakChinese(selectedHanzi.dataset.text);

          selectedHanzi.classList.add('is-done');
          selectedMeaning.classList.add('is-done');
          selectedHanzi.disabled = true;
          selectedMeaning.disabled = true;

          score += 150;
          matchedCount++;
          if (scoreEl) scoreEl.textContent = score;
          if (progressEl) progressEl.textContent = `${matchedCount} / ${batchSize}`;

          selectedHanzi = null;
          selectedMeaning = null;

          if (matchedCount === batchSize) {
            sounds.playVictory();
            recordScore({ category: 'game', points: SCORE_RULES.GAME_MATCH_ROUND, description: `Nối từ vựng Vòng ${round}` });
            const bestScore = Number(localStorage.getItem('mandarinly_game_best_match') || 0);
            if (score > bestScore) {
              localStorage.setItem('mandarinly_game_best_match', String(score));
            }

            setTimeout(() => {
              round++;
              if (toast) toast(`Xuất sắc! Tiến vào Vòng ${round} ✦`);
              renderRound();
            }, 600);
          }
        } else {
          // Failed match
          sounds.playWrong();
          const hEl = selectedHanzi;
          const mEl = selectedMeaning;
          const wrongWord = selectedWords[Number(hEl.dataset.id)];
          if (wrongWord) {
            recordMistakeWord({
              hanzi: wrongWord.hanzi,
              pinyin: wrongWord.pinyin,
              meaning: wrongWord.meaning,
              level: wrongWord.level,
              source: 'Nối cặp từ'
            });
          }
          hEl.classList.add('is-wrong');
          mEl.classList.add('is-wrong');

          setTimeout(() => {
            hEl.classList.remove('is-wrong', 'is-selected');
            mEl.classList.remove('is-wrong', 'is-selected');
          }, 450);

          selectedHanzi = null;
          selectedMeaning = null;
        }
      }

      hanziButtons.forEach((btn) => {
        btn.addEventListener('click', () => {
          if (btn.classList.contains('is-done')) return;
          sounds.playFlip();
          speakChinese(btn.dataset.text);

          hanziButtons.forEach((b) => b.classList.remove('is-selected'));
          btn.classList.add('is-selected');
          selectedHanzi = btn;

          checkPair();
        });
      });

      meaningButtons.forEach((btn) => {
        btn.addEventListener('click', () => {
          if (btn.classList.contains('is-done')) return;
          sounds.playFlip();

          meaningButtons.forEach((b) => b.classList.remove('is-selected'));
          btn.classList.add('is-selected');
          selectedMeaning = btn;

          checkPair();
        });
      });
    }

    renderRound();
  }

  // ==========================================
  // GAME 4: CHẠM TỪ RƠI (WORD FALL TAP)
  // ==========================================
  function startCatchGame(arena) {
    const wordsPool = getFilteredWords();
    if (wordsPool.length < 4) {
      arena.innerHTML = renderEmptyState(wordsPool.length, 4);
      bindGoToVocab(arena);
      return;
    }

    let score = 0;
    let streak = 0;
    let maxStreak = 0;
    let caughtCount = 0;
    let attemptsCount = 0;
    let elapsedSeconds = 0;
    let lives = 3;
    let isGameOver = false;
    let currentTarget = null;
    let fallingWords = [];
    let isTransitioningWave = false;
    let maxSpeedMultiplier = 1.0;

    const baseSpeed = 0.75; // Tốc độ cơ bản êm ái, dễ nhìn (~45px/s, rơi qua bảng mất ~9.8s)

    function formatTime(sec) {
      const m = Math.floor(sec / 60);
      const s = sec % 60;
      return m > 0 ? `${m}m ${s < 10 ? '0' : ''}${s}s` : `${s}s`;
    }

    function formatSpeed(m) {
      const rounded = Math.round(m * 100) / 100;
      return (rounded % 0.1 === 0) ? `${rounded.toFixed(1)}x` : `${rounded.toFixed(2)}x`;
    }

    function getCurrentSpeed() {
      // Tăng tốc độ rất từ từ theo từng nấc 0.05 (1.0x -> 1.05x -> 1.1x -> 1.15x -> 1.2x...)
      const wordSteps = Math.floor(caughtCount / 2); // Cứ mỗi 2 từ chạm đúng tăng 0.05
      const timeSteps = Math.floor(elapsedSeconds / 25); // Cứ mỗi 25 giây sống sót tăng 0.05
      const steps = wordSteps + timeSteps;
      const rawMultiplier = 1.0 + (steps * 0.05);
      const cappedMultiplier = Math.min(2.5, rawMultiplier);
      if (cappedMultiplier > maxSpeedMultiplier) {
        maxSpeedMultiplier = cappedMultiplier;
      }
      return {
        speed: baseSpeed * cappedMultiplier,
        multiplier: cappedMultiplier
      };
    }

    arena.innerHTML = `
      <div class="catch-game-panel">
        <div class="catch-hud">
          <div class="hud-item">
            <span>⏱️ Sống sót:</span>
            <strong id="catchSeconds">0s</strong>
          </div>
          <div class="hud-item">
            <span>⚡ Tốc độ:</span>
            <strong id="catchSpeed" style="color:#27ae60;">1.0x</strong>
          </div>
          <div class="hud-item">
            <span>❤️ Mạng:</span>
            <strong id="catchLives">❤️❤️❤️</strong>
          </div>
          <div class="hud-item">
            <span>🏆 Điểm số:</span>
            <strong id="catchScore">0</strong>
          </div>
          <div class="hud-item">
            <span>🔥 Combo:</span>
            <strong id="catchStreak">0x</strong>
          </div>
          <button type="button" class="game-btn-secondary" id="catchRestart">Chơi lại ↺</button>
        </div>

        <div class="catch-prompt-box" id="catchPromptBox">
          <span>Chạm vào chữ Hán có nghĩa:</span>
          <strong id="catchTargetText">...</strong>
          <button type="button" class="speed-speak-btn" id="catchSpeakBtn" title="Phát âm" style="position:static;transform:none;width:32px;height:32px;font-size:14px;">🔊</button>
        </div>

        <div class="catch-board" id="catchBoard">
          <div class="falling-items-wrap" id="fallingContainer"></div>
        </div>
      </div>
    `;

    const catchBoard = arena.querySelector('#catchBoard');
    const fallingContainer = arena.querySelector('#fallingContainer');
    const targetTextEl = arena.querySelector('#catchTargetText');
    const speakBtn = arena.querySelector('#catchSpeakBtn');
    const secondsEl = arena.querySelector('#catchSeconds');
    const speedEl = arena.querySelector('#catchSpeed');
    const livesEl = arena.querySelector('#catchLives');
    const scoreEl = arena.querySelector('#catchScore');
    const streakEl = arena.querySelector('#catchStreak');
    const restartBtn = arena.querySelector('#catchRestart');

    function updateSpeedDisplay() {
      if (!speedEl) return;
      const { multiplier } = getCurrentSpeed();
      speedEl.textContent = formatSpeed(multiplier);
      if (multiplier >= 1.8) {
        speedEl.style.color = '#e74c3c';
      } else if (multiplier >= 1.3) {
        speedEl.style.color = '#e67e22';
      } else {
        speedEl.style.color = '#27ae60';
      }
    }

    restartBtn.addEventListener('click', () => startCatchGame(arena));

    function showPopupText(text, isPositive, x, y) {
      const popup = document.createElement('span');
      popup.className = `catch-popup ${isPositive ? 'plus' : 'minus'}`;
      popup.textContent = text;
      popup.style.left = `${x}px`;
      popup.style.top = `${y}px`;
      catchBoard.appendChild(popup);
      setTimeout(() => popup.remove(), 750);
    }

    function triggerGameOver() {
      if (isGameOver) return;
      isGameOver = true;
      clearActiveGame();
      sounds.playVictory();

      const earnedPoints = Math.min(100, Math.max(15, Math.round(score * 0.08)));
      recordScore({ category: 'game', points: earnedPoints, description: `Chạm từ rơi (${score}đ - ${formatTime(elapsedSeconds)})` });

      const bestScore = Number(localStorage.getItem('mandarinly_game_best_catch') || 0);
      if (score > bestScore) {
        localStorage.setItem('mandarinly_game_best_catch', String(score));
      }

      showVictoryModal(arena, {
        title: 'Hết mạng! Trò chơi kết thúc 🎯',
        score: score,
        stats: [
          { label: 'Thời gian sống sót', value: formatTime(elapsedSeconds) },
          { label: 'Số từ chạm đúng', value: `${caughtCount} từ` },
          { label: 'Tốc độ tối đa', value: `${formatSpeed(maxSpeedMultiplier)} ⚡` },
          { label: 'Combo lớn nhất', value: `${maxStreak}x 🔥` },
          { label: 'Độ chính xác', value: attemptsCount ? `${Math.round((caughtCount / attemptsCount) * 100)}%` : '0%' }
        ],
        onReplay: () => startCatchGame(arena)
      });
    }

    function onWordTapped(item) {
      if (isGameOver || isTransitioningWave || item.handled) return;
      item.handled = true;
      attemptsCount++;

      if (item.isCorrect) {
        // Chạm trúng từ đúng!
        isTransitioningWave = true;
        caughtCount++;
        streak++;
        if (streak > maxStreak) maxStreak = streak;

        sounds.playCorrect();
        speakChinese(item.hanzi);

        const multiplier = Math.min(4, 1 + Math.floor(streak / 3));
        const addedScore = 100 * multiplier;
        score += addedScore;

        scoreEl.textContent = score;
        streakEl.textContent = `${streak}x 🔥`;
        updateSpeedDisplay();

        item.el.classList.add('pop-correct');
        showPopupText(`+${addedScore} ${multiplier > 1 ? `(${multiplier}x)` : ''}`, true, item.x, Math.max(20, item.y - 15));

        setTimeout(() => {
          fallingWords.forEach((w) => w.el.remove());
          fallingWords = [];
          spawnNextWave();
        }, 320);
      } else {
        // Chạm nhầm từ sai!
        streak = 0;
        streakEl.textContent = '0x';
        sounds.playWrong();
        lives--;
        livesEl.textContent = '❤️'.repeat(Math.max(0, lives)) + '🖤'.repeat(Math.max(0, 3 - lives));
        if (currentTarget) {
          recordMistakeWord({
            hanzi: currentTarget.hanzi,
            pinyin: currentTarget.pinyin,
            meaning: currentTarget.meaning,
            level: currentTarget.level,
            source: 'Chạm từ rơi'
          });
        }

        item.el.classList.add('pop-wrong');
        showPopupText('-1 ❤️ Sai từ!', false, item.x, Math.max(20, item.y - 15));

        setTimeout(() => {
          item.el.remove();
          const idx = fallingWords.indexOf(item);
          if (idx !== -1) fallingWords.splice(idx, 1);
        }, 320);

        if (lives <= 0) {
          triggerGameOver();
        }
      }
    }

    function spawnNextWave() {
      if (isGameOver) return;

      isTransitioningWave = false;

      // Xóa các từ rơi cũ
      fallingWords.forEach((item) => item.el.remove());
      fallingWords = [];

      // Chọn bộ 3 từ kết hợp từ ghép có nghĩa & từ đơn
      const mixedWave = generateMixedWordPool(wordsPool, 3, currentLevel);
      currentTarget = mixedWave[0] || wordsPool[Math.floor(Math.random() * wordsPool.length)];
      targetTextEl.textContent = `"${currentTarget.meaning}"`;
      speakBtn.onclick = () => speakChinese(currentTarget.hanzi);

      // Chọn 2 từ gây nhiễu
      const distractors = mixedWave.length >= 3
        ? mixedWave.slice(1, 3)
        : shuffle(wordsPool.filter((w) => w.meaning !== currentTarget.meaning)).slice(0, 2);
      const waveWords = shuffle([
        { word: currentTarget, isCorrect: true },
        ...distractors.map((w) => ({ word: w, isCorrect: false }))
      ]);

      const SHAPES = ['shape-circle', 'shape-star', 'shape-triangle', 'shape-cloud', 'shape-diamond', 'shape-hexagon'];
      const waveShapes = shuffle([...SHAPES]).slice(0, waveWords.length);

      const currentWidth = catchBoard.clientWidth || 600;
      const colWidth = currentWidth / waveWords.length;
      const { speed } = getCurrentSpeed();

      waveWords.forEach((entry, idx) => {
        const shapeClass = waveShapes[idx] || 'shape-circle';
        const itemEl = document.createElement('div');
        itemEl.className = `falling-item ${shapeClass}`;
        itemEl.innerHTML = `
          <span class="game-pinyin">${escapeHtml(entry.word.pinyin || toPinyin(entry.word.hanzi))}</span>
          <strong class="drop-hanzi">${escapeHtml(entry.word.hanzi)}</strong>
        `;

        const colCenter = idx * colWidth + colWidth / 2;
        const xPos = Math.max(70, Math.min(currentWidth - 70, colCenter + (Math.random() - 0.5) * (colWidth * 0.22)));
        const yPos = -110 - Math.random() * 30;

        itemEl.style.left = `${xPos}px`;
        itemEl.style.top = `${yPos}px`;

        const itemObj = {
          el: itemEl,
          hanzi: entry.word.hanzi,
          pinyin: entry.word.pinyin,
          isCorrect: entry.isCorrect,
          x: xPos,
          y: yPos,
          speed: speed,
          handled: false
        };

        const handleTap = (e) => {
          e.preventDefault();
          e.stopPropagation();
          onWordTapped(itemObj);
        };

        itemEl.addEventListener('pointerdown', handleTap);

        fallingContainer.appendChild(itemEl);
        fallingWords.push(itemObj);
      });
    }

    // Animation Loop
    function gameLoop() {
      if (isGameOver) return;

      const currentHeight = catchBoard.clientHeight || 440;

      if (isTransitioningWave) {
        activeAnimFrame = requestAnimationFrame(gameLoop);
        return;
      }

      const { speed } = getCurrentSpeed();

      for (let i = fallingWords.length - 1; i >= 0; i--) {
        const item = fallingWords[i];
        if (item.handled) continue;

        item.speed = speed;
        item.y += item.speed;
        item.el.style.top = `${item.y}px`;

        // Rơi khỏi đáy màn hình
        if (item.y > currentHeight + 20) {
          if (item.isCorrect) {
            // Bỏ lỡ từ đúng mục tiêu!
            item.handled = true;
            isTransitioningWave = true;
            streak = 0;
            streakEl.textContent = '0x';
            lives--;
            livesEl.textContent = '❤️'.repeat(Math.max(0, lives)) + '🖤'.repeat(Math.max(0, 3 - lives));
            sounds.playWrong();

            if (currentTarget) {
              recordMistakeWord({
                hanzi: currentTarget.hanzi,
                pinyin: currentTarget.pinyin,
                meaning: currentTarget.meaning,
                level: currentTarget.level,
                source: 'Chạm từ rơi'
              });
            }

            showPopupText('Bỏ lỡ! -1 ❤️', false, Math.max(70, Math.min((catchBoard.clientWidth || 600) - 70, item.x)), currentHeight - 40);

            if (lives <= 0) {
              triggerGameOver();
              return;
            }

            setTimeout(() => {
              fallingWords.forEach((w) => w.el.remove());
              fallingWords = [];
              spawnNextWave();
            }, 350);
            break;
          } else {
            // Từ sai rơi khỏi đáy: tự hủy
            item.el.remove();
            fallingWords.splice(i, 1);
          }
        }
      }

      activeAnimFrame = requestAnimationFrame(gameLoop);
    }

    // Bộ đếm thời gian sinh tồn (không giới hạn 60s)
    activeInterval = setInterval(() => {
      elapsedSeconds++;
      if (secondsEl) secondsEl.textContent = formatTime(elapsedSeconds);
      updateSpeedDisplay();
    }, 1000);

    spawnNextWave();
    activeAnimFrame = requestAnimationFrame(gameLoop);
  }

  // ==========================================
  // GAME 5: BẮN TỪ VỰNG (BUBBLE / EGG SHOOTER)
  // ==========================================
  function startShooterGame(arena) {
    const wordsPool = getFilteredWords();
    if (wordsPool.length < 4) {
      arena.innerHTML = renderEmptyState(wordsPool.length, 4);
      bindGoToVocab(arena);
      return;
    }

    let score = 0;
    let streak = 0;
    let maxStreak = 0;
    let wave = 1;
    let shotsFired = 0;
    let shotsHit = 0;
    let wordsClearedCount = 0;
    let lives = 3;
    let isGameOver = false;
    let isWaveClearing = false;
    let missesUntilDescent = 3;
    let blockIdCounter = 0;

    let blocks = []; // Active Hanzi blocks on board
    let droppingBlocks = []; // Blocks falling down with gravity
    let particles = []; // Particle explosion effects
    let flyingBullet = null; // Currently moving bullet
    let currentBulletWord = null;
    let nextBulletWord = null;
    let aimedBlock = null;

    const PALETTES_COUNT = 6;
    const BLOCK_RADIUS = 31;
    const ROW_STEP_Y = 52;
    const TOP_START_Y = 38;

    function formatBulletMeaning(raw = '') {
      const text = String(raw || '').trim();
      if (text.length <= 24) return text;
      // Rút gọn phần chú thích trong ngoặc nếu câu quá dài để hiển thị gọn đẹp
      const withoutParen = text.replace(/\s*\([^)]*\)/g, '').trim();
      if (withoutParen.length >= 2 && withoutParen.length <= 28) return withoutParen;
      return text;
    }

    arena.innerHTML = `
      <div class="shooter-game-panel">
        <div class="shooter-hud">
          <div class="shooter-hud-stats">
            <div class="hud-item">
              <span>🏆 Điểm:</span>
              <strong id="shooterScore">0</strong>
            </div>
            <div class="hud-item">
              <span>🔥 Combo:</span>
              <strong id="shooterStreak">0x</strong>
            </div>
            <div class="hud-item">
              <span>🌊 Vòng:</span>
              <strong id="shooterWave">1</strong>
            </div>
            <div class="hud-item">
              <span>❤️ Mạng:</span>
              <strong id="shooterLives">❤️❤️❤️</strong>
            </div>
          </div>
          <div class="shooter-hud-actions">
            <button type="button" class="shooter-next-box" id="shooterSwapBtn" title="Bấm để đổi giữa đạn hiện tại và đạn kế tiếp (Phím Space)">
              <span class="next-label">Đổi đạn ⇄:</span>
              <strong class="shooter-next-pill" id="shooterNextWord">...</strong>
            </button>
            <button type="button" class="game-btn-secondary shooter-restart-btn" id="shooterRestart">Chơi lại ↺</button>
          </div>
        </div>

        <div class="shooter-board" id="shooterBoard">
          <!-- Danger line -->
          <div class="shooter-danger-line" id="shooterDangerLine">
            <span>⚠️ VẠCH NGUY HIỂM (Bắn sai ${missesUntilDescent} lần sẽ hạ trần) ⚠️</span>
          </div>

          <!-- Active Blocks Container -->
          <div class="shooter-blocks-wrap" id="shooterBlocksWrap"></div>

          <!-- FX & Particles Layer -->
          <div class="shooter-fx-layer" id="shooterFxLayer"></div>

          <!-- Aiming Polyline Layer -->
          <svg class="shooter-aim-svg" id="shooterAimSvg">
            <polyline id="shooterAimLine" class="shooter-aim-line" points="" />
          </svg>

          <!-- Slingshot / Launcher Zone -->
          <div class="shooter-slingshot-zone" id="shooterSlingshotZone">
            <svg class="shooter-slingshot-fork" viewBox="0 0 100 80">
              <path d="M 28 80 L 28 35 L 14 10 M 28 35 L 72 35 L 86 10 M 72 80 L 72 35" stroke="#64748b" stroke-width="6" stroke-linecap="round" stroke-linejoin="round" fill="none" opacity="0.65"/>
              <line id="slingshotBandLeft" x1="14" y1="10" x2="50" y2="38" stroke="#10b981" stroke-width="4.5" stroke-linecap="round" />
              <line id="slingshotBandRight" x1="86" y1="10" x2="50" y2="38" stroke="#10b981" stroke-width="4.5" stroke-linecap="round" />
            </svg>

            <!-- Loaded Bullet on Pouch -->
            <div class="shooter-loaded-bullet" id="shooterLoadedBullet">
              <span class="bullet-tag">BẮN NGHĨA TIẾNG VIỆT:</span>
              <strong class="bullet-meaning-text" id="shooterBulletText">...</strong>
            </div>

            <!-- Hint Arrow -->
            <div class="shooter-hint-arrow" id="shooterHint">
              <span>🎯 Kéo ná xuống hoặc chỉ thẳng vào bóng chữ Hán để ngắm bắn</span>
            </div>
          </div>
        </div>
      </div>
    `;

    const shooterBoard = arena.querySelector('#shooterBoard');
    const blocksWrap = arena.querySelector('#shooterBlocksWrap');
    const fxLayer = arena.querySelector('#shooterFxLayer');
    const aimLine = arena.querySelector('#shooterAimLine');
    const bandLeft = arena.querySelector('#slingshotBandLeft');
    const bandRight = arena.querySelector('#slingshotBandRight');
    const loadedBulletEl = arena.querySelector('#shooterLoadedBullet');
    const bulletTextEl = arena.querySelector('#shooterBulletText');
    const nextWordEl = arena.querySelector('#shooterNextWord');
    const swapBtn = arena.querySelector('#shooterSwapBtn');
    const hintEl = arena.querySelector('#shooterHint');
    const dangerLineEl = arena.querySelector('#shooterDangerLine');

    const scoreEl = arena.querySelector('#shooterScore');
    const streakEl = arena.querySelector('#shooterStreak');
    const waveEl = arena.querySelector('#shooterWave');
    const livesEl = arena.querySelector('#shooterLives');
    const restartBtn = arena.querySelector('#shooterRestart');

    restartBtn.addEventListener('click', () => startShooterGame(arena));

    // Dynamic Board metrics
    let boardW = shooterBoard.clientWidth || 660;
    let boardH = shooterBoard.clientHeight || 450;
    let launcherX = boardW / 2;
    let launcherY = boardH - 52;
    let dangerY = boardH - 115;

    function updateBoardMetrics() {
      boardW = shooterBoard.clientWidth || 660;
      boardH = shooterBoard.clientHeight || 450;
      launcherX = boardW / 2;
      launcherY = boardH - 52;
      dangerY = boardH - 115;
      dangerLineEl.style.top = `${dangerY}px`;
    }
    updateBoardMetrics();

    function updateDangerLineLabel() {
      const span = dangerLineEl.querySelector('span');
      if (span) {
        span.textContent = `⚠️ VẠCH NGUY HIỂM · Còn ${missesUntilDescent} lần bắn sai trước khi hạ trần ⚠️`;
      }
    }

    // Tìm các bóng chữ Hán ở hàng mặt tiền (không bị bóng khác chắn ngay phía dưới)
    function getReachableBlocks() {
      if (!blocks.length) return [];
      const reachable = blocks.filter((b) => {
        const isBlockedBelow = blocks.some(
          (other) => other !== b && other.y > b.y + 12 && Math.abs(other.x - b.x) < 42
        );
        return !isBlockedBelow;
      });
      return reachable.length > 0 ? reachable : blocks;
    }

    function getNextBulletWord(excludeWord = null) {
      const candidates = getReachableBlocks();
      if (!candidates.length) {
        const p = getFilteredWords();
        return p[Math.floor(Math.random() * p.length)];
      }
      if (excludeWord && candidates.length > 1) {
        const filtered = candidates.filter(
          (b) => b.word.hanzi !== excludeWord.hanzi && b.word.meaning !== excludeWord.meaning
        );
        if (filtered.length > 0) {
          return filtered[Math.floor(Math.random() * filtered.length)].word;
        }
      }
      return candidates[Math.floor(Math.random() * candidates.length)].word;
    }

    function ensureValidBulletWords() {
      if (!blocks.length) return;
      const reachable = getReachableBlocks();
      const isCurrentValid =
        currentBulletWord &&
        reachable.some(
          (b) => b.word.hanzi === currentBulletWord.hanzi || b.word.meaning === currentBulletWord.meaning
        );
      if (!isCurrentValid) {
        currentBulletWord = getNextBulletWord();
      }
      const isNextValid =
        nextBulletWord &&
        blocks.some(
          (b) => b.word.hanzi === nextBulletWord.hanzi || b.word.meaning === nextBulletWord.meaning
        );
      if (!isNextValid) {
        nextBulletWord = getNextBulletWord(currentBulletWord);
      }
      updateBulletDisplays();
    }

    function updateBulletDisplays() {
      if (currentBulletWord) {
        const displayMeaning = formatBulletMeaning(currentBulletWord.meaning);
        bulletTextEl.textContent = displayMeaning;
        loadedBulletEl.title = currentBulletWord.meaning;
      }
      if (nextBulletWord) {
        nextWordEl.textContent = formatBulletMeaning(nextBulletWord.meaning);
        swapBtn.title = `Đạn kế: "${nextBulletWord.meaning}" — Bấm để đổi đạn (Phím Space)`;
      }
    }

    function swapBullets() {
      if (isGameOver || isWaveClearing || flyingBullet || !currentBulletWord || !nextBulletWord) return;
      const temp = currentBulletWord;
      currentBulletWord = nextBulletWord;
      nextBulletWord = temp;
      sounds.playFlip();
      updateBulletDisplays();
      loadedBulletEl.classList.remove('bullet-swap-anim');
      void loadedBulletEl.offsetWidth;
      loadedBulletEl.classList.add('bullet-swap-anim');
    }

    swapBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      swapBullets();
    });

    const onKeyDown = (e) => {
      if (e.code === 'Space' && currentGameMode === 'shooter' && !isGameOver) {
        // Tránh cuộn trang khi nhấn Space đổi đạn
        if (document.activeElement && ['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) return;
        e.preventDefault();
        swapBullets();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    activeCleanups.push(() => window.removeEventListener('keydown', onKeyDown));

    function setAimedBlock(block) {
      if (aimedBlock === block) return;
      if (aimedBlock && aimedBlock.el) {
        aimedBlock.el.classList.remove('is-aimed');
      }
      aimedBlock = block;
      if (aimedBlock && aimedBlock.el) {
        aimedBlock.el.classList.add('is-aimed');
      }
    }

    function renderBlock(block) {
      const el = document.createElement('div');
      const hanziStr = String(block.word.hanzi || '').trim();
      const pyStr = String(block.word.pinyin || toPinyin(hanziStr) || '').trim();
      const charCount = Array.from(hanziStr).length;
      const lenClass = `hanzi-len-${Math.min(4, Math.max(1, charCount))}`;
      const pyClass = pyStr.length > 10 ? 'pinyin-long' : '';

      el.className = `shooter-block color-${block.colorIndex}`;
      el.dataset.id = block.id;
      el.style.left = `${block.x}px`;
      el.style.top = `${block.y}px`;
      el.innerHTML = `
        <span class="block-hanzi ${lenClass}">${escapeHtml(hanziStr)}</span>
        <span class="block-pinyin game-pinyin ${pyClass}">${escapeHtml(pyStr)}</span>
      `;
      blocksWrap.appendChild(el);
      block.el = el;
      return el;
    }

    function createBlock(x, y, word, colorIndex = null) {
      blockIdCounter++;
      const block = {
        id: `sb_${blockIdCounter}`,
        word,
        x,
        y,
        r: BLOCK_RADIUS,
        colorIndex: colorIndex !== null ? colorIndex : (blockIdCounter % PALETTES_COUNT),
        el: null
      };
      renderBlock(block);
      return block;
    }

    // Tính vị trí các cột chuẩn lưới tổ ong (Hexagonal Grid)
    function getGridSlotPositions(rowIdx) {
      const baseCols = 6;
      const isOdd = rowIdx % 2 === 1;
      const count = isOdd ? baseCols - 1 : baseCols;
      const usableW = boardW - 56;
      const colSpacing = usableW / baseCols;
      const startX = isOdd ? 28 + colSpacing : 28 + colSpacing / 2;
      const y = TOP_START_Y + rowIdx * ROW_STEP_Y;
      const slots = [];
      for (let c = 0; c < count; c++) {
        slots.push({ x: Math.round(startX + c * colSpacing), y: Math.round(y), row: rowIdx, col: c });
      }
      return slots;
    }

    // Tìm ô trống hợp lệ gần điểm va chạm nhất để bóng không bao giờ đè lên nhau
    function findNearestEmptySlot(targetX, targetY) {
      let bestSlot = null;
      let bestDist = Infinity;

      for (let r = 0; r < 8; r++) {
        const slots = getGridSlotPositions(r);
        for (const s of slots) {
          // Kiểm tra ô này đã có bóng nào chiếm chưa
          const occupied = blocks.some((b) => Math.hypot(b.x - s.x, b.y - s.y) < BLOCK_RADIUS * 1.45);
          if (occupied) continue;

          // Ưu tiên ô nằm gần trần hoặc kề sát ít nhất 1 bóng hiện có
          const touchesCeiling = r === 0;
          const touchesExisting = blocks.some((b) => Math.hypot(b.x - s.x, b.y - s.y) <= BLOCK_RADIUS * 2.5);
          if (!touchesCeiling && !touchesExisting) continue;

          const dist = Math.hypot(targetX - s.x, targetY - s.y);
          if (dist < bestDist) {
            bestDist = dist;
            bestSlot = s;
          }
        }
      }

      if (bestSlot) return bestSlot;

      // Dự phòng nếu không tìm thấy ô lưới chuẩn
      const clampedX = Math.max(38, Math.min(boardW - 38, targetX));
      const clampedY = Math.max(TOP_START_Y, Math.min(dangerY - 10, targetY));
      return { x: clampedX, y: clampedY };
    }

    // Kiểm tra và làm rụng các bóng bị mất liên kết với trần (Avalanche / Cluster Drop)
    function dropFloatingBlocks() {
      if (!blocks.length) return 0;
      const anchored = new Set();
      const queue = [];

      // Tất cả bóng ở hàng trên cùng được neo vào trần
      blocks.forEach((b) => {
        if (b.y <= TOP_START_Y + 18) {
          anchored.add(b);
          queue.push(b);
        }
      });

      // Lan truyền (BFS) sang các bóng kề cận
      while (queue.length > 0) {
        const curr = queue.shift();
        for (const other of blocks) {
          if (!anchored.has(other)) {
            const dist = Math.hypot(curr.x - other.x, curr.y - other.y);
            if (dist <= BLOCK_RADIUS * 2.55) {
              anchored.add(other);
              queue.push(other);
            }
          }
        }
      }

      // Các bóng không nằm trong tập anchored sẽ rơi tự do!
      const floating = blocks.filter((b) => !anchored.has(b));
      if (!floating.length) return 0;

      floating.forEach((fb) => {
        const idx = blocks.indexOf(fb);
        if (idx !== -1) blocks.splice(idx, 1);

        if (fb.el) {
          fb.el.classList.remove('is-aimed');
          fb.el.classList.add('is-dropping');
          fxLayer.appendChild(fb.el);
          droppingBlocks.push({
            el: fb.el,
            origX: fb.x,
            origY: fb.y,
            x: fb.x,
            y: fb.y,
            vx: (Math.random() - 0.5) * 4,
            vy: -2.5,
            rot: 0,
            vRot: (Math.random() - 0.5) * 9
          });
        }
        createParticles(fb.x, fb.y, 8);
      });

      return floating.length;
    }

    // Spawn an entire wave of blocks with unique words
    function spawnWave() {
      updateBoardMetrics();
      blocks.forEach((b) => { if (b.el) b.el.remove(); });
      blocks = [];
      setAimedBlock(null);

      const rowsCount = Math.min(4, 2 + Math.ceil(wave / 2)); // Wave 1-2: 3 hàng, Wave 3+: 4 hàng
      const rawPool = shuffle(getFilteredWords());
      // Lọc các từ duy nhất không trùng Hanzi trên bàn
      const uniquePool = [];
      const seenHanzi = new Set();
      for (const w of rawPool) {
        if (!seenHanzi.has(w.hanzi)) {
          seenHanzi.add(w.hanzi);
          uniquePool.push(w);
        }
      }
      const pool = uniquePool.length >= 6 ? uniquePool : rawPool;
      let wordIdx = 0;

      for (let r = 0; r < rowsCount; r++) {
        const slots = getGridSlotPositions(r);
        for (const s of slots) {
          const word = pool[wordIdx % pool.length];
          wordIdx++;
          const block = createBlock(s.x, s.y, word);
          blocks.push(block);
        }
      }

      missesUntilDescent = 3;
      updateDangerLineLabel();
      currentBulletWord = getNextBulletWord();
      nextBulletWord = getNextBulletWord(currentBulletWord);
      updateBulletDisplays();
    }

    // Ceiling descent: hạ các block xuống 1 bậc và thêm 1 hàng mới khi bắn sai nhiều lần
    function descendCeiling() {
      if (isGameOver || isWaveClearing) return;
      let reachedDanger = false;

      blocks.forEach((b) => {
        b.y += ROW_STEP_Y;
        if (b.el) b.el.style.top = `${b.y}px`;
        if (b.y + b.r >= dangerY) {
          reachedDanger = true;
        }
      });

      // Thêm 1 hàng mới trên cùng (row 0) ưu tiên các từ chưa có trên bàn
      const slots = getGridSlotPositions(0);
      const existingHanzi = new Set(blocks.map((b) => b.word.hanzi));
      const allWords = shuffle(getFilteredWords());
      const freshWords = allWords.filter((w) => !existingHanzi.has(w.hanzi));
      const usePool = freshWords.length >= slots.length ? freshWords : allWords;

      slots.forEach((s, idx) => {
        const word = usePool[idx % usePool.length];
        const block = createBlock(s.x, s.y, word);
        blocks.push(block);
      });

      dangerLineEl.classList.add('pulse-danger');
      setTimeout(() => dangerLineEl.classList.remove('pulse-danger'), 1000);

      if (reachedDanger) {
        lives--;
        livesEl.textContent = '❤️'.repeat(Math.max(0, lives)) + '🖤'.repeat(Math.max(0, 3 - lives));
        if (lives <= 0) {
          triggerGameOver();
          return;
        }
        // Xóa bớt các bóng vượt quá vạch nguy hiểm để người chơi tiếp tục
        const overBlocks = blocks.filter((b) => b.y + b.r >= dangerY);
        overBlocks.forEach((ob) => {
          const idx = blocks.indexOf(ob);
          if (idx !== -1) blocks.splice(idx, 1);
          if (ob.el) ob.el.remove();
        });
      }

      ensureValidBulletWords();
    }

    function showPopupText(text, isPositive, x, y) {
      const popup = document.createElement('span');
      popup.className = `shooter-popup ${isPositive ? 'plus' : 'minus'}`;
      popup.textContent = text;
      popup.style.left = `${Math.max(50, Math.min(boardW - 50, x))}px`;
      popup.style.top = `${Math.max(30, y)}px`;
      fxLayer.appendChild(popup);
      setTimeout(() => popup.remove(), 850);
    }

    function createParticles(x, y, count = 12) {
      const colors = ['#10b981', '#34d399', '#fbbf24', '#f43f5e', '#38bdf8', '#a855f7'];
      for (let i = 0; i < count; i++) {
        const pEl = document.createElement('div');
        pEl.className = 'shooter-particle';
        const color = colors[i % colors.length];
        pEl.style.backgroundColor = color;
        fxLayer.appendChild(pEl);

        const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.4;
        const speed = 2 + Math.random() * 5;
        particles.push({
          el: pEl,
          x,
          y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          life: 1.0
        });
      }
    }

    function triggerGameOver() {
      if (isGameOver) return;
      isGameOver = true;
      setAimedBlock(null);
      clearActiveGame();
      sounds.playVictory();

      const prevBest = Number(localStorage.getItem('mandarinly_game_best_shooter') || '0');
      if (score > prevBest) {
        localStorage.setItem('mandarinly_game_best_shooter', String(score));
      }

      const earnedPoints = Math.min(100, Math.max(15, Math.round(score * 0.1)));
      recordScore({ category: 'game', points: earnedPoints, description: `Bắn từ vựng (${score}đ - Vòng ${wave})` });

      showVictoryModal(arena, {
        title: 'Kết thúc bắn từ vựng 🏹',
        score: score,
        stats: [
          { label: 'Từ đã bắn rụng', value: `${wordsClearedCount}` },
          { label: 'Combo tối đa', value: `${maxStreak}x` },
          { label: 'Vòng đạt được', value: `Vòng ${wave}` },
          { label: 'Độ chính xác', value: shotsFired ? `${Math.round((shotsHit / shotsFired) * 100)}%` : '0%' }
        ],
        onReplay: () => startShooterGame(arena)
      });
    }

    function handleWaveCleared() {
      if (isWaveClearing || isGameOver) return;
      isWaveClearing = true;
      setAimedBlock(null);
      sounds.playVictory();

      score += 500;
      scoreEl.textContent = String(score);
      showPopupText('QUA VÒNG! +500đ 🌟', true, boardW / 2, boardH / 2 - 40);

      const banner = document.createElement('div');
      banner.className = 'shooter-wave-banner';
      banner.innerHTML = `<h3>VÒNG ${wave} HOÀN THÀNH! 🎉</h3><p>+500 điểm thưởng · Đang mở vòng ${wave + 1}...</p>`;
      fxLayer.appendChild(banner);

      setTimeout(() => {
        banner.remove();
        wave++;
        waveEl.textContent = String(wave);
        isWaveClearing = false;
        spawnWave();
      }, 1500);
    }

    // ==========================================
    // AIMING & SLINGSHOT CONTROLS (HỖ TRỢ CẢ KÉO NÁ & CHỈ TRỰC TIẾP)
    // ==========================================
    let isDragging = false;
    let aimVx = 0;
    let aimVy = 0;

    function resetSlingshotVisuals() {
      loadedBulletEl.style.transform = 'translate(0, 0)';
      bandLeft.setAttribute('x2', '50');
      bandLeft.setAttribute('y2', '38');
      bandRight.setAttribute('x2', '50');
      bandRight.setAttribute('y2', '38');
      aimLine.setAttribute('points', '');
      aimLine.style.opacity = '0';
      setAimedBlock(null);
    }

    // Dò đường bay của đạn & tìm bóng mục tiêu sẽ va chạm đầu tiên
    function traceAimTrajectory(dirX, dirY) {
      let rayX = launcherX;
      let rayY = launcherY;
      const stepDist = 10;
      let rVx = dirX * stepDist;
      let rVy = dirY * stepDist;
      const points = [`${Math.round(rayX)},${Math.round(rayY)}`];
      let firstHit = null;

      for (let step = 0; step < 68; step++) {
        rayX += rVx;
        rayY += rVy;

        // Phản xạ tường trái / phải
        if (rayX <= 24) {
          rayX = 24;
          rVx = -rVx;
          points.push(`${Math.round(rayX)},${Math.round(rayY)}`);
        } else if (rayX >= boardW - 24) {
          rayX = boardW - 24;
          rVx = -rVx;
          points.push(`${Math.round(rayX)},${Math.round(rayY)}`);
        }

        // Kiểm tra chạm bóng trên bàn
        for (let i = 0; i < blocks.length; i++) {
          const b = blocks[i];
          if (Math.hypot(rayX - b.x, rayY - b.y) <= BLOCK_RADIUS + 14) {
            firstHit = b;
            break;
          }
        }

        if (firstHit || rayY <= 28) {
          points.push(`${Math.round(rayX)},${Math.round(rayY)}`);
          break;
        }
      }

      points.push(`${Math.round(rayX)},${Math.round(rayY)}`);
      return { points: points.join(' '), hitBlock: firstHit };
    }

    function updateAimFromPointer(clientX, clientY) {
      const rect = shooterBoard.getBoundingClientRect();
      const curX = clientX - rect.left;
      const curY = clientY - rect.top;

      let pullX = 0;
      let pullY = 0;
      const maxPull = 62;

      if (curY >= launcherY - 8) {
        // Chế độ 1: Kéo ná xuống (Slingshot Pull)
        let dx = curX - launcherX;
        let dy = Math.max(10, curY - launcherY);
        const dist = Math.hypot(dx, dy);
        if (dist > maxPull) {
          dx = (dx / dist) * maxPull;
          dy = (dy / dist) * maxPull;
        }
        pullX = dx;
        pullY = dy;
        aimVx = -dx;
        aimVy = -dy;
      } else {
        // Chế độ 2: Chỉ / kéo trực tiếp lên phía bóng mục tiêu (Direct Aim)
        let dx = curX - launcherX;
        let dy = Math.min(-18, curY - launcherY);
        const dist = Math.hypot(dx, dy);
        const normX = dx / (dist || 1);
        const normY = dy / (dist || 1);
        pullX = -normX * 36;
        pullY = -normY * 36;
        aimVx = normX * maxPull;
        aimVy = normY * maxPull;
      }

      // Giới hạn góc bắn để không bắn ngang sát đáy
      if (aimVy > -12) {
        aimVy = -12;
      }

      loadedBulletEl.style.transform = `translate(${Math.round(pullX * 0.55)}px, ${Math.round(pullY * 0.45)}px)`;

      const svgDx = (pullX / maxPull) * 32;
      const svgDy = (pullY / maxPull) * 30;
      bandLeft.setAttribute('x2', `${50 + svgDx}`);
      bandLeft.setAttribute('y2', `${38 + svgDy}`);
      bandRight.setAttribute('x2', `${50 + svgDx}`);
      bandRight.setAttribute('y2', `${38 + svgDy}`);

      const len = Math.hypot(aimVx, aimVy);
      if (len > 8) {
        const dirX = aimVx / len;
        const dirY = aimVy / len;
        const trace = traceAimTrajectory(dirX, dirY);
        aimLine.setAttribute('points', trace.points);
        aimLine.style.opacity = '1';
        setAimedBlock(trace.hitBlock);
      } else {
        aimLine.style.opacity = '0';
        setAimedBlock(null);
      }
    }

    function onPointerDown(e) {
      if (isGameOver || isWaveClearing || flyingBullet) return;
      if (e.button && e.button !== 0) return;
      isDragging = true;
      aimVx = 0;
      aimVy = 0;
      if (hintEl) hintEl.style.display = 'none';
      try {
        shooterBoard.setPointerCapture(e.pointerId);
      } catch (_) {}
      updateAimFromPointer(e.clientX, e.clientY);
    }

    function onPointerMove(e) {
      if (!isDragging || isGameOver || isWaveClearing || flyingBullet) return;
      updateAimFromPointer(e.clientX, e.clientY);
    }

    function onPointerUp(e) {
      if (!isDragging) return;
      isDragging = false;
      try {
        shooterBoard.releasePointerCapture(e.pointerId);
      } catch (_) {}

      const len = Math.hypot(aimVx, aimVy);
      if (len > 8 && aimVy < -8 && !flyingBullet && currentBulletWord) {
        const speed = 16.5;
        const vx = (aimVx / len) * speed;
        const vy = (aimVy / len) * speed;

        const bulletEl = document.createElement('div');
        bulletEl.className = 'shooter-flying-bullet';
        bulletEl.innerHTML = `<span class="flying-meaning">${escapeHtml(formatBulletMeaning(currentBulletWord.meaning))}</span>`;
        fxLayer.appendChild(bulletEl);

        flyingBullet = {
          x: launcherX,
          y: launcherY,
          vx,
          vy,
          r: 22,
          word: currentBulletWord,
          el: bulletEl
        };

        sounds.playShoot();
        shotsFired++;

        currentBulletWord = nextBulletWord;
        nextBulletWord = getNextBulletWord(currentBulletWord);
        updateBulletDisplays();
      }

      resetSlingshotVisuals();
    }

    shooterBoard.addEventListener('pointerdown', onPointerDown);
    shooterBoard.addEventListener('pointermove', onPointerMove);
    shooterBoard.addEventListener('pointerup', onPointerUp);
    shooterBoard.addEventListener('pointercancel', onPointerUp);

    // ==========================================
    // GAME LOOP (FLYING BULLET, DROPPING, PARTICLES)
    // ==========================================
    function gameLoop() {
      if (isGameOver) return;

      // 1. Cập nhật viên đạn bay
      if (flyingBullet) {
        flyingBullet.x += flyingBullet.vx;
        flyingBullet.y += flyingBullet.vy;

        // Bật tường trái / phải
        if (flyingBullet.x - flyingBullet.r <= 14) {
          flyingBullet.x = 14 + flyingBullet.r;
          flyingBullet.vx = -flyingBullet.vx;
        } else if (flyingBullet.x + flyingBullet.r >= boardW - 14) {
          flyingBullet.x = boardW - 14 - flyingBullet.r;
          flyingBullet.vx = -flyingBullet.vx;
        }

        flyingBullet.el.style.left = `${flyingBullet.x}px`;
        flyingBullet.el.style.top = `${flyingBullet.y}px`;

        // Kiểm tra tất cả các khối Hanzi trong bán kính va chạm, ưu tiên khối khớp nghĩa!
        const collidedBlocks = [];
        for (let i = 0; i < blocks.length; i++) {
          const b = blocks[i];
          const dist = Math.hypot(flyingBullet.x - b.x, flyingBullet.y - b.y);
          if (dist <= flyingBullet.r + b.r - 2) {
            collidedBlocks.push(b);
          }
        }

        let hitBlock = null;
        if (collidedBlocks.length > 0) {
          const matchingBlock = collidedBlocks.find(
            (b) => b.word.meaning === flyingBullet.word.meaning || b.word.hanzi === flyingBullet.word.hanzi
          );
          hitBlock = matchingBlock || collidedBlocks[0];
        }

        // Kiểm tra va chạm với trần
        const hitCeiling = flyingBullet.y - flyingBullet.r <= 24;

        if (hitBlock || hitCeiling) {
          const shotWord = flyingBullet.word;
          flyingBullet.el.remove();
          const impactX = flyingBullet.x;
          const impactY = flyingBullet.y;
          flyingBullet = null;

          // Kiểm tra đúng nghĩa (TRÚNG) hay sai nghĩa (HỤT)
          const isMatch =
            hitBlock &&
            (hitBlock.word.meaning === shotWord.meaning || hitBlock.word.hanzi === shotWord.hanzi);

          if (isMatch) {
            // ==========================================
            // BẮN TRÚNG: TỪ ĐÓ SẼ RƠI XUỐNG!
            // ==========================================
            shotsHit++;
            streak++;
            if (streak > maxStreak) maxStreak = streak;
            streakEl.textContent = `${streak}x`;

            const comboBonus = Math.min(5, streak);
            let addedScore = 100 * comboBonus;

            // Cho block bị bắn trúng rơi rụng
            const blockIndex = blocks.indexOf(hitBlock);
            if (blockIndex !== -1) {
              blocks.splice(blockIndex, 1);
            }

            const dropEl = hitBlock.el;
            dropEl.classList.remove('is-aimed');
            dropEl.classList.add('is-dropping');
            fxLayer.appendChild(dropEl);

            droppingBlocks.push({
              el: dropEl,
              origX: hitBlock.x,
              origY: hitBlock.y,
              x: hitBlock.x,
              y: hitBlock.y,
              vx: (Math.random() - 0.5) * 4.5,
              vy: -4.2,
              rot: 0,
              vRot: (Math.random() - 0.5) * 10
            });

            // Kiểm tra các bóng mất điểm tựa bên dưới để rơi theo chùm (Avalanche Bonus)
            const avalancheCount = dropFloatingBlocks();
            if (avalancheCount > 0) {
              addedScore += avalancheCount * 150;
            }

            score += addedScore;
            scoreEl.textContent = String(score);
            wordsClearedCount += 1 + avalancheCount;

            sounds.playCorrect();
            sounds.playPop();
            speakChinese(hitBlock.word.hanzi);

            const bonusLabel =
              avalancheCount > 0
                ? `+${addedScore} (Rụng chùm +${avalancheCount}! 🔥)`
                : `+${addedScore} ${streak > 1 ? `(x${streak})` : ''}`;
            showPopupText(bonusLabel, true, hitBlock.x, hitBlock.y);
            createParticles(hitBlock.x, hitBlock.y, 16);

            // Nếu toàn bộ block đã bị bắn rụng -> QUA VÒNG
            if (blocks.length === 0) {
              handleWaveCleared();
            } else {
              ensureValidBulletWords();
            }
          } else {
            // ==========================================
            // BẮN SAI HOẶC TRƯỢT: TỪ ĐÓ SẼ ĐƯỢC GẮN VÀO Ô TRỐNG TRÊN BÀN!
            // ==========================================
            sounds.playWrong();
            streak = 0;
            streakEl.textContent = '0x';

            if (hitBlock) {
              recordMistakeWord({
                hanzi: hitBlock.word.hanzi,
                meaning: hitBlock.word.meaning,
                level: currentLevel,
                source: 'Bắn từ vựng'
              });
            }

            // Gắn viên đạn vào ô lưới trống gần điểm va chạm nhất (không đè lên bóng cũ)
            const slot = findNearestEmptySlot(impactX, impactY);
            const newBlock = createBlock(slot.x, slot.y, shotWord);
            blocks.push(newBlock);

            showPopupText('Bắn sai · Dính lại! ❌', false, slot.x, slot.y);

            shooterBoard.classList.add('board-shake');
            setTimeout(() => shooterBoard.classList.remove('board-shake'), 350);

            // Kiểm tra chạm vạch nguy hiểm
            if (slot.y + BLOCK_RADIUS >= dangerY) {
              lives--;
              livesEl.textContent = '❤️'.repeat(Math.max(0, lives)) + '🖤'.repeat(Math.max(0, 3 - lives));
              if (lives <= 0) {
                triggerGameOver();
                return;
              }
            }

            // Chỉ hạ trần khi người chơi bắn sai đủ số lượt quy định
            missesUntilDescent--;
            if (missesUntilDescent <= 0) {
              missesUntilDescent = 3;
              descendCeiling();
            }
            updateDangerLineLabel();
            ensureValidBulletWords();
          }
        }
      }

      // 2. Cập nhật các khối đang rơi rụng
      for (let i = droppingBlocks.length - 1; i >= 0; i--) {
        const db = droppingBlocks[i];
        db.x += db.vx;
        db.y += db.vy;
        db.vy += 0.45;
        db.rot += db.vRot;

        db.el.style.transform = `translate(${db.x - db.origX}px, ${db.y - db.origY}px) rotate(${db.rot}deg) scale(0.92)`;
        const fadeStart = dangerY - 20;
        if (db.y > fadeStart) {
          db.el.style.opacity = Math.max(0, 1 - (db.y - fadeStart) / 100);
        }

        if (db.y > boardH + 60) {
          db.el.remove();
          droppingBlocks.splice(i, 1);
        }
      }

      // 3. Cập nhật hạt pháo hoa
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.25;
        p.life -= 0.035;

        p.el.style.left = `${p.x}px`;
        p.el.style.top = `${p.y}px`;
        p.el.style.transform = `scale(${p.life})`;
        p.el.style.opacity = String(p.life);

        if (p.life <= 0) {
          p.el.remove();
          particles.splice(i, 1);
        }
      }

      activeAnimFrame = requestAnimationFrame(gameLoop);
    }

    // Window resize handler
    const onResize = () => {
      updateBoardMetrics();
    };
    window.addEventListener('resize', onResize);
    activeCleanups.push(() => window.removeEventListener('resize', onResize));

    // Khởi tạo vòng đầu tiên
    spawnWave();
    activeAnimFrame = requestAnimationFrame(gameLoop);
  }

  // Victory Dialog Overlay
  async function showVictoryModal(arena, { title, score, stats = [], onReplay }) {
    let foodDrop = null;
    try {
      foodDrop = await awardFoodReward({ source: title });
    } catch (_) {}

    const modalEl = document.createElement('div');
    modalEl.className = 'game-victory-modal';
    modalEl.innerHTML = `
      <div class="game-victory-card">
        <div class="victory-confetti">🎉</div>
        <h2>${escapeHtml(title)}</h2>
        <div class="victory-score">
          <span>Tổng điểm</span>
          <strong>+${score}</strong>
        </div>
        ${foodDrop ? `
          <div class="victory-food-drop">
            <span class="food-drop-tag">Rơi thức ăn nuôi LuLu 🍊</span>
            <div class="food-drop-box">
              <span class="food-drop-icon">${foodDrop.icon}</span>
              <div class="food-drop-desc">
                <strong>+${foodDrop.count} ${foodDrop.name} (${foodDrop.zh})</strong>
                <small>Đã gửi vào túi đồ ăn LuLu</small>
              </div>
            </div>
          </div>
        ` : ''}
        <div class="victory-stats-grid">
          ${stats
            .map(
              (st) => `
            <div class="victory-stat-box">
              <span>${escapeHtml(st.label)}</span>
              <strong>${escapeHtml(st.value)}</strong>
            </div>
          `
            )
            .join('')}
        </div>
        <div class="victory-actions">
          <button type="button" class="game-btn-primary" id="btnReplay">Chơi lại ván mới</button>
          <a class="game-btn-secondary" href="#lulu">Đến nuôi LuLu 🍊</a>
          <a class="game-btn-secondary" href="#dashboard">Về trang chủ</a>
        </div>
      </div>
    `;

    arena.appendChild(modalEl);
    modalEl.querySelector('#btnReplay').addEventListener('click', () => {
      modalEl.remove();
      if (onReplay) onReplay();
    });
  }

  renderLayout();
}

