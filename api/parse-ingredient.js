const Anthropic = require('@anthropic-ai/sdk');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { text } = req.body || {};
  if (!text || !text.trim()) return res.status(200).json({ name: text || '', amount: '' });

  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 60,
      messages: [{
        role: 'user',
        content: `요리 재료 텍스트를 재료명과 수량으로 분리해서 JSON만 반환하세요. 수량이 없으면 amount는 빈 문자열.
예시: "양파 5개"→{"name":"양파","amount":"5개"}, "간장 1숟"→{"name":"간장","amount":"1숟"}, "소금 약간"→{"name":"소금","amount":"약간"}, "소주 100미리"→{"name":"소주","amount":"100미리"}
텍스트: "${text.trim()}"`
      }]
    });
    const raw = message.content[0].text.trim().replace(/^```json\s*/i, '').replace(/```\s*$/, '');
    const result = JSON.parse(raw);
    return res.status(200).json(result);
  } catch (err) {
    return res.status(200).json({ name: text.trim(), amount: '', _err: err?.message || String(err) });
  }
};
