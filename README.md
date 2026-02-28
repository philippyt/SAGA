# SAGA - subsea autonomous guidance agent
An agent for subsea pipeline inspection engineers. You can chat with inspection reports, search ROV imagery, classify defects, and look up acceptance criteria from standards like DNV-RP-F116, all in one interface.

Built as a university project exploring how LLMs and vision models can work together for a real engineering problem.

## Features
- Chat with PDF inspection reports using retrieval-augmented generation (RAG)
- Search ROV inspection images by description using CLIP visual similarity
- Upload an image to get instant zero-shot defect classification (type, severity, recommended action)
- Upload new PDF reports without restarting the server
- Agent mode chains tools automatically: for a question like "analyze the corrosion in report X", it searches images, classifies the defect, then cross-references the relevant standard
- Helpful/not helpful feedback on answers, stored to SQLite
- Chat history persists across server restarts
- Semantic cache to avoid redundant LLM calls
- Evaluation harness for measuring retrieval quality

## How it works
The backend is a FastAPI server with a LangChain agentic loop. When a question comes in, an LLM model (for example Claude) decides which tools to call and in what order:

- `search_reports` queries a ChromaDB vectorstore (sentence-transformer embeddings + cross-encoder reranking)
- `search_images` runs CLIP image-text similarity search over indexed inspection photos
- `classify_defect` does CLIP zero-shot classification on a specific image
- `check_standard` pulls relevant acceptance criteria from the document store

The frontend is React with streaming SSE responses, so you see the agent's thinking and tool calls in real time.

## Tech stack

**Backend:** FastAPI, LangChain, Claude, CLIP (openai/clip-vit-base-patch32), ChromaDB, sentence-transformers (cross-encoder reranking), SQLite

**Frontend:** React, Vite, streaming SSE

## Setup

### 1. Install Python dependencies

```bash
cd server
pip install -r requirements.txt
```

### 2. Set your API key

Create a `.env` file in the project root. The app works with Anthropic, OpenAI, or any OpenAI-compatible provider:

```
# Required
API_KEY=your_key_here

# Optional, defaults to anthropic
LLM_PROVIDER=anthropic # anthropic | openai | google
LLM_MODEL=claude-haiku-4-5-20251001

# For OpenAI-compatible endpoints (Together, Ollama, etc.)
# LLM_PROVIDER=openai
# LLM_BASE_URL=https://api.groq.com/openai/v1
# LLM_MODEL=llama-3.1-8b-instant
```

### 3. Add data

Put PDF inspection reports in `server/data/reports/` and inspection images in `server/data/images/`.

There is also a data downloader for public datasets:

```bash
cd server
python data.py
```

### 4. Start the server

```bash
cd server
python main.py
```

### 5. Start the frontend

```bash
cd app
npm install
npm run dev
```

Open http://localhost:5173

## Evaluation

Run the evaluation script to benchmark retrieval quality and answer coverage:

```bash
cd server
python eval.py
```

This runs a set of questions from `eval_set.json` through the pipeline and reports keyword match rate, source citation rate, and latency per question. Add your own questions to `eval_set.json` to test against your specific reports.

To save results:

```bash
python eval.py --save results.json
```

## Project structure

```
server/
  api.py            FastAPI app, all endpoints
  agent.py          agentic tool loop (search, classify, standards lookup)
  pipeline.py       RAG retrieval and cross-encoder reranking
  clip_index.py     CLIP image indexing, search, and defect classification
  vectorstore.py    ChromaDB vectorstore, PDF ingestion
  logger.py         SQLite logging, feedback, session persistence
  cache.py          semantic similarity cache
  eval.py           evaluation harness
  eval_set.json     example evaluation questions
  prompt.txt        system prompt
  data/
    reports/        PDF inspection reports
    images/         ROV and inspection photos

app/src/
  main_front.jsx    React frontend (single file)
```