"""
Tool System - Base abstractions and built-in tools
"""
import asyncio
import json
import uuid
from abc import ABC, abstractmethod
from pathlib import Path
from typing import Any, Optional

import structlog

from backend.models.schemas import ToolDefinition

logger = structlog.get_logger()


class ToolContext:
    """Context passed to tool execution."""

    def __init__(
        self,
        agent_id: str,
        task_id: str,
        workspace_dir: Path,
        allowed_dirs: list[Path] | None = None,
        timeout: int = 60,
    ):
        self.agent_id = agent_id
        self.task_id = task_id
        self.workspace_dir = workspace_dir
        self.allowed_dirs = allowed_dirs or [workspace_dir]
        self.timeout = timeout
        self.metadata: dict = {}


class ToolResult:
    """Result from tool execution."""

    def __init__(
        self,
        success: bool,
        output: Any = None,
        error: Optional[str] = None,
        metadata: Optional[dict] = None,
    ):
        self.success = success
        self.output = output
        self.error = error
        self.metadata = metadata or {}


class Tool(ABC):
    """Base class for all tools."""

    name: str = "base_tool"
    description: str = "A base tool"
    parameters: dict = {}
    risk_level: str = "low"
    requires_confirmation: bool = False

    @abstractmethod
    async def execute(self, params: dict, context: ToolContext) -> ToolResult:
        """Execute the tool with given parameters."""
        pass

    def get_definition(self) -> ToolDefinition:
        """Get tool definition for LLM consumption."""
        return ToolDefinition(
            name=self.name,
            description=self.description,
            parameters=self.parameters,
            risk_level=self.risk_level,
            requires_confirmation=self.requires_confirmation,
        )


class FileSystemGuard:
    """Filesystem access security guard."""

    # Blocked paths for security
    BLOCKED_PATTERNS = [
        "/etc",
        "/sys",
        "/proc",
        "/dev",
        "/.ssh",
        "/.gnupg",
        "C:\\Windows",
        "C:\\Program Files",
        "C:\\Program Files (x86)",
        "C:\\System32",
    ]

    @classmethod
    def validate_path(cls, path: str, allowed_dirs: list[Path]) -> bool:
        """Validate that a path is within allowed directories."""
        try:
            # Normalize the path
            resolved = Path(path).resolve()

            # Check against blocked patterns
            path_str = str(resolved).lower()
            for blocked in cls.BLOCKED_PATTERNS:
                if path_str.startswith(blocked.lower()):
                    return False

            # Check against allowed directories
            for allowed in allowed_dirs:
                allowed_resolved = allowed.resolve()
                try:
                    resolved.relative_to(allowed_resolved)
                    return True
                except ValueError:
                    continue

            return False

        except (ValueError, OSError):
            return False


class FileReaderTool(Tool):
    """Read file contents."""

    name = "file_reader"
    description = "Read the contents of a file. Supports TXT, Markdown, CSV, JSON, and other text-based formats."
    parameters = {
        "type": "object",
        "properties": {
            "path": {"type": "string", "description": "Path to the file to read"}
        },
        "required": ["path"]
    }
    risk_level = "low"

    async def execute(self, params: dict, context: ToolContext) -> ToolResult:
        file_path = params.get("path", "")
        resolved_path = Path(file_path)

        if not FileSystemGuard.validate_path(str(resolved_path), context.allowed_dirs):
            return ToolResult(success=False, error="Access denied: path not in allowed directories")

        if not resolved_path.exists():
            return ToolResult(success=False, error=f"File not found: {file_path}")

        if not resolved_path.is_file():
            return ToolResult(success=False, error=f"Not a file: {file_path}")

        try:
            content = resolved_path.read_text(encoding="utf-8")
            return ToolResult(
                success=True,
                output=content,
                metadata={"path": str(resolved_path), "size": len(content)}
            )
        except Exception as e:
            return ToolResult(success=False, error=f"Read error: {str(e)}")


class FileWriterTool(Tool):
    """Write content to a file."""

    name = "file_writer"
    description = "Write or append content to a file. Use mode 'write' to create/replace, 'append' to add to existing."
    parameters = {
        "type": "object",
        "properties": {
            "path": {"type": "string", "description": "Path to the file"},
            "content": {"type": "string", "description": "Content to write"},
            "mode": {"type": "string", "enum": ["write", "append"], "default": "write"}
        },
        "required": ["path", "content"]
    }
    risk_level = "medium"
    requires_confirmation = True

    async def execute(self, params: dict, context: ToolContext) -> ToolResult:
        file_path = params.get("path", "")
        content = params.get("content", "")
        mode = params.get("mode", "write")

        resolved_path = Path(file_path)

        if not FileSystemGuard.validate_path(str(resolved_path.parent), context.allowed_dirs):
            return ToolResult(success=False, error="Access denied: path not in allowed directories")

        try:
            if mode == "append":
                resolved_path.open("a").write(content)
            else:
                resolved_path.parent.mkdir(parents=True, exist_ok=True)
                resolved_path.write_text(content, encoding="utf-8")

            return ToolResult(
                success=True,
                output=f"Successfully wrote {len(content)} characters to {file_path}",
                metadata={"path": str(resolved_path), "bytes": len(content.encode())}
            )
        except Exception as e:
            return ToolResult(success=False, error=f"Write error: {str(e)}")


class DirectoryListTool(Tool):
    """List directory contents."""

    name = "directory_list"
    description = "List the contents of a directory."
    parameters = {
        "type": "object",
        "properties": {
            "path": {"type": "string", "description": "Path to the directory"},
            "include_hidden": {"type": "boolean", "default": False}
        },
        "required": ["path"]
    }
    risk_level = "low"

    async def execute(self, params: dict, context: ToolContext) -> ToolResult:
        dir_path = Path(params.get("path", "."))
        include_hidden = params.get("include_hidden", False)

        if not FileSystemGuard.validate_path(str(dir_path), context.allowed_dirs):
            return ToolResult(success=False, error="Access denied: path not in allowed directories")

        if not dir_path.exists():
            return ToolResult(success=False, error=f"Directory not found: {dir_path}")

        if not dir_path.is_dir():
            return ToolResult(success=False, error=f"Not a directory: {dir_path}")

        try:
            items = []
            for item in dir_path.iterdir():
                if not include_hidden and item.name.startswith("."):
                    continue
                items.append({
                    "name": item.name,
                    "type": "dir" if item.is_dir() else "file",
                    "size": item.stat().st_size if item.is_file() else 0
                })
            return ToolResult(success=True, output=items)
        except Exception as e:
            return ToolResult(success=False, error=f"List error: {str(e)}")


class DirectoryCreateTool(Tool):
    """Create a directory."""

    name = "directory_create"
    description = "Create a new directory."
    parameters = {
        "type": "object",
        "properties": {
            "path": {"type": "string", "description": "Path of the directory to create"},
            "parents": {"type": "boolean", "default": False}
        },
        "required": ["path"]
    }
    risk_level = "medium"
    requires_confirmation = True

    async def execute(self, params: dict, context: ToolContext) -> ToolResult:
        dir_path = Path(params.get("path", ""))
        parents = params.get("parents", False)

        if not FileSystemGuard.validate_path(str(dir_path), context.allowed_dirs):
            return ToolResult(success=False, error="Access denied: path not in allowed directories")

        try:
            dir_path.mkdir(parents_exist_ok=parents)
            return ToolResult(success=True, output=f"Created directory: {dir_path}")
        except Exception as e:
            return ToolResult(success=False, error=f"Create error: {str(e)}")


class DirectoryDeleteTool(Tool):
    """Delete a directory."""

    name = "directory_delete"
    description = "Delete an empty directory."
    parameters = {
        "type": "object",
        "properties": {
            "path": {"type": "string", "description": "Path of the directory to delete"}
        },
        "required": ["path"]
    }
    risk_level = "high"
    requires_confirmation = True

    async def execute(self, params: dict, context: ToolContext) -> ToolResult:
        dir_path = Path(params.get("path", ""))

        if not FileSystemGuard.validate_path(str(dir_path), context.allowed_dirs):
            return ToolResult(success=False, error="Access denied: path not in allowed directories")

        if not dir_path.exists():
            return ToolResult(success=False, error=f"Directory not found: {dir_path}")

        if not dir_path.is_dir():
            return ToolResult(success=False, error=f"Not a directory: {dir_path}")

        try:
            dir_path.rmdir()
            return ToolResult(success=True, output=f"Deleted directory: {dir_path}")
        except Exception as e:
            return ToolResult(success=False, error=f"Delete error: {str(e)}")


class DesktopNotificationTool(Tool):
    """Send desktop notifications."""

    name = "desktop_notification"
    description = "Send a desktop notification to the user."
    parameters = {
        "type": "object",
        "properties": {
            "title": {"type": "string", "description": "Notification title"},
            "message": {"type": "string", "description": "Notification body"}
        },
        "required": ["title", "message"]
    }
    risk_level = "low"

    async def execute(self, params: dict, context: ToolContext) -> ToolResult:
        title = params.get("title", "")
        message = params.get("message", "")

        # Use platform-specific notification tools
        import platform
        system = platform.system()

        try:
            if system == "Darwin":  # macOS
                import subprocess
                subprocess.run([
                    "osascript", "-e",
                    f'display notification "{message}" with title "{title}"'
                ], check=True)
            elif system == "Linux":
                import subprocess
                subprocess.run(["notify-send", title, message], check=True)
            elif system == "Windows":
                import subprocess
                subprocess.run([
                    "powershell", "-Command",
                    f'[Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] | Out-Null; '
                    f'$xml = [Windows.UI.Notifications.ToastNotificationManager]::GetTemplateContent([Windows.UI.Notifications.ToastTemplateType]::ToastText02); '
                    f'$xml.GetElementsByTagName("text")[0].AppendChild($xml.CreateTextNode("{title}")) | Out-Null; '
                    f'$xml.GetElementsByTagName("text")[1].AppendChild($xml.CreateTextNode("{message}")) | Out-Null; '
                    f'$toast = [Windows.UI.Notifications.ToastNotification]::new($xml); '
                    f'[Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier("DigitalCrew").Show($toast)'
                ], check=True)
            else:
                return ToolResult(success=False, error=f"Unsupported platform: {system}")

            return ToolResult(success=True, output=f"Notification sent: {title}")
        except Exception as e:
            return ToolResult(success=False, error=f"Notification error: {str(e)}")


class KnowledgeRetrievalTool(Tool):
    """RAG knowledge retrieval from local vector database."""

    name = "knowledge_retrieval"
    description = "Search the knowledge base for relevant information."
    parameters = {
        "type": "object",
        "properties": {
            "kb_id": {"type": "string", "description": "Knowledge base ID"},
            "query": {"type": "string", "description": "Search query"},
            "top_k": {"type": "number", "default": 5}
        },
        "required": ["kb_id", "query"]
    }
    risk_level = "low"

    async def execute(self, params: dict, context: ToolContext) -> ToolResult:
        kb_id = params.get("kb_id", "")
        query = params.get("query", "")
        top_k = params.get("top_k", 5)

        try:
            from backend.memory.knowledge import KnowledgeMemory
            from backend.core.config import DATABASE_PATH

            kb = KnowledgeMemory(DATABASE_PATH)
            results = await kb.search(kb_id, query, top_k)

            return ToolResult(
                success=True,
                output=[r.model_dump() for r in results],
                metadata={"kb_id": kb_id, "query": query, "result_count": len(results)}
            )
        except Exception as e:
            return ToolResult(success=False, error=f"Retrieval error: {str(e)}")


class ToolRegistry:
    """Registry for all available tools."""

    def __init__(self):
        self._tools: dict[str, Tool] = {}
        self._mcp_tools: dict[str, Tool] = {}

    def register_builtin(self, tool: Tool):
        """Register a built-in tool."""
        self._tools[tool.name] = tool
        logger.info("tool_registered", name=tool.name, risk_level=tool.risk_level)

    def register_mcp(self, tool: Tool, server_name: str):
        """Register an MCP tool."""
        self._mcp_tools[tool.name] = tool
        logger.info("mcp_tool_registered", name=tool.name, server=server_name)

    def get_tool(self, name: str) -> Tool | None:
        """Get a tool by name."""
        return self._tools.get(name) or self._mcp_tools.get(name)

    def list_tools(self, include_mcp: bool = True) -> list[ToolDefinition]:
        """List all available tool definitions."""
        tools = [t.get_definition() for t in self._tools.values()]
        if include_mcp:
            tools.extend(t.get_definition() for t in self._mcp_tools.values())
        return tools

    def list_builtin_tools(self) -> list[Tool]:
        """List all built-in tool instances."""
        return list(self._tools.values())


# Global registry with all built-in tools
tool_registry = ToolRegistry()

# Register built-in tools
tool_registry.register_builtin(FileReaderTool())
tool_registry.register_builtin(FileWriterTool())
tool_registry.register_builtin(DirectoryListTool())
tool_registry.register_builtin(DirectoryCreateTool())
tool_registry.register_builtin(DirectoryDeleteTool())
tool_registry.register_builtin(DesktopNotificationTool())
tool_registry.register_builtin(KnowledgeRetrievalTool())