from pathlib import Path
from langchain_anthropic import ChatAnthropic
from langchain_chroma import Chroma
from langchain_core.messages import SystemMessage, HumanMessage, AIMessage
from config import (
    ANTHROPIC_API_KEY,
    CLAUDE_MODEL,
    LLM_TEMPERATURE,
    TOP_K,
    PROMPT_FILE,
)

def load_system_prompt() -> str:
    path = Path(PROMPT_FILE)
    if not path.exists():
        raise FileNotFoundError(f"'{PROMPT_FILE}' doesn't exist")
    return path.read_text(encoding="utf-8")

def build_llm() -> ChatAnthropic:
    if not ANTHROPIC_API_KEY:
        raise ValueError("no API key")
    return ChatAnthropic(
        model=CLAUDE_MODEL,
        anthropic_api_key=ANTHROPIC_API_KEY,
        temperature=LLM_TEMPERATURE,
        max_tokens=1024,
        streaming=True,
    )

def retrieve(store: Chroma, query: str, k: int = None):
    k = k or TOP_K
    results = store.similarity_search_with_score(query, k=k)
    docs = []
    for doc, score in results:
        docs.append({
            "content": doc.page_content[:500],
            "source_label": doc.metadata.get("source_label", "?"),
            "report": doc.metadata.get("report", "?"),
            "score": round(float(score), 3),
        })
    return docs

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
        user_parts.append(f"Context from reports:\n\n{context}")
    if image_descriptions:
        user_parts.append(f"Relevant images found:\n\n{image_descriptions}")
    user_parts.append(f"question: {question}")
    msgs.append(HumanMessage(content="\n\n---\n\n".join(user_parts)))
    return msgs