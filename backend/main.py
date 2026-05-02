"""
DigitalCrew Backend - FastAPI Application (updated with services)
"""
import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from backend.api.routes import agents, tasks, chat, knowledge, tools, system
from backend.services.agent_manager import agent_manager
from backend.services.task_scheduler import task_scheduler
from backend.services.llm_router import llm_router
from backend.core.config import BASE_DIR, CONFIG_DIR, DATA_DIR, WORKSPACE_DIR, KNOWLEDGE_DIR, LOGS_DIR, BACKUPS_DIR, DATABASE_PATH

# Ensure directories exist
for dir_path in [CONFIG_DIR, DATA_DIR, WORKSPACE_DIR, KNOWLEDGE_DIR, LOGS_DIR, BACKUPS_DIR]:
    dir_path.mkdir(parents=True, exist_ok=True)


def create_app() -> FastAPI:
    app = FastAPI(
        title="DigitalCrew API",
        description="本地多 Agent 协同工作台后端 API",
        version="0.1.0",
        docs_url="/api/docs",
        redoc_url="/api/redoc",
    )

    # CORS for local development
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["http://localhost:3000", "http://localhost:5173", "http://localhost:8000", "http://127.0.0.1:3000", "http://127.0.0.1:5173", "http://127.0.0.1:8000"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Register routes
    app.include_router(agents.router, prefix="/api/v1/agents", tags=["agents"])
    app.include_router(tasks.router, prefix="/api/v1/tasks", tags=["tasks"])
    app.include_router(chat.router, prefix="/api/v1/chat", tags=["chat"])
    app.include_router(knowledge.router, prefix="/api/v1/knowledge", tags=["knowledge"])
    app.include_router(tools.router, prefix="/api/v1/tools", tags=["tools"])
    app.include_router(system.router, prefix="/api/v1", tags=["system"])

    @app.on_event("startup")
    async def startup():
        """Initialize services on startup."""
        await agent_manager.initialize()
        await task_scheduler.initialize()
        # Initialize database tables
        from backend.utils.db import init_database
        await init_database(DATABASE_PATH)

    @app.on_event("shutdown")
    async def shutdown():
        """Cleanup on shutdown."""
        pass

    @app.get("/api/health")
    async def health_check():
        return {"status": "healthy", "version": "0.1.0"}

    # Store paths in app state
    app.state.base_dir = BASE_DIR
    app.state.config_dir = CONFIG_DIR
    app.state.data_dir = DATA_DIR
    app.state.workspace_dir = WORKSPACE_DIR
    app.state.knowledge_dir = KNOWLEDGE_DIR
    app.state.logs_dir = LOGS_DIR
    app.state.backups_dir = BACKUPS_DIR
    app.state.database_path = DATABASE_PATH
    app.state.agent_manager = agent_manager
    app.state.task_scheduler = task_scheduler
    app.state.llm_router = llm_router

    return app


app = create_app()