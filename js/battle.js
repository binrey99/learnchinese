import { supabase } from './supabase.js';
import { pinyin } from 'https://esm.sh/pinyin-pro@3.27.0';
import { recordScore } from './score-service.js';
import { awardFoodReward } from './lulu.js';
import { recordMistakeWord } from './srs-service.js';

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
  if (sounds.muted || !('speechSynthesis' in window) || !text) return;
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
  { vocab: '下班', vietnamese_meaning: 'tan làm', pinyin: 'xià bān' },
  { vocab: '老师', vietnamese_meaning: 'thầy giáo', pinyin: 'lǎo shī' },
  { vocab: '学生', vietnamese_meaning: 'học sinh', pinyin: 'xué sheng' },
  { vocab: '吃饭', vietnamese_meaning: 'ăn cơm', pinyin: 'chī fàn' },
  { vocab: '喝茶', vietnamese_meaning: 'uống trà', pinyin: 'hē chá' },
  { vocab: '看书', vietnamese_meaning: 'đọc sách', pinyin: 'kàn shū' },
  { vocab: '看电影', vietnamese_meaning: 'xem phim', pinyin: 'kàn diàn yǐng' },
  { vocab: '买东西', vietnamese_meaning: 'mua đồ', pinyin: 'mǎi dōng xi' },
  { vocab: '汉语', vietnamese_meaning: 'tiếng Hán', pinyin: 'hàn yǔ' },
  { vocab: '漂亮', vietnamese_meaning: 'xinh đẹp', pinyin: 'piào liang' },
  { vocab: '便宜', vietnamese_meaning: 'rẻ', pinyin: 'pián yi' },
  { vocab: '准备', vietnamese_meaning: 'chuẩn bị', pinyin: 'zhǔn bèi' },
  { vocab: '检查', vietnamese_meaning: 'kiểm tra', pinyin: 'jiǎn chá' },
  { vocab: '安全', vietnamese_meaning: 'an toàn', pinyin: 'ān quán' },
  { vocab: '产品', vietnamese_meaning: 'sản phẩm', pinyin: 'chǎn pǐn' },
  { vocab: '质量', vietnamese_meaning: 'chất lượng', pinyin: 'zhì liàng' },
  { vocab: '帮助', vietnamese_meaning: 'giúp đỡ', pinyin: 'bāng zhù' },
  { vocab: '时间', vietnamese_meaning: 'thời gian', pinyin: 'shí jiān' },
  { vocab: '明天', vietnamese_meaning: 'ngày mai', pinyin: 'míng tiān' },
  { vocab: '天气', vietnamese_meaning: 'thời tiết', pinyin: 'tiān qì' },
  { vocab: '休息', vietnamese_meaning: 'nghỉ ngơi', pinyin: 'xiū xi' }
];

const FALLBACK_SENTENCES = [
  { question_vi: 'Tôi đang học tiếng Trung.', answer_zh: '我正在学习汉语。', words: ['我', '正在', '学习', '汉语'] },
  { question_vi: 'Hôm nay công việc rất bận.', answer_zh: '今天工作很忙。', words: ['今天', '工作', '很', '忙'] },
  { question_vi: 'Bạn thích uống trà không?', answer_zh: '你喜欢喝茶吗？', words: ['你', '喜欢', '喝茶', '吗'] },
  { question_vi: 'Chào mừng bạn đến công ty chúng tôi.', answer_zh: '欢迎来到我们公司。', words: ['欢迎', '来到', '我们', '公司'] },
  { question_vi: 'Tôi muốn ăn cơm Trung Quốc.', answer_zh: '我想吃中国菜。', words: ['我', '想', '吃', '中国菜'] },
  { question_vi: 'Bây giờ là mấy giờ rồi?', answer_zh: '现在几点了？', words: ['现在', '几点', '了'] },
  { question_vi: 'Thời tiết hôm nay rất đẹp.', answer_zh: '今天天气很好。', words: ['今天', '天气', '很', '好'] },
  { question_vi: 'Ngày mai bạn có rảnh không?', answer_zh: '明天你有空吗？', words: ['明天', '你', '有空', '吗'] },
  { question_vi: 'Anh ấy là bạn tốt của tôi.', answer_zh: '他是我的好朋友。', words: ['他', '是', '我的', '好朋友'] },
  { question_vi: 'Cuốn sách này rất thú vị.', answer_zh: '这本书很有意思。', words: ['这本书', '很', '有意思'] },
  { question_vi: 'Tôi muốn đi du lịch Bắc Kinh.', answer_zh: '我想去北京旅游。', words: ['我', '想', '去北京', '旅游'] },
  { question_vi: 'Xin hỏi trạm xe buýt ở đâu?', answer_zh: '请问公共汽车站在哪儿？', words: ['请问', '公共汽车站', '在哪儿'] },
  { question_vi: 'Bạn học tiếng Trung bao lâu rồi?', answer_zh: '你学汉语多长时间了？', words: ['你', '学汉语', '多长时间', '了'] },
  { question_vi: 'Hãy chú ý an toàn khi làm việc.', answer_zh: '工作时请注意安全。', words: ['工作时', '请', '注意', '安全'] },
  { question_vi: 'Chất lượng sản phẩm này rất tốt.', answer_zh: '这个产品质量很好。', words: ['这个', '产品', '质量', '很', '好'] },
  { question_vi: 'Tôi có thể giúp gì cho bạn không?', answer_zh: '我能帮你什么吗？', words: ['我', '能', '帮', '你', '什么', '吗'] }
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
  try {
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
  } catch (_) {}
}
export const cleanupBattle = clearBattleSession;

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
      .limit(200);

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
 * Sinh bộ câu hỏi thi đấu linh hoạt theo số lượng (mặc định 10 câu) gồm cả 4 dạng câu hỏi
 */
function generateBattleQuestions(vocabList, sentenceList, totalCount = 10) {
  const count = Math.max(5, Math.min(30, Number(totalCount) || 10));
  const questions = [];

  let vPool = shuffle(vocabList);
  let sPool = shuffle(sentenceList);
  let vIndex = 0;
  let sIndex = 0;

  function getVocabWord() {
    if (vIndex >= vPool.length) {
      vPool = shuffle(vocabList);
      vIndex = 0;
    }
    return vPool[vIndex++];
  }

  function getSentence() {
    if (sIndex >= sPool.length) {
      sPool = shuffle(sentenceList);
      sIndex = 0;
    }
    return sPool[sIndex++];
  }

  // Luân phiên đa dạng các dạng câu hỏi
  const typePattern = ['choice', 'order', 'match', 'choice_meaning', 'order', 'choice', 'match', 'choice_meaning'];

  for (let i = 0; i < count; i++) {
    const isFinal = i === count - 1;
    const qType = typePattern[i % typePattern.length];

    if (qType === 'choice') {
      const target = getVocabWord();
      const distractors = [];
      const usedVocabs = new Set([target.vocab]);
      for (const w of shuffle(vocabList)) {
        if (!usedVocabs.has(w.vocab) && w.vietnamese_meaning !== target.vietnamese_meaning) {
          usedVocabs.add(w.vocab);
          distractors.push(w);
          if (distractors.length >= 3) break;
        }
      }
      questions.push({
        id: i + 1,
        type: 'choice',
        typeName: isFinal ? 'Chọn từ đúng (Hiệp quyết định 🔥)' : 'Chọn từ đúng',
        prompt: `Chọn chữ Hán có nghĩa là: "${target.vietnamese_meaning}"`,
        speakText: target.vocab,
        targetMeaning: target.vietnamese_meaning,
        correctAnswer: target.vocab,
        options: shuffle([
          { hanzi: target.vocab, pinyin: target.pinyin },
          ...distractors.map((d) => ({ hanzi: d.vocab, pinyin: d.pinyin }))
        ])
      });
    } else if (qType === 'choice_meaning') {
      const target = getVocabWord();
      const distractors = [];
      const usedMeanings = new Set([target.vietnamese_meaning]);
      for (const w of shuffle(vocabList)) {
        if (!usedMeanings.has(w.vietnamese_meaning) && w.vocab !== target.vocab) {
          usedMeanings.add(w.vietnamese_meaning);
          distractors.push(w);
          if (distractors.length >= 3) break;
        }
      }
      questions.push({
        id: i + 1,
        type: 'choice_meaning',
        typeName: isFinal ? 'Chọn nghĩa đúng (Hiệp quyết định 🔥)' : 'Chọn nghĩa đúng',
        prompt: `Nghĩa tiếng Việt của chữ Hán: "${target.vocab}"`,
        speakText: target.vocab,
        pinyinPrompt: target.pinyin,
        correctAnswer: target.vietnamese_meaning,
        options: shuffle([
          target.vietnamese_meaning,
          ...distractors.map((d) => d.vietnamese_meaning)
        ])
      });
    } else if (qType === 'order') {
      const s = getSentence();
      questions.push({
        id: i + 1,
        type: 'order',
        typeName: isFinal ? 'Sắp xếp câu (Hiệp quyết định 🔥)' : 'Sắp xếp câu',
        prompt: `Sắp xếp các từ tiếng Trung khớp với nghĩa: "${s.question_vi}"`,
        correctAnswer: s.answer_zh,
        words: shuffle([...s.words])
      });
    } else if (qType === 'match') {
      const selectedPairs = [];
      const usedHanzi = new Set();
      for (let pIdx = 0; pIdx < vocabList.length * 2 && selectedPairs.length < 4; pIdx++) {
        const candidate = getVocabWord();
        if (!usedHanzi.has(candidate.vocab)) {
          usedHanzi.add(candidate.vocab);
          selectedPairs.push({
            hanzi: candidate.vocab,
            pinyin: candidate.pinyin,
            meaning: candidate.vietnamese_meaning
          });
        }
      }
      questions.push({
        id: i + 1,
        type: 'match',
        typeName: isFinal ? 'Nối cặp từ vựng (Hiệp quyết định 🔥)' : 'Nối cặp từ vựng',
        prompt: isFinal
          ? 'Nối các cặp từ vựng để ghi điểm quyết định chiến thắng!'
          : 'Nối nhanh các cặp chữ Hán và nghĩa tiếng Việt tương ứng',
        pairs: selectedPairs
      });
    }
  }

  return questions;
}

/**
 * Khởi tạo giao diện và tiến trình Thi đấu 1v1
 */
export async function initBattle({ selector = '[data-battle]', toast } = {}) {
  const container = document.querySelector(selector);
  if (!container) return;

  clearBattleSession();

  let selectedQuestionCount = Number(localStorage.getItem('mandarinly_battle_qcount')) || 10;
  if (![6, 10, 15, 20].includes(selectedQuestionCount)) {
    selectedQuestionCount = 10;
  }

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
          <p>Thách thức người học khác trong trận đấu kịch tính: Sắp xếp câu, Chọn từ đúng và Nối cặp từ vựng. Cập nhật tỉ số tức thời!</p>
        </div>

        <div class="battle-settings-strip">
          <span class="settings-label">🎯 Số lượng câu hỏi mỗi trận:</span>
          <div class="battle-qcount-options" id="battleQCountOptions">
            <button type="button" class="qcount-btn ${selectedQuestionCount === 6 ? 'active' : ''}" data-count="6">6 câu (Nhanh)</button>
            <button type="button" class="qcount-btn ${selectedQuestionCount === 10 ? 'active' : ''}" data-count="10">10 câu (Tiêu chuẩn)</button>
            <button type="button" class="qcount-btn ${selectedQuestionCount === 15 ? 'active' : ''}" data-count="15">15 câu (Đầy đủ)</button>
            <button type="button" class="qcount-btn ${selectedQuestionCount === 20 ? 'active' : ''}" data-count="20">20 câu (Thử thách)</button>
          </div>
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
            <strong>🎯 4 Dạng câu hỏi</strong>
            <span>Chọn chữ Hán · Chọn nghĩa Việt · Sắp xếp câu · Nối cặp từ</span>
          </div>
          <div class="rule-col">
            <strong>🏆 Thưởng xếp hạng</strong>
            <span>Chiến thắng được cộng điểm thưởng lớn vào BXH Tuần của Supabase</span>
          </div>
        </div>
      </div>
    `;

    // Bind Question Count Selector
    container.querySelectorAll('.qcount-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        container.querySelectorAll('.qcount-btn').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        selectedQuestionCount = Number(btn.dataset.count) || 10;
        localStorage.setItem('mandarinly_battle_qcount', String(selectedQuestionCount));
        if (toast) toast(`Đã chọn chế độ thi đấu ${selectedQuestionCount} câu hỏi!`);
      });
    });

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
        <h2>Đang tìm kiếm đối thủ (${selectedQuestionCount} câu)...</h2>
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

    clearBattleSession();

    const waitInterval = setInterval(() => {
      waitSeconds++;
      if (timerEl) timerEl.textContent = `Thời gian chờ: ${waitSeconds}s`;
      if (waitSeconds >= 7 && switchToBotBtn) {
        switchToBotBtn.style.display = 'inline-block';
      }
    }, 1000);
    activeInterval = waitInterval;

    container.querySelector('#btnCancelMatch').addEventListener('click', () => {
      clearBattleSession();
      renderLobby();
    });

    switchToBotBtn.addEventListener('click', () => {
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
            const questions = generateBattleQuestions(vocabList, sentenceList, selectedQuestionCount);

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
        <h2>Mã phòng: <strong class="battle-room-code" style="color:#28543b;letter-spacing:2px;">${code}</strong></h2>
        <p>Hãy gửi mã phòng này cho bạn bè để cùng tham gia thi đấu (${selectedQuestionCount} câu)!</p>
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
          const questions = generateBattleQuestions(vocabList, sentenceList, selectedQuestionCount);

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
    const questions = generateBattleQuestions(vocabList, sentenceList, selectedQuestionCount);

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
              <span class="duel-round-label" id="duelRoundLabel">Câu 1/${questions.length}</span>
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
            const correctBtn = Array.from(card.querySelectorAll('.battle-choice-btn')).find(
              (b) => b.dataset.answer === q.correctAnswer
            );
            if (correctBtn) correctBtn.classList.add('correct');
            if (q.correctAnswer) {
              recordMistakeWord({
                hanzi: q.correctAnswer,
                meaning: q.targetMeaning || String(q.prompt || '').replace(/^Chọn chữ Hán có nghĩa là:\s*"|"$|\?/gi, '').trim(),
                source: 'Đấu trường 1v1'
              });
            }
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
            const correctBtn = Array.from(card.querySelectorAll('.battle-choice-btn')).find(
              (b) => b.dataset.answer === q.correctAnswer
            );
            if (correctBtn) correctBtn.classList.add('correct');
            if (q.speakText) {
              recordMistakeWord({
                hanzi: q.speakText,
                pinyin: q.pinyinPrompt || '',
                meaning: q.correctAnswer,
                source: 'Đấu trường 1v1'
              });
            }
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
          <span class="slot-placeholder">Chạm các từ bên dưới để ghép câu (chạm lại từ đã ghép để bỏ)...</span>
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
          slot.innerHTML = '<span class="slot-placeholder">Chạm các từ bên dưới để ghép câu (chạm lại từ đã ghép để bỏ)...</span>';
          return;
        }
        slot.innerHTML = selectedTokens
          .map(
            (t, idx) => `
          <button type="button" class="battle-word-token in-slot" data-slot-idx="${idx}" title="Chạm để gỡ từ này">
            <span class="game-pinyin">${escapeHtml(toPinyin(t.text))}</span>
            <strong>${escapeHtml(t.text)}</strong>
          </button>
        `
          )
          .join('');
      }

      slot.addEventListener('click', (e) => {
        if (myAnswered) return;
        const slotBtn = e.target.closest('[data-slot-idx]');
        if (!slotBtn) return;
        const idx = Number(slotBtn.dataset.slotIdx);
        const removed = selectedTokens.splice(idx, 1)[0];
        if (removed) {
          sounds.playTick();
          const bankBtn = bank.querySelector(`[data-token-id="${removed.id}"]`);
          if (bankBtn) bankBtn.classList.remove('used');
          updateSlot();
        }
      });

      bank.querySelectorAll('.battle-word-token').forEach((btn) => {
        btn.addEventListener('click', () => {
          if (myAnswered || btn.classList.contains('used')) return;
          sounds.playTick();
          speakChinese(btn.dataset.tokenText);
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

        const hEl = selectedHanzi;
        const mEl = selectedMeaning;
        const hVal = hEl.dataset.hanzi;
        const mTarget = mEl.dataset.forHanzi;

        selectedHanzi = null;
        selectedMeaning = null;

        if (hVal === mTarget) {
          sounds.playCorrect();
          speakChinese(hVal);
          hEl.classList.add('matched');
          mEl.classList.add('matched');
          matchedCount++;

          if (matchedCount === q.pairs.length) {
            const speedBonus = Math.round((roundTimeLeft / 20) * 50);
            handleAnswer(true, 100 + speedBonus);
          }
        } else {
          sounds.playWrong();
          hEl.classList.add('shake');
          mEl.classList.add('shake');
          const pairObj = (q.pairs || []).find((p) => p.hanzi === hVal);
          if (pairObj) {
            recordMistakeWord({
              hanzi: pairObj.hanzi,
              pinyin: pairObj.pinyin || '',
              meaning: pairObj.meaning,
              source: 'Đấu trường 1v1'
            });
          }
          setTimeout(() => {
            hEl.classList.remove('shake', 'selected');
            mEl.classList.remove('shake', 'selected');
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
    async function finishMatch() {
      if (matchFinished) return;
      matchFinished = true;
      clearBattleSession();

      const isWin = myScore > opponentScore;
      const isTie = myScore === opponentScore;

      if (isWin) sounds.playVictory(); else if (isTie) sounds.playCorrect(); else sounds.playWrong();

      // Points earned for Leaderboard (scales with question count)
      const baseWinPts = Math.min(100, Math.max(50, Math.round(questions.length * 6)));
      const rewardPoints = isWin ? baseWinPts : isTie ? Math.round(baseWinPts * 0.5) : Math.max(15, Math.round(baseWinPts * 0.3));
      recordScore({
        category: 'game',
        points: rewardPoints,
        description: `Đấu trường 1v1 - ${questions.length} câu (${isWin ? 'Chiến thắng' : isTie ? 'Hòa' : 'Tham gia'})`
      });

      let battleFood = null;
      try {
        const foodType = isWin ? (Math.random() < 0.6 ? 'baozi' : 'watermelon') : (Math.random() < 0.5 ? 'orange' : 'apple');
        battleFood = await awardFoodReward({ foodId: foodType, source: 'Đấu trường 1v1' });
      } catch (_) {}

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

            ${battleFood ? `
              <div class="duel-food-badge">
                <span class="duel-food-icon">${battleFood.icon}</span>
                <div class="duel-food-info">
                  <strong>+${battleFood.count} ${battleFood.name} (${battleFood.zh})</strong>
                  <small>Phần thưởng thi đấu gửi vào túi đồ ăn LuLu 🍊</small>
                </div>
              </div>
            ` : ''}

            <div class="battle-actions-row">
              <button type="button" class="battle-btn-primary" id="btnBattleAgain">Tìm trận mới</button>
              <a class="battle-btn-secondary" href="#lulu">Đến nuôi LuLu 🍊</a>
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
