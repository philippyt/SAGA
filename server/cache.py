import time
import numpy as np
from dataclasses import dataclass, field
from config import CACHE_MAX_SIZE, CACHE_SIMILARITY_THRESHOLD

@dataclass
class CacheEntry:
    question: str
    answer: str
    sources: list[str]
    embedding: np.ndarray
    timestamp: float = field(default_factory=time.time)
    hits: int = 0

class SemanticCache:
    def __init__(self):
        self._entries: list[CacheEntry] = []
        self._embedder = None

    def _get_embedder(self):
        if self._embedder is None:
            from vectorstore import get_embeddings
            self._embedder = get_embeddings()
        return self._embedder

    def _embed(self, text: str) -> np.ndarray:
        vec = self._get_embedder().embed_query(text)
        return np.array(vec)

    def _cosine_sim(self, a: np.ndarray, b: np.ndarray) -> float:
        dot = np.dot(a, b)
        norm = np.linalg.norm(a) * np.linalg.norm(b)
        if norm == 0:
            return 0.0
        return float(dot / norm)

    def get(self, question: str) -> dict | None:
        if not self._entries:
            return None

        q_emb = self._embed(question)
        best_sim = 0.0
        best_entry = None

        for entry in self._entries:
            sim = self._cosine_sim(q_emb, entry.embedding)
            if sim > best_sim:
                best_sim = sim
                best_entry = entry

        if best_sim >= CACHE_SIMILARITY_THRESHOLD and best_entry:
            best_entry.hits += 1
            print(f"Cache hit (sim={best_sim:.3f}, hits={best_entry.hits}): {question[:60]}")
            return {"answer": best_entry.answer, "sources": best_entry.sources}
        return None

    def put(self, question: str, answer: str, sources: list[str]):
        q_emb = self._embed(question)
        if len(self._entries) >= CACHE_MAX_SIZE:
            self._entries.sort(key=lambda e: e.timestamp)
            self._entries.pop(0)

        self._entries.append(CacheEntry(
            question=question,
            answer=answer,
            sources=sources,
            embedding=q_emb,
        ))
        print(f"Cached: {question[:60]} (total: {len(self._entries)})")

    def clear(self):
        self._entries.clear()
    @property
    def size(self) -> int:
        return len(self._entries)