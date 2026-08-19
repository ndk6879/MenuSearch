-- gallery_jobs: 갤러리 생성 작업 큐 (중단 복구 / 동시성 제한용)
CREATE TABLE IF NOT EXISTS gallery_jobs (
  id         uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  recipe_id  uuid REFERENCES recipes(id) ON DELETE CASCADE NOT NULL,
  status     text DEFAULT 'queued' CHECK (status IN ('queued', 'processing', 'done', 'failed')),
  attempts   int  DEFAULT 0,
  error      text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_gallery_jobs_status    ON gallery_jobs(status);
CREATE INDEX IF NOT EXISTS idx_gallery_jobs_recipe_id ON gallery_jobs(recipe_id);

-- 같은 레시피에 동시에 queued/processing 작업 중복 방지
CREATE UNIQUE INDEX IF NOT EXISTS idx_gallery_jobs_recipe_active
  ON gallery_jobs(recipe_id) WHERE status IN ('queued', 'processing');

-- updated_at 자동 갱신 트리거
CREATE OR REPLACE FUNCTION update_gallery_jobs_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS gallery_jobs_updated_at ON gallery_jobs;
CREATE TRIGGER gallery_jobs_updated_at
  BEFORE UPDATE ON gallery_jobs
  FOR EACH ROW EXECUTE FUNCTION update_gallery_jobs_updated_at();
