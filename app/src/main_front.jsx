import React, { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

const API_URL = "http://localhost:8000";
const APP_NAME = "SAGA";

const themes = {
  dark: {
    bg: "#0c1015", border: "#1e2a34",
    text: "#cdd6e0", textMuted: "#6e8298", textSubtle: "#3d5166",
    accent: "#0ea5e9", accentDim: "rgba(14,165,233,0.12)",
    inputBg: "#111920", inputBorder: "#1e2a34", codeBg: "#0e161e",
    sourceBg: "#0c2438", sourceText: "#38bdf8",
    userName: "#0ea5e9", botName: "#f59e0b",
    btnBg: "#0ea5e9", btnDisabled: "#1e2a34",
    menuBg: "#151d26", expandBg: "#111920",
  },
  light: {
    bg: "#f5f7fa", border: "#dde3ea",
    text: "#1e293b", textMuted: "#64748b", textSubtle: "#94a3b8",
    accent: "#0284c7", accentDim: "rgba(2,132,199,0.08)",
    inputBg: "#ffffff", inputBorder: "#dde3ea", codeBg: "#f1f5f9",
    sourceBg: "#e0f2fe", sourceText: "#0369a1",
    userName: "#0284c7", botName: "#b45309",
    btnBg: "#0284c7", btnDisabled: "#e2e8f0",
    menuBg: "#ffffff", expandBg: "#eef2f6",
  },
};

/* ── Google-Images-style gallery with inline expand ── */
function ImageGallery({ images, theme }) {
  const [expandedIdx, setExpandedIdx] = useState(null);
  if (!images || images.length === 0) return null;

  const toggle = (i) => setExpandedIdx(prev => prev === i ? null : i);
  const selected = expandedIdx !== null ? images[expandedIdx] : null;

  return (
    <div style={{ marginTop: 12 }}>
      {/* Masonry-ish grid */}
      <div style={{
        display: "flex", flexWrap: "wrap", gap: 6,
      }}>
        {images.map((img, i) => {
          const isActive = expandedIdx === i;
          return (
            <div key={i} onClick={() => toggle(i)} style={{
              width: 130, cursor: "pointer", borderRadius: 8, overflow: "hidden",
              border: `2px solid ${isActive ? theme.accent : "transparent"}`,
              transition: "border-color 0.2s, transform 0.15s",
              flexShrink: 0,
            }}
              onMouseEnter={e => { if (!isActive) e.currentTarget.style.transform = "scale(1.03)"; }}
              onMouseLeave={e => { e.currentTarget.style.transform = "scale(1)"; }}
            >
              <img
                src={`${API_URL}/images/${img.path}`} alt={img.label}
                style={{ width: "100%", height: 90, objectFit: "cover", display: "block" }}
                onError={e => e.target.style.display = "none"}
              />
              <div style={{
                padding: "4px 6px", fontSize: 10, color: theme.textMuted,
                background: theme.codeBg, display: "flex", justifyContent: "space-between",
              }}>
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 85 }}>
                  {img.label}
                </span>
                <span style={{ color: theme.accent, fontWeight: 600, flexShrink: 0 }}>{img.score}%</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Expanded panel — inline below grid like Google Images */}
      {selected && (
        <div style={{
          marginTop: 8, padding: 16, borderRadius: 10,
          background: theme.expandBg, border: `1px solid ${theme.border}`,
          display: "flex", gap: 16, alignItems: "flex-start",
          position: "relative",
        }}>
          <button onClick={() => setExpandedIdx(null)} style={{
            position: "absolute", top: 8, right: 12,
            background: "none", border: "none", color: theme.textMuted,
            fontSize: 20, cursor: "pointer", lineHeight: 1,
          }}>×</button>
          <img
            src={`${API_URL}/images/${selected.path}`} alt={selected.label}
            style={{ maxWidth: 400, maxHeight: 300, borderRadius: 8, objectFit: "contain" }}
          />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: theme.text, marginBottom: 6 }}>
              {selected.label}
            </div>
            <div style={{ fontSize: 13, color: theme.textMuted, lineHeight: 1.6 }}>
              <div>Relevance: <span style={{ color: theme.accent, fontWeight: 600 }}>{selected.score}%</span></div>
              <div style={{ marginTop: 4, fontSize: 11, color: theme.textSubtle }}>{selected.path}</div>
              {selected.width > 0 && (
                <div style={{ fontSize: 11, color: theme.textSubtle }}>{selected.width} × {selected.height} px</div>
              )}
            </div>
            <div style={{ marginTop: 10, display: "flex", gap: 6 }}>
              {expandedIdx > 0 && (
                <button onClick={(e) => { e.stopPropagation(); setExpandedIdx(expandedIdx - 1); }}
                  style={{ padding: "4px 12px", borderRadius: 6, border: `1px solid ${theme.border}`, background: "transparent", color: theme.textMuted, cursor: "pointer", fontSize: 12, fontFamily: "inherit" }}>
                  ← Prev
                </button>
              )}
              {expandedIdx < images.length - 1 && (
                <button onClick={(e) => { e.stopPropagation(); setExpandedIdx(expandedIdx + 1); }}
                  style={{ padding: "4px 12px", borderRadius: 6, border: `1px solid ${theme.border}`, background: "transparent", color: theme.textMuted, cursor: "pointer", fontSize: 12, fontFamily: "inherit" }}>
                  Next →
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function FollowUpQuestions({ questions, theme, onAsk }) {
  if (!questions || questions.length === 0) return null;
  return (
    <div style={{ marginTop: 10, display: "flex", gap: 6, flexWrap: "wrap" }}>
      {questions.map((q, i) => (
        <button key={i} onClick={() => onAsk(q)} style={{
          fontSize: 12, padding: "5px 12px", borderRadius: 14,
          border: `1px solid ${theme.border}`, background: "transparent",
          color: theme.textMuted, cursor: "pointer", fontFamily: "inherit",
          transition: "border-color 0.15s, color 0.15s",
        }}
          onMouseEnter={e => { e.target.style.borderColor = theme.accent; e.target.style.color = theme.text; }}
          onMouseLeave={e => { e.target.style.borderColor = theme.border; e.target.style.color = theme.textMuted; }}
        >{q}</button>
      ))}
    </div>
  );
}

function Message({ role, content, sources, images, related, theme, onAsk, showImages }) {
  const isUser = role === "user";
  const [copied, setCopied] = useState(false);
  const copyText = () => { navigator.clipboard.writeText(content); setCopied(true); setTimeout(() => setCopied(false), 1500); };
  return (
    <div style={{ maxWidth: 800, margin: "0 auto", padding: "0 24px" }}>
      <div style={{ display: "flex", gap: 12, alignItems: "flex-start", padding: "20px 0 4px" }}>
        <div style={{ width: 28, flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 12, fontWeight: 600, letterSpacing: "0.03em",
            color: isUser ? theme.userName : theme.botName,
            marginBottom: 6, display: "flex", alignItems: "center", justifyContent: "space-between",
            textTransform: "uppercase",
          }}>
            <span>{isUser ? "You" : APP_NAME}</span>
            {!isUser && content && (
              <button onClick={copyText} className="copy-btn" style={{
                background: "none", border: "none", cursor: "pointer",
                color: copied ? theme.accent : theme.textSubtle,
                fontSize: 11, fontFamily: "inherit", padding: "2px 6px",
                borderRadius: 4, textTransform: "none",
              }}>{copied ? "✓ Copied" : "Copy"}</button>
            )}
          </div>
          <div style={{ fontSize: 15, lineHeight: 1.75, color: theme.text, wordBreak: "break-word" }}>
            {isUser ? <span style={{ whiteSpace: "pre-wrap" }}>{content}</span> : (
              <div className="markdown-body"><ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown></div>
            )}
          </div>
          {sources && sources.length > 0 && (
            <div style={{ marginTop: 10, display: "flex", flexWrap: "wrap", gap: 6 }}>
              {sources.map((s, i) => (
                <span key={i} style={{
                  fontSize: 10, padding: "2px 8px", borderRadius: 4,
                  background: theme.sourceBg, color: theme.sourceText,
                  fontFamily: "'JetBrains Mono', monospace",
                }}>{s}</span>
              ))}
            </div>
          )}
          {!isUser && showImages && <ImageGallery images={images} theme={theme} />}
          {!isUser && <FollowUpQuestions questions={related} theme={theme} onAsk={onAsk} />}
        </div>
      </div>
    </div>
  );
}

function DropdownMenu({ open, onClose, theme, onAction, imageMode }) {
  if (!open) return null;
  const items = [
    { key: "new", label: "New chat", icon: "＋" },
    { key: "image_mode", label: imageMode ? "Switch to chat mode" : "Image search mode", icon: imageMode ? "💬" : "🖼" },
    { key: "divider" },
    { key: "clear_cache", label: "Clear cache", icon: "↻" },
    { key: "clear_stats", label: "Clear stats", icon: "✕" },
  ];
  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 99 }} />
      <div style={{
        position: "absolute", top: 44, left: 12, zIndex: 100,
        background: theme.menuBg, border: `1px solid ${theme.border}`,
        borderRadius: 10, padding: "6px 0", minWidth: 210,
        boxShadow: "0 8px 32px rgba(0,0,0,0.3)",
      }}>
        {items.map((item, i) => {
          if (item.key === "divider") return <div key={i} style={{ height: 1, background: theme.border, margin: "4px 0" }} />;
          return (
            <button key={item.key} onClick={() => { onAction(item.key); onClose(); }} style={{
              display: "flex", alignItems: "center", gap: 10,
              width: "100%", padding: "9px 16px", border: "none",
              background: "transparent", color: theme.text, fontSize: 13,
              fontFamily: "inherit", cursor: "pointer", textAlign: "left",
            }}
              onMouseEnter={e => e.currentTarget.style.background = theme.accentDim}
              onMouseLeave={e => e.currentTarget.style.background = "transparent"}
            >
              <span style={{ width: 20, textAlign: "center", fontSize: 13 }}>{item.icon}</span>
              {item.label}
            </button>
          );
        })}
      </div>
    </>
  );
}

export default function MainFront() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [mode, setMode] = useState("chat");
  const [darkMode, setDarkMode] = useState(true);
  const [showImages, setShowImages] = useState(false);
  const scrollRef = useRef(null);
  const inputRef = useRef(null);
  const abortRef = useRef(null);
  const t = darkMode ? themes.dark : themes.light;

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, loading, streaming]);

  const stop = () => { if (abortRef.current) { abortRef.current.abort(); abortRef.current = null; } setLoading(false); setStreaming(false); };
  const newChat = () => { stop(); setMessages([]); setInput(""); inputRef.current?.focus(); };

  const handleMenuAction = async (key) => {
    if (key === "new") newChat();
    else if (key === "image_mode") { setMode(m => m === "image" ? "chat" : "image"); setMessages([]); }
    else if (key === "clear_cache") { try { await fetch(`${API_URL}/clear-cache`); } catch {} }
    else if (key === "clear_stats") { try { await fetch(`${API_URL}/clear-stats`); } catch {} }
  };

  const send = async (overrideText) => {
    const text = (overrideText || input).trim();
    if (!text || loading) return;
    setInput("");
    if (inputRef.current) inputRef.current.style.height = "auto";
    setLoading(true); setStreaming(false);
    setMessages(prev => [...prev, { role: "user", content: text }]);

    if (mode === "image") {
      try {
        const res = await fetch(`${API_URL}/search/images`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query: text, k: 20 }),
        });
        const data = await res.json();
        const imgs = data.images || [];
        setMessages(prev => [...prev, {
          role: "assistant",
          content: imgs.length > 0 ? `${imgs.length} results for "${text}"` : `No relevant images found for "${text}"`,
          sources: [], images: imgs, related: [],
        }]);
      } catch {
        setMessages(prev => [...prev, { role: "assistant", content: "Could not connect to backend.", sources: [], images: [], related: [] }]);
      } finally { setLoading(false); inputRef.current?.focus(); }
      return;
    }

    setMessages(prev => [...prev, { role: "assistant", content: "", sources: [], images: [], related: [] }]);
    const controller = new AbortController(); abortRef.current = controller;
    try {
      const res = await fetch(`${API_URL}/chat/stream`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: text }), signal: controller.signal,
      });
      const reader = res.body.getReader(); const decoder = new TextDecoder(); let buffer = ""; setStreaming(true);
      while (true) {
        const { done, value } = await reader.read(); if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n"); buffer = lines.pop() || "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const event = JSON.parse(line.slice(6));
            if (event.type === "token") {
              setMessages(prev => { const u = [...prev]; const last = u[u.length - 1]; if (last?.role === "assistant") u[u.length - 1] = { ...last, content: last.content + event.content }; return u; });
            } else if (event.type === "done") {
              setMessages(prev => { const u = [...prev]; const last = u[u.length - 1]; if (last?.role === "assistant") u[u.length - 1] = { ...last, sources: event.sources || [], images: event.images || [], related: event.related || [] }; return u; });
            }
          } catch {}
        }
      }
    } catch (e) {
      if (e.name !== "AbortError") {
        setMessages(prev => { const u = [...prev]; const last = u[u.length - 1]; if (last?.role === "assistant" && !last.content) u[u.length - 1] = { ...last, content: "Could not connect to backend." }; return u; });
      }
    } finally { abortRef.current = null; setLoading(false); setStreaming(false); inputRef.current?.focus(); }
  };

  const handleKeyDown = (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } };

  const suggestions = mode === "image"
    ? ["subsea pipeline corrosion", "marine growth fouling", "anode depletion", "ROV inspection crack", "coating damage", "freespan pipeline"]
    : ["What are common subsea pipeline failure modes?", "Explain cathodic protection monitoring", "Show corrosion examples", "What is DNV-RP-F116?"];

  const font = '"Outfit", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
  const dm = darkMode;

  return (
    <div style={{ position: "fixed", inset: 0, display: "flex", flexDirection: "column", background: t.bg, fontFamily: font, transition: "background 0.3s" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        textarea::placeholder { color: ${t.textSubtle}; }
        textarea:focus { outline: none; }
        ::-webkit-scrollbar { width: 5px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: ${t.border}; border-radius: 3px; }
        .markdown-body p { margin: 0.5em 0; } .markdown-body p:first-child { margin-top: 0; } .markdown-body p:last-child { margin-bottom: 0; }
        .markdown-body strong { font-weight: 600; color: ${dm ? '#fff' : '#0f172a'}; }
        .markdown-body h1, .markdown-body h2, .markdown-body h3 { font-weight: 600; color: ${dm ? '#fff' : '#0f172a'}; margin: 0.8em 0 0.4em; }
        .markdown-body h1 { font-size: 1.3em; } .markdown-body h2 { font-size: 1.15em; } .markdown-body h3 { font-size: 1.05em; }
        .markdown-body ul, .markdown-body ol { margin: 0.4em 0; padding-left: 1.5em; } .markdown-body li { margin: 0.2em 0; }
        .markdown-body code { background: ${t.codeBg}; padding: 1px 5px; border-radius: 3px; font-family: 'JetBrains Mono', monospace; font-size: 0.85em; }
        .markdown-body pre { background: ${t.codeBg}; padding: 12px 16px; border-radius: 8px; overflow-x: auto; margin: 0.6em 0; }
        .markdown-body pre code { background: none; padding: 0; }
        .markdown-body table { border-collapse: collapse; width: 100%; margin: 0.6em 0; font-size: 0.9em; }
        .markdown-body th, .markdown-body td { border: 1px solid ${t.border}; padding: 6px 10px; text-align: left; }
        .markdown-body th { background: ${t.codeBg}; font-weight: 600; }
        .copy-btn { opacity: 0.3; transition: opacity 0.15s; } .copy-btn:hover { opacity: 1; }
        @keyframes pulse { 0%, 100% { opacity: 0.3; } 50% { opacity: 1; } }
        .dot-loading span { animation: pulse 1.4s ease-in-out infinite; }
        .dot-loading span:nth-child(2) { animation-delay: 0.2s; }
        .dot-loading span:nth-child(3) { animation-delay: 0.4s; }
      `}</style>

      {/* Header */}
      <div style={{ padding: "0 16px", height: 48, borderBottom: `1px solid ${t.border}`, display: "flex", alignItems: "center", justifyContent: "space-between", background: t.bg, position: "relative", transition: "background 0.3s" }}>
        <button onClick={() => setMenuOpen(!menuOpen)} style={{ background: "none", border: "none", color: t.textMuted, cursor: "pointer", padding: 6, borderRadius: 6, display: "flex", alignItems: "center" }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
        </button>
        <DropdownMenu open={menuOpen} onClose={() => setMenuOpen(false)} theme={t} onAction={handleMenuAction} imageMode={mode === "image"} />
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 16, fontWeight: 700, color: t.text, letterSpacing: "0.08em" }}>{APP_NAME}</span>
          {mode === "image" && <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 4, background: t.accentDim, color: t.accent, fontWeight: 600, textTransform: "uppercase" }}>Images</span>}
        </div>
        <button onClick={() => setDarkMode(!darkMode)} style={{ background: "none", border: "none", cursor: "pointer", color: t.textMuted, padding: 6, borderRadius: 6, display: "flex", alignItems: "center" }}>
          {darkMode
            ? <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>
            : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/></svg>
          }
        </button>
      </div>

      {/* Messages */}
      <div ref={scrollRef} style={{ flex: 1, overflowY: "auto", paddingBottom: 24 }}>
        {messages.length === 0 && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: 20 }}>
            <div style={{ textAlign: "center" }}>
              <p style={{ fontSize: 22, fontWeight: 600, color: t.text }}>{mode === "image" ? "Image Search" : "Subsea Inspection Assistant"}</p>
              <p style={{ fontSize: 14, color: t.textMuted, marginTop: 6, maxWidth: 400 }}>
                {mode === "image" ? "Search ROV imagery and inspection photos" : "Query inspection reports, standards, and ROV imagery"}
              </p>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center", maxWidth: 560 }}>
              {suggestions.map((q, i) => (
                <button key={i} onClick={() => { setInput(q); inputRef.current?.focus(); }} style={{
                  padding: "8px 16px", borderRadius: 20, border: `1px solid ${t.border}`,
                  background: "transparent", color: t.textMuted, fontSize: 13, cursor: "pointer", fontFamily: font,
                  transition: "border-color 0.15s, color 0.15s",
                }}
                  onMouseEnter={e => { e.target.style.borderColor = t.accent; e.target.style.color = t.text; }}
                  onMouseLeave={e => { e.target.style.borderColor = t.border; e.target.style.color = t.textMuted; }}
                >{q}</button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i}>
            <Message role={m.role} content={m.content} sources={m.sources} images={m.images} related={m.related} theme={t} onAsk={q => send(q)} showImages={mode === "image" || showImages} />
            {i < messages.length - 1 && <div style={{ maxWidth: 800, margin: "0 auto", padding: "0 24px" }}><div style={{ borderBottom: `1px solid ${t.border}` }} /></div>}
          </div>
        ))}
        {loading && !streaming && (
          <div style={{ maxWidth: 800, margin: "0 auto", padding: "20px 24px" }}>
            <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
              <span className="dot-loading" style={{ fontSize: 15, color: t.textMuted }}>
                {mode === "image" ? "Searching imagery" : "Analyzing reports"}<span> ·</span><span> ·</span><span> ·</span>
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div style={{ padding: "12px 24px", background: t.bg, transition: "background 0.3s" }}>
        <div style={{ maxWidth: 800, margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 10, background: t.inputBg, border: `1px solid ${t.inputBorder}`, borderRadius: 24, padding: "6px 6px 6px 12px", transition: "border-color 0.2s" }}>
            {mode === "chat" && (
              <button onClick={() => setShowImages(v => !v)} title={showImages ? "Hide images" : "Show images"} style={{
                background: "none", border: "none", cursor: "pointer",
                color: showImages ? t.accent : t.textSubtle, padding: "8px 4px",
                display: "flex", alignItems: "center", flexShrink: 0, transition: "color 0.15s",
              }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={showImages ? "2.2" : "1.5"} strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/>
                </svg>
              </button>
            )}
            <textarea ref={inputRef} value={input} onChange={e => setInput(e.target.value)} onKeyDown={handleKeyDown}
              placeholder={mode === "image" ? "Describe what you're looking for..." : "Ask about subsea inspections..."} rows={1}
              style={{ flex: 1, resize: "none", border: "none", background: "transparent", color: t.text, fontSize: 15, fontFamily: font, padding: "8px 0", lineHeight: 1.5, minHeight: 24, maxHeight: 120 }}
              onInput={e => { e.target.style.height = "auto"; e.target.style.height = e.target.scrollHeight + "px"; }}
              onFocus={e => e.target.parentElement.style.borderColor = t.accent}
              onBlur={e => e.target.parentElement.style.borderColor = t.inputBorder} />
            {loading ? (
              <button onClick={stop} style={{ width: 36, height: 36, borderRadius: "50%", border: "none", background: "#dc2626", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="#fff"><rect x="4" y="4" width="16" height="16" rx="2" /></svg>
              </button>
            ) : (
              <button onClick={() => send()} disabled={!input.trim()} style={{
                width: 36, height: 36, borderRadius: "50%", border: "none",
                background: input.trim() ? t.btnBg : t.btnDisabled, cursor: input.trim() ? "pointer" : "default",
                display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "background 0.2s",
              }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 19V5M5 12l7-7 7 7" /></svg>
              </button>
            )}
          </div>
        </div>
      </div>
      <div style={{ padding: "4px 24px 12px", textAlign: "center", background: t.bg }}>
        <p style={{ fontSize: 11, color: t.textSubtle }}>Responses may contain inaccuracies. Always verify critical inspection findings.</p>
      </div>
    </div>
  );
}