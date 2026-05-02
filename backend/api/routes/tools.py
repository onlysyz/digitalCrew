"""
Tools API Routes
"""
from fastapi import APIRouter, HTTPException

from backend.models.schemas import ToolDefinition

router = APIRouter()

# Built-in tools
BUILT_IN_TOOLS = [
    ToolDefinition(
        name="file_reader",
        description="读取文件内容，支持 TXT/PDF/Word/Excel/Markdown/CSV",
        parameters={
            "type": "object",
            "properties": {
                "path": {"type": "string", "description": "文件路径"}
            },
            "required": ["path"]
        },
        risk_level="low",
        requires_confirmation=False
    ),
    ToolDefinition(
        name="file_writer",
        description="写入或追加文件内容",
        parameters={
            "type": "object",
            "properties": {
                "path": {"type": "string"},
                "content": {"type": "string"},
                "mode": {"type": "string", "enum": ["write", "append"]}
            },
            "required": ["path", "content"]
        },
        risk_level="medium",
        requires_confirmation=True
    ),
    ToolDefinition(
        name="code_execution",
        description="在沙箱中执行 Python 代码",
        parameters={
            "type": "object",
            "properties": {
                "code": {"type": "string"},
                "timeout": {"type": "number", "default": 60}
            },
            "required": ["code"]
        },
        risk_level="medium",
        requires_confirmation=True
    ),
    ToolDefinition(
        name="web_search",
        description="执行网络搜索",
        parameters={
            "type": "object",
            "properties": {
                "query": {"type": "string"},
                "limit": {"type": "number", "default": 5}
            },
            "required": ["query"]
        },
        risk_level="low",
        requires_confirmation=False
    ),
    ToolDefinition(
        name="web_scrape",
        description="抓取网页内容并转换为 Markdown",
        parameters={
            "type": "object",
            "properties": {
                "url": {"type": "string", "format": "uri"}
            },
            "required": ["url"]
        },
        risk_level="low",
        requires_confirmation=False
    ),
    ToolDefinition(
        name="knowledge_retrieval",
        description="在知识库中进行语义检索",
        parameters={
            "type": "object",
            "properties": {
                "kb_id": {"type": "string"},
                "query": {"type": "string"},
                "top_k": {"type": "number", "default": 5}
            },
            "required": ["kb_id", "query"]
        },
        risk_level="low",
        requires_confirmation=False
    ),
    ToolDefinition(
        name="shell_command",
        description="执行本地 Shell 命令（高危，默认禁用）",
        parameters={
            "type": "object",
            "properties": {
                "command": {"type": "string"}
            },
            "required": ["command"]
        },
        risk_level="high",
        requires_confirmation=True
    ),
    ToolDefinition(
        name="desktop_notification",
        description="发送桌面通知",
        parameters={
            "type": "object",
            "properties": {
                "title": {"type": "string"},
                "message": {"type": "string"}
            },
            "required": ["title", "message"]
        },
        risk_level="low",
        requires_confirmation=False
    ),
]


@router.get("")
async def list_tools():
    """List all available tools"""
    return {"tools": BUILT_IN_TOOLS, "total": len(BUILT_IN_TOOLS)}


@router.get("/{tool_name}")
async def get_tool(tool_name: str):
    """Get tool details"""
    for tool in BUILT_IN_TOOLS:
        if tool.name == tool_name:
            return {"tool": tool}
    raise HTTPException(status_code=404, detail="Tool not found")


@router.put("/{tool_name}/permissions")
async def update_tool_permissions(tool_name: str, enabled: bool):
    """Update tool permission for an agent"""
    return {"message": f"Tool {tool_name} permission updated", "enabled": enabled}


# MCP tools placeholder
@router.get("/mcp")
async def list_mcp_tools():
    """List MCP extension tools"""
    return {"tools": [], "total": 0, "message": "No MCP servers configured"}