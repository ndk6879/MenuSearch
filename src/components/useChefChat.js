// Vercel AI Data Stream Protocol v4 파서
// 외부 패키지 없이 fetch + SSE로 직접 구현
import { useState, useCallback, useRef } from "react";

function parseSSELine(line) {
  if (!line.startsWith("data: ")) return null;
  const raw = line.slice(6).trim();
  if (!raw) return null;
  const colonIdx = raw.indexOf(":");
  if (colonIdx === -1) return null;
  const code = raw.slice(0, colonIdx);
  const value = raw.slice(colonIdx + 1);
  try {
    return { code, value: JSON.parse(value) };
  } catch {
    return null;
  }
}

export function useChefChat({ api }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const abortRef = useRef(null);

  const handleInputChange = useCallback((e) => setInput(e.target.value), []);

  const sendMessages = useCallback(async (msgs) => {
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setIsLoading(true);

    // 어시스턴트 메시지 placeholder 추가
    const assistantId = Date.now().toString();
    setMessages(prev => [...prev, {
      id: assistantId,
      role: "assistant",
      content: "",
      toolInvocations: [],
    }]);

    try {
      const res = await fetch(api, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: msgs }),
        signal: controller.signal,
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });

        const lines = buf.split("\n");
        buf = lines.pop() ?? "";

        for (const line of lines) {
          const parsed = parseSSELine(line);
          if (!parsed) continue;
          const { code, value: val } = parsed;

          if (code === "0") {
            // 텍스트 델타
            setMessages(prev => prev.map(m =>
              m.id === assistantId
                ? { ...m, content: m.content + val }
                : m
            ));
          } else if (code === "8") {
            // 출처: "db" | "ai"
            setMessages(prev => prev.map(m =>
              m.id === assistantId ? { ...m, source: val } : m
            ));
          } else if (code === "3") {
            // 서버 에러 메시지
            setMessages(prev => prev.map(m =>
              m.id === assistantId
                ? { ...m, content: "오류가 발생했어요. 다시 시도해주세요." }
                : m
            ));
          } else if (code === "9") {
            // 도구 호출 (tool_call)
            setMessages(prev => prev.map(m =>
              m.id === assistantId
                ? {
                    ...m,
                    toolInvocations: [
                      ...(m.toolInvocations || []),
                      {
                        state: "call",
                        toolCallId: val.toolCallId,
                        toolName: val.toolName,
                        args: val.args,
                      }
                    ]
                  }
                : m
            ));
          } else if (code === "a") {
            // 도구 결과
            setMessages(prev => prev.map(m =>
              m.id === assistantId
                ? {
                    ...m,
                    toolInvocations: (m.toolInvocations || []).map(inv =>
                      inv.toolCallId === val.toolCallId
                        ? { ...inv, state: "result", result: val.result }
                        : inv
                    )
                  }
                : m
            ));
          }
          // code "d" (finish) — 추가 처리 불필요
        }
      }
    } catch (err) {
      if (err.name !== "AbortError") {
        setMessages(prev => prev.map(m =>
          m.id === assistantId
            ? { ...m, content: m.content || "오류가 발생했어요. 다시 시도해주세요." }
            : m
        ));
      }
    } finally {
      setIsLoading(false);
      abortRef.current = null;
    }
  }, [api]);

  const handleSubmit = useCallback((e) => {
    if (e?.preventDefault) e.preventDefault();
    if (!input.trim() || isLoading) return;
    const userMsg = { id: Date.now().toString(), role: "user", content: input };
    const nextMessages = [...messages, userMsg];
    setMessages(nextMessages);
    setInput("");
    sendMessages(nextMessages.map(m => ({ role: m.role, content: m.content })));
  }, [input, isLoading, messages, sendMessages]);

  const append = useCallback((msg) => {
    const userMsg = { id: Date.now().toString(), role: "user", content: msg.content };
    const nextMessages = [...messages, userMsg];
    setMessages(nextMessages);
    sendMessages(nextMessages.map(m => ({ role: m.role, content: m.content })));
  }, [messages, sendMessages]);

  const addToolResult = useCallback(({ toolCallId, result }) => {
    setMessages(prev => prev.map(m => ({
      ...m,
      toolInvocations: (m.toolInvocations || []).map(inv =>
        inv.toolCallId === toolCallId
          ? { ...inv, state: "result", result }
          : inv
      )
    })));
  }, []);

  return { messages, input, handleInputChange, handleSubmit, append, addToolResult, isLoading };
}
