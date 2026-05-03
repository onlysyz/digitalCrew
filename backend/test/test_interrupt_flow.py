"""
Integration test: interrupt/resume wiring

Tests the data-flow wiring (not full execution):
1. ChatSession has thread_id field
2. supervisor_runtime.submit_intervention + get_intervention round-trips by thread_id
3. TaskStore persists tasks to SQLite and restores on restart
4. Session store preserves thread_id on persist/restore
"""
import sys
import uuid
import tempfile
from pathlib import Path

_repo_root = str(Path(__file__).parent.parent.parent)
if _repo_root not in sys.path:
    sys.path.insert(0, _repo_root)

from backend.models.schemas import ChatSession, TaskStatus, Task
from backend.services.session_store import SessionStore
from backend.services.task_store import TaskStore
from backend.services.supervisor import supervisor_runtime
from datetime import datetime, timezone


def test_session_thread_id_field():
    session = ChatSession(id="test-session")
    assert hasattr(session, 'thread_id')
    assert session.thread_id is None
    session.thread_id = "thread-abc"
    assert session.thread_id == "thread-abc"
    print("[1] ChatSession.thread_id field: OK")


def test_intervention_round_trip():
    thread_id = str(uuid.uuid4())
    supervisor_runtime.submit_intervention(thread_id, {
        "message": "Modify goal",
        "session_id": "sess-1"
    })
    retrieved = supervisor_runtime.get_intervention(thread_id)
    assert retrieved is not None
    assert retrieved["message"] == "Modify goal"

    # Cleared after get
    assert supervisor_runtime.get_intervention(thread_id) is None
    print(f"[2] Intervention submit/get round-trip by thread_id: OK")


def test_task_store_persistence():
    with tempfile.TemporaryDirectory() as d:
        db_path = Path(d) / "tasks.db"
        store = TaskStore(db_path=db_path)

        pending = Task(id="t-pending", description="P", status=TaskStatus.PENDING,
                        priority=2, input_data={}, created_at=datetime.now(timezone.utc))
        assigned = Task(id="t-assigned", description="A", status=TaskStatus.ASSIGNED,
                        priority=1, assigned_agents=["a1"], input_data={}, created_at=datetime.now(timezone.utc))
        running = Task(id="t-running", description="R", status=TaskStatus.RUNNING,
                       priority=1, input_data={}, created_at=datetime.now(timezone.utc), started_at=datetime.now(timezone.utc))
        for t in [pending, assigned, running]:
            store.save(t)

        # Reload and simulate _load() logic
        store2 = TaskStore(db_path=db_path)
        restored = {}
        queue_size = 0
        for t in store2.load_all():
            if t.status == TaskStatus.RUNNING:
                t.status = TaskStatus.FAILED
                t.completed_at = datetime.now(timezone.utc)
                store2.save(t)
            elif t.status in (TaskStatus.PENDING, TaskStatus.ASSIGNED, TaskStatus.PAUSED):
                restored[t.id] = t
                if t.status == TaskStatus.PENDING:
                    queue_size += 1

        assert "t-pending" in restored
        assert "t-assigned" in restored
        assert "t-running" not in restored  # became FAILED
        assert queue_size == 1
        print(f"[3] TaskStore restart restore: OK (queue has {queue_size} PENDING)")


def test_session_store_thread_id():
    with tempfile.TemporaryDirectory() as d:
        path = Path(d) / "sessions.json"
        store = SessionStore(storage_path=path)
        s = ChatSession(id="sess-1")
        s.thread_id = "thread-xyz"
        store.create(s)
        # Force save since auto-save is debounced (only fires after 5s)
        store._dirty = True
        store._save()
        store._dirty = False

        store2 = SessionStore(storage_path=path)
        reloaded = store2.get("sess-1")
        assert reloaded is not None, f"Session sess-1 not found. Files: {list(Path(d).glob('*.json'))}"
        assert reloaded.thread_id == "thread-xyz", f"thread_id mismatch: {reloaded.thread_id}"
    print("[4] Session + thread_id persist/restore: OK")


if __name__ == "__main__":
    print("=== Interrupt Wiring Tests ===\n")
    test_session_thread_id_field()
    test_intervention_round_trip()
    test_task_store_persistence()
    test_session_store_thread_id()
    print("\n✅ All interrupt wiring tests passed")