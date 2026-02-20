from pathlib import Path
from langchain_anthropic import ChatAnthropic
from langchain_chroma import Chroma
from langchain_core.messages import SystemMessage, HumanMessage, AIMessage
from sentence_transformers import CrossEncoder
from config import (
    ANTHROPIC_API_KEY,
    CLAUDE_MODEL,
    LLM_TEMPERATURE,
    TOP_K,
    RERANK_MODEL,
    RERANK_TOP_K,
    PROMPT_FILE,
)
_reranker = None

def _get_reranker():
    global _reranker
    if _reranker is None:
        print(f"loading {RERANK_MODEL}")
        _reranker = CrossEncoder(RERANK_MODEL)
    return _reranker

def load_system_prompt() -> str:
    path = Path(PROMPT_FILE)
    if not path.exists():
        raise FileNotFoundError(f"Prompt file '{PROMPT_FILE}' not found.")
    return path.read_text(encoding="utf-8")

def build_llm() -> ChatAnthropic:
    if not ANTHROPIC_API_KEY:
        raise ValueError("ANTHROPIC_API_KEY is not set.")
    return ChatAnthropic(
        model=CLAUDE_MODEL,
        anthropic_api_key=ANTHROPIC_API_KEY,
        temperature=LLM_TEMPERATURE,
        max_tokens=1024,
        streaming=True,
    )

def retrieve(store: Chroma, query: str, k: int = None, rerank: bool = True):
    k = k or TOP_K
    fetch_k = k * 3 if rerank else k
    results = store.similarity_search_with_score(query, k=fetch_k)
    docs = []
    for doc, score in results:
        docs.append({
            "content": doc.page_content[:500],
            "full_content": doc.page_content,
            "source_label": doc.metadata.get("source_label", "?"),
            "report": doc.metadata.get("report", "?"),
            "score": round(float(score), 3),
        })

    if rerank and len(docs) > 1:
        try:
            reranker = _get_reranker()
            pairs = [(query, d["content"]) for d in docs]
            scores = reranker.predict(pairs)
            for i, s in enumerate(scores):
                docs[i]["rerank_score"] = float(s)
            docs.sort(key=lambda x: x.get("rerank_score", 0), reverse=True)
        except Exception as e:
            print(f"   Reranking failed: {e}")

    final_k = RERANK_TOP_K if rerank else k
    final = docs[:final_k]
    for d in final:
        d.pop("full_content", None)
        d.pop("rerank_score", None)
    return final

def build_context_block(docs: list[dict]) -> str:
    parts = []
    for d in docs:
        parts.append(f"[{d['source_label']}]\n{d['content']}")
    return "\n\n".join(parts)

def build_messages(system_prompt: str, history: list[dict], question: str, context: str, image_descriptions: str = ""):
    msgs = [SystemMessage(content=system_prompt)]
    for h in history:
        if h["role"] == "user":
            msgs.append(HumanMessage(content=h["content"]))
        else:
            msgs.append(AIMessage(content=h["content"]))

    user_parts = []
    if context:
        user_parts.append(f"Context from inspection reports:\n\n{context}")
    if image_descriptions:
        user_parts.append(f"Relevant images found:\n\n{image_descriptions}")
    user_parts.append(f"Question: {question}")
    msgs.append(HumanMessage(content="\n\n---\n\n".join(user_parts)))
    return msgs