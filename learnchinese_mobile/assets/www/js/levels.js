/**
 * Chuẩn hóa cấp độ lấy từ cột book_level của bảng vocabulary.
 * Dữ liệu nhập tay có thể thiếu dấu cách ("HSK1", "hsk 3", " HSK 1 ")
 * nên mọi nơi hiển thị cấp độ đều đi qua hàm này để tránh sinh ra tab trùng.
 */
export function normalizeLevel(level = '') {
  const value = String(level).trim();
  const match = value.replace(/\s+/g, '').match(/^HSK([1-6])$/i);
  return match ? `HSK ${match[1]}` : value;
}

/**
 * Sắp xếp danh sách cấp độ: HSK 1 → HSK 6 trước, các nhóm khác (Công xưởng...) xếp sau theo alphabet.
 * Đầu vào đi qua normalizeLevel nên các bản ghi cũ ("HSK3" lẫn "HSK 3") gộp lại làm một,
 * tránh sinh ra tab trùng trên trang Từ vựng / Hồ sơ.
 */
export function sortLevels(levels) {
  const hskRank = (level) => {
    const match = level.match(/^HSK ([1-6])$/);
    return match ? Number(match[1]) : 99;
  };

  const unique = [];
  levels.forEach((level) => {
    const normalized = normalizeLevel(level);
    if (normalized && !unique.includes(normalized)) unique.push(normalized);
  });

  return unique.sort((a, b) => hskRank(a) - hskRank(b) || a.localeCompare(b, 'vi'));
}