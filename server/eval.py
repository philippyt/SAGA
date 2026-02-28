import json
import time
import argparse
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))
from vectorstore import build_vectorstore
from pipeline import build_llm, load_system_prompt, retrieve, build_context_block, build_messages

EVAL_SET_PATH = Path(__file__).parent / "eval_set.json"

def load_eval_set(path: Path) -> list[dict]:
    with open(path, encoding="utf-8") as f:
        return json.load(f)

def score_answer(answer: str, sources: list[str], item: dict) -> dict:
    keywords = item.get("expected_keywords", [])
    answer_lower = answer.lower()
    matched = [kw for kw in keywords if kw.lower() in answer_lower]
    keyword_score = len(matched) / len(keywords) if keywords else 1.0
    return {
        "keyword_score": round(keyword_score * 100),
        "matched_keywords": matched,
        "missing_keywords": [kw for kw in keywords if kw.lower() not in answer_lower],
        "has_sources": len(sources) > 0,
        "source_count": len(sources),
        "sources": sources,
    }

def run_eval(eval_set: list[dict]) -> list[dict]:
    print("Loading vectorstore and LLM...")
    store = build_vectorstore()
    llm = build_llm()
    system_prompt = load_system_prompt()
    print(f"Ready. Running {len(eval_set)} questions.\n")

    results = []
    for i, item in enumerate(eval_set):
        q = item["question"]
        print(f"[{i+1}/{len(eval_set)}] {q[:70]}...")

        start = time.time()
        docs = retrieve(store, q, rerank=True)
        sources = [d["source_label"] for d in docs]
        context = build_context_block(docs)
        msgs = build_messages(system_prompt, [], q, context)

        answer = ""
        try:
            for chunk in llm.stream(msgs):
                if isinstance(chunk.content, str):
                    answer += chunk.content
        except Exception as e:
            answer = f"[Error: {e}]"

        elapsed = int((time.time() - start) * 1000)
        scores = score_answer(answer, sources, item)

        result = {
            "id": item.get("id", f"q{i+1}"),
            "question": q,
            "answer_preview": answer[:200] + ("..." if len(answer) > 200 else ""),
            "latency_ms": elapsed,
            "notes": item.get("notes", ""),
            **scores,
        }
        results.append(result)

        status = "ok" if scores["has_sources"] else "no sources"
        print(f"  Keywords: {scores['keyword_score']}%  Sources: {scores['source_count']}  Latency: {elapsed}ms  [{status}]")
        if scores["missing_keywords"]:
            print(f"  Missing: {', '.join(scores['missing_keywords'])}")

    return results

def print_summary(results: list[dict]):
    print("\n" + "=" * 60)
    print("EVALUATION SUMMARY")
    print("=" * 60)

    n = len(results)
    avg_keyword = sum(r["keyword_score"] for r in results) / n
    avg_latency = sum(r["latency_ms"] for r in results) / n
    source_rate = sum(1 for r in results if r["has_sources"]) / n * 100

    print(f"\nQuestions evaluated : {n}")
    print(f"Avg keyword match   : {avg_keyword:.0f}%")
    print(f"Source citation rate: {source_rate:.0f}%")
    print(f"Avg latency         : {avg_latency:.0f} ms")

    print(f"\n{'ID':<18} {'Keywords':>10} {'Sources':>8} {'Latency':>10}")
    print("-" * 50)
    for r in results:
        src = str(r["source_count"])
        print(f"{r['id']:<18} {r['keyword_score']:>9}% {src:>8}  {r['latency_ms']:>8}ms")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Evaluate SAGA retrieval quality")
    parser.add_argument("--set", default=str(EVAL_SET_PATH), help="Path to eval set JSON")
    parser.add_argument("--save", default=None, help="Save results to JSON file")
    args = parser.parse_args()

    eval_path = Path(args.set)
    if not eval_path.exists():
        print(f"Eval set not found: {eval_path}")
        sys.exit(1)

    eval_set = load_eval_set(eval_path)
    print(f"Loaded {len(eval_set)} questions from {eval_path.name}\n")

    results = run_eval(eval_set)
    print_summary(results)

    if args.save:
        save_path = Path(args.save)
        with open(save_path, "w", encoding="utf-8") as f:
            json.dump(results, f, indent=2, ensure_ascii=False)
        print(f"\nResults saved to {save_path}")
