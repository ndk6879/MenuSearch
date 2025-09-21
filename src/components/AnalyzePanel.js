import React, { useState } from "react";

/**
 * 개선 사항
 * - /analyze-save → /analyze → (상대경로/프록시) → http://localhost:8000 → http://127.0.0.1:8000 순으로 폴백
 * - AbortController로 타임아웃(25s)
 * - 응답이 JSON이 아니거나 status!=ok일 때 친절한 에러
 * - logs 없어도 동작 (UI는 유지)
 */
export default function AnalyzePanel({ apiBase = "http://localhost:8000", darkMode = false }) {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState([]);       // 디자인 유지용
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  // endpoint 후보들을 상황에 맞춰 구성
  const buildCandidates = () => {
    // apiBase가 비어있으면(프록시 사용) 상대경로 우선
    const relative = ["/api/analyze-save", "/api/analyze", "/analyze-save", "/analyze"];
    const abs = [
      `${apiBase.replace(/\/+$/,"")}/analyze-save`,
      `${apiBase.replace(/\/+$/,"")}/analyze`,
      "http://localhost:8000/analyze-save",
      "http://localhost:8000/analyze",
      "http://127.0.0.1:8000/analyze-save",
      "http://127.0.0.1:8000/analyze",
    ];
    // apiBase를 명시했으면 절대경로부터, 아니면 상대경로부터 시도
    return apiBase ? abs : [...relative, ...abs];
  };

  // 타임아웃 가능한 fetch
  const fetchWithTimeout = async (input, init = {}, ms = 25000) => {
    const ctrl = new AbortController();
    const id = setTimeout(() => ctrl.abort(), ms);
    try {
      return await fetch(input, { ...init, signal: ctrl.signal });
    } finally {
      clearTimeout(id);
    }
  };

  const run = async () => {
    setLoading(true);
    setLogs([]);        // 안 써도 디자인 유지
    setResult(null);
    setError("");

    if (!url) {
      setError("URL을 입력하세요.");
      setLoading(false);
      return;
    }

    const body = JSON.stringify({ url });
    const headers = { "Content-Type": "application/json", Accept: "application/json" };
    const candidates = buildCandidates();

    let lastErr = "";
    for (const ep of candidates) {
      try {
        const resp = await fetchWithTimeout(ep, { method: "POST", headers, body }, 25000);
        // 일부 환경에서 CORS 차단 시 status가 0이거나 ok=false 일 수 있음
        if (!resp.ok) {
          lastErr = `HTTP ${resp.status} @ ${ep}`;
          continue;
        }
        // JSON 파싱 시도
        let data;
        try {
          data = await resp.json();
        } catch {
          lastErr = `JSON 파싱 실패 @ ${ep}`;
          continue;
        }
        if (data && data.ok) {
          // 백엔드가 logs 안 줄 수도 있어도 안전
          setLogs(Array.isArray(data.logs) ? data.logs : []);
          setResult(data.result || null);
          setLoading(false);
          return;
        } else {
          lastErr = (data && data.error) ? `${data.error} @ ${ep}` : `분석 실패 @ ${ep}`;
          // 다른 후보도 계속 시도
        }
      } catch (e) {
        // 네트워크/타임아웃/CORS 등
        lastErr = `${String(e)} @ ${ep}`;
        continue;
      }
    }

    // 전부 실패
    setError(lastErr || "요청 실패");
    setLoading(false);
  };

  const onKeyDown = (e) => {
    if (e.key === "Enter" && url && !loading) run();
  };

  return (
    <section className="container" style={{ marginTop: 24 }}>
      <h2 style={{ fontSize: 18, marginBottom: 12 }}>🔎 유튜브 링크 분석</h2>

      <div style={{ display: "flex", gap: 8 }}>
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="YouTube URL (https://youtu.be/... 또는 https://www.youtube.com/watch?v=...)"
          style={{
            flex: 1,
            border: "1px solid #ddd",
            borderRadius: 8,
            padding: "8px 12px",
            background: darkMode ? "#111" : "#fff",
            color: darkMode ? "#eee" : "#222",
          }}
        />
        <button
          onClick={run}
          disabled={loading || !url}
          style={{
            background: darkMode ? "#fff" : "#000",
            color: darkMode ? "#000" : "#fff",
            borderRadius: 8,
            padding: "8px 12px",
            opacity: loading || !url ? 0.6 : 1,
          }}
        >
          {loading ? "분석 중..." : "분석 실행"}
        </button>
      </div>

      {/* 로그 영역 (디자인 유지, 미사용 가능) */}
      <div
        style={{
          border: "1px solid #eee",
          borderRadius: 8,
          marginTop: 12,
          padding: 12,
          height: 180,
          overflow: "auto",
          fontSize: 14,
          background: darkMode ? "#0b0b0b" : "#f8f8f8",
          color: darkMode ? "#cfcfcf" : "#333",
        }}
      >
        <div style={{ fontWeight: 600, marginBottom: 6 }}>실시간 로그</div>
        {logs.length ? logs.map((l, i) => <div key={i}>• {l}</div>) : <div style={{ opacity: 0.7 }}>아직 로그가 없습니다.</div>}
      </div>

      {error && (
        <div
          style={{
            marginTop: 10,
            color: "#b00020",
            background: darkMode ? "#2a0000" : "#ffeaea",
            border: "1px solid #ffbcbc",
            padding: 10,
            borderRadius: 8,
            fontSize: 14,
          }}
        >
          {error}
        </div>
      )}

      {result && (
        <div
          style={{
            marginTop: 12,
            border: "1px solid #eee",
            borderRadius: 8,
            padding: 12,
            background: darkMode ? "#0b0b0b" : "#fff",
            color: darkMode ? "#e6e6e6" : "#222",
          }}
        >
          <div style={{ fontWeight: 600, marginBottom: 6 }}>분석 결과</div>
          <div>메뉴: <b>{result.name}</b></div>
          <div>출처: {result.source}</div>
          <div>업로더: {result.uploader} / 업로드일: {result.upload_date}</div>
          <div>
            영상:{" "}
            <a href={result.video_url} target="_blank" rel="noreferrer" style={{ color: "#1d4ed8" }}>
              {result.video_url}
            </a>
          </div>
          <div style={{ marginTop: 6 }}>
            재료 ({(result.ingredients || []).length}): {(result.ingredients || []).join(", ")}
          </div>
        </div>
      )}
    </section>
  );
}
