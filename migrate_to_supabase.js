require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function migrate() {
  const content = fs.readFileSync('src/menuData_kr.js', 'utf8');
  const match = content.match(/const menuData_kr = (\[[\s\S]*?\]);/);
  const menuData = JSON.parse(match[1]);

  console.log(`총 ${menuData.length}개 레시피 마이그레이션 시작...`);
  let success = 0, skipped = 0, failed = 0;

  for (const item of menuData) {
    const url = item.url || '';
    if (!url) { skipped++; continue; }

    const recipe = {
      name: item.name || item['메뉴'] || '',
      ingredients: item.ingredients || item['재료'] || [],
      steps: item.steps || item['순서'] || [],
      source: item.source || item['출처'] || '',
      url,
      uploader: item.uploader || '',
      upload_date: item.upload_date ? item.upload_date.toString().replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3') : null,
      creator_id: item.uploader || null,
      status: 'published',
      language: 'kr',
      thumbnail_url: item.thumbnail || null,
    };

    const { error } = await supabase
      .from('recipes')
      .upsert(recipe, { onConflict: 'url' });

    if (error) {
      console.error(`실패: ${recipe.name} - ${error.message}`);
      failed++;
    } else {
      success++;
      if (success % 100 === 0) console.log(`진행중... ${success}개 완료`);
    }
  }

  console.log(`\n완료: 성공 ${success} / 스킵 ${skipped} / 실패 ${failed}`);
}

migrate().catch(console.error);
