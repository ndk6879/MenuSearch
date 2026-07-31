export default async function handler(req, res) {
  try {
    const response = await fetch(
      `${process.env.REACT_APP_SUPABASE_URL}/rest/v1/recipes?select=name&limit=1`,
      {
        headers: {
          apikey: process.env.REACT_APP_SUPABASE_ANON_KEY,
          Authorization: `Bearer ${process.env.REACT_APP_SUPABASE_ANON_KEY}`,
        },
      }
    );
    res.status(200).json({ ok: response.ok, timestamp: new Date().toISOString() });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
}
