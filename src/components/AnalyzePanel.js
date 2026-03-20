import React, { useState } from "react";

/**
 * 개선 사항
 * - /analyze-save → /analyze → (상대경로/프록시) → http://localhost:8000 → http://127.0.0.1:8000 순으로 폴백
 * - AbortController로 타임아웃(25s)
 * - 응답이 JSON이 아니거나 status!=ok일 때 친절한 에러
 * - logs 없어도 동작 (UI는 유지)
 * - ✅ 분석 결과에 요리 순서(steps) 표시 추가
 * - ✅ 채널 일괄 분석 탭 추가
 */
export default function AnalyzePanel({ apiBase = "http://localhost:8000", darkMode = false }) {
  // === 공통 ===
  const [tab, setTab] = useState("video"); // "video" | "channel"

  // === 영상 분석 탭 ===
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState([]);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [videoSaveStatus, setVideoSaveStatus] = useState(""); // ""|"saving"|"saved"|"duplicate"|"error"

  // === 채널 분석 탭 ===
  const [channelUrl, setChannelUrl] = useState("");
  const [maxResults, setMaxResults] = useState(5);
  const [startIndex, setStartIndex] = useState(1);
  const [chLoading, setChLoading] = useState(false);
  const [chError, setChError] = useState("");
  const [videoList, setVideoList] = useState([]);
  const [analysisStatus, setAnalysisStatus] = useState({}); // videoId → "waiting"|"analyzing"|"done"|"failed"
  const [analysisResults, setAnalysisResults] = useState({}); // videoId → result object
  const [, setExpandedId] = useState(null);
  const [batchRunning, setBatchRunning] = useState(false);
  const [saveStatus, setSaveStatus] = useState({}); // videoId → "saving"|"saved"|"duplicate"|"overwritten"|"error"|"deleted"
  const [videoFilter, setVideoFilter] = useState("all"); // "all" | "video" | "shorts"
  const [existingUrls, setExistingUrls] = useState(new Set());
  const [editingId, setEditingId] = useState(null); // 현재 수정 중인 videoId
  const [editData, setEditData] = useState({}); // 수정 중인 데이터

  const base = apiBase.replace(/\/+$/, "");

  // 저장된 URL 목록 가져오기
  const fetchExistingUrls = async () => {
    try {
      const resp = await fetch(`${base}/existing-urls`);
      const data = await resp.json();
      if (data.ok) setExistingUrls(new Set(data.urls));
    } catch {}
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

  // =====================
  // 영상 분석 탭 로직
  // =====================
  const run = async () => {
    setLoading(true);
    setLogs([]);
    setResult(null);
    setError("");
    setVideoSaveStatus("");

    if (!url) {
      setError("URL을 입력하세요.");
      setLoading(false);
      return;
    }

    try {
      const resp = await fetchWithTimeout(
        `${base}/analyze`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url }),
        },
        240000
      );
      let data;
      try {
        data = await resp.json();
      } catch {
        setError("서버 응답 파싱 실패");
        setLoading(false);
        return;
      }
      if (data && data.ok && data.result) {
        setResult(data.result);
      } else {
        setError(data?.error || "분석 실패");
      }
    } catch (e) {
      setError(e.name === "AbortError" ? "타임아웃 (4분 초과)" : String(e));
    }
    setLoading(false);
  };

  const saveVideoResult = async (overwrite = false) => {
    if (!result) return;
    setVideoSaveStatus("saving");
    try {
      const resp = await fetchWithTimeout(
        `${base}/save-recipe`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ result, overwrite }),
        },
        10000
      );
      const data = await resp.json();
      if (data.ok && data.saved) {
        setVideoSaveStatus(data.overwritten ? "overwritten" : "saved");
      } else if (data.reason === "duplicate") {
        setVideoSaveStatus("duplicate");
      } else {
        setVideoSaveStatus("error");
      }
    } catch {
      setVideoSaveStatus("error");
    }
  };

  const onKeyDown = (e) => {
    if (e.key === "Enter" && url && !loading) run();
  };

  // =====================
  // 채널 분석 탭 로직
  // =====================
  const fetchChannelVideos = async () => {
    setChLoading(true);
    setChError("");
    setVideoList([]);
    setAnalysisStatus({});
    setAnalysisResults({});
    setExpandedId(null);
    setSaveStatus({});
    fetchExistingUrls();

    if (!channelUrl) {
      setChError("채널 URL을 입력하세요.");
      setChLoading(false);
      return;
    }

    try {
      const resp = await fetchWithTimeout(
        `${base}/channel-videos`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ channel_url: channelUrl, max_results: maxResults, start_index: startIndex }),
        },
        15000
      );
      const data = await resp.json();
      if (data.ok) {
        setVideoList(data.videos);
        // 새 채널 프로필 썸네일을 channelData.js에 저장
        if (data.channel_title && data.channel_thumbnail) {
          fetch(`${base}/update-channel-profile`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ uploader: data.channel_title, thumbnail: data.channel_thumbnail }),
          }).catch(() => {});
        }
      } else {
        setChError(data.error || "영상 목록 가져오기 실패");
      }
    } catch (e) {
      setChError(`요청 실패: ${String(e)}`);
    } finally {
      setChLoading(false);
    }
  };

  const getFilteredList = () =>
    videoList.filter((v) => {
      if (videoFilter === "video") return v.duration > 60;
      if (videoFilter === "shorts") return v.duration <= 60;
      return true;
    });

  const startBatchAnalysis = async () => {
    const targets = getFilteredList();
    if (targets.length === 0) return;
    setBatchRunning(true);

    const initStatus = {};
    targets.forEach((v) => (initStatus[v.video_id] = "waiting"));
    setAnalysisStatus(initStatus);
    setAnalysisResults({});
    setExpandedId(null);
    setSaveStatus({});

    for (const video of targets) {
      setAnalysisStatus((prev) => ({ ...prev, [video.video_id]: "analyzing" }));

      try {
        const resp = await fetchWithTimeout(
          `${base}/analyze`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ url: video.url }),
          },
          240000
        );
        let data;
        try {
          data = await resp.json();
        } catch {
          data = { ok: false, error: `HTTP ${resp.status} (JSON 파싱 실패)` };
        }
        if (data.ok && data.result) {
          setAnalysisResults((prev) => ({ ...prev, [video.video_id]: data.result }));
          setAnalysisStatus((prev) => ({ ...prev, [video.video_id]: "done" }));

          // ✅ 분석 성공 시 자동 저장 (중복이 아닌 경우)
          if (!existingUrls.has(data.result.video_url)) {
            try {
              const saveResp = await fetchWithTimeout(
                `${base}/save-recipe`,
                {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ result: data.result, overwrite: false }),
                },
                10000
              );
              const saveData = await saveResp.json();
              if (saveData.ok && saveData.saved) {
                setSaveStatus((prev) => ({ ...prev, [video.video_id]: "saved" }));
                setExistingUrls((prev) => new Set([...prev, data.result.video_url]));
              } else if (saveData.reason === "duplicate") {
                setSaveStatus((prev) => ({ ...prev, [video.video_id]: "duplicate" }));
              }
            } catch {
              // 자동 저장 실패 시 무시 (수동 저장 가능)
            }
          } else {
            setSaveStatus((prev) => ({ ...prev, [video.video_id]: "duplicate" }));
          }
        } else {
          setAnalysisResults((prev) => ({
            ...prev,
            [video.video_id]: { error: data.error || `HTTP ${resp.status} 분석 실패` },
          }));
          setAnalysisStatus((prev) => ({ ...prev, [video.video_id]: "failed" }));
        }
      } catch (e) {
        setAnalysisResults((prev) => ({
          ...prev,
          [video.video_id]: { error: e.name === "AbortError" ? "타임아웃 (2분 초과)" : String(e) },
        }));
        setAnalysisStatus((prev) => ({ ...prev, [video.video_id]: "failed" }));
      }
    }

    setBatchRunning(false);
  };

  const saveRecipe = async (videoId, overwrite = false) => {
    const r = analysisResults[videoId];
    if (!r || r.error) return;

    setSaveStatus((prev) => ({ ...prev, [videoId]: "saving" }));

    try {
      const resp = await fetchWithTimeout(
        `${base}/save-recipe`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ result: r, overwrite }),
        },
        10000
      );
      const data = await resp.json();
      if (data.ok && data.saved) {
        setSaveStatus((prev) => ({ ...prev, [videoId]: data.overwritten ? "overwritten" : "saved" }));
        setExistingUrls((prev) => new Set([...prev, r.video_url]));
      } else if (data.reason === "duplicate") {
        setSaveStatus((prev) => ({ ...prev, [videoId]: "duplicate" }));
      } else {
        setSaveStatus((prev) => ({ ...prev, [videoId]: "error" }));
      }
    } catch {
      setSaveStatus((prev) => ({ ...prev, [videoId]: "error" }));
    }
  };

  // ✅ 저장 취소(삭제)
  const deleteRecipe = async (videoId) => {
    const r = analysisResults[videoId];
    if (!r || !r.video_url) return;

    try {
      const resp = await fetchWithTimeout(
        `${base}/delete-recipe`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ video_url: r.video_url }),
        },
        10000
      );
      const data = await resp.json();
      if (data.ok && data.deleted) {
        setSaveStatus((prev) => ({ ...prev, [videoId]: "deleted" }));
        setExistingUrls((prev) => {
          const next = new Set(prev);
          next.delete(r.video_url);
          return next;
        });
      }
    } catch {
      // 삭제 실패 시 무시
    }
  };

  // ✅ 단일 영상 재분석
  const reanalyzeVideo = async (video) => {
    setAnalysisStatus((prev) => ({ ...prev, [video.video_id]: "analyzing" }));
    setSaveStatus((prev) => ({ ...prev, [video.video_id]: undefined }));

    try {
      const resp = await fetchWithTimeout(
        `${base}/analyze`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: video.url }),
        },
        240000
      );
      let data;
      try { data = await resp.json(); } catch { data = { ok: false, error: `HTTP ${resp.status}` }; }

      if (data.ok && data.result) {
        setAnalysisResults((prev) => ({ ...prev, [video.video_id]: data.result }));
        setAnalysisStatus((prev) => ({ ...prev, [video.video_id]: "done" }));
        if (!existingUrls.has(data.result.video_url)) {
          try {
            const saveResp = await fetchWithTimeout(`${base}/save-recipe`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ result: data.result, overwrite: false }),
            }, 10000);
            const saveData = await saveResp.json();
            if (saveData.ok && saveData.saved) {
              setSaveStatus((prev) => ({ ...prev, [video.video_id]: "saved" }));
              setExistingUrls((prev) => new Set([...prev, data.result.video_url]));
            } else if (saveData.reason === "duplicate") {
              setSaveStatus((prev) => ({ ...prev, [video.video_id]: "duplicate" }));
            }
          } catch {}
        } else {
          setSaveStatus((prev) => ({ ...prev, [video.video_id]: "duplicate" }));
        }
      } else {
        setAnalysisResults((prev) => ({ ...prev, [video.video_id]: { error: data.error || "분석 실패" } }));
        setAnalysisStatus((prev) => ({ ...prev, [video.video_id]: "failed" }));
      }
    } catch (e) {
      setAnalysisResults((prev) => ({ ...prev, [video.video_id]: { error: e.name === "AbortError" ? "타임아웃" : String(e) } }));
      setAnalysisStatus((prev) => ({ ...prev, [video.video_id]: "failed" }));
    }
  };

  // ✅ URL로 직접 삭제 (분석 결과 없이 기존 저장된 레시피 삭제)
  const deleteRecipeByUrl = async (videoId, videoUrl) => {
    try {
      const resp = await fetchWithTimeout(`${base}/delete-recipe`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ video_url: videoUrl }),
      }, 10000);
      const data = await resp.json();
      if (data.ok && data.deleted) {
        setSaveStatus((prev) => ({ ...prev, [videoId]: "deleted" }));
        setExistingUrls((prev) => { const next = new Set(prev); next.delete(videoUrl); return next; });
      }
    } catch {}
  };

  // ✅ 수정 시작
  const startEdit = (videoId) => {
    const r = analysisResults[videoId];
    if (!r) return;
    setEditingId(videoId);
    setEditData({
      name: r.name || "",
      ingredients: (r.ingredients || []).join(", "),
      steps: (r.steps || []).join("\n"),
    });
  };

  // ✅ 수정 저장
  const saveEdit = async (videoId) => {
    const r = analysisResults[videoId];
    if (!r) return;

    const updated = {
      ...r,
      name: editData.name.trim(),
      ingredients: editData.ingredients.split(",").map((s) => s.trim()).filter(Boolean),
      steps: editData.steps.split("\n").map((s) => s.trim()).filter(Boolean),
    };

    setAnalysisResults((prev) => ({ ...prev, [videoId]: updated }));
    setEditingId(null);

    // 이미 저장된 상태면 덮어쓰기로 재저장
    if (saveStatus[videoId] === "saved" || saveStatus[videoId] === "overwritten" || existingUrls.has(r.video_url)) {
      setSaveStatus((prev) => ({ ...prev, [videoId]: "saving" }));
      try {
        const resp = await fetchWithTimeout(
          `${base}/save-recipe`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ result: updated, overwrite: true }),
          },
          10000
        );
        const data = await resp.json();
        if (data.ok && data.saved) {
          setSaveStatus((prev) => ({ ...prev, [videoId]: "saved" }));
        }
      } catch {
        setSaveStatus((prev) => ({ ...prev, [videoId]: "error" }));
      }
    }
  };

  const formatDuration = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${String(s).padStart(2, "0")}`;
  };

  const statusIcon = (s) =>
    ({ waiting: "\u23F3", analyzing: "\uD83D\uDD04", done: "\u2705", failed: "\u274C" }[s] || "");

  // =====================
  // 탭 스타일
  // =====================
  const tabStyle = (active) => ({
    padding: "8px 20px",
    cursor: "pointer",
    fontWeight: active ? 700 : 400,
    borderBottom: active ? `2px solid ${darkMode ? "#fff" : "#000"}` : "2px solid transparent",
    color: active ? (darkMode ? "#fff" : "#000") : darkMode ? "#888" : "#999",
    background: "none",
    border: "none",
    borderBottomWidth: 2,
    borderBottomStyle: "solid",
    borderBottomColor: active ? (darkMode ? "#fff" : "#000") : "transparent",
    fontSize: 15,
  });

  return (
    <section className="container" style={{ marginTop: 24 }}>
      <h2 style={{ fontSize: 18, marginBottom: 12 }}>🔎 유튜브 링크 분석</h2>

      {/* 탭 */}
      <div style={{ display: "flex", gap: 0, marginBottom: 16, borderBottom: `1px solid ${darkMode ? "#333" : "#eee"}` }}>
        <button style={tabStyle(tab === "video")} onClick={() => setTab("video")}>
          영상 분석
        </button>
        <button style={tabStyle(tab === "channel")} onClick={() => setTab("channel")}>
          채널 분석
        </button>
      </div>

      {/* ===== 영상 분석 탭 ===== */}
      {tab === "video" && (
        <>
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

          {/* 로그 영역 */}
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

              {result.steps && result.steps.length > 0 && (
                <div style={{ marginTop: 10 }}>
                  <div style={{ fontWeight: 600, marginBottom: 4 }}>🍳 요리 순서</div>
                  <ol style={{ marginLeft: 20 }}>
                    {result.steps.map((s, i) => (
                      <li key={i}>{s}</li>
                    ))}
                  </ol>
                </div>
              )}

              {/* 저장 버튼 */}
              <div style={{ marginTop: 14, display: "flex", alignItems: "center", gap: 10 }}>
                {videoSaveStatus === "saved" ? (
                  <span style={{ color: "#16a34a", fontWeight: 600 }}>저장 완료</span>
                ) : videoSaveStatus === "overwritten" ? (
                  <span style={{ color: "#16a34a", fontWeight: 600 }}>덮어쓰기 완료</span>
                ) : videoSaveStatus === "duplicate" ? (
                  <>
                    <span style={{ color: "#ca8a04", fontWeight: 600 }}>이미 저장된 영상입니다</span>
                    <button
                      onClick={() => saveVideoResult(true)}
                      style={{
                        background: "#ca8a04",
                        color: "#fff",
                        border: "none",
                        borderRadius: 8,
                        padding: "6px 16px",
                        fontSize: 13,
                        fontWeight: 600,
                        cursor: "pointer",
                      }}
                    >
                      덮어쓰기
                    </button>
                  </>
                ) : videoSaveStatus === "error" ? (
                  <span style={{ color: "#dc2626", fontWeight: 600 }}>저장 실패</span>
                ) : (
                  <button
                    onClick={() => saveVideoResult()}
                    disabled={videoSaveStatus === "saving"}
                    style={{
                      background: "#16a34a",
                      color: "#fff",
                      border: "none",
                      borderRadius: 8,
                      padding: "8px 20px",
                      fontSize: 14,
                      fontWeight: 600,
                      cursor: "pointer",
                      opacity: videoSaveStatus === "saving" ? 0.6 : 1,
                    }}
                  >
                    {videoSaveStatus === "saving" ? "저장 중..." : "menuData_kr.js에 저장"}
                  </button>
                )}
              </div>
            </div>
          )}
        </>
      )}

      {/* ===== 채널 분석 탭 ===== */}
      {tab === "channel" && (
        <>
          {/* 입력 영역 */}
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <input
              value={channelUrl}
              onChange={(e) => setChannelUrl(e.target.value)}
              placeholder="채널 URL (https://www.youtube.com/@handle)"
              style={{
                flex: 1,
                minWidth: 250,
                border: "1px solid #ddd",
                borderRadius: 8,
                padding: "8px 12px",
                background: darkMode ? "#111" : "#fff",
                color: darkMode ? "#eee" : "#222",
              }}
            />
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <label style={{ fontSize: 13, color: darkMode ? "#bbb" : "#555" }}>시작:</label>
              <input
                type="number"
                min={1}
                max={500}
                value={startIndex}
                onChange={(e) => setStartIndex(Math.min(500, Math.max(1, Number(e.target.value) || 1)))}
                style={{
                  width: 56,
                  border: "1px solid #ddd",
                  borderRadius: 6,
                  padding: "6px 8px",
                  textAlign: "center",
                  background: darkMode ? "#111" : "#fff",
                  color: darkMode ? "#eee" : "#222",
                }}
              />
              <label style={{ fontSize: 13, color: darkMode ? "#bbb" : "#555" }}>개수:</label>
              <input
                type="number"
                min={1}
                max={500}
                value={maxResults}
                onChange={(e) => setMaxResults(Math.min(500, Math.max(1, Number(e.target.value) || 1)))}
                style={{
                  width: 56,
                  border: "1px solid #ddd",
                  borderRadius: 6,
                  padding: "6px 8px",
                  textAlign: "center",
                  background: darkMode ? "#111" : "#fff",
                  color: darkMode ? "#eee" : "#222",
                }}
              />
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
              {[
                { key: "all", label: "전체" },
                { key: "video", label: "동영상" },
                { key: "shorts", label: "Shorts" },
              ].map((opt) => (
                <button
                  key={opt.key}
                  onClick={() => setVideoFilter(opt.key)}
                  style={{
                    padding: "6px 10px",
                    fontSize: 13,
                    border: `1px solid ${darkMode ? "#444" : "#ddd"}`,
                    borderRadius: 6,
                    cursor: "pointer",
                    background:
                      videoFilter === opt.key
                        ? darkMode ? "#fff" : "#000"
                        : darkMode ? "#111" : "#fff",
                    color:
                      videoFilter === opt.key
                        ? darkMode ? "#000" : "#fff"
                        : darkMode ? "#ccc" : "#555",
                    fontWeight: videoFilter === opt.key ? 600 : 400,
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <button
              onClick={fetchChannelVideos}
              disabled={chLoading || !channelUrl}
              style={{
                background: darkMode ? "#fff" : "#000",
                color: darkMode ? "#000" : "#fff",
                borderRadius: 8,
                padding: "8px 14px",
                opacity: chLoading || !channelUrl ? 0.6 : 1,
                whiteSpace: "nowrap",
              }}
            >
              {chLoading ? "가져오는 중..." : "영상 목록 가져오기"}
            </button>
          </div>

          {chError && (
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
              {chError}
            </div>
          )}

          {/* 영상 목록 테이블 */}
          {videoList.length > 0 && (() => {
            const filteredList = videoList.filter((v) => {
              if (videoFilter === "video") return v.duration > 60;
              if (videoFilter === "shorts") return v.duration <= 60;
              return true;
            });
            return (
            <div style={{ marginTop: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <span style={{ fontWeight: 600, fontSize: 15 }}>
                  영상 목록 ({filteredList.length}개{videoFilter !== "all" ? ` / 전체 ${videoList.length}개` : ""})
                </span>
                <button
                  onClick={startBatchAnalysis}
                  disabled={batchRunning}
                  style={{
                    background: "#2563eb",
                    color: "#fff",
                    borderRadius: 8,
                    padding: "6px 14px",
                    fontSize: 14,
                    opacity: batchRunning ? 0.6 : 1,
                    border: "none",
                    cursor: batchRunning ? "not-allowed" : "pointer",
                  }}
                >
                  {batchRunning ? "분석 진행 중..." : "전체 분석 시작"}
                </button>
              </div>

              <div
                style={{
                  border: `1px solid ${darkMode ? "#333" : "#eee"}`,
                  borderRadius: 8,
                  overflow: "hidden",
                }}
              >
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14, tableLayout: "fixed" }}>
                  <thead>
                    <tr
                      style={{
                        background: darkMode ? "#1a1a1a" : "#f5f5f5",
                        textAlign: "left",
                      }}
                    >
                      <th style={{ padding: "8px 12px", width: 36 }}>#</th>
                      <th style={{ padding: "8px 12px" }}>제목</th>
                      <th style={{ padding: "8px 12px", width: 70, textAlign: "center" }}>유형</th>
                      <th style={{ padding: "8px 12px", width: 100 }}>날짜</th>
                      <th style={{ padding: "8px 12px", width: 60 }}>길이</th>
                      <th style={{ padding: "8px 12px", width: 60, textAlign: "center" }}>상태</th>
                      <th style={{ padding: "8px 12px", width: 120, textAlign: "center" }}>저장</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredList.map((v, i) => {
                      const st = analysisStatus[v.video_id];
                      const res = analysisResults[v.video_id];
                      const sv = saveStatus[v.video_id];

                      return (
                        <React.Fragment key={v.video_id}>
                          <tr
                            style={{
                              borderBottom: (st === "done" || st === "failed") && res
                                ? "none"
                                : `1px solid ${darkMode ? "#222" : "#eee"}`,
                            }}
                          >
                            <td style={{ padding: "8px 12px" }}>{i + 1}</td>
                            <td style={{ padding: "8px 12px" }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                <a href={v.url} target="_blank" rel="noreferrer" style={{ flexShrink: 0 }}>
                                  <img
                                    src={`https://img.youtube.com/vi/${v.video_id}/mqdefault.jpg`}
                                    alt=""
                                    style={{
                                      width: 120,
                                      height: 68,
                                      borderRadius: 6,
                                      objectFit: "cover",
                                    }}
                                  />
                                </a>
                                <a
                                  href={v.url}
                                  target="_blank"
                                  rel="noreferrer"
                                  title={v.title}
                                  style={{
                                    color: darkMode ? "#93b5ff" : "#1d4ed8",
                                    textDecoration: "none",
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                    whiteSpace: "nowrap",
                                    display: "block",
                                    minWidth: 0,
                                  }}
                                >
                                  {v.title}
                                </a>
                              </div>
                            </td>
                            <td style={{ padding: "8px 12px", fontSize: 12, textAlign: "center" }}>
                              {v.duration <= 60 ? (
                                <span style={{
                                  background: "#ef4444",
                                  color: "#fff",
                                  borderRadius: 4,
                                  padding: "2px 6px",
                                  fontWeight: 600,
                                }}>Shorts</span>
                              ) : (
                                <span style={{
                                  background: darkMode ? "#333" : "#e5e7eb",
                                  color: darkMode ? "#ccc" : "#555",
                                  borderRadius: 4,
                                  padding: "2px 6px",
                                }}>동영상</span>
                              )}
                            </td>
                            <td style={{ padding: "8px 12px", fontSize: 13, whiteSpace: "nowrap" }}>
                              {v.published_at ? v.published_at.slice(0, 10) : "-"}
                            </td>
                            <td style={{ padding: "8px 12px", fontSize: 13 }}>
                              {formatDuration(v.duration)}
                            </td>
                            <td style={{ padding: "8px 12px", textAlign: "center" }}>
                              {st ? statusIcon(st) : "-"}
                            </td>
                            <td
                              style={{ padding: "8px 12px", textAlign: "center" }}
                            >
                              {st === "failed" ? (
                                <button
                                  onClick={() => reanalyzeVideo(v)}
                                  style={{
                                    background: "#eff6ff", color: "#2563eb",
                                    border: "1px solid #93c5fd", borderRadius: 99,
                                    padding: "3px 10px", fontSize: 11, fontWeight: 600, cursor: "pointer",
                                  }}
                                >다시 분석</button>
                              ) : st === "done" && res && !res.error ? (
                                sv === "deleted" ? (
                                  <span style={{
                                    background: darkMode ? "#2a2a2a" : "#f3f4f6", color: darkMode ? "#666" : "#999",
                                    borderRadius: 99, padding: "3px 10px", fontSize: 11, fontWeight: 600,
                                  }}>삭제됨</span>
                                ) : sv === "saved" || sv === "overwritten" ? (
                                  <div style={{ display: "flex", gap: 4, justifyContent: "center" }}>
                                    <span style={{
                                      background: "#dcfce7", color: "#15803d",
                                      borderRadius: 99, padding: "3px 10px", fontSize: 11, fontWeight: 600,
                                    }}>{sv === "overwritten" ? "갱신됨" : "저장됨"}</span>
                                    <button
                                      onClick={() => deleteRecipe(v.video_id)}
                                      style={{
                                        background: "#fef2f2", color: "#dc2626",
                                        border: "1px solid #fca5a5", borderRadius: 99,
                                        padding: "3px 8px", fontSize: 11, fontWeight: 600, cursor: "pointer",
                                      }}
                                    >삭제</button>
                                  </div>
                                ) : sv === "duplicate" ? (
                                  <div style={{ display: "flex", gap: 4, justifyContent: "center" }}>
                                    <button
                                      onClick={() => saveRecipe(v.video_id, true)}
                                      style={{
                                        background: "#fef3c7", color: "#b45309",
                                        border: "1px solid #f59e0b", borderRadius: 99,
                                        padding: "3px 10px", fontSize: 11, fontWeight: 600, cursor: "pointer",
                                      }}
                                      title="클릭하면 새 데이터로 덮어씁니다"
                                    >덮어쓰기</button>
                                    <button
                                      onClick={() => deleteRecipeByUrl(v.video_id, v.url)}
                                      style={{
                                        background: "#fef2f2", color: "#dc2626",
                                        border: "1px solid #fca5a5", borderRadius: 99,
                                        padding: "3px 8px", fontSize: 11, fontWeight: 600, cursor: "pointer",
                                      }}
                                    >삭제</button>
                                  </div>
                                ) : sv === "error" ? (
                                  <span style={{
                                    background: "#fef2f2", color: "#dc2626",
                                    borderRadius: 99, padding: "3px 10px", fontSize: 11, fontWeight: 600,
                                  }}>실패</span>
                                ) : sv === "saving" ? (
                                  <span style={{
                                    background: darkMode ? "#1e293b" : "#eff6ff", color: "#2563eb",
                                    borderRadius: 99, padding: "3px 10px", fontSize: 11, fontWeight: 600,
                                  }}>저장 중...</span>
                                ) : (
                                  <button
                                    onClick={() => saveRecipe(v.video_id, existingUrls.has(v.url))}
                                    style={{
                                      background: existingUrls.has(v.url) ? "#fef3c7" : "#dcfce7",
                                      color: existingUrls.has(v.url) ? "#b45309" : "#15803d",
                                      border: `1px solid ${existingUrls.has(v.url) ? "#f59e0b" : "#22c55e"}`,
                                      borderRadius: 99, padding: "3px 10px", fontSize: 11, fontWeight: 600,
                                      cursor: "pointer",
                                    }}
                                  >
                                    {existingUrls.has(v.url) ? "덮어쓰기" : "저장"}
                                  </button>
                                )
                              ) : existingUrls.has(v.url) ? (
                                <div style={{ display: "flex", gap: 4, justifyContent: "center" }}>
                                  <span style={{
                                    background: "#fef3c7", color: "#b45309",
                                    borderRadius: 99, padding: "3px 8px", fontSize: 11, fontWeight: 600,
                                  }}>저장됨</span>
                                  <button
                                    onClick={() => deleteRecipeByUrl(v.video_id, v.url)}
                                    style={{
                                      background: "#fef2f2", color: "#dc2626",
                                      border: "1px solid #fca5a5", borderRadius: 99,
                                      padding: "3px 8px", fontSize: 11, fontWeight: 600, cursor: "pointer",
                                    }}
                                  >삭제</button>
                                </div>
                              ) : (
                                st === "failed" ? (
                                  <button
                                    onClick={() => reanalyzeVideo(v)}
                                    style={{
                                      background: "#eff6ff", color: "#2563eb",
                                      border: "1px solid #93c5fd", borderRadius: 99,
                                      padding: "3px 10px", fontSize: 11, fontWeight: 600, cursor: "pointer",
                                    }}
                                  >다시 분석</button>
                                ) : "-"
                              )}
                            </td>
                          </tr>

                          {/* 분석 결과 — 완료/실패 시 항상 표시 */}
                          {(st === "done" || st === "failed") && res && (
                            <tr>
                              <td
                                colSpan={7}
                                style={{
                                  padding: "10px 16px 14px",
                                  background: darkMode ? "#111122" : "#f8faff",
                                  borderBottom: `1px solid ${darkMode ? "#333" : "#ddd"}`,
                                  fontSize: 13,
                                  wordBreak: "break-word",
                                  whiteSpace: "normal",
                                }}
                              >
                                {res.error ? (
                                  <div style={{ color: "#dc2626" }}>오류: {res.error}</div>
                                ) : editingId === v.video_id ? (
                                  /* ===== 수정 모드 ===== */
                                  <div>
                                    <div style={{ marginBottom: 6 }}>
                                      <b>메뉴:</b>
                                      <input
                                        value={editData.name}
                                        onChange={(e) => setEditData((d) => ({ ...d, name: e.target.value }))}
                                        style={{
                                          marginLeft: 8, padding: "3px 8px", borderRadius: 4, width: "60%",
                                          border: `1px solid ${darkMode ? "#444" : "#ccc"}`,
                                          background: darkMode ? "#222" : "#fff",
                                          color: darkMode ? "#eee" : "#111",
                                        }}
                                      />
                                    </div>
                                    <div style={{ marginBottom: 6 }}>
                                      <b>재료</b> <span style={{ fontSize: 11, color: "#999" }}>(쉼표로 구분)</span>
                                      <textarea
                                        value={editData.ingredients}
                                        onChange={(e) => setEditData((d) => ({ ...d, ingredients: e.target.value }))}
                                        rows={2}
                                        style={{
                                          display: "block", marginTop: 4, padding: 6, borderRadius: 4, width: "100%",
                                          border: `1px solid ${darkMode ? "#444" : "#ccc"}`,
                                          background: darkMode ? "#222" : "#fff",
                                          color: darkMode ? "#eee" : "#111", fontSize: 13,
                                        }}
                                      />
                                    </div>
                                    <div style={{ marginBottom: 6 }}>
                                      <b>요리 순서</b> <span style={{ fontSize: 11, color: "#999" }}>(한 줄에 한 단계)</span>
                                      <textarea
                                        value={editData.steps}
                                        onChange={(e) => setEditData((d) => ({ ...d, steps: e.target.value }))}
                                        rows={5}
                                        style={{
                                          display: "block", marginTop: 4, padding: 6, borderRadius: 4, width: "100%",
                                          border: `1px solid ${darkMode ? "#444" : "#ccc"}`,
                                          background: darkMode ? "#222" : "#fff",
                                          color: darkMode ? "#eee" : "#111", fontSize: 13,
                                        }}
                                      />
                                    </div>
                                    <div style={{ display: "flex", gap: 6 }}>
                                      <button
                                        onClick={() => saveEdit(v.video_id)}
                                        style={{
                                          background: "#16a34a", color: "#fff", border: "none",
                                          borderRadius: 6, padding: "4px 14px", fontSize: 13, cursor: "pointer",
                                        }}
                                      >저장</button>
                                      <button
                                        onClick={() => setEditingId(null)}
                                        style={{
                                          background: darkMode ? "#333" : "#e5e7eb", color: darkMode ? "#ccc" : "#555",
                                          border: "none", borderRadius: 6, padding: "4px 14px", fontSize: 13, cursor: "pointer",
                                        }}
                                      >취소</button>
                                    </div>
                                  </div>
                                ) : (
                                  /* ===== 보기 모드 ===== */
                                  <div>
                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                      <div><b>메뉴:</b> {res.name}</div>
                                      <div style={{ display: "flex", gap: 6 }}>
                                        <button
                                          onClick={() => startEdit(v.video_id)}
                                          style={{
                                            background: darkMode ? "#333" : "#e5e7eb", color: darkMode ? "#ccc" : "#555",
                                            border: "none", borderRadius: 5, padding: "2px 10px", fontSize: 12, cursor: "pointer",
                                          }}
                                        >수정</button>
                                        {(sv === "saved" || sv === "overwritten" || (existingUrls.has(res.video_url) && sv !== "deleted")) && (
                                          <button
                                            onClick={() => deleteRecipe(v.video_id)}
                                            style={{
                                              background: "#dc2626", color: "#fff",
                                              border: "none", borderRadius: 5, padding: "2px 10px", fontSize: 12, cursor: "pointer",
                                            }}
                                          >저장 취소</button>
                                        )}
                                      </div>
                                    </div>
                                    <div style={{ marginTop: 4 }}>
                                      <b>재료 ({(res.ingredients || []).length}):</b>{" "}
                                      <span style={{ color: darkMode ? "#888" : "#999", fontSize: 12 }}>
                                        (출처: {res.ingredients_source || res.source})
                                      </span>
                                      <div style={{ marginTop: 2 }}>
                                        {(res.ingredients || []).join(", ")}
                                      </div>
                                    </div>
                                    {res.steps && res.steps.length > 0 && (
                                      <div style={{ marginTop: 4 }}>
                                        <b>요리 순서:</b>{" "}
                                        <span style={{ color: darkMode ? "#888" : "#999", fontSize: 12 }}>
                                          (출처: {res.steps_source || res.source})
                                        </span>
                                        <ol style={{ marginLeft: 20, marginTop: 2 }}>
                                          {res.steps.map((s, j) => (
                                            <li key={j}>{s}</li>
                                          ))}
                                        </ol>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
            );
          })()}
        </>
      )}
    </section>
  );
}
