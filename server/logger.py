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
    conn.execute("""
        CREATE TABLE IF NOT EXISTS feedback (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp REAL NOT NULL,
            session_id TEXT NOT NULL,
            question TEXT NOT NULL,
            rating INTEGER NOT NULL,
            comment TEXT DEFAULT ''
        )
    """)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS chat_sessions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id TEXT NOT NULL,
            role TEXT NOT NULL,
            content TEXT NOT NULL,
            timestamp REAL NOT NULL
        )
    """)
    conn.execute("CREATE INDEX IF NOT EXISTS idx_sessions ON chat_sessions (session_id)")
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
        print(f"Logging failed: {e}")

def log_feedback(session_id: str, question: str, rating: int, comment: str = ""):
    try:
        conn = _get_conn()
        conn.execute(
            "INSERT INTO feedback (timestamp, session_id, question, rating, comment) VALUES (?, ?, ?, ?, ?)",
            (time.time(), session_id, question, rating, comment),
        )
        conn.commit()
        conn.close()
    except Exception as e:
        print(f"Feedback logging failed: {e}")

def save_session_turn(session_id: str, role: str, content: str):
    try:
        conn = _get_conn()
        conn.execute(
            "INSERT INTO chat_sessions (session_id, role, content, timestamp) VALUES (?, ?, ?, ?)",
            (session_id, role, content, time.time()),
        )
        conn.commit()
        conn.close()
    except Exception as e:
        print(f"Session save failed: {e}")


def load_session(session_id: str) -> list[dict]:
    try:
        conn = _get_conn()
        cur = conn.cursor()
        cur.execute(
            "SELECT role, content FROM chat_sessions WHERE session_id = ? ORDER BY timestamp ASC",
            (session_id,),
        )
        rows = cur.fetchall()
        conn.close()
        return [{"role": row[0], "content": row[1]} for row in rows[-24:]]
    except Exception as e:
        print(f"Session load failed: {e}")
        return []

def reset_stats():
    try:
        conn = _get_conn()
        conn.execute("DELETE FROM chat_logs")
        conn.commit()
        conn.close()
    except Exception as e:
        print(f"Reset failed: {e}")

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

        cur.execute("SELECT COUNT(*) FROM feedback WHERE rating = 1")
        thumbs_up = cur.fetchone()[0]

        cur.execute("SELECT COUNT(*) FROM feedback WHERE rating = -1")
        thumbs_down = cur.fetchone()[0]

        conn.close()
        return {
            "total_questions": total,
            "cached_responses": cached,
            "cache_hit_rate": f"{(cached/total*100):.1f}%" if total > 0 else "0%",
            "avg_response_ms": round(avg_time),
            "avg_cached_ms": round(avg_cached_time),
            "unique_sessions": sessions,
            "top_questions": top_questions,
            "feedback": {"thumbs_up": thumbs_up, "thumbs_down": thumbs_down},
        }
    except Exception as e:
        return {"error": str(e)}