import { useEffect, useRef } from "react";
import { useChefChat } from "./useChefChat";
import MenuRecommendCard from "./ChefUI/MenuRecommendCard";
import IngredientChecklist from "./ChefUI/IngredientChecklist";
import RecipeStepGuide from "./ChefUI/RecipeStepGuide";

const SUGGEST_PROMPTS = [
  "냉장고 재료로 만들 수 있는 요리 3가지 추천해줘",
  "삼겹살로 색다른 요리 알려줘",
  "초보자도 쉽게 만들 수 있는 한식 추천해줘",
  "오늘 저녁 얼큰한 국물 요리 추천해줘",
];

function ToolUI({ toolInvocation, darkMode, addToolResult }) {
  const { toolCallId, toolName, args, state } = toolInvocation;

  // 도구 호출을 받으면 "rendered"로 즉시 응답 (스트림 계속 진행)
  useEffect(() => {
    if (state === "call") {
      addToolResult({ toolCallId, result: "rendered" });
    }
  }, [state, toolCallId, addToolResult]);

  if (toolName === "showMenuCards") {
    return <MenuRecommendCard recipes={args?.recipes || []} darkMode={darkMode} />;
  }
  if (toolName === "showIngredientChecklist") {
    return (
      <IngredientChecklist
        recipeName={args?.recipeName || ""}
        ingredients={args?.ingredients || []}
        darkMode={darkMode}
      />
    );
  }
  if (toolName === "showRecipeSteps") {
    return (
      <RecipeStepGuide
        recipeName={args?.recipeName || ""}
        steps={args?.steps || []}
        darkMode={darkMode}
      />
    );
  }
  return null;
}

export default function ChefAI({ darkMode }) {
  const bottomRef = useRef(null);

  const {
    messages,
    input,
    handleInputChange,
    handleSubmit,
    append,
    addToolResult,
    isLoading,
  } = useChefChat({ api: "/api/chat" });

  // 새 메시지마다 하단 스크롤
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // 추천 프롬프트 클릭
  const handleSuggest = (text) => {
    append({ role: "user", content: text });
  };

  const isEmpty = messages.length === 0;

  return (
    <div className="chef-ai">
      {/* 메시지 영역 */}
      <div className="chef-messages">
        {isEmpty ? (
          <div className="chef-welcome">
            <div className="chef-welcome-icon">👨‍🍳</div>
            <h2 className="chef-welcome-title">AI 셰프</h2>
            <p className="chef-welcome-desc">
              재료를 알려주시면 만들 수 있는 요리를 추천해드려요.<br />
              궁금한 레시피나 요리 방법도 물어보세요!
            </p>
            <div className="chef-suggest-chips">
              {SUGGEST_PROMPTS.map((p, i) => (
                <button key={i} className="chef-chip" onClick={() => handleSuggest(p)}>
                  {p}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((msg) => (
            <div key={msg.id} className={`chef-bubble-wrap ${msg.role}`}>
              {msg.role === "assistant" && (
                <span className="chef-avatar">👨‍🍳</span>
              )}
              <div className={`chef-bubble chef-bubble-${msg.role}`}>
                {/* 출처 뱃지 */}
                {msg.role === "assistant" && msg.source && (
                  <span className={`chef-source-badge chef-source-${msg.source}`}>
                    {msg.source === "db" ? "📚 우리 DB" : "🤖 AI 지식"}
                  </span>
                )}
                {/* 텍스트 */}
                {msg.content && (
                  <p className="chef-bubble-text">{msg.content}</p>
                )}
                {/* 도구 호출 (Generative UI) */}
                {(msg.toolInvocations || []).map((inv) => (
                  <div key={inv.toolCallId} className="chef-bubble-tool">
                    <ToolUI
                      toolInvocation={inv}
                      darkMode={darkMode}
                      addToolResult={addToolResult}
                    />
                  </div>
                ))}
              </div>
            </div>
          ))
        )}

        {isLoading && (
          <div className="chef-bubble-wrap assistant">
            <span className="chef-avatar">👨‍🍳</span>
            <div className="chef-bubble chef-bubble-assistant">
              <span className="chef-typing">
                <span /><span /><span />
              </span>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* 입력 영역 */}
      <form className="chef-input-area" onSubmit={handleSubmit}>
        <input
          className="chef-input"
          value={input}
          onChange={handleInputChange}
          placeholder="재료나 원하는 요리를 입력하세요..."
          disabled={isLoading}
        />
        <button
          type="submit"
          className="chef-send-btn"
          disabled={isLoading || !input.trim()}
        >
          전송
        </button>
      </form>
    </div>
  );
}
