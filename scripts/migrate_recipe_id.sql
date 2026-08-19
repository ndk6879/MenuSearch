-- ============================================================
-- Migration: UUID recipe_id + video_id grouping
-- Run in Supabase SQL Editor
-- ============================================================

-- 1. recipes: video_id 컬럼 추가
ALTER TABLE recipes ADD COLUMN IF NOT EXISTS video_id text;

-- 2. video_id 백필 (기존 url에서 YouTube ID 추출)
UPDATE recipes SET video_id =
  CASE
    WHEN url ~ 'youtu\.be/([A-Za-z0-9_-]{11})'
      THEN substring(url FROM 'youtu\.be/([A-Za-z0-9_-]{11})')
    WHEN url ~ '[?&]v=([A-Za-z0-9_-]{11})'
      THEN substring(url FROM '[?&]v=([A-Za-z0-9_-]{11})')
    WHEN url ~ '/shorts/([A-Za-z0-9_-]{11})'
      THEN substring(url FROM '/shorts/([A-Za-z0-9_-]{11})')
    ELSE NULL
  END
WHERE video_id IS NULL;

-- 3. video_id 인덱스
CREATE INDEX IF NOT EXISTS idx_recipes_video_id ON recipes(video_id);

-- 4. url UNIQUE 제약 제거
ALTER TABLE recipes DROP CONSTRAINT IF EXISTS recipes_url_key;

-- 5. bookmarks: recipe_id 컬럼 추가 (UUID FK)
ALTER TABLE bookmarks
  ADD COLUMN IF NOT EXISTS recipe_id uuid REFERENCES recipes(id) ON DELETE CASCADE;

-- 6. bookmarks recipe_id 백필 (recipe_url → recipes.id)
UPDATE bookmarks b
SET recipe_id = r.id
FROM recipes r
WHERE b.recipe_url = r.url
  AND b.recipe_id IS NULL;

-- 7. bookmarks recipe_id 인덱스
CREATE INDEX IF NOT EXISTS idx_bookmarks_recipe_id ON bookmarks(recipe_id);

-- 8. bookmarks recipe_url NOT NULL 제거 — recipe_id만으로 저장 가능하게
ALTER TABLE bookmarks ALTER COLUMN recipe_url DROP NOT NULL;

-- 9. bookmarks (user_id, recipe_id) 유니크 제약 — upsert 충돌 해소용
ALTER TABLE bookmarks
  ADD CONSTRAINT bookmarks_user_recipe_unique UNIQUE (user_id, recipe_id);

-- 확인용
SELECT 'recipes video_id 백필 완료: ' || COUNT(*) || '개' FROM recipes WHERE video_id IS NOT NULL;
SELECT 'bookmarks recipe_id 백필 완료: ' || COUNT(*) || '개' FROM bookmarks WHERE recipe_id IS NOT NULL;
