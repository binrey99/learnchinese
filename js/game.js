import { supabase } from './supabase.js';
import { recordScore, SCORE_RULES } from './score-service.js';
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

// Chinese speech pronunciation
function speakChinese(text) {
  if (!('speechSynthesis' in window) || !text) return;
  try {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'zh-CN';
    utterance.rate = 0.85;
    window.speechSynthesis.speak(utterance);
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
        .select('vocab, vietnamese_meaning, book_level')
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
          hanzi: w.vocab.trim(),
          pinyin: toPinyin(w.vocab.trim()),
          meaning: w.vietnamese_meaning.trim(),
          level: (w.book_level || 'HSK 1').trim()
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

  const allWords = await loadGameVocabulary();

  // Distinct levels - sắp xếp theo thứ tự cố định
  const levelsInData = new Set(allWords.map((w) => w.level).filter(Boolean));
  const orderedLevels = LEVEL_ORDER.filter((lvl) => levelsInData.has(lvl));
  // Thêm bất kỳ level nào không có trong LEVEL_ORDER (nếu có)
  levelsInData.forEach((lvl) => { if (!LEVEL_ORDER.includes(lvl)) orderedLevels.push(lvl); });
  const availableLevels = ['Tất cả', ...orderedLevels];
  let currentLevel = 'Tất cả';
  let currentGameMode = 'memory'; // 'memory' | 'speed' | 'match' | 'catch'

  function getFilteredWords() {
    if (currentLevel === 'Tất cả') return allWords;
    return allWords.filter((w) => w.level === currentLevel);
  }

  function renderLayout() {
    clearActiveGame();

    const highScores = {
      memory: localStorage.getItem('mandarinly_game_best_memory') || '0',
      speed: localStorage.getItem('mandarinly_game_best_speed') || '0',
      match: localStorage.getItem('mandarinly_game_best_match') || '0',
      catch: localStorage.getItem('mandarinly_game_best_catch') || '0'
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
              <span class="mode-icon">🧺</span>
              <span class="mode-text">Hứng từ</span>
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
                : 'Di chuyển giỏ hứng để bắt đúng chữ Hán khớp với nghĩa mục tiêu!'
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
      levelSelect.addEventListener('change', (e) => {
        currentLevel = e.target.value;
        startActiveGame();
      });
    }

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
    }
  }

  // ==========================================
  // GAME 1: LẬT THẺ TRÍ NHỚ (MEMORY CARDS)
  // ==========================================
  function startMemoryGame(arena) {
    const wordsPool = getFilteredWords();
    if (wordsPool.length < 4) {
      arena.innerHTML = `<div class="game-empty">Không đủ từ vựng ở cấp độ này để tạo trò chơi. Vui lòng chọn cấp độ khác.</div>`;
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
                  <span class="card-pattern">🀄</span>
                </div>
                <div class="card-back ${card.type}">
                  ${card.type === 'hanzi' ? `<span class="game-pinyin">${escapeHtml(card.pinyin || toPinyin(card.text))}</span>` : ''}
                  <strong class="card-main-text">${escapeHtml(card.text)}</strong>
                  ${card.type === 'meaning' ? `<small class="card-sub-text">Nghĩa</small>` : ''}
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
        if (cardEl.classList.contains('is-flipped') || cardEl.classList.contains('is-matched')) return;

        sounds.playFlip();
        cardEl.classList.add('is-flipped');

        const cardIdx = Number(cardEl.dataset.cardIdx);
        const cardData = shuffledCards[cardIdx];
        flippedCards.push({ el: cardEl, data: cardData });

        if (cardData.speakText) {
          speakChinese(cardData.speakText);
        }

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
      arena.innerHTML = `<div class="game-empty">Cần ít nhất 4 từ vựng để bắt đầu trò chơi. Hãy chọn cấp độ khác.</div>`;
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
    if (wordsPool.length < 5) {
      arena.innerHTML = `<div class="game-empty">Cần ít nhất 5 từ vựng để bắt đầu nối cặp. Hãy chọn cấp độ khác.</div>`;
      return;
    }

    let round = 1;
    let score = 0;
    const batchSize = 5;

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
  // GAME 4: HỨNG TỪ (WORD CATCHER)
  // ==========================================
  function startCatchGame(arena) {
    const wordsPool = getFilteredWords();
    if (wordsPool.length < 4) {
      arena.innerHTML = `<div class="game-empty">Cần ít nhất 4 từ vựng để bắt đầu trò chơi hứng từ. Hãy chọn cấp độ khác.</div>`;
      return;
    }

    let score = 0;
    let streak = 0;
    let maxStreak = 0;
    let caughtCount = 0;
    let attemptsCount = 0;
    let timeLeft = 60;
    let lives = 3;
    let isGameOver = false;
    let currentTarget = null;
    let fallingWords = [];
    let basketX = 200;
    const basketWidth = 130;
    const keys = { left: false, right: false };

    arena.innerHTML = `
      <div class="catch-game-panel">
        <div class="catch-hud">
          <div class="hud-item">
            <span>⏳ Thời gian:</span>
            <strong id="catchSeconds">60s</strong>
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
          <span>Tìm chữ Hán có nghĩa:</span>
          <strong id="catchTargetText">...</strong>
          <button type="button" class="speed-speak-btn" id="catchSpeakBtn" title="Phát âm" style="position:static;transform:none;width:32px;height:32px;font-size:14px;">🔊</button>
        </div>

        <div class="catch-board" id="catchBoard">
          <div class="falling-items-wrap" id="fallingContainer"></div>
          <div class="catcher-basket" id="catcherBasket" style="left: ${basketX}px;">
            <span class="catcher-icon">🧺</span>
            <span class="catcher-text">HỨNG TỪ</span>
          </div>
        </div>

        <div class="catch-touch-controls">
          <button type="button" class="catch-move-btn" id="btnMoveLeft">◀ Di chuyển Trái</button>
          <button type="button" class="catch-move-btn" id="btnMoveRight">Di chuyển Phải ▶</button>
        </div>
      </div>
    `;

    const catchBoard = arena.querySelector('#catchBoard');
    const fallingContainer = arena.querySelector('#fallingContainer');
    const basketEl = arena.querySelector('#catcherBasket');
    const targetTextEl = arena.querySelector('#catchTargetText');
    const speakBtn = arena.querySelector('#catchSpeakBtn');
    const secondsEl = arena.querySelector('#catchSeconds');
    const livesEl = arena.querySelector('#catchLives');
    const scoreEl = arena.querySelector('#catchScore');
    const streakEl = arena.querySelector('#catchStreak');
    const restartBtn = arena.querySelector('#catchRestart');
    const btnMoveLeft = arena.querySelector('#btnMoveLeft');
    const btnMoveRight = arena.querySelector('#btnMoveRight');

    restartBtn.addEventListener('click', () => startCatchGame(arena));

    // Center basket initially
    const boardWidth = catchBoard.clientWidth || 600;
    basketX = (boardWidth - basketWidth) / 2;
    basketEl.style.left = `${basketX}px`;

    // Mouse Controls
    const onMouseMove = (e) => {
      if (isGameOver) return;
      const rect = catchBoard.getBoundingClientRect();
      const x = e.clientX - rect.left;
      basketX = Math.max(0, Math.min(rect.width - basketWidth, x - basketWidth / 2));
      basketEl.style.left = `${basketX}px`;
    };

    // Touch Controls
    const onTouchMove = (e) => {
      if (isGameOver || !e.touches.length) return;
      const rect = catchBoard.getBoundingClientRect();
      const x = e.touches[0].clientX - rect.left;
      basketX = Math.max(0, Math.min(rect.width - basketWidth, x - basketWidth / 2));
      basketEl.style.left = `${basketX}px`;
    };

    catchBoard.addEventListener('mousemove', onMouseMove);
    catchBoard.addEventListener('touchmove', onTouchMove, { passive: true });

    // Keyboard Controls
    const onKeyDown = (e) => {
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') keys.left = true;
      if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') keys.right = true;
    };
    const onKeyUp = (e) => {
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') keys.left = false;
      if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') keys.right = false;
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    activeCleanups.push(() => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    });

    // Touch button handlers
    const bindHoldBtn = (btn, dir) => {
      if (!btn) return;
      const start = (e) => { e.preventDefault(); keys[dir] = true; };
      const stop = (e) => { e.preventDefault(); keys[dir] = false; };
      btn.addEventListener('mousedown', start);
      btn.addEventListener('mouseup', stop);
      btn.addEventListener('mouseleave', stop);
      btn.addEventListener('touchstart', start, { passive: false });
      btn.addEventListener('touchend', stop);
    };
    bindHoldBtn(btnMoveLeft, 'left');
    bindHoldBtn(btnMoveRight, 'right');

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

      const earnedPoints = Math.min(100, Math.max(15, Math.round(score * 0.1)));
      recordScore({ category: 'game', points: earnedPoints, description: `Hứng từ vựng (${score}đ)` });

      const bestScore = Number(localStorage.getItem('mandarinly_game_best_catch') || 0);
      if (score > bestScore) {
        localStorage.setItem('mandarinly_game_best_catch', String(score));
      }

      showVictoryModal(arena, {
        title: lives <= 0 ? 'Hết mạng! Cố gắng lần sau nhé 🧺' : 'Hoàn thành lượt chơi! Xuất sắc 🌟',
        score: score,
        stats: [
          { label: 'Số từ hứng đúng', value: `${caughtCount} từ` },
          { label: 'Combo lớn nhất', value: `${maxStreak}x 🔥` },
          { label: 'Độ chính xác', value: attemptsCount ? `${Math.round((caughtCount / attemptsCount) * 100)}%` : '0%' }
        ],
        onReplay: () => startCatchGame(arena)
      });
    }

    function spawnNextWave() {
      if (isGameOver) return;

      // Remove existing falling items
      fallingWords.forEach((item) => item.el.remove());
      fallingWords = [];

      // Pick target word
      currentTarget = wordsPool[Math.floor(Math.random() * wordsPool.length)];
      targetTextEl.textContent = `"${currentTarget.meaning}"`;
      speakBtn.onclick = () => speakChinese(currentTarget.hanzi);

      // Pick 2 distractor words
      const distractors = shuffle(wordsPool.filter((w) => w.meaning !== currentTarget.meaning)).slice(0, 2);
      const waveWords = shuffle([
        { word: currentTarget, isCorrect: true },
        ...distractors.map((w) => ({ word: w, isCorrect: false }))
      ]);

      const currentWidth = catchBoard.clientWidth || 600;
      const colWidth = currentWidth / waveWords.length;

      waveWords.forEach((entry, idx) => {
        const itemEl = document.createElement('div');
        itemEl.className = 'falling-item';
        itemEl.innerHTML = `
          <span class="game-pinyin">${escapeHtml(entry.word.pinyin || toPinyin(entry.word.hanzi))}</span>
          <strong class="drop-hanzi">${escapeHtml(entry.word.hanzi)}</strong>
        `;

        const colCenter = idx * colWidth + colWidth / 2;
        const xPos = Math.max(50, Math.min(currentWidth - 50, colCenter + (Math.random() - 0.5) * (colWidth * 0.3)));
        const yPos = -40 - Math.random() * 40;

        itemEl.style.left = `${xPos}px`;
        itemEl.style.top = `${yPos}px`;
        fallingContainer.appendChild(itemEl);

        const baseSpeed = 0.8 + Math.min(0.7, score * 0.0003);

        fallingWords.push({
          el: itemEl,
          hanzi: entry.word.hanzi,
          pinyin: entry.word.pinyin,
          isCorrect: entry.isCorrect,
          x: xPos,
          y: yPos,
          speed: baseSpeed + (Math.random() * 0.15 - 0.07)
        });
      });
    }

    // Animation Loop
    function gameLoop() {
      if (isGameOver) return;

      const currentWidth = catchBoard.clientWidth || 600;
      const currentHeight = catchBoard.clientHeight || 440;

      // Keyboard movement
      if (keys.left) {
        basketX = Math.max(0, basketX - 7);
        basketEl.style.left = `${basketX}px`;
      }
      if (keys.right) {
        basketX = Math.min(currentWidth - basketWidth, basketX + 7);
        basketEl.style.left = `${basketX}px`;
      }

      const basketLeft = basketX;
      const basketRight = basketX + basketWidth;
      const basketTop = currentHeight - 60;
      const basketBottom = currentHeight - 10;

      let waveNeedsRespawn = false;

      for (let i = fallingWords.length - 1; i >= 0; i--) {
        const item = fallingWords[i];
        item.y += item.speed;
        item.el.style.top = `${item.y}px`;

        const itemBottom = item.y + 38;
        const itemCenterX = item.x;

        // Check collision with basket
        if (itemBottom >= basketTop && item.y <= basketBottom && itemCenterX >= basketLeft - 10 && itemCenterX <= basketRight + 10) {
          attemptsCount++;
          if (item.isCorrect) {
            // Correct catch!
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
            showPopupText(`+${addedScore} ${multiplier > 1 ? `(${multiplier}x)` : ''}`, true, basketX + 30, basketTop - 20);

            item.el.classList.add('caught');
            waveNeedsRespawn = true;
            break;
          } else {
            // Wrong catch!
            streak = 0;
            streakEl.textContent = '0x';
            sounds.playWrong();
            lives--;
            livesEl.textContent = '❤️'.repeat(Math.max(0, lives)) + '🖤'.repeat(Math.max(0, 3 - lives));

            basketEl.classList.add('shake');
            setTimeout(() => basketEl.classList.remove('shake'), 300);

            showPopupText('-1 ❤️ Sai từ!', false, basketX + 20, basketTop - 20);

            item.el.remove();
            fallingWords.splice(i, 1);

            if (lives <= 0) {
              triggerGameOver();
              return;
            }
          }
        } else if (item.y > currentHeight + 10) {
          // Fallen off screen
          if (item.isCorrect) {
            // Missed target word
            streak = 0;
            streakEl.textContent = '0x';
            showPopupText('Bỏ lỡ! 💨', false, Math.max(30, Math.min(currentWidth - 80, item.x - 20)), currentHeight - 30);
            waveNeedsRespawn = true;
            break;
          } else {
            item.el.remove();
            fallingWords.splice(i, 1);
          }
        }
      }

      if (waveNeedsRespawn) {
        setTimeout(spawnNextWave, 250);
      }

      activeAnimFrame = requestAnimationFrame(gameLoop);
    }

    // Timer countdown
    activeInterval = setInterval(() => {
      timeLeft--;
      if (secondsEl) secondsEl.textContent = `${timeLeft}s`;
      if (timeLeft <= 0) {
        triggerGameOver();
      }
    }, 1000);

    spawnNextWave();
    activeAnimFrame = requestAnimationFrame(gameLoop);
  }

  // Victory Dialog Overlay
  function showVictoryModal(arena, { title, score, stats = [], onReplay }) {
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

