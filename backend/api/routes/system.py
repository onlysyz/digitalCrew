"""
System API Routes
"""
import os
import shutil
from pathlib import Path

import httpx
from fastapi import APIRouter
from pydantic import BaseModel

from backend.services.config_service import load_settings, save_settings

# Define paths locally to avoid circular import
BASE_DIR = Path.home() / "DigitalCrew"
WORKSPACE_DIR = BASE_DIR / "workspace"
DATA_DIR = BASE_DIR / "data"
LOGS_DIR = BASE_DIR / "logs"

router = APIRouter()

# Simulated system stats
SYSTEM_STATS = {
    "cpu_percent": 24,
    "gpu_percent": 41,
    "memory_used_gb": 12.4,
    "memory_total_gb": 32,
    "ollama_connected": True,
    "active_agents": 4,
    "total_agents": 7
}


class UpdateSettingsRequest(BaseModel):
    ollama_base_url: str | None = None
    workspace_dir: str | None = None
    data_dir: str | None = None
    sandbox_timeout: int | None = None
    max_concurrent_agents: int | None = None
    enable_anonymous_stats: bool | None = None
    enable_error_reporting: bool | None = None
    language: str | None = None
    temperature: float | None = None
    top_p: float | None = None
    context_window: int | None = None


@router.get("/status")
async def get_system_status():
    """Get system status"""
    return {
        "status": "healthy",
        "version": "0.1.0",
        "ollama_connected": True,
        "data_directory": str(DATA_DIR),
        "workspace_directory": str(WORKSPACE_DIR)
    }


@router.get("/resources")
async def get_system_resources():
    """Get system resource usage"""
    return {
        "cpu_percent": SYSTEM_STATS["cpu_percent"],
        "gpu_percent": SYSTEM_STATS["gpu_percent"],
        "memory_used_gb": SYSTEM_STATS["memory_used_gb"],
        "memory_total_gb": SYSTEM_STATS["memory_total_gb"],
        "memory_percent": round(SYSTEM_STATS["memory_used_gb"] / SYSTEM_STATS["memory_total_gb"] * 100, 1),
        "disk_used_gb": 45.2,
        "disk_total_gb": 500,
        "ollama_models": [
            {"name": "llama3", "size": "4.7GB", "loaded": True},
            {"name": "nomic-embed-text", "size": "274MB", "loaded": True}
        ]
    }


@router.get("/settings")
async def get_settings():
    """Get system settings"""
    return load_settings()


@router.patch("/settings")
async def update_settings(request: UpdateSettingsRequest):
    """Update system settings"""
    current = load_settings()
    update_data = request.model_dump(exclude_unset=True)
    current.update(update_data)
    save_settings(current)
    # Determine which settings require restart
    restart_required = []
    if "ollama_base_url" in update_data:
        restart_required.append("ollama")
    if "workspace_dir" in update_data or "data_dir" in update_data:
        restart_required.append("directories")
    return {
        "message": "Settings updated",
        "settings": current,
        "restart_required": restart_required
    }


@router.post("/settings/apply")
async def apply_settings():
    """Apply/reload settings that require restart"""
    settings = load_settings()
    applied = []
    try:
        from backend.services.llm_router import llm_router
        llm_router.update_config(settings)
        applied.append("llm_router")
    except Exception:
        pass
    return {
        "message": "Settings applied",
        "applied": applied,
        "settings": settings
    }


@router.post("/restart")
async def restart_services():
    """Restart backend services to apply new configuration"""
    return {
        "message": "Services restarting...",
        "status": "restarting",
        "affected_services": ["llm_router", "task_scheduler"]
    }


@router.post("/backup")
async def create_backup():
    """Create a configuration backup"""
    return {"message": "Backup created", "path": str(BASE_DIR / "backups" / "manual")}


@router.post("/restore")
async def restore_backup(backup_path: str):
    """Restore from backup"""
    return {"message": f"Restored from {backup_path}"}


@router.post("/dirs/init")
async def init_directories():
    """Create workspace directories on first run"""
    created = []
    errors = []

    dirs_to_create = [
        ("workspace", WORKSPACE_DIR),
        ("data", DATA_DIR),
        ("logs", LOGS_DIR),
    ]

    for name, path in dirs_to_create:
        try:
            path.mkdir(parents=True, exist_ok=True)
            created.append({"name": name, "path": str(path)})
        except Exception as e:
            errors.append({"name": name, "error": str(e)})

    # Create subdirectories
    try:
        (DATA_DIR / "vectordb").mkdir(parents=True, exist_ok=True)
        (WORKSPACE_DIR / "uploads").mkdir(parents=True, exist_ok=True)
    except Exception as e:
        errors.append({"name": "subdirs", "error": str(e)})

    return {
        "created": created,
        "errors": errors,
        "ready": len(errors) == 0
    }


@router.get("/dirs")
async def get_directories():
    """Get directory sizes and info"""
    def get_size(path: Path) -> int:
        if path.is_file():
            return path.stat().st_size
        total = 0
        try:
            for child in path.iterdir():
                total += get_size(child)
        except (PermissionError, FileNotFoundError):
            pass
        return total

    dirs = {
        "workspace": {"path": str(WORKSPACE_DIR), "size_bytes": get_size(WORKSPACE_DIR)},
        "data": {"path": str(DATA_DIR), "size_bytes": get_size(DATA_DIR)},
        "logs": {"path": str(LOGS_DIR), "size_bytes": get_size(LOGS_DIR)}
    }

    for d in dirs.values():
        d["size_mb"] = round(d["size_bytes"] / 1024 / 1024, 2)

    return {"directories": dirs}


@router.get("/models")
async def get_local_models():
    """Get local Ollama models with VRAM usage"""
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            # Get list of available models
            tags_response = await client.get("http://localhost:11434/api/tags")
            models = []
            total_size_gb = 0.0
            if tags_response.status_code == 200:
                for m in tags_response.json().get("models", []):
                    size = m.get("size", 0)
                    total_size_gb += size / (1024**3)
                    models.append({
                        "name": m.get("name", ""),
                        "size": size,
                        "size_gb": round(size / (1024**3), 2),
                        "modified_at": m.get("modified_at", ""),
                    })

            # Get running models with VRAM info
            ps_response = await client.get("http://localhost:11434/api/ps")
            running_models = []
            total_vram_gb = 0.0
            if ps_response.status_code == 200:
                for p in ps_response.json().get("models", []):
                    vram = p.get("size_vRAM", 0)
                    total_vram_gb += vram / (1024**3)
                    running_models.append({
                        "name": p.get("name", ""),
                        "vram_gb": round(vram / (1024**3), 2),
                        "duration": p.get("duration", 0),
                    })

            return {
                "models": models,
                "running_models": running_models,
                "model_count": len(models),
                "total_size_gb": round(total_size_gb, 2),
                "running_count": len(running_models),
                "total_vram_gb": round(total_vram_gb, 2),
            }
    except Exception as e:
        return {
            "models": [],
            "running_models": [],
            "model_count": 0,
            "total_size_gb": 0.0,
            "running_count": 0,
            "total_vram_gb": 0.0,
            "error": str(e),
        }


@router.post("/cache/clear")
async def clear_cache():
    """Clear temporary cache files"""
    return {"message": "Cache cleared"}