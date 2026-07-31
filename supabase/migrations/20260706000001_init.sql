-- Findish Supabase Schema
-- Supabase SQL Editor에서 실행하세요

-- 1. recipes 테이블 (menuData_kr.js 대체)
CREATE TABLE IF NOT EXISTS recipes (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  ingredients text[] DEFAULT '{}',
  steps text[] DEFAULT '{}',
  source text,
  url text UNIQUE,
  uploader text,
  upload_date date,
  creator_id text,
  status text DEFAULT 'published',
  language text DEFAULT 'kr',
  thumbnail_url text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 2. bookmarks 테이블 (Firestore users/{uid}/bookmarks 대체)
CREATE TABLE IF NOT EXISTS bookmarks (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id text NOT NULL,
  recipe_url text NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, recipe_url)
);

-- 3. RLS 활성화
ALTER TABLE recipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookmarks ENABLE ROW LEVEL SECURITY;

-- 4. recipes RLS 정책
-- 누구나 published 레시피 읽기 가능
CREATE POLICY "anyone_read_published" ON recipes
  FOR SELECT USING (status = 'published');

-- 크리에이터는 본인 레시피 관리 가능
CREATE POLICY "creator_manage_own" ON recipes
  FOR ALL USING ((auth.jwt() ->> 'sub') = creator_id);

-- 5. bookmarks RLS 정책
-- 본인 북마크만 접근 가능
CREATE POLICY "users_own_bookmarks_select" ON bookmarks
  FOR SELECT USING ((auth.jwt() ->> 'sub') = user_id);

CREATE POLICY "users_own_bookmarks_insert" ON bookmarks
  FOR INSERT WITH CHECK ((auth.jwt() ->> 'sub') = user_id);

CREATE POLICY "users_own_bookmarks_delete" ON bookmarks
  FOR DELETE USING ((auth.jwt() ->> 'sub') = user_id);

-- 6. updated_at 자동 갱신 트리거
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER recipes_updated_at
  BEFORE UPDATE ON recipes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
