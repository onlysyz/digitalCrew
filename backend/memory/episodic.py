"""
Episodic Memory - Task summaries stored in SQLite
"""
import json
import uuid
from datetime import datetime
from pathlib import Path
from typing import Any

import aiosqlite
import structlog

logger = structlog.get_logger()


class TaskSummary:
    """A summary of a completed task for episodic memory."""

    def __init__(
        self,
        agent_id: str,
        task_id: str,
        goal: str,
        key_steps: list[str] | None = None,
        conclusion: str = "",
        token_usage: int = 0,
        duration_seconds: float = 0.0,
        id: str | None = None,
        created_at: datetime | None = None,
    ):
        self.id = id or str(uuid.uuid4())
        self.agent_id = agent_id
        self.task_id = task_id
        self.goal = goal
        self.key_steps = key_steps or []
        self.conclusion = conclusion
        self.token_usage = token_usage
        self.duration_seconds = duration_seconds
        self.created_at = created_at or datetime.utcnow()

    def model_dump(self) -> dict:
        return {
            "id": self.id,
            "agent_id": self.agent_id,
            "task_id": self.task_id,
            "goal": self.goal,
            "key_steps": json.dumps(self.key_steps),
            "conclusion": self.conclusion,
            "token_usage": self.token_usage,
            "duration_seconds": self.duration_seconds,
            "created_at": self.created_at.isoformat(),
        }

    @classmethod
    def from_row(cls, row: aiosqlite.Row) -> "TaskSummary":
        return cls(
            id=row["id"],
            agent_id=row["agent_id"],
            task_id=row["task_id"],
            goal=row["goal"],
            key_steps=json.loads(row["key_steps"]) if row["key_steps"] else [],
            conclusion=row["conclusion"] or "",
            token_usage=row["token_usage"] or 0,
            duration_seconds=row["duration_seconds"] or 0.0,
            created_at=datetime.fromisoformat(row["created_at"]) if row["created_at"] else datetime.utcnow(),
        )


class EpisodicMemory:
    """
    Manages episodic memories - task summaries stored for later retrieval.
    """

    def __init__(self, agent_id: str, db_path: Path):
        self.agent_id = agent_id
        self.db_path = db_path

    async def store(self, summary: TaskSummary) -> TaskSummary:
        """Store a task summary."""
        async with aiosqlite.connect(self.db_path) as db:
            await db.execute(
                """
                INSERT INTO episodic_memories
                (id, agent_id, task_id, goal, key_steps, conclusion, token_usage, duration_seconds, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    summary.id,
                    summary.agent_id,
                    summary.task_id,
                    summary.goal,
                    json.dumps(summary.key_steps),
                    summary.conclusion,
                    summary.token_usage,
                    summary.duration_seconds,
                    summary.created_at.isoformat(),
                ),
            )
            await db.commit()

        logger.debug("episodic_memory_stored", memory_id=summary.id, agent_id=self.agent_id)
        return summary

    async def retrieve(self, query: str, top_k: int = 5) -> list[TaskSummary]:
        """Retrieve memories similar to query (simple keyword matching)."""
        async with aiosqlite.connect(self.db_path) as db:
            db.row_factory = aiosqlite.Row

            # Simple search - in production, use embeddings
            cursor = await db.execute(
                """
                SELECT * FROM episodic_memories
                WHERE agent_id = ?
                AND (goal LIKE ? OR conclusion LIKE ?)
                ORDER BY created_at DESC
                LIMIT ?
                """,
                (self.agent_id, f"%{query}%", f"%{query}%", top_k),
            )

            rows = await cursor.fetchall()
            return [TaskSummary.from_row(row) for row in rows]

    async def list_memories(self, limit: int = 50) -> list[TaskSummary]:
        """List all memories for this agent."""
        async with aiosqlite.connect(self.db_path) as db:
            db.row_factory = aiosqlite.Row

            cursor = await db.execute(
                """
                SELECT * FROM episodic_memories
                WHERE agent_id = ?
                ORDER BY created_at DESC
                LIMIT ?
                """,
                (self.agent_id, limit),
            )

            rows = await cursor.fetchall()
            return [TaskSummary.from_row(row) for row in rows]

    async def delete(self, memory_id: str) -> bool:
        """Delete a specific memory."""
        async with aiosqlite.connect(self.db_path) as db:
            cursor = await db.execute(
                "DELETE FROM episodic_memories WHERE id = ? AND agent_id = ?",
                (memory_id, self.agent_id),
            )
            await db.commit()
            deleted = cursor.rowcount > 0

        if deleted:
            logger.info("episodic_memory_deleted", memory_id=memory_id)
        return deleted

    async def clear_all(self) -> int:
        """Clear all memories for this agent."""
        async with aiosqlite.connect(self.db_path) as db:
            cursor = await db.execute(
                "DELETE FROM episodic_memories WHERE agent_id = ?",
                (self.agent_id,),
            )
            await db.commit()
            count = cursor.rowcount

        logger.info("episodic_memory_cleared", agent_id=self.agent_id, count=count)
        return count

    async def count(self) -> int:
        """Count total memories for this agent."""
        async with aiosqlite.connect(self.db_path) as db:
            cursor = await db.execute(
                "SELECT COUNT(*) FROM episodic_memories WHERE agent_id = ?",
                (self.agent_id,),
            )
            row = await cursor.fetchone()
            return row[0] if row else 0
