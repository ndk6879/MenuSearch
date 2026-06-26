
import React, { useState, useMemo, useEffect, useRef } from "react";
import "./App.css";
import TagSearch from "./TagSearch";
import menuData_kr from "./menuData_kr";
import menuData_en from "./menuData_en";
import { FaBookmark, FaRegBookmark } from "react-icons/fa";
import Modal from "./components/Modal";
import AnalyzePanel from "./components/AnalyzePanel";
import ChefAI from "./components/ChefAI";
import channelProfiles from "./channelData";
import AboutSection from "./components/AboutSection";
import translations from "./i18n";
import chefConfig from "./chefConfig";
import { useParams, useNavigate } from "react-router-dom";
import { db, auth } from './firebase';
import { collection, doc, onSnapshot, setDoc, deleteField, updateDoc, getDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from './firebase';
import { GoogleAuthProvider, signInWithPopup, signInWithCustomToken, onAuthStateChanged, signOut } from 'firebase/auth';
import { DndContext, closestCenter } from '@dnd-kit/core';
import { SortableContext, useSortable, arrayMove, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

const API_BASE = process.env.REACT_APP_API_BASE || 'http://localhost:8000';

const ING_QUANTITY_RE = /^(.+?)\s+(\d[\d/.]*\s*(?:봉지|숟가락|작은술|큰술|티스푼|스푼|그램|밀리리터|밀리|미리|덩어리|움큼|꼬집|방울|가닥|줄기|묶음|뭉치|조각|토막|포기|줌|컵|봉|팩|병|캔|장|마리|알|통|쪽|인분|뿌리|대|근|모|판|ml|ML|kg|KG|mg|개|g|G|L|l|cc|T|t)|약간|조금|조금씩|적당량|적당히|한줌|두줌|한꼬집|두꼬집|반컵|반개|조금)$/;
const parseIngText = (str) => {
  const m = str.trim().match(ING_QUANTITY_RE);
  return m ? { name: m[1].trim(), amount: m[2].trim() } : { name: str.trim(), amount: '' };
};

const ALL_INGREDIENT_NAMES = (() => {
  const names = new Set();
  menuData_kr.forEach(item => {
    (item.ingredients || item['재료'] || []).forEach(raw => {
      const { name } = parseIngText(String(raw));
      if (name) names.add(name);
    });
  });
  return [...names].sort((a, b) => a.localeCompare(b, 'ko'));
})();

function SortableIngRow({ id, ing, index, darkMode, editingIngIndex, editingIngName, editingIngAmount, setEditingIngName, setEditingIngAmount, setEditingIngIndex, saveEditIng, startEditIng, setIngredientsList, parseIngredientInput, isRestored, onClearRestored }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging: isSortableDragging } = useSortable({ id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isSortableDragging ? 0.5 : 1,
  };
  const parsed = parseIngredientInput(ing);
  if (editingIngIndex === index) {
    return (
      <div ref={setNodeRef} style={style} className={`ing-list-row ing-list-row--editing${darkMode ? ' dark' : ''}`}>
        <input
          className={`ing-edit-name${darkMode ? ' dark' : ''}`}
          value={editingIngName}
          onChange={e => { setEditingIngName(e.target.value); onClearRestored?.(); }}
          onKeyDown={e => { if (e.key === 'Enter') saveEditIng(); if (e.key === 'Escape') setEditingIngIndex(null); }}
          autoFocus
        />
        <input
          className={`ing-edit-amount${darkMode ? ' dark' : ''}`}
          value={editingIngAmount}
          onChange={e => setEditingIngAmount(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') saveEditIng(); if (e.key === 'Escape') setEditingIngIndex(null); }}
          placeholder="수량"
        />
        <div className="ing-edit-actions">
          <button className="ing-edit-save" onClick={saveEditIng}>✓</button>
          <button className="ing-edit-cancel" onClick={() => setEditingIngIndex(null)}>✕</button>
        </div>
      </div>
    );
  }
  return (
    <div ref={setNodeRef} style={style} className={`ing-list-row${isRestored ? ' restored' : ''}${darkMode ? ' dark' : ''}`} {...listeners} {...attributes}>
      <span className="ing-drag-handle">⠿</span>
      <div className="ing-list-main">
        <span className="ing-list-name">{parsed.name || ing}</span>
        {parsed.amount && <span className="ing-list-amount">{parsed.amount}</span>}
        <div className="ing-list-actions">
          <button className="ing-list-edit" onPointerDown={e => e.stopPropagation()} onClick={() => startEditIng(index, ing)}>✎</button>
          <button className="ing-list-remove" onPointerDown={e => e.stopPropagation()} onClick={() => setIngredientsList(l => l.filter((_, idx) => idx !== index))}>×</button>
        </div>
      </div>
    </div>
  );
}

// ── 편집 패널: 자체 state로 관리해 App 리렌더 방지 ──
function RecipeEditPanel({ initialDraft, darkMode, t, thumbnailUrl, recipeUrl, uploaderName, onSave, onCancel, onSaveThumbnail, onClearThumbnail }) {
  const [draft, setDraft] = useState(initialDraft);
  const [thumbPreview, setThumbPreview] = useState(thumbnailUrl || null);
  const [thumbUploading, setThumbUploading] = useState(false);
  const [thumbError, setThumbError] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [ingredientsList, setIngredientsList] = useState(() =>
    initialDraft.mainIngredients ? initialDraft.mainIngredients.split('\n').filter(Boolean) : []
  );
  const [ingInput, setIngInput] = useState('');
  const [ingAmountInput, setIngAmountInput] = useState('');
  const [ingComposing, setIngComposing] = useState(false);
  const [stepComposing, setStepComposing] = useState(false);
  const nameInputRef = useRef(null);
  const [editingIngIndex, setEditingIngIndex] = useState(null);
  const [editingIngName, setEditingIngName] = useState('');
  const [editingIngAmount, setEditingIngAmount] = useState('');

  // autocomplete state
  const [ingSuggestions, setIingSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activeSuggIdx, setActiveSuggIdx] = useState(-1);

  // restored item highlight — stored as Set<string> (item values) so drag reorder doesn't break it
  const [restoredItems, setRestoredItems] = useState(null); // null | Set<string>
  const [restoredStepItems, setRestoredStepItems] = useState(null); // null | Set<string>

  // draft restore banner state
  const [draftBanner, setDraftBanner] = useState(null); // null | { draft, ingredientsList, stepsList, savedAt }

  const draftKey = `findish_draft_${recipeUrl}`;
  const autoSaveTimer = useRef(null);

  const parseIngredientInput = parseIngText;

  const startEditIng = (i, ing) => {
    const parsed = parseIngredientInput(ing);
    setEditingIngIndex(i);
    setEditingIngName(parsed.name || ing);
    setEditingIngAmount(parsed.amount || '');
  };

  const saveEditIng = () => {
    if (!editingIngName.trim()) return;
    const combined = editingIngAmount.trim()
      ? `${editingIngName.trim()} ${editingIngAmount.trim()}`
      : editingIngName.trim();
    setIngredientsList(l => l.map((item, idx) => idx === editingIngIndex ? combined : item));
    setEditingIngIndex(null);
  };

  const [stepsList, setStepsList] = useState(() =>
    initialDraft.steps ? initialDraft.steps.split('\n').filter(Boolean) : ['']
  );
  const tipLabel = uploaderName ? `${uploaderName}'s TIP` : t.tip;

  const [ingParsing, setIngParsing] = useState(false);

  // Check localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem(draftKey);
    if (saved) {
      try { setDraftBanner(JSON.parse(saved)); } catch {}
    }
    // beforeunload warning
    const handleBeforeUnload = (e) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-save with 500ms debounce
  useEffect(() => {
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(() => {
      localStorage.setItem(draftKey, JSON.stringify({ draft, ingredientsList, stepsList, savedAt: Date.now() }));
    }, 500);
    return () => { if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft, ingredientsList, stepsList]);

  const addIngredient = async (val) => {
    const rawName = (val ?? ingInput).trim();
    const rawAmount = ingAmountInput.trim();
    if (!rawName) return;
    let name = rawName;
    let amount = rawAmount;
    if (rawName && !rawAmount) {
      try {
        setIngParsing(true);
        const res = await fetch(`${API_BASE}/parse-ingredient`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: rawName }),
        });
        const data = await res.json();
        name = data.name || rawName;
        amount = data.amount || '';
      } catch {
        const parsed = parseIngredientInput(rawName);
        name = parsed.name;
        amount = parsed.amount;
      } finally {
        setIngParsing(false);
      }
    }
    const combined = amount ? `${name} ${amount}` : name;
    setIngredientsList(l => [...l, combined]);
    setIngInput('');
    setIngAmountInput('');
    setShowSuggestions(false);
    setIingSuggestions([]);
    setActiveSuggIdx(-1);
    setTimeout(() => nameInputRef.current?.focus(), 0);
  };

  const handleThumbFile = async (file) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) { setThumbError('이미지 파일만 업로드 가능합니다.'); return; }
    if (file.size > 5 * 1024 * 1024) { setThumbError('5MB 이하 파일만 업로드 가능합니다.'); return; }
    setThumbError('');
    setThumbUploading(true);
    const localPreview = URL.createObjectURL(file);
    setThumbPreview(localPreview);
    try {
      const ytId = recipeUrl?.match(/(?:v=|youtu\.be\/)([^&?/]+)/)?.[1] || Date.now();
      const storageRef = ref(storage, `thumbnails/${ytId}_${Date.now()}`);
      await uploadBytes(storageRef, file);
      const downloadUrl = await getDownloadURL(storageRef);
      onSaveThumbnail(downloadUrl);
      setThumbPreview(downloadUrl);
    } catch (e) {
      setThumbError('업로드 실패. 다시 시도해주세요.');
      setThumbPreview(thumbnailUrl || null);
    } finally {
      setThumbUploading(false);
    }
  };

  const makeStepHandlers = (list, setList, prefix) => ({
    onChange: (i, val) => { const n = [...list]; n[i] = val; setList(n); },
    onKeyDown: (e, i) => {
      if (e.key === 'Enter' && !stepComposing) {
        e.preventDefault();
        const n = [...list]; n.splice(i + 1, 0, ''); setList(n);
        setTimeout(() => document.getElementById(`${prefix}-${i + 1}`)?.focus(), 0);
      }
      if (e.key === 'Backspace' && list[i] === '' && list.length > 1) {
        e.preventDefault();
        setList(list.filter((_, idx) => idx !== i));
        setTimeout(() => document.getElementById(`${prefix}-${Math.max(0, i - 1)}`)?.focus(), 0);
      }
    },
    onRemove: (i) => setList(list.filter((_, idx) => idx !== i)),
    onAdd: () => setList([...list, '']),
  });

  const stepHandlers = makeStepHandlers(stepsList, setStepsList, 'step-input');

  const handleSave = () => {
    localStorage.removeItem(draftKey);
    onSave({ ...draft, mainIngredients: ingredientsList.filter(Boolean).join('\n'), steps: stepsList.filter(Boolean).join('\n') });
  };

  const handleCancel = () => {
    const saved = localStorage.getItem(draftKey);
    if (saved) {
      if (window.confirm('작업 중인 내용이 있습니다. 취소하시겠습니까?')) {
        localStorage.removeItem(draftKey);
        onCancel();
      }
    } else {
      onCancel();
    }
  };

  return (
    <div className="recipe-edit-panel">
      <div className={`recipe-edit-topbar${darkMode ? ' dark' : ''}`}>
        <span className="recipe-edit-topbar-title">편집 중</span>
        <div className="recipe-edit-topbar-actions">
          <button className={`recipe-edit-cancel-btn${darkMode ? ' dark' : ''}`} onClick={handleCancel}>취소</button>
          <button className={`recipe-edit-save-btn${darkMode ? ' dark' : ''}`} onClick={handleSave}>저장</button>
        </div>
      </div>
      {draftBanner && (
        <div className={`draft-restore-banner${darkMode ? ' dark' : ''}`}>
          <span>
            <strong>"{draftBanner.draft?.name || '이전 작업'}"</strong> 임시 저장된 내용이 있어요.
          </span>
          <div>
            <button className="draft-restore-btn" onClick={() => {
              if (draftBanner.draft) setDraft(draftBanner.draft);
              if (draftBanner.ingredientsList) {
                const currentSet = new Set(ingredientsList.filter(Boolean));
                const diffValues = new Set(
                  draftBanner.ingredientsList.filter(item => item && !currentSet.has(item))
                );
                setIngredientsList(draftBanner.ingredientsList);
                setRestoredItems(diffValues.size > 0 ? diffValues : null);
              }
              if (draftBanner.stepsList) {
                const currentStepSet = new Set(stepsList.filter(Boolean));
                const diffStepValues = new Set(
                  draftBanner.stepsList.filter(item => item && !currentStepSet.has(item))
                );
                setStepsList(draftBanner.stepsList);
                setRestoredStepItems(diffStepValues.size > 0 ? diffStepValues : null);
              }
              setDraftBanner(null);
            }}>복원</button>
            <button className="draft-dismiss-btn" onClick={() => {
              localStorage.removeItem(draftKey);
              setDraftBanner(null);
            }}>무시</button>
          </div>
        </div>
      )}
      <label className="recipe-edit-field-label">요리명</label>
      <input
        className={`recipe-edit-input${darkMode ? ' dark' : ''}`}
        value={draft.name || ''}
        onChange={e => setDraft(d => ({ ...d, name: e.target.value }))}
        placeholder="요리 이름"
      />
      <label className="recipe-edit-field-label" style={{ marginTop: 12 }}>
        👨‍🍳 {tipLabel} <span style={{ fontWeight: 400, opacity: 0.5 }}>(선택)</span>
      </label>
      <textarea
        className={`recipe-edit-textarea${darkMode ? ' dark' : ''}`}
        value={draft.tip}
        onChange={e => setDraft(d => ({ ...d, tip: e.target.value }))}
        rows={3}
        placeholder="재료 준비 팁이나 맛을 더하는 포인트를 남겨보세요"
      />
      <div className="recipe-edit-recipe-header" style={{ marginTop: 12 }}>
        <label className="recipe-edit-field-label" style={{ margin: 0 }}>RECIPE</label>
        <input
          className={`recipe-servings-input${darkMode ? ' dark' : ''}`}
          value={draft.servings || ''}
          onChange={e => setDraft(d => ({ ...d, servings: e.target.value }))}
          placeholder="인분"
        />
      </div>
      <div className="ing-list-outer">
        <div className={`ing-list-container${darkMode ? ' dark' : ''}`}>
          {ingredientsList.length > 0 && (
            <div className={`ing-list-header${darkMode ? ' dark' : ''}`}>
              <span>재료</span>
              <span>수량</span>
              <span />
            </div>
          )}
          <DndContext collisionDetection={closestCenter} onDragEnd={({ active, over }) => {
            if (!over || active.id === over.id) return;
            const oldIndex = parseInt(active.id, 10);
            const newIndex = parseInt(over.id, 10);
            setIngredientsList(l => arrayMove(l, oldIndex, newIndex));
          }}>
            <SortableContext items={ingredientsList.map((_, i) => String(i))} strategy={verticalListSortingStrategy}>
              {ingredientsList.map((ing, i) => (
                <SortableIngRow
                  key={String(i)}
                  id={String(i)}
                  ing={ing}
                  index={i}
                  darkMode={darkMode}
                  editingIngIndex={editingIngIndex}
                  editingIngName={editingIngName}
                  editingIngAmount={editingIngAmount}
                  setEditingIngName={setEditingIngName}
                  setEditingIngAmount={setEditingIngAmount}
                  setEditingIngIndex={setEditingIngIndex}
                  saveEditIng={saveEditIng}
                  startEditIng={startEditIng}
                  setIngredientsList={setIngredientsList}
                  parseIngredientInput={parseIngredientInput}
                  isRestored={restoredItems?.has(ing) ?? false}
                  onClearRestored={() => setRestoredItems(prev => { if (!prev) return prev; const next = new Set(prev); next.delete(ing); return next.size ? next : null; })}
                />
              ))}
            </SortableContext>
          </DndContext>
        </div>
        <div className={`ing-add-row${darkMode ? ' dark' : ''}`}>
          <div className="ing-autocomplete-wrap">
            <input
              ref={nameInputRef}
              className={`ing-add-name${darkMode ? ' dark' : ''}`}
              value={ingInput}
              onChange={e => {
                const val = e.target.value;
                setIngInput(val);
                if (val.trim()) {
                  const filtered = ALL_INGREDIENT_NAMES.filter(n => n.includes(val.trim())).slice(0, 8);
                  setIingSuggestions(filtered);
                  setShowSuggestions(filtered.length > 0);
                  setActiveSuggIdx(-1);
                } else {
                  setShowSuggestions(false);
                  setIingSuggestions([]);
                }
              }}
              onCompositionStart={() => setIngComposing(true)}
              onCompositionEnd={e => { setIngComposing(false); setIngInput(e.target.value); }}
              onKeyDown={e => {
                if (showSuggestions && ingSuggestions.length > 0) {
                  if (e.key === 'ArrowDown') { e.preventDefault(); setActiveSuggIdx(i => Math.min(i + 1, ingSuggestions.length - 1)); return; }
                  if (e.key === 'ArrowUp') { e.preventDefault(); setActiveSuggIdx(i => Math.max(i - 1, -1)); return; }
                  if (e.key === 'Escape') { setShowSuggestions(false); return; }
                  if (e.key === 'Enter' && !ingComposing) {
                    e.preventDefault();
                    if (activeSuggIdx >= 0) {
                      setIngInput(ingSuggestions[activeSuggIdx] + ' ');
                      setShowSuggestions(false);
                      setActiveSuggIdx(-1);
                    } else {
                      setShowSuggestions(false);
                      setActiveSuggIdx(-1);
                    }
                    return;
                  }
                } else {
                  if (e.key === 'Enter' && !ingComposing) {
                    e.preventDefault();
                    if (!ingAmountInput.trim()) {
                      const parsed = parseIngredientInput(ingInput.trim());
                      if (parsed.amount) {
                        setIngInput(parsed.name);
                        setIngAmountInput(parsed.amount);
                        setTimeout(() => document.getElementById('ing-amount-input')?.focus(), 0);
                        return;
                      }
                    }
                    addIngredient();
                  }
                }
              }}
              onBlur={() => { setTimeout(() => setShowSuggestions(false), 150); }}
              placeholder="재료명 (예: 양파 5개)"
            />
            {showSuggestions && ingSuggestions.length > 0 && (
              <div className={`ing-suggestions${darkMode ? ' dark' : ''}`}>
                {ingSuggestions.map((s, idx) => (
                  <div
                    key={s}
                    className={`ing-suggestion-item${idx === activeSuggIdx ? ' active' : ''}`}
                    onMouseDown={() => {
                      setIngInput(s + ' ');
                      setShowSuggestions(false);
                      setActiveSuggIdx(-1);
                      setTimeout(() => nameInputRef.current?.focus(), 0);
                    }}
                  >{s}</div>
                ))}
              </div>
            )}
          </div>
          <input
            id="ing-amount-input"
            className={`ing-add-amount${darkMode ? ' dark' : ''}`}
            value={ingAmountInput}
            onChange={e => setIngAmountInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') { e.preventDefault(); addIngredient(); }
            }}
            placeholder="수량"
          />
          <button className="ing-add-btn" onClick={() => addIngredient()} disabled={ingParsing}>
            {ingParsing ? '...' : '추가'}
          </button>
        </div>
      </div>{/* ing-list-outer */}
      <label className="recipe-edit-field-label" style={{ marginTop: 12 }}>INSTRUCTION</label>
      <div className="steps-edit-list">
        {stepsList.map((step, i) => (
          <div key={i} className={`step-edit-row${restoredStepItems?.has(step) ? ' restored' : ''}`}>
            <span className="step-edit-number">{i + 1}.</span>
            <input
              id={`step-input-${i}`}
              className={`step-edit-input${darkMode ? ' dark' : ''}`}
              value={step}
              onChange={e => {
                stepHandlers.onChange(i, e.target.value);
                setRestoredStepItems(prev => { if (!prev) return prev; const next = new Set(prev); next.delete(step); return next.size ? next : null; });
              }}
              onCompositionStart={() => setStepComposing(true)}
              onCompositionEnd={() => setStepComposing(false)}
              onKeyDown={e => stepHandlers.onKeyDown(e, i)}
              placeholder={`스텝 ${i + 1}`}
            />
            {stepsList.length > 1 && (
              <button className="step-edit-remove" onClick={() => stepHandlers.onRemove(i)}>×</button>
            )}
          </div>
        ))}
        <button className="step-edit-add" onClick={stepHandlers.onAdd}>+ 스텝 추가</button>
      </div>

      <label className="recipe-edit-field-label" style={{ marginTop: 12 }}>
        썸네일 <span style={{ fontWeight: 400, opacity: 0.5 }}>(선택)</span>
      </label>
      <div
        className={`thumb-upload-zone${isDragging ? ' dragging' : ''}${darkMode ? ' dark' : ''}`}
        onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={e => { e.preventDefault(); setIsDragging(false); handleThumbFile(e.dataTransfer.files[0]); }}
        onClick={() => document.getElementById('thumb-file-input').click()}
      >
        {thumbPreview ? (
          <img src={thumbPreview} alt="썸네일 미리보기" className="thumb-preview-img" />
        ) : (
          <div className="thumb-upload-placeholder">
            <span>사진을 드래그하거나 클릭해서 업로드</span>
            <span className="thumb-upload-sub">JPG, PNG, WEBP · 최대 5MB</span>
          </div>
        )}
        {thumbUploading && <div className="thumb-uploading-overlay">업로드 중...</div>}
      </div>
      <input id="thumb-file-input" type="file" accept="image/*" style={{ display: 'none' }}
        onChange={e => handleThumbFile(e.target.files[0])} />
      {thumbError && <p className="thumb-error-msg">{thumbError}</p>}
      {thumbnailUrl && (
        <button className="thumb-revert-btn"
          onClick={() => { setThumbPreview(null); onClearThumbnail(); }}>
          원본으로 되돌리기
        </button>
      )}

    </div>
  );
}

// ── 로그인 모달 ──
function LoginModal({ open, onClose, onLoginSuccess, onGoogleLogin, onKakaoLogin, darkMode }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleClose = () => {
    onClose();
    setError('');
    setUsername('');
    setPassword('');
  };

  const handleLogin = async () => {
    if (!username.trim() || !password) return;
    setError('');
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/auth/creator`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), password }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || '로그인 실패'); return; }
      await onLoginSuccess(data.customToken, data.user);
      setUsername('');
      setPassword('');
    } catch {
      setError('서버 연결에 실패했습니다. 잠시 후 다시 시도해주세요.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal open={open} onClose={handleClose} darkMode={darkMode}>
      <div className="login-modal">
        <h3 className="login-modal-title">크리에이터 로그인</h3>

        <div className="login-field">
          <label className="login-label">아이디</label>
          <input
            type="text"
            value={username}
            onChange={e => setUsername(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleLogin()}
            placeholder="크리에이터 아이디"
            className={`login-input${darkMode ? ' dark' : ''}`}
            autoComplete="username"
          />
        </div>
        <div className="login-field">
          <label className="login-label">비밀번호</label>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleLogin()}
            placeholder="비밀번호"
            className={`login-input${darkMode ? ' dark' : ''}`}
            autoComplete="current-password"
          />
        </div>
        {error && <p className="login-error">{error}</p>}
        <button onClick={handleLogin} className="login-submit-btn" disabled={loading}>
          {loading ? '로그인 중...' : '로그인'}
        </button>

        <div className="login-divider">또는</div>

        <div className="login-social-group">
          <button onClick={onKakaoLogin} className="social-login-btn kakao-btn">
            <svg width="16" height="16" viewBox="0 0 18 18" fill="none"><path d="M9 1.5C4.86 1.5 1.5 4.19 1.5 7.5c0 2.1 1.23 3.94 3.09 5.04L3.75 15l3.4-1.78A8.7 8.7 0 009 13.5c4.14 0 7.5-2.69 7.5-6S13.14 1.5 9 1.5z" fill="#191919"/></svg>
            카카오로 로그인
          </button>
          <button onClick={onGoogleLogin} className="social-login-btn google-btn">
            <svg width="16" height="16" viewBox="0 0 18 18"><path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 01-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/><path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#34A853"/><path d="M3.964 10.706A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.706V4.962H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.038l3.007-2.332z" fill="#FBBC05"/><path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.962L3.964 6.294C4.672 4.169 6.656 3.58 9 3.58z" fill="#EA4335"/></svg>
            구글로 로그인
          </button>
        </div>
      </div>
    </Modal>
  );
}

// slug → chefKey 역방향 맵
const slugToKey = Object.entries(chefConfig).reduce((acc, [key, val]) => {
  if (val.slug) acc[val.slug] = key;
  return acc;
}, {});

const InstagramGradientIcon = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" style={{ display: "block" }}>
    <defs>
      <radialGradient id="ig-grad-header" cx="30%" cy="107%" r="150%">
        <stop offset="0%" stopColor="#fdf497" />
        <stop offset="5%" stopColor="#fdf497" />
        <stop offset="45%" stopColor="#fd5949" />
        <stop offset="60%" stopColor="#d6249f" />
        <stop offset="90%" stopColor="#285AEB" />
      </radialGradient>
    </defs>
    <rect x="2" y="2" width="20" height="20" rx="5.5" fill="url(#ig-grad-header)" />
    <circle cx="12" cy="12" r="4.6" stroke="white" strokeWidth="1.8" fill="none" />
    <circle cx="17.5" cy="6.5" r="1.2" fill="white" />
  </svg>
);


const YouTubeHeaderIcon = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ display: "block" }}>
    <rect width="24" height="24" rx="5.5" fill="#FF0000"/>
    <path d="M19.6 8.2a2 2 0 0 0-1.4-1.4C16.9 6.5 12 6.5 12 6.5s-4.9 0-6.2.3a2 2 0 0 0-1.4 1.4C4.1 9.5 4.1 12 4.1 12s0 2.5.3 3.8a2 2 0 0 0 1.4 1.4c1.3.3 6.2.3 6.2.3s4.9 0 6.2-.3a2 2 0 0 0 1.4-1.4c.3-1.3.3-3.8.3-3.8s0-2.5-.3-3.8z" fill="white"/>
    <path d="M10.2 14.5V9.5l4.2 2.5-4.2 2.5z" fill="#FF0000"/>
  </svg>
);

function extractYouTubeId(url) {
  const match = url.match(/(?:\?v=|\/embed\/|\.be\/|\/v\/|\/shorts\/)([A-Za-z0-9_-]{11})/);
  return match ? match[1] : null;
}

const RecipeCard = React.memo(function RecipeCard({
  item, thumbnailSrc, isHidden, isSaved, isMyRecipe, isCreator, isDuplicate,
  selectedIngredientValues, selectedIngredients, language,
  normalizeIng,
  onOpen, onToggleSave, onToggleHidden, onEdit, onDelete,
}) {
  const allNormalized = [...new Set((item.ingredients || []).map(ing => normalizeIng(ing)))];
  const mainIngs = allNormalized.filter(ing => !SEASONINGS.has(ing));
  const seasoningIngs = allNormalized.filter(ing => SEASONINGS.has(ing));
  const highlightedMain = mainIngs.filter(ing => selectedIngredientValues.has(ing.toLowerCase()));
  const restMain = mainIngs.filter(ing => !selectedIngredientValues.has(ing.toLowerCase()));
  const cardIngredients = [...highlightedMain, ...restMain];
  const matchCount = mainIngs.filter(ing => {
    const normalizedIng = normalizeIng(ing);
    return selectedIngredients.filter(s => s.group !== "menu").some(opt => {
      const normalizedVal = normalizeIng(opt.value);
      if (parentMap[normalizedVal]) {
        const allVariants = [normalizedVal, ...parentMap[normalizedVal].map(c => normalizeIng(c))];
        return allVariants.includes(normalizedIng);
      }
      return normalizedIng.toLowerCase() === normalizedVal.toLowerCase();
    });
  }).length;

  return (
    <li className={`menu-card${isHidden ? ' card-hidden' : ''}`} onClick={onOpen}>
      {thumbnailSrc && (
        <img src={thumbnailSrc} alt={item.name} className="menu-thumbnail" loading="lazy" decoding="async" />
      )}
      {isDuplicate && (
        <span className="menu-duplicate-badge">중복</span>
      )}
      {isMyRecipe ? (
        <div className="menu-card-actions">
          <button className="menu-card-action-btn" onClick={onToggleHidden}>
            {isHidden ? '비공개' : '공개'}
          </button>
          <button className="menu-card-action-btn" onClick={onEdit}>편집</button>
          <button
            className={`menu-card-action-btn${isSaved ? " saved" : ""}`}
            onClick={onToggleSave}
            title={isSaved ? "저장 취소" : "저장하기"}
          >
            {isSaved ? <FaBookmark size={12} /> : <FaRegBookmark size={12} />}
          </button>
        </div>
      ) : (
        <button
          className={`menu-card-save-btn${isSaved ? " saved" : ""}`}
          onClick={onToggleSave}
          title={isSaved ? (language === "kr" ? "저장 취소" : "Unsave") : (language === "kr" ? "저장하기" : "Save")}
        >
          {isSaved ? <FaBookmark size={14} /> : <FaRegBookmark size={14} />}
        </button>
      )}
      <div className="menu-text">
        <div className="menu-name">{item.name || "No Name"}</div>
        {item.uploader && (
          <div className="menu-chef-row">
            <img
              src={channelProfiles[item.uploader] || ""}
              alt={item.uploader}
              className="menu-chef-avatar"
              onError={(e) => { e.target.style.display = "none"; }}
            />
            <span className="menu-uploader">{item.uploader}</span>
            {matchCount > 0 && (
              <span className="menu-match-badge">{matchCount}/{mainIngs.length}</span>
            )}
          </div>
        )}
        <div className="ingredient-tags">
          {cardIngredients.slice(0, 5).map((ing, i) => {
            const isHighlighted = selectedIngredientValues.has(ing.toLowerCase());
            const displayName = parseIngText(ing).name;
            return (
              <span key={i} className="pill-tip-wrapper" data-tip={ing}>
                <span className={`ingredient-pill${isHighlighted ? " ingredient-pill-highlight" : ""}`}>
                  {displayName}
                </span>
              </span>
            );
          })}
          {cardIngredients.length > 5 && (
            <span className="ingredient-pill ingredient-pill-more">
              +{cardIngredients.length - 5}
            </span>
          )}
          {seasoningIngs.length > 0 && (
            <span className="ingredient-pill ingredient-pill--seasoning ingredient-pill--seasoning-card">
              {language === "kr" ? `+양념 ${seasoningIngs.length}` : `+Seasonings ${seasoningIngs.length}`}
            </span>
          )}
        </div>
      </div>
    </li>
  );
});

const EN_PLURAL_MAP = {
  "eggs": "egg", "egg yolks": "egg yolk",
  "tomatoes": "tomato", "onions": "onion", "green onions": "green onion",
  "mushrooms": "mushroom", "potatoes": "potato", "carrots": "carrot",
  "cloves": "clove", "anchovies": "anchovy", "olives": "olive",
  "capers": "caper", "lemons": "lemon", "limes": "lime",
  "shallots": "shallot", "scallions": "scallion", "peppers": "pepper",
  "bay leaves": "bay leaf", "herbs": "herb", "oysters": "oyster",
};

// 의미상 동일한 영어 재료 통합 맵
const EN_SYNONYM_MAP = {
  // 마늘
  "minced garlic": "garlic", "garlic clove": "garlic",
  // 양파
  "red onion": "onion",
  // 올리브 오일
  "extra virgin olive oil": "olive oil", "pure olive oil": "olive oil",
  // 파르메산
  "parmigiano reggiano cheese": "parmesan cheese",
  "parmigiano-reggiano cheese": "parmesan cheese",
  "reggiano cheese": "parmesan cheese",
  "pecorino romano cheese": "pecorino cheese",
  // 치즈 표기 통일
  "mozzarella": "mozzarella cheese",
  "mascarpone": "mascarpone cheese",
  "ricotta": "ricotta cheese",
  // 파
  "scallion": "green onion",
  // 크림
  "whipping cream": "heavy cream",
  // 토마토 (가공품은 원재료로 통일)
  "whole peeled tomatoes": "tomato", "whole tomatoes": "tomato", "canned tomatoes": "tomato",
  // 소스
  "tabasco sauce": "tabasco", "sriracha sauce": "sriracha",
  // 빵
  "bread slices": "bread",
  // 파스타 → pasta로 통합
  "spaghetti": "pasta", "linguine": "pasta", "spaghettini": "pasta",
  "rigatoni": "pasta", "orecchiette": "pasta", "penne pasta": "pasta", "tagliatelle": "pasta",
  // 올리브 종류 → olive
  "black olives": "olive", "green olives": "olive", "taggiasca olives": "olive",
  // 고추 표기 통일
  "cheongyang chili": "cheongyang chili pepper", "cheongyang pepper": "cheongyang chili pepper",
  "red chili": "red chili pepper",
  "green chili": "green chili pepper",
  "red bell pepper": "bell pepper",
  // 깨
  "black sesame seeds": "sesame seeds",
  // 문어
  "webfoot octopus": "octopus",
};

const isValidRecipe = (item) =>
  item.name !== "Only 제품 설명 OR 홍보" &&
  item.name !== "건너뜀 - 영상 너무 김" &&
  item.name !== "분석 불가" &&
  !(item.ingredients || []).includes("Only 제품 설명 OR 홍보");

const SEASONINGS = new Set([
  "소금","후추","설탕","밀가루","기름","면수","샐러리 소금","백후추","핑크 페퍼콘","슈가파우더","아이싱 슈가",
  "올리브 오일","식용유","참기름","들기름","고추기름","오리 기름","트러플","트러플 오일","화이트 트러플 오일","오일",
  "간장","된장","고추장","고춧가루","참치액","연두","새우젓","액젓",
  "청주","미림","유자청","청하",
  "식초","발사믹 식초","화이트 발사믹","사과 식초","와인 식초","레드와인 식초","화이트 와인 비니거",
  "꿀","조청","물엿","올리고당","매실청","매실액",
  "케첩","마요네즈","굴소스","굴 소스","우스터 소스","타바스코","타바스코 소스","스리라차 소스","디종 머스타드","홀그레인 머스타드",
  "치킨스톡","치킨 스톡","코인 육수","야채 육수","채소 육수","조개 육수","해물 육수",
  "월계수잎","타임","로즈마리","오레가노","차이브","민트","파슬리","허브","양꼬치 시즈닝",
  "깨","흰깨","검은깨","통깨",
  "파프리카 파우더","파프리카 가루","스모크 파프리카","넛맥","계피","클로브",
  "전분","베이킹 파우더","MSG","옥수수 전분","클래식 비네그레트",
  "salt","pepper","sugar","flour","oil",
  "olive oil","sesame oil","vegetable oil","perilla oil","chili oil",
  "truffle","truffle oil","white truffle oil",
  "soy sauce","miso","gochujang","red pepper flakes","fish sauce","salted shrimp",
  "rice wine","mirin","yuja syrup","cheongha","sake",
  "vinegar","balsamic vinegar","balsamic glaze","white balsamic","apple cider vinegar",
  "wine vinegar","red wine vinegar","white wine vinegar",
  "honey","corn syrup","rice syrup","oligosaccharide","plum syrup",
  "ketchup","mayonnaise","oyster sauce","worcestershire sauce","hot sauce",
  "tabasco","sriracha","dijon mustard","whole grain mustard",
  "chicken stock","vegetable stock","seafood stock","chicken broth","vegetable broth","broth","beef stock",
  "bay leaf","thyme","rosemary","oregano","chives","mint","herb",
  "parsley","basil","dill","cilantro",
  "black pepper","white pepper","pink peppercorns","cayenne pepper",
  "peperoncino","chili powder","red pepper powder","gochugaru",
  "paprika powder","smoked paprika","nutmeg","cinnamon","clove",
  "curry powder","celery salt",
  "cornstarch","starch","baking powder","msg",
  "brown sugar","powdered sugar","classic vinaigrette","perilla seed powder",
]);

const parentMap = {
  "돼지고기": ["삼겹살","목살","항정살","돼지등갈비","돼지 뒷다리살","돼지 앞다리살","돼지 등심","돼지갈비","듀록"],
  "닭고기": ["닭가슴살","닭다리","닭다리살","수비드 닭가슴살","닭발","닭뼈","닭간","토종닭 다리"],
  "소고기": ["소고기 갈비살","안심","양갈비","LA갈비","소고기 등심","한우패티","토마호크","채끝살","우둔살","우삼겹","떡갈비"],
  "치즈": ["파마산 치즈","크림치즈","페타 치즈","부라타 치즈","블루 치즈","까망베르 치즈","고르곤졸라 치즈","리코타 치즈","모짜렐라 치즈","그뤼에르 치즈","체다 치즈"],
  "김치": ["묵은지","백김치"],
  "버섯": ["표고 버섯","느타리 버섯","팽이 버섯","새송이 버섯","포르치니 버섯","양송이 버섯"],
  "토마토": ["방울토마토","선드라이토마토","토마토소스","토마토홀"],
  "식초": ["발사믹 식초","화이트 발사믹"],
  "빵": ["식빵"],
  "파스타": ["스파게티","링귀네","펜네","부카티니","카펠리니","탈리아텔레"],
};

function App() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const CHEF_FILTER = slugToKey[slug] || process.env.REACT_APP_CHEF || null;
  const chefProfile = CHEF_FILTER ? chefConfig[CHEF_FILTER] : null;

  const [analyzeOpen, setAnalyzeOpen] = useState(false);
  const [recipeModal, setRecipeModal] = useState(null);
  const [activeTab, setActiveTab] = useState("home"); // "home" | "chef" | "saved"
  const [savedRecipes, setSavedRecipes] = useState([]);
  const [toast, setToast] = useState(null); // { message, key }

  const defaultLanguage = navigator.language.startsWith("ko") ? "kr" : "en";
  const [language, setLanguage] = useState(defaultLanguage);
  const t = translations[language];
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('findish_dark') === 'true');
  const [searchActive, setSearchActive] = useState(false);
  const [modalVideoPlaying, setModalVideoPlaying] = useState(false);

  const [creatorUser, setCreatorUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('findish_creator')) || null; } catch { return null; }
  });
  const [socialUser, setSocialUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('findish_social')) || null; } catch { return null; }
  });
  const [socialLoading, setSocialLoading] = useState(() => {
    const hasCode = !!new URLSearchParams(window.location.search).get('code');
    const hasCached = !!localStorage.getItem('findish_social');
    return hasCode && !hasCached;
  });
  const [loginModalOpen, setLoginModalOpen] = useState(false);
  const [thumbnailOverrides, setThumbnailOverrides] = useState(() => {
    try { return JSON.parse(localStorage.getItem('findish_thumbnails')) || {}; } catch { return {}; }
  });
  const [recipeEdits, setRecipeEdits] = useState(() => {
    try { return JSON.parse(localStorage.getItem('findish_recipe_edits')) || {}; } catch { return {}; }
  });

  const showToast = (message) => {
    const key = Date.now();
    setToast({ message, key });
    setTimeout(() => setToast(t => t?.key === key ? null : t), 2500);
  };

  // 현재 로그인한 유저의 Firestore uid (소셜/크리에이터 통합)
  const currentUid = socialUser?.uid || creatorUser?.uid || null;

  // Firebase Auth 세션 복원
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          const snap = await getDoc(doc(db, 'users', firebaseUser.uid));
          if (snap.exists()) {
            const data = snap.data();
            setSocialUser(data);
            localStorage.setItem('findish_social', JSON.stringify(data));
          }
        } catch {}
      } else {
        setSocialUser(null);
        localStorage.removeItem('findish_social');
      }
    });
    return () => unsub();
  }, []);

  // 북마크 Firestore 실시간 동기화
  useEffect(() => {
    if (!currentUid) { setSavedRecipes([]); return; }
    const ref = doc(db, 'users', currentUid);
    const unsub = onSnapshot(ref, (snap) => {
      if (snap.exists()) {
        setSavedRecipes(snap.data().bookmarks || []);
      } else {
        setSavedRecipes([]);
      }
    });
    return () => unsub();
  }, [currentUid]);


  // 팝업 모드: 팝업 창 안에서 ?code= 처리 후 부모 창에 메시지 전송
  useEffect(() => {
    if (!window.opener) return;
    const params = new URLSearchParams(window.location.search);
    const kakaoCode = params.get('code');
    if (!kakaoCode) return;
    const redirectUri = window.location.origin + '/kakao-popup';
    (async () => {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 25000);
        const res = await fetch(`${API_BASE}/auth/kakao`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code: kakaoCode, redirect_uri: redirectUri }),
          signal: controller.signal,
        });
        clearTimeout(timeout);
        const data = await res.json();
        if (data.customToken) {
          window.opener.postMessage({ type: 'KAKAO_AUTH_SUCCESS', customToken: data.customToken, user: data.user }, window.location.origin);
        }
      } catch (err) {
        console.error('팝업 카카오 인증 실패:', err);
      }
      window.close();
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 팝업에서 보낸 메시지 수신 → 메인 창에서 로그인 처리
  useEffect(() => {
    const handleMessage = async (e) => {
      if (e.origin !== window.location.origin) return;
      if (e.data?.type !== 'KAKAO_AUTH_SUCCESS') return;
      try {
        const cred = await signInWithCustomToken(auth, e.data.customToken);
        const userData = {
          uid: cred.user.uid,
          name: e.data.user.name,
          photoURL: e.data.user.photoURL,
          email: e.data.user.email || '',
          provider: 'kakao',
          lastLoginAt: new Date(),
        };
        setSocialUser(userData);
        localStorage.setItem('findish_social', JSON.stringify(userData));
        setDoc(doc(db, 'users', cred.user.uid), userData, { merge: true }).catch(() => {});
      } catch (err) {
        console.error('카카오 로그인 최종 처리 실패:', err);
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 일반 리다이렉트 방식 폴백 (?code= in main window, popup 아닐 때)
  useEffect(() => {
    if (window.opener) return;
    const params = new URLSearchParams(window.location.search);
    const kakaoCode = params.get('code');
    if (!kakaoCode) return;
    window.history.replaceState({}, '', window.location.pathname);
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/auth/kakao`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code: kakaoCode, redirect_uri: window.location.origin }),
        });
        const data = await res.json();
        if (!data.customToken) throw new Error(data.error || 'No token');
        const cred = await signInWithCustomToken(auth, data.customToken);
        const userData = {
          uid: cred.user.uid,
          name: data.user.name,
          photoURL: data.user.photoURL,
          email: data.user.email || '',
          provider: 'kakao',
          lastLoginAt: new Date(),
        };
        setSocialUser(userData);
        localStorage.setItem('findish_social', JSON.stringify(userData));
        setDoc(doc(db, 'users', cred.user.uid), userData, { merge: true }).catch(() => {});
      } catch (err) {
        console.error('카카오 로그인 실패:', err);
      } finally {
        setSocialLoading(false);
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Firestore 실시간 리스너 (onSnapshot) — 다른 기기 변경사항 즉시 반영
  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, 'recipe_edits'),
      (snapshot) => {
        const edits = {};
        const thumbs = {};
        snapshot.forEach(docSnap => {
          const data = docSnap.data();
          if (!data.url) return;
          const { url, thumbnail, ...editFields } = data;
          if (Object.keys(editFields).length > 0) edits[url] = editFields;
          if (thumbnail) thumbs[url] = thumbnail;
        });
        setRecipeEdits(prev => {
          const merged = { ...prev, ...edits };
          localStorage.setItem('findish_recipe_edits', JSON.stringify(merged));
          return merged;
        });
        setThumbnailOverrides(thumbs);
        localStorage.setItem('findish_thumbnails', JSON.stringify(thumbs));
      },
      (e) => console.warn('Firestore 리스너 실패, localStorage 사용:', e)
    );
    return () => unsub();
  }, []);
  const [modalEditMode, setModalEditMode] = useState(false);
  const [editDraftInit, setEditDraftInit] = useState({ mainIngredients: '', seasonings: '', steps: '', tip: '', servings: '' });
  const [deletedKeys, setDeletedKeys] = useState(() => {
    try {
      const stored = sessionStorage.getItem('findish_deleted_urls');
      return stored ? new Set(JSON.parse(stored)) : new Set();
    } catch { return new Set(); }
  });
  const [confirmDialog, setConfirmDialog] = useState(null); // { message, onConfirm }

  const currentRawData = useMemo(() =>
    (language === "en" ? menuData_en : menuData_kr)
      .filter(item => !CHEF_FILTER || item.uploader === CHEF_FILTER),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [language]
  );

  const sortedData = useMemo(() =>
    [...currentRawData]
      .sort((a, b) => new Date(b.upload_date) - new Date(a.upload_date))
      .map(item => {
        const edit = recipeEdits[item.url];
        let ingredients = item.ingredients || [];
        if (edit && (edit.mainIngredients?.length > 0 || edit.seasonings?.length > 0)) {
          ingredients = [...(edit.mainIngredients || []), ...(edit.seasonings || [])];
        }
        return {
          ...item,
          name: edit?.name || item.name,
          hidden: edit?.hidden || false,
          ingredients: Array.isArray(ingredients) ? [...ingredients].sort() : [],
        };
      }),
    [currentRawData, recipeEdits]
  );

  const isCreator = !!creatorUser;
  const validRecipes = useMemo(() =>
    sortedData.filter(item =>
      isValidRecipe(item) && (!(recipeEdits[item.url]?.hidden) || isCreator)
    ),
    [sortedData, recipeEdits, isCreator]
  );

  const POPULAR_TAG_BLOCKLIST = new Set([
    "소금", "후추", "설탕", "물", "식용유", "올리브 오일", "올리브오일", "올리브유",
    "다진 마늘", "마늘", "간장", "참기름", "들기름", "식초", "고추장", "된장", "쌈장",
    "고춧가루", "깨", "참깨", "후춧가루", "흑후추", "백후추",
    "salt", "pepper", "sugar", "water", "olive oil", "garlic", "soy sauce",
    "black pepper", "white pepper", "sesame oil", "vinegar",
    "파슬리", "바질", "로즈마리", "타임", "오레가노",
  ]);

  const popularTags = useMemo(() => {
    if (!CHEF_FILTER) {
      return language === "kr"
        ? ["계란", "삼겹살", "두부", "연어", "파스타", "새우", "소고기", "김치", "감자", "닭가슴살"]
        : ["Egg", "Pork belly", "Tofu", "Salmon", "Pasta", "Shrimp", "Beef", "Kimchi", "Potato", "Chicken breast"];
    }
    const freq = {};
    validRecipes.forEach(recipe => {
      (recipe.ingredients || []).forEach(ing => {
        const key = ing.replace(/\s*\(.*?\)\s*/g, "").trim();
        if (key && !POPULAR_TAG_BLOCKLIST.has(key)) {
          freq[key] = (freq[key] || 0) + 1;
        }
      });
    });
    return Object.entries(freq)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([name]) => name);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [language, validRecipes]);

  const [searchResults, setSearchResults] = useState(sortedData);
  const [selectedIngredients, setSelectedIngredients] = useState([]);
  const [searchInputValue, setSearchInputValue] = useState("");

  // 언어 변경 시 검색 결과 및 선택 재료 초기화
  useEffect(() => {
    setSearchResults(sortedData);
    setSelectedIngredients([]);
    setSearchActive(false);
    setSearchInputValue("");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [language]);

  const toggleDarkMode = () => setDarkMode(prev => {
    const next = !prev;
    localStorage.setItem('findish_dark', String(next));
    return next;
  });

  const toggleSave = async (url) => {
    if (!currentUid) { setLoginModalOpen(true); return; }
    const isSaved = savedRecipes.includes(url);
    const next = isSaved ? savedRecipes.filter(u => u !== url) : [...savedRecipes, url];
    setSavedRecipes(next); // optimistic update
    try {
      await setDoc(doc(db, 'users', currentUid), { bookmarks: next }, { merge: true });
      showToast(isSaved ? '저장 해제되었습니다.' : '저장되었습니다.');
    } catch {
      setSavedRecipes(savedRecipes); // rollback
      showToast('저장에 실패했습니다. 다시 시도해주세요.');
    }
  };

  const handleLoginSuccess = async (customToken, user) => {
    try {
      await signInWithCustomToken(auth, customToken);
    } catch {}
    const userData = { ...user, lastLoginAt: new Date() };
    setCreatorUser(userData);
    localStorage.setItem('findish_creator', JSON.stringify(userData));
    setLoginModalOpen(false);
  };

  const handleLogout = () => {
    setCreatorUser(null);
    localStorage.removeItem('findish_creator');
  };

  const handleGoogleLogin = async () => {
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const user = result.user;
      const userData = {
        uid: user.uid,
        name: user.displayName,
        photoURL: user.photoURL,
        email: user.email,
        provider: 'google',
        lastLoginAt: new Date(),
      };
      await setDoc(doc(db, 'users', user.uid), userData, { merge: true });
      setSocialUser(userData);
      setLoginModalOpen(false);
    } catch (err) {
      console.error('Google 로그인 실패:', err);
    }
  };

  const handleKakaoLogin = () => {
    const redirectUri = window.location.origin + '/kakao-popup';
    const params = new URLSearchParams({
      client_id: (process.env.REACT_APP_KAKAO_REST_KEY || '').trim(),
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'profile_nickname profile_image',
    });
    const kakaoUrl = `https://kauth.kakao.com/oauth/authorize?${params}`;
    const popup = window.open(kakaoUrl, 'kakao_login', 'width=500,height=700,scrollbars=yes,resizable=yes');
    if (!popup) {
      // 팝업 차단 시 리다이렉트 방식으로 폴백
      const fallback = new URLSearchParams({
        client_id: (process.env.REACT_APP_KAKAO_REST_KEY || '').trim(),
        redirect_uri: window.location.origin,
        response_type: 'code',
        scope: 'profile_nickname profile_image',
      });
      window.location.href = `https://kauth.kakao.com/oauth/authorize?${fallback}`;
    }
  };

  const handleSocialLogout = async () => {
    await signOut(auth);
    setSocialUser(null);
    localStorage.removeItem('findish_social');
  };

  const saveThumbnailOverride = (recipeUrl, thumbnailUrl) => {
    const updated = { ...thumbnailOverrides, [recipeUrl]: thumbnailUrl };
    setThumbnailOverrides(updated);
    localStorage.setItem('findish_thumbnails', JSON.stringify(updated));
    const ytId = extractYouTubeId(recipeUrl);
    if (ytId) {
      setDoc(doc(db, 'recipe_edits', ytId), { url: recipeUrl, thumbnail: thumbnailUrl }, { merge: true })
        .catch(e => console.warn('썸네일 Firestore 저장 실패:', e));
    }
  };

  const clearThumbnailOverride = (recipeUrl) => {
    const updated = { ...thumbnailOverrides };
    delete updated[recipeUrl];
    setThumbnailOverrides(updated);
    localStorage.setItem('findish_thumbnails', JSON.stringify(updated));
    const ytId = extractYouTubeId(recipeUrl);
    if (ytId) {
      updateDoc(doc(db, 'recipe_edits', ytId), { thumbnail: deleteField() })
        .catch(e => console.warn('썸네일 초기화 Firestore 실패:', e));
    }
  };


  const openEditMode = (recipe) => {
    const saved = recipeEdits[recipe.url] || {};
    const all = [...new Set((recipe.ingredients || []).map(ing => normalizeIng(ing)))];
    const mainList = all.filter(ing => !SEASONINGS.has(ing));
    const seasoningList = all.filter(ing => SEASONINGS.has(ing));
    const rawSteps = saved.steps ? saved.steps : (recipe.steps || []);
    // 앞 번호("1. ") 제거 + 내부 \n을 공백으로 정규화
    const cleanedSteps = rawSteps.map(s =>
      s.replace(/^\d+[.)]\s*/, '').replace(/\n/g, ' ').trim()
    ).filter(Boolean);
    const combinedIngredients = [
      ...(saved.mainIngredients || mainList),
      ...(saved.seasonings || seasoningList),
    ];
    setEditDraftInit({
      name: saved.name || recipe.name || '',
      mainIngredients: combinedIngredients.join('\n'),
      seasonings: '',
      steps: cleanedSteps.join('\n'),
      tip: saved.tip || '',
      servings: saved.servings || '',
    });
    setModalEditMode(true);
  };

  const saveEditDraft = (recipeUrl, draft) => {
    const existing = recipeEdits[recipeUrl] || {};
    const updates = {
      ...(existing.hidden !== undefined ? { hidden: existing.hidden } : {}),
      name: draft.name?.trim() || '',
      mainIngredients: draft.mainIngredients.split('\n').map(s => s.trim()).filter(Boolean),
      seasonings: [],
      steps: draft.steps.split('\n').map(s => s.trim()).filter(Boolean),
      tip: draft.tip.trim(),
      servings: draft.servings?.trim() || '',
    };
    const updated = { ...recipeEdits, [recipeUrl]: updates };
    setRecipeEdits(updated);
    localStorage.setItem('findish_recipe_edits', JSON.stringify(updated));
    setModalEditMode(false);
    const ytId = extractYouTubeId(recipeUrl);
    if (ytId) {
      setDoc(doc(db, 'recipe_edits', ytId), { url: recipeUrl, ...updates }, { merge: true })
        .catch(e => console.warn('Firestore 저장 실패:', e));
    }
  };

  const toggleHidden = (e, recipeUrl) => {
    e.stopPropagation();
    const existing = recipeEdits[recipeUrl] || {};
    const newHidden = !existing.hidden;
    const updates = { ...existing, hidden: newHidden };
    const updated = { ...recipeEdits, [recipeUrl]: updates };
    setRecipeEdits(updated);
    localStorage.setItem('findish_recipe_edits', JSON.stringify(updated));
    const ytId = extractYouTubeId(recipeUrl);
    if (ytId) {
      setDoc(doc(db, 'recipe_edits', ytId), { url: recipeUrl, hidden: newHidden }, { merge: true })
        .catch(e => console.warn('Firestore 저장 실패:', e));
    }
  };

  // ── 동의어 맵: 같은 재료의 다른 표기 → 검색/표시 통일 ──
  // (cleanup_ingredients.py와 동일한 규칙 유지)
  const synonymMap = {
    // 올리브 오일
    "올리브오일": "올리브 오일", "올리브유": "올리브 오일",
    "엑스트라 버진 올리브오일": "올리브 오일", "엑스트라버진 올리브오일": "올리브 오일",
    "엑스트라버진 올리브 오일": "올리브 오일", "엑스트라버진 오일": "올리브 오일",
    "엑스트라버진 올리브유": "올리브 오일", "엑스트라 버진오일": "올리브 오일",
    "엑스트라버진오일": "올리브 오일", "엑스트라 버진 올리브 오일": "올리브 오일",
    "퓨어 올리브 오일": "올리브 오일", "퓨어올리브오일": "올리브 오일",
    "퓨어올리브유": "올리브 오일", "퓨어 올리브유": "올리브 오일",
    "콩피오일": "올리브 오일", "콩피 오일": "올리브 오일",
    // 올리브 열매
    "그린올리브": "올리브", "그린 올리브": "올리브", "블랙올리브": "올리브",
    "타쟈스카 올리브": "올리브", "패키지 올리브": "올리브",
    // 고춧가루
    "고추가루": "고춧가루", "청양고춧가루": "고춧가루",
    "고운고추가루": "고춧가루", "굵은 고추가루": "고춧가루", "고운고춧가루": "고춧가루",
    // 계란
    "달걀": "계란", "감동란": "계란", "감 동란": "계란",
    "계란 노른자": "계란", "달걀 노른자": "계란", "달걀 (노른자만)": "계란",
    "노른자": "계란", "달걀 흰자": "계란", "반숙란": "계란",
    // 계피
    "계피가루": "계피", "계피스틱": "계피",
    // 김치
    "배추 김치": "김치", "배추김치": "김치", "신김치": "김치",
    // 버터
    "무염 버터": "버터", "무염버터": "버터", "기버터": "버터",
    "가염버터": "버터", "버터(가염)": "버터",
    // 마늘
    "다진 마늘": "마늘", "편마늘": "마늘", "마늘 파우더": "마늘",
    // 대파
    "대파 녹색부분": "대파", "대파 흰부분": "대파", "파": "대파",
    // 양파
    "양파분말": "양파", "적양파": "양파", "보라색 양파": "양파",
    // 파마산 치즈
    "파마산 치즈 가루": "파마산 치즈", "파마산치즈": "파마산 치즈",
    "파마산": "파마산 치즈", "파르메산 치즈": "파마산 치즈", "레지아노 치즈": "파마산 치즈",
    // 파프리카
    "빨간 파프리카": "파프리카", "노란 파프리카": "파프리카",
    "미니 파프리카": "파프리카", "초록 파프리카": "파프리카", "레드파프리카": "파프리카",
    // 방울토마토
    "방울 토마토": "방울토마토", "컬러방울토마토": "방울토마토",
    "달짝이 토마토": "방울토마토", "달짝이토마토": "방울토마토", "무지개 방울토마토": "방울토마토",
    // 선드라이토마토
    "선드라이 토마토": "선드라이토마토", "썬드라이 토마토": "선드라이토마토", "썬드라이토마토": "선드라이토마토",
    // 토마토홀
    "캔 토마토": "토마토홀", "토마토캔": "토마토홀", "홀 토마토 캔": "토마토홀", "무띠 토마토홀": "토마토홀",
    // 토마토퓨레
    "토마토 퓨레": "토마토퓨레", "무띠 토마토퓨레": "토마토퓨레",
    "토마토 페이스트": "토마토퓨레", "토마토페이스트": "토마토퓨레",
    // 토마토소스
    "토마토 소스": "토마토소스", "로제 토마토 소스": "토마토소스",
    // 파슬리
    "이탈리안 파슬리": "파슬리", "다진 파슬리": "파슬리", "파슬리잎": "파슬리",
    // 식초
    "사과식초": "사과 식초", "두배 사과식초": "사과 식초", "쉐리식초": "식초",
    "발사믹식초": "발사믹 식초",
    "발사믹 비네거": "발사믹 식초", "발사믹 비니거": "발사믹 식초",
    "레드 와인 비네거": "레드 와인 식초", "레드와인 비네거": "레드와인 식초",
    "와인식초": "와인 식초",
    // 화이트 발사믹
    "화이트 발사믹 식초": "화이트 발사믹", "화이트 발사믹식초": "화이트 발사믹",
    "화이트발사믹식초": "화이트 발사믹", "화이트발사믹": "화이트 발사믹",
    "화이트 발사믹 글레이즈": "화이트 발사믹", "화이트와인 비니거": "화이트 발사믹",
    "화이트 와인 비네거": "화이트 발사믹", "화이트 와인 비니거": "화이트 발사믹",
    "화이트와인 비네거": "화이트 발사믹", "화이트 와인식초": "화이트 발사믹",
    // 버섯류
    "양송이버섯": "양송이 버섯", "양송이": "양송이 버섯",
    "새송이버섯": "새송이 버섯", "느타리버섯": "느타리 버섯",
    "팽이버섯": "팽이 버섯", "포르치니버섯": "포르치니 버섯",
    "표고버섯": "표고 버섯", "잎새버섯": "잎새 버섯",
    // 랍스터
    "랍스터 테일": "랍스터", "랍스타": "랍스터",
    // 채소 오타/표기
    "살롯": "샬롯",
    "래디시": "래디쉬", "레디시": "래디쉬",
    "사프론": "사프란", "샤프론": "사프란",
    "탈리아탈레": "탈리아텔레", "딸리아딸레": "탈리아텔레",
    "만가닥버섯": "만가닥 버섯",
    "옥수수콘": "옥수수 콘",
    "그린빈": "그린 빈",
    "궁채장아찌": "궁채 장아찌",
    // 무
    "무우": "무",
    // 라임
    "라임 주스": "라임", "라임주스": "라임", "라임제스트": "라임",
    "라임 제스트": "라임", "라임즙": "라임", "라임/레몬 제스트": "라임",
    // 레몬
    "레몬즙": "레몬", "레몬주스": "레몬", "레몬제스트": "레몬",
    "레몬 제스트": "레몬", "레몬껍질": "레몬",
    // 마늘
    "마늘분말": "마늘", "흑마늘": "마늘", "다진마늘": "마늘",
    "통마늘": "마늘", "생마늘": "마늘",
    // 연어
    "노르웨이 생연어": "연어", "껍질 있는 연어": "연어", "껍질 없는 연어": "연어",
    "훈제연어": "연어", "연어 스테이크": "연어", "동원 썸씽스페셜 훈제연어": "연어",
    // 바질
    "바질잎": "바질",
    // 소금
    "맛소금": "소금", "구운 소금": "소금", "죽염": "소금", "샐러리 소금": "소금",
    // 간장
    "맛간장": "간장", "양조간장": "간장", "진간장": "간장",
    "국간장": "간장", "백간장": "간장", "어간장": "간장", "청장(맑은 간장)": "간장",
    // 밥
    "백미": "밥", "즉석밥": "밥", "통곡물밥": "밥", "쌀밥": "밥",
    // 쌀
    "생쌀": "쌀", "불린 쌀": "쌀", "이탈리아 쌀": "쌀", "한국 쌀": "쌀",
    // 메밀가루
    "통메밀가루": "메밀가루",
    // 치즈류
    "부라타치즈": "부라타 치즈", "블루치즈": "블루 치즈", "페타치즈": "페타 치즈",
    "에멘탈치즈": "에멘탈 치즈", "그뤼에르치즈": "그뤼에르 치즈",
    "리코타치즈": "리코타 치즈", "마스카포네치즈": "마스카포네 치즈",
    "마카포네 치즈": "마스카포네 치즈", "마스카포네 크림": "마스카포네 치즈",
    "모짜렐라 슈레드치즈": "모짜렐라 치즈", "프레시 모짜렐라 치즈": "모짜렐라 치즈",
    "슈레드 모짜렐라": "모짜렐라 치즈",
    "폰탈치즈": "폰탈 치즈", "벨큐브치즈": "벨큐브 치즈",
    "파다노": "그라나 파다노 치즈", "그라노파다노": "그라나 파다노 치즈",
    // 코인육수
    "꽃게 코인육수": "코인 육수", "디포리 코인육수": "코인 육수",
    "사골 코인육수": "코인 육수", "채소 코인육수": "코인 육수",
    "채소육수코인": "코인 육수", "사골코인육수": "코인 육수",
    "코인육수사골": "코인 육수", "코인육수": "코인 육수",
    // 당근
    "베이비당근": "당근",
    // 생강
    "생강가루": "생강", "다진 생강": "생강",
    // 알룰로스
    "알루로스": "알룰로스",
    // 마요네즈
    "비건 마요네즈": "마요네즈",
    // 치킨스톡
    "액상 치킨스톡": "치킨스톡", "치킨스톡파우더": "치킨스톡",
    "치킨 육수": "치킨스톡", "치킨육수": "치킨스톡",
    "닭 육수": "치킨스톡", "닭육수": "치킨스톡",
    // 깨
    "깨소금": "깨", "볶은깨": "깨", "볶음깨": "깨",
    "검은깨": "깨", "검정깨": "깨", "참깨": "깨",
    // 아보카도
    "아보카도 퓨레": "아보카도", "아보카도퓨레": "아보카도",
    // 빵
    "통식빵": "식빵", "버거번": "빵",
    // 기타
    "청포도": "포도", "민트잎": "민트", "명란젓": "명란", "갈아만든배": "배",
    "와사비잎": "와사비", "와사비플라워": "와사비", "전복내장": "전복",
    "애플망고": "애플 망고", "물만두": "만두", "왕새우 만두": "만두", "냉동만두": "만두",
    // 후추
    "통후추": "후추", "후추 가루": "후추", "후추가루": "후추",
    "후춧가루": "후추", "흰 후추": "후추", "흰후추": "후추",
    // 트러플
    "트러플 스프레이": "트러플", "트러플 페이스트": "트러플",
    "트러플오일": "트러플", "트러플 오일": "트러플", "화이트 트러플 오일": "트러플",
    // 후리카케
    "후리가게": "후리카케", "후리카게": "후리카케", "후리가케": "후리카케",
    // 와인
    "화이트와인": "화이트 와인", "레드와인": "레드 와인",
    // 페페론치노
    "페퍼론치노": "페페론치노", "페퍼로치니": "페페론치노", "페퍼크러쉬": "페페론치노",
    "페페론치니": "페페론치노", "크러쉬페퍼": "페페론치노",
    "크러쉬드 페퍼": "페페론치노", "페퍼로치노": "페페론치노",
    // 파스타 (종류별 → 파스타 통합)
    "스파게티면": "파스타", "건파스타": "파스타", "생면 파스타": "파스타",
    "숏파스타": "파스타", "파스타 면": "파스타", "파스타 반죽": "파스타",
    "스파게티": "파스타", "스파게티니": "파스타", "리가토니": "파스타",
    "링귀니": "파스타", "탈리아텔레": "파스타", "마팔디네": "파스타",
    "오레끼에떼": "파스타", "펜네 파스타": "파스타",
    // 굴소스
    "우스터소스": "굴소스",
    // 식용유
    "포도씨유": "식용유", "아보카도 오일": "식용유", "아보카도오일": "식용유",
    // 바질 페스토
    "바질페스토": "바질 페스토",
    // 삼겹살
    "K-바비큐 삼겹살": "삼겹살", "국내산 삼겹살": "삼겹살", "미국산 삼겹살": "삼겹살",
    "스페인산 (이베리코) 삼겹살": "삼겹살", "캐나다산 삼겹살": "삼겹살",
    "독일 삼겹살": "삼겹살", "칠레 삼겹살": "삼겹살",
    // 목살
    "목살 스테이크": "목살", "3일 돼지 목살": "목살", "돼지목살": "목살", "돼지 목살": "목살",
    // 돼지고기
    "간 돼지고기": "돼지고기", "돼지고기 등심": "돼지 등심",
    // 닭
    "닭 가슴살": "닭가슴살", "껍질 없는 닭 가슴살": "닭가슴살", "생닭": "닭고기",
    // 케첩
    "토마토 케찹": "케첩", "토마토케찹": "케첩", "토마토 케첩": "케첩",
    // 전분
    "전분 가루": "전분", "옥수수 전분 가루": "전분", "옥수수전분": "전분",
    // 돼지 다짐육
    "돼지고기 다짐육": "돼지 다짐육",
    // 소고기
    "호주산 안심": "안심", "안심 스테이크": "안심", "소고기 안심": "안심",
    "채끝 스테이크": "채끝살", "채끝": "채끝살",
    "등심 스테이크": "소고기 등심", "꽃등심": "소고기 등심",
    "간 소고기": "소고기 다짐육", "다진소고기": "소고기 다짐육", "다진 소고기": "소고기 다짐육",
    "다짐육": "소고기 다짐육", "얇은 소고기": "소고기",
    "한우 우둔": "우둔살",
    // 감자
    "삶은 감자": "감자", "두백감자": "감자", "마리스 파이퍼 감자": "감자",
    // 새우
    "생새우": "새우", "냉동 새우 (적새우살)": "새우", "냉동 새우": "새우",
    // 밀가루
    "일반 밀가루": "밀가루", "프랑스 밀가루 T45": "밀가루",
    // 생크림
    "서울우유 생크림": "생크림", "매일우유 휘핑크림": "생크림",
    // 설탕
    "백설탕": "설탕", "고운 설탕": "설탕", "브라운 설탕": "설탕",
    // 고추
    "청고추": "고추", "홍고추": "고추", "아삭이고추": "고추",
    // 토마토주스
    "토마토 주스": "토마토주스",
    // 셀러리 표기 통일
    "셀러리": "샐러리",
    // 앤초비 표기 통일
    "앤초비": "엔초비",
    // 사프란 표기 통일
    "샤프란": "사프란",
    // 치즈 표기 통일
    "모짜렐라": "모짜렐라 치즈",
    "마스카포네": "마스카포네 치즈", "마스카르포네 치즈": "마스카포네 치즈",
    "리코타": "리코타 치즈",
    // 토마토홀 통일
    "홀 토마토": "토마토홀",
    // 발사믹 통일
    "발사믹": "발사믹 식초",
    // 월계수잎 통일
    "월계수 잎": "월계수잎",
    // 화이트 와인 식초 통일
    "화이트 와인 식초": "화이트 발사믹",
    // 치킨스톡 통일
    "치킨 스톡": "치킨스톡",
    // 올리브유 표기 누락 보완
    "엑스트라 버진 올리브유": "올리브 오일",
    // 돼지 다짐육
    "다진 돼지고기": "돼지 다짐육",
    // 시나몬 → 계피
    "시나몬": "계피",
  };

  // ── 상위어 맵: "돼지고기" 검색 시 삼겹살/목살 등 포함 레시피도 매칭 ──
  // 하지만 삼겹살/목살은 여전히 개별 검색 가능
  // ── 패턴 기반 자동 정규화: 산지 접두사 / 용량 제거 ──
  const autoNormalize = (ing) => {
    let s = ing.trim();
    // 산지 접두사 제거: "국내산 삼겹살" → "삼겹살"
    s = s.replace(/^(국내산|미국산|호주산|캐나다산|스페인산|독일산|칠레산|노르웨이산|프랑스산|이탈리아산|뉴질랜드산|중국산)\s+/, "");
    // 끝부분 용량/수량 제거: "돼지 앞다리살 500g" → "돼지 앞다리살"
    s = s.replace(/\s*\d+([./]\d+)?\s*(g|ml|kg|L|l|개|장|큰술|작은술|컵|스푼|tsp|tbsp|T)\s*$/, "");
    return s.trim();
  };

  // autoNormalize → synonymMap 순서로 정규화 (EN 모드는 소문자 + 복수형 통일)
  // useCallback으로 안정화 — language 변경 시에만 재생성
  const normalizeIng = React.useCallback((ing) => {
    if (language === "en") {
      const lower = ing.trim().toLowerCase();
      const depluraled = EN_PLURAL_MAP[lower] || lower;
      return EN_SYNONYM_MAP[depluraled] || EN_SYNONYM_MAP[lower] || depluraled;
    }
    const auto = autoNormalize(ing);
    return synonymMap[auto] || synonymMap[ing] || auto;
  }, [language]); // eslint-disable-line react-hooks/exhaustive-deps

  // 드롭다운에서 제외할 기본 재료 (너무 흔해서 검색 의미 없음)
  const EXCLUDED_INGREDIENTS = new Set([
    "소금", "후추", "물", "설탕", "밀가루", "기름", "면수",
    "육수", "야채 육수", "채소 육수", "조개 육수", "해물 육수",
    "salt", "pepper", "water", "sugar", "flour", "oil", "pasta water",
    "cooking oil", "kitchen twine",
  ]);


  // 노이즈 재료 필터 (조리 설명 문장 등)
  const isNoisyIngredient = (ing) => {
    if (!ing || ing.length > 25) return true;
    if (/[.。]/.test(ing)) return true;
    if (/준비한다|구워준다|넣는다|볶는다|끓인다|만든다|섞는다|썬다|담는다|자른다|버린다|걸러서|우린다|벗겨|제거한다/.test(ing)) return true;
    const key = language === "en" ? ing.trim().toLowerCase() : ing.trim();
    if (EXCLUDED_INGREDIENTS.has(key)) return true;
    return false;
  };

  // 검색 필터: 상위어 선택 시 하위 재료도 매칭, 개별 재료는 정확 매칭
  const filterMenusByIngredients = (selectedOptions) => {
    return sortedData.filter(menu => {
      const ingredients = menu.ingredients || [];
      const normalizedMenuIngredients = ingredients.map(ing => normalizeIng(ing));

      return selectedOptions.every(opt => {
        const val = typeof opt === "string" ? opt : opt.value;
        const normalizedVal = normalizeIng(val);

        if (parentMap[normalizedVal]) {
          // 상위어: 카테고리 자체 OR 하위 재료 중 하나라도 있으면 매칭
          const allVariants = [normalizedVal, ...parentMap[normalizedVal].map(c => normalizeIng(c))];
          return normalizedMenuIngredients.some(mi => allVariants.includes(mi));
        }

        // 일반 재료: 정규화 후 정확 매칭
        return normalizedMenuIngredients.includes(normalizedVal);
      });
    });
  };

  const handleSearch = (selected) => {
    setSelectedIngredients(selected);
    setSearchActive(selected.length > 0);
    if (selected.length > 0 && window.gtag) {
      window.gtag('event', 'search', {
        search_term: selected.map(s => s.value).join(', ')
      });
    }
    if (selected.length === 0) {
      setSearchResults(sortedData);
      return;
    }
    const menuNameSelections = selected.filter(s => s.group === "menu");
    const ingredientSelections = selected.filter(s => s.group === "ingredient");
    const textSelections = selected.filter(s => s.group === "text");

    let filtered = sortedData;
    if (menuNameSelections.length > 0) {
      filtered = filtered.filter(item =>
        menuNameSelections.every(s =>
          (item.name || "").toLowerCase().includes(s.value.toLowerCase())
        )
      );
    }
    if (ingredientSelections.length > 0) {
      filtered = filterMenusByIngredients(ingredientSelections).filter(item =>
        filtered.includes(item)
      );
    }
    if (textSelections.length > 0) {
      filtered = filtered.filter(item =>
        textSelections.every(s => {
          const q = s.value.toLowerCase();
          return (
            (item.name || "").toLowerCase().includes(q) ||
            (item.ingredients || []).some(ing => normalizeIng(ing).toLowerCase().includes(q))
          );
        })
      );
    }
    setSearchResults(filtered);
  };

  const ingredientOptions = useMemo(() => {
    const allIngredientsRaw = sortedData
      .flatMap((item) => item.ingredients || [])
      .filter((ing) => typeof ing === "string" && ing !== "Only 제품 설명 OR 홍보");
    const ingredientFreq = {};
    for (const ing of allIngredientsRaw) {
      if (isNoisyIngredient(ing)) continue;
      const normalized = normalizeIng(ing);
      if (isNoisyIngredient(normalized)) continue;
      ingredientFreq[normalized] = (ingredientFreq[normalized] || 0) + 1;
    }
    const normalizedIngredientsSet = new Set();
    const options = [];
    const editedIngredientSet = new Set();
    Object.values(recipeEdits).forEach(edit => {
      [...(edit.mainIngredients || []), ...(edit.seasonings || [])].forEach(ing => {
        if (typeof ing === 'string' && ing.trim()) editedIngredientSet.add(normalizeIng(ing.trim()));
      });
    });
    for (const [normalized, count] of Object.entries(ingredientFreq)) {
      if (count <= 2) continue;
      if (!normalizedIngredientsSet.has(normalized)) {
        normalizedIngredientsSet.add(normalized);
        options.push({ value: normalized, label: normalized });
      }
    }
    editedIngredientSet.forEach(normalized => {
      if (normalized && !normalizedIngredientsSet.has(normalized)) {
        normalizedIngredientsSet.add(normalized);
        options.push({ value: normalized, label: normalized });
      }
    });
    if (language === "kr") {
      for (const parent of Object.keys(parentMap)) {
        if (!normalizedIngredientsSet.has(parent)) {
          normalizedIngredientsSet.add(parent);
          options.push({ value: parent, label: parent });
        }
      }
    }
    options.sort((a, b) => a.label.localeCompare(b.label, "ko"));
    return options;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sortedData, recipeEdits, language]);

  // 메뉴명 옵션 (그룹 분리)
  const menuNameOptions = validRecipes
    .filter(r => r.name && r.name.trim())
    .map(r => ({ value: r.name, label: r.name, group: "menu" }))
    .filter((opt, idx, arr) => arr.findIndex(o => o.value === opt.value) === idx)
    .sort((a, b) => a.label.localeCompare(b.label, "ko"));

  const groupedSearchOptions = [
    {
      label: language === "kr" ? "재료" : "Ingredients",
      options: ingredientOptions.map(o => ({ ...o, group: "ingredient" })),
    },
    {
      label: language === "kr" ? "메뉴" : "Dishes",
      options: menuNameOptions,
    },
  ];

  // 선택된 태그(재료/텍스트)가 있으면, 해당 레시피에서만 드롭다운 옵션 추출
  const availableGroupedOptions = useMemo(() => {
    if (selectedIngredients.length === 0) return groupedSearchOptions;
    const ingSelections = selectedIngredients.filter(s => s.group === "ingredient");
    const textSelections = selectedIngredients.filter(s => s.group === "text");
    if (ingSelections.length === 0 && textSelections.length === 0) return groupedSearchOptions;

    // 재료 태그로 먼저 필터
    let matchingRecipes = ingSelections.length > 0
      ? filterMenusByIngredients(ingSelections)
      : sortedData.filter(isValidRecipe);

    // 텍스트 태그로 추가 필터
    if (textSelections.length > 0) {
      matchingRecipes = matchingRecipes.filter(item =>
        textSelections.every(s => {
          const q = s.value.toLowerCase();
          return (
            (item.name || "").toLowerCase().includes(q) ||
            (item.ingredients || []).some(ing => normalizeIng(ing).toLowerCase().includes(q))
          );
        })
      );
    }

    const available = new Set();
    for (const recipe of matchingRecipes) {
      for (const ing of recipe.ingredients || []) {
        if (isNoisyIngredient(ing)) continue;
        const normalized = normalizeIng(ing);
        if (!isNoisyIngredient(normalized)) available.add(normalized);
      }
    }
    for (const parent of Object.keys(parentMap)) {
      if (parentMap[parent].some(child => available.has(normalizeIng(child)))) {
        available.add(parent);
      }
    }
    const matchingMenuNames = new Set(matchingRecipes.map(r => r.name));
    return [
      {
        label: groupedSearchOptions[0].label,
        options: groupedSearchOptions[0].options.filter(opt => available.has(opt.value)),
      },
      {
        label: groupedSearchOptions[1].label,
        options: groupedSearchOptions[1].options.filter(opt => matchingMenuNames.has(opt.value)),
      },
    ];
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedIngredients, recipeEdits]);

const [allMenuSort, setAllMenuSort] = useState("date"); // "name" | "date"
  const [selectedChef, setSelectedChef] = useState("all");

  const creatorRecipeCounts = useMemo(() => {
    const counts = {};
    validRecipes.forEach(r => {
      if (r.uploader) counts[r.uploader] = (counts[r.uploader] || 0) + 1;
    });
    return counts;
  }, [validRecipes]);

  const creatorList = Object.keys(channelProfiles).filter(name => creatorRecipeCounts[name] > 0);

  const chefOptions = Array.from(
    new Set(validRecipes.map((r) => r.uploader).filter(Boolean))
  ).sort((a, b) => a.localeCompare(b, "ko"));

  // 검색 입력 디바운스 (150ms) — 모바일 성능 개선
  const [debouncedInput, setDebouncedInput] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setDebouncedInput(searchInputValue), 150);
    return () => clearTimeout(t);
  }, [searchInputValue]);

  // 태그 미선택 + 타이핑 중일 때 라이브 필터링
  const liveFilteredData = useMemo(() => {
    if (searchActive || !debouncedInput.trim()) return null;
    const q = debouncedInput.trim().toLowerCase();
    return sortedData.filter(item =>
      isValidRecipe(item) && (
        (item.name || "").toLowerCase().includes(q) ||
        (item.ingredients || []).some(ing => normalizeIng(ing).toLowerCase().includes(q))
      )
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedInput, searchActive, sortedData]);

  const filteredResults = useMemo(() =>
    (liveFilteredData || searchResults.filter(isValidRecipe))
      .filter(r => !(recipeEdits[r.url]?.hidden) || isCreator)
      .filter(r => selectedChef === "all" ? true : r.uploader === selectedChef)
      .filter(r => !deletedKeys.has(r.url)),
    [liveFilteredData, searchResults, recipeEdits, isCreator, selectedChef, deletedKeys]
  );

  const sortedResults = useMemo(() =>
    [...filteredResults].sort((a, b) =>
      allMenuSort === "name"
        ? (a.name || "").localeCompare(b.name || "", "ko")
        : new Date(b.upload_date) - new Date(a.upload_date)
    ),
    [filteredResults, allMenuSort]
  );

  const selectedIngredientValues = useMemo(() =>
    new Set(selectedIngredients.map(s => normalizeIng(s.value).toLowerCase())),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selectedIngredients]
  );

  const savedSet = useMemo(() => new Set(savedRecipes), [savedRecipes]);

  const duplicateUrls = useMemo(() => {
    const counts = {};
    validRecipes.forEach(item => {
      const url = (item.url || "").trim();
      if (url) counts[url] = (counts[url] || 0) + 1;
    });
    return new Set(Object.keys(counts).filter(u => counts[u] > 1));
  }, [validRecipes]);

  const handleDeleteRecipe = (e, url, name) => {
    e.stopPropagation();
    setConfirmDialog({
      message: `'${name}' 레시피를 삭제하시겠습니까?`,
      onConfirm: async () => {
        setConfirmDialog(null);
        try {
          const res = await fetch(`${API_BASE}/delete-recipe`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ video_url: url, name }),
          });
          const data = await res.json();
          if (data.ok && data.deleted) {
            setDeletedKeys(prev => {
              const next = new Set([...prev, url]);
              try { sessionStorage.setItem('findish_deleted_urls', JSON.stringify([...next])); } catch {}
              return next;
            });
            setSearchResults(prev => prev.filter(r => r.url !== url));
            if (recipeModal?.url === url && recipeModal?.name === name) setRecipeModal(null);
          }
        } catch {}
      },
    });
  };

  const makeCardProps = (item) => {
    const ytId = extractYouTubeId(item.url);
    return {
      item,
      thumbnailSrc: thumbnailOverrides[item.url] || (ytId ? `https://img.youtube.com/vi/${ytId}/hqdefault.jpg` : null),
      isHidden: !!recipeEdits[item.url]?.hidden,
      isSaved: savedSet.has(item.url),
      isMyRecipe: !!(creatorUser && creatorUser.uploaderName === item.uploader),
      isCreator,
      selectedIngredientValues,
      selectedIngredients,
      language,
      normalizeIng,
      onOpen: () => { setRecipeModal(item); setModalVideoPlaying(false); setModalEditMode(false); },
      onToggleSave: (e) => { e.stopPropagation(); toggleSave(item.url); },
      isDuplicate: duplicateUrls.has((item.url || "").trim()),
      onToggleHidden: (e) => toggleHidden(e, item.url),
      onEdit: (e) => { e.stopPropagation(); setRecipeModal(item); setModalVideoPlaying(false); openEditMode(item); },
      onDelete: (e) => handleDeleteRecipe(e, item.url, item.name),
    };
  };

  const recipeCount = validRecipes.length;

  return (
    <div className={darkMode ? "app dark" : "app light"}>
      <header className="header">
        <div className="header-left">
          <button
            className="header-logo"
            onClick={() => {
              if (slug) {
                navigate('/');
              } else {
                setActiveTab('home');
                setSelectedIngredients([]);
                setSearchActive(false);
                setSearchInputValue('');
                setSearchResults(sortedData);
              }
            }}
          >
            Findish
          </button>
        </div>
        <div className="header-right">
          {!chefProfile && <a href="#about" className="header-link header-link-desktop">About</a>}
          {chefProfile ? (
            <>
              <a href={chefProfile.youtubeUrl} target="_blank" rel="noopener noreferrer" className="header-icon-btn" title={`${chefProfile.displayName} 유튜브`}>
                <YouTubeHeaderIcon size={24} />
              </a>
              {chefProfile.instagramUrl && (
                <a href={chefProfile.instagramUrl} target="_blank" rel="noopener noreferrer" className="header-icon-btn" title={`${chefProfile.displayName} 인스타그램`}>
                  <InstagramGradientIcon size={24} />
                </a>
              )}
            </>
          ) : (
            <>
              <a href="mailto:ndk68790@gmail.com" style={{ fontSize: "1.1rem", lineHeight: 1 }}>✉️</a>
              <a href="https://www.instagram.com/andy__yeyo/" target="_blank" rel="noopener noreferrer" style={{ display: "flex", alignItems: "center" }}>
                <InstagramGradientIcon size={18} />
              </a>
            </>
          )}
          {!chefProfile && (
            <button onClick={() => setLanguage(language === "kr" ? "en" : "kr")} className="dark-toggle">
              {language === "kr" ? "EN" : "KR"}
            </button>
          )}
          <button onClick={toggleDarkMode} className="dark-toggle">
            {darkMode ? "Light" : "Dark"}
          </button>
          {window.location.hostname !== 'menu-search.vercel.app' && (
            <button onClick={() => setAnalyzeOpen(true)} className="dark-toggle">
              Analyze
            </button>
          )}
          {(socialUser || creatorUser) && (
            <button
              className="header-bookmark-btn"
              onClick={() => setActiveTab(t => t === 'saved' ? 'home' : 'saved')}
              title="저장한 레시피"
            >
              <FaBookmark size={14} />
              {savedRecipes.length > 0 && (
                <span className="header-bookmark-badge">{savedRecipes.length}</span>
              )}
            </button>
          )}
          {socialUser ? (
            <>
              {socialUser.photoURL && (
                <img src={socialUser.photoURL} alt="" className="header-profile-img" referrerPolicy="no-referrer" />
              )}
              <span className="header-creator-name">{socialUser.name}</span>
              <button onClick={handleSocialLogout} className="header-link">로그아웃</button>
            </>
          ) : creatorUser ? (
            <>
              <span className="header-creator-name">{creatorUser.username}</span>
              <button onClick={handleLogout} className="header-link">로그아웃</button>
            </>
          ) : socialLoading ? (
            <span className="social-auth-spinner" />
          ) : (
            <button onClick={() => setLoginModalOpen(true)} className="header-link header-login-btn">로그인</button>
          )}
        </div>
      </header>

      {/* Analyze Modal */}
      <Modal open={analyzeOpen} onClose={() => setAnalyzeOpen(false)} darkMode={darkMode}>
        <AnalyzePanel apiBase={API_BASE} darkMode={darkMode} />
      </Modal>

      {/* Login Modal */}
      <LoginModal
        open={loginModalOpen}
        onClose={() => setLoginModalOpen(false)}
        onLoginSuccess={handleLoginSuccess}
        onGoogleLogin={handleGoogleLogin}
        onKakaoLogin={handleKakaoLogin}
        darkMode={darkMode}
      />

      {/* Toast */}
      {toast && (
        <div key={toast.key} className={`toast-notification${darkMode ? ' dark' : ''}`}>
          {toast.message}
        </div>
      )}

      {/* Recipe Detail Modal */}
      <Modal open={!!recipeModal} onClose={() => {
        if (modalEditMode) {
          if (!window.confirm('편집 중인 내용이 있습니다. 나가시겠습니까?')) return;
          if (recipeModal?.url) localStorage.removeItem(`findish_draft_${recipeModal.url}`);
        }
        setRecipeModal(null); setModalVideoPlaying(false); setModalEditMode(false);
      }} darkMode={darkMode} hideClose>
        {recipeModal && (
          <div className="recipe-modal">
            <div className="recipe-modal-header">
              <h2 className="recipe-modal-title">{recipeModal.name}</h2>
              {creatorUser && !modalEditMode && (
                <>
                  {creatorUser.uploaderName === recipeModal.uploader && (
                    <>
                      <button
                        className={`recipe-edit-toggle-btn${recipeEdits[recipeModal.url]?.hidden ? ' btn-hidden-state' : ''}`}
                        onClick={(e) => toggleHidden(e, recipeModal.url)}
                      >
                        {recipeEdits[recipeModal.url]?.hidden ? '비공개' : '공개'}
                      </button>
                      <button className="recipe-edit-toggle-btn" onClick={() => openEditMode(recipeModal)}>
                        편집
                      </button>
                    </>
                  )}
                </>
              )}
              {!modalEditMode && currentUid && (
                <button
                  className={`recipe-modal-bookmark-btn${savedSet.has(recipeModal.url) ? ' saved' : ''}`}
                  onClick={() => toggleSave(recipeModal.url)}
                  title={savedSet.has(recipeModal.url) ? '저장 취소' : '저장하기'}
                >
                  {savedSet.has(recipeModal.url) ? <FaBookmark size={14} /> : <FaRegBookmark size={14} />}
                  {savedSet.has(recipeModal.url) ? '저장됨' : '저장하기'}
                </button>
              )}
              <button className="recipe-modal-close-btn" onClick={() => {
                if (modalEditMode) {
                  if (!window.confirm('편집 중인 내용이 있습니다. 나가시겠습니까?')) return;
                  if (recipeModal?.url) localStorage.removeItem(`findish_draft_${recipeModal.url}`);
                }
                setRecipeModal(null); setModalVideoPlaying(false); setModalEditMode(false);
              }}>
                &times;
              </button>
            </div>
            <div className="recipe-modal-meta">
              <img
                src={channelProfiles[recipeModal.uploader] || ""}
                alt={recipeModal.uploader}
                className="recipe-modal-avatar"
                onError={(e) => { e.target.style.display = "none"; }}
              />
              <div className="recipe-modal-meta-text">
                {recipeModal.uploader && (
                  <span className="recipe-modal-uploader">{recipeModal.uploader}</span>
                )}
                {recipeModal.upload_date && (
                  <span className="recipe-modal-date">{recipeModal.upload_date}</span>
                )}
              </div>
            </div>
            {extractYouTubeId(recipeModal.url) && (() => {
              const ytId = extractYouTubeId(recipeModal.url);
              return (
                <div style={{ margin: "0 0 16px" }}>
                  {modalVideoPlaying ? (
                    <div className="recipe-modal-thumb-link playing">
                      <iframe
                        className="recipe-modal-iframe"
                        src={`https://www.youtube.com/embed/${ytId}?autoplay=1&rel=0`}
                        allow="autoplay; encrypted-media"
                        allowFullScreen
                        loading="lazy"
                        title={recipeModal.name}
                      />
                    </div>
                  ) : (
                    <div
                      className="recipe-modal-thumb-link recipe-modal-thumb-play"
                      onClick={() => setModalVideoPlaying(true)}
                    >
                      <img
                        src={`https://img.youtube.com/vi/${ytId}/hqdefault.jpg`}
                        alt={recipeModal.name}
                        className="recipe-modal-iframe"
                        style={{ objectFit: "cover" }}
                      />
                      <div className="recipe-modal-play-overlay">▶</div>
                    </div>
                  )}
                </div>
              );
            })()}
            {(() => {
              const savedEdit = recipeEdits[recipeModal.url] || {};
              const displaySteps = savedEdit.steps || recipeModal.steps || [];
              const displayTip = savedEdit.tip || '';

              const all = [...new Set((recipeModal.ingredients || []).map(ing => normalizeIng(ing)))];
              const mainList = savedEdit.mainIngredients || all.filter(ing => !SEASONINGS.has(ing));
              const seasoningList = savedEdit.seasonings || all.filter(ing => SEASONINGS.has(ing));
              const sortedMain = [
                ...mainList.filter(ing => selectedIngredientValues.has(ing.toLowerCase())),
                ...mainList.filter(ing => !selectedIngredientValues.has(ing.toLowerCase())),
              ];

              return (
                <>
                  {modalEditMode ? (
                    <RecipeEditPanel
                      key={recipeModal.url}
                      initialDraft={editDraftInit}
                      darkMode={darkMode}
                      t={t}
                      thumbnailUrl={thumbnailOverrides[recipeModal.url] || ''}
                      uploaderName={recipeModal.uploader}
                      onSave={draft => saveEditDraft(recipeModal.url, draft)}
                      onCancel={() => setModalEditMode(false)}
                      onSaveThumbnail={url => saveThumbnailOverride(recipeModal.url, url)}
                      onClearThumbnail={() => clearThumbnailOverride(recipeModal.url)}
                    />
                  ) : (
                    <>
                      {/* TIP 섹션 — 셰프 직접 입력, 맨 위 */}
                      <div className="recipe-tip-section">
                        <div className="recipe-tip-label-wrap">
                          <span className="recipe-tip-label">
                            {recipeModal.uploader ? `${recipeModal.uploader}'s TIP` : t.tip}
                          </span>
                          {recipeModal.uploader && (
                            <span
                              className="recipe-tip-info"
                              data-tooltip={language === 'kr' ? `${recipeModal.uploader}가 직접 작성한 팁이에요!` : `Written directly by ${recipeModal.uploader}!`}
                            >?</span>
                          )}
                        </div>
                        <p className="recipe-tip-text" style={!displayTip ? { opacity: 0.4 } : {}}>
                          {displayTip
                            ? displayTip.split('\n').map((line, i) => (
                                <span key={i} className="recipe-tip-line">"{line}"</span>
                              ))
                            : (language === 'kr' ? '곧 올라올 예정이에요!' : 'Coming soon!')}
                        </p>
                      </div>

                      {/* RECIPE 섹션 — 테이블 리스트 */}
                      {(sortedMain.length > 0 || seasoningList.length > 0) && (
                        <div className="recipe-modal-section">
                          <h3 className="recipe-modal-section-title">
                            RECIPE{savedEdit.servings ? ` (${savedEdit.servings})` : ''}
                          </h3>
                          <div className={`recipe-ing-pills${darkMode ? ' dark' : ''}`}>
                            {[...sortedMain, ...seasoningList].map((ing, i) => {
                              const { name, amount } = parseIngText(ing);
                              const isHighlighted = selectedIngredientValues.has(ing.toLowerCase()) || selectedIngredientValues.has(name.toLowerCase());
                              const isSeasoning = i >= sortedMain.length;
                              return (
                                <span key={i} className={`recipe-ing-pill${isHighlighted ? ' highlighted' : ''}${isSeasoning ? ' seasoning' : ''}`}>
                                  {name}
                                  {amount && <span className="recipe-ing-pill-amount">{amount}</span>}
                                </span>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Instruction 섹션 */}
                      <div className="recipe-modal-steps">
                        <h3 className="recipe-modal-section-title">INSTRUCTION</h3>
                        {displaySteps.length > 0 ? (
                          <ol>
                            {displaySteps.map((step, i) => (
                              <li key={i}>{step.replace(/^\d+[.)]\s*/, '')}</li>
                            ))}
                          </ol>
                        ) : (
                          <p className="recipe-modal-no-steps">{t.noSteps}</p>
                        )}
                      </div>
                    </>
                  )}
                </>
              );
            })()}
          </div>
        )}
      </Modal>

      {activeTab === "chef" ? (
        <ChefAI darkMode={darkMode} />
      ) : activeTab === "saved" ? (
        <div className="saved-tab-container">
          <h2 className="saved-tab-title">
            {language === "kr" ? "저장한 레시피" : "Saved Recipes"}
          </h2>
          {!currentUid ? (
            <div className="saved-tab-empty">
              <FaRegBookmark size={32} style={{ marginBottom: 12, opacity: 0.3 }} />
              <p>{language === "kr" ? "로그인하면 저장한 레시피를 모아볼 수 있어요." : "Log in to see your saved recipes."}</p>
              <button className="login-submit-btn" style={{ marginTop: 16, maxWidth: 180 }} onClick={() => setLoginModalOpen(true)}>
                {language === "kr" ? "로그인하기" : "Log in"}
              </button>
            </div>
          ) : savedRecipes.length === 0 ? (
            <div className="saved-tab-empty">
              <FaRegBookmark size={32} style={{ marginBottom: 12, opacity: 0.3 }} />
              <p>{language === "kr" ? "저장된 레시피가 없습니다." : "No saved recipes yet."}</p>
              <p style={{ fontSize: "0.85rem", opacity: 0.5 }}>
                {language === "kr" ? "레시피 카드의 북마크 버튼을 눌러 저장해보세요." : "Click the bookmark icon on any recipe card to save it."}
              </p>
            </div>
          ) : (
            <ul className="menu-list grid-list">
              {validRecipes
                .filter(item => savedRecipes.includes(item.url) && !deletedKeys.has(item.url))
                .map((item) => (
                  <RecipeCard key={item.url} {...makeCardProps(item)} />
                ))}
            </ul>
          )}
        </div>
      ) : (
        <>
          {/* Hero Section */}
          <section className="hero">
            {chefProfile ? (
              <div className="chef-hero-identity">
                {channelProfiles[CHEF_FILTER] && (
                  <div className="chef-hero-avatar-ring">
                    <img
                      src={channelProfiles[CHEF_FILTER]}
                      alt={chefProfile.displayName}
                      className="chef-hero-avatar"
                    />
                  </div>
                )}
                <p className="chef-hero-name">{chefProfile.displayName}</p>
                <span className="chef-hero-count">{recipeCount}+ 레시피</span>
              </div>
            ) : (
              <div className="hero-badge">{t.heroBadge(recipeCount)}</div>
            )}
            <h1 className="hero-title">
              {(chefProfile
                ? (language === "kr" ? chefProfile.heroTitle : chefProfile.heroTitleEn)
                : t.heroTitle
              ).split("\n").map((line, i) => (
                <span key={i}>{line}{i === 0 && <br />}</span>
              ))}
            </h1>
            <p className="hero-subtitle">
              {chefProfile
                ? (language === "kr" ? chefProfile.heroSubtitle : chefProfile.heroSubtitleEn)
                : t.heroSubtitle}
            </p>
            <div className="hero-search">
              <TagSearch
                onSearch={handleSearch}
                options={availableGroupedOptions}
                language={language}
                darkMode={darkMode}
                value={selectedIngredients}
                onChange={setSelectedIngredients}
                onInputChange={setSearchInputValue}
              />
            </div>

            {/* 인기 재료 태그 */}
            {!searchActive && !searchInputValue.trim() && (
              <div className="hero-popular">
                <span className="hero-popular-label">
                  {language === "kr" ? "인기" : "Popular"}
                </span>
                {popularTags.map((tag) => {
                  const opt = { value: tag, label: tag, group: "ingredient" };
                  const isSelected = selectedIngredients.some(s => s.value === tag);
                  return (
                    <button
                      key={tag}
                      className={`hero-popular-tag${isSelected ? " selected" : ""}`}
                      onClick={() => {
                        if (isSelected) return;
                        const next = [...selectedIngredients, opt];
                        setSelectedIngredients(next);
                        handleSearch(next);
                      }}
                    >
                      {tag}
                    </button>
                  );
                })}
              </div>
            )}

            {/* 검색 결과 수 */}
            {searchActive && (
              <div className="hero-result-msg">
                {language === "kr"
                  ? `${selectedIngredients.map(s => s.label).join(" + ")}(으)로 만들 수 있는 요리 ${sortedResults.length}가지`
                  : `${sortedResults.length} recipe${sortedResults.length !== 1 ? "s" : ""} with ${selectedIngredients.map(s => s.label).join(" + ")}`}
              </div>
            )}
            {!searchActive && debouncedInput.trim() && liveFilteredData && (
              <div className="hero-result-msg">
                {language === "kr"
                  ? `"${debouncedInput}" 관련 요리 ${sortedResults.length}가지`
                  : `${sortedResults.length} recipe${sortedResults.length !== 1 ? "s" : ""} for "${debouncedInput}"`}
              </div>
            )}

          </section>

          {/* About Section - 검색 중에는 숨김 */}
          {!searchActive && !chefProfile && <AboutSection darkMode={darkMode} language={language} t={t} />}

          {/* Creator List */}
          {!searchActive && !chefProfile && creatorList.length > 0 && (
            <section className="section creator-list-section">
              <div className="container">
                <h2 className="section-title">{language === 'kr' ? '크리에이터' : 'Creators'}</h2>
                <div className="creator-grid">
                  {creatorList.map(name => {
                    const config = chefConfig[name];
                    const count = creatorRecipeCounts[name] || 0;
                    return (
                      <div key={name} className={`creator-card${darkMode ? ' dark' : ''}`}>
                        <img
                          src={channelProfiles[name]}
                          alt={config?.displayName || name}
                          className="creator-card-avatar"
                          onError={e => { e.target.style.display = 'none'; }}
                        />
                        <div className="creator-card-name">{config?.displayName || name}</div>
                        <div className="creator-card-count">{count}개 레시피</div>
                        {config?.slug ? (
                          <a href={`/${config.slug}`} className="creator-card-btn">
                            페이지 보기 →
                          </a>
                        ) : (
                          <span className="creator-card-btn creator-card-btn--soon">Coming Soon</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </section>
          )}

          {/* All Menu */}
          <section className="section">
            <div className="container">
              <div className="section-header">
                <div>
                  <h2 className="section-title">{t.allRecipes}</h2>
                  {searchActive && (
                    <p className="search-result-count">
                      {language === "kr"
                        ? `${sortedResults.length}개 레시피 발견`
                        : `${sortedResults.length} recipe${sortedResults.length !== 1 ? "s" : ""} found`}
                    </p>
                  )}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  {!CHEF_FILTER && <select
                    value={selectedChef}
                    onChange={(e) => setSelectedChef(e.target.value)}
                    style={{
                      padding: "6px 10px",
                      borderRadius: 8,
                      border: `1px solid ${darkMode ? "#444" : "#ddd"}`,
                      background: darkMode ? "#222" : "#fff",
                      color: darkMode ? "#eee" : "#222",
                      fontSize: 13,
                      cursor: "pointer",
                      maxWidth: 160,
                    }}
                  >
                    <option value="all">{t.allChefs}</option>
                    {chefOptions.map((chef) => (
                      <option key={chef} value={chef}>{chef}</option>
                    ))}
                  </select>}
                  <div className="sort-toggle">
                    <button
                      className={`sort-btn ${allMenuSort === "name" ? "active" : ""}`}
                      onClick={() => setAllMenuSort("name")}
                    >
                      {t.nameSort}
                    </button>
                    <button
                      className={`sort-btn ${allMenuSort === "date" ? "active" : ""}`}
                      onClick={() => setAllMenuSort("date")}
                    >
                      {t.dateSort}
                    </button>
                  </div>
                </div>
              </div>
              <ul className="menu-list grid-list">
                {sortedResults.length > 0 ? (
                  sortedResults.map((item) => (
                    <RecipeCard key={item.url} {...makeCardProps(item)} />
                  ))
                ) : (
                  <p className="no-results">{t.noResults}</p>
                )}
              </ul>
            </div>
          </section>

          {/* Footer */}
          <footer className={`site-footer${darkMode ? " dark" : ""}`}>
            <div className="site-footer-inner">
              <span className="site-footer-brand">Findish</span>
              <span className="site-footer-copy">© 2026 Findish. All rights reserved.</span>
              <div className="site-footer-links">
                <a href="https://www.instagram.com/andy__yeyo/" target="_blank" rel="noopener noreferrer">📸 andy_yeyo</a>
                <a href="mailto:ndk68790@gmail.com">✉️ ndk68790@gmail.com</a>
                {!chefProfile && <a href="#about">About</a>}
              </div>
            </div>
          </footer>
        </>
      )}

      {confirmDialog && (
        <div
          style={{
            position: "fixed", inset: 0, zIndex: 9999,
            background: "rgba(0,0,0,0.45)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}
          onClick={() => setConfirmDialog(null)}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: darkMode ? "#1e1e1e" : "#fff",
              color: darkMode ? "#f0f0f0" : "#111",
              borderRadius: 16,
              padding: "28px 32px",
              minWidth: 280,
              maxWidth: 360,
              boxShadow: "0 8px 32px rgba(0,0,0,0.22)",
              textAlign: "center",
            }}
          >
            <p style={{ margin: "0 0 24px", fontSize: 15, lineHeight: 1.6 }}>
              {confirmDialog.message}
            </p>
            <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
              <button
                onClick={() => setConfirmDialog(null)}
                style={{
                  flex: 1, padding: "10px 0", borderRadius: 10, border: "none",
                  background: darkMode ? "#2a2a2a" : "#f0f0f0",
                  color: darkMode ? "#ccc" : "#555",
                  fontSize: 14, fontWeight: 600, cursor: "pointer",
                }}
              >
                취소
              </button>
              <button
                onClick={confirmDialog.onConfirm}
                style={{
                  flex: 1, padding: "10px 0", borderRadius: 10, border: "none",
                  background: "#e53e3e", color: "#fff",
                  fontSize: 14, fontWeight: 600, cursor: "pointer",
                }}
              >
                삭제
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
