-- Run once in the Supabase SQL Editor.
-- Chuẩn hóa cột book_level của bảng vocabulary: các giá trị bị thiếu dấu cách
-- ("HSK1", "HSK3"...) sẽ được sửa thành "HSK 1", "HSK 3"... để trang Từ vựng
-- không sinh ra tab cấp độ trùng lặp.

update public.vocabulary
set book_level = regexp_replace(book_level, '^HSK\s*([1-6])$', 'HSK \1')
where book_level ~ '^HSK\s*[1-6]$'
  and book_level <> regexp_replace(book_level, '^HSK\s*([1-6])$', 'HSK \1');

-- Kiểm tra lại danh sách cấp độ sau khi chuẩn hóa
select book_level, count(*) as so_tu
from public.vocabulary
group by book_level
order by book_level;