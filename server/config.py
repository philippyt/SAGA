import os
from pathlib import Path
from dotenv import load_dotenv

_server_dir = Path(__file__).parent
_env_path = _server_dir / ".env"
if not _env_path.exists():
    _env_path = _server_dir.parent / ".env"
load_dotenv(_env_path)

REPORTS_DIR = os.environ.get("REPORTS_DIR", str(_server_dir / "data" / "reports"))
IMAGES_DIR = os.environ.get("IMAGES_DIR", str(_server_dir / "data" / "images"))
CHROMA_PERSIST_DIR = os.environ.get("CHROMA_DIR", str(_server_dir / "chroma_db"))
CLIP_INDEX_PATH = os.environ.get("CLIP_INDEX_PATH", str(_server_dir / "clip_index.pkl"))
CHUNK_SIZE = int(os.environ.get("CHUNK_SIZE", 1000))
CHUNK_OVERLAP = int(os.environ.get("CHUNK_OVERLAP", 150))
EMBEDDING_MODEL = os.environ.get("EMBEDDING_MODEL", "sentence-transformers/all-MiniLM-L6-v2")
CLIP_MODEL = os.environ.get("CLIP_MODEL", "openai/clip-vit-base-patch32")

# LLM configuration, works with any provider
# Set API_KEY plus optionally LLM_PROVIDER and LLM_MODEL in your .env
API_KEY = os.environ.get("API_KEY", os.environ.get("ANTHROPIC_API_KEY", ""))
LLM_PROVIDER = os.environ.get("LLM_PROVIDER", "anthropic") # anthropic | openai | google
LLM_MODEL = os.environ.get("LLM_MODEL", "claude-haiku-4-5-20251001")
LLM_BASE_URL = os.environ.get("LLM_BASE_URL", None) # optional: OpenAI-compatible endpoint
LLM_TEMPERATURE = float(os.environ.get("LLM_TEMPERATURE", 0.3))
# Backwards-compat aliases (used by a few places that haven't been updated yet)
ANTHROPIC_API_KEY = API_KEY
CLAUDE_MODEL = LLM_MODEL
TOP_K = int(os.environ.get("TOP_K", 5))
TOP_K_IMAGES = int(os.environ.get("TOP_K_IMAGES", 16))
RERANK_MODEL = os.environ.get("RERANK_MODEL", "cross-encoder/ms-marco-MiniLM-L-6-v2")
RERANK_TOP_K = int(os.environ.get("RERANK_TOP_K", 3))
PROMPT_FILE = os.environ.get("PROMPT_FILE", str(_server_dir / "prompt.txt"))
CACHE_ENABLED = os.environ.get("CACHE_ENABLED", "true").lower() == "true"
CACHE_MAX_SIZE = int(os.environ.get("CACHE_MAX_SIZE", 200))
CACHE_SIMILARITY_THRESHOLD = float(os.environ.get("CACHE_SIMILARITY_THRESHOLD", 0.97))
LOG_DB_PATH = os.environ.get("LOG_DB_PATH", str(_server_dir / "logs.db"))
HOST = os.environ.get("HOST", "0.0.0.0")
PORT = int(os.environ.get("PORT", 8000))
STATIC_IMAGES_DIR = os.environ.get("STATIC_IMAGES_DIR", IMAGES_DIR)
