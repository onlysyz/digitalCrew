"""
Session persistence service - stores chat sessions to disk
"""
import json
import os
import asyncio
from pathlib import Path
from typing import Optional
from datetime import datetime
import tempfile
import shutil

import structlog

from backend.models.schemas import ChatSession, ChatMessage

logger = structlog.get_logger()

SESSIONS_DIR = Path("/Users/tiankuo/DigitalCrew/data/sessions")
SESSIONS_FILE = SESSIONS_DIR / "sessions.json"
AUTO_SAVE_DELAY_SECONDS = 5.0


class SessionStore:
    """Persistent storage for chat sessions."""

    def __init__(self, storage_path: Optional[Path] = None):
        self.storage_path = storage_path or SESSIONS_FILE
        self._sessions: dict[str, ChatSession] = {}
        self._dirty = False  # True when in-memory state differs from disk
        self._save_task: Optional[asyncio.Task] = None
        self._load()
        self._start_autosave()

    def _start_autosave(self):
        """Start the auto-save loop if an event loop is running."""
        try:
            loop = asyncio.get_running_loop()
        except RuntimeError:
            # No running loop at import time (e.g., non-async module load)
            # Lazy-start on first mutation via _mark_dirty
            return
        self._save_task = loop.create_task(self._auto_save_loop())
        logger.info("session_store_autosave_started", delay=AUTO_SAVE_DELAY_SECONDS)

    def _load(self):
        """Load sessions from disk."""
        if not self.storage_path.exists():
            self.storage_path.parent.mkdir(parents=True, exist_ok=True)
            return

        try:
            with open(self.storage_path, "r", encoding="utf-8") as f:
                data = json.load(f)
                for sid, session_data in data.items():
                    session_data["created_at"] = datetime.fromisoformat(session_data["created_at"])
                    session_data["updated_at"] = datetime.fromisoformat(session_data["updated_at"])
                    for msg in session_data.get("messages", []):
                        msg["timestamp"] = datetime.fromisoformat(msg["timestamp"])
                        if msg.get("metadata") is None:
                            msg["metadata"] = {}
                        if msg.get("agent_id") is None:
                            msg["agent_id"] = None  # already None, just explicit
                    self._sessions[sid] = ChatSession(**session_data)
            logger.info("sessions_loaded", count=len(self._sessions))
        except Exception as e:
            logger.warning("failed_to_load_sessions", error=str(e))
            self._sessions = {}

    def _save(self):
        """Save sessions to disk atomically (temp file + rename)."""
        try:
            self.storage_path.parent.mkdir(parents=True, exist_ok=True)
            data = {}
            for sid, session in self._sessions.items():
                data[sid] = {
                    "id": session.id,
                    "agent_id": session.agent_id,
                    "messages": [
                        {
                            "id": m.id,
                            "role": m.role,
                            "content": m.content,
                            "agent_id": m.agent_id,
                            "timestamp": m.timestamp.isoformat(),
                            "metadata": m.metadata or {},
                        }
                        for m in session.messages
                    ],
                    "created_at": session.created_at.isoformat(),
                    "updated_at": session.updated_at.isoformat(),
                }

            # Atomic write: write to temp file, then rename
            tmp_fd, tmp_path_str = tempfile.mkstemp(
                dir=self.storage_path.parent, suffix=".tmp", prefix="sessions_"
            )
            tmp_path = Path(tmp_path_str)
            try:
                with os.fdopen(tmp_fd, "w", encoding="utf-8") as f:
                    json.dump(data, f, ensure_ascii=False, indent=2)
                shutil.move(str(tmp_path), str(self.storage_path))
            except Exception:
                # Clean up temp file on failure
                if tmp_path.exists():
                    tmp_path.unlink()
                raise
        except Exception as e:
            logger.error("failed_to_save_sessions", error=str(e))

    def get(self, session_id: str) -> Optional[ChatSession]:
        """Get a session by ID."""
        return self._sessions.get(session_id)

    def _mark_dirty(self):
        """Mark sessions as needing persist; lazy-start autosave if needed."""
        self._dirty = True
        if self._save_task is None:
            self._start_autosave()

    async def _auto_save_loop(self):
        """Background loop: flush to disk after inactivity period."""
        while True:
            await asyncio.sleep(AUTO_SAVE_DELAY_SECONDS)
            if self._dirty:
                self._save()
                self._dirty = False

    def create(self, session: ChatSession) -> ChatSession:
        """Create a new session."""
        self._sessions[session.id] = session
        self._mark_dirty()
        return session

    def update(self, session: ChatSession) -> ChatSession:
        """Update an existing session."""
        session.updated_at = datetime.utcnow()
        self._sessions[session.id] = session
        self._mark_dirty()
        return session

    def delete(self, session_id: str) -> bool:
        """Delete a session."""
        if session_id in self._sessions:
            del self._sessions[session_id]
            self._mark_dirty()
            return True
        return False

    def list(self) -> list[dict]:
        """List all sessions (summary info only)."""
        return [
            {
                "id": sid,
                "agent_id": s.agent_id,
                "message_count": len(s.messages),
                "created_at": s.created_at.isoformat(),
            }
            for sid, s in self._sessions.items()
        ]

    def get_or_create(self, session_id: str, agent_id: Optional[str] = None) -> ChatSession:
        """Get existing session or create a new one."""
        if session_id in self._sessions:
            return self._sessions[session_id]
        session = ChatSession(id=session_id, agent_id=agent_id)
        self._sessions[session_id] = session
        self._mark_dirty()
        return session


# Global singleton
session_store = SessionStore()