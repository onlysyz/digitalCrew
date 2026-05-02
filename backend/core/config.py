"""
Core configuration - path constants shared across modules
"""
from pathlib import Path

BASE_DIR = Path.home() / "DigitalCrew"
CONFIG_DIR = BASE_DIR / "config"
DATA_DIR = BASE_DIR / "data"
WORKSPACE_DIR = BASE_DIR / "workspace"
KNOWLEDGE_DIR = BASE_DIR / "knowledge"
LOGS_DIR = BASE_DIR / "logs"
BACKUPS_DIR = BASE_DIR / "backups"
DATABASE_PATH = DATA_DIR / "db.sqlite"
