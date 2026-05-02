"""
Tool Registry - Fixed imports for network tools
"""
from backend.tools.base import (
    Tool,
    ToolContext,
    ToolResult,
    FileSystemGuard,
    tool_registry,
)
from backend.tools.code_execution import CodeExecutionTool
from backend.tools.network import WebSearchTool, WebScrapeTool

# Register code execution tool
tool_registry.register_builtin(CodeExecutionTool())

# Register network tools
tool_registry.register_builtin(WebSearchTool())
tool_registry.register_builtin(WebScrapeTool())

__all__ = [
    "Tool",
    "ToolContext",
    "ToolResult",
    "FileSystemGuard",
    "tool_registry",
    "CodeExecutionTool",
    "WebSearchTool",
    "WebScrapeTool",
]