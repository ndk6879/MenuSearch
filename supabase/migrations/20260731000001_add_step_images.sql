-- recipes 테이블에 step_images 컬럼 추가
-- {step_index: image_url} 형태의 JSON 저장
ALTER TABLE recipes ADD COLUMN IF NOT EXISTS step_images jsonb DEFAULT NULL;
