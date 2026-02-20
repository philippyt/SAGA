import json
import time
from pathlib import Path
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from vectorstore import build_vectorstore
from clip_index import load_clip_index, search_images, rebuild_clip_index
from pipeline import build_llm, load_system_prompt, retrieve, build_context_block, build_messages
from cache import SemanticCache
from logger import log_interaction, get_stats
from config import CACHE_ENABLED, STATIC_IMAGES_DIR
_store = None
_llm = None
_system_prompt = ""
_cache = SemanticCache()
_chat_histories: dict[str, list] = {}

@asynccontextmanager
async def lifespan(app: FastAPI):
    global _store, _llm, _system_prompt
    _store = build_vectorstore()
    _llm = build_llm()
    _system_prompt = load_system_prompt()
    load_clip_index()
    print("Ready")
    yield

app = FastAPI(title="SAGA", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

if Path(STATIC_IMAGES_DIR).exists():
    app.mount("/images", StaticFiles(directory=STATIC_IMAGES_DIR), name="images")

class ChatRequest(BaseModel):
    question: str
    session_id: str = "default"

class ImageSearchRequest(BaseModel):
    query: str
    k: int = 4

@app.get("/health")
def health():
    return {
        "status": "ok",
        "store_ready": _store is not None,
        "llm_ready": _llm is not None,
        "cache_size": _cache.size,
    }


@app.get("/stats")
def stats():
    return get_stats()

@app.post("/search/images")
async def search_images_endpoint(req: ImageSearchRequest):
    results = search_images(req.query, k=req.k)
    return {"images": results}

@app.post("/chat/stream")
async def chat_stream(req: ChatRequest, request: Request):
    if _llm is None:
        async def error_stream():
            yield f"data: {json.dumps({'type': 'token', 'content': 'Backend er ikke klar.'})}\n\n"
            yield f"data: {json.dumps({'type': 'done', 'sources': [], 'images': []})}\n\n"
        return StreamingResponse(error_stream(), media_type="text/event-stream")

    start_time = time.time()
    if CACHE_ENABLED:
        cached = _cache.get(req.question)
        if cached:
            elapsed = int((time.time() - start_time) * 1000)
            log_interaction(
                session_id=req.session_id, question=req.question,
                answer=cached["answer"], sources=cached["sources"],
                cached=True, response_time_ms=elapsed,
            )
            async def cached_stream():
                yield f"data: {json.dumps({'type': 'token', 'content': cached['answer']})}\n\n"
                yield f"data: {json.dumps({'type': 'done', 'sources': cached['sources'], 'images': []})}\n\n"
            return StreamingResponse(cached_stream(), media_type="text/event-stream")

    history = _chat_histories.setdefault(req.session_id, [])
    docs = retrieve(_store, req.question) if _store else []
    sources = [d["source_label"] for d in docs]
    context = build_context_block(docs)
    images = search_images(req.question)
    image_desc = ""
    if images:
        parts = []
        for img in images:
            parts.append(f"- {img['label']} (relevans: {img['score']}): {img['path']}")
        image_desc = "\n".join(parts)

    msgs = build_messages(_system_prompt, history[-12:], req.question, context, image_desc)
    async def event_stream():
        full_answer = ""
        try:
            for chunk in _llm.stream(msgs):
                if await request.is_disconnected():
                    break
                token = chunk.content
                if isinstance(token, str) and token:
                    full_answer += token
                    yield f"data: {json.dumps({'type': 'token', 'content': token})}\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'type': 'error', 'content': str(e)})}\n\n"

        if full_answer:
            history.append({"role": "user", "content": req.question})
            history.append({"role": "assistant", "content": full_answer})
            if len(history) > 12:
                _chat_histories[req.session_id] = history[-12:]
            if CACHE_ENABLED:
                _cache.put(req.question, full_answer, sources[:5])

        elapsed = int((time.time() - start_time) * 1000)
        log_interaction(
            session_id=req.session_id, question=req.question,
            answer=full_answer, sources=sources[:5],
            cached=False, response_time_ms=elapsed,
        )

        related = []
        if full_answer and _llm:
            try:
                from langchain_core.messages import SystemMessage as S, HumanMessage as H
                result = _llm.invoke([
                    S(content="Generate 3 short follow-up questions an engineer might ask based on the answer below. Write only the questions, one per line, no numbering. Max 10 words each. Write in English."),
                    H(content=f"Question: {req.question}\n\nAnswer: {full_answer[:300]}"),
                ])
                lines = [l.strip() for l in result.content.strip().split("\n") if l.strip()]
                related = lines[:3]
            except:
                pass

        yield f"data: {json.dumps({'type': 'done', 'sources': sources[:5], 'images': images, 'related': related})}\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")

@app.post("/clear")
async def clear(session_id: str = "default"):
    _chat_histories.pop(session_id, None)
    return {"status": "cleared"}

@app.get("/clear-cache")
async def clear_cache():
    _cache.clear()
    return {"status": "cache cleared"}

@app.get("/rebuild-index")
async def rebuild_index():
    rebuild_clip_index()
    return {"status": "CLIP index rebuilt"}

@app.get("/clear-stats")
async def clear_stats():
    from logger import reset_stats
    reset_stats()
    return {"status": "stats cleared"}