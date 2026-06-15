import Anthropic from '@anthropic-ai/sdk';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { text } = req.body || {};
  if (!text || !text.trim()) {
    return res.status(200).json({ name: text || '', amount: '' });
  }

  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 60,
      messages: [{
        role: 'user',
        content: `요리 재료 텍스트를 재료명과 수량으로 분리해서 JSON만 반환하세요. 수량이 없으면 amount는 빈 문자열.
예시: "양파 5개"→{"name":"양파","amount":"5개"}, "간장 작은1숟"→{"name":"간장","amount":"작은1숟"}, "소금 약간"→{"name":"소금","amount":"약간"}, "소주 100미리"→{"name":"소주","amount":"100ml"}, "소금"→{"name":"소금","amount":""}
텍스트: "${text.trim()}"`
      }]
    });

    const result = JSON.parse(message.content[0].text.trim());
    return res.status(200).json(result);
  } catch {
    return res.status(200).json({ name: text.trim(), amount: '' });
  }
}
