from __future__ import annotations
from pathlib import Path
import re as _re
import re
from langchain_anthropic import ChatAnthropic
from langchain_core.messages import SystemMessage, HumanMessage, AIMessage, ToolMessage
from langchain_core.tools import tool
from clip_index import search_images as clip_search
from pipeline import retrieve, build_context_block
from config import (
    ANTHROPIC_API_KEY,
    CLAUDE_MODEL,
    LLM_TEMPERATURE,
    PROMPT_FILE,
)

_store = None
_llm_with_tools = None
_llm_streaming = None
_system_prompt = ""

@tool
def search_reports(query: str) -> str:
    """Search inspection reports and technical documents for information about subsea pipelines, corrosion, standards, maintenance procedures, and inspection findings."""
    if _store is None:
        return "No report database available."
    docs = retrieve(_store, query, rerank=True)
    if not docs:
        return "No relevant report sections found."
    context = build_context_block(docs)
    sources = [d["source_label"] for d in docs]
    return f"Sources: {', '.join(sources)}\n\n{context}"

@tool
def search_images(query: str, num_results: int = 8) -> str:
    """Search the inspection image database using CLIP visual similarity. Use when the user wants images, visual examples, or when visual evidence supports the answer."""
    results = clip_search(query, k=num_results)
    if not results:
        return "No relevant images found."
    lines = []
    for i, img in enumerate(results):
        lines.append(f"{i+1}. [{img['score']}%] {img['label']} — path: {img['path']}")
    return f"Found {len(results)} images:\n" + "\n".join(lines) + "\n\nReference the most relevant image paths in your answer using [IMAGE: path] tags."

@tool
def classify_defect(image_path: str) -> str:
    """Classify the type and severity of a defect in an inspection image using CLIP zero-shot classification. Provide an image path from search_images results."""
    from clip_index import _load_clip
    from PIL import Image
    from config import IMAGES_DIR
    import numpy as np

    full_path = Path(IMAGES_DIR) / image_path
    if not full_path.exists():
        for p in Path(IMAGES_DIR).rglob(Path(image_path).name):
            full_path = p
            break
    if not full_path.exists():
        return f"Image not found: {image_path}"

    model, processor = _load_clip()
    img = Image.open(full_path).convert("RGB")

    defect_types = [
        "external corrosion on metal surface",
        "internal corrosion damage",
        "microbiologically influenced corrosion (MIC)",
        "coating disbondment and damage",
        "crack or fracture in weld or base metal",
        "dent or mechanical impact damage",
        "marine growth and biofouling",
        "anode depletion and cathodic protection loss",
        "pipeline freespan over seabed",
        "scour and seabed erosion",
        "no visible defects, clean surface",
    ]

    inputs = processor(text=defect_types, images=img, return_tensors="pt", padding=True, truncation=True)
    outputs = model(**inputs)
    logits = outputs.logits_per_image.detach().numpy().flatten()
    exp_logits = np.exp(logits - logits.max())
    probs = exp_logits / exp_logits.sum()
    ranked = sorted(zip(defect_types, probs), key=lambda x: x[1], reverse=True)

    severity_labels = [
        "minor surface defect requiring monitoring only",
        "moderate defect requiring repair within 12 months",
        "severe defect requiring immediate engineering assessment",
        "critical defect requiring immediate shutdown and repair",
    ]
    sev_inputs = processor(text=severity_labels, images=img, return_tensors="pt", padding=True, truncation=True)
    sev_outputs = model(**sev_inputs)
    sev_logits = sev_outputs.logits_per_image.detach().numpy().flatten()
    sev_exp = np.exp(sev_logits - sev_logits.max())
    sev_probs = sev_exp / sev_exp.sum()
    sev_ranked = sorted(zip(severity_labels, sev_probs), key=lambda x: x[1], reverse=True)

    report = f"DEFECT ANALYSIS: {image_path}\n\n"
    report += "Defect Classification:\n"
    for dtype, prob in ranked[:3]:
        report += f"  {prob*100:.0f}% — {dtype}\n"
    report += f"\nSeverity Assessment:\n"
    for sev, prob in sev_ranked[:2]:
        report += f"  {prob*100:.0f}% — {sev}\n"
    report += f"\nPrimary finding: {ranked[0][0]}\nEstimated severity: {sev_ranked[0][0]}"
    return report

@tool
def check_standard(defect_type: str, standard: str = "DNV-RP-F116") -> str:
    """Look up acceptance criteria for a defect type according to industry standards. Use after classify_defect for actionable recommendations."""
    if _store is None:
        return "No standards database available."
    query = f"{defect_type} acceptance criteria {standard} recommended action"
    docs = retrieve(_store, query, rerank=True)
    if not docs:
        return f"No specific {standard} guidance found for '{defect_type}'."
    context = build_context_block(docs)
    sources = [d["source_label"] for d in docs]
    return f"Standards reference ({', '.join(sources)}):\n\n{context}"


ALL_TOOLS = [search_reports, search_images, classify_defect, check_standard]
TOOL_MAP = {t.name: t for t in ALL_TOOLS}

def _load_agent_prompt() -> str:
    path = Path(PROMPT_FILE)
    base = path.read_text(encoding="utf-8") if path.exists() else ""
    return base + """

AGENT BEHAVIOR
You have access to tools. ALWAYS use tools before answering — never guess.

Tools:
- search_reports: Search PDF reports/standards. Use for any technical question.
- search_images: CLIP visual search. Use when user wants images or visual evidence.
- classify_defect: Analyze a specific image. Requires image_path from search_images.
- check_standard: Look up acceptance criteria. Use after identifying a defect.

TOOL CHAINING — chain tools for complex queries:
1. "Analyze corrosion" → search_images → classify_defect → check_standard → synthesize
2. "Acceptance criteria for freespan" → search_reports → check_standard
3. "Show coating damage" → search_images → describe

IMAGE SELECTION
When search_images returns results, choose 2-4 most relevant images.
Place image references on their OWN LINE, never inline with text:

Good: "External corrosion is visible on the pipeline surface.\n[IMAGE: corrosion/abc.jpg]"
Bad: "External corrosion is visible [IMAGE: corrosion/abc.jpg] on the pipeline surface."

Never put IMAGE tags next to commas, periods, or conjunctions.

Keep responses concise (200-300 words). Reference sources. Be direct.
"""

def init_agent(store, llm_instance=None):
    global _store, _llm_with_tools, _llm_streaming, _system_prompt
    _store = store
    _system_prompt = _load_agent_prompt()

    if not ANTHROPIC_API_KEY:
        raise ValueError("ANTHROPIC_API_KEY is not set.")

    base_llm = ChatAnthropic(
        model=CLAUDE_MODEL,
        anthropic_api_key=ANTHROPIC_API_KEY,
        temperature=LLM_TEMPERATURE,
        max_tokens=2048,
    )
    _llm_with_tools = base_llm.bind_tools(ALL_TOOLS)

    _llm_streaming = ChatAnthropic(
        model=CLAUDE_MODEL,
        anthropic_api_key=ANTHROPIC_API_KEY,
        temperature=LLM_TEMPERATURE,
        max_tokens=1024,
        streaming=True,
    )
    return _llm_with_tools

def run_agent_turn(question: str, history: list[dict] = None, max_iterations: int = 3):
    if _llm_with_tools is None:
        yield {"type": "token", "content": "Agent not initialized."}
        yield {"type": "done", "sources": [], "images": [], "related": []}
        return

    messages = [SystemMessage(content=_system_prompt)]
    if history:
        for h in history[-10:]:
            cls = HumanMessage if h["role"] == "user" else AIMessage
            messages.append(cls(content=h["content"]))
    messages.append(HumanMessage(content=question))

    collected_sources = []
    collected_images = []
    tools_used = False

    yield {"type": "thinking", "content": "Planning approach..."}
    for iteration in range(max_iterations):
        response = _llm_with_tools.invoke(messages)
        messages.append(response)

        if not response.tool_calls:
            if not tools_used:
                messages.pop()
                yield {"type": "tool_call", "name": "search_reports", "input": {"query": question}}
                try:
                    result = search_reports.invoke({"query": question})
                except Exception as e:
                    result = f"Tool error: {str(e)}"
                yield {
                    "type": "tool_result",
                    "name": "search_reports",
                    "content": result[:200] + "..." if len(result) > 200 else result,
                }
                if "Sources:" in result:
                    src_line = result.split("\n")[0].replace("Sources: ", "")
                    collected_sources.extend([s.strip() for s in src_line.split(",")])
                messages.append(HumanMessage(
                    content=f"Here are relevant report sections:\n\n{result}\n\nNow answer the original question based on this information."
                ))
                tools_used = True
                continue
            else:
                messages.pop()
                break

        tools_used = True
        for tc in response.tool_calls:
            tool_name = tc["name"]
            tool_args = tc["args"]
            tool_id = tc["id"]

            yield {"type": "tool_call", "name": tool_name, "input": tool_args}

            if tool_name in TOOL_MAP:
                try:
                    result = TOOL_MAP[tool_name].invoke(tool_args)
                except Exception as e:
                    result = f"Tool error: {str(e)}"
            else:
                result = f"Unknown tool: {tool_name}"

            yield {
                "type": "tool_result",
                "name": tool_name,
                "content": result[:200] + "..." if len(result) > 200 else result,
            }

            if tool_name == "search_reports" and "Sources:" in result:
                src_line = result.split("\n")[0].replace("Sources: ", "")
                collected_sources.extend([s.strip() for s in src_line.split(",")])
            elif tool_name == "search_images":
                imgs = clip_search(tool_args.get("query", question), k=tool_args.get("num_results", 8))
                collected_images.extend(imgs)

            messages.append(ToolMessage(content=result, tool_call_id=tool_id))

    yield {"type": "thinking", "content": "Synthesizing answer..."}

    if tools_used:
        messages.append(HumanMessage(
            content="Based on the tool results above, provide a comprehensive answer. "
                    "If exact data isn't available, state what IS available and what further inspection is needed. "
                    "Never say 'I need to search' - you already searched."
        ))

    final_text = ""
    try:
        for chunk in _llm_streaming.stream(messages):
            token = chunk.content
            if isinstance(token, str) and token:
                final_text += token
                yield {"type": "token", "content": token}
    except Exception as e:
        final_text = f"Error: {str(e)}"
        yield {"type": "token", "content": final_text}
    related = []
    try:
        result = _llm_streaming.invoke([
            SystemMessage(content=(
                "Output exactly 3 follow-up questions a subsea engineer might ask about this topic. "
                "Rules: one per line, no numbering, no bullets, no headers, no markdown. "
                "Never use 'you' or 'your' — questions must be about the technical subject. "
                "Max 10 words each."
            )),
            HumanMessage(content=f"Topic: {question}\nContext: {final_text[:300]}"),
        ])
        lines = [l.strip() for l in result.content.strip().split("\n") if l.strip()]
        clean = []
        for l in lines:
            if l.startswith("#") or l.startswith("*") or l.startswith("-"):
                continue
            l = _re.sub(r"^\d+[\.\)]\s*", "", l).strip()
            if _re.search(r'\byou(r|rs)?\b', l, _re.IGNORECASE):
                continue
            if l and len(l) > 5 and l.endswith("?"):
                clean.append(l)
        related = clean[:3]
    except:
        pass
    picked_paths = re.findall(r'\[IMAGE:\s*([^\]]+)\]', final_text)
    picked_images = []
    img_lookup = {img["path"]: img for img in collected_images}
    for p in picked_paths:
        p = p.strip()
        if p in img_lookup:
            picked_images.append(img_lookup[p])
        else:
            picked_images.append({"path": p, "label": "Agent selected", "score": 0, "width": 0, "height": 0})

    if not picked_images and collected_images:
        picked_images = collected_images[:4]
    seen = set()
    unique_sources = [s for s in collected_sources if not (s in seen or seen.add(s))]
    seen_paths = set()
    unique_images = [img for img in picked_images if not (img["path"] in seen_paths or seen_paths.add(img["path"]))]

    yield {
        "type": "done",
        "sources": unique_sources[:8],
        "images": unique_images[:16],
        "related": related,
    }