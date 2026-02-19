import sqlite3
import time
from pathlib import Path
from config import LOG_DB_PATH

def _get_conn() -> sqlite3.Connection:
    conn = sqlite3.connect(LOG_DB_PATH)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS chat_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp REAL NOT NULL,
            session_id TEXT NOT NULL,
            question TEXT NOT NULL,
            answer TEXT NOT NULL,
            sources TEXT,
            cached INTEGER DEFAULT 0,
            response_time_ms INTEGER
        )
    """)
    conn.commit()
    return conn

def log_interaction(
    session_id: str,
    question: str,
    answer: str,
    sources: list[str],
    cached: bool = False,
    response_time_ms: int = 0,
):
    try:
        conn = _get_conn()
        conn.execute(
            """INSERT INTO chat_logs 
               (timestamp, session_id, question, answer, sources, cached, response_time_ms)
               VALUES (?, ?, ?, ?, ?, ?, ?)""",
            (
                time.time(),
                session_id,
                question,
                answer,
                ",".join(sources),
                1 if cached else 0,
                response_time_ms,
            ),
        )
        conn.commit()
        conn.close()
    except Exception as e:
        print(f"Logging feilet: {e}")

def reset_stats():
    try:
        conn = _get_conn()
        conn.execute("DELETE FROM chat_logs")
        conn.commit()
        conn.close()
    except Exception as e:
        print(f"Reset feilet: {e}")

def get_stats() -> dict:
    try:
        conn = _get_conn()
        cur = conn.cursor()

        cur.execute("SELECT COUNT(*) FROM chat_logs")
        total = cur.fetchone()[0]

        cur.execute("SELECT COUNT(*) FROM chat_logs WHERE cached = 1")
        cached = cur.fetchone()[0]

        cur.execute("SELECT AVG(response_time_ms) FROM chat_logs WHERE cached = 0")
        avg_time = cur.fetchone()[0] or 0

        cur.execute("SELECT AVG(response_time_ms) FROM chat_logs WHERE cached = 1")
        avg_cached_time = cur.fetchone()[0] or 0

        cur.execute("SELECT COUNT(DISTINCT session_id) FROM chat_logs")
        sessions = cur.fetchone()[0]

        cur.execute("""
            SELECT question, COUNT(*) as cnt 
            FROM chat_logs 
            GROUP BY question 
            ORDER BY cnt DESC 
            LIMIT 10
        """)
        top_questions = [{"question": row[0], "count": row[1]} for row in cur.fetchall()]

        conn.close()
        return {
            "total_questions": total,
            "cached_responses": cached,
            "cache_hit_rate": f"{(cached/total*100):.1f}%" if total > 0 else "0%",
            "avg_response_ms": round(avg_time),
            "avg_cached_ms": round(avg_cached_time),
            "unique_sessions": sessions,
            "top_questions": top_questions,
        }
    except Exception as e:
        return {"error": str(e)}