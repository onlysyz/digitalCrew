"""
Settings persistence service - stores config in JSON file
"""
import json
import os
from pathlib import Path
from typing import Any

CONFIG_FILE = Path.home() / "DigitalCrew" / "config" / "settings.json"


def _ensure_config_dir():
    CONFIG_FILE.parent.mkdir(parents=True, exist_ok=True)


def load_settings() -> dict[str, Any]:
    """Load settings from JSON file"""
    _ensure_config_dir()
    if CONFIG_FILE.exists():
        try:
            with open(CONFIG_FILE, 'r') as f:
                return json.load(f)
        except (json.JSONDecodeError, IOError):
            pass
    return _default_settings()


def save_settings(settings: dict[str, Any]) -> dict[str, Any]:
    """Save settings to JSON file"""
    _ensure_config_dir()
    with open(CONFIG_FILE, 'w') as f:
        json.dump(settings, f, indent=2)
    return settings


def _default_settings() -> dict[str, Any]:
    """Default settings"""
    return {
        "ollama_base_url": os.environ.get("OLLAMA_BASE_URL", "http://localhost:11434"),
        "workspace_dir": str(Path.home() / "DigitalCrew" / "workspace"),
        "data_dir": str(Path.home() / "DigitalCrew" / "data"),
        "sandbox_timeout": 60,
        "max_concurrent_agents": 5,
        "enable_anonymous_stats": False,
        "enable_error_reporting": False,
        "language": "zh",
        "temperature": 0.7,
        "top_p": 0.9,
        "context_window": 8192,
    }