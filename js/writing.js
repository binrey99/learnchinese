import { supabase } from './supabase.js';
import { normalizeLevel, sortLevels } from './levels.js';
import { pinyin } from 'https://esm.sh/pinyin-pro@3.27.0';
import { recordScore, SCORE_RULES } from './score-service.js';
import { awardLuluExp, loadPetData } from './lulu.js';

export const PAGE_SIZE = 20;

// Các cấp độ chuẩn đồng bộ với mục Từ Vựng
export const writingCategories = ['HSK 1', 'HSK 2', 'HSK 3', 'HSK 4', 'HSK 5', 'HSK 6', 'Công xưởng'];

// Từ điển Hán - Việt tra cứu nhanh cho các chữ Hán thường gặp
const SINO_VIETNAMESE_MAP = {
  '你': 'Nhĩ / Nễ', '好': 'Hảo', '学': 'Học', '习': 'Tập', '谢': 'Tạ', '再': 'Tái', '见': 'Kiến',
  '老': 'Lão', '师': 'Sư', '朋': 'Bằng', '友': 'Hữu', '高': 'Cao', '兴': 'Hưng', '喝': 'Hống / Hát',
  '水': 'Thủy', '中': 'Trung', '国': 'Quốc', '苹': 'Bình', '果': 'Quả', '吃': 'Cật', '饭': 'Phạn',
  '看': 'Khán', '书': 'Thư', '喜': 'Hỷ', '欢': 'Hoan', '多': 'Đa', '少': 'Thiểu / Thiếu', '医': 'Y',
  '生': 'Sinh', '名': 'Danh', '字': 'Tự', '校': 'Hiệu', '说': 'Thuyết', '话': 'Thoại', '睡': 'Thụy',
  '觉': 'Giác', '听': 'Thính', '家': 'Gia', '人': 'Nhân', '买': 'Mãi', '爱': 'Ái', '打': 'Đả',
  '电': 'Điện', '想': 'Tưởng', '做': 'Tác', '去': 'Khứ', '来': 'Lai', '回': 'Hồi', '坐': 'Tọa',
  '努': 'Nỗ', '力': 'Lực', '帮': 'Bang', '助': 'Trợ', '准': 'Chuẩn', '备': 'Bị', '希': 'Hy',
  '望': 'Vọng', '运': 'Vận', '动': 'Động', '旅': 'Lữ', '游': 'Du', '时': 'Thời', '间': 'Gian',
  '身': 'Thân', '体': 'Thể', '介': 'Giới', '绍': 'Thiệu', '便': 'Tiện', '宜': 'Nghi', '欢': 'Hoan',
  '迎': 'Nghênh', '事': 'Sự', '情': 'Tình', '跑': 'Bào', '步': 'Bộ', '唱': 'Xướng', '歌': 'Ca',
  '晴': 'Tình', '天': 'Thiên', '快': 'Khoái', '乐': 'Lạc', '考': 'Khảo', '试': 'Thí', '懂': 'Đổng',
  '铅': 'Duyên', '笔': 'Bút', '报': 'Báo', '纸': 'Chỉ', '公': 'Công', '司': 'Ty', '开': 'Khai',
  '始': 'Thủy', '已': 'Dĩ', '经': 'Kinh', '穿': 'Xuyên', '送': 'Tống', '让': 'Nhượng',
  '提': 'Đề', '环': 'Hoàn', '境': 'Cảnh', '清': 'Thanh', '楚': 'Sở', '简': 'Giản', '单': 'Đơn',
  '参': 'Tham', '加': 'Gia', '热': 'Nhiệt', '解': 'Giải', '决': 'Quyết', '满': 'Mãn', '意': 'Ý',
  '照': 'Chiếu', '顾': 'Cố', '检': 'Kiểm', '查': 'Tra', '习': 'Tập', '惯': 'Quán', '银': 'Ngân',
  '行': 'Hàng / Hành', '练': 'Luyện', '遇': 'Ngộ', '相': 'Tương', '信': 'Tín', '刚': 'Cương',
  '才': 'Tài', '影': 'Ảnh', '响': 'Hưởng', '变': 'Biến', '化': 'Hóa', '发': 'Phát', '现': 'Hiện',
  '定': 'Định', '难': 'Nan', '容': 'Dung', '易': 'Dịch', '办': 'Biện', '法': 'Pháp',
  '普': 'Phổ', '遍': 'Biến', '拒': 'Cự', '绝': 'Tuyệt', '验': 'Nghiệm', '适': 'Thích', '合': 'Hợp',
  '坚': 'Kiên', '持': 'Trì', '应': 'Ứng', '复': 'Phức', '杂': 'Tạp', '困': 'Khốn', '顺': 'Thuận',
  '利': 'Lợi', '勇': 'Dũng', '敢': 'Cảm', '负': 'Phụ', '责': 'Trách', '诚': 'Thành', '实': 'Thật',
  '甚': 'Thậm', '至': 'Chí', '积': 'Tích', '极': 'Cực', '精': 'Tinh', '彩': 'Thải', '流': 'Lưu',
  '行': 'Hành', '礼': 'Lễ', '貌': 'Mạo', '安': 'An', '排': 'Bài', '释': 'Thích', '丰': 'Phong',
  '富': 'Phú', '成': 'Thành', '功': 'Công', '失': 'Thất', '败': 'Bại', '态': 'Thái', '度': 'Độ',
  '启': 'Khải', '独': 'Độc', '立': 'Lập', '把': 'Bả', '握': 'Ác', '彼': 'Bỉ', '此': 'Thử',
  '抽': 'Trừu', '象': 'Tượng', '逻': 'La', '辑': 'Tập', '具': 'Cụ', '趋': 'Xu', '势': 'Thế',
  '珍': 'Trân', '惜': 'Tích', '谦': 'Khiêm', '虚': 'Hư', '彻': 'Triệt', '底': 'Để', '深': 'Thâm',
  '刻': 'Khắc', '佩': 'Bội', '服': 'Phục', '繁': 'Phồn', '荣': 'Vinh', '谨': 'Cẩn', '慎': 'Thận',
  '掌': 'Chưởng', '协': 'Hiệp', '调': 'Điệu', '贡': 'Cống', '献': 'Hiến', '奋': 'Phấn', '斗': 'Đấu',
  '辩': 'Biện', '论': 'Luận', '创': 'Sáng', '造': 'Tạo', '保': 'Bảo', '证': 'Chứng',
  '可': 'Khả', '续': 'Tục', '贯': 'Quán', '捍': 'Hãn', '卫': 'Vệ', '琢': 'Trác', '磨': 'Ma',
  '瞻': 'Chiêm', '蜕': 'Thuế', '浩': 'Hạo', '瀚': 'Hãn', '融': 'Dung', '洽': 'Hiệp', '严': 'Nghiêm',
  '谨': 'Cẩn', '陶': 'Đào', '冶': 'Dã', '领': 'Lãnh', '悟': 'Ngộ', '渊': 'Uyên', '博': 'Bác',
  '阐': 'Xiển', '述': 'Thuật', '凝': 'Ngưng', '聚': 'Tụ', '迪': 'Địch', '砥': 'Chỉ', '砺': 'Lệ',
  '卓': 'Trác', '越': 'Việt', '蓬': 'Bồng', '勃': 'Bột', '统': 'Thống', '筹': 'Trù', '睿': 'Duệ',
  '智': 'Trí', '宏': 'Hoành', '伟': 'Vĩ', '辉': 'Huy', '煌': 'Hoàng', '践': 'Tiễn',
  '车': 'Xa', '帽': 'Mạo', '产': 'Sản', '线': 'Tuyến', '质': 'Chất', '量': 'Lượng', '上': 'Thượng',
  '下': 'Hạ', '班': 'Ban', '机': 'Cơ', '器': 'Khí', '维': 'Duy', '修': 'Tu', '螺': 'Loa',
  '丝': 'Ty', '工': 'Công', '零': 'Linh', '件': 'Kiện', '操': 'Thao', '作': 'Tác', '搬': 'Bàn',
  '运': 'Vận', '仓': 'Thương', '储': 'Trữ', '包': 'Bao', '装': 'Trang', '验': 'Nghiệm', '收': 'Thu',
  '模': 'Mô', '具': 'Cụ', '电': 'Điện', '焊': 'Hãn', '长': 'Trưởng', '管': 'Quản', '理': 'Lý',
  '八': 'Bát', '爸': 'Ba', '杯': 'Bôi', '北': 'Bắc', '京': 'Kinh', '本': 'Bản', '不': 'Bất',
  '客': 'Khách', '气': 'Khí', '菜': 'Thái', '茶': 'Trà', '点': 'Điểm', '脑': 'Não', '视': 'Thị',
  '影': 'Ảnh', '东': 'Đông', '西': 'Tây', '读': 'Độc', '对': 'Đối', '起': 'Khởi', '儿': 'Nhi'
};

// Dữ liệu mẫu dự phòng khi offline
export const fallbackVocabulary = [
  { id: 'fb-1', hanzi: '你好', pinyin: 'nǐ hǎo', english: 'hello', meaning: 'xin chào', level: 'HSK 1', wordType: 'Chào hỏi', example: '你好！很高兴认识你。' },
  { id: 'fb-2', hanzi: '学习', pinyin: 'xué xí', english: 'study', meaning: 'học tập', level: 'HSK 1', wordType: 'Động từ', example: '我们一起学习汉语。' },
  { id: 'fb-3', hanzi: '努力', pinyin: 'nǔ lì', english: 'strive', meaning: 'nỗ lực', level: 'HSK 2', wordType: 'Tính từ', example: '只要努力，就会成功。' },
  { id: 'fb-4', hanzi: '提高', pinyin: 'tí gāo', english: 'improve', meaning: 'nâng cao', level: 'HSK 3', wordType: 'Động từ', example: '提高汉语水平。' },
  { id: 'fb-5', hanzi: '环境', pinyin: 'huán jìng', english: 'environment', meaning: 'môi trường', level: 'HSK 4', wordType: 'Danh từ', example: '保护自然环境。' },
  { id: 'fb-6', hanzi: '解决', pinyin: 'jiě jué', english: 'solve', meaning: 'giải quyết', level: 'HSK 5', wordType: 'Động từ', example: '解决复杂问题。' },
  { id: 'fb-7', hanzi: '可持续', pinyin: 'kě chí xù', english: 'sustainable', meaning: 'bền vững', level: 'HSK 6', wordType: 'Tính từ', example: '可持续发展。' },
  { id: 'fb-8', hanzi: '上班', pinyin: 'shàng bān', english: 'go to work', meaning: 'đi làm, vào ca', level: 'Công xưởng', wordType: 'Động từ', example: '明天早上八点上班。' },
  { id: 'fb-9', hanzi: '车间', pinyin: 'chē jiān', english: 'workshop', meaning: 'phân xưởng', level: 'Công xưởng', wordType: 'Danh từ', example: '车间里很干净。' },
  { id: 'fb-10', hanzi: '安全帽', pinyin: 'ān quán mào', english: 'safety helmet', meaning: 'mũ bảo hộ', level: 'Công xưởng', wordType: 'Danh từ', example: '进车间必须戴安全帽。' },
  { id: 'fb-11', hanzi: '生产线', pinyin: 'shēng chǎn xiàn', english: 'production line', meaning: 'dây chuyền sản xuất', level: 'Công xưởng', wordType: 'Danh từ', example: '生产线运转正常。' },
  { id: 'fb-12', hanzi: '质量检查', pinyin: 'zhì liàng jiǎn chá', english: 'quality check', meaning: 'kiểm tra chất lượng', level: 'Công xưởng', wordType: 'Thuật ngữ', example: '严格进行质量检查。' }
];

function escapeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function toPinyin(hanzi) {
  try {
    return pinyin(hanzi, { toneType: 'symbol' });
  } catch (_) {
    return hanzi;
  }
}

function getSinoVietnamese(char) {
  return SINO_VIETNAMESE_MAP[char] || '';
}

const LOCAL_WRITTEN_KEY = 'mandarinly_written_words_progress';

function loadLocalWrittenProgress() {
  try {
    const raw = localStorage.getItem(LOCAL_WRITTEN_KEY);
    if (!raw) return new Map();
    const arr = JSON.parse(raw);
    const map = new Map();
    arr.forEach((item) => {
      map.set(`${item.word}:${item.character}`, item);
      map.set(item.character, item);
      map.set(item.word, item);
    });
    return map;
  } catch (_) {
    return new Map();
  }
}

function saveLocalWrittenProgress(progressMap) {
  try {
    const items = [];
    const seen = new Set();
    progressMap.forEach((val) => {
      if (val && val.character && !seen.has(`${val.word}:${val.character}`)) {
        seen.add(`${val.word}:${val.character}`);
        items.push(val);
      }
    });
    localStorage.setItem(LOCAL_WRITTEN_KEY, JSON.stringify(items));
  } catch (_) {}
}

/**
 * Tải danh sách từ đã thuộc từ bảng vocabulary_mastery
 */
async function loadMasteredVocabulary(userId) {
  if (!userId) return new Set();
  try {
    const { data, error } = await supabase
      .from('vocabulary_mastery')
      .select('vocabulary_id')
      .eq('user_id', userId);
    if (error) throw error;
    return new Set(data.map((item) => String(item.vocabulary_id)));
  } catch (err) {
    console.warn('Không thể tải vocabulary_mastery:', err.message);
    return new Set();
  }
}

/**
 * Tải dữ liệu tiến độ từ đã viết cho tài khoản từ Supabase (bảng user_writing_progress)
 */
async function loadWritingProgressFromSupabase(userId) {
  const localMap = loadLocalWrittenProgress();
  if (!userId) return localMap;

  try {
    const { data, error } = await supabase
      .from('user_writing_progress')
      .select('word, character, level, times_written, last_written_at')
      .eq('user_id', userId);

    if (error) {
      console.warn('[Supabase user_writing_progress]:', error.message);
      return localMap;
    }

    if (data && data.length > 0) {
      data.forEach((row) => {
        localMap.set(`${row.word}:${row.character}`, row);
        localMap.set(row.character, row);
        localMap.set(row.word, row);
      });
      saveLocalWrittenProgress(localMap);
    }
  } catch (err) {
    console.warn('Lỗi kết nối user_writing_progress:', err);
  }

  return localMap;
}

/**
 * Lưu tiến độ từ đã viết lên Supabase và cấp điểm EXP cho LuLu
 */
async function recordWrittenWordToSupabase({ user, word, character, level, mode = 'quiz', strokeCount = 0 }) {
  const localMap = loadLocalWrittenProgress();
  const key = `${word.hanzi}:${character}`;
  const existing = localMap.get(key);
  const times = (existing?.times_written || 0) + 1;

  const record = {
    word: word.hanzi,
    character,
    level: level || word.level || 'HSK 1',
    stroke_count: strokeCount,
    mode,
    times_written: times,
    last_written_at: new Date().toISOString()
  };

  localMap.set(key, record);
  localMap.set(character, record);
  localMap.set(word.hanzi, record);
  saveLocalWrittenProgress(localMap);

  if (!user?.id) return record;

  try {
    const payload = {
      user_id: user.id,
      vocabulary_id: word.id ? Number(word.id) : null,
      word: word.hanzi,
      character,
      level: level || word.level || 'HSK 1',
      stroke_count: strokeCount,
      mode,
      times_written: times,
      last_written_at: new Date().toISOString()
    };

    const { error } = await supabase
      .from('user_writing_progress')
      .upsert(payload, { onConflict: 'user_id,word,character' });

    if (error) {
      console.warn('Supabase user_writing_progress insert/upsert error:', error.message);
    }
  } catch (err) {
    console.warn('Exception recording written word to Supabase:', err);
  }

  return record;
}

/**
 * Tải dữ liệu từ vựng trực tiếp từ Supabase (bảng vocabulary), phân trang 20 từ như phần từ vựng
 */
async function fetchVocabularyPage(category, page = 1) {
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  let query = supabase
    .from('vocabulary')
    .select('id, book_level, vocab, english_meaning, vietnamese_meaning, word_type, Example', { count: 'exact' });

  const noSpace = category.replace(/\s+/g, '');
  if (noSpace !== category) {
    query = query.or(`book_level.eq.${category},book_level.eq.${noSpace}`);
  } else {
    query = query.eq('book_level', category);
  }

  const { data, count, error } = await query
    .order('id', { ascending: true })
    .range(from, to);

  if (error) throw error;

  const rows = (data || []).map((word) => ({
    id: word.id,
    hanzi: word.vocab,
    pinyin: toPinyin(word.vocab),
    english: word.english_meaning || '',
    meaning: word.vietnamese_meaning,
    level: normalizeLevel(word.book_level),
    wordType: word.word_type,
    example: word.Example || word.example || word.component || ''
  }));

  return {
    words: rows,
    total: count !== null && count !== undefined ? count : rows.length
  };
}

/**
 * Fallback dữ liệu mẫu khi offline hoặc cấp độ chưa có trong Supabase
 */
function getFallbackVocabularyPage(category, page = 1) {
  const filtered = fallbackVocabulary.filter((word) => normalizeLevel(word.level) === normalizeLevel(category));
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE;
  return {
    words: filtered.slice(from, to),
    total: filtered.length
  };
}

/**
 * Tạo danh sách các số trang hiển thị thân thiện
 */
function getPaginationPages(current, total) {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  if (current <= 4) return [1, 2, 3, 4, 5, '...', total];
  if (current >= total - 3) return [1, '...', total - 4, total - 3, total - 2, total - 1, total];
  return [1, '...', current - 1, current, current + 1, '...', total];
}

/**
 * Render thanh phân trang chuẩn giống Từ Vựng
 */
function renderPaginationHtml(page, totalPages, totalWords) {
  if (totalWords <= 0) return '';
  if (totalPages <= 1) {
    return `
      <div class="vocabulary-pagination" role="navigation" aria-label="Phân trang từ vựng">
        <div class="vocabulary-pagination-info">
          Hiển thị <strong>${totalWords}</strong> từ từ Supabase
        </div>
      </div>
    `;
  }

  const startWord = (page - 1) * PAGE_SIZE + 1;
  const endWord = Math.min(page * PAGE_SIZE, totalWords);
  const pages = getPaginationPages(page, totalPages);

  const pagesHtml = pages.map((p) => {
    if (p === '...') {
      return '<span class="vocab-page-ellipsis">…</span>';
    }
    const isActive = p === page;
    return `<button type="button" class="vocab-page-btn${isActive ? ' active' : ''}" data-page="${p}" ${isActive ? 'aria-current="page" disabled' : ''}>${p}</button>`;
  }).join('');

  return `
    <div class="vocabulary-pagination" role="navigation" aria-label="Phân trang từ vựng">
      <div class="vocabulary-pagination-info">
        Hiển thị <strong>${startWord}–${endWord}</strong> trong tổng số <strong>${totalWords}</strong> từ (Supabase)
      </div>
      <div class="vocabulary-pagination-controls">
        <button type="button" class="vocab-page-btn vocab-page-nav" data-page="first" ${page <= 1 ? 'disabled' : ''} aria-label="Trang đầu" title="Trang đầu">«</button>
        <button type="button" class="vocab-page-btn vocab-page-nav" data-page="prev" ${page <= 1 ? 'disabled' : ''} aria-label="Trang trước" title="Trang trước">‹ Trước</button>
        <div class="vocab-page-numbers">
          ${pagesHtml}
        </div>
        <button type="button" class="vocab-page-btn vocab-page-nav" data-page="next" ${page >= totalPages ? 'disabled' : ''} aria-label="Trang sau" title="Trang sau">Sau ›</button>
        <button type="button" class="vocab-page-btn vocab-page-nav" data-page="last" ${page >= totalPages ? 'disabled' : ''} aria-label="Trang cuối" title="Trang cuối">»</button>
      </div>
    </div>
  `;
}

export async function initWriting({ selector = '[data-writing]', toast } = {}) {
  const container = document.querySelector(selector);
  if (!container) return;

  const availableCategories = sortLevels(writingCategories);
  let currentCategory = availableCategories[0] || 'HSK 1';
  let currentPage = 1;
  let totalWords = 0;
  let totalPages = 1;
  let currentWords = [];
  let currentWordIndex = 0;
  let currentWord = null;
  let currentChar = '你';
  let currentMode = 'quiz';
  let strokeSpeed = 1;
  let currentWriter = null;
  let freehandCanvas = null;
  let freehandCtx = null;
  let brushColor = '#1e293b';
  let brushWidth = 8;
  let strokeCount = 0;
  let user = null;
  let masteredVocabularyIds = new Set();
  let writtenProgressMap = new Map();
  const pageCache = new Map();
  let activeRequestId = 0;
  let showOutlineState = true;

  try {
    const { data: { user: loggedInUser } } = await supabase.auth.getUser();
    user = loggedInUser;
    if (user?.id) {
      masteredVocabularyIds = await loadMasteredVocabulary(user.id);
    }
  } catch (error) {
    console.warn('Lỗi lấy người dùng Supabase:', error.message);
  }

  // Tải tiến độ các từ đã viết từ Supabase
  writtenProgressMap = await loadWritingProgressFromSupabase(user?.id);

  // Lấy dữ liệu LuLu hiện tại
  let currentPet = loadPetData();

  // Khung giao diện chính: Tabs cấp độ + Studio Tập viết + Danh sách từ vựng Supabase
  container.innerHTML = `
    <div class="writing-page-container">
      <!-- Tabs cấp độ chuẩn: HSK 1 - HSK 6, Công xưởng -->
      <div class="vocabulary-tabs writing-tabs" role="tablist">
        ${availableCategories.map((category, index) => `
          <button type="button" class="vocabulary-tab${index === 0 ? ' active' : ''}" data-writing-category="${escapeHtml(category)}">${escapeHtml(category)}</button>
        `).join('')}
      </div>

      <!-- Studio Tập viết với ô 米字格 -->
      <section class="writing-studio-card" aria-label="Khu vực luyện viết">
        <header class="writing-header">
          <div class="writing-word-badge">
            <span class="writing-level-pill" data-level-pill>${escapeHtml(currentCategory)}</span>
            <div class="writing-word-info">
              <h2 class="writing-word-hanzi" data-word-hanzi>Đang tải dữ liệu...</h2>
              <span class="writing-word-pinyin" data-word-pinyin></span>
              <span class="writing-word-meaning" data-word-meaning></span>
            </div>
          </div>

          <div class="writing-header-actions">
            <!-- Nút đánh dấu từ đã viết thủ công hoặc sau khi viết đủ nét -->
            <button type="button" class="writing-mark-btn" data-action="toggle-written" title="Đánh dấu đã hoàn thành bài viết">
              <span class="mark-icon">✓</span> <span class="mark-text" data-mark-btn-text>Đánh dấu đã viết</span>
            </button>
            <button type="button" class="writing-btn writing-speak-btn" data-action="speak" title="Phát âm từ này">
              <span class="btn-icon">🔊</span> <span class="btn-text">Nghe đọc</span>
            </button>
            <button type="button" class="writing-btn" data-action="prev-word" title="Từ trước đó">‹ Từ trước</button>
            <button type="button" class="writing-btn" data-action="next-word" title="Từ tiếp theo">Từ sau ›</button>
            <button type="button" class="writing-btn" data-action="random-word" title="Chọn ngẫu nhiên">🎲 Đổi từ</button>
          </div>
        </header>

        <!-- Thanh chọn chữ đơn nếu từ ghép có nhiều chữ (VD: 爸爸, 学习, 生产线) -->
        <div class="writing-chars-bar" data-char-tabs-container>
          <span class="writing-chars-label">Chọn chữ để viết trong từ:</span>
          <div class="writing-chars-tabs" data-char-tabs></div>
        </div>

        <div class="writing-body-grid">
          <!-- Cột Trái: KHUNG 米字格 NHƯ HÌNH 1 -->
          <div class="writing-board-column">
            <!-- 3 Chế độ: Quiz, Animate, Canvas -->
            <div class="writing-mode-switcher" role="tablist">
              <button type="button" class="mode-tab active" data-mode="quiz">✍️ Tập viết theo nét (Quiz)</button>
              <button type="button" class="mode-tab" data-mode="animate">▶ Xem mẫu nét (Animation)</button>
              <button type="button" class="mode-tab" data-mode="canvas">🖌 Đồ chữ tự do (Canvas)</button>
            </div>

            <!-- Khung vẽ 米字格 chuẩn hình 1 -->
            <div class="mizige-outer-frame">
              <div class="mizige-box" id="mizigeBox">
                <!-- SVG lưới 米字格: viền xanh lá đặc, nét đứt ngang dọc chéo, watermark LULU CHINESE -->
                <svg class="mizige-grid-svg" viewBox="0 0 300 300" aria-hidden="true">
                  <!-- Viền ngoài vuông xanh lá (Solid Green) -->
                  <rect x="2" y="2" width="296" height="296" fill="#ffffff" stroke="#2e7d32" stroke-width="3" />
                  <!-- Đường tâm ngang và dọc nét đứt (Dashed Green Cross) -->
                  <line x1="150" y1="2" x2="150" y2="298" stroke="#2e7d32" stroke-width="1.8" stroke-dasharray="6,5" />
                  <line x1="2" y1="150" x2="298" y2="150" stroke="#2e7d32" stroke-width="1.8" stroke-dasharray="6,5" />
                  <!-- 2 đường chéo góc nét đứt (Dashed Green Diagonals) -->
                  <line x1="2" y1="2" x2="298" y2="298" stroke="#2e7d32" stroke-width="1.8" stroke-dasharray="6,5" />
                  <line x1="298" y1="2" x2="2" y2="298" stroke="#2e7d32" stroke-width="1.8" stroke-dasharray="6,5" />
                  <!-- Chữ mẫu mờ màu hồng (Fallback) -->
                  <text class="mizige-fallback-text" x="150" y="230" text-anchor="middle" font-size="192" fill="#fca5a5" font-family="'Noto Sans SC', 'Kaiti SC', 'SimSun', serif" font-weight="normal" style="display:none;" data-fallback-char></text>
                  <!-- Chữ watermark góc phải: LULU CHINESE -->
                  <text x="290" y="290" text-anchor="end" font-size="9.5" font-weight="700" fill="#28543b" opacity="0.85" font-family="'Noto Sans', sans-serif" letter-spacing="0.5">LULU CHINESE</text>
                </svg>

                <!-- HanziWriter mount target -->
                <div class="mizige-writer-target" id="hanziWriterTarget"></div>

                <!-- Canvas tự do -->
                <canvas class="mizige-freehand-canvas" id="freehandCanvas" width="300" height="300" hidden></canvas>
              </div>
            </div>

            <!-- Thanh trạng thái & hướng dẫn nét -->
            <div class="writing-status-bar" data-writing-status>
              <span class="status-icon">📝</span>
              <span class="status-msg" data-status-text>Hãy dùng chuột hoặc ngón tay viết từng nét vào ô 米字格 phía trên</span>
            </div>

            <!-- Công cụ điều khiển -->
            <div class="writing-tools-bar">
              <div class="tools-group group-quiz-animate" data-tools="quiz-animate">
                <button type="button" class="tool-btn" data-tool="restart" title="Viết lại từ đầu">↺ Viết lại</button>
                <button type="button" class="tool-btn highlight" data-tool="hint" title="Gợi ý nét tiếp theo">💡 Gợi ý nét</button>
                <button type="button" class="tool-btn" data-tool="replay-anim" title="Chạy lại nét viết">▶ Xem lại nét</button>
                <button type="button" class="tool-btn" data-tool="toggle-outline" title="Ẩn/Hiện chữ mẫu hồng">👁 Ẩn/Hiện mẫu</button>
              </div>

              <div class="tools-group group-canvas" data-tools="canvas" hidden>
                <div class="color-picker-wrap">
                  <span class="picker-label">Mực:</span>
                  <button type="button" class="color-dot active" data-color="#1e293b" style="background:#1e293b;" title="Mực đen"></button>
                  <button type="button" class="color-dot" data-color="#dc2626" style="background:#dc2626;" title="Mực đỏ"></button>
                  <button type="button" class="color-dot" data-color="#16a34a" style="background:#16a34a;" title="Mực xanh lá"></button>
                </div>
                <div class="stroke-width-wrap">
                  <span class="picker-label">Nét:</span>
                  <button type="button" class="size-btn" data-size="4">Mảnh</button>
                  <button type="button" class="size-btn active" data-size="8">Vừa</button>
                  <button type="button" class="size-btn" data-size="14">Đậm</button>
                </div>
                <button type="button" class="tool-btn" data-canvas-action="clear">🗑 Xóa sạch</button>
                <button type="button" class="tool-btn highlight" data-canvas-action="finish">✓ Đã viết xong</button>
              </div>
            </div>
          </div>

          <!-- Cột Phải: BẢNG CHI TIẾT TỪ VỰNG & THƯỞNG EXP LULU -->
          <aside class="writing-info-column">
            <!-- Widget LuLu EXP liên kết thời gian thực -->
            <div class="writing-lulu-widget" data-lulu-widget>
              <img class="writing-lulu-avatar" src="picture/eat.jpg" alt="Thú cưng LuLu">
              <div class="writing-lulu-info">
                <div class="writing-lulu-title-row">
                  <span class="writing-lulu-name">🍊 LuLu Lv.<span data-lulu-lvl>${currentPet.level || 1}</span></span>
                  <span class="writing-lulu-exp-text"><span data-lulu-exp>${currentPet.exp || 0}</span> / <span data-lulu-max-exp>${currentPet.maxExp || 100}</span> EXP</span>
                </div>
                <div class="writing-lulu-progress-bar">
                  <div class="writing-lulu-progress-fill" data-lulu-progress-fill style="width: ${Math.min(100, Math.round(((currentPet.exp || 0) / (currentPet.maxExp || 100)) * 100))}%;"></div>
                </div>
              </div>
            </div>

            <article class="char-detail-card">
              <div class="char-detail-header">
                <div class="char-big-preview" data-char-preview>你</div>
                <div class="char-meta-top">
                  <div class="char-pinyin-wrap">
                    <span class="char-label">Pinyin:</span>
                    <strong class="char-pinyin" data-char-pinyin>nǐ</strong>
                  </div>
                  <div class="char-sino-wrap">
                    <span class="char-label">Hán - Việt:</span>
                    <strong class="char-sino" data-char-sino>Nhĩ / Nễ</strong>
                  </div>
                </div>
              </div>

              <div class="char-detail-table">
                <div class="char-row">
                  <span class="cell-label">Nghĩa tiếng Việt:</span>
                  <strong class="cell-val" data-char-meaning>Đang tải...</strong>
                </div>
                <div class="char-row">
                  <span class="cell-label">Tổng số nét:</span>
                  <span class="cell-val" data-char-strokes>Đang tính...</span>
                </div>
                <div class="char-row">
                  <span class="cell-label">Từ vựng đầy đủ:</span>
                  <span class="cell-val" data-char-compound>-</span>
                </div>
                <div class="char-row" data-char-example-row>
                  <span class="cell-label">Câu ví dụ:</span>
                  <span class="cell-val" data-char-example>-</span>
                </div>
                <div class="char-row">
                  <span class="cell-label">Lịch sử viết:</span>
                  <span class="cell-val" data-char-written-count>Chưa viết</span>
                </div>
              </div>

              <div class="writing-reward-box">
                <div class="reward-icon">🎁</div>
                <div class="reward-text">
                  <strong>+25 EXP LuLu & Rơi Thức Ăn</strong>
                  <p>Mỗi khi hoàn thành đủ các nét hoặc đánh dấu chữ đã viết thành công!</p>
                </div>
                <span class="mastered-badge" data-char-mastered-badge hidden>Đã viết ✓</span>
              </div>
            </article>

            <div class="writing-rules-guide">
              <h3>💡 Quy tắc bút thuận cơ bản:</h3>
              <ul>
                <li><strong>Ngang trước sổ sau:</strong> 一 rồi tới 丨 (vd: 十)</li>
                <li><strong>Phẩy trước mác sau:</strong> 丿 rồi tới 乀 (vd: 八, 人)</li>
                <li><strong>Trên trước dưới sau:</strong> Viết phần trên rồi xuống dưới (vd: 二, 三)</li>
                <li><strong>Trái trước phải sau:</strong> Viết vế trái rồi vế phải (vd: 你, 他)</li>
                <li><strong>Ngoài trước trong sau, vào trước đóng sau:</strong> Bao quanh trước, viết ruột, rồi khóa đáy (vd: 国, 日)</li>
              </ul>
            </div>
          </aside>
        </div>
      </section>

      <!-- DANH SÁCH TỪ VỰNG SUPABASE THEO CẤP ĐỘ -->
      <section class="writing-word-browser" aria-label="Kho từ vựng Supabase">
        <div class="browser-header">
          <div>
            <h3 class="browser-title">Kho từ vựng Supabase · <span data-browser-level-name>${escapeHtml(currentCategory)}</span></h3>
            <p class="browser-subtitle">Bấm vào bất kỳ từ vựng nào để nạp chữ lên khung 米字格 và luyện viết</p>
          </div>
          <div class="vocabulary-pagination-info" data-browser-count-info>
            Đang tải dữ liệu từ Supabase...
          </div>
        </div>

        <div class="vocabulary-list-wrap">
          <div class="vocabulary-list" data-writing-vocab-list></div>
          <div class="vocabulary-loading-overlay" data-writing-overlay hidden>
            <span class="vocabulary-loading-spinner"></span> Đang tải từ vựng từ Supabase...
          </div>
        </div>

        <!-- Phân trang chuẩn giống hệt Từ Vựng -->
        <div class="vocabulary-pagination-container" data-writing-pagination-container></div>
      </section>
    </div>
  `;

  // DOM elements
  const levelTabs = container.querySelectorAll('[data-writing-category]');
  const levelPill = container.querySelector('[data-level-pill]');
  const wordHanziEl = container.querySelector('[data-word-hanzi]');
  const wordPinyinEl = container.querySelector('[data-word-pinyin]');
  const wordMeaningEl = container.querySelector('[data-word-meaning]');
  const markBtn = container.querySelector('[data-action="toggle-written"]');
  const markBtnText = container.querySelector('[data-mark-btn-text]');
  const speakBtn = container.querySelector('[data-action="speak"]');
  const prevWordBtn = container.querySelector('[data-action="prev-word"]');
  const nextWordBtn = container.querySelector('[data-action="next-word"]');
  const randomWordBtn = container.querySelector('[data-action="random-word"]');
  const charTabsEl = container.querySelector('[data-char-tabs]');
  const modeTabs = container.querySelectorAll('.mode-tab');
  const writerTarget = container.querySelector('#hanziWriterTarget');
  const freehandCanvasEl = container.querySelector('#freehandCanvas');
  const fallbackCharEl = container.querySelector('[data-fallback-char]');
  const statusMsgEl = container.querySelector('[data-status-text]');
  const statusIconEl = container.querySelector('.status-icon');
  const toolsQuizAnimate = container.querySelector('[data-tools="quiz-animate"]');
  const toolsCanvas = container.querySelector('[data-tools="canvas"]');
  const charPreviewEl = container.querySelector('[data-char-preview]');
  const charPinyinEl = container.querySelector('[data-char-pinyin]');
  const charSinoEl = container.querySelector('[data-char-sino]');
  const charMeaningEl = container.querySelector('[data-char-meaning]');
  const charStrokesEl = container.querySelector('[data-char-strokes]');
  const charCompoundEl = container.querySelector('[data-char-compound]');
  const charExampleEl = container.querySelector('[data-char-example]');
  const charWrittenCountEl = container.querySelector('[data-char-written-count]');
  const masteredBadgeEl = container.querySelector('[data-char-mastered-badge]');
  const browserLevelNameEl = container.querySelector('[data-browser-level-name]');
  const browserCountInfoEl = container.querySelector('[data-browser-count-info]');
  const vocabListEl = container.querySelector('[data-writing-vocab-list]');
  const overlayEl = container.querySelector('[data-writing-overlay]');
  const paginationContainerEl = container.querySelector('[data-writing-pagination-container]');

  // LuLu DOM elements
  const luluLvlEl = container.querySelector('[data-lulu-lvl]');
  const luluExpEl = container.querySelector('[data-lulu-exp]');
  const luluMaxExpEl = container.querySelector('[data-lulu-max-exp]');
  const luluProgressFillEl = container.querySelector('[data-lulu-progress-fill]');

  function updateLuluWidget() {
    const pet = loadPetData();
    if (luluLvlEl) luluLvlEl.textContent = pet.level || 1;
    if (luluExpEl) luluExpEl.textContent = pet.exp || 0;
    if (luluMaxExpEl) luluMaxExpEl.textContent = pet.maxExp || 100;
    if (luluProgressFillEl) {
      const pct = Math.min(100, Math.round(((pet.exp || 0) / (pet.maxExp || 100)) * 100));
      luluProgressFillEl.style.width = `${pct}%`;
    }
  }

  // Khởi tạo Canvas vẽ tự do
  freehandCanvas = freehandCanvasEl;
  freehandCtx = freehandCanvas.getContext('2d');

  function clearFreehandCanvas() {
    if (!freehandCtx) return;
    freehandCtx.clearRect(0, 0, freehandCanvas.width, freehandCanvas.height);
  }

  function initFreehandDrawing() {
    let lastX = 0;
    let lastY = 0;
    let isMouseDown = false;

    const getPos = (e) => {
      const rect = freehandCanvas.getBoundingClientRect();
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      const scaleX = freehandCanvas.width / rect.width;
      const scaleY = freehandCanvas.height / rect.height;
      return {
        x: (clientX - rect.left) * scaleX,
        y: (clientY - rect.top) * scaleY
      };
    };

    const startDraw = (e) => {
      if (currentMode !== 'canvas') return;
      isMouseDown = true;
      const pos = getPos(e);
      lastX = pos.x;
      lastY = pos.y;
      freehandCtx.beginPath();
      freehandCtx.arc(lastX, lastY, brushWidth / 2, 0, Math.PI * 2);
      freehandCtx.fillStyle = brushColor;
      freehandCtx.fill();
      e.preventDefault();
    };

    const draw = (e) => {
      if (!isMouseDown || currentMode !== 'canvas') return;
      const pos = getPos(e);
      freehandCtx.beginPath();
      freehandCtx.moveTo(lastX, lastY);
      freehandCtx.lineTo(pos.x, pos.y);
      freehandCtx.strokeStyle = brushColor;
      freehandCtx.lineWidth = brushWidth;
      freehandCtx.lineCap = 'round';
      freehandCtx.lineJoin = 'round';
      freehandCtx.stroke();
      lastX = pos.x;
      lastY = pos.y;
      e.preventDefault();
    };

    const stopDraw = () => { isMouseDown = false; };

    freehandCanvas.addEventListener('mousedown', startDraw);
    freehandCanvas.addEventListener('mousemove', draw);
    window.addEventListener('mouseup', stopDraw);

    freehandCanvas.addEventListener('touchstart', startDraw, { passive: false });
    freehandCanvas.addEventListener('touchmove', draw, { passive: false });
    window.addEventListener('touchend', stopDraw);
  }

  initFreehandDrawing();

  // Phát âm chữ Hán
  function speakHanzi(text) {
    if (!text) return;
    window.speechSynthesis?.cancel();
    if ('speechSynthesis' in window) {
      try {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'zh-CN';
        utterance.rate = 0.85;
        const voices = window.speechSynthesis.getVoices();
        const zh = voices.find(v => v.lang === 'zh-CN' || v.lang.startsWith('zh') || v.name.includes('Chinese'));
        if (zh) utterance.voice = zh;
        window.speechSynthesis.speak(utterance);
        return;
      } catch (_) {}
    }
    try {
      const audio = new Audio(`https://dict.youdao.com/dictvoice?audio=${encodeURIComponent(text)}&le=zh`);
      audio.play().catch(() => {});
    } catch (_) {}
  }

  /**
   * Xử lý hoàn thành bài viết cho một chữ Hán:
   * 1. Lưu vào bảng user_writing_progress trên Supabase
   * 2. Thưởng +25 EXP và thức ăn cho LuLu
   * 3. Cập nhật giao diện trạng thái
   */
  async function completeWrittenCharacter(char, customMode = 'quiz') {
    if (!currentWord || !char) return;

    // 1. Lưu vào Supabase và LocalStorage
    const saved = await recordWrittenWordToSupabase({
      user,
      word: currentWord,
      character: char,
      level: currentWord.level || currentCategory,
      mode: customMode,
      strokeCount
    });

    writtenProgressMap.set(`${currentWord.hanzi}:${char}`, saved);
    writtenProgressMap.set(char, saved);
    writtenProgressMap.set(currentWord.hanzi, saved);

    // 2. Thưởng EXP cho LuLu
    await awardLuluExp(25, { source: `Tập viết chữ [${char}]`, foodDrop: true });
    updateLuluWidget();

    // 3. Tích điểm xếp hạng hệ thống
    recordScore({ category: 'practice', points: 20, description: `Tập viết chữ ${char}` });

    // 4. Cập nhật giao diện nút và huy hiệu
    markBtn.classList.add('is-marked');
    markBtnText.textContent = `Đã viết (${saved.times_written} lần) ✓`;
    masteredBadgeEl.hidden = false;
    charWrittenCountEl.textContent = `Đã viết ${saved.times_written} lần (Lần cuối: vừa xong)`;

    // Cập nhật tab chữ con
    const activeTab = charTabsEl.querySelector(`[data-char="${char}"]`);
    if (activeTab && !activeTab.querySelector('.char-done-tag')) {
      const tag = document.createElement('span');
      tag.className = 'char-done-tag';
      tag.textContent = '✓';
      activeTab.appendChild(tag);
    }

    // Cập nhật thẻ từ vựng trong danh sách Supabase bên dưới
    const cardEl = vocabListEl.querySelector(`[data-vocab-id="${currentWord.id}"]`);
    if (cardEl && !cardEl.querySelector('.vocab-written-indicator')) {
      const meaningsEl = cardEl.querySelector('.vocabulary-meanings');
      if (meaningsEl) {
        const ind = document.createElement('span');
        ind.className = 'vocab-written-indicator';
        ind.textContent = '✓ Đã viết';
        meaningsEl.appendChild(ind);
      }
    }

    // 5. Thông báo Toast
    toast?.(`✦ Hoàn thành viết chữ [${char}]! +25 EXP LuLu 🍊 (Đã lưu Supabase) ✦`);
  }

  /**
   * Khởi tạo HanziWriter với khung 米字格 chuẩn hình 1
   */
  function loadHanziWriter(char) {
    if (!char) return;
    writerTarget.innerHTML = '';

    if (fallbackCharEl) {
      fallbackCharEl.textContent = char;
      fallbackCharEl.style.display = 'none';
    }

    const HW = window.HanziWriter;
    if (!HW) {
      if (fallbackCharEl) fallbackCharEl.style.display = 'block';
      statusMsgEl.textContent = `Chữ: ${char}. (Bạn có thể dùng chế độ Đồ chữ tự do trên ô 米字格)`;
      return;
    }

    try {
      currentWriter = HW.create(writerTarget, char, {
        width: 270,
        height: 270,
        padding: 16,
        showOutline: showOutlineState,
        outlineColor: '#fca5a5',
        strokeColor: '#1e293b',
        radicalColor: '#16a34a',
        drawingColor: '#28543b',
        drawingWidth: 22,
        strokeAnimationSpeed: strokeSpeed,
        delayBetweenStrokes: 180,
        showHintAfterMisses: 1,
        highlightOnComplete: true,
        highlightColor: '#22c55e',
        onLoadCharDataSuccess: (data) => {
          strokeCount = data.strokes ? data.strokes.length : 0;
          charStrokesEl.textContent = `${strokeCount} nét`;
          if (currentMode === 'quiz') {
            startQuiz();
          } else if (currentMode === 'animate') {
            startAnimation();
          }
        },
        onLoadCharDataError: () => {
          if (fallbackCharEl) fallbackCharEl.style.display = 'block';
          statusMsgEl.textContent = `Chữ: ${char}. Hãy chuyển sang "Đồ chữ tự do" để luyện viết`;
        }
      });

      if (currentMode === 'canvas') {
        currentWriter.showOutline();
      }
    } catch (err) {
      console.warn('Lỗi HanziWriter:', err);
      if (fallbackCharEl) fallbackCharEl.style.display = 'block';
    }
  }

  function startQuiz() {
    if (!currentWriter) return;
    try {
      currentWriter.cancelQuiz();
    } catch (_) {}

    statusIconEl.textContent = '✍️';
    statusMsgEl.textContent = `Hãy viết nét thứ 1 / ${strokeCount || '?'} theo thứ tự bút thuận`;

    currentWriter.quiz({
      onMistake: (strokeData) => {
        statusIconEl.textContent = '⚠️';
        statusMsgEl.innerHTML = `<span style="color:#dc2626;">Chưa đúng hướng hoặc thứ tự! Hãy thử lại nét ${strokeData.strokeNum + 1} hoặc bấm "💡 Gợi ý nét".</span>`;
      },
      onCorrectStroke: (strokeData) => {
        const nextNum = strokeData.strokeNum + 2;
        statusIconEl.textContent = '✨';
        if (nextNum <= strokeCount) {
          statusMsgEl.innerHTML = `<span style="color:#15803d;">Đúng nét ${strokeData.strokeNum + 1}! Tiếp tục nét ${nextNum} / ${strokeCount}.</span>`;
        }
      },
      onComplete: (summary) => {
        statusIconEl.textContent = '🎉';
        const mistakeText = summary.totalMistakes > 0 ? ` (sai ${summary.totalMistakes} lần)` : ' (chuẩn xác 100%)';
        statusMsgEl.innerHTML = `<strong style="color:#15803d;">Xuất sắc! Bạn đã viết hoàn thành đủ ${strokeCount} nét của chữ "${currentChar}"${mistakeText}!</strong>`;

        // TỰ ĐỘNG ĐÁNH DẤU TỪ ĐÃ VIẾT VÀ TÍCH LŨY EXP CHO LULU
        completeWrittenCharacter(currentChar, 'quiz');
      }
    });
  }

  function startAnimation() {
    if (!currentWriter) return;
    try {
      currentWriter.cancelQuiz();
    } catch (_) {}
    statusIconEl.textContent = '▶';
    statusMsgEl.textContent = `Đang trình chiếu thứ tự các nét của chữ "${currentChar}"...`;
    currentWriter.animateCharacter({
      onComplete: () => {
        statusIconEl.textContent = '✓';
        statusMsgEl.textContent = `Đã chạy xong mẫu nét. Bạn có thể bấm "Tập viết theo nét" để thực hành ngay!`;
      }
    });
  }

  function switchMode(newMode) {
    currentMode = newMode;
    modeTabs.forEach(tab => tab.classList.toggle('active', tab.dataset.mode === newMode));

    if (newMode === 'canvas') {
      toolsQuizAnimate.hidden = true;
      toolsCanvas.hidden = false;
      freehandCanvasEl.hidden = false;
      clearFreehandCanvas();
      if (currentWriter) {
        try {
          currentWriter.cancelQuiz();
          currentWriter.showOutline();
        } catch (_) {}
      }
      statusIconEl.textContent = '🖌';
      statusMsgEl.textContent = `Chế độ tự do: Dùng bút vẽ đè lên chữ mẫu mờ màu hồng trong ô 米字格`;
    } else {
      freehandCanvasEl.hidden = true;
      toolsQuizAnimate.hidden = false;
      toolsCanvas.hidden = true;

      if (newMode === 'quiz') {
        startQuiz();
      } else if (newMode === 'animate') {
        startAnimation();
      }
    }
  }

  /**
   * Cập nhật UI Studio cho một chữ Hán cụ thể trong từ
   */
  function updateCharacterUI(char, word) {
    currentChar = char;
    currentWord = word;

    // Header Studio
    levelPill.textContent = word.level || currentCategory;
    wordHanziEl.textContent = word.hanzi;
    wordPinyinEl.textContent = word.pinyin || toPinyin(word.hanzi);
    wordMeaningEl.textContent = word.meaning || word.english || '';

    // Cột Phải: Thẻ thông tin
    charPreviewEl.textContent = char;
    charPinyinEl.textContent = toPinyin(char);
    charSinoEl.textContent = getSinoVietnamese(char) || 'Chưa cập nhật';
    charMeaningEl.textContent = word.meaning || word.english || 'Nghĩa từ vựng';
    charStrokesEl.textContent = 'Đang tính...';
    charCompoundEl.textContent = `${word.hanzi} (${word.pinyin || toPinyin(word.hanzi)} - ${word.meaning})`;
    charExampleEl.textContent = word.example || 'Chưa cập nhật câu ví dụ';

    // Kiểm tra trạng thái đã viết
    const writtenData = writtenProgressMap.get(`${word.hanzi}:${char}`) || writtenProgressMap.get(char);
    if (writtenData) {
      markBtn.classList.add('is-marked');
      markBtnText.textContent = `Đã viết (${writtenData.times_written} lần) ✓`;
      masteredBadgeEl.hidden = false;
      charWrittenCountEl.textContent = `Đã viết ${writtenData.times_written} lần`;
    } else {
      markBtn.classList.remove('is-marked');
      markBtnText.textContent = 'Đánh dấu đã viết';
      masteredBadgeEl.hidden = true;
      charWrittenCountEl.textContent = 'Chưa viết lần nào';
    }

    // Đánh dấu highlight trên danh sách từ vựng bên dưới
    vocabListEl.querySelectorAll('.vocabulary-item').forEach(item => {
      item.classList.toggle('is-selected-writing', item.dataset.vocabId === String(word.id));
    });

    // Nạp HanziWriter
    loadHanziWriter(char);
  }

  /**
   * Chọn một từ vựng: phân tách các chữ Hán đơn để tạo tab chọn chữ
   */
  function selectWord(word, targetChar = null) {
    currentWord = word;
    const chars = Array.from(word.hanzi || '').filter(c => /[\u4e00-\u9fa5]/.test(c));
    if (chars.length === 0) {
      chars.push(word.hanzi);
    }

    // Render các tab chọn chữ đơn trong từ vựng (VD: 你, 好)
    charTabsEl.innerHTML = chars.map((c, i) => {
      const isWritten = writtenProgressMap.has(`${word.hanzi}:${c}`) || writtenProgressMap.has(c);
      const isInitial = targetChar ? c === targetChar : i === 0;
      return `
        <button type="button" class="writing-char-tab${isInitial ? ' active' : ''}" data-char="${c}">
          <span class="char-hanzi">${c}</span>
          <span class="char-pinyin-small">${toPinyin(c)}</span>
          ${isWritten ? '<span class="char-done-tag">✓</span>' : ''}
        </button>
      `;
    }).join('');

    const initialChar = targetChar && chars.includes(targetChar) ? targetChar : chars[0];
    updateCharacterUI(initialChar, word);
  }

  // Nút Đánh dấu từ đã viết thủ công
  markBtn.addEventListener('click', async () => {
    if (!currentWord || !currentChar) return;
    await completeWrittenCharacter(currentChar, currentMode);
  });

  // Chọn chữ trong thanh charTabs
  charTabsEl.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-char]');
    if (!btn || !currentWord) return;
    const char = btn.dataset.char;
    charTabsEl.querySelectorAll('.writing-char-tab').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    updateCharacterUI(char, currentWord);
  });

  // Chuyển 3 chế độ
  modeTabs.forEach(tab => {
    tab.addEventListener('click', () => switchMode(tab.dataset.mode));
  });

  // Công cụ Quiz / Animate
  toolsQuizAnimate.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-tool]');
    if (!btn || !currentWriter) return;
    const tool = btn.dataset.tool;

    if (tool === 'restart') {
      if (currentMode === 'quiz') startQuiz();
      else if (currentMode === 'animate') startAnimation();
    } else if (tool === 'hint') {
      try {
        currentWriter.showHint();
        statusMsgEl.textContent = `Đang nhấp nháy nét gợi ý tiếp theo...`;
      } catch (_) {}
    } else if (tool === 'replay-anim') {
      startAnimation();
    } else if (tool === 'toggle-outline') {
      showOutlineState = !showOutlineState;
      if (showOutlineState) {
        currentWriter.showOutline();
        btn.textContent = '👁 Ẩn mẫu';
      } else {
        currentWriter.hideOutline();
        btn.textContent = '👁 Hiện mẫu';
      }
    }
  });

  // Công cụ Canvas
  toolsCanvas.addEventListener('click', async (e) => {
    const colorBtn = e.target.closest('[data-color]');
    if (colorBtn) {
      toolsCanvas.querySelectorAll('.color-dot').forEach(b => b.classList.remove('active'));
      colorBtn.classList.add('active');
      brushColor = colorBtn.dataset.color;
      return;
    }

    const sizeBtn = e.target.closest('[data-size]');
    if (sizeBtn) {
      toolsCanvas.querySelectorAll('.size-btn').forEach(b => b.classList.remove('active'));
      sizeBtn.classList.add('active');
      brushWidth = Number(sizeBtn.dataset.size);
      return;
    }

    const actionBtn = e.target.closest('[data-canvas-action]');
    if (actionBtn) {
      const act = actionBtn.dataset.canvasAction;
      if (act === 'clear') {
        clearFreehandCanvas();
        statusMsgEl.textContent = 'Đã xóa bảng vẽ. Hãy bắt đầu viết lại!';
      } else if (act === 'finish') {
        await completeWrittenCharacter(currentChar, 'canvas');
        statusMsgEl.innerHTML = `<strong style="color:#15803d;">Tuyệt vời! Bạn đã hoàn thành bài viết chữ "${currentChar}"!</strong>`;
      }
    }
  });

  // Điều hướng từ vựng (Trước / Tiếp / Random / Phát âm)
  speakBtn.addEventListener('click', () => {
    if (currentWord) speakHanzi(currentWord.hanzi);
  });

  prevWordBtn.addEventListener('click', () => {
    if (!currentWords.length) return;
    currentWordIndex = (currentWordIndex - 1 + currentWords.length) % currentWords.length;
    selectWord(currentWords[currentWordIndex]);
  });

  nextWordBtn.addEventListener('click', () => {
    if (!currentWords.length) return;
    currentWordIndex = (currentWordIndex + 1) % currentWords.length;
    selectWord(currentWords[currentWordIndex]);
  });

  randomWordBtn.addEventListener('click', () => {
    if (currentWords.length <= 1) return;
    let randomIndex;
    do {
      randomIndex = Math.floor(Math.random() * currentWords.length);
    } while (randomIndex === currentWordIndex);
    currentWordIndex = randomIndex;
    selectWord(currentWords[currentWordIndex]);
  });

  /**
   * Render danh sách từ vựng chuẩn giống hệt trang Từ Vựng
   */
  const renderWordsList = (words) => {
    if (!words.length) {
      vocabListEl.innerHTML = '<p class="vocabulary-loading">Chưa có từ vựng cho cấp độ này trên Supabase.</p>';
      return;
    }

    vocabListEl.innerHTML = words.map((word, index) => {
      const isSelected = currentWord && String(word.id) === String(currentWord.id);
      const isWritten = writtenProgressMap.has(word.hanzi) || writtenProgressMap.has(String(word.id));
      return `
        <article class="vocabulary-item${isSelected ? ' is-selected-writing' : ''}" role="button" tabindex="0" data-vocab-index="${index}" data-vocab-id="${word.id}">
          <div class="vocabulary-main-row">
            <div class="vocabulary-hanzi">
              <span class="vocabulary-pinyin">${escapeHtml(word.pinyin || toPinyin(word.hanzi))}</span>
              <strong>${escapeHtml(word.hanzi)}</strong>
            </div>
            <div class="vocabulary-meanings">
              ${word.english ? `<span class="vocabulary-english">${escapeHtml(word.english)}</span>` : ''}
              <span class="vocabulary-vietnamese">${escapeHtml(word.meaning)}</span>
              ${word.wordType ? `<span class="vocabulary-tag">${escapeHtml(word.wordType)}</span>` : ''}
              ${isWritten ? `<span class="vocab-written-indicator">✓ Đã viết</span>` : ''}
            </div>
          </div>
          ${word.example ? `
            <div class="vocabulary-component">
              <span class="vocabulary-component-label">Example:</span>
              <span>${escapeHtml(word.example)}</span>
            </div>
          ` : ''}
          <button class="vocabulary-row-speak" type="button" aria-label="Phát âm ${escapeHtml(word.hanzi)}" data-speak-row>🔊</button>
          <button class="vocabulary-row-mastered${masteredVocabularyIds.has(String(word.id)) ? ' is-mastered' : ''}" type="button" aria-label="${masteredVocabularyIds.has(String(word.id)) ? 'Bỏ đánh dấu đã thuộc' : 'Đánh dấu đã thuộc'}" aria-pressed="${masteredVocabularyIds.has(String(word.id))}" data-mastered-row>${masteredVocabularyIds.has(String(word.id)) ? '★' : '☆'}</button>
        </article>
      `;
    }).join('');
  };

  const showOverlay = () => {
    if (overlayEl) {
      overlayEl.hidden = false;
      overlayEl.classList.add('active');
    }
  };

  const hideOverlay = () => {
    if (overlayEl) {
      overlayEl.hidden = true;
      overlayEl.classList.remove('active');
    }
  };

  /**
   * Tải dữ liệu từ vựng theo trang từ Supabase (có cache)
   */
  const loadPage = async (category, page = 1, shouldScroll = false) => {
    const requestId = ++activeRequestId;
    currentCategory = category;
    currentPage = page;
    browserLevelNameEl.textContent = category;

    const cacheKey = `${category}:${page}`;
    if (pageCache.has(cacheKey)) {
      const cached = pageCache.get(cacheKey);
      currentWords = cached.words;
      totalWords = cached.total;
      totalPages = Math.max(1, Math.ceil(totalWords / PAGE_SIZE));
      hideOverlay();

      browserCountInfoEl.innerHTML = `Hiển thị <strong>${currentWords.length}</strong> / <strong>${totalWords}</strong> từ (Supabase)`;
      renderWordsList(currentWords);
      paginationContainerEl.innerHTML = renderPaginationHtml(currentPage, totalPages, totalWords);

      if (currentWords.length > 0) {
        currentWordIndex = 0;
        selectWord(currentWords[0]);
      }

      if (shouldScroll) {
        vocabListEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
      return;
    }

    if (currentWords.length > 0) {
      showOverlay();
    } else {
      vocabListEl.innerHTML = '<p class="vocabulary-loading"><span class="vocabulary-loading-spinner"></span> Đang tải từ vựng từ Supabase...</p>';
    }

    try {
      let result = null;
      try {
        result = await fetchVocabularyPage(category, page);
      } catch (error) {
        console.warn('Lỗi truy vấn Supabase vocabulary, fallback sang mẫu:', error.message);
        result = getFallbackVocabularyPage(category, page);
      }

      if (requestId !== activeRequestId) return;

      pageCache.set(cacheKey, result);
      currentWords = result.words;
      totalWords = result.total;
      totalPages = Math.max(1, Math.ceil(totalWords / PAGE_SIZE));
      if (currentPage > totalPages) currentPage = totalPages;

      browserCountInfoEl.innerHTML = `Hiển thị <strong>${currentWords.length}</strong> / <strong>${totalWords}</strong> từ (Supabase)`;
      renderWordsList(currentWords);
      paginationContainerEl.innerHTML = renderPaginationHtml(currentPage, totalPages, totalWords);

      if (currentWords.length > 0) {
        currentWordIndex = 0;
        selectWord(currentWords[0]);
      }

      if (shouldScroll) {
        vocabListEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    } finally {
      if (requestId === activeRequestId) {
        hideOverlay();
      }
    }
  };

  // Click vào mục trong danh sách từ vựng: chọn luyện viết, phát âm hoặc đánh dấu đã thuộc
  vocabListEl.addEventListener('click', (event) => {
    const item = event.target.closest('[data-vocab-index]');
    if (!item) return;
    const index = Number(item.dataset.vocabIndex);
    const word = currentWords[index];
    if (!word) return;

    // Đánh dấu thuộc từ (★)
    const masteredBtn = event.target.closest('[data-mastered-row]');
    if (masteredBtn) {
      if (!user) return;
      const vocabularyId = String(word.id);
      const isMastered = !masteredVocabularyIds.has(vocabularyId);
      if (isMastered) masteredVocabularyIds.add(vocabularyId); else masteredVocabularyIds.delete(vocabularyId);

      masteredBtn.classList.toggle('is-mastered', isMastered);
      masteredBtn.setAttribute('aria-pressed', isMastered);
      masteredBtn.setAttribute('aria-label', isMastered ? 'Bỏ đánh dấu đã thuộc' : 'Đánh dấu đã thuộc');
      masteredBtn.textContent = isMastered ? '★' : '☆';

      // Lưu bảng vocabulary_mastery
      (async () => {
        try {
          if (isMastered) {
            await supabase.from('vocabulary_mastery').upsert({
              user_id: user.id,
              vocabulary_id: word.id,
              mastered_at: new Date().toISOString()
            }, { onConflict: 'user_id,vocabulary_id' });
            recordScore({ category: 'vocabulary', points: SCORE_RULES.VOCABULARY_PRACTICE, description: 'Đánh dấu thuộc từ vựng' });
            awardLuluExp(20, { source: 'Thuộc từ vựng', foodDrop: true });
            updateLuluWidget();
          } else {
            await supabase.from('vocabulary_mastery').delete().eq('user_id', user.id).eq('vocabulary_id', word.id);
          }
        } catch (err) {
          console.warn('Lỗi lưu vocabulary_mastery:', err.message);
        }
      })();
      return;
    }

    // Phát âm (🔊)
    const speakBtnEl = event.target.closest('[data-speak-row]');
    if (speakBtnEl) {
      event.stopPropagation();
      speakBtnEl.classList.add('is-speaking');
      speakHanzi(word.hanzi);
      setTimeout(() => speakBtnEl.classList.remove('is-speaking'), 700);
      return;
    }

    // Chọn từ để nạp lên khung tập viết
    currentWordIndex = index;
    selectWord(word);

    // Cuộn mượt lên khung viết 米字格
    container.querySelector('.writing-studio-card')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  // Chuyển tab cấp độ
  levelTabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      const targetCategory = tab.dataset.writingCategory;
      if (targetCategory === currentCategory) return;

      container.querySelectorAll('.vocabulary-tab').forEach((item) => item.classList.remove('active'));
      tab.classList.add('active');
      loadPage(targetCategory, 1, false);
    });
  });

  // Điều hướng phân trang Supabase
  paginationContainerEl.addEventListener('click', (event) => {
    const btn = event.target.closest('[data-page]');
    if (!btn || btn.disabled) return;

    const action = btn.dataset.page;
    let targetPage = currentPage;

    if (action === 'first') {
      targetPage = 1;
    } else if (action === 'prev') {
      targetPage = Math.max(1, currentPage - 1);
    } else if (action === 'next') {
      targetPage = Math.min(totalPages, currentPage + 1);
    } else if (action === 'last') {
      targetPage = totalPages;
    } else {
      targetPage = Number(action);
    }

    if (targetPage !== currentPage && targetPage >= 1 && targetPage <= totalPages) {
      loadPage(currentCategory, targetPage, true);
    }
  });

  // Lắng nghe sự kiện LuLu cập nhật từ các nguồn khác
  window.addEventListener('lulu-inventory-updated', updateLuluWidget);

  // Tải trang đầu tiên từ Supabase
  await loadPage(currentCategory, 1, false);
}
