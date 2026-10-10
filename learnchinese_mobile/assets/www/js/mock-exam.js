import { recordScore, SCORE_RULES } from './score-service.js';
import { awardLuluExp } from './lulu.js';

// Danh sách đề thi hiển thị ngoài Lobby
export const mockExams = [
  {
    id: 'hsk-1',
    title: 'Đề thi thử HSK 1 - Chuẩn 4 kỹ năng',
    sections: 4,
    questions: 20,
    duration: 35,
    skills: ['🎧 Nghe', '📖 Đọc', '✍️ Viết', '🎙️ Nói'],
    badge: 'Chuẩn 4 kỹ năng ⭐',
    expReward: 100,
    available: true
  },
  {
    id: 'hsk-2',
    title: 'Đề thi thử HSK 2 - Chuẩn 4 kỹ năng',
    sections: 4,
    questions: 20,
    duration: 40,
    skills: ['🎧 Nghe', '📖 Đọc', '✍️ Viết', '🎙️ Nói'],
    badge: 'Chuẩn 4 kỹ năng ⭐',
    expReward: 120,
    available: true
  },
  {
    id: 'hsk-3',
    title: 'Đề thi thử HSK 3 - Chuẩn 4 kỹ năng',
    sections: 4,
    questions: 20,
    duration: 45,
    skills: ['🎧 Nghe', '📖 Đọc', '✍️ Viết', '🎙️ Nói'],
    badge: 'Chuẩn 4 kỹ năng ⭐',
    expReward: 150,
    available: true
  },
  {
    id: 'hsk-4',
    title: 'Đề thi thử HSK 4 - Chuẩn 4 kỹ năng',
    sections: 4,
    questions: 20,
    duration: 50,
    skills: ['🎧 Nghe', '📖 Đọc', '✍️ Viết', '🎙️ Nói'],
    badge: 'Chuẩn 4 kỹ năng ⭐',
    expReward: 180,
    available: true
  }
];

// ==========================================
// 1. DỮ LIỆU ĐỀ THI HSK 1
// ==========================================
export const HSK1_EXAM_DATA = {
  id: 'hsk-1',
  title: 'Đề thi thử HSK 1 - Chuẩn 4 kỹ năng',
  subtitle: 'Nghe hiểu (听力) • Đọc hiểu (阅读) • Viết (书写) • Nói (口语)',
  durationMinutes: 35,
  totalQuestions: 20,
  passScore: 60,
  expReward: 100,
  sections: [
    {
      id: 'listening',
      name: 'Nghe hiểu (听力)',
      icon: '🎧',
      desc: 'Nghe audio phát âm chuẩn và chọn đáp án chính xác',
      questions: [
        {
          id: 1,
          sectionId: 'listening',
          type: 'true_false',
          audioText: '飞机',
          pinyin: 'fēijī',
          visual: '✈️',
          visualLabel: 'Máy bay',
          prompt: 'Nghe từ được phát và xác định có khớp với hình ảnh bên dưới không:',
          correctAnswer: true,
          explanation: 'Audio phát âm "飞机" (fēijī), có nghĩa là máy bay, hoàn toàn khớp với hình ảnh ✈️.'
        },
        {
          id: 2,
          sectionId: 'listening',
          type: 'true_false',
          audioText: '他在看书。',
          pinyin: 'Tā zài kànshū.',
          visual: '📖',
          visualLabel: 'Đang đọc sách',
          prompt: 'Nghe câu nói và xác định câu này Đúng (√) hay Sai (×) so với hình ảnh:',
          correctAnswer: true,
          explanation: 'Audio phát âm "他在看书" (Anh ấy đang đọc sách), khớp với hình ảnh người đang xem sách.'
        },
        {
          id: 3,
          sectionId: 'listening',
          type: 'multiple_choice',
          audioText: '我想喝一杯茶。',
          pinyin: 'Wǒ xiǎng hē yì bēi chá.',
          prompt: 'Nghe câu nói và chọn hình ảnh / đáp án phù hợp nhất:',
          options: [
            { id: 'A', text: '🍵 一杯茶 (Một cốc trà)', icon: '🍵' },
            { id: 'B', text: '🍎 几个苹果 (Mấy quả táo)', icon: '🍎' },
            { id: 'C', text: '🍚 一碗米饭 (Một bát cơm)', icon: '🍚' }
          ],
          correctAnswer: 'A',
          explanation: 'Audio phát âm: "我想喝一杯茶" (Tôi muốn uống một cốc trà). Do đó đáp án chính xác là A.'
        },
        {
          id: 4,
          sectionId: 'listening',
          type: 'multiple_choice',
          audioText: '男：请问，现在几点了？\n女：现在下午三点。',
          audioSpeech: '请问，现在几点了？现在下午三点。',
          pinyin: 'Nán: Qǐngwèn, xiànzài jǐ diǎn le? \nNǚ: Xiànzài xiàwǔ sān diǎn.',
          prompt: 'Nghe đoạn đối thoại ngắn và trả lời: 现在几点了？(Bây giờ mấy giờ?)',
          options: [
            { id: 'A', text: '上午 10:00 (10 giờ sáng)' },
            { id: 'B', text: '下午 3:00 (15:00 - 3 giờ chiều)' },
            { id: 'C', text: '晚上 8:00 (20:00 - 8 giờ tối)' }
          ],
          correctAnswer: 'B',
          explanation: 'Nhân vật nữ trả lời: "现在下午三点" (Bây giờ là 3 giờ chiều / 15:00). Đáp án là B.'
        },
        {
          id: 5,
          sectionId: 'listening',
          type: 'multiple_choice',
          audioText: '明天天气很好，我们去商店买东西吧。',
          pinyin: 'Míngtiān tiānqì hěn hǎo, wǒmen qù shāngdiàn mǎi dōngxi ba.',
          prompt: 'Nghe câu nói và trả lời: 他们明天想去哪儿？(Ngày mai họ muốn đi đâu?)',
          options: [
            { id: 'A', text: '医院 (yīyuàn - Bệnh viện)' },
            { id: 'B', text: '学校 (xuéxiào - Trường học)' },
            { id: 'C', text: '商店 (shāngdiàn - Cửa hàng)' }
          ],
          correctAnswer: 'C',
          explanation: 'Trong câu có cụm từ "去商店买东西" (Đi cửa hàng mua đồ). Đáp án đúng là C.'
        }
      ]
    },
    {
      id: 'reading',
      name: 'Đọc hiểu (阅读)',
      icon: '📖',
      desc: 'Đọc chữ Hán, đối chiếu ngữ cảnh và chọn câu trả lời đúng',
      questions: [
        {
          id: 6,
          sectionId: 'reading',
          type: 'true_false',
          hanziText: '看医生',
          pinyin: 'kàn yīshēng',
          meaning: 'Khám bác sĩ',
          visual: '👨‍⚕️',
          visualLabel: 'Bác sĩ',
          prompt: 'Xem từ và biểu tượng hình ảnh bên dưới, phán đoán Đúng (√) hay Sai (×):',
          correctAnswer: true,
          explanation: '"看医生" (kàn yīshēng) nghĩa là đi khám bác sĩ, hình ảnh thể hiện bác sĩ 👨‍⚕️ nên đây là nhận định Đúng (√).'
        },
        {
          id: 7,
          sectionId: 'reading',
          type: 'true_false',
          hanziText: '苹果',
          pinyin: 'píngguǒ',
          meaning: 'Quả táo',
          visual: '🚗',
          visualLabel: 'Xe hơi (车 / 出租车)',
          prompt: 'Xem từ và biểu tượng hình ảnh bên dưới, phán đoán Đúng (√) hay Sai (×):',
          correctAnswer: false,
          explanation: '"苹果" (píngguǒ) nghĩa là quả táo, trong khi hình ảnh là chiếc ô tô (车/出租车) nên nhận định này Sai (×).'
        },
        {
          id: 8,
          sectionId: 'reading',
          type: 'multiple_choice',
          hanziText: '你认识李小姐吗？',
          pinyin: 'Nǐ rènshi Lǐ xiǎojiě ma?',
          meaning: 'Bạn có quen cô Lý không?',
          prompt: 'Chọn câu đáp lại phù hợp nhất theo ngữ cảnh giao tiếp:',
          options: [
            { id: 'A', text: '认识，她是我的大学同学。(Quen chứ, cô ấy là bạn học đại học của tôi.)' },
            { id: 'B', text: '今天天气很冷，我不喜欢。(Hôm nay trời rất lạnh, tôi không thích.)' },
            { id: 'C', text: '我喜欢吃中国菜。(Tôi thích ăn món ăn Trung Quốc.)' }
          ],
          correctAnswer: 'A',
          explanation: 'Câu hỏi là "你认识...吗？" (Bạn có quen biết... không?), câu trả lời thích hợp là "认识..." (Quen chứ...).'
        },
        {
          id: 9,
          sectionId: 'reading',
          type: 'multiple_choice',
          hanziText: '桌子上有两本______，是汉语书。',
          pinyin: 'Zhuōzi shang yǒu liǎng běn ______ , shì hànyǔ shū.',
          meaning: 'Trên bàn có hai cuốn ______, là sách tiếng Trung.',
          prompt: 'Chọn danh từ phù hợp nhất điền vào chỗ trống:',
          options: [
            { id: 'A', text: '书 (shū - Sách)' },
            { id: 'B', text: '块 (kuài - Miếng/Đồng tiền)' },
            { id: 'C', text: '只 (zhī - Con/Chiếc)' }
          ],
          correctAnswer: 'A',
          explanation: 'Lượng từ "本" (cuốn/quyển) đi kèm danh từ "书" (sách), vế sau giải thích "是汉语书" (là sách tiếng Trung).'
        },
        {
          id: 10,
          sectionId: 'reading',
          type: 'multiple_choice',
          passage: '我叫王明。我有两只小猫，一只叫小白，一只叫小黑。我很喜欢它们。',
          passagePinyin: 'Wǒ jiào Wáng Míng. Wǒ yǒu liǎng zhī xiǎomāo, yì zhī jiào Xiǎobái, yì zhī jiào Xiǎohēi. Wǒ hěn xǐhuan tāmen.',
          prompt: 'Đọc đoạn văn ngắn trên và trả lời câu hỏi: 王明有几只猫？(Vương Minh có mấy con mèo?)',
          options: [
            { id: 'A', text: '一只 (1 con)' },
            { id: 'B', text: '两只 (2 con)' },
            { id: 'C', text: '三只 (3 con)' }
          ],
          correctAnswer: 'B',
          explanation: 'Trong đoạn văn ghi rõ: "我有两只小猫" (Tôi có hai con mèo con). Đáp án là B.'
        }
      ]
    },
    {
      id: 'writing',
      name: 'Viết (书写)',
      icon: '✍️',
      desc: 'Sắp xếp trật tự từ thành câu và điền chữ Hán chuẩn ngữ pháp',
      questions: [
        {
          id: 11,
          sectionId: 'writing',
          type: 'word_order',
          chips: ['他是', '汉语', '老师', '我的'],
          targetSentence: '他是我的汉语老师',
          alternatives: ['我的汉语老师是他'],
          prompt: 'Chạm vào các từ bên dưới để sắp xếp thành câu hoàn chỉnh đúng ngữ pháp:',
          meaning: 'Anh ấy là giáo viên tiếng Trung của tôi.',
          explanation: 'Cấu trúc câu khẳng định với "是": Chủ ngữ (他是) + Định ngữ (我的) + Trung tâm ngữ (汉语老师).'
        },
        {
          id: 12,
          sectionId: 'writing',
          type: 'word_order',
          chips: ['多大', '你儿子', '了', '今年'],
          targetSentence: '你儿子今年多大了',
          alternatives: ['今年你儿子多大了'],
          prompt: 'Sắp xếp các từ thành câu hỏi tuổi chuẩn tiếng Trung:',
          meaning: 'Con trai bạn năm nay bao nhiêu tuổi rồi?',
          explanation: 'Mẫu câu hỏi tuổi: Chủ ngữ (你儿子) + Thời gian (今年) + 多大了? -> "你儿子今年多大了".'
        },
        {
          id: 13,
          sectionId: 'writing',
          type: 'word_order',
          chips: ['去学校', '坐出租车', '我们'],
          targetSentence: '我们坐出租车去学校',
          alternatives: [],
          prompt: 'Sắp xếp các cụm từ diễn tả phương thức di chuyển:',
          meaning: 'Chúng tôi đi taxi đến trường.',
          explanation: 'Cấu trúc câu liên động chỉ phương tiện: Chủ ngữ (我们) + Cách thức (坐出租车) + Đến nơi (去学校).'
        },
        {
          id: 14,
          sectionId: 'writing',
          type: 'multiple_choice',
          hanziText: '你会说 (hànyǔ) ______ 吗？',
          prompt: 'Nhìn Pinyin trong ngoặc, chọn chữ Hán viết đúng chính tả:',
          options: [
            { id: 'A', text: '汉语 (hànyǔ - Tiếng Trung)' },
            { id: 'B', text: '汉字 (hànzì - Chữ Hán)' },
            { id: 'C', text: '朋友 (péngyou - Bạn bè)' }
          ],
          correctAnswer: 'A',
          explanation: 'Pinyin (hànyǔ) tương ứng chữ Hán "汉语". Câu hoàn chỉnh: "你会说汉语吗？" (Bạn biết nói tiếng Trung không?).'
        },
        {
          id: 15,
          sectionId: 'writing',
          type: 'multiple_choice',
          hanziText: '这是谁的 (shǒujī) ______？',
          prompt: 'Nhìn Pinyin trong ngoặc, chọn chữ Hán chính xác:',
          options: [
            { id: 'A', text: '手机 (shǒujī - Điện thoại di động)' },
            { id: 'B', text: '电脑 (diànnǎo - Máy tính)' },
            { id: 'C', text: '电视 (diànshì - Ti vi)' }
          ],
          correctAnswer: 'A',
          explanation: 'Pinyin (shǒujī) tương ứng chữ Hán "手机". Câu hoàn chỉnh: "这是谁的手机？" (Đây là điện thoại của ai?).'
        }
      ]
    },
    {
      id: 'speaking',
      name: 'Nói (口语)',
      icon: '🎙️',
      desc: 'Luyện phát âm chuẩn và phản xạ giao tiếp theo chuẩn HSKK Sơ cấp',
      questions: [
        {
          id: 16,
          sectionId: 'speaking',
          type: 'speech',
          targetSpeech: '你好，很高兴认识你！',
          targetPinyin: 'Nǐ hǎo, hěn gāoxìng rènshí nǐ!',
          targetMeaning: 'Chào bạn, rất vui được làm quen với bạn!',
          prompt: 'Bấm nghe câu mẫu, sau đó bấm nút Micro để đọc lại câu:',
          expectedKeywords: ['你好', '高兴', '认识'],
          explanation: 'Câu chào hỏi và làm quen thông dụng: "你好" (Chào bạn) + "很高兴认识你" (Rất vui được quen bạn).'
        },
        {
          id: 17,
          sectionId: 'speaking',
          type: 'speech',
          targetSpeech: '谢谢你，不客气！',
          targetPinyin: 'Xièxie nǐ, bú kèqi!',
          targetMeaning: 'Cảm ơn bạn, không có gì!',
          prompt: 'Nghe mẫu và phát âm rõ ràng câu cảm ơn cùng lời đáp lễ:',
          expectedKeywords: ['谢谢', '不客气'],
          explanation: 'Cặp câu giao tiếp lịch sự kinh điển trong HSK 1: "谢谢你" (Cảm ơn) và "不客气" (Đừng khách sáo/Không có gì).'
        },
        {
          id: 18,
          sectionId: 'speaking',
          type: 'speech',
          questionAudio: '你喜欢吃中国菜吗？',
          questionPinyin: 'Nǐ xǐhuan chī Zhōngguó cài ma?',
          questionMeaning: 'Bạn có thích ăn món ăn Trung Quốc không?',
          sampleAnswer: '我很喜欢吃中国菜。',
          samplePinyin: 'Wǒ hěn xǐhuan chī Zhōngguó cài.',
          sampleMeaning: 'Tôi rất thích ăn món Trung Quốc.',
          prompt: 'Nghe câu hỏi và nói câu trả lời của bạn vào micro:',
          expectedKeywords: ['喜欢', '中国菜', '不'],
          explanation: 'Có thể trả lời khẳng định "我很喜欢吃中国菜" hoặc phủ định "我不喜欢吃中国菜".'
        },
        {
          id: 19,
          sectionId: 'speaking',
          type: 'speech',
          questionAudio: '今天星期几？',
          questionPinyin: 'Jīntiān xīngqī jǐ?',
          questionMeaning: 'Hôm nay là thứ mấy?',
          sampleAnswer: '今天星期一。',
          samplePinyin: 'Jīntiān xīngqī yī.',
          sampleMeaning: 'Hôm nay là thứ hai (hoặc thứ bất kỳ).',
          prompt: 'Nghe câu hỏi về thứ trong tuần và nói câu trả lời:',
          expectedKeywords: ['今天', '星期'],
          explanation: 'Cấu trúc trả lời thứ: "今天星期..." + số từ (一, 二, 三, 四, 五, 六, 天/日).'
        },
        {
          id: 20,
          sectionId: 'speaking',
          type: 'speech',
          targetSpeech: '我叫李明，我是学生，我在学中文。',
          targetPinyin: 'Wǒ jiào Lǐ Míng, wǒ shì xuésheng, wǒ zài xué Zhōngwén.',
          targetMeaning: 'Tôi tên Lý Minh, tôi là học sinh, tôi đang học tiếng Trung.',
          prompt: 'Đọc lưu loát đoạn giới thiệu bản thân 3 vế sau:',
          expectedKeywords: ['我叫', '学生', '中文'],
          explanation: 'Đoạn giới thiệu bản thân chuẩn mực bao gồm họ tên, nghề nghiệp và mục tiêu học tập.'
        }
      ]
    }
  ]
};

// ==========================================
// 2. DỮ LIỆU ĐỀ THI HSK 2
// ==========================================
export const HSK2_EXAM_DATA = {
  id: 'hsk-2',
  title: 'Đề thi thử HSK 2 - Chuẩn 4 kỹ năng',
  subtitle: 'Nghe hiểu (听力) • Đọc hiểu (阅读) • Viết (书写) • Nói (口语)',
  durationMinutes: 40,
  totalQuestions: 20,
  passScore: 60,
  expReward: 120,
  sections: [
    {
      id: 'listening',
      name: 'Nghe hiểu (听力)',
      icon: '🎧',
      desc: 'Nghe đoạn hội thoại, tình huống hàng ngày và chọn đáp án chính xác',
      questions: [
        {
          id: 1,
          sectionId: 'listening',
          type: 'true_false',
          audioText: '我正在跑步呢。',
          pinyin: 'Wǒ zhèngzài pǎobù ne.',
          visual: '🏃‍♂️',
          visualLabel: 'Đang chạy bộ',
          prompt: 'Nghe câu nói và xác định có khớp với hình ảnh bên dưới không:',
          correctAnswer: true,
          explanation: 'Audio nói "我正在跑步呢" (Tôi đang chạy bộ đấy), hoàn toàn khớp với hình 🏃‍♂️.'
        },
        {
          id: 2,
          sectionId: 'listening',
          type: 'true_false',
          audioText: '服务员，请给我一杯温水。',
          pinyin: 'Fúwùyuán, qǐng gěi wǒ yì bēi wēnshuǐ.',
          visual: '🏊‍♂️',
          visualLabel: 'Bơi lội',
          prompt: 'Nghe câu nói và xác định câu này Đúng (√) hay Sai (×) so với hình ảnh:',
          correctAnswer: false,
          explanation: 'Audio là câu gọi nước uống "请给我一杯温水" (Cho tôi xin cốc nước ấm), hình ảnh lại là bơi lội nên nhận định này Sai (×).'
        },
        {
          id: 3,
          sectionId: 'listening',
          type: 'multiple_choice',
          audioText: '这件红色的衣服太贵了，我想买那件便宜一点儿的。',
          pinyin: 'Zhè jiàn hóngsè de yīfu tài guì le, wǒ xiǎng mǎi nà jiàn piányi yìdiǎnr de.',
          prompt: 'Nghe câu nói và trả lời: 她想买什么样的衣服？(Cô ấy muốn mua bộ quần áo như thế nào?)',
          options: [
            { id: 'A', text: '便宜一点儿的 (Rẻ hơn một chút)' },
            { id: 'B', text: '最贵的 (Đắt nhất)' },
            { id: 'C', text: '红色的 (Màu đỏ)' }
          ],
          correctAnswer: 'A',
          explanation: 'Nhân vật nói "我想买那件便宜一点儿的" (Tôi muốn mua bộ kia rẻ hơn một chút). Đáp án là A.'
        },
        {
          id: 4,
          sectionId: 'listening',
          type: 'multiple_choice',
          audioText: '男：你生病了？要不要去医院？\n女：没事，吃过药了，已经好多了。',
          audioSpeech: '你生病了？要不要去医院？没事，吃过药了，已经好多了。',
          pinyin: 'Nán: Nǐ shēngbìng le? Yào bu yào qù yīyuàn? \nNǚ: Méi shì, chī guò yào le, yǐjīng hǎo duō le.',
          prompt: 'Nghe đoạn hội thoại và trả lời: 女的现在怎么样了？(Người nữ bây giờ thế nào rồi?)',
          options: [
            { id: 'A', text: '已经好多了 (Đã đỡ nhiều rồi)' },
            { id: 'B', text: '正在去医院 (Đang đi bệnh viện)' },
            { id: 'C', text: '病情更严重了 (Bệnh nặng hơn)' }
          ],
          correctAnswer: 'A',
          explanation: 'Người nữ trả lời "吃过药了，已经好多了" (Uống thuốc rồi, đã đỡ nhiều rồi). Đáp án là A.'
        },
        {
          id: 5,
          sectionId: 'listening',
          type: 'multiple_choice',
          audioText: '男：外面下雨了，你带伞了吗？\n女：没有，不过哥哥会开车来接我。',
          audioSpeech: '外面下雨了，你带伞了吗？没有，不过哥哥会开车来接我。',
          pinyin: 'Nán: Wàimiàn xià yǔ le, nǐ dài sǎn le ma? \nNǚ: Méiyǒu, búguò gēge huì kāichē lái jiē wǒ.',
          prompt: 'Nghe đoạn hội thoại và trả lời: 女的怎么回家？(Người nữ về nhà bằng cách nào?)',
          options: [
            { id: 'A', text: '坐哥哥开的车 (Đi xe anh trai lái đón)' },
            { id: 'B', text: '自己走路 (Tự đi bộ về)' },
            { id: 'C', text: '坐公共汽车 (Đi xe buýt)' }
          ],
          correctAnswer: 'A',
          explanation: 'Cô gái trả lời: "哥哥会开车来接我" (Anh trai sẽ lái xe đến đón tôi). Đáp án là A.'
        }
      ]
    },
    {
      id: 'reading',
      name: 'Đọc hiểu (阅读)',
      icon: '📖',
      desc: 'Đọc hiểu ngữ cảnh HSK 2, liên từ và cấu trúc so sánh',
      questions: [
        {
          id: 6,
          sectionId: 'reading',
          type: 'true_false',
          hanziText: '游泳',
          pinyin: 'yóuyǒng',
          meaning: 'Bơi lội',
          visual: '🏊‍♂️',
          visualLabel: 'Bơi lội',
          prompt: 'Xem từ và biểu tượng hình ảnh bên dưới, phán đoán Đúng (√) hay Sai (×):',
          correctAnswer: true,
          explanation: '"游泳" (yóuyǒng) nghĩa là bơi lội, hoàn toàn khớp với biểu tượng 🏊‍♂️.'
        },
        {
          id: 7,
          sectionId: 'reading',
          type: 'true_false',
          hanziText: '晴天',
          pinyin: 'qíngtiān',
          meaning: 'Trời nắng ráo',
          visual: '🌧️',
          visualLabel: 'Trời mưa bão',
          prompt: 'Xem từ và biểu tượng hình ảnh bên dưới, phán đoán Đúng (√) hay Sai (×):',
          correctAnswer: false,
          explanation: '"晴天" (qíngtiān) là ngày trời nắng quang đãng, trong khi hình ảnh là trời mưa (下雨/阴天) nên nhận định này Sai (×).'
        },
        {
          id: 8,
          sectionId: 'reading',
          type: 'multiple_choice',
          hanziText: '你每天早上几点起床？',
          pinyin: 'Nǐ měitiān zǎoshang jǐ diǎn qǐchuáng?',
          meaning: 'Mỗi sáng bạn thức dậy lúc mấy giờ?',
          prompt: 'Chọn câu đáp lại logic nhất trong giao tiếp:',
          options: [
            { id: 'A', text: '我六点半起床。(Tôi thức dậy lúc sáu giờ rưỡi.)' },
            { id: 'B', text: '我正在看电视呢。(Tôi đang xem tivi.)' },
            { id: 'C', text: '我去过北京两次。(Tôi từng đi Bắc Kinh hai lần.)' }
          ],
          correctAnswer: 'A',
          explanation: 'Câu hỏi hỏi về giờ giấc thức dậy ("几点起床？"), câu trả lời thời gian tương ứng là A ("六点半起床").'
        },
        {
          id: 9,
          sectionId: 'reading',
          type: 'multiple_choice',
          hanziText: '请问，去火车站怎么______？',
          pinyin: 'Qǐngwèn, qù huǒchēzhàn zěnme ______ ?',
          meaning: 'Xin hỏi, đi ga tàu hỏa đi như thế nào?',
          prompt: 'Chọn động từ thích hợp điền vào chỗ trống hỏi đường:',
          options: [
            { id: 'A', text: '走 (zǒu - Đi lại / Di chuyển)' },
            { id: 'B', text: '吃 (chī - Ăn)' },
            { id: 'C', text: '喝 (hē - Uống)' }
          ],
          correctAnswer: 'A',
          explanation: 'Cụm từ hỏi đường kinh điển trong tiếng Trung là "...怎么走？" (Đi đến đó như thế nào?).'
        },
        {
          id: 10,
          sectionId: 'reading',
          type: 'multiple_choice',
          passage: '虽然今天工作很累，但是我很高兴，因为我帮助了很多人。',
          passagePinyin: 'Suīrán jīntiān gōngzuò hěn lèi, dànshì wǒ hěn gāoxìng, yīnwèi wǒ bāngzhù le hěn duō rén.',
          prompt: 'Đọc đoạn văn trên và trả lời: 他今天为什么高兴？(Tại sao hôm nay anh ấy vui?)',
          options: [
            { id: 'A', text: '因为帮助了很多人 (Bởi vì đã giúp đỡ nhiều người)' },
            { id: 'B', text: '因为不用去工作 (Bởi vì không phải đi làm)' },
            { id: 'C', text: '因为买了很多新衣服 (Bởi vì đã mua nhiều quần áo mới)' }
          ],
          correctAnswer: 'A',
          explanation: 'Trong bài có câu: "因为我帮助了很多人" (Bởi vì tôi đã giúp đỡ được rất nhiều người). Đáp án là A.'
        }
      ]
    },
    {
      id: 'writing',
      name: 'Viết (书写)',
      icon: '✍️',
      desc: 'Cấu trúc so sánh 比, câu phủ định 别 và từ vựng HSK 2',
      questions: [
        {
          id: 11,
          sectionId: 'writing',
          type: 'word_order',
          chips: ['比', '我', '弟弟', '高'],
          targetSentence: '弟弟比我高',
          alternatives: ['我比弟弟高'],
          prompt: 'Sắp xếp các từ thành câu so sánh hơn với chữ "比":',
          meaning: 'Em trai cao hơn tôi (hoặc Tôi cao hơn em trai).',
          explanation: 'Cấu trúc so sánh chữ 比: A + 比 + B + Tính từ (弟弟比我高).'
        },
        {
          id: 12,
          sectionId: 'writing',
          type: 'word_order',
          chips: ['你', '去过', '北京', '吗'],
          targetSentence: '你去过北京吗',
          alternatives: [],
          prompt: 'Sắp xếp câu hỏi trải nghiệm với trợ từ "过":',
          meaning: 'Bạn đã từng đi Bắc Kinh chưa?',
          explanation: 'Cấu trúc câu trải nghiệm: Chủ ngữ (你) + Động từ + 过 (去过) + Tân ngữ (北京) + Trợ từ nghi vấn (吗).'
        },
        {
          id: 13,
          sectionId: 'writing',
          type: 'word_order',
          chips: ['请', '不要', '在教室里', '说话'],
          targetSentence: '请不要在教室里说话',
          alternatives: [],
          prompt: 'Sắp xếp câu khuyên nhủ lịch sự:',
          meaning: 'Xin đừng nói chuyện trong lớp học.',
          explanation: 'Cấu trúc: 请 + 不要 + [Trạng ngữ chỉ nơi chốn: 在教室里] + Động từ (说话).'
        },
        {
          id: 14,
          sectionId: 'writing',
          type: 'multiple_choice',
          hanziText: '他每天早上都跑步，(shēntǐ) ______ 很好。',
          prompt: 'Nhìn Pinyin trong ngoặc, chọn chữ Hán đúng:',
          options: [
            { id: 'A', text: '身体 (shēntǐ - Sức khỏe / Cơ thể)' },
            { id: 'B', text: '时间 (shíjiān - Thời gian)' },
            { id: 'C', text: '事情 (shìqing - Sự việc)' }
          ],
          correctAnswer: 'A',
          explanation: 'Pinyin (shēntǐ) viết là "身体" (sức khỏe tốt: 身体很好).'
        },
        {
          id: 15,
          sectionId: 'writing',
          type: 'multiple_choice',
          hanziText: '我希望能去中国 (lǚyóu) ______。',
          prompt: 'Nhìn Pinyin trong ngoặc, chọn chữ Hán đúng:',
          options: [
            { id: 'A', text: '旅游 (lǚyóu - Đi du lịch)' },
            { id: 'B', text: '运动 (yùndòng - Vận động / Thể thao)' },
            { id: 'C', text: '准备 (zhǔnbèi - Chuẩn bị)' }
          ],
          correctAnswer: 'A',
          explanation: 'Pinyin (lǚyóu) tương ứng chữ Hán "旅游" (du lịch).'
        }
      ]
    },
    {
      id: 'speaking',
      name: 'Nói (口语)',
      icon: '🎙️',
      desc: 'Phát âm câu ghép HSK 2 và trả lời các tình huống đời sống',
      questions: [
        {
          id: 16,
          sectionId: 'speaking',
          type: 'speech',
          targetSpeech: '外面下雨了，别忘了带雨伞。',
          targetPinyin: 'Wàimiàn xià yǔ le, bié wàng le dài yǔsǎn.',
          targetMeaning: 'Bên ngoài mưa rồi, đừng quên mang ô nhé.',
          prompt: 'Nghe câu mẫu và phát âm to rõ ràng câu nhắc nhở:',
          expectedKeywords: ['外面', '下雨', '雨伞'],
          explanation: 'Câu nhắc nhở thông dụng dùng phó từ "别" (đừng): 别忘了带雨伞.'
        },
        {
          id: 17,
          sectionId: 'speaking',
          type: 'speech',
          targetSpeech: '今天比昨天冷多了，多穿点儿衣服吧。',
          targetPinyin: 'Jīntiān bǐ zuótiān lěng duō le, duō chuān diǎnr yīfu ba.',
          targetMeaning: 'Hôm nay lạnh hơn hôm qua nhiều, mặc thêm áo đi nhé.',
          prompt: 'Luyện nói câu so sánh thời tiết:',
          expectedKeywords: ['今天', '昨天', '冷', '衣服'],
          explanation: 'Cấu trúc so sánh có bổ ngữ mức độ: "今天比昨天冷多了".'
        },
        {
          id: 18,
          sectionId: 'speaking',
          type: 'speech',
          questionAudio: '你最喜欢什么运动？',
          questionPinyin: 'Nǐ zuì xǐhuan shénme yùndòng?',
          questionMeaning: 'Bạn thích môn thể thao nào nhất?',
          sampleAnswer: '我最喜欢游泳。',
          samplePinyin: 'Wǒ zuì xǐhuan yóuyǒng.',
          sampleMeaning: 'Tôi thích bơi lội nhất (hoặc跑步, 打篮球).',
          prompt: 'Nghe câu hỏi và nói câu trả lời sở thích thể thao của bạn:',
          expectedKeywords: ['最喜欢', '游泳', '跑步', '打篮球', '运动'],
          explanation: 'Mẫu câu trả lời sở thích: "我最喜欢..." + tên môn thể thao.'
        },
        {
          id: 19,
          sectionId: 'speaking',
          type: 'speech',
          questionAudio: '你怎么去上班？',
          questionPinyin: 'Nǐ zěnme qù shàngbān?',
          questionMeaning: 'Bạn đi làm bằng phương tiện gì?',
          sampleAnswer: '我坐地铁去上班。',
          samplePinyin: 'Wǒ zuò dìtiě qù shàngbān.',
          sampleMeaning: 'Tôi đi tàu điện ngầm đi làm (hoặc 开车, 骑自行车).',
          prompt: 'Nghe câu hỏi và nói phương tiện đi làm / đi học:',
          expectedKeywords: ['上班', '坐', '地铁', '开车', '骑车', '公交'],
          explanation: 'Mẫu câu chỉ phương thức di chuyển: "我坐/骑/开..." + Phương tiện + 去 + Nơi chốn.'
        },
        {
          id: 20,
          sectionId: 'speaking',
          type: 'speech',
          targetSpeech: '我叫王朋，我喜欢打篮球，也喜欢听音乐。',
          targetPinyin: 'Wǒ jiào Wáng Péng, wǒ xǐhuan dǎ lánqiú, yě xǐhuan tīng yīnyuè.',
          targetMeaning: 'Tôi tên Vương Bằng, tôi thích chơi bóng rổ và cũng thích nghe nhạc.',
          prompt: 'Đọc lưu loát đoạn giới thiệu sở thích cá nhân:',
          expectedKeywords: ['我叫', '篮球', '音乐'],
          explanation: 'Câu giới thiệu phối hợp liên từ "也" diễn tả nhiều sở thích.'
        }
      ]
    }
  ]
};

// ==========================================
// 3. DỮ LIỆU ĐỀ THI HSK 3
// ==========================================
export const HSK3_EXAM_DATA = {
  id: 'hsk-3',
  title: 'Đề thi thử HSK 3 - Chuẩn 4 kỹ năng',
  subtitle: 'Nghe hiểu (听力) • Đọc hiểu (阅读) • Viết (书写) • Nói (口语)',
  durationMinutes: 45,
  totalQuestions: 20,
  passScore: 60,
  expReward: 150,
  sections: [
    {
      id: 'listening',
      name: 'Nghe hiểu (听力)',
      icon: '🎧',
      desc: 'Nghe hội thoại công sở, phương hướng, thời gian và cuộc sống',
      questions: [
        {
          id: 1,
          sectionId: 'listening',
          type: 'true_false',
          audioText: '会议推迟到明天上午九点了。',
          pinyin: 'Huìyì tuīchí dào míngtiān shàngwǔ jiǔ diǎn le.',
          visual: '🕘',
          visualLabel: '09:00 Sáng mai',
          prompt: 'Nghe thông báo và phán đoán tính chính xác so với hình ảnh:',
          correctAnswer: true,
          explanation: 'Audio nói cuộc họp hoãn đến 9 giờ sáng mai ("推迟到明天上午九点"), khớp với hình đồng hồ 9 giờ 🕘.'
        },
        {
          id: 2,
          sectionId: 'listening',
          type: 'true_false',
          audioText: '医生建议他多吃新鲜的水果和蔬菜。',
          pinyin: 'Yīshēng jiànyì tā duō chī xīnxiān de shuǐguǒ hé shūcài.',
          visual: '🍔',
          visualLabel: 'Đồ ăn nhanh hamburger',
          prompt: 'Nghe câu nói và xác định câu này Đúng (√) hay Sai (×) so với hình ảnh:',
          correctAnswer: false,
          explanation: 'Bác sĩ khuyên ăn nhiều hoa quả và rau củ tươi ("多吃新鲜的水果和蔬菜"), hình ảnh lại là hamburger đồ ăn nhanh nên nhận định này Sai (×).'
        },
        {
          id: 3,
          sectionId: 'listening',
          type: 'multiple_choice',
          audioText: '我打算下个月去上海旅游，听说那里的夜景非常有名。',
          pinyin: 'Wǒ dǎsuàn xià gè yuè qù Shànghǎi lǚyóu, tīngshuō nàlǐ de yèjǐng fēicháng yǒumíng.',
          prompt: 'Nghe câu nói và trả lời: 他打算什么时候去旅游？(Anh ấy dự định khi nào đi du lịch?)',
          options: [
            { id: 'A', text: '下个月 (Tháng sau)' },
            { id: 'B', text: '明年夏天 (Mùa hè năm sau)' },
            { id: 'C', text: '这个周末 (Cuối tuần này)' }
          ],
          correctAnswer: 'A',
          explanation: 'Trong câu có câu: "我打算下个月去上海旅游" (Tôi dự định tháng sau đi Thượng Hải du lịch). Đáp án là A.'
        },
        {
          id: 4,
          sectionId: 'listening',
          type: 'multiple_choice',
          audioText: '男：你的中文越来越流利了，有什么好方法吗？\n女：其实就是每天坚持看半个小时中文新闻。',
          audioSpeech: '你的中文越来越流利了，有什么好方法吗？其实就是每天坚持看半个小时中文新闻。',
          pinyin: 'Nán: Nǐ de Zhōngwén yuè lái yuè liúlì le, yǒu shénme hǎo fāngfǎ ma? \nNǚ: Qíshí jiù shì měitiān jiānchí kàn bàn gè xiǎoshí Zhōngwén xīnwén.',
          prompt: 'Nghe đoạn hội thoại và trả lời: 女的是怎么提高中文水平的？(Cô ấy nâng cao trình độ tiếng Trung bằng cách nào?)',
          options: [
            { id: 'A', text: '每天坚持看中文新闻 (Hằng ngày kiên trì xem tin tức tiếng Trung)' },
            { id: 'B', text: '经常去中国旅游 (Thường xuyên đi du lịch Trung Quốc)' },
            { id: 'C', text: '找了中国家教 (Thuê gia sư người Trung Quốc)' }
          ],
          correctAnswer: 'A',
          explanation: 'Người nữ chia sẻ bí quyết: "每天坚持看半个小时中文新闻". Đáp án đúng là A.'
        },
        {
          id: 5,
          sectionId: 'listening',
          type: 'multiple_choice',
          audioText: '男：请问这附近有银行吗？\n女：往前走两百米，过马路后右手边就是工商银行。',
          audioSpeech: '请问这附近有银行吗？往前走两百米，过马路后右手边就是工商银行。',
          pinyin: 'Nán: Qǐngwèn zhè fùjìn yǒu yínháng ma? \nNǚ: Wǎng qián zǒu liǎng bǎi mǐ, guò mǎlù hòu yòushǒu biān jiù shì Gōngshāng Yínháng.',
          prompt: 'Nghe đoạn hội thoại và trả lời: 银行在什么地方？(Ngân hàng ở vị trí nào?)',
          options: [
            { id: 'A', text: '往前走两百米过马路右手边 (Đi thẳng 200m qua đường bên tay phải)' },
            { id: 'B', text: '就在地铁站里面 (Ở ngay bên trong trạm tàu điện ngầm)' },
            { id: 'C', text: '在医院的对面 (Ở đối diện bệnh viện)' }
          ],
          correctAnswer: 'A',
          explanation: 'Chỉ dẫn đường: "往前走两百米，过马路后右手边就是...". Đáp án là A.'
        }
      ]
    },
    {
      id: 'reading',
      name: 'Đọc hiểu (阅读)',
      icon: '📖',
      desc: 'Đọc hiểu văn bản HSK 3, liên từ 不仅...而且, câu phức và biển báo',
      questions: [
        {
          id: 6,
          sectionId: 'reading',
          type: 'true_false',
          hanziText: '图书馆里请保持安静，禁止大声喧哗。',
          pinyin: 'Túshūguǎn lǐ qǐng bǎochí ānjìng, jìnzhǐ dàshēng xuānhuá.',
          meaning: 'Trong thư viện xin giữ yên lặng, cấm làm ồn.',
          prompt: 'Đọc quy định trên và phán đoán nhận định sau Đúng hay Sai: "在图书馆里可以大声打电话。"',
          correctAnswer: false,
          explanation: 'Quy định yêu cầu "保持安静，禁止大声喧哗", nên việc nói chuyện điện thoại lớn tiếng là Sai (×).'
        },
        {
          id: 7,
          sectionId: 'reading',
          type: 'true_false',
          hanziText: '这条裤子不仅颜色好看，而且价格也很便宜。',
          pinyin: 'Zhè tiáo kùzi bùjǐn yánsè hǎokàn, érqiě jiàgé yě hěn piányi.',
          meaning: 'Chiếc quần này không những màu đẹp mà giá cả cũng rất rẻ.',
          prompt: 'Đọc câu trên và phán đoán nhận định sau Đúng hay Sai: "这条裤子既漂亮又实惠。"',
          correctAnswer: true,
          explanation: '"颜色好看" đồng nghĩa với "漂亮", "价格便宜" đồng nghĩa với "实惠". Do đó nhận định này Đúng (√).'
        },
        {
          id: 8,
          sectionId: 'reading',
          type: 'multiple_choice',
          hanziText: '这道数学题太难了，我算了好几次都没算出来。',
          pinyin: 'Zhè dào shùxué tí tài nán le, wǒ suàn le hǎo jǐ cì dōu méi suàn chūlái.',
          meaning: 'Bài toán này khó quá, tôi tính mấy lần rồi vẫn chưa ra.',
          prompt: 'Chọn câu đáp lại an ủi, giúp đỡ hợp lý nhất:',
          options: [
            { id: 'A', text: '别着急，让我来帮你看看吧。(Đừng sốt ruột, để tôi xem giúp bạn nào.)' },
            { id: 'B', text: '今天的米饭真好吃。(Cơm hôm nay ngon thật.)' },
            { id: 'C', text: '明天早上会下大雨。(Sáng mai trời sẽ mưa to.)' }
          ],
          correctAnswer: 'A',
          explanation: 'Khi bạn gặp bài toán khó chưa làm được, câu an ủi và ngỏ lời giúp đỡ "别着急，让我来帮你看看吧" là hoàn toàn phù hợp.'
        },
        {
          id: 9,
          sectionId: 'reading',
          type: 'multiple_choice',
          hanziText: '经理对大家的工作态度非常______，希望大家继续努力。',
          pinyin: 'Jīnglǐ duì dàjiā de gōngzuò tàidù fēicháng ______ , xīwàng dàjiā jìxù nǔlì.',
          meaning: 'Giám đốc rất hài lòng về thái độ làm việc của mọi người, mong mọi người tiếp tục cố gắng.',
          prompt: 'Chọn tính từ thích hợp điền vào chỗ trống:',
          options: [
            { id: 'A', text: '满意 (mǎnyì - Hài lòng / Vừa ý)' },
            { id: 'B', text: '麻烦 (máfan - Phiền toái)' },
            { id: 'C', text: '难过 (nánguò - Buồn bã)' }
          ],
          correctAnswer: 'A',
          explanation: 'Cấu trúc "对...非常满意" (Rất hài lòng về điều gì), vế sau là "希望大家继续努力" (mong tiếp tục cố gắng).'
        },
        {
          id: 10,
          sectionId: 'reading',
          type: 'multiple_choice',
          passage: '很多人觉得健康就是不生病，其实健康还包括心情愉快。每天笑一笑，心情好，身体才会更健康。',
          passagePinyin: 'Hěn duō rén juéde jiànkāng jiù shì bù shēngbìng, qíshí jiànkāng hái bāokuò xīnqíng yúkuài. Měitiān xiào yí xiào, xīnqíng hǎo, shēntǐ cái huì gèng jiànkāng.',
          prompt: 'Đọc đoạn văn trên và trả lời: 根据这段话，怎样才能让身体更健康？(Làm thế nào để cơ thể khỏe mạnh hơn?)',
          options: [
            { id: 'A', text: '保持心情愉快，经常笑一笑 (Giữ tâm trạng vui vẻ, thường xuyên mỉm cười)' },
            { id: 'B', text: '整天在家里睡觉 (Cả ngày ở nhà ngủ)' },
            { id: 'C', text: '尽量不跟别人说话 (Cố gắng không nói chuyện với người khác)' }
          ],
          correctAnswer: 'A',
          explanation: 'Đoạn văn nhấn mạnh: "健康还包括心情愉快。每天笑一笑，心情好，身体才会更健康". Đáp án là A.'
        }
      ]
    },
    {
      id: 'writing',
      name: 'Viết (书写)',
      icon: '✍️',
      desc: 'Câu chữ 把, câu chữ 被 và từ vựng trọng tâm HSK 3',
      questions: [
        {
          id: 11,
          sectionId: 'writing',
          type: 'word_order',
          chips: ['把', '作业', '交给了', '老师', '他'],
          targetSentence: '他把作业交给了老师',
          alternatives: [],
          prompt: 'Sắp xếp câu chữ "把" chỉ sự tác động và chuyển giao:',
          meaning: 'Anh ấy đã nộp bài tập cho thầy giáo.',
          explanation: 'Cấu trúc câu chữ 把: Chủ ngữ (他) + 把 + Tân ngữ (作业) + Động từ + Thành phần khác (交给了老师).'
        },
        {
          id: 12,
          sectionId: 'writing',
          type: 'word_order',
          chips: ['越来越', '中国文化', '我对', '感兴趣'],
          targetSentence: '我对中国文化越来越感兴趣',
          alternatives: [],
          prompt: 'Sắp xếp câu diễn đạt sự hứng thú tăng dần:',
          meaning: 'Tôi ngày càng cảm thấy hứng thú với văn hóa Trung Quốc.',
          explanation: 'Cấu trúc: 对...感兴趣 (có hứng thú với...), kết hợp "越来越" đặt trước tính từ: "我对中国文化越来越感兴趣".'
        },
        {
          id: 13,
          sectionId: 'writing',
          type: 'word_order',
          chips: ['被', '吃光了', '桌上的蛋糕', '小猫'],
          targetSentence: '桌上的蛋糕被小猫吃光了',
          alternatives: [],
          prompt: 'Sắp xếp câu bị động với chữ "被":',
          meaning: 'Bánh kem trên bàn đã bị chú mèo con ăn sạch rồi.',
          explanation: 'Cấu trúc câu bị động chữ 被: Đối tượng chịu tác động (桌上的蛋糕) + 被 + Tác nhân (小猫) + Động từ (吃光了).'
        },
        {
          id: 14,
          sectionId: 'writing',
          type: 'multiple_choice',
          hanziText: '无论遇到什么困难，我们都要 (nǔlì) ______ 解决。',
          prompt: 'Nhìn Pinyin trong ngoặc, chọn chữ Hán viết đúng:',
          options: [
            { id: 'A', text: '努力 (nǔlì - Nỗ lực / Cố gắng)' },
            { id: 'B', text: '热情 (rèqíng - Nhiệt tình)' },
            { id: 'C', text: '聪明 (cōngming - Thông minh)' }
          ],
          correctAnswer: 'A',
          explanation: 'Pinyin (nǔlì) viết là "努力". Câu: "努力解决" (nỗ lực giải quyết).'
        },
        {
          id: 15,
          sectionId: 'writing',
          type: 'multiple_choice',
          hanziText: '护士正在给病人量 (tǐwēn) ______。',
          prompt: 'Nhìn Pinyin trong ngoặc, chọn chữ Hán chính xác:',
          options: [
            { id: 'A', text: '体温 (tǐwēn - Thân nhiệt / Nhiệt độ cơ thể)' },
            { id: 'B', text: '身体 (shēntǐ - Thân thể)' },
            { id: 'C', text: '习惯 (xíguàn - Thói quen)' }
          ],
          correctAnswer: 'A',
          explanation: 'Pinyin (tǐwēn) viết bằng chữ Hán là "体温". Cụm từ: "量体温" (đo nhiệt độ cơ thể).'
        }
      ]
    },
    {
      id: 'speaking',
      name: 'Nói (口语)',
      icon: '🎙️',
      desc: 'Diễn đạt quan điểm, giải thích lý do và trả lời câu hỏi mở HSKK',
      questions: [
        {
          id: 16,
          sectionId: 'speaking',
          type: 'speech',
          targetSpeech: '不管遇到多大的困难，只要坚持就一定会成功。',
          targetPinyin: 'Bùguǎn yùdào duō dà de kùnnan, zhǐyào jiānchí jiù yídìng huì chénggōng.',
          targetMeaning: 'Dù gặp khó khăn lớn đến đâu, chỉ cần kiên trì nhất định sẽ thành công.',
          prompt: 'Luyện phát âm câu truyền cảm hứng chuẩn ngữ điệu:',
          expectedKeywords: ['不管', '困难', '坚持', '成功'],
          explanation: 'Cấu trúc câu phức: "不管...只要...就..." (Dù cho... chỉ cần... thì...).'
        },
        {
          id: 17,
          sectionId: 'speaking',
          type: 'speech',
          targetSpeech: '绿色出行不仅能够保护环境，而且对身体健康有好处。',
          targetPinyin: 'Lǜsè chūxíng bùjǐn nénggòu bǎohù huánjìng, érqiě duì shēntǐ jiànkāng yǒu hǎochù.',
          targetMeaning: 'Đi lại xanh không chỉ bảo vệ môi trường mà còn có lợi cho sức khỏe.',
          prompt: 'Nghe mẫu và phát âm lưu loát câu chủ đề môi trường:',
          expectedKeywords: ['不仅', '保护环境', '而且', '健康'],
          explanation: 'Cấu trúc tăng tiến: "不仅...而且..." (Không những... mà còn...).'
        },
        {
          id: 18,
          sectionId: 'speaking',
          type: 'speech',
          questionAudio: '周末你一般喜欢做些什么？',
          questionPinyin: 'Zhōumò nǐ yībān xǐhuan zuò xiē shénme?',
          questionMeaning: 'Cuối tuần bạn thường thích làm những việc gì?',
          sampleAnswer: '周末我一般喜欢在家里看书，或者跟朋友去公园散步。',
          samplePinyin: 'Zhōumò wǒ yībān xǐhuan zài jiā lǐ kànshū, huòzhě gēn péngyou qù gōngyuán sànbù.',
          sampleMeaning: 'Cuối tuần tôi thường thích ở nhà đọc sách hoặc cùng bạn đi công viên dạo bộ.',
          prompt: 'Nghe câu hỏi và tự do chia sẻ kế hoạch cuối tuần của bạn:',
          expectedKeywords: ['周末', '看书', '朋友', '公园', '或者'],
          explanation: 'Sử dụng liên từ lựa chọn "或者" để kể ra 2 hoạt động yêu thích vào cuối tuần.'
        },
        {
          id: 19,
          sectionId: 'speaking',
          type: 'speech',
          questionAudio: '你觉得学中文最难的是什么？',
          questionPinyin: 'Nǐ juéde xué Zhōngwén zuì nán de shì shénme?',
          questionMeaning: 'Bạn cảm thấy học tiếng Trung khó nhất là điều gì?',
          sampleAnswer: '我觉得记汉字最难，但是只要多练习就会变得容易。',
          samplePinyin: 'Wǒ juéde jì hànzì zuì nán, dànshì zhǐyào duō liànxí jiù huì biàn de róngyì.',
          sampleMeaning: 'Tôi thấy nhớ chữ Hán là khó nhất, nhưng chỉ cần luyện nhiều sẽ trở nên dễ dàng.',
          prompt: 'Nghe câu hỏi và nêu cảm nhận về việc học tiếng Trung:',
          expectedKeywords: ['汉字', '发音', '难', '练习'],
          explanation: 'Nêu quan điểm cá nhân kết hợp mẫu câu liên kết: "我觉得...最难，但是...".'
        },
        {
          id: 20,
          sectionId: 'speaking',
          type: 'speech',
          targetSpeech: '随着网络的发展，现在我们只需要在手机上下单，物品很快就能送到家。',
          targetPinyin: 'Suízhe wǎngluò de fāzhǎn, xiànzài wǒmen zhǐ xūyào zài shǒujī shang xiàdān, wùpǐn hěn kuài jiù néng sòng dào jiā.',
          targetMeaning: 'Cùng với sự phát triển của internet, giờ đây ta chỉ cần đặt hàng trên điện thoại là đồ sẽ nhanh chóng được giao tận nhà.',
          prompt: 'Đọc lưu loát đoạn văn về sự tiện lợi của công nghệ:',
          expectedKeywords: ['网络', '手机', '下单', '送到家'],
          explanation: 'Đoạn văn mô tả sự thay đổi của đời sống hiện đại với cụm từ "随着...的发展".'
        }
      ]
    }
  ]
};

// ==========================================
// 4. DỮ LIỆU ĐỀ THI HSK 4
// ==========================================
export const HSK4_EXAM_DATA = {
  id: 'hsk-4',
  title: 'Đề thi thử HSK 4 - Chuẩn 4 kỹ năng',
  subtitle: 'Nghe hiểu (听力) • Đọc hiểu (阅读) • Viết (书写) • Nói (口语)',
  durationMinutes: 50,
  totalQuestions: 20,
  passScore: 60,
  expReward: 180,
  sections: [
    {
      id: 'listening',
      name: 'Nghe hiểu (听力)',
      icon: '🎧',
      desc: 'Nghe đoạn văn chuyên đề, thương mại, phỏng vấn và đời sống chuyên sâu',
      questions: [
        {
          id: 1,
          sectionId: 'listening',
          type: 'true_false',
          audioText: '成功的关键不仅在于个人的聪明才智，更在于持之以恒的坚持与努力。',
          pinyin: 'Chénggōng de guānjiàn bùjǐn zàiyú gèrén de cōngmíng cáizhì, gèng zàiyú chízhīyǐhéng de jiānchí yǔ nǔlì.',
          prompt: 'Nghe đoạn văn và phán đoán tính chính xác của nhận định: "一个人只要聪明就一定会成功。"',
          correctAnswer: false,
          explanation: 'Đoạn văn nói chìa khóa thành công không chỉ ở sự thông minh mà quan trọng hơn là sự kiên trì ("更在于持之以恒的坚持与努力"), do đó nhận định chỉ cần thông minh là thành công là Sai (×).'
        },
        {
          id: 2,
          sectionId: 'listening',
          type: 'true_false',
          audioText: '为了保护视力，长时间面对电脑屏幕工作后，应该适当远眺，让眼部肌肉得到充分放松。',
          pinyin: 'Wèile bǎohù shìlì, cháng shíjiān miànduì diànnǎo píngmù gōngzuò hòu, yīnggāi shìdàng yuǎntiào, ràng yǎnbù jīròu dédào chōngfèn fàngsōng.',
          prompt: 'Nghe đoạn văn và phán đoán nhận định sau: "长时间使用电脑后需要让眼睛休息。"',
          correctAnswer: true,
          explanation: 'Khuyên sau khi làm việc máy tính lâu nên nhìn ra xa để thư giãn cơ mắt ("应该适当远眺，让眼部肌肉得到充分放松"), hoàn toàn trùng khớp với việc cho mắt nghỉ ngơi (Đúng √).'
        },
        {
          id: 3,
          sectionId: 'listening',
          type: 'multiple_choice',
          audioText: '这次招聘会吸引了上千名应聘者，竞争异常激烈。面试官特别看重候选人的实际工作经验与团队沟通能力。',
          pinyin: 'Zhè cì zhàopìnhuì xīyǐn le shàng qiān míng yìngpìnzhě, jìngzhēng yìcháng jīliè. Miànshìguān tèbié kànzhòng hòuxuǎnrén de shíjì gōngzuò jīngyàn yǔ tuánduì gōutōng nénglì.',
          prompt: 'Nghe đoạn tin tức và trả lời: 面试官特别看重候选人的什么？(Nhà tuyển dụng đặc biệt coi trọng điều gì ở ứng viên?)',
          options: [
            { id: 'A', text: '实际经验与沟通能力 (Kinh nghiệm thực tế và kỹ năng giao tiếp đội nhóm)' },
            { id: 'B', text: '毕业院校的名气 (Danh tiếng trường đại học tốt nghiệp)' },
            { id: 'C', text: '外表形象是否帅气 (Ngoại hình có điển trai hay không)' }
          ],
          correctAnswer: 'A',
          explanation: 'Trong bài nêu rõ: "面试官特别看重候选人的实际工作经验与团队沟通能力". Đáp án là A.'
        },
        {
          id: 4,
          sectionId: 'listening',
          type: 'multiple_choice',
          audioText: '男：这份商业合同的所有条款我都仔细审核过了，基本符合要求，下周一上午可以正式签约。\n女：太好了，预祝我们两家企业合作顺利愉快！',
          audioSpeech: '这份商业合同的所有条款我都仔细审核过了，基本符合要求，下周一上午可以正式签约。太好了，预祝我们两家企业合作顺利愉快！',
          pinyin: 'Nán: Zhè fèn shāngyè hétong de suǒyǒu tiáokuǎn wǒ dōu zǐxì shěnhé guò le, jīběn fúhé yāoqiú, xià zhōuyī shàngwǔ kěyǐ zhèngshì qiānyuē. \nNǚ: Tài hǎo le, yùzhù wǒmen liǎng jiā qǐyè hézuò shùnlì yúkuài!',
          prompt: 'Nghe đoạn đối thoại thương mại và trả lời: 他们打算什么时候正式签合同？(Họ dự định khi nào ký hợp đồng?)',
          options: [
            { id: 'A', text: '下周一上午 (Sáng thứ hai tuần sau)' },
            { id: 'B', text: '今天下午 (Chiều hôm nay)' },
            { id: 'C', text: '下个月底 (Cuối tháng sau)' }
          ],
          correctAnswer: 'A',
          explanation: 'Nhân vật nam thông báo: "下周一上午可以正式签约" (Sáng thứ hai tuần sau có thể chính thức ký hợp đồng). Đáp án là A.'
        },
        {
          id: 5,
          sectionId: 'listening',
          type: 'multiple_choice',
          audioText: '很多年轻白领喜欢经常熬夜加班，其实经常熬夜对人体的免疫系统伤害极大，容易导致记忆力减退和疲劳积累。',
          pinyin: 'Hěn duō niánqīng báilǐng xǐhuan jīngcháng áoyè jiābān, qíshí jīngcháng áoyè duì réntǐ de miǎnyì xìtǒng shānghài jídà, róngyì dǎozhì jìyìlì jiǎntuì hé píláo jīlěi.',
          prompt: 'Nghe câu nói và trả lời: 说话人认为经常熬夜会带来什么后果？(Người nói cho rằng thức khuya thường xuyên gây ra hậu quả gì?)',
          options: [
            { id: 'A', text: '损害免疫系统，导致记忆力减退 (Hại hệ miễn dịch, giảm trí nhớ)' },
            { id: 'B', text: '提高第二天的工作效率 (Nâng cao hiệu suất ngày hôm sau)' },
            { id: 'C', text: '让心情变得更加愉快 (Khiến tâm trạng thoải mái hơn)' }
          ],
          correctAnswer: 'A',
          explanation: 'Hậu quả của thức khuya: "对人体的免疫系统伤害极大，容易导致记忆力减退...". Đáp án là A.'
        }
      ]
    },
    {
      id: 'reading',
      name: 'Đọc hiểu (阅读)',
      icon: '📖',
      desc: 'Đoạn văn luận điểm, ngụ ngôn, triết lý sống và thuật ngữ HSK 4',
      questions: [
        {
          id: 6,
          sectionId: 'reading',
          type: 'true_false',
          hanziText: '真正的朋友不是在顺境时围绕在你身边的人，而是在你身处逆境、遇到困难时，依然愿意伸出援手支持你的人。',
          pinyin: 'Zhēnzhèng de péngyou bú shì zài shùnjìng shí wéirào zài nǐ shēnbiān de rén, ér shì zài nǐ shēnchǔ nìjìng, yùdào kùnnan shí, yīrán yuànyì shēn chū yuánshǒu zhīchí nǐ de rén.',
          meaning: 'Bạn bè thực sự không phải là người vây quanh lúc thuận lợi, mà là người sẵn sàng đưa tay giúp đỡ khi ta hoạn nạn.',
          prompt: 'Đọc câu danh ngôn trên và phán đoán nhận định sau Đúng hay Sai: "患难时刻见真情。"',
          correctAnswer: true,
          explanation: '"患难时刻见真情" (Hoạn nạn mới thấy chân tình) hoàn toàn đồng điệu với nội dung đoạn văn (Đúng √).'
        },
        {
          id: 7,
          sectionId: 'reading',
          type: 'true_false',
          hanziText: '吸烟不仅严重危害吸烟者本人的呼吸系统健康，公共场所产生的二手烟对周围不吸烟人群造成的危害同样不可忽视。',
          pinyin: 'Xīyān bùjǐn yánzhòng wēihài xīyānzhě běnrén de hūxī xìtǒng jiànkāng, gōnggòng chǎngsuǒ chǎnshēng de èrshǒuyān duì zhōuwéi bù xīyān rénqún zàochéng de wēihài tóngyàng bù kě hūshì.',
          meaning: 'Hút thuốc không chỉ hại người hút mà khói thuốc thụ động nơi công cộng cũng gây hại lớn cho người xung quanh.',
          prompt: 'Đọc đoạn văn và phán đoán nhận định sau Đúng hay Sai: "吸二手烟对身体没有任何坏处。"',
          correctAnswer: false,
          explanation: 'Bài viết khẳng định tác hại của khói thuốc thụ động là "不可忽视" (không thể xem nhẹ), do đó nói không có hại là Sai (×).'
        },
        {
          id: 8,
          sectionId: 'reading',
          type: 'multiple_choice',
          hanziText: '无论从事什么行业，提前做好充分准备都能让你事半功倍。',
          pinyin: 'Wúlùn cóngshì shénme hángyè, tíqián zuò hǎo chōngfèn zhǔnbèi dōu néng ràng nǐ shì bàn gōng bèi.',
          meaning: 'Bất luận làm ngành nghề gì, chuẩn bị chu đáo trước đều giúp bạn làm ít công to (bỏ 1 công nhận 2 quả).',
          prompt: 'Chọn câu văn tiếp nối hợp logic lập luận nhất:',
          options: [
            { id: 'A', text: '正所谓“有备无患”，做足功课才能应对各种突发情况。(Đúng như câu "có chuẩn bị thì không lo", chuẩn bị kỹ mới ứng phó được tình huống bất ngờ.)' },
            { id: 'B', text: '昨天晚上的足球比赛非常精彩。(Trận bóng đá tối hôm qua vô cùng kịch tính.)' },
            { id: 'C', text: '这家餐厅的烤鸭味道十分正宗。(Món vịt quay của nhà hàng này rất chuẩn vị.)' }
          ],
          correctAnswer: 'A',
          explanation: 'Câu nói bàn về giá trị của việc chuẩn bị trước ("事半功倍"), câu nối tiếp tương ứng là A với thành ngữ "有备无患" (có chuẩn bị thì không lo).'
        },
        {
          id: 9,
          sectionId: 'reading',
          type: 'multiple_choice',
          hanziText: '面对日新月异的市场需求，科技企业必须不断______产品与技术，才能立于不败之地。',
          pinyin: 'Miànduì rìxīnyuèyì de shìchǎng xūqiú, kējì qǐyè bìxū bùduàn ______ chǎnpǐn yǔ jìshù, cái néng lì yú bú bài zhī dì.',
          meaning: 'Đối mặt nhu cầu thị trường thay đổi từng ngày, doanh nghiệp công nghệ phải liên tục đổi mới sản phẩm và kỹ thuật.',
          prompt: 'Chọn động từ chuyên ngành HSK 4 thích hợp nhất:',
          options: [
            { id: 'A', text: '创新 (chuàngxīn - Đổi mới sáng tạo / Cách tân)' },
            { id: 'B', text: '拒绝 (jùjué - Từ chối)' },
            { id: 'C', text: '怀疑 (huáiyí - Nghi ngờ)' }
          ],
          correctAnswer: 'A',
          explanation: 'Cụm từ "不断创新产品与技术" (không ngừng đổi mới sáng tạo sản phẩm và kỹ thuật). Đáp án là A.'
        },
        {
          id: 10,
          sectionId: 'reading',
          type: 'multiple_choice',
          passage: '幽默不仅是一种生活智慧，更是人际交往中的润滑剂。一个富有幽默感的人，往往能够以轻松的态度化解尴尬场面，赢得同事和朋友的尊重与信任。',
          passagePinyin: 'Yōumò bùjǐn shì yì zhǒng shēnghuó zhìhuì, gèng shì rénjì jiāowǎng zhōng de rùnhuájì. Yí gè fùyǒu yōumò gǎn de rén, wǎngwǎng nénggòu yǐ qīngsōng de tàidù huàjiě gāngà chǎngmiàn, yíngdé tóngshì hé péngyou de zūnzhòng yǔ xìnrèn.',
          prompt: 'Đọc đoạn văn trên và trả lời: 富有幽默感的人有什么优势？(Người giàu khiếu hài hước có ưu thế gì?)',
          options: [
            { id: 'A', text: '能够轻松化解尴尬，赢得他人信任 (Dễ dàng hóa giải tình huống ngượng ngùng, lấy được lòng tin)' },
            { id: 'B', text: '从来不需要与别人合作 (Không bao giờ cần hợp tác với ai)' },
            { id: 'C', text: '工作态度总是非常严肃 (Thái độ làm việc luôn luôn rất nghiêm khắc)' }
          ],
          correctAnswer: 'A',
          explanation: 'Bài viết chỉ rõ: "能够以轻松的态度化解尴尬场面，赢得同事和朋友的尊重与信任". Đáp án là A.'
        }
      ]
    },
    {
      id: 'writing',
      name: 'Viết (书写)',
      icon: '✍️',
      desc: 'Cấu trúc câu phức hợp, bổ ngữ kết quả/trình độ và từ vựng cao cấp HSK 4',
      questions: [
        {
          id: 11,
          sectionId: 'writing',
          type: 'word_order',
          chips: ['把', '整理得', '干干净净', '房间', '她'],
          targetSentence: '她把房间整理得干干净净',
          alternatives: [],
          prompt: 'Sắp xếp câu chữ 把 kết hợp bổ ngữ trình độ "得":',
          meaning: 'Cô ấy dọn dẹp căn phòng sạch bong kin kít.',
          explanation: 'Cấu trúc kết hợp: Chủ ngữ (她) + 把 + Tân ngữ (房间) + Động từ + 得 + Tính từ láy (整理得干干净净).'
        },
        {
          id: 12,
          sectionId: 'writing',
          type: 'word_order',
          chips: ['对', '产生了', '深远的影响', '这项发明', '现代社会'],
          targetSentence: '这项发明对现代社会产生了深远的影响',
          alternatives: [],
          prompt: 'Sắp xếp câu diễn đạt tác động ảnh hưởng sâu sắc:',
          meaning: 'Phát minh này đã tạo ra ảnh hưởng sâu xa đối với xã hội hiện đại.',
          explanation: 'Cấu trúc thành ngữ/câu HSK 4: A + 对 + B + 产生了深远的影响 (这项发明对现代社会产生了深远的影响).'
        },
        {
          id: 13,
          sectionId: 'writing',
          type: 'word_order',
          chips: ['积累了', '宝贵的经验', '他还', '不仅', '丰富的人脉'],
          targetSentence: '他不仅积累了宝贵的经验还积累了丰富的人脉',
          alternatives: ['他不仅积累了丰富的人脉还积累了宝贵的经验'],
          prompt: 'Sắp xếp câu nối tiếp với cặp từ "不仅...还...":',
          meaning: 'Anh ấy không chỉ tích lũy kinh nghiệm quý báu mà còn có được mạng lưới quan hệ phong phú.',
          explanation: 'Cấu trúc: 主语 (他) + 不仅... + 还...: "他不仅积累了宝贵的经验还积累了丰富的人脉".'
        },
        {
          id: 14,
          sectionId: 'writing',
          type: 'multiple_choice',
          hanziText: '父母的言行举止会对孩子的成长产生深远的 (yǐngxiǎng) ______。',
          prompt: 'Nhìn Pinyin trong ngoặc, chọn chữ Hán viết chuẩn xác:',
          options: [
            { id: 'A', text: '影响 (yǐngxiǎng - Ảnh hưởng / Tác động)' },
            { id: 'B', text: '印象 (yìnxiàng - Ấn tượng)' },
            { id: 'C', text: '形象 (xíngxiàng - Hình tượng)' }
          ],
          correctAnswer: 'A',
          explanation: 'Pinyin (yǐngxiǎng) tương ứng chữ Hán "影响" (產生影響: tạo ra ảnh hưởng).'
        },
        {
          id: 15,
          sectionId: 'writing',
          type: 'multiple_choice',
          hanziText: '在与客户沟通洽谈时，我们必须始终保持 (lǐmào) ______ 和专业态度。',
          prompt: 'Nhìn Pinyin trong ngoặc, chọn chữ Hán đúng chính tả:',
          options: [
            { id: 'A', text: '礼貌 (lǐmào - Lịch sự / Lễ độ)' },
            { id: 'B', text: '热情 (rèqíng - Nhiệt tình)' },
            { id: 'C', text: '脾气 (píqi - Tính khí)' }
          ],
          correctAnswer: 'A',
          explanation: 'Pinyin (lǐmào) viết là "礼貌" (保持礼貌: giữ thái độ lịch thiệp).'
        }
      ]
    },
    {
      id: 'speaking',
      name: 'Nói (口语)',
      icon: '🎙️',
      desc: 'Phát biểu ý kiến, lập luận logic và kỹ năng thuyết trình HSKK Trung cấp',
      questions: [
        {
          id: 16,
          sectionId: 'speaking',
          type: 'speech',
          targetSpeech: '失败并不可怕，可怕的是失去从头再来的勇气与信心。',
          targetPinyin: 'Shībài bìng bù kěpà, kěpà de shì shīqù cóngtóu zàilái de yǒngqì yǔ xìnxīn.',
          targetMeaning: 'Thất bại không đáng sợ, điều đáng sợ là đánh mất dũng khí và niềm tin để bắt đầu lại.',
          prompt: 'Phát âm dõng dạc câu triết lý sống giàu tính biểu cảm:',
          expectedKeywords: ['失败', '可怕', '失去', '勇气', '信心'],
          explanation: 'Mẫu câu lập luận tương phản: "A 并不可怕，可怕的是 B".'
        },
        {
          id: 17,
          sectionId: 'speaking',
          type: 'speech',
          targetSpeech: '良好的时间管理能力是每一个职场人士取得成功的重要保障。',
          targetPinyin: 'Liánghǎo de shíjiān guǎnlǐ nénglì shì měi yí gè zhíchǎng rénshì qǔdé chénggōng de zhòngyào bǎozhàng.',
          targetMeaning: 'Kỹ năng quản lý thời gian tốt là bảo đảm quan trọng để mỗi nhân sự công sở đạt được thành công.',
          prompt: 'Nghe mẫu và luyện phát âm câu văn phong công sở chuyên nghiệp:',
          expectedKeywords: ['时间管理', '职场', '成功', '保障'],
          explanation: 'Câu định nghĩa trang trọng dùng trong văn phong thuyết trình và công việc.'
        },
        {
          id: 18,
          sectionId: 'speaking',
          type: 'speech',
          questionAudio: '你如何看待现代生活中的工作与生活平衡？',
          questionPinyin: 'Nǐ rúhé kàndài xiàndài shēnghuó zhōng de gōngzuò yǔ shēnghuó pínghéng?',
          questionMeaning: 'Bạn nhìn nhận thế nào về việc cân bằng giữa công việc và cuộc sống hiện đại?',
          sampleAnswer: '我认为工作很重要，但是身心健康和家庭生活同样不可忽视，合理的平衡才能走得更远。',
          samplePinyin: 'Wǒ rènwéi gōngzuò hěn zhòngyào, dànshì shēnxīn jiànkāng hé jiātíng shēnghuó tóngyàng bù kě hūshì, hélǐ de pínghéng cái néng zǒu de gèng yuǎn.',
          sampleMeaning: 'Tôi cho rằng công việc rất quan trọng, nhưng sức khỏe và gia đình cũng không thể coi nhẹ, cân bằng hợp lý mới đi xa được.',
          prompt: 'Nghe câu hỏi mở và phát biểu quan điểm cá nhân vào micro:',
          expectedKeywords: ['工作', '生活', '平衡', '健康', '家庭'],
          explanation: 'Trình bày quan điểm có cấu trúc: Nhận định ban đầu + Luận cứ bổ trợ + Kết luận.'
        },
        {
          id: 19,
          sectionId: 'speaking',
          type: 'speech',
          questionAudio: '谈谈你学习中文的目的以及未来的长远规划。',
          questionPinyin: 'Tán tan nǐ xuéxí Zhōngwén de mùdì yǐjí wèilái de chángyuǎn guīhuà.',
          questionMeaning: 'Hãy nói về mục đích học tiếng Trung và định hướng tương lai lâu dài của bạn.',
          sampleAnswer: '我学习中文是为了开拓职业道路并了解中国文化，希望未来能用流利的中文开展商务合作。',
          samplePinyin: 'Wǒ xuéxí Zhōngwén shì wèile kāituò zhíyè dàolù bìng liǎojiě Zhōngguó wénhuà, xīwàng wèilái néng yòng liúlì de Zhōngwén kāizhǎn shāngwù hézuò.',
          sampleMeaning: 'Tôi học tiếng Trung để mở rộng con đường sự nghiệp và hiểu văn hóa Trung Quốc, hy vọng tương lai có thể dùng tiếng Trung lưu loát hợp tác kinh doanh.',
          prompt: 'Nghe câu hỏi và tự tin nói về mục tiêu tương lai của bạn:',
          expectedKeywords: ['学习中文', '目的', '文化', '未来', '合作', '工作'],
          explanation: 'Nêu rõ ràng 2 nhánh: Lý do hiện tại (目的) và Kỳ vọng tương lai (规划).'
        },
        {
          id: 20,
          sectionId: 'speaking',
          type: 'speech',
          targetSpeech: '阅读能开阔我们的视野，丰富我们的内心世界。每天抽出半小时静心读书，日积月累，人生格局将变得更加宽广。',
          targetPinyin: 'Yuèdú néng kāikuò wǒmen de shìyě, fēngfù wǒmen de nèixīn shìjiè. Měitiān chōuchū bàn xiǎoshí jìngxīn dúshū, rìjīyuèlěi, rénshēng géjú jiāng biàn de gèngjiā kuānguǎng.',
          targetMeaning: 'Đọc sách mở rộng tầm nhìn, làm phong phú thế giới nội tâm. Mỗi ngày dành nửa giờ tĩnh tâm đọc sách, tích lũy theo năm tháng, cục diện đời người sẽ càng rộng mở.',
          prompt: 'Đọc diễn cảm đoạn văn triết lý về sức mạnh của việc đọc sách:',
          expectedKeywords: ['阅读', '视野', '读书', '日积月累'],
          explanation: 'Đoạn văn văn phong tao nhã với các thành ngữ HSK 4 như "开阔视野", "日积月累".'
        }
      ]
    }
  ]
};

// Bảng map đề thi theo ID
const EXAMS_MAP = {
  'hsk-1': HSK1_EXAM_DATA,
  'hsk-2': HSK2_EXAM_DATA,
  'hsk-3': HSK3_EXAM_DATA,
  'hsk-4': HSK4_EXAM_DATA
};

// Trình phát âm thanh tiếng Trung chuẩn
function playChineseAudio(text, onEnd) {
  if (!text) return;
  window.speechSynthesis?.cancel();

  if ('speechSynthesis' in window) {
    try {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'zh-CN';
      utterance.rate = 0.85;
      const voices = window.speechSynthesis.getVoices();
      const zh = voices.find(
        (v) => v.lang === 'zh-CN' || v.lang === 'zh_CN' || v.lang.startsWith('zh') || v.name.includes('Chinese')
      );
      if (zh) utterance.voice = zh;
      if (onEnd) utterance.onend = onEnd;
      window.speechSynthesis.speak(utterance);
      return;
    } catch (_) {}
  }

  // Fallback YouDao
  const audio = new Audio(`https://dict.youdao.com/dictvoice?audio=${encodeURIComponent(text)}&le=zh`);
  if (onEnd) audio.onended = onEnd;
  audio.play().catch(() => {});
}

// Khởi tạo trang Thi thử
export function initMockExam({ selector = '[data-mock-exam]', onStart } = {}) {
  const container = document.querySelector(selector);
  if (!container) return;

  renderExamLobby(container, onStart);
}

// Render màn hình danh sách đề thi (Lobby)
function renderExamLobby(container, onStart) {
  container.innerHTML = `
    <div class="mock-lobby">
      <div class="mock-lobby-hero">
        <div class="mock-lobby-badge">🏆 HỆ THỐNG THI THỬ HSK CHUẨN QUỐC TẾ</div>
        <h2>Kiểm tra năng lực tiếng Trung toàn diện (HSK 1 - HSK 4)</h2>
        <p>Làm quen với cấu trúc đề thi thực chiến, rèn luyện áp lực thời gian và đánh giá chi tiết 4 kỹ năng <strong>Nghe • Nói • Đọc • Viết</strong> theo tiêu chuẩn mới nhất.</p>
      </div>

      <div class="mock-exam-list">
        ${mockExams.map((exam) => `
          <article class="mock-exam-card ${exam.available ? 'is-featured' : 'is-coming-soon'}">
            <div class="mock-card-left">
              <div class="mock-card-badge">${exam.badge}</div>
              <h3>${exam.title}</h3>
              <div class="mock-card-meta">
                <span>⏱️ ${exam.duration} phút</span>
                <span>📝 ${exam.questions} câu</span>
                <span>📚 ${exam.sections} phần</span>
                <span>🎁 +${exam.expReward} EXP</span>
              </div>
              <div class="mock-skills-pills">
                ${exam.skills.map((s) => `<span class="mock-skill-pill">${s}</span>`).join('')}
              </div>
            </div>
            <div class="mock-card-right">
              ${exam.available ? `
                <button type="button" class="mock-btn-start" data-exam-start="${exam.id}">
                  Bắt đầu thi ngay →
                </button>
              ` : `
                <button type="button" class="mock-btn-disabled" disabled>
                  Sắp ra mắt
                </button>
              `}
            </div>
          </article>
        `).join('')}
      </div>
    </div>
  `;

  // Gắn sự kiện cho nút bắt đầu thi của từng đề -> Mở trang Bìa đề thi chuẩn quy chế HSK
  container.querySelectorAll('[data-exam-start]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const examId = btn.dataset.examStart;
      const examData = EXAMS_MAP[examId];
      if (examData) {
        onStart?.(examId);
        renderExamCover(container, examData);
      }
    });
  });
}

// -------------------------------------------------------------
// 1. MÀN HÌNH BÌA ĐỀ THI & HƯỚNG DẪN QUY CHẾ (EXAM COVER)
// -------------------------------------------------------------
function renderExamCover(container, examData) {
  container.innerHTML = `
    <div class="mock-cover-wrap">
      <div class="mock-cover-card">
        <div class="mock-cover-header">
          <div class="mock-cover-badge">HỆ THỐNG THI THỬ TRỰC TUYẾN • CHUẨN HSK QUỐC TẾ</div>
          <h2 class="mock-cover-title">${examData.title}</h2>
          <p class="mock-cover-sub">${examData.subtitle}</p>
        </div>

        <!-- 4 Khối kỹ năng thi thực chiến -->
        <div class="mock-cover-sections-grid">
          ${examData.sections.map((sec, idx) => `
            <div class="mock-cover-sec-card sec-${sec.id}">
              <div class="sec-card-header">
                <span class="sec-card-icon">${sec.icon}</span>
                <span class="sec-card-step">PHẦN ${idx + 1}</span>
              </div>
              <strong class="sec-card-title">${sec.name}</strong>
              <p class="sec-card-desc">${sec.desc}</p>
              <div class="sec-card-footer">
                <span>📝 ${sec.questions.length} câu hỏi</span>
                <span>⏱️ ~${sec.id === 'listening' ? '8' : sec.id === 'reading' ? '10' : sec.id === 'writing' ? '10' : '7'} phút</span>
              </div>
            </div>
          `).join('')}
        </div>

        <!-- Kiểm tra thiết bị âm thanh & micro -->
        <div class="mock-cover-device-check">
          <div class="device-check-title">
            <span>🎧 KIỂM TRA THIẾT BỊ TRƯỚC KHI THI</span>
          </div>
          <div class="device-check-buttons">
            <button type="button" class="mock-device-btn" id="coverSoundCheckBtn">
              🔊 Thử âm thanh loa / tai nghe
            </button>
            <button type="button" class="mock-device-btn" id="coverMicCheckBtn">
              🎙️ Thử Microphone
            </button>
            <span class="device-check-status" id="coverDeviceStatus">Hãy bấm nút để nghe thử âm thanh chuẩn.</span>
          </div>
        </div>

        <!-- Quy chế thi -->
        <div class="mock-cover-rules">
          <strong>📌 Quy chế phòng thi:</strong>
          <ul>
            <li>Thời gian làm bài: <strong>${examData.durationMinutes} phút</strong> (tính giờ liên tục).</li>
            <li>Bài thi gồm <strong>4 phần độc lập</strong> theo thứ tự: <strong>Nghe ➔ Đọc ➔ Viết ➔ Nói</strong>.</li>
            <li>Sau khi hoàn thành mỗi phần, hệ thống sẽ có màn hình chuyển tiếp sang phần thi tiếp theo.</li>
            <li>Điểm đạt chuẩn: <strong>${examData.passScore}/100 điểm</strong> (tương đương 180/300 điểm HSK).</li>
          </ul>
        </div>

        <!-- Nút hành động -->
        <div class="mock-cover-actions">
          <button type="button" class="mock-btn-action ghost" id="coverBackLobbyBtn">
            ← Chọn đề thi khác
          </button>
          <button type="button" class="mock-btn-action primary large" id="coverStartRealExamBtn">
            🚀 Bắt đầu làm bài thi (Vào Phần 1: Nghe hiểu) ➔
          </button>
        </div>
      </div>
    </div>
  `;

  // Thử loa
  const soundBtn = container.querySelector('#coverSoundCheckBtn');
  const statusEl = container.querySelector('#coverDeviceStatus');
  soundBtn?.addEventListener('click', () => {
    if (statusEl) statusEl.textContent = 'Đang phát âm thử: "你好，欢迎参加考试！"...';
    playChineseAudio('你好，欢迎参加考试！', () => {
      if (statusEl) statusEl.textContent = '✓ Âm thanh hoạt động bình thường!';
    });
  });

  // Thử mic
  const micBtn = container.querySelector('#coverMicCheckBtn');
  micBtn?.addEventListener('click', () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      if (statusEl) statusEl.textContent = 'Trình duyệt chưa hỗ trợ Web Speech Recognition. Bạn vẫn có thể thi phần Nói bằng cách tự đọc to và bấm xác nhận.';
      return;
    }
    if (statusEl) statusEl.textContent = 'Micro đã sẵn sàng hoạt động trong bài thi!';
  });

  // Quay lại lobby
  container.querySelector('#coverBackLobbyBtn')?.addEventListener('click', () => {
    initMockExam({ selector: '[data-mock-exam]' });
  });

  // Bắt đầu làm bài
  container.querySelector('#coverStartRealExamBtn')?.addEventListener('click', () => {
    startExam(container, examData);
  });
}

// -------------------------------------------------------------
// 2. BẮT ĐẦU PHÒNG THI & QUẢN LÝ TIẾN TRÌNH THEO PHẦN
// -------------------------------------------------------------
function startExam(container, examData) {
  // Flatten câu hỏi kèm chỉ số trong từng phần
  const allQuestions = [];
  examData.sections.forEach((sec, secIdx) => {
    sec.questions.forEach((q, qIdxInSec) => {
      allQuestions.push({
        ...q,
        sectionIndex: secIdx,
        sectionName: sec.name,
        sectionIcon: sec.icon,
        questionIndexInSection: qIdxInSec,
        totalQuestionsInSection: sec.questions.length
      });
    });
  });

  const state = {
    currentIndex: 0,
    answers: {}, // questionId -> answer
    speakingStatus: {}, // questionId -> { text, score, verified }
    wordOrderSelections: {}, // questionId -> array of chips chosen
    secondsLeft: examData.durationMinutes * 60,
    timerInterval: null,
    isSubmitted: false,
    autoSubmit: true
  };

  // Khởi tạo word order cho các câu viết
  allQuestions.forEach((q) => {
    if (q.type === 'word_order') {
      state.wordOrderSelections[q.id] = [];
    }
  });

  // Bắt đầu đếm ngược thời gian
  state.timerInterval = setInterval(() => {
    state.secondsLeft--;
    updateTimerDisplay(container, state.secondsLeft);
    if (state.secondsLeft <= 0) {
      clearInterval(state.timerInterval);
      triggerAutoSubmitExam(container, examData, allQuestions, state, 'timeout');
    }
  }, 1000);

  // Render phòng thi
  renderExamRoom(container, examData, allQuestions, state);
}

// Cập nhật đồng hồ đếm ngược
function updateTimerDisplay(container, seconds) {
  const timerEl = container.querySelector('#examTimer');
  if (!timerEl) return;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  timerEl.textContent = `${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
  if (seconds <= 300) {
    timerEl.classList.add('is-warning');
  }
}

// Tự động nộp bài (Auto Submit) có đếm ngược thông báo
function triggerAutoSubmitExam(container, examData, allQuestions, state, reason = 'complete') {
  if (state.isSubmitted) return;
  state.isSubmitted = true;
  clearInterval(state.timerInterval);
  window.speechSynthesis?.cancel();

  const existing = container.querySelector('#autoSubmitOverlay');
  if (existing) existing.remove();

  const isTimeout = reason === 'timeout';
  const overlay = document.createElement('div');
  overlay.className = 'mock-auto-submit-overlay';
  overlay.id = 'autoSubmitOverlay';
  overlay.innerHTML = `
    <div class="mock-auto-submit-card">
      <div class="auto-icon">${isTimeout ? '⏱️' : '🎉'}</div>
      <h3>${isTimeout ? 'Hết giờ làm bài!' : 'Đã hoàn thành câu hỏi cuối cùng!'}</h3>
      <p>${isTimeout ? 'Thời gian làm bài đã kết thúc. Hệ thống đang tự động nộp bài thi của bạn...' : 'Toàn bộ bài thi đã được giải quyết! Đang tự động nộp bài và chấm điểm...'}</p>
      <div class="mock-countdown-circle" id="autoSubmitCountNum">${isTimeout ? '1' : '2'}</div>
      <button type="button" class="mock-btn-action primary" id="autoSubmitNowBtn">
        Nộp bài & Xem kết quả ngay ➔
      </button>
    </div>
  `;
  container.appendChild(overlay);

  let remaining = isTimeout ? 1 : 2;
  const countNum = overlay.querySelector('#autoSubmitCountNum');

  const countdown = setInterval(() => {
    remaining--;
    if (countNum) countNum.textContent = remaining;
    if (remaining <= 0) {
      clearInterval(countdown);
      overlay.remove();
      submitExam(container, examData, state);
    }
  }, 800);

  overlay.querySelector('#autoSubmitNowBtn')?.addEventListener('click', () => {
    clearInterval(countdown);
    overlay.remove();
    submitExam(container, examData, state);
  });
}

// Render khung phòng thi với Stepper 4 Phần rõ ràng
function renderExamRoom(container, examData, allQuestions, state) {
  container.innerHTML = `
    <div class="mock-arena">
      <!-- Top header phòng thi -->
      <div class="mock-arena-header">
        <div class="mock-header-left">
          <button type="button" class="mock-btn-exit" id="mockExitBtn" title="Thoát phòng thi">← Thoát</button>
          <div class="mock-header-info">
            <strong>${examData.title}</strong>
            <span class="mock-header-sub">Bài thi chính thức • 4 kỹ năng độc lập</span>
          </div>
        </div>

        <div class="mock-header-right">
          <label class="mock-auto-toggle" title="Tự động chuyển câu khi chọn đáp án và tự động nộp bài khi hoàn thành">
            <input type="checkbox" id="autoSubmitToggle" ${state.autoSubmit ? 'checked' : ''}>
            <span class="auto-toggle-text">⚡ Tự động nộp bài</span>
          </label>
          <div class="mock-timer-box">
            <span class="mock-timer-icon">⏱️</span>
            <span class="mock-timer-val" id="examTimer">${examData.durationMinutes}:00</span>
          </div>
          <button type="button" class="mock-btn-submit" id="mockSubmitTopBtn">Nộp bài thi</button>
        </div>
      </div>

      <!-- THANH TIẾN TRÌNH 4 PHẦN THI (SECTION STEPPER) RÕ RÀNG -->
      <div class="mock-stepper-bar">
        ${examData.sections.map((sec, idx) => `
          <button type="button" class="mock-stepper-item" data-jump-sec="${sec.id}" id="stepperSec_${sec.id}">
            <div class="stepper-step-num">PHẦN ${idx + 1}</div>
            <div class="stepper-step-main">
              <span class="stepper-step-icon">${sec.icon}</span>
              <strong class="stepper-step-name">${sec.name}</strong>
            </div>
            <div class="stepper-step-badge" data-sec-status="${sec.id}">
              <span class="stepper-count" data-sec-count="${sec.id}">0/${sec.questions.length}</span>
            </div>
          </button>
        `).join('')}
      </div>

      <!-- BẢN ĐỒ CÂU HỎI THEO 4 CỤM KỸ NĂNG -->
      <div class="mock-grouped-qmap">
        ${examData.sections.map((sec) => `
          <div class="qmap-group" data-qmap-sec="${sec.id}">
            <span class="qmap-group-title">${sec.icon} ${sec.name}:</span>
            <div class="qmap-group-dots">
              ${sec.questions.map((q) => {
                const globalIdx = allQuestions.findIndex((item) => item.id === q.id);
                return `
                  <button type="button" class="mock-q-dot" data-goto-index="${globalIdx}">
                    ${globalIdx + 1}
                  </button>
                `;
              }).join('')}
            </div>
          </div>
        `).join('')}
      </div>

      <!-- Nội dung câu hỏi đang xem -->
      <div class="mock-card-stage" id="questionStage">
        <!-- Render câu hỏi bằng updateQuestionStage -->
      </div>
    </div>

    <!-- Hộp chuyển tiếp giữa các phần (Intermission Modal) -->
    <div class="mock-intermission-overlay" id="intermissionOverlay" hidden>
      <div class="mock-intermission-card" id="intermissionCard">
        <!-- Nội dung cập nhật bằng triggerIntermissionModal -->
      </div>
    </div>
  `;

  // Gắn sự kiện bật/tắt Tự động nộp bài
  container.querySelector('#autoSubmitToggle')?.addEventListener('change', (e) => {
    state.autoSubmit = e.target.checked;
  });

  // Gắn sự kiện thoát
  container.querySelector('#mockExitBtn')?.addEventListener('click', () => {
    if (confirm('Bạn có chắc chắn muốn rời khỏi phòng thi? Kết quả hiện tại sẽ không được lưu.')) {
      clearInterval(state.timerInterval);
      window.speechSynthesis?.cancel();
      initMockExam({ selector: '[data-mock-exam]' });
    }
  });

  // Gắn sự kiện nộp bài
  container.querySelector('#mockSubmitTopBtn')?.addEventListener('click', () => {
    const answeredCount = Object.keys(state.answers).length;
    const total = allQuestions.length;
    if (answeredCount < total) {
      if (!confirm(`Bạn mới hoàn thành ${answeredCount}/${total} câu hỏi. Bạn có chắc chắn muốn nộp bài sớm?`)) {
        return;
      }
    }
    clearInterval(state.timerInterval);
    submitExam(container, examData, state);
  });

  // Gắn sự kiện nhảy theo kỹ năng trên stepper
  container.querySelectorAll('[data-jump-sec]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const secId = btn.dataset.jumpSec;
      const targetIdx = allQuestions.findIndex((q) => q.sectionId === secId);
      if (targetIdx !== -1) {
        state.currentIndex = targetIdx;
        updateQuestionStage(container, examData, allQuestions, state);
      }
    });
  });

  // Gắn sự kiện click vào số câu trên bản đồ
  container.querySelectorAll('[data-goto-index]').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.currentIndex = parseInt(btn.dataset.gotoIndex, 10);
      updateQuestionStage(container, examData, allQuestions, state);
    });
  });

  // Render câu hỏi đầu tiên
  updateQuestionStage(container, examData, allQuestions, state);
}

// Cập nhật hiển thị câu hỏi hiện tại
function updateQuestionStage(container, examData, allQuestions, state) {
  const stage = container.querySelector('#questionStage');
  if (!stage) return;

  const currentQ = allQuestions[state.currentIndex];
  const qNum = state.currentIndex + 1;
  const isFirst = state.currentIndex === 0;
  const isLast = state.currentIndex === allQuestions.length - 1;

  const currentSec = examData.sections[currentQ.sectionIndex];
  const qInSec = currentQ.questionIndexInSection + 1;
  const totalInSec = currentQ.totalQuestionsInSection;
  const isLastInSec = qInSec === totalInSec;
  const nextSec = examData.sections[currentQ.sectionIndex + 1];

  // Cập nhật highlight trên bản đồ câu hỏi
  container.querySelectorAll('.mock-q-dot').forEach((dot, idx) => {
    dot.classList.toggle('current', idx === state.currentIndex);
    const hasAnswer = state.answers[allQuestions[idx].id] !== undefined;
    dot.classList.toggle('answered', hasAnswer);
  });

  // Cập nhật Stepper 4 Phần
  const countsBySec = {};
  allQuestions.forEach((q) => {
    if (!countsBySec[q.sectionId]) countsBySec[q.sectionId] = { answered: 0, total: 0 };
    countsBySec[q.sectionId].total++;
    if (state.answers[q.id] !== undefined) countsBySec[q.sectionId].answered++;
  });

  examData.sections.forEach((sec, idx) => {
    const stepperItem = container.querySelector(`#stepperSec_${sec.id}`);
    const countEl = container.querySelector(`[data-sec-count="${sec.id}"]`);
    const statusBadge = container.querySelector(`[data-sec-status="${sec.id}"]`);
    if (countEl) countEl.textContent = `${countsBySec[sec.id].answered}/${countsBySec[sec.id].total}`;

    const isCurrentSec = sec.id === currentQ.sectionId;
    const isFinishedSec = countsBySec[sec.id].answered === countsBySec[sec.id].total;

    if (stepperItem) {
      stepperItem.classList.toggle('active', isCurrentSec);
      stepperItem.classList.toggle('finished', isFinishedSec && !isCurrentSec);
    }

    if (statusBadge) {
      if (isCurrentSec) {
        statusBadge.innerHTML = `<span class="badge-active">ĐANG THI</span>`;
      } else if (isFinishedSec) {
        statusBadge.innerHTML = `<span class="badge-done">✓ XONG</span>`;
      } else {
        statusBadge.innerHTML = `<span class="badge-pending">${countsBySec[sec.id].answered}/${countsBySec[sec.id].total}</span>`;
      }
    }
  });

  // Lời hướng dẫn nghiệp vụ theo từng kỹ năng
  const guideTexts = {
    listening: '👂 Hướng dẫn: Bấm nút loa để nghe đoạn audio tiếng Trung. Mỗi câu được phát tự động hoặc bấm nghe lại tự do.',
    reading: '📖 Hướng dẫn: Đọc kỹ chữ Hán, đối chiếu ngữ cảnh hoặc đoạn văn và chọn đáp án chính xác nhất.',
    writing: '✍️ Hướng dẫn: Chạm vào các từ bên dưới để sắp xếp thành câu hoàn chỉnh đúng trật tự ngữ pháp, hoặc chọn chữ Hán theo Pinyin.',
    speaking: '🎙️ Hướng dẫn: Nghe phát âm mẫu, sau đó bấm nút Micro để thu âm phát âm tiếng Trung của bạn (hoặc bấm xác nhận tự đọc).'
  };

  // Render form câu hỏi
  let questionBodyHtml = '';

  // 1. Dạng True / False (Phán đoán Đúng Sai)
  if (currentQ.type === 'true_false') {
    const chosen = state.answers[currentQ.id];
    questionBodyHtml = `
      <div class="mock-q-body">
        ${currentQ.audioText ? `
          <div class="mock-audio-control">
            <button type="button" class="mock-play-btn" id="playAudioBtn">
              <span class="audio-play-icon">🔊</span> Nghe phát âm
            </button>
            <span class="mock-audio-hint">Bấm để nghe âm thanh tiếng Trung</span>
          </div>
        ` : ''}

        <div class="mock-prompt-text">${currentQ.prompt}</div>

        <div class="mock-visual-box">
          ${currentQ.visual ? `<div class="mock-visual-big">${currentQ.visual}</div>` : ''}
          ${currentQ.visualLabel ? `<div class="mock-visual-sub">${currentQ.visualLabel}</div>` : ''}
          ${currentQ.hanziText ? `
            <div class="mock-hanzi-highlight">${currentQ.hanziText}</div>
            <div class="mock-pinyin-sub">${currentQ.pinyin || ''}</div>
          ` : ''}
        </div>

        <div class="mock-tf-options">
          <button type="button" class="mock-tf-btn ${chosen === true ? 'is-selected' : ''}" data-tf-val="true">
            <span class="tf-icon">✓</span>
            <span class="tf-label">Đúng (正确)</span>
          </button>
          <button type="button" class="mock-tf-btn ${chosen === false ? 'is-selected' : ''}" data-tf-val="false">
            <span class="tf-icon">✗</span>
            <span class="tf-label">Sai (错误)</span>
          </button>
        </div>
      </div>
    `;
  }

  // 2. Dạng Multiple Choice (Trắc nghiệm chọn A, B, C)
  else if (currentQ.type === 'multiple_choice' || currentQ.type === 'dialogue_choice') {
    const chosen = state.answers[currentQ.id];
    questionBodyHtml = `
      <div class="mock-q-body">
        ${(currentQ.audioText || currentQ.audioSpeech) ? `
          <div class="mock-audio-control">
            <button type="button" class="mock-play-btn" id="playAudioBtn">
              <span class="audio-play-icon">🔊</span> Nghe đoạn ghi âm
            </button>
            <span class="mock-audio-hint">Bấm nghe audio câu hỏi</span>
          </div>
        ` : ''}

        ${currentQ.passage ? `
          <div class="mock-passage-box">
            <div class="mock-passage-zh">${currentQ.passage}</div>
            <div class="mock-passage-py">${currentQ.passagePinyin || ''}</div>
          </div>
        ` : ''}

        <div class="mock-prompt-text">
          ${currentQ.hanziText ? `<strong class="mock-hanzi-head">${currentQ.hanziText}</strong>` : ''}
          <p>${currentQ.prompt}</p>
        </div>

        <div class="mock-choices-list">
          ${currentQ.options.map((opt) => `
            <button type="button" class="mock-choice-btn ${chosen === opt.id ? 'is-selected' : ''}" data-choice-id="${opt.id}">
              <span class="choice-letter">${opt.id}</span>
              <span class="choice-content">${opt.text}</span>
            </button>
          `).join('')}
        </div>
      </div>
    `;
  }

  // 3. Dạng Word Order (Sắp xếp từ thành câu)
  else if (currentQ.type === 'word_order') {
    const selectedChips = state.wordOrderSelections[currentQ.id] || [];
    const remainingChips = currentQ.chips.filter((chip) => {
      const usedCount = selectedChips.filter((s) => s === chip).length;
      const totalCount = currentQ.chips.filter((c) => c === chip).length;
      return usedCount < totalCount;
    });

    questionBodyHtml = `
      <div class="mock-q-body">
        <div class="mock-prompt-text">${currentQ.prompt}</div>
        <p class="mock-sentence-hint">Ý nghĩa câu: <em>"${currentQ.meaning}"</em></p>

        <!-- Khung đáp án đã sắp xếp -->
        <div class="mock-order-slot" id="orderAnswerSlot">
          ${selectedChips.length === 0 ? `
            <span class="order-slot-placeholder">Chạm vào các từ bên dưới để đưa vào đây...</span>
          ` : selectedChips.map((chip, idx) => `
            <button type="button" class="mock-chip in-slot" data-slot-index="${idx}">
              ${chip} <span class="chip-remove">×</span>
            </button>
          `).join('')}
        </div>

        <!-- Khung các từ còn lại -->
        <div class="mock-chips-tray">
          ${remainingChips.map((chip) => `
            <button type="button" class="mock-chip" data-tray-chip="${chip}">
              ${chip}
            </button>
          `).join('')}
        </div>

        <div class="mock-order-actions">
          <button type="button" class="mock-order-reset" id="resetOrderBtn">↺ Đặt lại từ đầu</button>
        </div>
      </div>
    `;
  }

  // 4. Dạng Speaking (Nói / HSKK)
  else if (currentQ.type === 'speech') {
    const currentVoiceState = state.speakingStatus[currentQ.id] || {};
    questionBodyHtml = `
      <div class="mock-q-body mock-speech-body">
        <div class="mock-prompt-text">${currentQ.prompt}</div>

        <div class="mock-speech-card">
          ${currentQ.questionAudio ? `
            <div class="mock-q-listen">
              <span class="mock-tag-audio">Câu hỏi:</span>
              <strong class="mock-speak-target">${currentQ.questionAudio}</strong>
              <small>${currentQ.questionPinyin || ''}</small>
              <p class="mock-speak-vn">${currentQ.questionMeaning || ''}</p>
              <button type="button" class="mock-btn-listen-sample" id="playQuestionAudioBtn">
                🔊 Nghe câu hỏi
              </button>
            </div>
            <div class="mock-sample-answer-box">
              <span class="mock-tag-sample">Gợi ý trả lời:</span>
              <strong>${currentQ.sampleAnswer}</strong>
              <small>${currentQ.samplePinyin || ''}</small>
            </div>
          ` : `
            <div class="mock-target-box">
              <strong class="mock-speak-target">${currentQ.targetSpeech}</strong>
              <small class="mock-speak-py">${currentQ.targetPinyin || ''}</small>
              <p class="mock-speak-vn">${currentQ.targetMeaning || ''}</p>
              <button type="button" class="mock-btn-listen-sample" id="playSampleAudioBtn">
                🔊 Nghe phát âm mẫu
              </button>
            </div>
          `}

          <!-- Khối ghi âm & nhận diện giọng nói -->
          <div class="mock-mic-zone">
            <button type="button" class="mock-mic-btn" id="startMicBtn">
              <span class="mic-icon">🎙️</span>
              <span class="mic-label">Bấm để nói</span>
            </button>
            <div class="mock-mic-status" id="micStatusText">
              ${currentVoiceState.text ? `Đã ghi nhận: "${currentVoiceState.text}"` : 'Sẵn sàng ghi âm... Hãy đọc to câu tiếng Trung!'}
            </div>

            ${currentVoiceState.score !== undefined ? `
              <div class="mock-score-pill ${currentVoiceState.score >= 70 ? 'good' : 'warning'}">
                Điểm phát âm: <strong>${currentVoiceState.score}/100</strong>
              </div>
            ` : ''}

            <!-- Nút fallback tự đánh giá nếu không có micro -->
            <div class="mock-speech-fallback">
              <button type="button" class="mock-btn-manual-verify ${state.answers[currentQ.id] ? 'is-verified' : ''}" id="manualVerifyBtn">
                ${state.answers[currentQ.id] ? '✓ Đã hoàn thành câu nói này' : '✓ Tôi đã phát âm to và rõ ràng'}
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  // Khung card câu hỏi phân chia phần rõ ràng
  stage.innerHTML = `
    <div class="mock-card sec-theme-${currentQ.sectionId}">
      <!-- BANNER TIÊU ĐỀ PHẦN THI ĐẬM NÉT THI THẬT -->
      <div class="mock-section-banner sec-${currentQ.sectionId}">
        <div class="banner-left">
          <span class="banner-badge">PHẦN ${currentQ.sectionIndex + 1} / 4</span>
          <strong class="banner-title">${currentQ.sectionIcon} ${currentQ.sectionName.toUpperCase()}</strong>
        </div>
        <div class="banner-right">
          <span class="banner-q-progress">Câu ${qInSec} / ${totalInSec} (Toàn bài: ${qNum}/20)</span>
        </div>
      </div>

      <!-- Khung hướng dẫn làm bài -->
      <div class="mock-guide-box">
        ${guideTexts[currentQ.sectionId] || ''}
      </div>

      ${questionBodyHtml}

      <!-- Thanh điều hướng chân trang câu hỏi -->
      <div class="mock-card-footer">
        <button type="button" class="mock-nav-btn prev" id="prevQBtn" ${isFirst ? 'disabled' : ''}>
          ‹ Câu trước
        </button>
        <div class="mock-nav-indicator">
          Phần ${currentQ.sectionIndex + 1}: Câu ${qInSec} / ${totalInSec}
        </div>
        <button type="button" class="mock-nav-btn next ${isLastInSec && nextSec ? 'btn-next-sec' : ''}" id="nextQBtn">
          ${isLast ? 'Hoàn thành bài thi & Nộp bài ✓' : isLastInSec && nextSec ? `Hoàn thành Phần ${currentQ.sectionIndex + 1} ➔ Sang ${nextSec.name} ›` : 'Câu tiếp theo ›'}
        </button>
      </div>
    </div>
  `;

  // Tự động phát âm thanh khi vào câu nghe
  if (currentQ.sectionId === 'listening') {
    const textToSpeak = currentQ.audioSpeech || currentQ.audioText;
    if (textToSpeak) {
      setTimeout(() => playChineseAudio(textToSpeak), 250);
    }
  }

  // Gắn sự kiện nút phát âm thanh
  stage.querySelector('#playAudioBtn')?.addEventListener('click', () => {
    playChineseAudio(currentQ.audioSpeech || currentQ.audioText);
  });
  stage.querySelector('#playSampleAudioBtn')?.addEventListener('click', () => {
    playChineseAudio(currentQ.targetSpeech);
  });
  stage.querySelector('#playQuestionAudioBtn')?.addEventListener('click', () => {
    playChineseAudio(currentQ.questionAudio);
  });

  // Gắn sự kiện True/False
  stage.querySelectorAll('[data-tf-val]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const val = btn.dataset.tfVal === 'true';
      state.answers[currentQ.id] = val;
      updateQuestionStage(container, examData, allQuestions, state);
      if (state.autoSubmit) {
        setTimeout(() => {
          if (isLast) {
            triggerAutoSubmitExam(container, examData, allQuestions, state, 'complete');
          } else if (isLastInSec && nextSec) {
            showSectionIntermission(container, examData, allQuestions, state, currentSec, nextSec);
          } else if (state.currentIndex < allQuestions.length - 1) {
            state.currentIndex++;
            updateQuestionStage(container, examData, allQuestions, state);
          }
        }, 400);
      }
    });
  });

  // Gắn sự kiện Multiple Choice
  stage.querySelectorAll('[data-choice-id]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const choiceId = btn.dataset.choiceId;
      state.answers[currentQ.id] = choiceId;
      updateQuestionStage(container, examData, allQuestions, state);
      if (state.autoSubmit) {
        setTimeout(() => {
          if (isLast) {
            triggerAutoSubmitExam(container, examData, allQuestions, state, 'complete');
          } else if (isLastInSec && nextSec) {
            showSectionIntermission(container, examData, allQuestions, state, currentSec, nextSec);
          } else if (state.currentIndex < allQuestions.length - 1) {
            state.currentIndex++;
            updateQuestionStage(container, examData, allQuestions, state);
          }
        }, 400);
      }
    });
  });

  // Gắn sự kiện Word Order: Thêm chip từ tray vào slot
  stage.querySelectorAll('[data-tray-chip]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const chip = btn.dataset.trayChip;
      state.wordOrderSelections[currentQ.id].push(chip);
      state.answers[currentQ.id] = state.wordOrderSelections[currentQ.id].join('');
      updateQuestionStage(container, examData, allQuestions, state);
    });
  });

  // Gắn sự kiện Word Order: Xóa chip khỏi slot
  stage.querySelectorAll('[data-slot-index]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const slotIdx = parseInt(btn.dataset.slotIndex, 10);
      state.wordOrderSelections[currentQ.id].splice(slotIdx, 1);
      if (state.wordOrderSelections[currentQ.id].length > 0) {
        state.answers[currentQ.id] = state.wordOrderSelections[currentQ.id].join('');
      } else {
        delete state.answers[currentQ.id];
      }
      updateQuestionStage(container, examData, allQuestions, state);
    });
  });

  // Gắn sự kiện Word Order: Đặt lại
  stage.querySelector('#resetOrderBtn')?.addEventListener('click', () => {
    state.wordOrderSelections[currentQ.id] = [];
    delete state.answers[currentQ.id];
    updateQuestionStage(container, examData, allQuestions, state);
  });

  // Gắn sự kiện Speaking: Microphone
  const startMicBtn = stage.querySelector('#startMicBtn');
  const micStatusText = stage.querySelector('#micStatusText');
  if (startMicBtn) {
    startMicBtn.addEventListener('click', () => {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SpeechRecognition) {
        alert('Trình duyệt của bạn hiện chưa hỗ trợ Web Speech Recognition. Bạn có thể sử dụng nút "Tôi đã phát âm to và rõ ràng" để hoàn thành câu.');
        return;
      }

      try {
        const recognition = new SpeechRecognition();
        recognition.lang = 'zh-CN';
        recognition.continuous = false;
        recognition.interimResults = false;

        startMicBtn.classList.add('is-listening');
        if (micStatusText) micStatusText.textContent = 'Đang lắng nghe bạn nói... Hãy phát âm to rõ ràng!';

        recognition.onresult = (event) => {
          const spokenText = event.results[0][0].transcript.trim();
          startMicBtn.classList.remove('is-listening');

          // Tính độ khớp
          let matchScore = 75;
          if (currentQ.expectedKeywords) {
            let matchedKeywords = 0;
            currentQ.expectedKeywords.forEach((kw) => {
              if (spokenText.includes(kw)) matchedKeywords++;
            });
            matchScore = Math.round(60 + (matchedKeywords / currentQ.expectedKeywords.length) * 40);
          }

          state.speakingStatus[currentQ.id] = {
            text: spokenText,
            score: matchScore,
            verified: true
          };
          state.answers[currentQ.id] = spokenText;
          updateQuestionStage(container, examData, allQuestions, state);
          if (state.autoSubmit && isLast) {
            setTimeout(() => {
              triggerAutoSubmitExam(container, examData, allQuestions, state, 'complete');
            }, 800);
          }
        };

        recognition.onerror = () => {
          startMicBtn.classList.remove('is-listening');
          if (micStatusText) {
            micStatusText.textContent = 'Không nhận diện được giọng nói hoặc chưa cấp quyền micro. Bạn có thể bấm xác nhận bên dưới.';
          }
        };

        recognition.onend = () => {
          startMicBtn.classList.remove('is-listening');
        };

        recognition.start();
      } catch (err) {
        startMicBtn.classList.remove('is-listening');
        alert('Không thể khởi động micro: ' + err.message);
      }
    });
  }

  // Gắn sự kiện Speaking: Tự xác nhận
  stage.querySelector('#manualVerifyBtn')?.addEventListener('click', () => {
    state.speakingStatus[currentQ.id] = {
      text: 'Đã hoàn thành tự phát âm',
      score: 85,
      verified: true
    };
    state.answers[currentQ.id] = 'Đã nói';
    updateQuestionStage(container, examData, allQuestions, state);
    if (state.autoSubmit && isLast) {
      setTimeout(() => {
        triggerAutoSubmitExam(container, examData, allQuestions, state, 'complete');
      }, 700);
    }
  });

  // Gắn sự kiện Chuyển câu trước
  stage.querySelector('#prevQBtn')?.addEventListener('click', () => {
    if (state.currentIndex > 0) {
      state.currentIndex--;
      updateQuestionStage(container, examData, allQuestions, state);
    }
  });

  // Gắn sự kiện Chuyển câu sau / Chuyển phần tiếp theo
  stage.querySelector('#nextQBtn')?.addEventListener('click', () => {
    if (isLastInSec && nextSec) {
      // Hết một phần -> Kích hoạt màn hình chuyển tiếp giữa các phần
      showSectionIntermission(container, examData, allQuestions, state, currentSec, nextSec);
    } else if (state.currentIndex < allQuestions.length - 1) {
      state.currentIndex++;
      updateQuestionStage(container, examData, allQuestions, state);
    } else {
      // Đang ở câu cuối cùng của đề -> Tự động nộp bài
      triggerAutoSubmitExam(container, examData, allQuestions, state, 'complete');
    }
  });
}

// -------------------------------------------------------------
// 3. MÀN HÌNH CHUYỂN TIẾP GIỮA CÁC PHẦN (INTERMISSION)
// -------------------------------------------------------------
function showSectionIntermission(container, examData, allQuestions, state, currentSec, nextSec) {
  const overlay = container.querySelector('#intermissionOverlay');
  const card = container.querySelector('#intermissionCard');
  if (!overlay || !card) return;

  // Đếm số câu đã trả lời trong phần vừa xong
  let answeredInCurrent = 0;
  currentSec.questions.forEach((q) => {
    if (state.answers[q.id] !== undefined) answeredInCurrent++;
  });

  card.innerHTML = `
    <div class="intermission-badge">✓ HOÀN THÀNH PHẦN ${currentSec.name}</div>
    <div class="intermission-icon">🎉</div>
    <h3>Chúc mừng! Bạn đã hoàn thành ${currentSec.name}</h3>
    <p>Đã trả lời: <strong>${answeredInCurrent}/${currentSec.questions.length} câu hỏi</strong>.</p>

    <!-- Khối giới thiệu phần tiếp theo -->
    <div class="intermission-next-box sec-${nextSec.id}">
      <span class="next-box-tag">PHẦN TIẾP THEO:</span>
      <strong class="next-box-title">${nextSec.icon} ${nextSec.name}</strong>
      <p class="next-box-desc">${nextSec.desc}</p>
      <div class="next-box-meta">
        <span>📝 ${nextSec.questions.length} câu hỏi</span>
        <span>⏱️ Khoảng ${nextSec.id === 'reading' ? '10' : nextSec.id === 'writing' ? '10' : '7'} phút</span>
      </div>
    </div>

    <!-- Nút hành động -->
    <div class="intermission-actions">
      <button type="button" class="mock-btn-action secondary" id="intermissionStayBtn">
        ← Xem lại các câu trong ${currentSec.name}
      </button>
      <button type="button" class="mock-btn-action primary large" id="intermissionGoNextBtn">
        Bắt đầu làm ${nextSec.name} ➔
      </button>
    </div>
  `;

  overlay.hidden = false;

  // Xem lại phần cũ
  card.querySelector('#intermissionStayBtn')?.addEventListener('click', () => {
    overlay.hidden = true;
  });

  // Tiếp tục sang phần mới
  card.querySelector('#intermissionGoNextBtn')?.addEventListener('click', () => {
    overlay.hidden = true;
    state.currentIndex++;
    updateQuestionStage(container, examData, allQuestions, state);
  });
}

// -------------------------------------------------------------
// 4. CHẤM ĐIỂM & BÁO CÁO KẾT QUẢ THEO 4 PHẦN (RESULTS & REVIEW)
// -------------------------------------------------------------
function submitExam(container, examData, state) {
  state.isSubmitted = true;
  clearInterval(state.timerInterval);
  window.speechSynthesis?.cancel();

  // Flatten câu hỏi
  const allQuestions = [];
  examData.sections.forEach((sec, secIdx) => {
    sec.questions.forEach((q, qIdxInSec) => {
      allQuestions.push({
        ...q,
        sectionIndex: secIdx,
        sectionName: sec.name,
        sectionIcon: sec.icon,
        questionIndexInSection: qIdxInSec
      });
    });
  });

  // Chấm điểm từng câu hỏi
  let totalScore = 0;
  const sectionScores = {
    listening: { correct: 0, total: 5, points: 0 },
    reading: { correct: 0, total: 5, points: 0 },
    writing: { correct: 0, total: 5, points: 0 },
    speaking: { correct: 0, total: 5, points: 0 }
  };

  const resultsDetail = allQuestions.map((q) => {
    const userAnswer = state.answers[q.id];
    let isCorrect = false;

    if (q.type === 'true_false') {
      isCorrect = userAnswer === q.correctAnswer;
    } else if (q.type === 'multiple_choice' || q.type === 'dialogue_choice') {
      isCorrect = userAnswer === q.correctAnswer;
    } else if (q.type === 'word_order') {
      isCorrect = userAnswer === q.targetSentence || (q.alternatives && q.alternatives.includes(userAnswer));
    } else if (q.type === 'speech') {
      isCorrect = userAnswer !== undefined && userAnswer !== '';
    }

    if (isCorrect) {
      sectionScores[q.sectionId].correct++;
      sectionScores[q.sectionId].points += 5; // Mỗi câu 5 điểm -> 25 điểm / kỹ năng -> 100 điểm tổng
      totalScore += 5;
    }

    return {
      question: q,
      userAnswer,
      isCorrect
    };
  });

  const isPassed = totalScore >= examData.passScore;
  const expReward = examData.expReward || 100;

  // Ghi nhận điểm và thưởng EXP
  recordScore({
    category: 'mock_exam',
    points: isPassed ? SCORE_RULES.MOCK_EXAM_COMPLETED : Math.round(SCORE_RULES.MOCK_EXAM_COMPLETED / 2),
    description: `Hoàn thành ${examData.title} (${totalScore}/100)`
  });

  awardLuluExp(isPassed ? expReward : Math.round(expReward / 2), {
    source: `Thi thử ${examData.id.toUpperCase()} (${totalScore} điểm)`,
    foodDrop: true
  });

  // Render màn hình kết quả
  renderExamResult(container, examData, totalScore, isPassed, sectionScores, resultsDetail);
}

// Render màn hình kết quả bài thi phân chia rõ rệt
function renderExamResult(container, examData, totalScore, isPassed, sectionScores, resultsDetail) {
  const expReward = examData.expReward || 100;

  container.innerHTML = `
    <div class="mock-result-wrap">
      <div class="mock-result-card ${isPassed ? 'is-pass' : 'is-fail'}">
        <div class="mock-result-mascot">
          <img src="${isPassed ? 'picture/leaderboard.png' : 'picture/main_picture.png'}" alt="Linh vật LuLu">
        </div>

        <div class="mock-result-header">
          <div class="mock-result-badge">${isPassed ? '🎉 CHÚC MỪNG BẠN ĐÃ ĐẠT!' : '💪 CẦN CỐ GẮNG THÊM!'}</div>
          <h2>${examData.title}</h2>
          <p>${isPassed ? 'Bạn đã xuất sắc vượt qua bài thi thử chuẩn 4 kỹ năng!' : 'Đừng nản lòng, hãy xem lại các câu sai để củng cố kiến thức nhé!'}</p>
        </div>

        <div class="mock-score-dashboard">
          <div class="mock-main-score">
            <span class="score-num">${totalScore}</span>
            <span class="score-max">/ 100 Điểm</span>
          </div>

          <div class="mock-hsk-scale">
            Quy đổi chuẩn HSK: <strong>${Math.round((totalScore / 100) * 300)} / 300 Điểm</strong>
            <span class="hsk-pass-hint">(Điểm đạt: 180 / 300)</span>
          </div>
        </div>

        <!-- BẢNG ĐIỂM CHI TIẾT 4 PHẦN THI ĐỘC LẬP -->
        <div class="mock-breakdown-grid">
          <div class="mock-breakdown-col sec-listening">
            <span class="skill-icon">🎧</span>
            <strong>Phần 1: Nghe hiểu</strong>
            <div class="breakdown-bar">
              <i style="width: ${(sectionScores.listening.points / 25) * 100}%"></i>
            </div>
            <span>${sectionScores.listening.points} / 25 điểm (${sectionScores.listening.correct}/5 câu)</span>
          </div>

          <div class="mock-breakdown-col sec-reading">
            <span class="skill-icon">📖</span>
            <strong>Phần 2: Đọc hiểu</strong>
            <div class="breakdown-bar">
              <i style="width: ${(sectionScores.reading.points / 25) * 100}%"></i>
            </div>
            <span>${sectionScores.reading.points} / 25 điểm (${sectionScores.reading.correct}/5 câu)</span>
          </div>

          <div class="mock-breakdown-col sec-writing">
            <span class="skill-icon">✍️</span>
            <strong>Phần 3: Viết</strong>
            <div class="breakdown-bar">
              <i style="width: ${(sectionScores.writing.points / 25) * 100}%"></i>
            </div>
            <span>${sectionScores.writing.points} / 25 điểm (${sectionScores.writing.correct}/5 câu)</span>
          </div>

          <div class="mock-breakdown-col sec-speaking">
            <span class="skill-icon">🎙️</span>
            <strong>Phần 4: Nói (HSKK)</strong>
            <div class="breakdown-bar">
              <i style="width: ${(sectionScores.speaking.points / 25) * 100}%"></i>
            </div>
            <span>${sectionScores.speaking.points} / 25 điểm (${sectionScores.speaking.correct}/5 câu)</span>
          </div>
        </div>

        <!-- Phần thưởng -->
        <div class="mock-reward-pill">
          <span>🎁 Phần thưởng: <strong>+${isPassed ? expReward : Math.round(expReward / 2)} LuLu EXP</strong> và đã nhận thêm thức ăn cho LuLu!</span>
        </div>

        <!-- Nút hành động -->
        <div class="mock-result-actions">
          <button type="button" class="mock-btn-action primary" id="toggleReviewBtn">
            📖 Xem đáp án & giải thích chi tiết
          </button>
          <button type="button" class="mock-btn-action secondary" id="retryExamBtn">
            🔄 Làm lại đề thi này
          </button>
          <button type="button" class="mock-btn-action ghost" id="backToLobbyBtn">
            📋 Danh sách đề thi khác
          </button>
        </div>
      </div>

      <!-- KHU VỰC XEM LẠI BÀI THI PHÂN CHIA THEO 4 TAB KỸ NĂNG -->
      <div class="mock-review-section" id="reviewSection" hidden>
        <div class="mock-review-header">
          <h3>Chi tiết đáp án & giải thích 20 câu hỏi</h3>
          <p>Đối chiếu câu trả lời của bạn với đáp án chuẩn HSK và xem giải nghĩa ngữ pháp, từ vựng theo từng phần.</p>
        </div>

        <!-- 5 TAB LỌC KỸ NĂNG XEM LẠI -->
        <div class="mock-review-tabs">
          <button type="button" class="review-tab active" data-review-filter="all">Tất cả (20 câu)</button>
          <button type="button" class="review-tab" data-review-filter="listening">🎧 1. Nghe hiểu (5 câu)</button>
          <button type="button" class="review-tab" data-review-filter="reading">📖 2. Đọc hiểu (5 câu)</button>
          <button type="button" class="review-tab" data-review-filter="writing">✍️ 3. Viết (5 câu)</button>
          <button type="button" class="review-tab" data-review-filter="speaking">🎙️ 4. Nói (5 câu)</button>
        </div>

        <div class="mock-review-list" id="reviewListContainer">
          <!-- Render danh sách review bằng renderReviewListItems -->
        </div>
      </div>
    </div>
  `;

  // Render review list items
  const renderReviewListItems = (filter = 'all') => {
    const listContainer = container.querySelector('#reviewListContainer');
    if (!listContainer) return;

    const filtered = resultsDetail.filter((item) => {
      if (filter === 'all') return true;
      return item.question.sectionId === filter;
    });

    listContainer.innerHTML = filtered.map((item) => {
      const q = item.question;
      const isCorrect = item.isCorrect;
      const qIdx = resultsDetail.findIndex((r) => r.question.id === q.id);

      return `
        <div class="mock-review-item ${isCorrect ? 'is-correct' : 'is-wrong'} sec-${q.sectionId}">
          <div class="mock-review-meta">
            <span class="review-q-num">Câu ${qIdx + 1}</span>
            <span class="review-status-tag ${isCorrect ? 'correct' : 'wrong'}">
              ${isCorrect ? '✓ Làm đúng (+5đ)' : '✗ Chưa đúng (0đ)'}
            </span>
            <span class="review-sec-tag">${q.sectionIcon} ${q.sectionName}</span>
          </div>

          <div class="mock-review-prompt">
            <strong>${q.prompt}</strong>
            ${q.audioText ? `<p class="review-audio-line">🔊 Audio: <em>"${q.audioText}"</em> ${q.pinyin ? `(${q.pinyin})` : ''}</p>` : ''}
            ${q.hanziText ? `<p class="review-hanzi-line">Chữ Hán: <strong>${q.hanziText}</strong> ${q.pinyin ? `(${q.pinyin})` : ''}</p>` : ''}
            ${q.passage ? `<p class="review-passage-line">Đoạn văn: "${q.passage}"</p>` : ''}
          </div>

          <div class="mock-review-answers">
            <div class="user-ans">
              <span>Câu trả lời của bạn:</span>
              <strong>${formatAnswerText(item.userAnswer, q)}</strong>
            </div>
            <div class="correct-ans">
              <span>Đáp án chính xác:</span>
              <strong>${formatCorrectAnswerText(q)}</strong>
            </div>
          </div>

          <div class="mock-review-explanation">
            💡 <strong>Giải thích ngữ pháp & từ vựng:</strong> ${q.explanation}
          </div>
        </div>
      `;
    }).join('');
  };

  // Gắn sự kiện nút xem review
  const toggleBtn = container.querySelector('#toggleReviewBtn');
  const reviewSection = container.querySelector('#reviewSection');
  if (toggleBtn && reviewSection) {
    toggleBtn.addEventListener('click', () => {
      const isHidden = reviewSection.hidden;
      reviewSection.hidden = !isHidden;
      toggleBtn.textContent = isHidden ? 'Ẩn bớt giải thích ▲' : '📖 Xem đáp án & giải thích chi tiết';
      if (isHidden) {
        renderReviewListItems('all');
        reviewSection.scrollIntoView({ behavior: 'smooth' });
      }
    });
  }

  // Gắn sự kiện 5 Tab lọc review
  container.querySelectorAll('[data-review-filter]').forEach((tab) => {
    tab.addEventListener('click', () => {
      container.querySelectorAll('[data-review-filter]').forEach((t) => t.classList.remove('active'));
      tab.classList.add('active');
      renderReviewListItems(tab.dataset.reviewFilter);
    });
  });

  // Gắn sự kiện làm lại
  container.querySelector('#retryExamBtn')?.addEventListener('click', () => {
    startExam(container, examData);
  });

  // Gắn sự kiện về lobby
  container.querySelector('#backToLobbyBtn')?.addEventListener('click', () => {
    initMockExam({ selector: '[data-mock-exam]' });
  });
}

// Định dạng câu trả lời của user cho review
function formatAnswerText(ans, q) {
  if (ans === undefined || ans === null || ans === '') {
    return '<em style="color:#94a3b8">(Chưa trả lời)</em>';
  }
  if (typeof ans === 'boolean') {
    return ans ? '✓ Đúng (正确)' : '✗ Sai (错误)';
  }
  if (q.type === 'multiple_choice' || q.type === 'dialogue_choice') {
    const opt = q.options?.find((o) => o.id === ans);
    return opt ? `${opt.id}. ${opt.text}` : ans;
  }
  return String(ans);
}

// Định dạng đáp án đúng cho review
function formatCorrectAnswerText(q) {
  if (typeof q.correctAnswer === 'boolean') {
    return q.correctAnswer ? '✓ Đúng (正确)' : '✗ Sai (错误)';
  }
  if (q.options && q.correctAnswer) {
    const opt = q.options.find((o) => o.id === q.correctAnswer);
    return opt ? `${opt.id}. ${opt.text}` : q.correctAnswer;
  }
  if (q.targetSentence) {
    return q.targetSentence;
  }
  if (q.targetSpeech) {
    return `${q.targetSpeech} (${q.targetPinyin || ''})`;
  }
  if (q.sampleAnswer) {
    return `${q.sampleAnswer} (${q.samplePinyin || ''})`;
  }
  return '—';
}

