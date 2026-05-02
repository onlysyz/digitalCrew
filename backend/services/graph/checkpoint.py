"""
SQLite-based checkpoint store for graph state persistence.
"""

import json
import sqlite3
from pathlib import Path
from typing import Optional


class CheckpointStore:
    """Persists graph execution checkpoints to SQLite."""

    def __init__(self, db_path: Path) -> None:
        self._db_path = db_path
        self._init_db()

    def _init_db(self) -> None:
        with sqlite3.connect(self._db_path) as conn:
            conn.execute("""
                CREATE TABLE IF NOT EXISTS graph_checkpoints (
                    thread_id TEXT NOT NULL,
                    step INTEGER NOT NULL,
                    state_json TEXT NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    PRIMARY KEY (thread_id, step)
                )
            """)

    def save(self, thread_id: str, step: int, state: dict) -> None:
        with sqlite3.connect(self._db_path) as conn:
            conn.execute(
                "INSERT OR REPLACE INTO graph_checkpoints (thread_id, step, state_json) VALUES (?, ?, ?)",
                (thread_id, step, json.dumps(state, default=str)),
            )

    def load(self, thread_id: str, step: int | None = None) -> Optional[dict]:
        with sqlite3.connect(self._db_path) as conn:
            if step is not None:
                row = conn.execute(
                    "SELECT state_json FROM graph_checkpoints WHERE thread_id = ? AND step = ?",
                    (thread_id, step),
                ).fetchone()
            else:
                row = conn.execute(
                    "SELECT state_json FROM graph_checkpoints WHERE thread_id = ? ORDER BY step DESC LIMIT 1",
                    (thread_id,),
                ).fetchone()
            return json.loads(row[0]) if row else None

    def list_steps(self, thread_id: str) -> list[int]:
        with sqlite3.connect(self._db_path) as conn:
            rows = conn.execute(
                "SELECT step FROM graph_checkpoints WHERE thread_id = ? ORDER BY step",
                (thread_id,),
            ).fetchall()
            return [r[0] for r in rows]