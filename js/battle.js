import { supabase } from './supabase.js';
import { pinyin } from 'https://esm.sh/pinyin-pro@3.27.0';
import { recordScore } from './score-service.js';

function toPinyin(hanzi) {
  try {
    return pinyin(hanzi, { toneType: 'symbol' });
  } catch (_) {
    return '';
  }
}

const escapeHtml = (val = '') =>
  String(val)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

const shuffle = (items) => [...items].sort(() => Math.random() - 0.5);

// Sound effects synthesizer
class BattleSounds {
  constructor() {
    this.ctx = null;
    this.muted = localStorage.getItem('mandarinly_sound_muted') === 'true';
  }

  initCtx() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) this.ctx = new AudioCtx();
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  playTick() {
    if (this.muted) return;
    try {
      this.initCtx();
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(400, this.ctx.currentTime);
      gain.gain.setValueAtTime(0.08, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.05);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.05);
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
      osc.frequency.setValueAtTime(200, now);
      osc.frequency.setValueAtTime(160, now + 0.1);
      gain.gain.setValueAtTime(0.14, now);
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
      [440, 554.37, 659.25, 880].forEach((freq, idx) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now + idx * 0.09);
        gain.gain.setValueAtTime(0.2, now + idx * 0.09);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.09 + 0.3);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now + idx * 0.09);
        osc.stop(now + idx * 0.09 + 0.3);
      });
    } catch (_) {}
  }
}

const sounds = new BattleSounds();

function speakChinese(text) {
  if (!('speechSynthesis' in window) || !text) return;
  try {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'zh-CN';
    utterance.rate = 0.88;
    window.speechSynthesis.speak(utterance);
  } catch (_) {}
}

// Fallback pool in case Supabase is temporarily unreachable
const FALLBACK_VOCAB = [
  { vocab: '你好', vietnamese_meaning: 'xin chào', pinyin: 'nǐ hǎo' },
  { vocab: '学习', vietnamese_meaning: 'học tập', pinyin: 'xué xí' },
  { vocab: '工作', vietnamese_meaning: 'làm việc', pinyin: 'gōng zuò' },
  { vocab: '高兴', vietnamese_meaning: 'vui vẻ', pinyin: 'gāo xìng' },
  { vocab: '朋友', vietnamese_meaning: 'bạn bè', pinyin: 'péng you' },
  { vocab: '喝水', vietnamese_meaning: 'uống nước', pinyin: 'hē shuǐ' },
  { vocab: '苹果', vietnamese_meaning: 'quả táo', pinyin: 'píng guǒ' },
  { vocab: '努力', vietnamese_meaning: 'nỗ lực', pinyin: 'nǔ lì' },
  { vocab: '车间', vietnamese_meaning: 'phân xưởng', pinyin: 'chē jiān' },
  { vocab: '仓库', vietnamese_meaning: 'kho hàng', pinyin: 'cāng kù' },
  { vocab: '上班', vietnamese_meaning: 'đi làm', pinyin: 'shàng bān' },
  { vocab: '下班', vietnamese_meaning: 'tan làm', pinyin: 'xià bān' }
];

const FALLBACK_SENTENCES = [
  { question_vi: 'Tôi đang học tiếng Trung.', answer_zh: '我正在学习汉语。', words: ['我', '正在', '学习', '汉语'] },
  { question_vi: 'Hôm nay công việc rất bận.', answer_zh: '今天工作很忙。', words: ['今天', '工作', '很', '忙'] },
  { question_vi: 'Bạn thích uống trà không?', answer_zh: '你喜欢喝茶吗？', words: ['你', '喜欢', '喝茶', '吗'] },
  { question_vi: 'Chào mừng bạn đến công ty chúng tôi.', answer_zh: '欢迎来到我们公司。', words: ['欢迎', '来到', '我们', '公司'] }
];

// Active channel and cleanup trackers
let activeChannel = null;
let activeInterval = null;
let botTimeout = null;

function clearBattleSession() {
  if (activeChannel) {
    try {
      supabase.removeChannel(activeChannel);
    } catch (_) {}
    activeChannel = null;
  }
  if (activeInterval) {
    clearInterval(activeInterval);
    activeInterval = null;
  }
  if (botTimeout) {
    clearTimeout(botTimeout);
    botTimeout = null;
  }
}

/**
 * Tải dữ liệu từ vựng & sắp xếp câu từ Supabase
 */
async function loadBattleResources() {
  let vocabList = [];
  let sentenceList = [];

  try {
    const { data: vData } = await supabase
      .from('vocabulary')
      .select('vocab, vietnamese_meaning, book_level')
      .limit(300);

    if (vData && vData.length >= 8) {
      vocabList = vData.map((w) => ({
        vocab: w.vocab.trim(),
        vietnamese_meaning: w.vietnamese_meaning.trim(),
        pinyin: toPinyin(w.vocab.trim())
      }));
    }
  } catch (e) {
    console.warn('Cannot fetch vocabulary from Supabase, using fallback:', e);
  }

  try {
    const { data: sData } = await supabase
      .from('sentence_order_exercises')
      .select('question_vi, answer_zh, words')
      .limit(100);

    if (sData && sData.length >= 4) {
      sentenceList = sData.map((s) => {
        let parsedWords = [];
        if (Array.isArray(s.words)) {
          parsedWords = s.words;
        } else {
          try {
            parsedWords = JSON.parse(s.words);
          } catch (_) {
            parsedWords = String(s.words || '').split(/[，,\s]+/).filter(Boolean);
          }
        }
        return {
          question_vi: s.question_vi.trim(),
          answer_zh: s.answer_zh.trim(),
          words: parsedWords
        };
      });
    }
  } catch (e) {
    console.warn('Cannot fetch sentence exercises from Supabase, using fallback:', e);
  }

  if (vocabList.length < 8) vocabList = FALLBACK_VOCAB;
  if (sentenceList.length < 4) sentenceList = FALLBACK_SENTENCES;

  return { vocabList, sentenceList };
}

/**
 * Sinh bộ 6 câu hỏi thi đấu gồm cả 3 dạng
 */
function generateBattleQuestions(vocabList, sentenceList) {
  const questions = [];

  // Dạng 1: Chọn từ đúng (Trắc nghiệm Việt -> Hán)
  const v1 = shuffle(vocabList);
  const target1 = v1[0];
  const distractors1 = v1.slice(1, 4);
  questions.push({
    id: 1,
    type: 'choice',
    typeName: 'Chọn từ đúng',
    prompt: `Chọn chữ Hán có nghĩa là: "${target1.vietnamese_meaning}"`,
    speakText: target1.vocab,
    correctAnswer: target1.vocab,
    options: shuffle([
      { hanzi: target1.vocab, pinyin: target1.pinyin },
      ...distractors1.map((d) => ({ hanzi: d.vocab, pinyin: d.pinyin }))
    ])
  });

  // Dạng 2: Sắp xếp câu
  const sPool = shuffle(sentenceList);
  const s1 = sPool[0];
  questions.push({
    id: 2,
    type: 'order',
    typeName: 'Sắp xếp câu',
    prompt: `Sắp xếp các từ tiếng Trung khớp với nghĩa: "${s1.question_vi}"`,
    correctAnswer: s1.answer_zh,
    words: shuffle([...s1.words])
  });

  // Dạng 3: Nối cặp từ (4 cặp)
  const vPairs = shuffle(vocabList).slice(0, 4);
  questions.push({
    id: 3,
    type: 'match',
    typeName: 'Nối cặp từ vựng',
    prompt: 'Nối nhanh các cặp chữ Hán và nghĩa tiếng Việt tương ứng',
    pairs: vPairs.map((p) => ({
      hanzi: p.vocab,
      pinyin: p.pinyin,
      meaning: p.vietnamese_meaning
    }))
  });

  // Dạng 4: Chọn từ đúng (Trắc nghiệm Hán -> Việt)
  const target2 = v1[4] || v1[1];
  const distractors2 = v1.filter((w) => w.vocab !== target2.vocab).slice(0, 3);
  questions.push({
    id: 4,
    type: 'choice_meaning',
    typeName: 'Chọn nghĩa đúng',
    prompt: `Nghĩa tiếng Việt của chữ Hán: "${target2.vocab}"`,
    speakText: target2.vocab,
    pinyinPrompt: target2.pinyin,
    correctAnswer: target2.vietnamese_meaning,
    options: shuffle([
      target2.vietnamese_meaning,
      ...distractors2.map((d) => d.vietnamese_meaning)
    ])
  });

  // Dạng 5: Sắp xếp câu
  const s2 = sPool[1] || sPool[0];
  questions.push({
    id: 5,
    type: 'order',
    typeName: 'Sắp xếp câu',
    prompt: `Sắp xếp các từ tiếng Trung khớp với nghĩa: "${s2.question_vi}"`,
    correctAnswer: s2.answer_zh,
    words: shuffle([...s2.words])
  });

  // Dạng 6: Nối cặp từ
  const vPairs2 = shuffle(vocabList.filter((w) => !vPairs.some((p) => p.vocab === w.vocab))).slice(0, 4);
  const finalPairs = vPairs2.length === 4 ? vPairs2 : vPairs;
  questions.push({
    id: 6,
    type: 'match',
    typeName: 'Nối cặp từ vựng (Hiệp quyết định)',
    prompt: 'Nối các cặp từ vựng để ghi điểm quyết định chiến thắng!',
    pairs: finalPairs.map((p) => ({
      hanzi: p.vocab,
      pinyin: p.pinyin,
      meaning: p.vietnamese_meaning
    }))
  });

  return questions;
}

/**
 * Khởi tạo giao diện và tiến trình Thi đấu 1v1
 */
export async function initBattle({ selector = '[data-battle]', toast } = {}) {
  const container = document.querySelector(selector);
  if (!container) return;

  clearBattleSession();

  let currentUser = null;
  try {
    const { data } = await supabase.auth.getUser();
    currentUser = data?.user || null;
  } catch (_) {}

  const myPlayer = {
    id: currentUser?.id || `guest_${Math.random().toString(36).substring(2, 9)}`,
    name: currentUser?.user_metadata?.full_name || currentUser?.email?.split('@')[0] || 'Chiến binh (Bạn)',
    avatar: currentUser?.user_metadata?.avatar_url || 'picture/student.jpg'
  };

  // Render Lobby
  renderLobby();

  function renderLobby() {
    clearBattleSession();

    container.innerHTML = `
      <div class="battle-lobby">
        <div class="battle-hero">
          <div class="battle-hero-badge">⚔️ ĐẤU TRƯỜNG THỜI GIAN THỰC</div>
          <h1>Thi đấu đối kháng 1v1 Realtime</h1>
          <p>Thách thức người học khác trong trận đấu 6 câu hỏi: Sắp xếp câu, Chọn từ đúng và Nối cặp từ vựng. Cập nhật tỉ số tức thời!</p>
        </div>

        <div class="battle-mode-grid">
          <!-- Mode 1: Quick Match -->
          <div class="battle-mode-card active">
            <div class="mode-icon-wrap">⚡</div>
            <h3>Tìm trận nhanh</h3>
            <p>Tự động ghép trận ngẫu nhiên với người chơi đang online qua Supabase Realtime.</p>
            <button type="button" class="battle-btn-start" id="btnQuickMatch">
              <span>Bắt đầu tìm trận</span> ➔
            </button>
          </div>

          <!-- Mode 2: Room Code -->
          <div class="battle-mode-card">
            <div class="mode-icon-wrap">🔑</div>
            <h3>Phòng bạn bè</h3>
            <p>Tạo phòng hoặc nhập mã phòng 4 ký tự để thách đấu trực tiếp với bạn bè.</p>
            <div class="room-input-group">
              <input type="text" id="roomCodeInput" placeholder="MÃ PHÒNG (VD: HSK8)" maxlength="6" />
              <button type="button" class="battle-btn-secondary" id="btnJoinRoom">Vào phòng</button>
            </div>
            <button type="button" class="battle-btn-outline" id="btnCreateRoom">Tạo mã phòng mới</button>
          </div>

          <!-- Mode 3: Practice Bot -->
          <div class="battle-mode-card">
            <div class="mode-icon-wrap">🤖</div>
            <h3>Luyện tập với AI</h3>
            <p>Đấu với học viên ảo AI với tốc độ thực tế để làm quen trước khi thi đấu thật.</p>
            <button type="button" class="battle-btn-secondary" id="btnPlayBot">
              <span>Đấu với Bot</span> ➔
            </button>
          </div>
        </div>

        <div class="battle-rules-strip">
          <div class="rule-col">
            <strong>⏱️ 20 giây / câu</strong>
            <span>Trả lời càng nhanh càng được nhiều điểm thưởng tốc độ</span>
          </div>
          <div class="rule-col">
            <strong>🎯 3 Dạng câu hỏi</strong>
            <span>Chọn từ đúng · Sắp xếp câu · Nối cặp từ vựng</span>
          </div>
          <div class="rule-col">
            <strong>🏆 Thưởng xếp hạng</strong>
            <span>Chiến thắng được cộng +50 điểm vào BXH Tuần của Supabase</span>
          </div>
        </div>
      </div>
    `;

    // Bind Quick Match
    container.querySelector('#btnQuickMatch').addEventListener('click', () => {
      startMatchmaking();
    });

    // Bind Join Room
    container.querySelector('#btnJoinRoom').addEventListener('click', () => {
      const code = container.querySelector('#roomCodeInput').value.trim().toUpperCase();
      if (!code) {
        if (toast) toast('Vui lòng nhập mã phòng!');
        return;
      }
      joinPrivateRoom(code);
    });

    // Bind Create Room
    container.querySelector('#btnCreateRoom').addEventListener('click', () => {
      const code = Math.random().toString(36).substring(2, 6).toUpperCase();
      createPrivateRoom(code);
    });

    // Bind Play with Bot
    container.querySelector('#btnPlayBot').addEventListener('click', () => {
      startBotMatch();
    });
  }

  // ==========================================
  // MATCHMAKING LOGIC (SUPABASE PRESENCE)
  // ==========================================
  function startMatchmaking() {
    container.innerHTML = `
      <div class="battle-matchmaking-screen">
        <div class="radar-spinner">
          <div class="radar-circle"></div>
          <div class="radar-circle circle-2"></div>
          <div class="radar-circle circle-3"></div>
          <span class="radar-center-icon">⚔️</span>
        </div>
        <h2>Đang tìm kiếm đối thủ...</h2>
        <p>Đang quét người học trực tuyến trên Supabase Realtime</p>
        <div class="matchmaking-status" id="matchStatusText">Thời gian chờ: 0s</div>
        <div class="matchmaking-actions">
          <button type="button" class="battle-btn-secondary" id="btnCancelMatch">Hủy tìm kiếm</button>
          <button type="button" class="battle-btn-outline" id="btnSwitchToBot" style="display:none;">Đấu ngay với AI</button>
        </div>
      </div>
    `;

    let waitSeconds = 0;
    const timerEl = container.querySelector('#matchStatusText');
    const switchToBotBtn = container.querySelector('#btnSwitchToBot');

    const waitInterval = setInterval(() => {
      waitSeconds++;
      if (timerEl) timerEl.textContent = `Thời gian chờ: ${waitSeconds}s`;
      if (waitSeconds >= 7 && switchToBotBtn) {
        switchToBotBtn.style.display = 'inline-block';
      }
    }, 1000);

    container.querySelector('#btnCancelMatch').addEventListener('click', () => {
      clearInterval(waitInterval);
      clearBattleSession();
      renderLobby();
    });

    switchToBotBtn.addEventListener('click', () => {
      clearInterval(waitInterval);
      clearBattleSession();
      startBotMatch();
    });

    // Connect to Supabase Realtime Lobby Channel
    const lobby = supabase.channel('realtime:battle_lobby', {
      config: { presence: { key: myPlayer.id } }
    });
    activeChannel = lobby;

    let matchStarted = false;

    lobby
      .on('presence', { event: 'sync' }, async () => {
        if (matchStarted) return;
        const presenceState = lobby.presenceState();
        const userKeys = Object.keys(presenceState);

        // Find another player
        const opponentKey = userKeys.find((k) => k !== myPlayer.id);
        if (opponentKey) {
          const opponentData = presenceState[opponentKey][0]?.user || {
            id: opponentKey,
            name: 'Đối thủ online',
            avatar: 'picture/main_picture.png'
          };

          // Host is player with smaller ID string
          const isHost = myPlayer.id < opponentKey;
          const roomId = `room_${[myPlayer.id, opponentKey].sort().join('_').substring(0, 24)}`;

          matchStarted = true;
          clearInterval(waitInterval);

          if (isHost) {
            const { vocabList, sentenceList } = await loadBattleResources();
            const questions = generateBattleQuestions(vocabList, sentenceList);

            lobby.send({
              type: 'broadcast',
              event: 'match_found',
              payload: { roomId, hostId: myPlayer.id, questions }
            });

            launchLiveMatch({
              roomId,
              myRole: 'host',
              opponent: opponentData,
              questions
            });
          }
        }
      })
      .on('broadcast', { event: 'match_found' }, (payload) => {
        if (matchStarted) return;
        const data = payload.payload;
        if (data && data.hostId !== myPlayer.id) {
          matchStarted = true;
          clearInterval(waitInterval);

          const opponentData = {
            id: data.hostId,
            name: 'Đối thủ online',
            avatar: 'picture/main_picture.png'
          };

          launchLiveMatch({
            roomId: data.roomId,
            myRole: 'guest',
            opponent: opponentData,
            questions: data.questions
          });
        }
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await lobby.track({ user: myPlayer, joined_at: Date.now() });
        }
      });
  }

  // ==========================================
  // PRIVATE ROOM (CREATE & JOIN)
  // ==========================================
  async function createPrivateRoom(code) {
    container.innerHTML = `
      <div class="battle-matchmaking-screen">
        <div class="radar-spinner">
          <span class="radar-center-icon">🔑</span>
        </div>
        <h2>Mã phòng: <strong style="color:#28543b;letter-spacing:2px;">${code}</strong></h2>
        <p>Hãy gửi mã phòng này cho bạn bè để cùng tham gia thi đấu!</p>
        <div class="matchmaking-status">Đang chờ bạn bè vào phòng...</div>
        <div class="matchmaking-actions">
          <button type="button" class="battle-btn-secondary" id="btnCancelRoom">Hủy phòng</button>
        </div>
      </div>
    `;

    container.querySelector('#btnCancelRoom').addEventListener('click', () => {
      clearBattleSession();
      renderLobby();
    });

    const roomChannel = supabase.channel(`realtime:battle_room_${code}`, {
      config: { presence: { key: myPlayer.id } }
    });
    activeChannel = roomChannel;

    roomChannel
      .on('presence', { event: 'join' }, async ({ key, newPresences }) => {
        if (key !== myPlayer.id && newPresences && newPresences.length > 0) {
          const opponentData = newPresences[0].user || {
            id: key,
            name: 'Bạn bè',
            avatar: 'picture/practice.png'
          };

          const { vocabList, sentenceList } = await loadBattleResources();
          const questions = generateBattleQuestions(vocabList, sentenceList);

          roomChannel.send({
            type: 'broadcast',
            event: 'room_start',
            payload: { questions, host: myPlayer }
          });

          launchLiveMatch({
            roomId: `battle_room_${code}`,
            myRole: 'host',
            opponent: opponentData,
            questions
          });
        }
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await roomChannel.track({ user: myPlayer });
        }
      });
  }

  function joinPrivateRoom(code) {
    container.innerHTML = `
      <div class="battle-matchmaking-screen">
        <div class="radar-spinner">
          <span class="radar-center-icon">⚔️</span>
        </div>
        <h2>Đang kết nối vào phòng ${code}...</h2>
        <p>Vui lòng đợi chủ phòng bắt đầu trận đấu.</p>
        <div class="matchmaking-actions">
          <button type="button" class="battle-btn-secondary" id="btnCancelJoin">Quay lại</button>
        </div>
      </div>
    `;

    container.querySelector('#btnCancelJoin').addEventListener('click', () => {
      clearBattleSession();
      renderLobby();
    });

    const roomChannel = supabase.channel(`realtime:battle_room_${code}`, {
      config: { presence: { key: myPlayer.id } }
    });
    activeChannel = roomChannel;

    roomChannel
      .on('broadcast', { event: 'room_start' }, (payload) => {
        const data = payload.payload;
        if (data && data.questions) {
          launchLiveMatch({
            roomId: `battle_room_${code}`,
            myRole: 'guest',
            opponent: data.host,
            questions: data.questions
          });
        }
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await roomChannel.track({ user: myPlayer });
        }
      });
  }

  // ==========================================
  // PRACTICE WITH AI BOT
  // ==========================================
  async function startBotMatch() {
    const { vocabList, sentenceList } = await loadBattleResources();
    const questions = generateBattleQuestions(vocabList, sentenceList);

    const botOpponent = {
      id: 'bot_panda',
      name: 'Panda AI (Học viên)',
      avatar: 'picture/main_picture.png',
      isBot: true
    };

    launchLiveMatch({
      roomId: 'local_bot_match',
      myRole: 'player',
      opponent: botOpponent,
      questions
    });
  }

  // ==========================================
  // LIVE BATTLE ARENA
  // ==========================================
  function launchLiveMatch({ roomId, opponent, questions }) {
    clearBattleSession();

    let currentIndex = 0;
    let myScore = 0;
    let opponentScore = 0;
    let myCombo = 0;
    let opponentCombo = 0;
    let roundTimeLeft = 20;
    let myAnswered = false;
    let opponentAnswered = false;
    let matchFinished = false;

    // Connect match channel if real opponent
    let matchChannel = null;
    if (!opponent.isBot) {
      matchChannel = supabase.channel(`realtime:match_${roomId}`);
      activeChannel = matchChannel;

      matchChannel
        .on('broadcast', { event: 'player_update' }, (payload) => {
          const data = payload.payload;
          if (data && data.playerId !== myPlayer.id) {
            opponentScore = data.score;
            opponentCombo = data.combo;
            opponentAnswered = true;
            updateOpponentUI(data);

            if (myAnswered && opponentAnswered) {
              setTimeout(advanceQuestion, 1200);
            }
          }
        })
        .subscribe();
    }

    renderMatchArena();

    function renderMatchArena() {
      container.innerHTML = `
        <div class="battle-arena">
          <!-- Top Duel Header -->
          <div class="battle-duel-header">
            <!-- Player Me -->
            <div class="duel-player me">
              <img class="duel-avatar" src="${myPlayer.avatar}" alt="${escapeHtml(myPlayer.name)}" />
              <div class="duel-player-info">
                <strong>${escapeHtml(myPlayer.name)}</strong>
                <span class="duel-score" id="myScoreText">0 đ</span>
              </div>
              <div class="duel-progress-track">
                <div class="duel-progress-bar" id="myProgressBar" style="width: 0%;"></div>
              </div>
            </div>

            <!-- VS & Timer Badge -->
            <div class="duel-center">
              <span class="duel-vs-badge">VS</span>
              <div class="duel-timer-box">
                <span class="duel-timer-val" id="duelTimerVal">20s</span>
              </div>
              <span class="duel-round-label" id="duelRoundLabel">Câu 1/6</span>
            </div>

            <!-- Opponent -->
            <div class="duel-player opponent">
              <div class="duel-player-info right">
                <strong>${escapeHtml(opponent.name)}</strong>
                <span class="duel-score" id="oppScoreText">0 đ</span>
              </div>
              <img class="duel-avatar" src="${opponent.avatar}" alt="${escapeHtml(opponent.name)}" />
              <div class="duel-progress-track">
                <div class="duel-progress-bar opponent-bar" id="oppProgressBar" style="width: 0%;"></div>
              </div>
            </div>
          </div>

          <!-- Question Content Card -->
          <div class="battle-question-card" id="battleQuestionCard">
            <!-- Dynamic Question Content Injected Here -->
          </div>
        </div>
      `;

      loadCurrentQuestion();
    }

    function updateOpponentUI(data) {
      const oppScoreEl = container.querySelector('#oppScoreText');
      const oppProgEl = container.querySelector('#oppProgressBar');
      if (oppScoreEl) oppScoreEl.textContent = `${data.score} đ`;
      if (oppProgEl) {
        const pct = ((data.questionIndex + 1) / questions.length) * 100;
        oppProgEl.style.width = `${pct}%`;
      }
    }

    function loadCurrentQuestion() {
      if (currentIndex >= questions.length) {
        finishMatch();
        return;
      }

      myAnswered = false;
      opponentAnswered = false;
      roundTimeLeft = 20;

      // Update Header
      const roundLabel = container.querySelector('#duelRoundLabel');
      const timerVal = container.querySelector('#duelTimerVal');
      if (roundLabel) roundLabel.textContent = `Câu ${currentIndex + 1}/${questions.length}`;
      if (timerVal) {
        timerVal.textContent = '20s';
        timerVal.classList.remove('danger');
      }

      const q = questions[currentIndex];
      const card = container.querySelector('#battleQuestionCard');
      if (!card) return;

      // Render question by type
      if (q.type === 'choice') {
        renderChoiceQuestion(card, q);
      } else if (q.type === 'choice_meaning') {
        renderChoiceMeaningQuestion(card, q);
      } else if (q.type === 'order') {
        renderOrderQuestion(card, q);
      } else if (q.type === 'match') {
        renderMatchQuestion(card, q);
      }

      // Start round timer
      if (activeInterval) clearInterval(activeInterval);
      activeInterval = setInterval(() => {
        roundTimeLeft--;
        if (timerVal) {
          timerVal.textContent = `${roundTimeLeft}s`;
          if (roundTimeLeft <= 5) timerVal.classList.add('danger');
        }

        if (roundTimeLeft <= 0) {
          clearInterval(activeInterval);
          if (!myAnswered) {
            handleAnswer(false, 0);
          }
        }
      }, 1000);

      // Simulate bot answer if opponent is bot
      if (opponent.isBot) {
        const botDelay = 4000 + Math.random() * 8000;
        botTimeout = setTimeout(() => {
          if (matchFinished) return;
          const isCorrect = Math.random() < 0.82;
          const botPts = isCorrect ? Math.round(100 + (roundTimeLeft / 20) * 50) : 0;
          opponentScore += botPts;
          if (isCorrect) opponentCombo++; else opponentCombo = 0;
          opponentAnswered = true;

          updateOpponentUI({
            score: opponentScore,
            combo: opponentCombo,
            questionIndex: currentIndex
          });

          if (myAnswered && opponentAnswered) {
            setTimeout(advanceQuestion, 1000);
          }
        }, botDelay);
      }
    }

    // ----------------------------------------
    // RENDER: CHỌN TỪ ĐÚNG (TRẮC NGHIỆM CHỮ HÁN)
    // ----------------------------------------
    function renderChoiceQuestion(card, q) {
      card.innerHTML = `
        <div class="battle-q-header">
          <span class="battle-q-type">${escapeHtml(q.typeName)}</span>
          <h2>${escapeHtml(q.prompt)}</h2>
          ${q.speakText ? `<button type="button" class="speed-speak-btn" id="qSpeakBtn" title="Phát âm">🔊</button>` : ''}
        </div>
        <div class="battle-choice-grid">
          ${q.options
            .map(
              (opt) => `
            <button type="button" class="battle-choice-btn" data-answer="${escapeHtml(opt.hanzi)}">
              <span class="game-pinyin">${escapeHtml(opt.pinyin)}</span>
              <strong>${escapeHtml(opt.hanzi)}</strong>
            </button>
          `
            )
            .join('')}
        </div>
      `;

      const speakBtn = card.querySelector('#qSpeakBtn');
      if (speakBtn && q.speakText) {
        speakBtn.addEventListener('click', () => speakChinese(q.speakText));
      }

      card.querySelectorAll('.battle-choice-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
          if (myAnswered) return;
          const ans = btn.dataset.answer;
          const isCorrect = ans === q.correctAnswer;

          btn.classList.add(isCorrect ? 'correct' : 'wrong');
          sounds.playTick();
          if (isCorrect) {
            sounds.playCorrect();
            speakChinese(ans);
          } else {
            sounds.playWrong();
            const correctBtn = card.querySelector(`[data-answer="${q.correctAnswer}"]`);
            if (correctBtn) correctBtn.classList.add('correct');
          }

          const speedBonus = Math.round((roundTimeLeft / 20) * 50);
          const earned = isCorrect ? 100 + speedBonus : 0;
          handleAnswer(isCorrect, earned);
        });
      });
    }

    // ----------------------------------------
    // RENDER: CHỌN NGHĨA ĐÚNG (TRẮC NGHIỆM TIẾNG VIỆT)
    // ----------------------------------------
    function renderChoiceMeaningQuestion(card, q) {
      card.innerHTML = `
        <div class="battle-q-header">
          <span class="battle-q-type">${escapeHtml(q.typeName)}</span>
          <h2>${escapeHtml(q.prompt)}</h2>
          ${q.pinyinPrompt ? `<span class="game-pinyin" style="font-size:14px;display:block;">${escapeHtml(q.pinyinPrompt)}</span>` : ''}
          ${q.speakText ? `<button type="button" class="speed-speak-btn" id="qSpeakBtn" title="Phát âm">🔊</button>` : ''}
        </div>
        <div class="battle-choice-grid">
          ${q.options
            .map(
              (opt) => `
            <button type="button" class="battle-choice-btn meaning-btn" data-answer="${escapeHtml(opt)}">
              <span>${escapeHtml(opt)}</span>
            </button>
          `
            )
            .join('')}
        </div>
      `;

      const speakBtn = card.querySelector('#qSpeakBtn');
      if (speakBtn && q.speakText) {
        speakBtn.addEventListener('click', () => speakChinese(q.speakText));
      }

      card.querySelectorAll('.battle-choice-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
          if (myAnswered) return;
          const ans = btn.dataset.answer;
          const isCorrect = ans === q.correctAnswer;

          btn.classList.add(isCorrect ? 'correct' : 'wrong');
          if (isCorrect) {
            sounds.playCorrect();
            if (q.speakText) speakChinese(q.speakText);
          } else {
            sounds.playWrong();
            const correctBtn = card.querySelector(`[data-answer="${q.correctAnswer}"]`);
            if (correctBtn) correctBtn.classList.add('correct');
          }

          const speedBonus = Math.round((roundTimeLeft / 20) * 50);
          const earned = isCorrect ? 100 + speedBonus : 0;
          handleAnswer(isCorrect, earned);
        });
      });
    }

    // ----------------------------------------
    // RENDER: SẮP XẾP CÂU
    // ----------------------------------------
    function renderOrderQuestion(card, q) {
      let selectedTokens = [];

      card.innerHTML = `
        <div class="battle-q-header">
          <span class="battle-q-type">${escapeHtml(q.typeName)}</span>
          <h2>${escapeHtml(q.prompt)}</h2>
        </div>
        <div class="battle-order-answer-slot" id="orderAnswerSlot">
          <span class="slot-placeholder">Chạm các từ bên dưới để ghép câu...</span>
        </div>
        <div class="battle-order-bank" id="orderBank">
          ${q.words
            .map(
              (word, i) => `
            <button type="button" class="battle-word-token" data-token-id="${i}" data-token-text="${escapeHtml(word)}">
              <span class="game-pinyin">${escapeHtml(toPinyin(word))}</span>
              <strong>${escapeHtml(word)}</strong>
            </button>
          `
            )
            .join('')}
        </div>
        <div class="battle-order-actions">
          <button type="button" class="battle-btn-secondary" id="btnResetOrder">Xóa ghép lại</button>
          <button type="button" class="battle-btn-primary" id="btnCheckOrder">Xác nhận câu ➔</button>
        </div>
      `;

      const slot = card.querySelector('#orderAnswerSlot');
      const bank = card.querySelector('#orderBank');
      const btnReset = card.querySelector('#btnResetOrder');
      const btnCheck = card.querySelector('#btnCheckOrder');

      function updateSlot() {
        if (!selectedTokens.length) {
          slot.innerHTML = '<span class="slot-placeholder">Chạm các từ bên dưới để ghép câu...</span>';
          return;
        }
        slot.innerHTML = selectedTokens
          .map(
            (t) => `
          <span class="battle-word-token in-slot">
            <span class="game-pinyin">${escapeHtml(toPinyin(t.text))}</span>
            <strong>${escapeHtml(t.text)}</strong>
          </span>
        `
          )
          .join('');
      }

      bank.querySelectorAll('.battle-word-token').forEach((btn) => {
        btn.addEventListener('click', () => {
          if (myAnswered || btn.classList.contains('used')) return;
          sounds.playTick();
          btn.classList.add('used');
          selectedTokens.push({ id: btn.dataset.tokenId, text: btn.dataset.tokenText });
          updateSlot();
        });
      });

      btnReset.addEventListener('click', () => {
        if (myAnswered) return;
        selectedTokens = [];
        bank.querySelectorAll('.battle-word-token').forEach((b) => b.classList.remove('used'));
        updateSlot();
      });

      btnCheck.addEventListener('click', () => {
        if (myAnswered || !selectedTokens.length) return;
        const assembled = selectedTokens.map((t) => t.text).join('').replace(/[\s，。！？]/g, '');
        const targetClean = q.correctAnswer.replace(/[\s，。！？]/g, '');
        const isCorrect = assembled === targetClean;

        if (isCorrect) {
          slot.classList.add('correct');
          sounds.playCorrect();
          speakChinese(q.correctAnswer);
        } else {
          slot.classList.add('wrong');
          sounds.playWrong();
        }

        const speedBonus = Math.round((roundTimeLeft / 20) * 50);
        const earned = isCorrect ? 100 + speedBonus : 0;
        handleAnswer(isCorrect, earned);
      });
    }

    // ----------------------------------------
    // RENDER: NỐI CẶP TỪ
    // ----------------------------------------
    function renderMatchQuestion(card, q) {
      let selectedHanzi = null;
      let selectedMeaning = null;
      let matchedCount = 0;

      const hanziList = shuffle(q.pairs);
      const meaningList = shuffle(q.pairs);

      card.innerHTML = `
        <div class="battle-q-header">
          <span class="battle-q-type">${escapeHtml(q.typeName)}</span>
          <h2>${escapeHtml(q.prompt)}</h2>
        </div>
        <div class="battle-match-grid">
          <div class="match-col hanzi-col">
            ${hanziList
              .map(
                (item) => `
              <button type="button" class="match-token-btn" data-hanzi="${escapeHtml(item.hanzi)}">
                <span class="game-pinyin">${escapeHtml(item.pinyin || toPinyin(item.hanzi))}</span>
                <strong>${escapeHtml(item.hanzi)}</strong>
              </button>
            `
              )
              .join('')}
          </div>
          <div class="match-col meaning-col">
            ${meaningList
              .map(
                (item) => `
              <button type="button" class="match-token-btn" data-meaning="${escapeHtml(item.meaning)}" data-for-hanzi="${escapeHtml(item.hanzi)}">
                <span>${escapeHtml(item.meaning)}</span>
              </button>
            `
              )
              .join('')}
          </div>
        </div>
      `;

      const hanziBtns = card.querySelectorAll('.hanzi-col .match-token-btn');
      const meaningBtns = card.querySelectorAll('.meaning-col .match-token-btn');

      function checkPair() {
        if (!selectedHanzi || !selectedMeaning) return;

        const hVal = selectedHanzi.dataset.hanzi;
        const mTarget = selectedMeaning.dataset.forHanzi;

        if (hVal === mTarget) {
          sounds.playCorrect();
          speakChinese(hVal);
          selectedHanzi.classList.add('matched');
          selectedMeaning.classList.add('matched');
          matchedCount++;

          selectedHanzi = null;
          selectedMeaning = null;

          if (matchedCount === q.pairs.length) {
            const speedBonus = Math.round((roundTimeLeft / 20) * 50);
            handleAnswer(true, 100 + speedBonus);
          }
        } else {
          sounds.playWrong();
          selectedHanzi.classList.add('shake');
          selectedMeaning.classList.add('shake');
          setTimeout(() => {
            selectedHanzi?.classList.remove('shake', 'selected');
            selectedMeaning?.classList.remove('shake', 'selected');
            selectedHanzi = null;
            selectedMeaning = null;
          }, 400);
        }
      }

      hanziBtns.forEach((btn) => {
        btn.addEventListener('click', () => {
          if (myAnswered || btn.classList.contains('matched')) return;
          sounds.playTick();
          speakChinese(btn.dataset.hanzi);
          hanziBtns.forEach((b) => b.classList.remove('selected'));
          btn.classList.add('selected');
          selectedHanzi = btn;
          checkPair();
        });
      });

      meaningBtns.forEach((btn) => {
        btn.addEventListener('click', () => {
          if (myAnswered || btn.classList.contains('matched')) return;
          sounds.playTick();
          meaningBtns.forEach((b) => b.classList.remove('selected'));
          btn.classList.add('selected');
          selectedMeaning = btn;
          checkPair();
        });
      });
    }

    // ----------------------------------------
    // HANDLE ANSWER & BROADCAST
    // ----------------------------------------
    function handleAnswer(isCorrect, points) {
      if (myAnswered) return;
      myAnswered = true;

      if (isCorrect) {
        myCombo++;
        myScore += points;
      } else {
        myCombo = 0;
      }

      // Update My UI
      const myScoreEl = container.querySelector('#myScoreText');
      const myProgEl = container.querySelector('#myProgressBar');
      if (myScoreEl) myScoreEl.textContent = `${myScore} đ`;
      if (myProgEl) {
        const pct = ((currentIndex + 1) / questions.length) * 100;
        myProgEl.style.width = `${pct}%`;
      }

      // Broadcast to opponent
      if (matchChannel) {
        matchChannel.send({
          type: 'broadcast',
          event: 'player_update',
          payload: {
            playerId: myPlayer.id,
            questionIndex: currentIndex,
            score: myScore,
            combo: myCombo,
            isCorrect
          }
        });
      }

      if (opponentAnswered || opponent.isBot) {
        setTimeout(advanceQuestion, 1200);
      }
    }

    function advanceQuestion() {
      if (activeInterval) clearInterval(activeInterval);
      if (botTimeout) clearTimeout(botTimeout);
      currentIndex++;
      loadCurrentQuestion();
    }

    // ----------------------------------------
    // FINISH MATCH & RECORD RESULT
    // ----------------------------------------
    function finishMatch() {
      if (matchFinished) return;
      matchFinished = true;
      clearBattleSession();

      const isWin = myScore > opponentScore;
      const isTie = myScore === opponentScore;

      if (isWin) sounds.playVictory(); else if (isTie) sounds.playCorrect(); else sounds.playWrong();

      // Points earned for Leaderboard
      const rewardPoints = isWin ? 50 : isTie ? 25 : 15;
      recordScore({
        category: 'game',
        points: rewardPoints,
        description: `Đấu trường 1v1 (${isWin ? 'Chiến thắng' : isTie ? 'Hòa' : 'Tham gia'})`
      });

      container.innerHTML = `
        <div class="battle-victory-screen">
          <div class="victory-duel-banner ${isWin ? 'win' : isTie ? 'tie' : 'lose'}">
            <div class="duel-outcome-icon">${isWin ? '🏆' : isTie ? '🤝' : '🥈'}</div>
            <h2>${isWin ? 'CHIẾN THẮNG TUYỆT ĐỐI!' : isTie ? 'HÒA NHAU KỊCH TÍNH!' : 'THẤT BẠI CỐ GẮNG LẦN SAU!'}</h2>
            <p>${isWin ? 'Bạn đã xuất sắc vượt qua đối thủ!' : isTie ? 'Hai bên ngang tài ngang sức!' : 'Đối thủ đã nhanh tay hơn một chút!'}</p>

            <div class="duel-final-scorecard">
              <div class="scorecard-player ${isWin ? 'winner' : ''}">
                <img src="${myPlayer.avatar}" alt="${escapeHtml(myPlayer.name)}" />
                <strong>${escapeHtml(myPlayer.name)}</strong>
                <span class="pts">${myScore} đ</span>
              </div>
              <div class="scorecard-vs">VS</div>
              <div class="scorecard-player ${!isWin && !isTie ? 'winner' : ''}">
                <img src="${opponent.avatar}" alt="${escapeHtml(opponent.name)}" />
                <strong>${escapeHtml(opponent.name)}</strong>
                <span class="pts">${opponentScore} đ</span>
              </div>
            </div>

            <div class="duel-reward-badge">
              <span>Thưởng xếp hạng tuần</span>
              <strong>+${rewardPoints} ĐIỂM</strong>
            </div>

            <div class="battle-actions-row">
              <button type="button" class="battle-btn-primary" id="btnBattleAgain">Tìm trận mới</button>
              <a class="battle-btn-secondary" href="#dashboard">Về Dashboard</a>
            </div>
          </div>
        </div>
      `;

      container.querySelector('#btnBattleAgain').addEventListener('click', () => {
        renderLobby();
      });
    }
  }
}
