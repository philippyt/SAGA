import React, { useState, useRef, useEffect, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

const API = "http://localhost:8000";

/* ── Professional theme: warm neutrals, subtle accents ── */
const themes = {
  dark: {
    bg: "#141418", bgAlt: "#1a1a20", border: "#2a2a32",
    text: "#d4d4dc", textMuted: "#8888a0", textSubtle: "#55556a",
    accent: "#7c8cf0", accentDim: "rgba(124,140,240,0.08)", accentSoft: "rgba(124,140,240,0.15)",
    inputBg: "#1a1a20", inputBorder: "#2a2a32", codeBg: "#18181e",
    sourceBg: "rgba(124,140,240,0.1)", sourceText: "#9ca3f0",
    userName: "#9ca3f0", botName: "#d4d4dc",
    btnBg: "#7c8cf0", btnDisabled: "#2a2a32",
    menuBg: "#1e1e24", expandBg: "#1a1a20",
    toolBg: "rgba(124,140,240,0.05)", toolBorder: "#2a2a32", toolText: "#8888a0",
    success: "#4ade80",
  },
  light: {
    bg: "#fafafa", bgAlt: "#ffffff", border: "#e5e5e5",
    text: "#1a1a2e", textMuted: "#6b7280", textSubtle: "#9ca3af",
    accent: "#4f46e5", accentDim: "rgba(79,70,229,0.05)", accentSoft: "rgba(79,70,229,0.1)",
    inputBg: "#ffffff", inputBorder: "#e5e5e5", codeBg: "#f4f4f5",
    sourceBg: "rgba(79,70,229,0.06)", sourceText: "#4338ca",
    userName: "#4f46e5", botName: "#1a1a2e",
    btnBg: "#4f46e5", btnDisabled: "#e5e5e5",
    menuBg: "#ffffff", expandBg: "#f4f4f5",
    toolBg: "rgba(79,70,229,0.03)", toolBorder: "#e5e5e5", toolText: "#6b7280",
    success: "#16a34a",
  },
};

const TOOL_META = {
  search_reports: { icon: "📄", verb: "Searched reports" },
  search_images: { icon: "🖼", verb: "Searched images" },
  classify_defect: { icon: "🔬", verb: "Analyzed defect" },
  check_standard: { icon: "📋", verb: "Checked standards" },
};

/* ── Collapsible tool activity ── */
function ToolSteps({ steps, theme }) {
  const [open, setOpen] = useState(false);
  if (!steps?.length) return null;
  return (
    <div style={{ marginBottom: 10 }}>
      <button onClick={() => setOpen(v => !v)} style={{
        display: "flex", alignItems: "center", gap: 6, padding: "5px 10px",
        background: theme.toolBg, border: `1px solid ${theme.toolBorder}`,
        borderRadius: 6, cursor: "pointer", color: theme.toolText,
        fontSize: 12, fontFamily: "inherit", width: "auto",
      }}>
        <span style={{ fontSize: 11, color: theme.success }}>✓</span>
        <span>{steps.length} tool{steps.length > 1 ? "s" : ""} used</span>
        <span style={{ fontSize: 9, marginLeft: 4, opacity: 0.5 }}>{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <div style={{ marginTop: 4, padding: "8px 12px", background: theme.toolBg, border: `1px solid ${theme.toolBorder}`, borderRadius: 6, fontSize: 12 }}>
          {steps.map((s, i) => {
            const m = TOOL_META[s.name] || { icon: "🔧", verb: s.name };
            return (
              <div key={i} style={{ padding: "3px 0", display: "flex", gap: 6, alignItems: "baseline", color: theme.toolText }}>
                <span style={{ fontSize: 12 }}>{m.icon}</span>
                <span style={{ fontWeight: 500 }}>{m.verb}</span>
                {s.input && <span style={{ color: theme.textSubtle, fontSize: 11, fontFamily: "'JetBrains Mono', monospace" }}>
                  {typeof s.input === "object" ? Object.values(s.input).join(", ").slice(0, 50) : ""}
                </span>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ── Google-style gallery ── */
function ImageGallery({ images, theme }) {
  const [sel, setSel] = useState(null);
  if (!images?.length) return null;
  const img = sel !== null ? images[sel] : null;
  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {images.map((im, i) => (
          <div key={i} onClick={() => setSel(sel === i ? null : i)} style={{
            width: 120, cursor: "pointer", borderRadius: 6, overflow: "hidden",
            border: `2px solid ${sel === i ? theme.accent : "transparent"}`,
            transition: "border-color 0.15s, opacity 0.15s", flexShrink: 0,
            opacity: sel !== null && sel !== i ? 0.5 : 1,
          }}>
            <img src={`${API}/images/${im.path}`} alt={im.label}
              style={{ width: "100%", height: 80, objectFit: "cover", display: "block" }}
              onError={e => e.target.style.display = "none"} />
            <div style={{ padding: "3px 6px", fontSize: 10, color: theme.textMuted, background: theme.codeBg, display: "flex", justifyContent: "space-between" }}>
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 75 }}>{im.label}</span>
              {im.score > 0 && <span style={{ color: theme.accent, fontWeight: 600, flexShrink: 0 }}>{im.score}%</span>}
            </div>
          </div>
        ))}
      </div>
      {img && (
        <div style={{ marginTop: 8, padding: 14, borderRadius: 8, background: theme.expandBg, border: `1px solid ${theme.border}`, display: "flex", gap: 14, alignItems: "flex-start", position: "relative" }}>
          <button onClick={() => setSel(null)} style={{ position: "absolute", top: 6, right: 10, background: "none", border: "none", color: theme.textSubtle, fontSize: 18, cursor: "pointer" }}>×</button>
          <img src={`${API}/images/${img.path}`} alt={img.label} style={{ maxWidth: 360, maxHeight: 260, borderRadius: 6, objectFit: "contain" }} />
          <div style={{ flex: 1, minWidth: 0, fontSize: 13 }}>
            <div style={{ fontWeight: 600, color: theme.text, marginBottom: 4 }}>{img.label}</div>
            {img.score > 0 && <div style={{ color: theme.textMuted }}>Relevance: <span style={{ color: theme.accent, fontWeight: 600 }}>{img.score}%</span></div>}
            <div style={{ fontSize: 11, color: theme.textSubtle, marginTop: 4 }}>{img.path}</div>
            {img.width > 0 && <div style={{ fontSize: 11, color: theme.textSubtle }}>{img.width} × {img.height} px</div>}
            <div style={{ marginTop: 8, display: "flex", gap: 6 }}>
              {sel > 0 && <button onClick={e => { e.stopPropagation(); setSel(sel - 1); }} style={{ padding: "3px 10px", borderRadius: 4, border: `1px solid ${theme.border}`, background: "transparent", color: theme.textMuted, cursor: "pointer", fontSize: 11, fontFamily: "inherit" }}>← Prev</button>}
              {sel < images.length - 1 && <button onClick={e => { e.stopPropagation(); setSel(sel + 1); }} style={{ padding: "3px 10px", borderRadius: 4, border: `1px solid ${theme.border}`, background: "transparent", color: theme.textMuted, cursor: "pointer", fontSize: 11, fontFamily: "inherit" }}>Next →</button>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function FollowUps({ questions, theme, onAsk }) {
  if (!questions?.length) return null;
  return (
    <div style={{ marginTop: 10, display: "flex", gap: 6, flexWrap: "wrap" }}>
      {questions.map((q, i) => (
        <button key={i} onClick={() => onAsk(q)} style={{
          fontSize: 13, padding: "5px 12px", borderRadius: 12,
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

function Message({ msg, theme, onAsk }) {
  const { role, content, sources, images, related, toolCalls } = msg;
  const isUser = role === "user";
  const [copied, setCopied] = useState(false);
  return (
    <div style={{ maxWidth: 860, margin: "0 auto", padding: "0 24px" }}>
      <div style={{ padding: "18px 0 6px" }}>
        <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase", color: isUser ? theme.userName : theme.botName, marginBottom: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span>{isUser ? "You" : "SAGA"}</span>
          {!isUser && content && (
            <button onClick={() => { navigator.clipboard.writeText(content); setCopied(true); setTimeout(() => setCopied(false), 1200); }}
              className="copy-btn" style={{ background: "none", border: "none", cursor: "pointer", color: copied ? theme.success : theme.textSubtle, fontSize: 11, fontFamily: "inherit", padding: "1px 4px", textTransform: "none" }}>
              {copied ? "Copied" : "Copy"}
            </button>
          )}
        </div>
        {!isUser && <ToolSteps steps={toolCalls} theme={theme} />}
        <div style={{ fontSize: 16, lineHeight: 1.75, color: theme.text, wordBreak: "break-word" }}>
          {isUser ? <span style={{ whiteSpace: "pre-wrap" }}>{content?.replace(/\s*\(include relevant inspection images\)/g, "")}</span> : (
            <div className="md"><ReactMarkdown remarkPlugins={[remarkGfm]}>{
              /* Strip [IMAGE: ...] tags and clean orphaned punctuation */
              content
                ?.replace(/\[IMAGE:\s*[^\]]+\]/g, "")
                .replace(/\s{2,}/g, " ")
                .replace(/\s+([,.\;\:])/g, "$1")
                .replace(/([,.\;\:])\s*\1+/g, "$1")
                .replace(/\band\s*[,\.]/g, "and")
                .replace(/[,\.]\s*and\b/g, " and")
                .replace(/\(\s*\)/g, "")
                .replace(/\s+\./g, ".")
                .replace(/\s+,/g, ",")
                .trim()
            }</ReactMarkdown></div>
          )}
        </div>
        {sources?.length > 0 && (
          <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap", gap: 4 }}>
            {sources.map((s, i) => (
              <span key={i} style={{ fontSize: 11, padding: "3px 8px", borderRadius: 4, background: theme.sourceBg, color: theme.sourceText, fontFamily: "'JetBrains Mono', monospace" }}>{s}</span>
            ))}
          </div>
        )}
        {!isUser && images?.length > 0 && <ImageGallery images={images} theme={theme} />}
        {!isUser && <FollowUps questions={related} theme={theme} onAsk={onAsk} />}
      </div>
    </div>
  );
}

function Menu({ open, onClose, theme, onAction, imageMode }) {
  if (!open) return null;
  const items = [
    { key: "new", label: "New chat", icon: "＋" },
    { key: "image_mode", label: imageMode ? "Back to chat" : "Image search", icon: imageMode ? "💬" : "🖼" },
    { key: "div" },
    { key: "clear_cache", label: "Clear cache", icon: "↻" },
    { key: "clear_stats", label: "Clear stats", icon: "✕" },
  ];
  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 99 }} />
      <div style={{ position: "absolute", top: 44, left: 12, zIndex: 100, background: theme.menuBg, border: `1px solid ${theme.border}`, borderRadius: 8, padding: "4px 0", minWidth: 190, boxShadow: "0 6px 24px rgba(0,0,0,0.25)" }}>
        {items.map((it, i) => {
          if (it.key === "div") return <div key={i} style={{ height: 1, background: theme.border, margin: "3px 0" }} />;
          return (
            <button key={it.key} onClick={() => { onAction(it.key); onClose(); }} style={{
              display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "8px 14px",
              border: "none", background: "transparent", color: theme.text, fontSize: 13,
              fontFamily: "inherit", cursor: "pointer", textAlign: "left",
            }}
              onMouseEnter={e => e.currentTarget.style.background = theme.accentDim}
              onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
              <span style={{ width: 18, textAlign: "center", fontSize: 12 }}>{it.icon}</span>{it.label}
            </button>
          );
        })}
      </div>
    </>
  );
}

function StatusIndicator({ text, theme }) {
  return (
    <div style={{ maxWidth: 860, margin: "0 auto", padding: "12px 20px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div className="spinner" style={{ width: 14, height: 14, border: `2px solid ${theme.border}`, borderTopColor: theme.accent, borderRadius: "50%" }} />
        <span style={{ fontSize: 13, color: theme.textMuted }}>{text}</span>
      </div>
    </div>
  );
}

export default function App() {
  const [msgs, setMsgs] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [mode, setMode] = useState("chat");
  const [dark, setDark] = useState(true);
  const [status, setStatus] = useState(null);
  const [wantImages, setWantImages] = useState(false);
  const scrollRef = useRef(null);
  const inputRef = useRef(null);
  const abortRef = useRef(null);
  const toolsRef = useRef([]);
  const t = dark ? themes.dark : themes.light;

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [msgs, loading, streaming, status]);

  const stop = () => { abortRef.current?.abort(); abortRef.current = null; setLoading(false); setStreaming(false); setStatus(null); };
  const newChat = () => { stop(); setMsgs([]); setInput(""); inputRef.current?.focus(); };

  const menuAction = async (key) => {
    if (key === "new") newChat();
    else if (key === "image_mode") { setMode(m => m === "image" ? "chat" : "image"); setMsgs([]); }
    else if (key === "clear_cache") { try { await fetch(`${API}/clear-cache`); } catch {} }
    else if (key === "clear_stats") { try { await fetch(`${API}/clear-stats`); } catch {} }
  };

  /* ── Chat send (agent mode) ── */
  const send = useCallback(async (overrideText) => {
    const text = (overrideText || input).trim();
    if (!text || loading) return;
    setInput("");
    if (inputRef.current) inputRef.current.style.height = "auto";
    setLoading(true); setStreaming(false);
    if (mode === "image") {
      setStatus("Searching images...");
      setMsgs(prev => [...prev, { role: "user", content: text }]);
      try {
        const res = await fetch(`${API}/search/images`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query: text, k: 20 }),
        });
        const data = await res.json();
        const imgs = data.images || [];
        setMsgs(prev => [...prev, {
          role: "assistant", content: "",
          images: imgs, sources: [], related: [], toolCalls: [],
        }]);
      } catch {
        setMsgs(prev => [...prev, { role: "assistant", content: "Could not reach backend.", images: [], sources: [], related: [], toolCalls: [] }]);
      }
      setLoading(false); setStatus(null); inputRef.current?.focus();
      return;
    }

    // ── Agent mode ──
    setStatus("Planning...");
    toolsRef.current = [];
    const displayText = text.replace(/\s*\(include relevant inspection images\)/g, "");
    const queryText = wantImages ? text + " (include relevant inspection images)" : text;
    setWantImages(false);
    setMsgs(prev => [...prev, { role: "user", content: displayText }]);
    setMsgs(prev => [...prev, { role: "assistant", content: "", sources: [], images: [], related: [], toolCalls: [] }]);

    const ctrl = new AbortController(); abortRef.current = ctrl;
    try {
      const res = await fetch(`${API}/chat/stream`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: queryText, use_agent: true }), signal: ctrl.signal,
      });
      const reader = res.body.getReader(); const dec = new TextDecoder(); let buf = "";
      while (true) {
        const { done, value } = await reader.read(); if (done) break;
        buf += dec.decode(value, { stream: true });
        const lines = buf.split("\n"); buf = lines.pop() || "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const ev = JSON.parse(line.slice(6));
            if (ev.type === "thinking") {
              setStatus(ev.content || "Thinking...");
            } else if (ev.type === "tool_call") {
              const meta = TOOL_META[ev.name] || { verb: ev.name };
              setStatus(`${meta.verb}...`);
              toolsRef.current = [...toolsRef.current, { name: ev.name, input: ev.input }];
            } else if (ev.type === "tool_result") {
              const steps = [...toolsRef.current];
              if (steps.length) steps[steps.length - 1].preview = ev.preview;
              toolsRef.current = steps;
            } else if (ev.type === "token") {
              setStatus(null);
              setStreaming(true);
              setMsgs(prev => { const u = [...prev]; const l = u[u.length - 1]; if (l?.role === "assistant") u[u.length - 1] = { ...l, content: l.content + ev.content, toolCalls: [...toolsRef.current] }; return u; });
            } else if (ev.type === "done") {
              setStatus(null);
              setMsgs(prev => { const u = [...prev]; const l = u[u.length - 1]; if (l?.role === "assistant") u[u.length - 1] = { ...l, sources: ev.sources || [], images: ev.images || [], related: ev.related || [], toolCalls: [...toolsRef.current] }; return u; });
            }
          } catch {}
        }
      }
    } catch (e) {
      if (e.name !== "AbortError") {
        setMsgs(prev => { const u = [...prev]; const l = u[u.length - 1]; if (l?.role === "assistant" && !l.content) u[u.length - 1] = { ...l, content: "Could not connect to backend." }; return u; });
      }
    }
    abortRef.current = null; setLoading(false); setStreaming(false); setStatus(null); inputRef.current?.focus();
  }, [input, loading, mode, wantImages]);

  const onKey = (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } };

  const suggestions = mode === "image"
    ? ["subsea pipeline corrosion", "marine growth fouling", "anode depletion", "crack defect", "coating damage", "freespan"]
    : ["Analyze corrosion types in the reports", "Show marine growth inspection guidance", "What are freespan acceptance criteria?", "Compare NDE methods for subsea pipelines"];

  const F = '"Outfit", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

  return (
    <div style={{ position: "fixed", inset: 0, display: "flex", flexDirection: "column", background: t.bg, fontFamily: F, transition: "background 0.25s" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        textarea::placeholder { color: ${t.textSubtle}; }
        textarea:focus { outline: none; }
        ::-webkit-scrollbar { width: 4px; } ::-webkit-scrollbar-track { background: transparent; } ::-webkit-scrollbar-thumb { background: ${t.border}; border-radius: 2px; }
        .md p { margin: 0.4em 0; } .md p:first-child { margin-top: 0; } .md p:last-child { margin-bottom: 0; }
        .md strong { font-weight: 600; color: ${dark ? '#e8e8ee' : '#111'}; }
        .md h1, .md h2, .md h3 { font-weight: 600; color: ${dark ? '#e8e8ee' : '#111'}; margin: 0.7em 0 0.3em; }
        .md h1 { font-size: 1.2em; } .md h2 { font-size: 1.1em; } .md h3 { font-size: 1.0em; }
        .md ul, .md ol { margin: 0.3em 0; padding-left: 1.4em; } .md li { margin: 0.15em 0; }
        .md code { background: ${t.codeBg}; padding: 1px 4px; border-radius: 3px; font-family: 'JetBrains Mono', monospace; font-size: 0.85em; }
        .md pre { background: ${t.codeBg}; padding: 10px 14px; border-radius: 6px; overflow-x: auto; margin: 0.5em 0; }
        .md pre code { background: none; padding: 0; }
        .md table { border-collapse: collapse; width: 100%; margin: 0.5em 0; font-size: 0.9em; }
        .md th, .md td { border: 1px solid ${t.border}; padding: 5px 8px; text-align: left; }
        .md th { background: ${t.codeBg}; font-weight: 600; }
        .copy-btn { opacity: 0; transition: opacity 0.15s; } div:hover .copy-btn { opacity: 0.5; } .copy-btn:hover { opacity: 1 !important; }
        @keyframes spin { to { transform: rotate(360deg); } }
        .spinner { animation: spin 0.7s linear infinite; }
      `}</style>

      {/* Header */}
      <div style={{ padding: "0 14px", height: 46, borderBottom: `1px solid ${t.border}`, display: "flex", alignItems: "center", justifyContent: "space-between", background: t.bg, position: "relative" }}>
        <button onClick={() => setMenuOpen(!menuOpen)} style={{ background: "none", border: "none", color: t.textMuted, cursor: "pointer", padding: 6, display: "flex" }}>
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
        </button>
        <Menu open={menuOpen} onClose={() => setMenuOpen(false)} theme={t} onAction={menuAction} imageMode={mode === "image"} />
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: t.text, letterSpacing: "0.06em" }}>SAGA</span>
          {mode === "image" && <span style={{ fontSize: 9, padding: "2px 6px", borderRadius: 3, background: t.accentDim, color: t.accent, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>Images</span>}
        </div>
        <button onClick={() => setDark(!dark)} style={{ background: "none", border: "none", cursor: "pointer", color: t.textMuted, padding: 6, display: "flex" }}>
          {dark
            ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>
            : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/></svg>}
        </button>
      </div>

      {/* Messages */}
      <div ref={scrollRef} style={{ flex: 1, overflowY: "auto", paddingBottom: 20 }}>
        {msgs.length === 0 && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: 18 }}>
            <div style={{ textAlign: "center" }}>
              <p style={{ fontSize: 20, fontWeight: 600, color: t.text }}>{mode === "image" ? "Image Search" : "Subsea Inspection Agent"}</p>
              <p style={{ fontSize: 13, color: t.textMuted, marginTop: 5, maxWidth: 400 }}>
                {mode === "image" ? "Search ROV imagery and inspection photos" : "Searches reports, analyzes images, classifies defects, checks standards"}
              </p>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, justifyContent: "center", maxWidth: 560 }}>
              {suggestions.map((q, i) => (
                <button key={i} onClick={() => { setInput(q); inputRef.current?.focus(); }} style={{
                  padding: "7px 14px", borderRadius: 16, border: `1px solid ${t.border}`,
                  background: "transparent", color: t.textMuted, fontSize: 12, cursor: "pointer", fontFamily: F,
                  transition: "border-color 0.15s, color 0.15s",
                }}
                  onMouseEnter={e => { e.target.style.borderColor = t.accent; e.target.style.color = t.text; }}
                  onMouseLeave={e => { e.target.style.borderColor = t.border; e.target.style.color = t.textMuted; }}
                >{q}</button>
              ))}
            </div>
          </div>
        )}
        {msgs.map((m, i) => (
          <div key={i}>
            <Message msg={m} theme={t} onAsk={q => send(q)} />
            {i < msgs.length - 1 && <div style={{ maxWidth: 860, margin: "0 auto", padding: "0 20px" }}><div style={{ borderBottom: `1px solid ${t.border}`, opacity: 0.5 }} /></div>}
          </div>
        ))}
        {loading && status && <StatusIndicator text={status} theme={t} />}
      </div>

      {/* Input */}
      <div style={{ padding: "10px 20px", background: t.bg }}>
        <div style={{ maxWidth: 860, margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 8, background: t.inputBg, border: `1px solid ${t.inputBorder}`, borderRadius: 22, padding: "5px 5px 5px 16px", transition: "border-color 0.2s" }}>
            <textarea ref={inputRef} value={input} onChange={e => setInput(e.target.value)} onKeyDown={onKey}
              placeholder={mode === "image" ? "Describe what you're looking for..." : "Ask about subsea inspections..."} rows={1}
              style={{ flex: 1, resize: "none", border: "none", background: "transparent", color: t.text, fontSize: 15, fontFamily: F, padding: "8px 0", lineHeight: 1.5, minHeight: 24, maxHeight: 120 }}
              onInput={e => { e.target.style.height = "auto"; e.target.style.height = e.target.scrollHeight + "px"; }}
              onFocus={e => e.target.parentElement.style.borderColor = t.accent}
              onBlur={e => e.target.parentElement.style.borderColor = t.inputBorder} />
            {/* Image toggle when active, send includes image hint */}
            {mode === "chat" && (
              <button onClick={() => setWantImages(v => !v)} title={wantImages ? "Images enabled" : "Include images"} style={{
                width: 34, height: 34, borderRadius: "50%", border: wantImages ? `2px solid ${t.accent}` : "2px solid transparent",
                background: wantImages ? t.accentSoft : "transparent",
                cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                transition: "all 0.15s",
              }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={wantImages ? t.accent : t.textSubtle} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/>
                </svg>
              </button>
            )}
            {loading ? (
              <button onClick={stop} style={{ width: 32, height: 32, borderRadius: "50%", border: "none", background: "#ef4444", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="#fff"><rect x="5" y="5" width="14" height="14" rx="2" /></svg>
              </button>
            ) : (
              <button onClick={() => send()} disabled={!input.trim()} style={{
                width: 32, height: 32, borderRadius: "50%", border: "none",
                background: input.trim() ? t.btnBg : t.btnDisabled, cursor: input.trim() ? "pointer" : "default",
                display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "background 0.15s",
              }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 19V5M5 12l7-7 7 7" /></svg>
              </button>
            )}
          </div>
        </div>
      </div>
      <div style={{ padding: "3px 20px 10px", textAlign: "center" }}>
        <p style={{ fontSize: 10, color: t.textSubtle }}>Always verify critical inspection findings independently.</p>
      </div>
    </div>
  );
}