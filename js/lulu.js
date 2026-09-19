import { recordScore } from './score-service.js';
import { supabase } from './supabase.js';

// Danh sách câu nói tiếng Trung dễ thương của LuLu
const LULU_QUOTES = [
  { zh: '今天也要一起加油哦！', py: 'Jīntiān yě yào yīqǐ jiāyóu o!', vi: 'Hôm nay cũng phải cùng nhau cố gắng nhé!' },
  { zh: '学习中文真有趣！', py: 'Xuéxí zhōngwén zhēn yǒuqù!', vi: 'Học tiếng Trung thật là thú vị!' },
  { zh: '我想吃甜甜的橙子！', py: 'Wǒ xiǎng chī tiántián de chéngzi!', vi: 'Mình muốn ăn một quả cam ngọt ngào!' },
  { zh: '你今天学了几个新词呢？', py: 'Nǐ jīntiān xué le jǐ gè xīn cí ne?', vi: 'Hôm nay bạn đã học được mấy từ mới rồi?' },
  { zh: '摸摸头，心情变得超级棒！', py: 'Mōmō tóu, xīnqíng biànde chāojí bàng!', vi: 'Xoa đầu một cái, tâm trạng liền siêu tốt!' },
  { zh: '坚持就是胜利！', py: 'Jiānchí jiùshì shènglì!', vi: 'Kiên trì chính là thắng lợi!' },
  { zh: '温泉泡得好舒服呀~', py: 'Wēnquán pào de hǎo shūfu ya~', vi: 'Ngâm suối nước nóng thật là sảng khoái~' },
  { zh: '有你陪我学习，太幸福啦！', py: 'Yǒu nǐ péi wǒ xuéxí, tài xìngfú la!', vi: 'Có bạn cùng học với mình, hạnh phúc quá!' }
];

// Danh sách thức ăn
const FOODS = [
  { id: 'baozi', name: 'Bánh bao nóng', zh: '包子', py: 'bāozi', icon: '🥟', fullness: 30, exp: 22 },
  { id: 'orange', name: 'Quả cam', zh: '橙子', py: 'chéngzi', icon: '🍊', fullness: 25, exp: 18 },
  { id: 'apple', name: 'Táo đỏ', zh: '苹果', py: 'píngguǒ', icon: '🍎', fullness: 15, exp: 10 },
  { id: 'watermelon', name: 'Dưa hấu', zh: '西瓜', py: 'xīguā', icon: '🍉', fullness: 40, exp: 30 }
];

// Danh hiệu theo cấp độ
const LEVEL_TITLES = [
  'Bé Caba Mầm Non',
  'Caba Tập Sự',
  'Caba Chăm Học',
  'Caba Siêng Năng',
  'Caba Tinh Anh',
  'Học Bá Caba',
  'Trạng Nguyên Caba',
  'Đại Tông Sư Caba'
];

// Từ vựng mini quiz để học cùng LuLu
const MINI_VOCAB = [
  { zh: '苹果', py: 'píngguǒ', vi: 'Quả táo', opts: ['Quả táo', 'Quả chuối', 'Quả dưa'] },
  { zh: '朋友', py: 'péngyou', vi: 'Bạn bè', opts: ['Bạn bè', 'Thầy giáo', 'Bác sĩ'] },
  { zh: '学习', py: 'xuéxí', vi: 'Học tập', opts: ['Học tập', 'Nấu ăn', 'Chạy bộ'] },
  { zh: '高兴', py: 'gāoxìng', vi: 'Vui mừng', opts: ['Vui mừng', 'Tức giận', 'Lo lắng'] },
  { zh: '喝水', py: 'hē shuǐ', vi: 'Uống nước', opts: ['Uống nước', 'Ăn cơm', 'Đi ngủ'] },
  { zh: '谢谢', py: 'xièxie', vi: 'Cảm ơn', opts: ['Cảm ơn', 'Tạm biệt', 'Xin lỗi'] },
  { zh: '加油', py: 'jiāyóu', vi: 'Cố lên', opts: ['Cố lên', 'Mau lên', 'Dừng lại'] },
  { zh: '可爱', py: 'kě\'ài', vi: 'Đáng yêu', opts: ['Đáng yêu', 'Khó tính', 'Thông minh'] },
  { zh: '橙子', py: 'chéngzi', vi: 'Quả cam', opts: ['Quả cam', 'Quả quýt', 'Quả chanh'] },
  { zh: '今天', py: 'jīntiān', vi: 'Hôm nay', opts: ['Hôm nay', 'Ngày mai', 'Hôm qua'] }
];

const STORAGE_KEY = 'mandarinly_lulu_pet';
const DEVICE_PET_ID_KEY = 'mandarinly_device_pet_id';

export function loadPetData() {
  const defaultData = {
    name: 'LuLu',
    level: 1,
    exp: 20,
    maxExp: 100,
    fullness: 85,
    happiness: 90,
    energy: 80,
    inventory: { baozi: 3, orange: 3, apple: 4, watermelon: 1 },
    lastClaimDate: '',
    lastFeedTime: Date.now(),
    totalFed: 0
  };

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultData;
    const data = JSON.parse(raw);

    // Tính độ giảm theo thời gian (cứ 1 tiếng đói 4%)
    const now = Date.now();
    const hoursPassed = Math.floor((now - (data.lastFeedTime || now)) / (1000 * 60 * 60));
    if (hoursPassed > 0) {
      data.fullness = Math.max(10, (data.fullness || 80) - hoursPassed * 4);
      data.happiness = Math.max(20, (data.happiness || 90) - hoursPassed * 2);
      data.lastFeedTime = now;
    }
    return { ...defaultData, ...data };
  } catch (_) {
    return defaultData;
  }
}

export async function savePetData(data, syncCloud = true) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (_) {}

  if (!syncCloud) return;

  try {
    const { data: authData } = await supabase.auth.getUser();
    const user = authData?.user;

    const payload = {
      pet_name: data.name || 'LuLu',
      level: data.level || 1,
      exp: data.exp || 0,
      max_exp: data.maxExp || 100,
      fullness: data.fullness ?? 85,
      happiness: data.happiness ?? 90,
      energy: data.energy ?? 80,
      inventory: data.inventory || {},
      last_claim_date: data.lastClaimDate || '',
      total_fed: data.totalFed || 0,
      updated_at: new Date().toISOString()
    };

    if (user) {
      // Người dùng đã đăng nhập -> lưu theo user_id
      payload.user_id = user.id;
      const { error } = await supabase.from('lulu_pet').upsert(payload, { onConflict: 'user_id' });
      if (error) console.warn('[LuLu Supabase User Save Error]:', error.message);
      else console.log('[LuLu Supabase] Đã cập nhật cho user:', user.email || user.id);
    } else {
      // Người dùng khách -> lưu theo device_id
      let devicePetId = localStorage.getItem(DEVICE_PET_ID_KEY);
      if (devicePetId) {
        const { error } = await supabase.from('lulu_pet').update(payload).eq('id', devicePetId);
        if (error) console.warn('[LuLu Supabase Guest Update Error]:', error.message);
        else console.log('[LuLu Supabase] Đã cập nhật cho khách:', devicePetId);
      } else {
        const { data: inserted, error } = await supabase.from('lulu_pet').insert(payload).select('id').maybeSingle();
        if (inserted?.id) {
          localStorage.setItem(DEVICE_PET_ID_KEY, inserted.id);
          console.log('[LuLu Supabase] Đã tạo mới pet trên Supabase cho khách:', inserted.id);
        } else if (error) {
          console.warn('[LuLu Supabase Guest Insert Error]:', error.message);
        }
      }
    }
  } catch (err) {
    console.warn('[LuLu Supabase Save Exception]:', err);
  }
}

export async function syncPetWithSupabase() {
  try {
    const { data: authData } = await supabase.auth.getUser();
    const user = authData?.user;

    if (user) {
      // 1. Kiểm tra tài khoản đã đăng nhập
      const { data: row, error } = await supabase
        .from('lulu_pet')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (row) {
        const merged = {
          name: row.pet_name || 'LuLu',
          level: row.level || 1,
          exp: row.exp || 0,
          maxExp: row.max_exp || 100,
          fullness: row.fullness ?? 85,
          happiness: row.happiness ?? 90,
          energy: row.energy ?? 80,
          inventory: row.inventory || { baozi: 3, orange: 3, apple: 4, watermelon: 1 },
          lastClaimDate: row.last_claim_date || '',
          totalFed: row.total_fed || 0,
          lastFeedTime: Date.now()
        };
        savePetData(merged, false);
        console.log('[LuLu Supabase] Đã đồng bộ dữ liệu người dùng:', user.id);
        return merged;
      } else {
        // Chưa có dữ liệu trên cloud -> Tạo bản ghi mới cho user
        const local = loadPetData();
        const { error: insErr } = await supabase.from('lulu_pet').insert({
          user_id: user.id,
          pet_name: local.name,
          level: local.level,
          exp: local.exp,
          max_exp: local.maxExp,
          fullness: local.fullness,
          happiness: local.happiness,
          energy: local.energy,
          inventory: local.inventory,
          last_claim_date: local.lastClaimDate,
          total_fed: local.totalFed
        });
        if (insErr) console.warn('[LuLu Supabase Insert Error]:', insErr.message);
        return local;
      }
    } else {
      // 2. Người dùng khách / chưa đăng nhập
      let devicePetId = localStorage.getItem(DEVICE_PET_ID_KEY);
      if (devicePetId) {
        const { data: row } = await supabase
          .from('lulu_pet')
          .select('*')
          .eq('id', devicePetId)
          .maybeSingle();

        if (row) {
          const merged = {
            name: row.pet_name || 'LuLu',
            level: row.level || 1,
            exp: row.exp || 0,
            maxExp: row.max_exp || 100,
            fullness: row.fullness ?? 85,
            happiness: row.happiness ?? 90,
            energy: row.energy ?? 80,
            inventory: row.inventory || { baozi: 3, orange: 3, apple: 4, watermelon: 1 },
            lastClaimDate: row.last_claim_date || '',
            totalFed: row.total_fed || 0,
            lastFeedTime: Date.now()
          };
          savePetData(merged, false);
          console.log('[LuLu Supabase] Đã nạp dữ liệu khách từ Supabase:', devicePetId);
          return merged;
        }
      }

      // Tạo mới 1 bản ghi khách trên Supabase để luôn có dữ liệu
      const local = loadPetData();
      const { data: inserted, error: insErr } = await supabase.from('lulu_pet').insert({
        pet_name: local.name,
        level: local.level,
        exp: local.exp,
        max_exp: local.maxExp,
        fullness: local.fullness,
        happiness: local.happiness,
        energy: local.energy,
        inventory: local.inventory,
        last_claim_date: local.lastClaimDate,
        total_fed: local.totalFed
      }).select('id').maybeSingle();

      if (inserted?.id) {
        localStorage.setItem(DEVICE_PET_ID_KEY, inserted.id);
        console.log('[LuLu Supabase] Khởi tạo bản ghi thú cưng trên Supabase thành công:', inserted.id);
      } else if (insErr) {
        console.warn('[LuLu Supabase Init Error]:', insErr.message);
      }

      return local;
    }
  } catch (err) {
    console.warn('[LuLu Supabase Sync Exception]:', err);
    return loadPetData();
  }
}

/**
 * Rơi thức ăn nuôi LuLu sau khi chơi game hoặc hoàn thành thử thách
 */
export async function awardFoodReward({ foodId = null, count = 1, source = 'Trò chơi' } = {}) {
  let chosenFood = null;
  if (foodId) {
    chosenFood = FOODS.find(f => f.id === foodId) || FOODS[0];
  } else {
    // Tỉ lệ rơi: Táo đỏ: 35%, Quả cam: 35%, Bánh bao: 22%, Dưa hấu: 8%
    const rand = Math.random() * 100;
    if (rand < 35) chosenFood = FOODS.find(f => f.id === 'apple');
    else if (rand < 70) chosenFood = FOODS.find(f => f.id === 'orange');
    else if (rand < 92) chosenFood = FOODS.find(f => f.id === 'baozi');
    else chosenFood = FOODS.find(f => f.id === 'watermelon');
  }

  const petData = loadPetData();
  if (!petData.inventory) petData.inventory = {};
  petData.inventory[chosenFood.id] = (petData.inventory[chosenFood.id] || 0) + count;

  await savePetData(petData, true);

  window.dispatchEvent(
    new CustomEvent('lulu-inventory-updated', {
      detail: { food: chosenFood, count, inventory: petData.inventory, source }
    })
  );

  return {
    id: chosenFood.id,
    name: chosenFood.name,
    icon: chosenFood.icon,
    zh: chosenFood.zh,
    py: chosenFood.py,
    count
  };
}

/**
 * Tặng EXP cho LuLu từ các hoạt động học tập bên ngoài (vocabulary, practice, exam, v.v.)
 * Có thể được gọi từ bất kỳ module nào mà không cần phải trong ngữ cảnh initLulu().
 * @param {number} amount - Lượng EXP tặng cho LuLu
 * @param {{ source?: string, foodDrop?: boolean }} options
 */
export async function awardLuluExp(amount = 0, { source = 'Học tập', foodDrop = false } = {}) {
  if (!amount || amount <= 0) return;

  const pet = loadPetData();

  pet.exp += amount;
  let leveledUp = false;

  while (pet.exp >= pet.maxExp) {
    pet.exp -= pet.maxExp;
    pet.level += 1;
    pet.maxExp = Math.floor(pet.maxExp * 1.35);
    leveledUp = true;
  }

  await savePetData(pet, true);

  // Phát event để LuLu UI cập nhật nếu đang mở
  window.dispatchEvent(new CustomEvent('lulu-exp-awarded', {
    detail: { amount, source, leveledUp, pet: { ...pet } }
  }));

  // Có thể rơi thức ăn kèm theo
  if (foodDrop && Math.random() < 0.35) {
    try {
      await awardFoodReward({ source });
    } catch (_) {}
  }

  return { pet, leveledUp };
}


export function initLulu({ toast } = {}) {
  const container = document.querySelector('[data-lulu]');
  if (!container) return;

  let pet = loadPetData();
  let currentQuote = LULU_QUOTES[0];
  let currentQuiz = null;

  // Khởi động đồng bộ Supabase nếu đã đăng nhập
  syncPetWithSupabase().then((synced) => {
    if (synced) {
      pet = synced;
      renderUI();
    }
  });

  // Tự động đồng bộ lại khi người dùng đăng nhập
  try {
    supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user) {
        syncPetWithSupabase().then((synced) => {
          if (synced) {
            pet = synced;
            renderUI();
          }
        });
      }
    });
  } catch (_) {}

  // Lắng nghe sự kiện rơi thức ăn khi chơi game
  window.addEventListener('lulu-inventory-updated', (e) => {
    if (e.detail?.inventory) {
      pet.inventory = e.detail.inventory;
      renderUI();
    }
  });

  // Lắng nghe EXP tặng từ hoạt động học tập bên ngoài (vocabulary, practice, exam...)
  window.addEventListener('lulu-exp-awarded', (e) => {
    if (!e.detail?.pet) return;
    const updated = e.detail.pet;
    // Đồng bộ dữ liệu mới từ localStorage vào pet hiện tại
    pet.exp = updated.exp;
    pet.level = updated.level;
    pet.maxExp = updated.maxExp;
    if (e.detail.leveledUp) {
      const idx = Math.min(pet.level - 1, LEVEL_TITLES.length - 1);
      toast?.(`🎉 LuLu đã lên cấp ${pet.level}! Danh hiệu mới: ${LEVEL_TITLES[idx]}`);
      triggerConfetti();
    }
    renderUI();
  });

  function speakText(text) {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utter = new SpeechSynthesisUtterance(text);
      utter.lang = 'zh-CN';
      utter.rate = 0.85;
      window.speechSynthesis.speak(utter);
    }
  }

  function addExp(amount) {
    pet.exp += amount;
    let leveledUp = false;
    while (pet.exp >= pet.maxExp) {
      pet.exp -= pet.maxExp;
      pet.level += 1;
      pet.maxExp = Math.floor(pet.maxExp * 1.35);
      leveledUp = true;
    }
    if (leveledUp) {
      toast?.(`🎉 LuLu đã lên cấp ${pet.level}! Đạt danh hiệu: ${getLevelTitle(pet.level)}`);
      triggerConfetti();
    }
    savePetData(pet);
    renderUI();
  }

  function getLevelTitle(lvl) {
    const idx = Math.min(lvl - 1, LEVEL_TITLES.length - 1);
    return LEVEL_TITLES[idx];
  }

  function triggerConfetti() {
    const stage = document.querySelector('.lulu-avatar-stage');
    if (!stage) return;
    for (let i = 0; i < 12; i++) {
      const heart = document.createElement('span');
      heart.className = 'lulu-float-heart';
      heart.innerText = ['❤️', '⭐', '✨', '🍊', '🌸'][Math.floor(Math.random() * 5)];
      heart.style.left = `${20 + Math.random() * 60}%`;
      heart.style.top = `${20 + Math.random() * 40}%`;
      stage.appendChild(heart);
      setTimeout(() => heart.remove(), 1000);
    }
  }

  function renderUI() {
    const title = getLevelTitle(pet.level);
    const expPercent = Math.min(100, Math.round((pet.exp / pet.maxExp) * 100));

    container.innerHTML = `
      <div class="lulu-wrapper">
        <!-- Header status card -->
        <div class="lulu-hero-card">
          <div class="lulu-meta-bar">
            <div class="lulu-profile-head">
              <span class="lulu-level-tag">Cấp ${pet.level}</span>
              <div>
                <h2 class="lulu-name">${pet.name} 🍊</h2>
                <span class="lulu-title-badge">${title}</span>
              </div>
            </div>
            <div class="lulu-exp-box">
              <div class="lulu-exp-labels">
                <span>Kinh nghiệm</span>
                <strong>${pet.exp} / ${pet.maxExp} EXP</strong>
              </div>
              <div class="lulu-progress-bar">
                <i style="width: ${expPercent}%"></i>
              </div>
            </div>
          </div>

          <!-- Main Interactive LuLu Stage -->
          <div class="lulu-stage-container">
            <div class="lulu-speech-bubble" id="luluSpeech">
              <div class="lulu-speech-content">
                <strong class="lulu-speech-zh">${currentQuote.zh}</strong>
                <small class="lulu-speech-py">${currentQuote.py}</small>
                <p class="lulu-speech-vi">${currentQuote.vi}</p>
              </div>
              <button type="button" class="lulu-speech-audio" id="luluSpeakBtn" title="Phát âm câu nói">🔊</button>
            </div>

            <div class="lulu-avatar-stage" id="luluPetTrigger" title="Chạm nhẹ để vuốt ve LuLu!">
              <div class="lulu-halo"></div>
              <video class="lulu-video-player" src="video/lulu_study.mp4" autoplay loop muted playsinline></video>
              <div class="lulu-pet-hint">👆 Chạm vào LuLu để vuốt ve</div>
            </div>

            <!-- Vitals Grid -->
            <div class="lulu-vitals-grid">
              <div class="lulu-vital-item">
                <div class="vital-label"><span>Độ no</span> <strong>${pet.fullness}%</strong></div>
                <div class="vital-track"><b class="vital-fill fullness" style="width: ${pet.fullness}%"></b></div>
              </div>
              <div class="lulu-vital-item">
                <div class="vital-label"><span>Hạnh phúc</span> <strong>${pet.happiness}%</strong></div>
                <div class="vital-track"><b class="vital-fill happiness" style="width: ${pet.happiness}%"></b></div>
              </div>
              <div class="lulu-vital-item">
                <div class="vital-label"><span>Năng lượng</span> <strong>${pet.energy}%</strong></div>
                <div class="vital-track"><b class="vital-fill energy" style="width: ${pet.energy}%"></b></div>
              </div>
            </div>
          </div>
        </div>

        <!-- Action Controls Grid -->
        <div class="lulu-actions-grid">
          <!-- Feed Card -->
          <div class="lulu-action-card">
            <div class="card-head">
              <span class="card-icon">🍎</span>
              <div>
                <h3>Cho LuLu ăn</h3>
                <p>Nạp năng lượng và giúp LuLu nhanh lớn</p>
              </div>
            </div>
            <div class="lulu-food-list">
              ${FOODS.map(f => {
                const count = pet.inventory[f.id] || 0;
                return `
                  <button type="button" class="lulu-food-btn" data-food="${f.id}" ${count <= 0 ? 'disabled' : ''}>
                    <span class="food-emoji">${f.icon}</span>
                    <div class="food-info">
                      <strong>${f.name}</strong>
                      <small>+${f.fullness} no • +${f.exp} EXP</small>
                    </div>
                    <span class="food-count">x${count}</span>
                  </button>
                `;
              }).join('')}
            </div>
          </div>

          <!-- Onsen & Mini Study -->
          <div class="lulu-action-card">
            <div class="card-head">
              <span class="card-icon">♨️</span>
              <div>
                <h3>Suối nước nóng Onsen</h3>
                <p>Capybara ngâm suối nước nóng với quả cam</p>
              </div>
            </div>
            <p class="card-desc">Ngâm mình thư giãn trong suối nước nóng giúp LuLu phục hồi 100% hạnh phúc và thêm năng lượng!</p>
            <button type="button" class="lulu-btn-primary" id="luluBathBtn">♨️ Tắm suối nước nóng (+100% Hạnh phúc)</button>

            <div class="lulu-divider"></div>

            <div class="card-head" style="margin-top: 14px;">
              <span class="card-icon">🎁</span>
              <div>
                <h3>Điểm danh nhận quà</h3>
                <p>Nhận đồ ăn và EXP cho LuLu mỗi ngày</p>
              </div>
            </div>
            <button type="button" class="lulu-btn-secondary" id="luluDailyClaimBtn">🎁 Nhận quà điểm danh (+3 Táo, +2 Cam)</button>
          </div>
        </div>

        <!-- Study with LuLu Flashcard Section -->
        <div class="lulu-study-panel" id="luluStudyPanel">
          <div class="study-head">
            <div class="study-title">
              <span class="study-icon">📖</span>
              <div>
                <h3>Học từ vựng cùng LuLu</h3>
                <p>Trả lời đúng để nhận thêm thức ăn và điểm thưởng!</p>
              </div>
            </div>
            <button type="button" class="lulu-btn-sm" id="luluNewWordBtn">Đổi từ mới ↺</button>
          </div>

          <div class="lulu-quiz-box" id="luluQuizBox">
            <!-- Render quiz dynamically -->
          </div>
        </div>
      </div>
    `;

    bindEvents();
    renderMiniQuiz();
  }

  function bindEvents() {
    // Audio button
    const speakBtn = container.querySelector('#luluSpeakBtn');
    if (speakBtn) {
      speakBtn.addEventListener('click', () => speakText(currentQuote.zh));
    }

    // Ensure video plays
    const video = container.querySelector('.lulu-video-player');
    if (video) {
      video.muted = true;
      video.play().catch(() => {});
    }

    // Pet trigger
    const petTrigger = container.querySelector('#luluPetTrigger');
    if (petTrigger) {
      petTrigger.addEventListener('click', () => {
        pet.happiness = Math.min(100, pet.happiness + 5);
        addExp(3);
        triggerConfetti();

        // Random cute speech
        const nextQuote = LULU_QUOTES[Math.floor(Math.random() * LULU_QUOTES.length)];
        currentQuote = nextQuote;
        const speechZh = container.querySelector('.lulu-speech-zh');
        const speechPy = container.querySelector('.lulu-speech-py');
        const speechVi = container.querySelector('.lulu-speech-vi');
        if (speechZh) speechZh.innerText = nextQuote.zh;
        if (speechPy) speechPy.innerText = nextQuote.py;
        if (speechVi) speechVi.innerText = nextQuote.vi;

        toast?.(' LuLu cảm thấy rất hạnh phúc và thích được bạn xoa đầu!');
      });
    }

    // Feed buttons
    container.querySelectorAll('[data-food]').forEach(btn => {
      btn.addEventListener('click', () => {
        const foodId = btn.dataset.food;
        const food = FOODS.find(f => f.id === foodId);
        if (!food) return;

        if ((pet.inventory[foodId] || 0) <= 0) {
          toast?.(`Bạn đã hết ${food.name}! Hãy trả lời câu hỏi hoặc điểm danh để nhận thêm.`);
          return;
        }

        pet.inventory[foodId] -= 1;
        pet.fullness = Math.min(100, pet.fullness + food.fullness);
        pet.happiness = Math.min(100, pet.happiness + 10);
        pet.totalFed = (pet.totalFed || 0) + 1;
        pet.lastFeedTime = Date.now();

        toast?.(`🍎 LuLu măm măm ${food.name} thật ngon miệng! (+${food.exp} EXP)`);
        speakText(`好吃！${food.zh}`);
        triggerConfetti();

        // Hiệu ứng LuLu ăn bánh bao / thức ăn bằng picture/eat.jpg
        const avatarStage = container.querySelector('#luluPetTrigger');
        if (avatarStage) {
          const videoEl = avatarStage.querySelector('.lulu-video-player');
          const eatImg = document.createElement('img');
          eatImg.className = 'lulu-video-player lulu-eat-anim';
          eatImg.src = 'picture/eat.jpg';
          eatImg.alt = 'LuLu đang ăn';
          if (videoEl) videoEl.style.display = 'none';
          avatarStage.appendChild(eatImg);
          setTimeout(() => {
            eatImg.remove();
            if (videoEl) {
              videoEl.style.display = 'block';
              videoEl.play().catch(() => {});
            }
          }, 2400);
        }

        addExp(food.exp);
      });
    });

    // Bath button
    const bathBtn = container.querySelector('#luluBathBtn');
    if (bathBtn) {
      bathBtn.addEventListener('click', () => {
        pet.happiness = 100;
        pet.energy = Math.min(100, pet.energy + 30);
        triggerConfetti();
        currentQuote = {
          zh: '温泉太舒服啦，头上放个橙子刚刚好！',
          py: 'Wēnquán tài shūfu la, tóushàng fàng gè chéngzi gānggāng hǎo!',
          vi: 'Suối nước nóng thoải mái quá, để quả cam trên đầu là chuẩn bài!'
        };
        addExp(15);
        toast?.('♨️ LuLu đã ngâm suối nước nóng thỏa thích! Hạnh phúc đạt 100%!');
        speakText('好舒服呀！');
      });
    }

    // Daily claim button
    const claimBtn = container.querySelector('#luluDailyClaimBtn');
    if (claimBtn) {
      claimBtn.addEventListener('click', () => {
        const today = new Date().toDateString();
        if (pet.lastClaimDate === today) {
          toast?.('Hôm nay bạn đã nhận quà điểm danh rồi. Hãy quay lại vào ngày mai nhé!');
          return;
        }

        pet.lastClaimDate = today;
        pet.inventory.apple = (pet.inventory.apple || 0) + 3;
        pet.inventory.orange = (pet.inventory.orange || 0) + 2;
        pet.inventory.watermelon = (pet.inventory.watermelon || 0) + 1;
        addExp(50);
        triggerConfetti();
        toast?.('🎁 Điểm danh thành công! Nhận +3 Táo, +2 Cam, +1 Dưa hấu và +50 EXP!');
      });
    }

    // New word button
    const newWordBtn = container.querySelector('#luluNewWordBtn');
    if (newWordBtn) {
      newWordBtn.addEventListener('click', () => renderMiniQuiz());
    }
  }

  function renderMiniQuiz() {
    const quizBox = container.querySelector('#luluQuizBox');
    if (!quizBox) return;

    currentQuiz = MINI_VOCAB[Math.floor(Math.random() * MINI_VOCAB.length)];
    const shuffledOpts = [...currentQuiz.opts].sort(() => Math.random() - 0.5);

    quizBox.innerHTML = `
      <div class="quiz-question-row">
        <div class="quiz-prompt">
          <strong class="quiz-zh">${currentQuiz.zh}</strong>
          <span class="quiz-py">${currentQuiz.py}</span>
        </div>
        <button type="button" class="quiz-listen-btn" id="quizSpeakBtn" title="Nghe phát âm">🔊</button>
      </div>
      <p class="quiz-instruction">Chọn nghĩa tiếng Việt chính xác của từ trên:</p>
      <div class="quiz-options-grid">
        ${shuffledOpts.map(opt => `
          <button type="button" class="quiz-opt-btn" data-answer="${opt}">${opt}</button>
        `).join('')}
      </div>
    `;

    const qSpeakBtn = quizBox.querySelector('#quizSpeakBtn');
    if (qSpeakBtn) {
      qSpeakBtn.addEventListener('click', () => speakText(currentQuiz.zh));
    }

    quizBox.querySelectorAll('.quiz-opt-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const chosen = btn.dataset.answer;
        const isCorrect = chosen === currentQuiz.vi;

        quizBox.querySelectorAll('.quiz-opt-btn').forEach(b => {
          b.disabled = true;
          if (b.dataset.answer === currentQuiz.vi) b.classList.add('correct');
          else if (b === btn) b.classList.add('wrong');
        });

        if (isCorrect) {
          toast?.('🎉 Chính xác! LuLu tặng bạn 1 quả Cam 🍊 và +15 điểm thành tích!');
          pet.inventory.orange = (pet.inventory.orange || 0) + 1;
          addExp(25);
          triggerConfetti();
          speakText('答对了，太棒了！');

          // Ghi điểm lên bảng xếp hạng
          recordScore({
            category: 'game',
            points: 15,
            description: 'Học từ vựng cùng LuLu'
          });
        } else {
          toast?.(`Chưa chính xác rồi. Đáp án đúng là: "${currentQuiz.vi}"`);
          speakText('再试一次吧！');
        }

        setTimeout(() => {
          renderMiniQuiz();
        }, 2200);
      });
    });
  }

  renderUI();
}
