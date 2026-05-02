"""
Database utilities - SQLite with SQLAlchemy
"""
import aiosqlite
import structlog
from pathlib import Path

logger = structlog.get_logger()

# SQL for creating all tables
CREATE_TABLES_SQL = """
-- Agents table
CREATE TABLE IF NOT EXISTS agents (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    avatar TEXT,
    description TEXT,
    tags TEXT,
    role TEXT NOT NULL DEFAULT 'worker',
    model_config TEXT NOT NULL,
    system_prompt TEXT,
    tool_permissions TEXT,
    memory_config TEXT,
    status TEXT NOT NULL DEFAULT 'idle',
    is_archived INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

-- Tasks table
CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY,
    description TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    priority INTEGER NOT NULL DEFAULT 0,
    parent_task_id TEXT,
    input_data TEXT,
    output_data TEXT,
    created_at TEXT NOT NULL,
    started_at TEXT,
    completed_at TEXT,
    timeout_seconds INTEGER DEFAULT 300,
    error_message TEXT
);

-- Task-Agent association
CREATE TABLE IF NOT EXISTS task_agents (
    task_id TEXT NOT NULL,
    agent_id TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'worker',
    PRIMARY KEY (task_id, agent_id)
);

-- Task dependencies
CREATE TABLE IF NOT EXISTS task_dependencies (
    task_id TEXT NOT NULL,
    depends_on TEXT NOT NULL,
    PRIMARY KEY (task_id, depends_on)
);

-- ReAct trace steps
CREATE TABLE IF NOT EXISTS react_steps (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id TEXT NOT NULL,
    agent_id TEXT NOT NULL,
    step_number INTEGER NOT NULL,
    timestamp TEXT NOT NULL,
    thought TEXT,
    action TEXT,
    action_input TEXT,
    observation TEXT,
    token_input INTEGER,
    token_output INTEGER,
    duration_ms INTEGER
);

-- Episodic memories
CREATE TABLE IF NOT EXISTS episodic_memories (
    id TEXT PRIMARY KEY,
    agent_id TEXT NOT NULL,
    task_id TEXT,
    goal TEXT NOT NULL,
    key_steps TEXT,
    conclusion TEXT,
    token_usage INTEGER,
    duration_seconds REAL,
    created_at TEXT NOT NULL
);

-- Knowledge bases
CREATE TABLE IF NOT EXISTS knowledge_bases (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    embedding_provider TEXT NOT NULL,
    embedding_model TEXT NOT NULL,
    chunk_size INTEGER DEFAULT 512,
    chunk_overlap INTEGER DEFAULT 50,
    document_count INTEGER DEFAULT 0,
    total_chunks INTEGER DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

-- Knowledge base documents
CREATE TABLE IF NOT EXISTS kb_documents (
    id TEXT PRIMARY KEY,
    kb_id TEXT NOT NULL,
    filename TEXT NOT NULL,
    filepath TEXT NOT NULL,
    file_size INTEGER,
    chunk_count INTEGER,
    indexed_at TEXT NOT NULL,
    UNIQUE(kb_id, filepath)
);

-- Tool permissions rules
CREATE TABLE IF NOT EXISTS tool_permissions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    agent_id TEXT,
    tool_name TEXT NOT NULL,
    rule_type TEXT NOT NULL,
    conditions TEXT,
    created_at TEXT NOT NULL,
    UNIQUE(agent_id, tool_name, rule_type)
);

-- Cron schedules
CREATE TABLE IF NOT EXISTS cron_schedules (
    id TEXT PRIMARY KEY,
    target_type TEXT NOT NULL,
    target_id TEXT NOT NULL,
    cron_expr TEXT NOT NULL,
    description TEXT,
    enabled INTEGER NOT NULL DEFAULT 1,
    last_run_at TEXT,
    next_run_at TEXT,
    created_at TEXT NOT NULL
);

-- Cron execution records
CREATE TABLE IF NOT EXISTS cron_executions (
    id TEXT PRIMARY KEY,
    schedule_id TEXT NOT NULL,
    task_id TEXT,
    status TEXT NOT NULL,
    output_summary TEXT,
    started_at TEXT NOT NULL,
    completed_at TEXT,
    error_message TEXT
);

-- System settings
CREATE TABLE IF NOT EXISTS system_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_created ON tasks(created_at);
CREATE INDEX IF NOT EXISTS idx_agents_status ON agents(status);
CREATE INDEX IF NOT EXISTS idx_episodic_agent ON episodic_memories(agent_id);
CREATE INDEX IF NOT EXISTS idx_kb_docs_kb ON kb_documents(kb_id);
"""


async def init_database(db_path: Path):
    """Initialize the SQLite database with all tables."""
    async with aiosqlite.connect(db_path) as db:
        await db.executescript(CREATE_TABLES_SQL)
        await db.commit()

    logger.info("database_initialized", path=str(db_path))


async def get_db(db_path: Path):
    """Get a database connection."""
    db = await aiosqlite.connect(db_path)
    db.row_factory = aiosqlite.Row
    try:
        yield db
    finally:
        await db.close()


class Database:
    """Async database wrapper with helper methods."""

    def __init__(self, db_path: Path):
        self.db_path = db_path

    async def __aenter__(self):
        self.conn = await aiosqlite.connect(self.db_path)
        self.conn.row_factory = aiosqlite.Row
        return self

    async def __aexit__(self, *args):
        await self.conn.close()

    async def execute(self, sql: str, params=None):
        """Execute a query."""
        await self.conn.execute(sql, params)
        await self.conn.commit()

    async def fetchone(self, sql: str, params=None):
        """Fetch one row."""
        async with self.conn.execute(sql, params) as cursor:
            return await cursor.fetchone()

    async def fetchall(self, sql: str, params=None):
        """Fetch all rows."""
        async with self.conn.execute(sql, params) as cursor:
            return await cursor.fetchall()

    async def fetchvalue(self, sql: str, params=None):
        """Fetch a single value."""
        row = await self.fetchone(sql, params)
        return row[0] if row else None
