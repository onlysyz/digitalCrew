"""
Structured logging utilities
"""
import sys
import structlog

from structlog.processors import JSONRenderer
from structlog.processors import TimeStamper
from structlog.processors import add_log_level

from pathlib import Path


def configure_logging(log_dir: Path | None = None, level: str = "INFO"):
    """Configure structured logging."""

    processors = [
        structlog.contextvars.merge_contextvars,
        structlog.stdlib.add_log_level,
        structlog.stdlib.add_logger_name,
        TimeStamper(fmt="iso"),
        structlog.processors.StackInfoRenderer(),
        structlog.dev.set_log_format,
    ]

    if log_dir:
        log_dir.mkdir(parents=True, exist_ok=True)
        log_file = log_dir / "system.jsonl"

        # File logger (JSONL)
        file_handler = open(log_file, "a")
        processors.append(JSONRenderer())

        structlog.configure(
            processors=processors + [lambda logger, method_name, event_dict, file=file_handler: (
                file.write(structlog.processors.JSONRenderer()(None, method_name, event_dict) + "\n")
            )],
            wrapper_class=structlog.stdlib.ProxyLogger,
            context_class=dict,
            logger_factory=structlog.PrintLoggerFactory(file=sys.stdout),
            cache_logger_on_first_use=True,
        )
    else:
        structlog.configure(
            processors=processors + [
                structlog.dev.ConsoleRenderer(colors=True)
            ],
            wrapper_class=structlog.stdlib.ProxyLogger,
            context_class=dict,
            logger_factory=structlog.PrintLoggerFactory(),
            cache_logger_on_first_use=True,
        )

    return structlog.get_logger()
