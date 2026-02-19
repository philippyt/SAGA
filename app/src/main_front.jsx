import React, { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

const API_URL = "http://localhost:8000";
const APP_NAME = "Subsea Inspector";

function ImageGallery({ images, theme }) {
  const [selected, setSelected] = useState(null);
  if (!images || images.length === 0) return null;

  return (
    <>
      <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 8 }}>
        {images.map((img, i) => (
          <div key={i} onClick={() => setSelected(img)} style={{
            cursor: "pointer", borderRadius: 8, overflow: "hidden",
            border: `1px solid ${theme.border}`, position: "relative",
          }}>
            <img
              src={`${API_URL}/images/${img.path}`}
              alt={img.label}
              style={{ width: "100%", height: 100, objectFit: "cover", display: "block" }}
              onError={e => e.target.style.display = "none"}
            />
            <div style={{
              position: "absolute", bottom: 0, left: 0, right: 0,
              background: "rgba(0,0,0,0.7)", padding: "3px 6px",
              fontSize: 10, color: "#ccc", whiteSpace: "nowrap", overflow: "hidden",
            }}>{img.label}</div>
          </div>
        ))}
      </div>
      {selected && (
        <div onClick={() => setSelected(null)} style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)",
          display: "flex", alignItems: "center", justifyContent: "center",
          zIndex: 1000, cursor: "pointer",
        }}>
          <div style={{ maxWidth: "90vw", maxHeight: "90vh" }}>
            <img src={`${API_URL}/images/${selected.path}`} alt={selected.label}
              style={{ maxWidth: "100%", maxHeight: "85vh", borderRadius: 8 }} />
            <div style={{ color: "#fff", fontSize: 13, marginTop: 8, textAlign: "center" }}>
              {selected.label} — relevance: {selected.score}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function Message({ role, content, sources, images, theme }) {
  const isUser = role === "user";
  const [copied, setCopied] = useState(false);

  const copyText = () => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div style={{ maxWidth: 800, margin: "0 auto", padding: "0 24px" }}>
      <div style={{ display: "flex", gap: 12, alignItems: "flex-start", padding: "20px 0 4px" }}>
        {!isUser && (
          <div style={{
            width: 28, height: 28, borderRadius: "50%", flexShrink: 0,
            background: theme.accent, display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 14,
          }}>⚓</div>
        )}
        {isUser && <div style={{ width: 28, flexShrink: 0 }} />}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 13, fontWeight: 600,
            color: isUser ? theme.userName : theme.botName,
            marginBottom: 4, display: "flex", alignItems: "center", justifyContent: "space-between",
          }}>
            <span>{isUser ? "You" : APP_NAME}</span>
            {!isUser && content && (
              <button onClick={copyText} className="copy-btn" style={{
                background: "none", border: "none", cursor: "pointer",
                color: copied ? theme.accent : theme.textSubtle,
                fontSize: 11, fontFamily: "inherit", padding: "2px 6px",
                borderRadius: 4, display: "flex", alignItems: "center", gap: 4,
              }}>
                {copied ? "Copied" : "Copy"}
              </button>
            )}
          </div>
          <div style={{ fontSize: 15, lineHeight: 1.7, color: theme.text, wordBreak: "break-word" }}>
            {isUser ? (
              <span style={{ whiteSpace: "pre-wrap" }}>{content}</span>
            ) : (
              <div className="markdown-body">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
              </div>
            )}
          </div>
          {sources && sources.length > 0 && (
            <div style={{ marginTop: 10, display: "flex", flexWrap: "wrap", gap: 6 }}>
              {sources.map((s, i) => (
                <span key={i} style={{
                  fontSize: 11, padding: "2px 8px", borderRadius: 4,
                  background: theme.sourceBg, color: theme.sourceText,
                }}>{s}</span>
              ))}
            </div>
          )}
          {!isUser && <ImageGallery images={images} theme={theme} />}
        </div>
      </div>
    </div>
  );
}

export default function MainFront() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const scrollRef = useRef(null);
  const inputRef = useRef(null);
  const abortRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, loading, streaming]);

  const stop = () => {
    if (abortRef.current) { abortRef.current.abort(); abortRef.current = null; }
    setLoading(false);
    setStreaming(false);
  };

  const newChat = () => {
    stop();
    setMessages([]);
    setInput("");
    inputRef.current?.focus();
  };

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput("");
    if (inputRef.current) inputRef.current.style.height = "auto";
    setLoading(true);
    setStreaming(false);

    setMessages(prev => [...prev, { role: "user", content: text }]);
    setMessages(prev => [...prev, { role: "assistant", content: "", sources: [], images: [] }]);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch(`${API_URL}/chat/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: text }),
        signal: controller.signal,
      });
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      setStreaming(true);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const event = JSON.parse(line.slice(6));
            if (event.type === "token") {
              setMessages(prev => {
                const u = [...prev];
                const last = u[u.length - 1];
                if (last?.role === "assistant") u[u.length - 1] = { ...last, content: last.content + event.content };
                return u;
              });
            } else if (event.type === "done") {
              setMessages(prev => {
                const u = [...prev];
                const last = u[u.length - 1];
                if (last?.role === "assistant") u[u.length - 1] = {
                  ...last,
                  sources: event.sources || [],
                  images: event.images || [],
                };
                return u;
              });
            }
          } catch {}
        }
      }
    } catch (e) {
      if (e.name !== "AbortError") {
        setMessages(prev => {
          const u = [...prev];
          const last = u[u.length - 1];
          if (last?.role === "assistant" && !last.content) u[u.length - 1] = { ...last, content: "Could not connect to backend." };
          return u;
        });
      }
    } finally {
      abortRef.current = null;
      setLoading(false);
      setStreaming(false);
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
  };

  const suggestions = [
    "What are common subsea pipeline failure modes?",
    "Explain cathodic protection monitoring",
    "Show corrosion examples",
    "What is DNV-RP-F116?",
  ];

  const font = '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

  const t = {
    bg: "#0f1419", border: "#2a3038", card: "#1a2028", text: "#d1d5db",
    textMuted: "#8899a6", textSubtle: "#556677", accent: "#1d9bf0",
    inputBg: "#1a2028", inputBorder: "#2a3038", codeBg: "#161d26",
    sourceBg: "#1a2a3a", sourceText: "#4da3e0",
    userName: "#1d9bf0", botName: "#e0a060",
    btnBg: "#1d9bf0", btnDisabled: "#2a3038",
  };

  return (
    <div style={{
      position: "fixed", inset: 0, display: "flex", flexDirection: "column",
      background: t.bg, fontFamily: font,
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        textarea::placeholder { color: ${t.textSubtle}; }
        textarea:focus { outline: none; }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 3px; }
        .markdown-body p { margin: 0.5em 0; }
        .markdown-body p:first-child { margin-top: 0; }
        .markdown-body p:last-child { margin-bottom: 0; }
        .markdown-body strong { font-weight: 600; color: #fff; }
        .markdown-body h1, .markdown-body h2, .markdown-body h3 {
          font-weight: 600; color: #fff; margin: 0.8em 0 0.4em;
        }
        .markdown-body h1 { font-size: 1.3em; }
        .markdown-body h2 { font-size: 1.15em; }
        .markdown-body h3 { font-size: 1.05em; }
        .markdown-body ul, .markdown-body ol { margin: 0.4em 0; padding-left: 1.5em; }
        .markdown-body li { margin: 0.2em 0; }
        .markdown-body code {
          background: ${t.codeBg}; padding: 1px 5px; border-radius: 3px;
          font-family: 'Menlo', monospace; font-size: 0.9em;
        }
        .markdown-body pre {
          background: ${t.codeBg}; padding: 12px 16px; border-radius: 8px;
          overflow-x: auto; margin: 0.6em 0;
        }
        .markdown-body pre code { background: none; padding: 0; }
        .markdown-body table { border-collapse: collapse; width: 100%; margin: 0.6em 0; font-size: 0.9em; }
        .markdown-body th, .markdown-body td { border: 1px solid ${t.border}; padding: 6px 10px; text-align: left; }
        .markdown-body th { background: ${t.codeBg}; font-weight: 600; }
        .pill { transition: border-color 0.15s; }
        .pill:hover { border-color: ${t.accent} !important; color: #fff !important; }
        .copy-btn { opacity: 0.4; transition: opacity 0.15s; }
        .copy-btn:hover { opacity: 1; }
        @keyframes dotPulse { 0%, 80%, 100% { opacity: 0.2; } 40% { opacity: 1; } }
        .loading-dots::after { content: '...'; letter-spacing: 2px; animation: dotPulse 1.4s infinite; }
      `}</style>

      <div style={{
        padding: "10px 16px", borderBottom: `1px solid ${t.border}`,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        background: t.bg,
      }}>
        <button onClick={newChat} style={{
          background: "none", border: "none", color: t.textMuted,
          cursor: "pointer", padding: 6, borderRadius: 6,
          display: "flex", alignItems: "center",
        }} title="New chat">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M12 5v14M5 12h14"/></svg>
        </button>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 18 }}>⚓</span>
          <span style={{ fontSize: 15, fontWeight: 600, color: t.text }}>{APP_NAME}</span>
        </div>
        <div style={{ width: 30 }} />
      </div>

      <div ref={scrollRef} style={{ flex: 1, overflowY: "auto", paddingBottom: 24 }}>
        {messages.length === 0 && (
          <div style={{
            display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center",
            height: "100%", gap: 16,
          }}>
            <span style={{ fontSize: 48 }}>⚓</span>
            <div style={{ textAlign: "center" }}>
              <p style={{ fontSize: 18, fontWeight: 600, color: t.text }}>Subsea Inspection Assistant</p>
              <p style={{ fontSize: 13, color: t.textMuted, marginTop: 4 }}>
                Query inspection reports and search ROV imagery
              </p>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center", marginTop: 4, maxWidth: 520 }}>
              {suggestions.map((q, i) => (
                <button key={i} className="pill" onClick={() => { setInput(q); inputRef.current?.focus(); }} style={{
                  padding: "8px 16px", borderRadius: 20,
                  border: `1px solid ${t.border}`, background: "transparent",
                  color: t.textMuted, fontSize: 13, cursor: "pointer", fontFamily: font,
                }}>{q}</button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i}>
            <Message role={m.role} content={m.content} sources={m.sources} images={m.images} theme={t} />
            {i < messages.length - 1 && (
              <div style={{ maxWidth: 800, margin: "0 auto", padding: "0 24px" }}>
                <div style={{ borderBottom: `1px solid ${t.border}` }} />
              </div>
            )}
          </div>
        ))}

        {loading && !streaming && (
          <div style={{ maxWidth: 800, margin: "0 auto", padding: "20px 24px" }}>
            <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
              <span style={{ fontSize: 14 }}>⚓</span>
              <span className="loading-dots" style={{ fontSize: 15, color: t.textMuted }}>Searching reports and imagery</span>
            </div>
          </div>
        )}
      </div>

      <div style={{ padding: "12px 24px 12px", background: t.bg }}>
        <div style={{ maxWidth: 800, margin: "0 auto" }}>
          <div style={{
            display: "flex", alignItems: "flex-end", gap: 10,
            background: t.inputBg, border: `1px solid ${t.inputBorder}`,
            borderRadius: 24, padding: "6px 6px 6px 20px",
          }}>
            <textarea
              ref={inputRef} value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about subsea inspections..."
              rows={1}
              style={{
                flex: 1, resize: "none", border: "none", background: "transparent",
                color: t.text, fontSize: 15, fontFamily: font,
                padding: "8px 0", lineHeight: 1.5, minHeight: 24, maxHeight: 120,
              }}
              onInput={e => { e.target.style.height = "auto"; e.target.style.height = e.target.scrollHeight + "px"; }}
            />
            {loading ? (
              <button onClick={stop} style={{
                width: 36, height: 36, borderRadius: "50%", border: "none",
                background: "#c0392b", cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
              }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="#fff"><rect x="4" y="4" width="16" height="16" rx="2" /></svg>
              </button>
            ) : (
              <button onClick={send} disabled={!input.trim()} style={{
                width: 36, height: 36, borderRadius: "50%", border: "none",
                background: input.trim() ? t.btnBg : t.btnDisabled,
                cursor: input.trim() ? "pointer" : "default",
                display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
              }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 19V5M5 12l7-7 7 7" />
                </svg>
              </button>
            )}
          </div>
        </div>
      </div>

      <div style={{ padding: "6px 24px 14px", textAlign: "center", background: t.bg }}>
        <p style={{ fontSize: 11, color: t.textSubtle }}>
          May contain inaccuracies.
        </p>
      </div>
    </div>
  );
}