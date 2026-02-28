import React, { useState, useRef, useEffect, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

const API = "http://localhost:8000";

const themes = {
  dark: {
    sidebar: "#0a0a0e",
    bg: "#0f0f14",
    bgAlt: "#131318",
    border: "#1c1c26",
    text: "#f0f0f8",
    textMuted: "#9090b8",
    textSubtle: "#2a2a3c",
    accent: "#818cf8",
    accentDim: "rgba(129,140,248,0.07)",
    accentSoft: "rgba(129,140,248,0.13)",
    inputBg: "#131318",
    inputBorder: "#1c1c26",
    codeBg: "#0a0a0e",
    sourceBg: "rgba(129,140,248,0.09)",
    sourceText: "#a5b4fc",
    navActive: "rgba(129,140,248,0.1)",
    navText: "#5a5a7a",
    navActiveText: "#818cf8",
    success: "#4ade80",
  },
  light: {
    sidebar: "#f0f0f8",
    bg: "#f8f8fc",
    bgAlt: "#ffffff",
    border: "#e2e2ec",
    text: "#1a1a2e",
    textMuted: "#6b7280",
    textSubtle: "#c5c5d5",
    accent: "#6366f1",
    accentDim: "rgba(99,102,241,0.06)",
    accentSoft: "rgba(99,102,241,0.1)",
    inputBg: "#ffffff",
    inputBorder: "#e2e2ec",
    codeBg: "#f0f0f8",
    sourceBg: "rgba(99,102,241,0.07)",
    sourceText: "#4f46e5",
    navActive: "rgba(99,102,241,0.08)",
    navText: "#6b7280",
    navActiveText: "#6366f1",
    success: "#16a34a",
  },
};

const TOOL_META = {
  search_reports:  { verb: "Searching reports" },
  search_images:   { verb: "Searching images" },
  classify_defect: { verb: "Analyzing defects" },
  check_standard:  { verb: "Checking standards" },
};

const SEVERITY_COLORS = {
  minor:    "#4ade80",
  moderate: "#fbbf24",
  severe:   "#f97316",
  critical: "#ef4444",
};

const NAV = [
  { key: "agent",          label: "Agent",           mode: "chat" },
  { key: "image_library",  label: "Image Library",   mode: "image" },
  { key: "defect_analysis",label: "Defect Analysis", soon: true },
  { key: "standards",      label: "Standards",       soon: true },
  { key: "reports",        label: "Reports",         soon: true },
];

const F = '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

/* ── ToolSteps ── */
function ToolSteps({ steps, theme }) {
  const [open, setOpen] = useState(false);
  if (!steps?.length) return null;
  return (
    <div style={{ marginBottom: 10 }}>
      <button onClick={() => setOpen(v => !v)} style={{
        display: "flex", alignItems: "center", gap: 6, padding: "4px 10px",
        background: theme.accentDim, border: `1px solid ${theme.border}`,
        borderRadius: 5, cursor: "pointer", color: theme.textMuted,
        fontSize: 11, fontFamily: F,
      }}>
        <span style={{ color: theme.success, fontWeight: 700 }}>+</span>
        <span>{steps.length} tool{steps.length > 1 ? "s" : ""} used</span>
        <span style={{ fontSize: 9, opacity: 0.5, marginLeft: 2 }}>{open ? "^" : "v"}</span>
      </button>
      {open && (
        <div style={{ marginTop: 4, padding: "8px 12px", background: theme.accentDim, border: `1px solid ${theme.border}`, borderRadius: 5, fontSize: 12 }}>
          {steps.map((s, i) => {
            const m = TOOL_META[s.name] || { verb: s.name };
            return (
              <div key={i} style={{ padding: "3px 0", display: "flex", gap: 8, alignItems: "baseline", color: theme.textMuted }}>
                <span style={{ color: theme.textMuted, fontSize: 10, fontFamily: "'JetBrains Mono', monospace", minWidth: 18 }}>
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span style={{ fontWeight: 500 }}>{m.verb}</span>
                {s.input && (
                  <span style={{ color: theme.textMuted, fontSize: 11, fontFamily: "'JetBrains Mono', monospace", opacity: 0.7 }}>
                    {typeof s.input === "object" ? Object.values(s.input).join(", ").slice(0, 60) : ""}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ── ImageGallery ── */
function ImageGallery({ images, theme }) {
  const [sel, setSel] = useState(null);
  if (!images?.length) return null;
  const img = sel !== null ? images[sel] : null;
  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {images.map((im, i) => (
          <div key={i} onClick={() => setSel(sel === i ? null : i)} style={{
            width: 110, cursor: "pointer", borderRadius: 5, overflow: "hidden",
            border: `2px solid ${sel === i ? theme.accent : "transparent"}`,
            transition: "all 0.15s", flexShrink: 0,
            opacity: sel !== null && sel !== i ? 0.4 : 1,
          }}>
            <img
              src={`${API}/images/${im.path}`} alt={im.label}
              style={{ width: "100%", height: 76, objectFit: "cover", display: "block" }}
              onError={e => { e.target.style.display = "none"; }}
            />
            <div style={{ padding: "3px 6px", fontSize: 10, color: theme.textMuted, background: theme.codeBg, display: "flex", justifyContent: "space-between" }}>
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 72 }}>{im.label}</span>
              {im.score > 0 && <span style={{ color: theme.accent, fontWeight: 600, flexShrink: 0 }}>{im.score}%</span>}
            </div>
          </div>
        ))}
      </div>
      {img && (
        <div style={{ marginTop: 8, padding: 14, borderRadius: 7, background: theme.bgAlt, border: `1px solid ${theme.border}`, display: "flex", gap: 14, alignItems: "flex-start", position: "relative" }}>
          <button onClick={() => setSel(null)} style={{ position: "absolute", top: 8, right: 12, background: "none", border: "none", color: theme.textMuted, fontSize: 18, cursor: "pointer", lineHeight: 1 }}>x</button>
          <img src={`${API}/images/${img.path}`} alt={img.label} style={{ maxWidth: 300, maxHeight: 220, borderRadius: 5, objectFit: "contain" }} />
          <div style={{ flex: 1, minWidth: 0, fontSize: 13 }}>
            <div style={{ fontWeight: 600, color: theme.text, marginBottom: 4 }}>{img.label}</div>
            {img.score > 0 && <div style={{ color: theme.textMuted }}>Match: <span style={{ color: theme.accent, fontWeight: 600 }}>{img.score}%</span></div>}
            <div style={{ fontSize: 11, color: theme.textMuted, marginTop: 4, fontFamily: "'JetBrains Mono', monospace" }}>{img.path}</div>
            {img.width > 0 && <div style={{ fontSize: 11, color: theme.textMuted }}>{img.width} x {img.height} px</div>}
            <div style={{ marginTop: 8, display: "flex", gap: 6 }}>
              {sel > 0 && (
                <button onClick={e => { e.stopPropagation(); setSel(sel - 1); }} style={{ padding: "3px 10px", borderRadius: 4, border: `1px solid ${theme.border}`, background: "transparent", color: theme.textMuted, cursor: "pointer", fontSize: 11, fontFamily: F }}>Prev</button>
              )}
              {sel < images.length - 1 && (
                <button onClick={e => { e.stopPropagation(); setSel(sel + 1); }} style={{ padding: "3px 10px", borderRadius: 4, border: `1px solid ${theme.border}`, background: "transparent", color: theme.textMuted, cursor: "pointer", fontSize: 11, fontFamily: F }}>Next</button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── DefectCard ── */
function DefectCard({ result, theme }) {
  const sevColor = SEVERITY_COLORS[result.severity] || theme.accent;
  return (
    <div style={{ border: `1px solid ${theme.border}`, borderRadius: 7, overflow: "hidden", maxWidth: 440, marginTop: 8 }}>
      {result.imageUrl && (
        <img src={result.imageUrl} alt="uploaded" style={{ width: "100%", maxHeight: 180, objectFit: "cover", display: "block" }} />
      )}
      <div style={{ padding: "14px 16px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <span style={{ fontWeight: 600, fontSize: 13, color: theme.text }}>Defect Analysis</span>
          <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 9px", borderRadius: 4, background: `${sevColor}20`, color: sevColor, textTransform: "uppercase", letterSpacing: "0.06em" }}>
            {result.severity} {result.severity_prob}%
          </span>
        </div>
        <div style={{ marginBottom: 14 }}>
          {result.defects?.map((d, i) => (
            <div key={i} style={{ marginBottom: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                <span style={{ fontSize: 12, color: i === 0 ? theme.text : theme.textMuted }}>{d.type}</span>
                <span style={{ fontSize: 12, fontWeight: 600, color: i === 0 ? theme.accent : theme.textMuted, marginLeft: 8, flexShrink: 0 }}>{d.prob}%</span>
              </div>
              <div style={{ height: 2, background: theme.border, borderRadius: 2 }}>
                <div style={{ width: `${d.prob}%`, height: "100%", background: i === 0 ? theme.accent : theme.border, borderRadius: 2, transition: "width 0.5s" }} />
              </div>
            </div>
          ))}
        </div>
        <div style={{ fontSize: 12, borderTop: `1px solid ${theme.border}`, paddingTop: 10, color: theme.textMuted }}>
          <span style={{ fontWeight: 600, color: sevColor }}>Action: </span>{result.recommendation}
        </div>
        <div style={{ fontSize: 10, color: theme.textMuted, marginTop: 6 }}>
          {result.filename} - verify with qualified engineer
        </div>
      </div>
    </div>
  );
}

/* ── FeedbackButtons ── */
function FeedbackButtons({ msg, theme, sessionId }) {
  const [rating, setRating] = useState(null);
  const submit = async (r) => {
    if (rating !== null) return;
    setRating(r);
    try {
      await fetch(`${API}/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: sessionId, question: msg.question || "", rating: r }),
      });
    } catch {}
  };
  return (
    <div className="feedback-btns" style={{ display: "inline-flex", gap: 4, marginTop: 8 }}>
      {[1, -1].map(r => (
        <button key={r} onClick={() => submit(r)} title={r === 1 ? "Helpful" : "Not helpful"} style={{
          background: "none", border: `1px solid ${theme.border}`, cursor: rating !== null ? "default" : "pointer",
          padding: "2px 8px", borderRadius: 4, fontSize: 11, fontFamily: F,
          color: rating === r ? (r === 1 ? theme.success : "#ef4444") : theme.textMuted,
          opacity: rating !== null && rating !== r ? 0.25 : 1,
          transition: "color 0.15s, opacity 0.15s",
        }}>
          {r === 1 ? "Helpful" : "Not helpful"}
        </button>
      ))}
    </div>
  );
}

/* ── FollowUps ── */
function FollowUps({ questions, theme, onAsk }) {
  if (!questions?.length) return null;
  return (
    <div style={{ marginTop: 12, display: "flex", gap: 6, flexWrap: "wrap" }}>
      {questions.map((q, i) => (
        <button key={i} onClick={() => onAsk(q)} style={{
          fontSize: 12, padding: "5px 12px", borderRadius: 4,
          border: `1px solid ${theme.border}`, background: "transparent",
          color: theme.textMuted, cursor: "pointer", fontFamily: F,
          transition: "all 0.15s",
        }}
          onMouseEnter={e => { e.target.style.borderColor = theme.accent; e.target.style.color = theme.text; }}
          onMouseLeave={e => { e.target.style.borderColor = theme.border; e.target.style.color = theme.textMuted; }}
        >{q}</button>
      ))}
    </div>
  );
}

/* ── Message ── */
function Message({ msg, theme, onAsk, sessionId }) {
  const { role, content, sources, images, related, toolCalls, type, result } = msg;
  const [copied, setCopied] = useState(false);

  if (role === "user") {
    return (
      <div style={{ padding: "10px 28px" }}>
        <div style={{ fontSize: 10, fontWeight: 600, color: theme.textMuted, marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.08em" }}>You</div>
        <div style={{ fontSize: 15, lineHeight: 1.65, color: theme.text, whiteSpace: "pre-wrap" }}>
          {content?.replace(/\s*\(include relevant inspection images\)/g, "")}
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: "10px 28px 16px", borderTop: `1px solid ${theme.border}` }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
        <span style={{ fontSize: 10, fontWeight: 700, color: theme.accent, textTransform: "uppercase", letterSpacing: "0.08em" }}>SAGA</span>
        {content && (
          <button
            onClick={() => { navigator.clipboard.writeText(content); setCopied(true); setTimeout(() => setCopied(false), 1200); }}
            className="copy-btn"
            style={{ background: "none", border: "none", cursor: "pointer", color: copied ? theme.success : theme.textMuted, fontSize: 11, fontFamily: F, marginLeft: "auto", padding: "1px 4px" }}
          >
            {copied ? "Copied" : "Copy"}
          </button>
        )}
      </div>

      <ToolSteps steps={toolCalls} theme={theme} />

      {type === "defect_analysis" && result && <DefectCard result={result} theme={theme} />}

      {content && (
        <div style={{ fontSize: 15, lineHeight: 1.75, color: theme.text, wordBreak: "break-word" }}>
          <div className="md">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {content
                ?.replace(/\[IMAGE:\s*[^\]]+\]/g, "")
                .replace(/ {2,}/g, " ")
                .replace(/ +([,.\;\:])/g, "$1")
                .replace(/([,.\;\:])\s*\1+/g, "$1")
                .replace(/\(\s*\)/g, "")
                .trim()}
            </ReactMarkdown>
          </div>
        </div>
      )}

      {sources?.length > 0 && (
        <div style={{ marginTop: 10, display: "flex", flexWrap: "wrap", gap: 4 }}>
          {sources.map((s, i) => (
            <span key={i} style={{ fontSize: 11, padding: "2px 7px", borderRadius: 3, background: theme.sourceBg, color: theme.sourceText, fontFamily: "'JetBrains Mono', monospace" }}>{s}</span>
          ))}
        </div>
      )}

      {images?.length > 0 && <ImageGallery images={images} theme={theme} />}
      <FollowUps questions={related} theme={theme} onAsk={onAsk} />

      {type !== "defect_analysis" && content && (
        <FeedbackButtons msg={msg} theme={theme} sessionId={sessionId} />
      )}
    </div>
  );
}

/* ── StatusIndicator ── */
function StatusIndicator({ text, theme }) {
  return (
    <div style={{ padding: "10px 28px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
          {[0, 1, 2].map(i => (
            <div key={i} className={`dot dot-${i}`} style={{ width: 5, height: 5, borderRadius: "50%", background: theme.accent }} />
          ))}
        </div>
        <span style={{ fontSize: 12, color: theme.textMuted }}>{text}</span>
      </div>
    </div>
  );
}

/* ── Sidebar ── */
function Sidebar({ theme, dark, setDark, mode, switchMode, newChat, imageUploadRef, reportUploadRef, onClearCache }) {
  const sideBtn = (label, onClick) => (
    <button onClick={onClick} style={{
      display: "flex", alignItems: "center", width: "100%", padding: "7px 10px",
      border: "none", background: "transparent", color: theme.navText, fontSize: 12,
      fontFamily: F, cursor: "pointer", textAlign: "left", borderRadius: 5,
      transition: "all 0.12s",
    }}
      onMouseEnter={e => { e.currentTarget.style.background = theme.accentDim; e.currentTarget.style.color = theme.text; }}
      onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = theme.navText; }}
    >{label}</button>
  );

  return (
    <div style={{ width: 220, flexShrink: 0, background: theme.sidebar, borderRight: `1px solid ${theme.border}`, display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={{ padding: "20px 16px 16px", borderBottom: `1px solid ${theme.border}` }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: theme.text, letterSpacing: "0.04em" }}>SAGA</div>
        <div style={{ fontSize: 11, color: theme.navText, marginTop: 2 }}>Subsea Agent</div>
      </div>

      <div style={{ flex: 1, padding: "10px 8px", overflowY: "auto" }}>
        <div style={{ fontSize: 10, fontWeight: 600, color: theme.navText, padding: "4px 8px 6px", textTransform: "uppercase", letterSpacing: "0.06em" }}>Modules</div>
        {NAV.map(item => {
          const isActive = !item.soon && item.mode === mode;
          return (
            <button key={item.key} onClick={() => { if (!item.soon) switchMode(item.mode); }} style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              width: "100%", padding: "7px 10px", border: "none", borderRadius: 5,
              background: isActive ? theme.navActive : "transparent",
              color: isActive ? theme.navActiveText : (item.soon ? theme.textSubtle : theme.navText),
              fontSize: 13, fontFamily: F, cursor: item.soon ? "default" : "pointer",
              textAlign: "left", transition: "all 0.12s",
            }}
              onMouseEnter={e => { if (!item.soon && !isActive) { e.currentTarget.style.background = theme.accentDim; e.currentTarget.style.color = theme.text; } }}
              onMouseLeave={e => { if (!item.soon && !isActive) { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = theme.navText; } }}
            >
              <span>{item.label}</span>
              {item.soon && (
                <span style={{ fontSize: 9, padding: "1px 5px", borderRadius: 3, background: theme.accentDim, color: theme.navText, fontWeight: 600 }}>SOON</span>
              )}
            </button>
          );
        })}
      </div>

      <div style={{ padding: "10px 8px", borderTop: `1px solid ${theme.border}`, display: "flex", flexDirection: "column", gap: 1 }}>
        {sideBtn("New conversation", newChat)}
        {sideBtn("Analyze image", () => imageUploadRef.current?.click())}
        {sideBtn("Upload report", () => reportUploadRef.current?.click())}
        <div style={{ height: 1, background: theme.border, margin: "4px 2px" }} />
        {sideBtn(dark ? "Light mode" : "Dark mode", () => setDark(d => !d))}
        {sideBtn("Clear cache", onClearCache)}
      </div>
    </div>
  );
}

/* ── App ── */
export default function App() {
  const [msgs, setMsgs] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [mode, setMode] = useState("chat");
  const [dark, setDark] = useState(true);
  const [status, setStatus] = useState(null);
  const [wantImages, setWantImages] = useState(false);
  const [sessionId] = useState(() => `s_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`);
  const scrollRef = useRef(null);
  const inputRef = useRef(null);
  const abortRef = useRef(null);
  const toolsRef = useRef([]);
  const imageUploadRef = useRef(null);
  const reportUploadRef = useRef(null);
  const t = dark ? themes.dark : themes.light;

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [msgs, loading, streaming, status]);

  const stop = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    setLoading(false);
    setStreaming(false);
    setStatus(null);
  };

  const newChat = () => {
    stop();
    setMsgs([]);
    setInput("");
    inputRef.current?.focus();
  };

  const switchMode = (newMode) => {
    if (newMode === mode) return;
    stop();
    setMode(newMode);
    setMsgs([]);
    setInput("");
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const imageUrl = URL.createObjectURL(file);
    setLoading(true);
    setStatus("Analyzing image");
    setMsgs(prev => [...prev, { role: "user", content: `Uploaded: ${file.name}` }]);
    const formData = new FormData();
    formData.append("file", file);
    try {
      const res = await fetch(`${API}/upload/image`, { method: "POST", body: formData });
      const result = await res.json();
      if (result.error) {
        setMsgs(prev => [...prev, { role: "assistant", content: `Analysis failed: ${result.error}`, sources: [], images: [], related: [], toolCalls: [] }]);
      } else {
        setMsgs(prev => [...prev, { role: "assistant", type: "defect_analysis", content: "", result: { ...result, imageUrl }, sources: [], images: [], related: [], toolCalls: [] }]);
      }
    } catch {
      setMsgs(prev => [...prev, { role: "assistant", content: "Could not reach backend.", sources: [], images: [], related: [], toolCalls: [] }]);
    }
    setLoading(false);
    setStatus(null);
    e.target.value = "";
  };

  const handleReportUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setStatus(`Ingesting ${file.name}...`);
    const formData = new FormData();
    formData.append("file", file);
    try {
      const res = await fetch(`${API}/upload/report`, { method: "POST", body: formData });
      const data = await res.json();
      if (data.error) {
        setMsgs(prev => [...prev, { role: "assistant", content: `Upload failed: ${data.error}`, sources: [], images: [], related: [], toolCalls: [] }]);
      } else {
        setMsgs(prev => [...prev, { role: "assistant", content: `Report ingested: **${data.filename}** — ${data.chunks_added} chunks added.`, sources: [], images: [], related: [], toolCalls: [] }]);
      }
    } catch {
      setMsgs(prev => [...prev, { role: "assistant", content: "Report upload failed.", sources: [], images: [], related: [], toolCalls: [] }]);
    }
    setStatus(null);
    e.target.value = "";
  };

  const send = useCallback(async (overrideText) => {
    const text = (overrideText || input).trim();
    if (!text || loading) return;
    setInput("");
    if (inputRef.current) inputRef.current.style.height = "auto";
    setLoading(true);
    setStreaming(false);

    if (mode === "image") {
      setStatus("Searching images");
      setMsgs(prev => [...prev, { role: "user", content: text }]);
      try {
        const res = await fetch(`${API}/search/images`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query: text, k: 20 }),
        });
        const data = await res.json();
        setMsgs(prev => [...prev, { role: "assistant", content: "", images: data.images || [], sources: [], related: [], toolCalls: [] }]);
      } catch {
        setMsgs(prev => [...prev, { role: "assistant", content: "Could not reach backend.", images: [], sources: [], related: [], toolCalls: [] }]);
      }
      setLoading(false);
      setStatus(null);
      inputRef.current?.focus();
      return;
    }

    setStatus("Planning...");
    toolsRef.current = [];
    const displayText = text.replace(/\s*\(include relevant inspection images\)/g, "");
    const includeImages = wantImages;
    const queryText = includeImages ? text + " (include relevant inspection images)" : text;
    setWantImages(false);
    setMsgs(prev => [...prev, { role: "user", content: displayText }]);
    setMsgs(prev => [...prev, { role: "assistant", content: "", sources: [], images: [], related: [], toolCalls: [], question: displayText }]);

    const ctrl = new AbortController();
    abortRef.current = ctrl;
    try {
      const res = await fetch(`${API}/chat/stream`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: queryText, session_id: sessionId, use_agent: true, use_images: includeImages }),
        signal: ctrl.signal,
      });
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() || "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const ev = JSON.parse(line.slice(6));
            if (ev.type === "thinking") {
              setStatus(ev.content || "Thinking");
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
              setMsgs(prev => {
                const u = [...prev];
                const l = u[u.length - 1];
                if (l?.role === "assistant") u[u.length - 1] = { ...l, content: l.content + ev.content, toolCalls: [...toolsRef.current] };
                return u;
              });
            } else if (ev.type === "done") {
              setStatus(null);
              setMsgs(prev => {
                const u = [...prev];
                const l = u[u.length - 1];
                if (l?.role === "assistant") u[u.length - 1] = { ...l, sources: ev.sources || [], images: ev.images || [], related: ev.related || [], toolCalls: [...toolsRef.current] };
                return u;
              });
            }
          } catch {}
        }
      }
    } catch (e) {
      if (e.name !== "AbortError") {
        setMsgs(prev => {
          const u = [...prev];
          const l = u[u.length - 1];
          if (l?.role === "assistant" && !l.content) u[u.length - 1] = { ...l, content: "Could not connect to backend." };
          return u;
        });
      }
    }
    abortRef.current = null;
    setLoading(false);
    setStreaming(false);
    setStatus(null);
    inputRef.current?.focus();
  }, [input, loading, mode, wantImages, sessionId]);

  const onKey = (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } };

  const SUGGESTIONS = mode === "image"
    ? ["subsea pipeline corrosion", "marine growth fouling", "anode depletion", "coating damage", "freespan", "weld defect"]
    : ["Analyze corrosion types across inspection reports", "Show marine growth inspection guidance", "What are freespan acceptance criteria per DNV-RP-F116?"];

  return (
    <div style={{ position: "fixed", inset: 0, display: "flex", flexDirection: "row", fontFamily: F, background: t.bg, transition: "background 0.2s" }}>
      <input type="file" accept="image/*" ref={imageUploadRef} onChange={handleImageUpload} style={{ display: "none" }} />
      <input type="file" accept=".pdf" ref={reportUploadRef} onChange={handleReportUpload} style={{ display: "none" }} />

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        textarea::placeholder { color: ${t.navText}; }
        textarea:focus { outline: none; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: ${t.border}; border-radius: 2px; }
        .md p { margin: 0.7em 0; }
        .md p:first-child { margin-top: 0; }
        .md p:last-child { margin-bottom: 0; }
        .md strong { font-weight: 600; color: ${dark ? "#ffffff" : "#111"}; }
        .md h1, .md h2, .md h3 { font-weight: 600; color: ${dark ? "#ffffff" : "#111"}; margin: 1em 0 0.4em; line-height: 1.3; }
        .md h1 { font-size: 1.15em; }
        .md h2 { font-size: 1.05em; }
        .md h3 { font-size: 1em; }
        .md ul, .md ol { margin: 0.4em 0; padding-left: 1.6em; }
        .md li { margin: 0.25em 0; }
        .md code { background: ${t.codeBg}; padding: 1px 5px; border-radius: 3px; font-family: 'JetBrains Mono', monospace; font-size: 0.84em; }
        .md pre { background: ${t.codeBg}; padding: 12px 14px; border-radius: 6px; overflow-x: auto; margin: 0.6em 0; }
        .md pre code { background: none; padding: 0; }
        .md table { border-collapse: collapse; width: 100%; margin: 0.6em 0; font-size: 0.9em; }
        .md th, .md td { border: 1px solid ${t.border}; padding: 6px 10px; text-align: left; }
        .md th { background: ${t.codeBg}; font-weight: 600; }
        .copy-btn { opacity: 0; transition: opacity 0.15s; }
        div:hover .copy-btn { opacity: 0.5; }
        .copy-btn:hover { opacity: 1 !important; }
        .feedback-btns { opacity: 0; transition: opacity 0.15s; }
        div:hover .feedback-btns { opacity: 1; }
        @keyframes dotPulse { 0%, 80%, 100% { transform: scale(0.55); opacity: 0.35; } 40% { transform: scale(1); opacity: 1; } }
        .dot-0 { animation: dotPulse 1.2s ease-in-out infinite 0s; }
        .dot-1 { animation: dotPulse 1.2s ease-in-out infinite 0.2s; }
        .dot-2 { animation: dotPulse 1.2s ease-in-out infinite 0.4s; }
      `}</style>

      <Sidebar
        theme={t} dark={dark} setDark={setDark}
        mode={mode} switchMode={switchMode} newChat={newChat}
        imageUploadRef={imageUploadRef} reportUploadRef={reportUploadRef}
        onClearCache={() => { try { fetch(`${API}/clear-cache`); } catch {} }}
      />

      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        {/* Top bar */}
        <div style={{ height: 44, borderBottom: `1px solid ${t.border}`, display: "flex", alignItems: "center", padding: "0 28px", gap: 10, flexShrink: 0 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: t.text }}>
            {mode === "image" ? "Image Library" : "Agent"}
          </span>
          {wantImages && mode === "chat" && (
            <span style={{ fontSize: 10, padding: "2px 7px", borderRadius: 3, background: t.accentDim, color: t.accent, fontWeight: 600 }}>WITH IMAGES</span>
          )}
        </div>

        {/* Messages */}
        <div ref={scrollRef} style={{ flex: 1, overflowY: "auto", paddingBottom: 20 }}>
          {msgs.length === 0 && (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", padding: "40px 28px", textAlign: "center" }}>
              <div style={{ maxWidth: 520 }}>
                <div style={{ fontSize: 20, fontWeight: 700, color: t.text, marginBottom: 6 }}>
                  {mode === "image" ? "Image Library" : "Agent"}
                </div>
                <div style={{ fontSize: 14, color: t.textMuted, marginBottom: 28, lineHeight: 1.55 }}>
                  {mode === "image"
                    ? "Search ROV imagery and inspection photos by visual description."
                    : "Ask questions about inspection reports, defects, standards, and findings."}
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, justifyContent: "center" }}>
                  {SUGGESTIONS.map((q, i) => (
                    <button key={i} onClick={() => { setInput(q); inputRef.current?.focus(); }} style={{
                      padding: "7px 14px", borderRadius: 5, border: `1px solid ${t.border}`,
                      background: "transparent", color: t.textMuted, fontSize: 13,
                      cursor: "pointer", fontFamily: F, transition: "all 0.15s",
                    }}
                      onMouseEnter={e => { e.target.style.borderColor = t.accent; e.target.style.color = t.text; }}
                      onMouseLeave={e => { e.target.style.borderColor = t.border; e.target.style.color = t.textMuted; }}
                    >{q}</button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {msgs.map((m, i) => (
            <div key={i} style={{ marginTop: i === 0 ? 8 : 0 }}>
              <Message msg={m} theme={t} onAsk={q => send(q)} sessionId={sessionId} />
            </div>
          ))}

          {loading && status && <StatusIndicator text={status} theme={t} />}
        </div>

        {/* Input */}
        <div style={{ padding: "10px 20px 4px", flexShrink: 0 }}>
          <div style={{ maxWidth: 780, margin: "0 auto" }}>
            <div style={{
              display: "flex", alignItems: "flex-end", gap: 6,
              background: t.inputBg, border: `1px solid ${t.inputBorder}`,
              borderRadius: 8, padding: "6px 6px 6px 14px", transition: "border-color 0.2s",
            }}
              onFocusCapture={e => e.currentTarget.style.borderColor = t.accent}
              onBlurCapture={e => e.currentTarget.style.borderColor = t.inputBorder}
            >
              <textarea
                ref={inputRef} value={input}
                onChange={e => setInput(e.target.value)} onKeyDown={onKey}
                placeholder={mode === "image" ? "Describe what you're looking for..." : "Ask about subsea inspections..."}
                rows={1} style={{
                  flex: 1, resize: "none", border: "none", background: "transparent",
                  color: t.text, fontSize: 14, fontFamily: F, padding: "7px 0",
                  lineHeight: 1.55, minHeight: 28, maxHeight: 130,
                }}
                onInput={e => { e.target.style.height = "auto"; e.target.style.height = e.target.scrollHeight + "px"; }}
              />

              {mode === "chat" && (
                <button
                  onClick={() => setWantImages(v => !v)}
                  title={wantImages ? "Remove images from response" : "Include images in response"}
                  style={{
                    width: 32, height: 32, borderRadius: 5,
                    border: wantImages ? `1px solid ${t.accent}` : `1px solid transparent`,
                    background: wantImages ? t.accentSoft : "transparent",
                    cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                    flexShrink: 0, transition: "all 0.15s",
                  }}
                  onMouseEnter={e => { if (!wantImages) e.currentTarget.style.borderColor = t.border; }}
                  onMouseLeave={e => { if (!wantImages) e.currentTarget.style.borderColor = "transparent"; }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={wantImages ? t.accent : t.navText} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                    <circle cx="12" cy="12" r="3"/>
                  </svg>
                </button>
              )}

              {loading ? (
                <button onClick={stop} style={{ width: 32, height: 32, borderRadius: 5, border: "none", background: "#ef4444", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="#fff"><rect x="5" y="5" width="14" height="14" rx="2" /></svg>
                </button>
              ) : (
                <button onClick={() => send()} disabled={!input.trim()} style={{
                  width: 32, height: 32, borderRadius: 5, border: "none",
                  background: input.trim() ? t.accent : t.border,
                  cursor: input.trim() ? "pointer" : "default",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  flexShrink: 0, transition: "background 0.15s",
                }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 19V5M5 12l7-7 7 7" />
                  </svg>
                </button>
              )}
            </div>
          </div>
        </div>
        <div style={{ padding: "3px 20px 10px", textAlign: "center" }}>
          <p style={{ fontSize: 10, color: t.textSubtle }}>Always verify critical inspection findings independently.</p>
        </div>
      </div>
    </div>
  );
}
