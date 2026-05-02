"""
Task persistence service - stores task state to SQLite so tasks survive server restart.
"""
import json
import sqlite3
from pathlib import Path
from typing import Optional

import structlog

from backend.models.schemas import Task, TaskStatus

logger = structlog.get_logger()

TASKS_DB_PATH = Path("/Users/tiankuo/DigitalCrew/data/tasks.db")


class TaskStore:
    """Persists task state to SQLite."""

    def __init__(self, db_path: Optional[Path] = None):
        self._db_path = db_path or TASKS_DB_PATH
        self._init_db()

    def _init_db(self) -> None:
        with sqlite3.connect(self._db_path) as conn:
            conn.execute("""
                CREATE TABLE IF NOT EXISTS tasks (
                    id TEXT PRIMARY KEY,
                    description TEXT NOT NULL,
                    status TEXT NOT NULL,
                    priority INTEGER DEFAULT 0,
                    assigned_agents TEXT DEFAULT '[]',
                    parent_task_id TEXT,
                    subtasks TEXT DEFAULT '[]',
                    dependencies TEXT DEFAULT '[]',
                    input_data TEXT DEFAULT '{}',
                    output_data TEXT DEFAULT '{}',
                    react_trace TEXT DEFAULT '[]',
                    created_at TEXT,
                    started_at TEXT,
                    completed_at TEXT,
                    timeout_seconds INTEGER DEFAULT 300,
                    error_message TEXT
                )
            """)

    def save(self, task: Task) -> None:
        with sqlite3.connect(self._db_path) as conn:
            conn.execute(
                """INSERT OR REPLACE INTO tasks
                   (id, description, status, priority, assigned_agents, parent_task_id,
                    subtasks, dependencies, input_data, output_data, react_trace,
                    created_at, started_at, completed_at, timeout_seconds, error_message)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (
                    task.id,
                    task.description,
                    task.status.value,
                    task.priority,
                    json.dumps(task.assigned_agents),
                    task.parent_task_id,
                    json.dumps(task.subtasks),
                    json.dumps(task.dependencies),
                    json.dumps(task.input_data),
                    json.dumps(task.output_data),
                    json.dumps([s.model_dump(mode="json") for s in task.react_trace], default=str),
                    task.created_at.isoformat() if task.created_at else None,
                    task.started_at.isoformat() if task.started_at else None,
                    task.completed_at.isoformat() if task.completed_at else None,
                    task.timeout_seconds,
                    task.error_message,
                ),
            )

    def load_all(self) -> list[Task]:
        """Load all tasks from DB. Caller filters by status as needed."""
        with sqlite3.connect(self._db_path) as conn:
            cursor = conn.execute("SELECT * FROM tasks")
            rows = cursor.fetchall()
            columns = [desc[0] for desc in cursor.description]
            tasks = []
            for row in rows:
                d = dict(zip(columns, row))
                d["status"] = TaskStatus(d["status"])
                d["assigned_agents"] = json.loads(d["assigned_agents"])
                d["subtasks"] = json.loads(d["subtasks"])
                d["dependencies"] = json.loads(d["dependencies"])
                d["input_data"] = json.loads(d["input_data"])
                d["output_data"] = json.loads(d["output_data"])
                d["react_trace"] = json.loads(d["react_trace"])
                if d["created_at"]:
                    from datetime import datetime
                    d["created_at"] = datetime.fromisoformat(d["created_at"])
                if d["started_at"]:
                    d["started_at"] = datetime.fromisoformat(d["started_at"])
                if d["completed_at"]:
                    d["completed_at"] = datetime.fromisoformat(d["completed_at"])
                tasks.append(Task(**d))
            return tasks

    def delete(self, task_id: str) -> bool:
        with sqlite3.connect(self._db_path) as conn:
            cursor = conn.execute("DELETE FROM tasks WHERE id = ?", (task_id,))
            return cursor.rowcount > 0

    def clear_terminal_tasks(self) -> int:
        """Remove completed/failed/cancelled tasks (terminal states)."""
        terminal = [TaskStatus.COMPLETED.value, TaskStatus.FAILED.value, TaskStatus.CANCELLED.value]
        placeholders = ",".join("?" * len(terminal))
        with sqlite3.connect(self._db_path) as conn:
            cursor = conn.execute(
                f"DELETE FROM tasks WHERE status IN ({placeholders})", terminal
            )
            return cursor.rowcount


# Global singleton
task_store = TaskStore()