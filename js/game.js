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
function speakChinese(text, onEnd) {
  if (!text || sounds.muted) return;

  // Engine 1: Web SpeechSynthesis
  if ('speechSynthesis' in window) {
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'zh-CN';
      utterance.rate = 0.85;

      const voices = window.speechSynthesis.getVoices();
      const zh = voices.find(
        (v) => v.lang === 'zh-CN' || v.lang === 'zh_CN' || v.lang?.startsWith('zh') || v.name?.includes('Chinese')
      );
      if (zh) utterance.voice = zh;
      if (onEnd) utterance.onend = onEnd;

      let started = false;
      utterance.onstart = () => { started = true; };
      utterance.onerror = () => {
        if (!started) playChineseAudioFallback(text, onEnd);
      };

      window.speechSynthesis.speak(utterance);

      // Chrome speech synthesis safety fallback
      setTimeout(() => {
        if (!window.speechSynthesis.speaking && !started) {
          playChineseAudioFallback(text, onEnd);
        }
      }, 250);
      return;
    } catch (_) {}
  }

  // Engine 2: High quality dictionary CDN audio
  playChineseAudioFallback(text, onEnd);
}

function playChineseAudioFallback(text, onEnd) {
  if (sounds.muted || !text) return;
  try {
    const audio = new Audio(`https://dict.youdao.com/dictvoice?audio=${encodeURIComponent(text)}&le=zh`);
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
    const selectedWords = shuffle(wordsPool).slice(0, pairCount);

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
          <div class="speed-timer-wrap">
            <span class="timer-icon">⏳</span>
            <div class="speed-timer-bar"><i id="speedProgress"></i></div>
            <strong id="speedSeconds">60s</strong>
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
          <div class="speed-word-box">
            <span class="speed-pinyin" id="speedPinyin"></span>
            <h2 class="speed-hanzi" id="speedHanzi">...</h2>
            <button type="button" class="speed-speak-btn" id="speedSpeakBtn" title="Phát âm">🔊</button>
          </div>
          <div class="speed-options" id="speedOptions"></div>
        </div>
      </div>
    `;

    const progressEl = arena.querySelector('#speedProgress');
    const secondsEl = arena.querySelector('#speedSeconds');
    const scoreEl = arena.querySelector('#speedScore');
    const streakEl = arena.querySelector('#speedStreak');
    const hanziEl = arena.querySelector('#speedHanzi');
    const pinyinEl = arena.querySelector('#speedPinyin');
    const speakBtn = arena.querySelector('#speedSpeakBtn');
    const optionsContainer = arena.querySelector('#speedOptions');

    function updateTimerUI() {
      if (secondsEl) secondsEl.textContent = `${timeLeft}s`;
      if (progressEl) {
        const pct = Math.min(100, Math.max(0, (timeLeft / 60) * 100));
        progressEl.style.width = `${pct}%`;
        progressEl.style.background = timeLeft <= 10 ? '#e88468' : '#4f9d72';
      }
    }

    function showTimeDelta(delta) {
      const isPositive = delta > 0;
      const deltaEl = document.createElement('span');
      deltaEl.className = `time-delta ${isPositive ? 'plus' : 'minus'}`;
      deltaEl.textContent = isPositive ? `+${delta}s` : `${delta}s`;
      const timerWrap = arena.querySelector('.speed-timer-wrap');
      if (timerWrap) {
        timerWrap.appendChild(deltaEl);
        setTimeout(() => deltaEl.remove(), 750);
      }
    }

    function triggerGameOver() {
      if (isGameOver) return;
      clearActiveInterval();
      isGameOver = true;
      sounds.playVictory();

      const earnedPoints = Math.min(100, Math.max(15, Math.round(score * 0.1)));
      recordScore({ category: 'game', points: earnedPoints, description: `Đua tốc độ 60s (${score}đ)` });

      const bestScore = Number(localStorage.getItem('mandarinly_game_best_speed') || 0);
      if (score > bestScore) {
        localStorage.setItem('mandarinly_game_best_speed', String(score));
      }

      showVictoryModal(arena, {
        title: 'Hết giờ! Tốc độ đỉnh cao ⚡',
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
    }

    function nextQuestion() {
      if (isGameOver) return;
      const targetWord = wordsPool[Math.floor(Math.random() * wordsPool.length)];

      hanziEl.textContent = targetWord.hanzi;
      pinyinEl.textContent = targetWord.pinyin || toPinyin(targetWord.hanzi);
      speakChinese(targetWord.hanzi);

      speakBtn.onclick = () => speakChinese(targetWord.hanzi);

      // 1 correct meaning + 3 random distractor meanings
      const distractors = wordsPool
        .filter((w) => w.meaning !== targetWord.meaning)
        .sort(() => Math.random() - 0.5)
        .slice(0, 3)
        .map((w) => w.meaning);

      const options = shuffle([targetWord.meaning, ...distractors]);

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
          answeredCount++;
          const chosen = btn.dataset.meaning;
          const isCorrect = chosen === targetWord.meaning;

          if (isCorrect) {
            correctCount++;
            streak++;
            if (streak > maxStreak) maxStreak = streak;
            sounds.playCorrect();

            // Thưởng thêm +3 giây khi trả lời đúng
            timeLeft += 3;
            updateTimerUI();
            showTimeDelta(3);

            const multiplier = Math.min(4, 1 + Math.floor(streak / 3));
            score += 100 * multiplier;

            btn.classList.add('opt-correct');
            optionsContainer.querySelectorAll('button').forEach((b) => (b.disabled = true));

            scoreEl.textContent = score;
            streakEl.textContent = `${streak}x 🔥`;
            streakEl.classList.add('pulse');
            setTimeout(() => streakEl.classList.remove('pulse'), 300);

            setTimeout(nextQuestion, 280);
          } else {
            streak = 0;
            sounds.playWrong();
            btn.classList.add('opt-wrong');
            streakEl.textContent = '0x';
            recordMistakeWord({
              hanzi: targetWord.hanzi,
              pinyin: targetWord.pinyin,
              meaning: targetWord.meaning,
              level: targetWord.level,
              source: 'Đua tốc độ 60s'
            });

            // Phạt trừ -3 giây khi trả lời sai
            timeLeft = Math.max(0, timeLeft - 3);
            updateTimerUI();
            showTimeDelta(-3);

            optionsContainer.querySelectorAll('.speed-opt-btn').forEach((b) => {
              b.disabled = true;
              if (b.dataset.meaning === targetWord.meaning) {
                b.classList.add('opt-correct');
              }
            });

            if (timeLeft <= 0) {
              triggerGameOver();
              return;
            }

            setTimeout(nextQuestion, 600);
          }
        });
      });
    }

    nextQuestion();

    activeInterval = setInterval(() => {
      timeLeft--;
      updateTimerUI();

      if (timeLeft <= 0) {
        triggerGameOver();
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
      const selectedWords = shuffle(wordsPool).slice(0, batchSize);
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

      // Chọn từ mục tiêu
      currentTarget = wordsPool[Math.floor(Math.random() * wordsPool.length)];
      targetTextEl.textContent = `"${currentTarget.meaning}"`;
      speakBtn.onclick = () => speakChinese(currentTarget.hanzi);

      // Chọn 2 từ gây nhiễu
      const distractors = shuffle(wordsPool.filter((w) => w.meaning !== currentTarget.meaning)).slice(0, 2);
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
    let shotsUntilDescent = 5;
    let blockIdCounter = 0;

    let blocks = []; // Active Hanzi blocks on board
    let droppingBlocks = []; // Blocks falling down with gravity
    let particles = []; // Particle explosion effects
    let flyingBullet = null; // Currently moving bullet
    let currentBulletWord = null;
    let nextBulletWord = null;

    const PALETTES_COUNT = 6;

    arena.innerHTML = `
      <div class="shooter-game-panel">
        <div class="shooter-hud">
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
          <div class="hud-item shooter-next-box">
            <span>Kế tiếp:</span>
            <strong class="shooter-next-pill" id="shooterNextWord">...</strong>
          </div>
          <button type="button" class="game-btn-secondary" id="shooterRestart">Chơi lại ↺</button>
        </div>

        <div class="shooter-board" id="shooterBoard">
          <!-- Danger line -->
          <div class="shooter-danger-line" id="shooterDangerLine">
            <span>⚠️ VẠCH NGUY HIỂM ⚠️</span>
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
              <path d="M 28 80 L 28 35 L 14 10 M 28 35 L 72 35 L 86 10 M 72 80 L 72 35" stroke="#64748b" stroke-width="6" stroke-linecap="round" stroke-linejoin="round" fill="none" opacity="0.6"/>
              <line id="slingshotBandLeft" x1="14" y1="10" x2="50" y2="40" stroke="#f43f5e" stroke-width="4.5" stroke-linecap="round" />
              <line id="slingshotBandRight" x1="86" y1="10" x2="50" y2="40" stroke="#f43f5e" stroke-width="4.5" stroke-linecap="round" />
            </svg>

            <!-- Loaded Bullet on Pouch -->
            <div class="shooter-loaded-bullet" id="shooterLoadedBullet">
              <span class="bullet-tag">BẮN NGHĨA:</span>
              <strong class="bullet-meaning-text" id="shooterBulletText">...</strong>
            </div>

            <!-- Hint Arrow -->
            <div class="shooter-hint-arrow" id="shooterHint">
              <span>👇 Kéo súng xuống để ngắm & thả ra để bắn 👇</span>
            </div>
          </div>
        </div>
      </div>
    `;

    const shooterBoard = arena.querySelector('#shooterBoard');
    const blocksWrap = arena.querySelector('#shooterBlocksWrap');
    const fxLayer = arena.querySelector('#shooterFxLayer');
    const aimSvg = arena.querySelector('#shooterAimSvg');
    const aimLine = arena.querySelector('#shooterAimLine');
    const slingshotZone = arena.querySelector('#shooterSlingshotZone');
    const bandLeft = arena.querySelector('#slingshotBandLeft');
    const bandRight = arena.querySelector('#slingshotBandRight');
    const loadedBulletEl = arena.querySelector('#shooterLoadedBullet');
    const bulletTextEl = arena.querySelector('#shooterBulletText');
    const nextWordEl = arena.querySelector('#shooterNextWord');
    const hintEl = arena.querySelector('#shooterHint');
    const dangerLineEl = arena.querySelector('#shooterDangerLine');

    const scoreEl = arena.querySelector('#shooterScore');
    const streakEl = arena.querySelector('#shooterStreak');
    const waveEl = arena.querySelector('#shooterWave');
    const livesEl = arena.querySelector('#shooterLives');
    const restartBtn = arena.querySelector('#shooterRestart');

    restartBtn.addEventListener('click', () => startShooterGame(arena));

    // Dynamic Board metrics
    let boardW = shooterBoard.clientWidth || 640;
    let boardH = shooterBoard.clientHeight || 500;
    let launcherX = boardW / 2;
    let launcherY = boardH - 60;
    let dangerY = boardH - 140;

    function updateBoardMetrics() {
      boardW = shooterBoard.clientWidth || 640;
      boardH = shooterBoard.clientHeight || 500;
      launcherX = boardW / 2;
      launcherY = boardH - 60;
      dangerY = boardH - 140;
      dangerLineEl.style.top = `${dangerY}px`;
    }
    updateBoardMetrics();

    // Word selection helpers
    function getRandomWordFromBoard() {
      if (!blocks.length) return null;
      return blocks[Math.floor(Math.random() * blocks.length)].word;
    }

    function getRandomWordFromPool() {
      const p = getFilteredWords();
      return p[Math.floor(Math.random() * p.length)];
    }

    function getNextBulletWord() {
      if (blocks.length > 0) {
        // 85% chọn đúng 1 trong các từ đang có trên bàn để người chơi luôn có mục tiêu bắn trúng!
        if (Math.random() < 0.85) {
          const w = getRandomWordFromBoard();
          if (w) return w;
        }
      }
      return getRandomWordFromPool();
    }

    function updateBulletDisplays() {
      if (currentBulletWord) {
        bulletTextEl.textContent = currentBulletWord.meaning;
      }
      if (nextBulletWord) {
        nextWordEl.textContent = nextBulletWord.meaning;
      }
    }

    function renderBlock(block) {
      const el = document.createElement('div');
      el.className = `shooter-block color-${block.colorIndex}`;
      el.dataset.id = block.id;
      el.style.left = `${block.x}px`;
      el.style.top = `${block.y}px`;
      el.innerHTML = `
        <span class="block-hanzi">${escapeHtml(block.word.hanzi)}</span>
        <span class="block-pinyin game-pinyin">${escapeHtml(block.word.pinyin || '')}</span>
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
        r: 30,
        colorIndex: colorIndex !== null ? colorIndex : (blockIdCounter % PALETTES_COUNT),
        el: null
      };
      renderBlock(block);
      return block;
    }

    // Spawn an entire wave of blocks
    function spawnWave() {
      blocks.forEach((b) => { if (b.el) b.el.remove(); });
      blocks = [];

      const colCount = 7;
      const colSpacing = (boardW - 36) / colCount;
      const rowsCount = Math.min(5, 2 + wave); // Wave 1: 3 rows, Wave 2: 4 rows...
      const pool = shuffle(getFilteredWords());
      let wordIdx = 0;

      for (let r = 0; r < rowsCount; r++) {
        const isOdd = r % 2 === 1;
        const count = isOdd ? colCount - 1 : colCount;
        const startX = isOdd ? 18 + colSpacing : 18 + colSpacing / 2;
        const y = 30 + r * 50;

        for (let c = 0; c < count; c++) {
          const x = startX + c * colSpacing;
          const word = pool[wordIdx % pool.length];
          wordIdx++;
          const block = createBlock(x, y, word);
          blocks.push(block);
        }
      }

      currentBulletWord = getNextBulletWord();
      nextBulletWord = getNextBulletWord();
      updateBulletDisplays();
    }

    // Ceiling descent: hạ các block xuống 1 bậc và thêm 1 hàng mới
    function descendCeiling() {
      if (isGameOver || isWaveClearing) return;
      const stepY = 48;
      let reachedDanger = false;

      blocks.forEach((b) => {
        b.y += stepY;
        if (b.el) b.el.style.top = `${b.y}px`;
        if (b.y + b.r >= dangerY) {
          reachedDanger = true;
        }
      });

      // Thêm 1 hàng mới trên cùng y = 30
      const colCount = 7;
      const colSpacing = (boardW - 36) / colCount;
      const pool = shuffle(getFilteredWords());
      for (let c = 0; c < colCount; c++) {
        const x = 18 + colSpacing / 2 + c * colSpacing;
        const word = pool[c % pool.length];
        const block = createBlock(x, 30, word);
        blocks.push(block);
      }

      // Rung cảnh báo
      dangerLineEl.classList.add('pulse-danger');
      setTimeout(() => dangerLineEl.classList.remove('pulse-danger'), 1000);

      if (reachedDanger) {
        triggerGameOver();
      }
    }

    function showPopupText(text, isPositive, x, y) {
      const popup = document.createElement('span');
      popup.className = `shooter-popup ${isPositive ? 'plus' : 'minus'}`;
      popup.textContent = text;
      popup.style.left = `${x}px`;
      popup.style.top = `${y}px`;
      fxLayer.appendChild(popup);
      setTimeout(() => popup.remove(), 800);
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
        shotsUntilDescent = 5;
        spawnWave();
      }, 1600);
    }

    // ==========================================
    // SLINGSHOT CONTROLS (KÉO XUỐNG ĐỂ BẮN)
    // ==========================================
    let isDragging = false;
    let dragPullX = 0;
    let dragPullY = 0;

    function resetSlingshotVisuals() {
      loadedBulletEl.style.transform = 'translate(0, 0)';
      bandLeft.setAttribute('x2', '50');
      bandLeft.setAttribute('y2', '40');
      bandRight.setAttribute('x2', '50');
      bandRight.setAttribute('y2', '40');
      aimLine.setAttribute('points', '');
      aimLine.style.opacity = '0';
    }

    function onPointerDown(e) {
      if (isGameOver || isWaveClearing || flyingBullet) return;
      const rect = shooterBoard.getBoundingClientRect();
      const pointerY = e.clientY - rect.top;

      // Cho phép bắt đầu kéo nếu chạm vào nửa dưới của bảng
      if (pointerY >= launcherY - 90) {
        isDragging = true;
        dragPullX = 0;
        dragPullY = 0;
        hintEl.style.display = 'none';
        try {
          shooterBoard.setPointerCapture(e.pointerId);
        } catch (_) {}
      }
    }

    function onPointerMove(e) {
      if (!isDragging || isGameOver || isWaveClearing || flyingBullet) return;
      const rect = shooterBoard.getBoundingClientRect();
      const curX = e.clientX - rect.left;
      const curY = e.clientY - rect.top;

      let dx = curX - launcherX;
      let dy = curY - launcherY;

      // Yêu cầu kéo xuống (dy > 0)
      dy = Math.max(0, dy);

      const dist = Math.hypot(dx, dy);
      const maxPull = 70;
      if (dist > maxPull) {
        dx = (dx / dist) * maxPull;
        dy = (dy / dist) * maxPull;
      }

      dragPullX = dx;
      dragPullY = dy;

      // Di chuyển viên đạn theo tay kéo
      loadedBulletEl.style.transform = `translate(${dragPullX}px, ${dragPullY}px)`;

      // Co dãn dây cao su ná
      const svgDx = (dragPullX / maxPull) * 35;
      const svgDy = (dragPullY / maxPull) * 35;
      bandLeft.setAttribute('x2', `${50 + svgDx}`);
      bandLeft.setAttribute('y2', `${40 + svgDy}`);
      bandRight.setAttribute('x2', `${50 + svgDx}`);
      bandRight.setAttribute('y2', `${40 + svgDy}`);

      // Tính tia ngắm (hướng ngược lại của lực kéo ná)
      const launchVx = -dragPullX;
      const launchVy = -dragPullY;
      const len = Math.hypot(launchVx, launchVy);

      if (len > 12 && dragPullY > 8) {
        const dirX = launchVx / len;
        const dirY = launchVy / len;

        // Bắn tia dự đoán bật tường
        let rayX = launcherX;
        let rayY = launcherY;
        let rVx = dirX * 18;
        let rVy = dirY * 18;
        const points = [`${Math.round(rayX)},${Math.round(rayY)}`];

        for (let step = 0; step < 26; step++) {
          rayX += rVx;
          rayY += rVy;

          if (rayX <= 22) {
            rayX = 22;
            rVx = -rVx;
            points.push(`${Math.round(rayX)},${Math.round(rayY)}`);
          } else if (rayX >= boardW - 22) {
            rayX = boardW - 22;
            rVx = -rVx;
            points.push(`${Math.round(rayX)},${Math.round(rayY)}`);
          }

          if (rayY <= 30) {
            points.push(`${Math.round(rayX)},${Math.round(rayY)}`);
            break;
          }
        }
        points.push(`${Math.round(rayX)},${Math.round(rayY)}`);
        aimLine.setAttribute('points', points.join(' '));
        aimLine.style.opacity = '1';
      } else {
        aimLine.style.opacity = '0';
      }
    }

    function onPointerUp(e) {
      if (!isDragging) return;
      isDragging = false;
      try {
        shooterBoard.releasePointerCapture(e.pointerId);
      } catch (_) {}

      aimLine.style.opacity = '0';
      aimLine.setAttribute('points', '');

      // Nếu kéo đủ lực xuống (dy >= 14) -> BẮN!
      if (dragPullY >= 14 && !flyingBullet) {
        const launchVx = -dragPullX;
        const launchVy = -dragPullY;
        const len = Math.hypot(launchVx, launchVy);

        if (len > 10) {
          const speed = 15;
          const vx = (launchVx / len) * speed;
          const vy = (launchVy / len) * speed;

          // Tạo viên đạn bay
          const bulletEl = document.createElement('div');
          bulletEl.className = 'shooter-flying-bullet';
          bulletEl.innerHTML = `<span class="flying-meaning">${escapeHtml(currentBulletWord.meaning)}</span>`;
          fxLayer.appendChild(bulletEl);

          flyingBullet = {
            x: launcherX + dragPullX,
            y: launcherY + dragPullY,
            vx,
            vy,
            r: 28,
            word: currentBulletWord,
            el: bulletEl
          };

          sounds.playShoot();
          shotsFired++;

          // Chuyển đạn kế tiếp thành đạn hiện tại
          currentBulletWord = nextBulletWord;
          nextBulletWord = getNextBulletWord();
          updateBulletDisplays();
        }
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
        if (flyingBullet.x - flyingBullet.r <= 12) {
          flyingBullet.x = 12 + flyingBullet.r;
          flyingBullet.vx = -flyingBullet.vx;
        } else if (flyingBullet.x + flyingBullet.r >= boardW - 12) {
          flyingBullet.x = boardW - 12 - flyingBullet.r;
          flyingBullet.vx = -flyingBullet.vx;
        }

        flyingBullet.el.style.left = `${flyingBullet.x}px`;
        flyingBullet.el.style.top = `${flyingBullet.y}px`;

        // Kiểm tra va chạm với các khối Hanzi
        let hitBlock = null;
        for (let i = 0; i < blocks.length; i++) {
          const b = blocks[i];
          const dist = Math.hypot(flyingBullet.x - b.x, flyingBullet.y - b.y);
          if (dist <= flyingBullet.r + b.r - 2) {
            hitBlock = b;
            break;
          }
        }

        // Kiểm tra va chạm với trần
        const hitCeiling = flyingBullet.y - flyingBullet.r <= 28;

        if (hitBlock || hitCeiling) {
          const shotWord = flyingBullet.word;
          flyingBullet.el.remove();
          const impactX = flyingBullet.x;
          const impactY = flyingBullet.y;
          flyingBullet = null;

          // Kiểm tra đúng nghĩa (TRÚNG) hay sai nghĩa (HỤT)
          const isMatch = hitBlock && (
            hitBlock.word.meaning === shotWord.meaning ||
            hitBlock.word.hanzi === shotWord.hanzi
          );

          if (isMatch) {
            // ==========================================
            // BẮN TRÚNG: TỪ ĐÓ SẼ RƠI XUỐNG!
            // ==========================================
            shotsHit++;
            streak++;
            if (streak > maxStreak) maxStreak = streak;
            streakEl.textContent = `${streak}x`;

            const comboBonus = Math.min(5, streak);
            const addedScore = 100 * comboBonus;
            score += addedScore;
            scoreEl.textContent = String(score);
            wordsClearedCount++;

            sounds.playCorrect();
            sounds.playPop();
            speakChinese(hitBlock.word.hanzi);

            showPopupText(`+${addedScore} ${streak > 1 ? `(x${streak})` : ''}`, true, hitBlock.x, hitBlock.y);
            createParticles(hitBlock.x, hitBlock.y, 16);

            // Cho block rơi rụng
            const blockIndex = blocks.indexOf(hitBlock);
            if (blockIndex !== -1) {
              blocks.splice(blockIndex, 1);
            }

            const dropEl = hitBlock.el;
            dropEl.classList.add('is-dropping');
            fxLayer.appendChild(dropEl);

            droppingBlocks.push({
              el: dropEl,
              origX: hitBlock.x,
              origY: hitBlock.y,
              x: hitBlock.x,
              y: hitBlock.y,
              vx: (Math.random() - 0.5) * 5,
              vy: -4.5,
              rot: 0,
              vRot: (Math.random() - 0.5) * 10
            });

            // Nếu toàn bộ block đã bị bắn rụng -> QUA VÒNG
            if (blocks.length === 0) {
              handleWaveCleared();
            }
          } else {
            // ==========================================
            // BẮN SAI HOẶC TRƯỢT: TỪ ĐÓ SẼ Ở TRÊN ĐÓ (DÍNH LẠI)!
            // ==========================================
            sounds.playWrong();
            streak = 0;
            streakEl.textContent = '0x';

            // Ghi nhận vào Sổ tay từ hay sai
            if (hitBlock) {
              recordMistakeWord({
                hanzi: hitBlock.word.hanzi,
                meaning: hitBlock.word.meaning,
                level: currentLevel,
                source: 'Bắn từ vựng'
              });
            }

            // Gắn viên đạn vào trần / cạnh block bị va chạm
            let attachX = impactX;
            let attachY = impactY;
            if (hitBlock) {
              const angle = Math.atan2(impactY - hitBlock.y, impactX - hitBlock.x);
              attachX = Math.max(30, Math.min(boardW - 30, hitBlock.x + Math.cos(angle) * 54));
              attachY = Math.max(30, hitBlock.y + Math.sin(angle) * 50);
            } else {
              attachY = 32;
            }

            // Tạo khối mới dính lại ở trên
            const newBlock = createBlock(attachX, attachY, shotWord);
            blocks.push(newBlock);

            showPopupText('Dính lại! ❌', false, attachX, attachY);

            // Rung màn hình
            shooterBoard.classList.add('board-shake');
            setTimeout(() => shooterBoard.classList.remove('board-shake'), 350);

            // Kiểm tra chạm vạch nguy hiểm
            if (attachY + 30 >= dangerY) {
              lives--;
              livesEl.textContent = '❤️'.repeat(Math.max(0, lives)) + '🖤'.repeat(Math.max(0, 3 - lives));
              if (lives <= 0) {
                triggerGameOver();
                return;
              }
            }
          }

          // Kiểm tra hạ trần sau mỗi 5 phát bắn
          shotsUntilDescent--;
          if (shotsUntilDescent <= 0) {
            shotsUntilDescent = 5;
            descendCeiling();
          }
        }
      }

      // 2. Cập nhật các khối đang rơi rụng
      for (let i = droppingBlocks.length - 1; i >= 0; i--) {
        const db = droppingBlocks[i];
        db.x += db.vx;
        db.y += db.vy;
        db.vy += 0.45; // Trọng lực
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

