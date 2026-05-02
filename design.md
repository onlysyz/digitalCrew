# DigitalCrew 技术设计文档

**文档版本：** v1.0
**基于 PRD 版本：** v1.0
**最后更新：** 2026-05-02
**文档状态：** 草稿

---

## 一、系统架构概览

### 1.1 分层架构

```
┌─────────────────────────────────────────────────────────┐
│                    展示层 (Presentation)                  │
│           Electron Shell / Web Browser                   │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐    │
│  │ 工作台    │ │ 对话面板  │ │ 任务中心  │ │ 设置页   │    │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘    │
├─────────────────────────────────────────────────────────┤
│                    通信层 (Transport)                     │
│            REST API + WebSocket (SSE)                     │
├─────────────────────────────────────────────────────────┤
│                    服务层 (Service)                       │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐    │
│  │ Agent    │ │ 任务     │ │ 知识库    │ │ 记忆     │    │
│  │ Manager  │ │ Scheduler│ │ RAG Svc  │ │ Memory   │    │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘    │
├─────────────────────────────────────────────────────────┤
│                    运行时层 (Runtime)                     │
│  ┌──────────────────────────────────────────────────┐    │
│  │            Agent Runtime (协程池)                 │    │
│  │  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐    │    │
│  │  │ Agent1 │ │ Agent2 │ │ Agent3 │ │ AgentN │    │    │
│  │  └────────┘ └────────┘ └────────┘ └────────┘    │    │
│  └──────────────────────────────────────────────────┘    │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐                  │
│  │ LLM 路由 │ │ 工具执行 │ │ 通信总线  │                  │
│  └──────────┘ └──────────┘ └──────────┘                  │
├─────────────────────────────────────────────────────────┤
│                    基础设施层 (Infra)                     │
│  ┌────────┐ ┌──────────┐ ┌────────┐ ┌──────────┐        │
│  │ SQLite │ │ ChromaDB │ │ Ollama │ │ Docker   │        │
│  └────────┘ └──────────┘ └────────┘ └──────────┘        │
└─────────────────────────────────────────────────────────┘
```

### 1.2 核心技术栈

| 层次 | 技术 | 版本 | 说明 |
|------|------|------|------|
| 前端框架 | React + TypeScript | 18.x / 5.x | SPA，Vite 构建 |
| 桌面封装 | Electron | 30.x | 内嵌后端进程 |
| 后端框架 | Python + FastAPI | 3.11+ / 0.111+ | 异步 HTTP + WebSocket |
| Agent 编排 | LangGraph | 0.2+ | 有状态图执行引擎 |
| 结构化存储 | SQLite + SQLAlchemy | 3.45+ / 2.0+ | 零配置本地数据库 |
| 向量存储 | ChromaDB | 0.5+ | 本地持久化向量库 |
| 本地模型 | Ollama | 0.3+ | OpenAI 兼容 API |
| 代码沙箱 | Docker / venv | - | 隔离执行环境 |
| 网页抓取 | Playwright | 1.44+ | 支持 JS 渲染 |
| 工具协议 | MCP | - | 标准工具扩展 |

---

## 二、模块设计

### 2.1 Agent 管理模块

#### 2.1.1 数据模型

```python
# Agent 配置 (YAML 持久化 + SQLAlchemy ORM)
class AgentConfig:
    id: str                          # UUID
    name: str                        # 名称，最长 20 字符
    avatar: str                      # 头像路径或预设 ID
    description: str                 # 职位描述，最长 50 字符
    tags: list[str]                  # 标签列表
    role: str                        # supervisor | worker
    model_config: ModelConfig        # 模型配置
    system_prompt: str               # 角色指令，支持变量占位符
    tool_permissions: dict[str, bool]  # 工具权限映射
    memory_config: MemoryConfig      # 记忆配置
    status: AgentStatus              # 运行状态
    created_at: datetime
    updated_at: datetime
    is_archived: bool

class ModelConfig:
    provider: str                    # ollama | openai_compatible
    model_name: str                  # 模型名称
    api_key: str | None              # 云端 API Key（加密存储）
    base_url: str | None             # 自定义 Base URL
    context_window: int              # 上下文窗口长度
    temperature: float               # 0.0 - 2.0
    top_p: float                     # 0.0 - 1.0
    max_output_tokens: int           # 最大输出 Token

class MemoryConfig:
    episodic_enabled: bool           # 是否启用情景记忆
    knowledge_enabled: bool          # 是否启用知识记忆
    knowledge_base_ids: list[str]    # 绑定的知识库 ID 列表
```

#### 2.1.2 状态机

```
         ┌───────────────────────────────┐
         │                               │
         ▼                               │
    ┌─────────┐   分配任务   ┌──────────┐│
    │  Idle   │─────────────▶│ Running  ││
    └─────────┘              └──────────┘│
         ▲                    │    │     │
         │           暂停     │    │错误  │
         │            ┌───────┘    │     │
         │            ▼            ▼     │
         │      ┌──────────┐ ┌────────┐ │
         │      │  Paused  │ │ Error  │ │
         │      └──────────┘ └────────┘ │
         │            │            │     │
         │       恢复  │       重试│     │
         │            └────────────┘     │
         │                               │
         │         任务完成 / 终止         │
         └───────────────────────────────┘
```

#### 2.1.3 核心服务接口

```python
class AgentManager:
    """Agent 生命周期管理"""

    async def create_agent(self, config: AgentConfig) -> Agent:
        """创建 Agent，写入配置文件与数据库"""

    async def update_agent(self, agent_id: str, updates: dict) -> Agent:
        """更新 Agent 配置"""

    async def delete_agent(self, agent_id: str) -> None:
        """删除 Agent（二次确认后）"""

    async def archive_agent(self, agent_id: str) -> None:
        """归档 Agent"""

    async def get_agent(self, agent_id: str) -> Agent:
        """获取 Agent 详情"""

    async def list_agents(self, filters: dict) -> list[Agent]:
        """列出 Agent，支持按状态、标签筛选"""

    async def start_agent(self, agent_id: str) -> None:
        """启动 Agent 运行时"""

    async def pause_agent(self, agent_id: str) -> None:
        """暂停 Agent"""

    async def resume_agent(self, agent_id: str) -> None:
        """恢复 Agent"""

    async def terminate_agent(self, agent_id: str) -> None:
        """强制终止 Agent"""

    async def clear_memory(self, agent_id: str, memory_type: str) -> None:
        """清空指定类型的记忆"""
```

### 2.2 任务系统模块

#### 2.2.1 数据模型

```python
class Task:
    id: str                          # UUID
    description: str                 # 任务描述
    status: TaskStatus               # pending | assigned | running | completed | failed | cancelled
    priority: int                    # 优先级
    assigned_agents: list[str]       # 分配的 Agent ID 列表
    parent_task_id: str | None       # 父任务 ID（子任务场景）
    subtasks: list[str]              # 子任务 ID 列表
    dependencies: list[str]          # 依赖的前置任务 ID
    input_data: dict                 # 输入数据
    output_data: dict                # 输出结果
    react_trace: list[ReactStep]     # 完整 ReAct 链路
    created_at: datetime
    started_at: datetime | None
    completed_at: datetime | None
    timeout_seconds: int             # 超时时间

class ReactStep:
    step_id: int
    timestamp: datetime
    thought: str                     # Agent 思考内容
    action: str                      # 执行的动作
    action_input: dict               # 动作参数
    observation: str                 # 工具返回结果
    token_usage: TokenUsage          # Token 用量

class TaskStatus(str, Enum):
    PENDING = "pending"
    ASSIGNED = "assigned"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"
    PAUSED = "paused"                # 用户介入暂停
```

#### 2.2.2 任务调度器设计

```python
class TaskScheduler:
    """任务调度与生命周期管理"""

    def __init__(self):
        self._queue: asyncio.PriorityQueue  # 任务队列
        self._active_tasks: dict[str, Task]  # 活跃任务映射
        self._agent_pool: AgentRuntimePool   # Agent 运行时池

    async def submit_task(self, request: TaskRequest) -> Task:
        """提交即时任务"""
        # 1. 判断是否需要主管 Agent 介入
        # 2. 创建任务记录
        # 3. 入队或直接分配

    async def dispatch_task(self, task: Task) -> None:
        """分配任务给 Agent"""
        # 1. 检查依赖是否满足
        # 2. 选择合适的 Agent（负载均衡 + 能力匹配）
        # 3. 将任务推入 Agent 运行时

    async def on_task_complete(self, task_id: str, result: dict) -> None:
        """任务完成回调"""
        # 1. 更新任务状态
        # 2. 通知主管 Agent（如果有后续子任务）
        # 3. 推送前端更新

    async def on_task_failed(self, task_id: str, error: Exception) -> None:
        """任务失败回调"""
        # 1. 记录错误日志
        # 2. 通知主管 Agent 决定重试或上报
        # 3. 推送前端错误通知

    async def cancel_task(self, task_id: str) -> None:
        """取消任务"""

    async def pause_task(self, task_id: str) -> None:
        """暂停任务（用户介入）"""

    async def resume_task(self, task_id: str, user_input: str | None = None) -> None:
        """恢复任务，可选附加用户补充指令"""
```

#### 2.2.3 定时任务引擎（v2.0）

```python
class CronScheduler:
    """定时任务调度器"""

    async def add_schedule(self, schedule: CronSchedule) -> str:
        """添加定时任务"""
        # 解析 Cron 表达式或自然语言时间描述

    async def remove_schedule(self, schedule_id: str) -> None:
        """移除定时任务"""

    async def toggle_schedule(self, schedule_id: str, enabled: bool) -> None:
        """启用/禁用定时任务"""

    async def list_schedules(self) -> list[CronSchedule]:
        """列出所有定时任务"""

    async def get_execution_history(self, schedule_id: str, limit: int = 30) -> list[ExecutionRecord]:
        """获取执行历史"""
```

### 2.3 多 Agent 协同模块

#### 2.3.1 主管 Agent 运行时

```python
class SupervisorRuntime:
    """主管 Agent 运行时"""

    async def execute(self, goal: str, available_agents: list[Agent]) -> SupervisorResult:
        """
        主管模式执行流程:
        1. 接收用户高层目标
        2. 调用 LLM 制定执行计划
        3. 拆解为子任务并分配
        4. 调度执行（支持并行）
        5. 监控子任务状态
        6. 整合结果返回
        """

    async def _decompose_task(self, goal: str, agents: list[Agent]) -> list[SubTask]:
        """任务拆解：LLM 分析目标，生成子任务列表"""

    async def _build_execution_plan(self, subtasks: list[SubTask]) -> ExecutionPlan:
        """构建执行计划：确定依赖关系，生成 DAG"""

    async def _execute_plan(self, plan: ExecutionPlan) -> dict:
        """按 DAG 顺序执行，无依赖的子任务并行"""

    async def _integrate_results(self, results: dict[str, any]) -> str:
        """整合所有子任务结果，生成最终输出"""

    async def _handle_failure(self, failed_task: SubTask, error: Exception) -> RetryDecision:
        """处理失败：重试 / 换 Agent / 上报用户"""
```

#### 2.3.2 Agent 通信总线

```python
class AgentMessageBus:
    """Agent 间异步消息通信"""

    def __init__(self):
        self._queues: dict[str, asyncio.Queue[AgentMessage]] = {}

    async def register_agent(self, agent_id: str) -> None:
        """注册 Agent 到消息总线"""

    async def unregister_agent(self, agent_id: str) -> None:
        """注销 Agent"""

    async def send_message(self, sender: str, receiver: str, message: AgentMessage) -> None:
        """发送消息给指定 Agent"""

    async def broadcast(self, sender: str, message: AgentMessage) -> None:
        """广播消息给所有 Agent"""

    async def receive(self, agent_id: str, timeout: float | None = None) -> AgentMessage:
        """接收消息（阻塞等待）"""
```

#### 2.3.3 群聊模式（v2.0）

```python
class SwarmSession:
    """群聊协同会话"""

    def __init__(self, participants: list[Agent], max_rounds: int = 20):
        self.participants = participants
        self.max_rounds = max_rounds
        self.shared_context: list[ChatMessage] = []

    async def run(self, topic: str, user_overrides: list[str] | None = None) -> list[ChatMessage]:
        """
        群聊执行:
        1. 注入话题作为首条消息
        2. 当前发言 Agent 生成回复
        3. 回复中指定 next_agent（或由用户手动指定）
        4. 重复直到达到最大轮次或 Agent 决定结束
        """
```

### 2.4 工具模块

#### 2.4.1 工具抽象层

```python
from abc import ABC, abstractmethod

class Tool(ABC):
    """工具基类"""

    name: str                        # 工具名称
    description: str                 # 工具描述（供 LLM 理解）
    parameters: dict                 # JSON Schema 参数定义
    risk_level: str                  # low | medium | high
    requires_confirmation: bool      # 是否需要用户确认

    @abstractmethod
    async def execute(self, params: dict, context: ToolContext) -> ToolResult:
        """执行工具"""

class ToolContext:
    agent_id: str
    task_id: str
    workspace_dir: Path              # 工作目录
    allowed_dirs: list[Path]         # 允许访问的目录白名单
    timeout: int                     # 超时时间

class ToolResult:
    success: bool
    output: any                      # 输出内容
    error: str | None                # 错误信息
    metadata: dict                   # 附加元数据
```

#### 2.4.2 内置工具实现

```python
# 文件系统工具
class FileReaderTool(Tool):
    """读取文件，支持 TXT/PDF/Word/Excel/Markdown/CSV"""

class FileWriterTool(Tool):
    """写入/追加文件"""

class DirectoryListTool(Tool):
    """列出目录内容"""

class DirectoryCreateTool(Tool):
    """创建目录"""

class DirectoryDeleteTool(Tool):
    """删除目录"""

# 代码执行工具
class CodeExecutionTool(Tool):
    """
    在沙箱中执行 Python 代码
    - 优先使用 Docker 容器（网络隔离）
    - 降级使用 venv 隔离环境
    - 超时默认 60 秒
    - 支持 pip install 临时依赖
    """

# 网络工具
class WebSearchTool(Tool):
    """调用搜索 API（Tavily/SerpAPI/Bing）"""

class WebScrapeTool(Tool):
    """抓取网页内容，转换为 Markdown，支持 JS 渲染"""

# 知识库工具
class KnowledgeRetrievalTool(Tool):
    """在本地向量库中 RAG 检索，返回 Top-K 相关段落"""

# 系统工具（高危）
class ShellCommandTool(Tool):
    """执行 Shell 命令，默认禁用，需二次确认"""

# 通知工具
class DesktopNotificationTool(Tool):
    """发送操作系统桌面通知"""
```

#### 2.4.3 MCP 扩展工具

```python
class MCPToolAdapter(Tool):
    """MCP Server 工具适配器"""

    def __init__(self, mcp_server: MCPServerConfig, tool_def: MCPToolDefinition):
        self._server = mcp_server
        self._client: MCPClient | None = None

    async def connect(self) -> None:
        """连接到 MCP Server"""

    async def execute(self, params: dict, context: ToolContext) -> ToolResult:
        """通过 MCP 协议调用远程工具"""

    async def disconnect(self) -> None:
        """断开连接"""

class MCPRegistry:
    """MCP Server 注册与发现"""

    async def register_server(self, config: MCPServerConfig) -> None:
        """注册 MCP Server"""

    async def discover_tools(self) -> list[MCPToolAdapter]:
        """启动时自动发现所有已注册 Server 的工具"""

    async def list_tools(self) -> list[ToolDescription]:
        """列出所有可用的 MCP 工具"""
```

#### 2.4.4 工具权限与确认机制

```python
class ToolPermissionManager:
    """工具权限管理"""

    async def check_permission(self, agent_id: str, tool_name: str) -> PermissionResult:
        """
        检查权限:
        1. Agent 配置中是否授权该工具
        2. 是否有 "始终允许" 的用户规则
        3. 工具的风险等级
        """

    async def request_confirmation(self, agent_id: str, tool_name: str, params: dict) -> ConfirmationResult:
        """
        请求用户确认（高风险操作）:
        - 通过 WebSocket 推送确认请求到前端
        - 等待用户响应（允许本次 / 始终允许 / 拒绝）
        """

    async def add_always_allow_rule(self, agent_id: str, tool_name: str, conditions: dict) -> None:
        """添加始终允许规则"""
```

### 2.5 记忆与知识库模块

#### 2.5.1 三层记忆架构

```python
# 工作记忆 —— 不持久化，仅在 Agent 运行时内存中
class WorkingMemory:
    """LLM 上下文窗口管理"""

    def __init__(self, max_tokens: int):
        self.messages: list[ChatMessage] = []
        self._max_tokens = max_tokens

    def add_message(self, message: ChatMessage) -> None:
        """添加消息，超出窗口时自动裁剪早期消息"""

    def get_context(self) -> list[dict]:
        """获取当前上下文"""

    def clear(self) -> None:
        """清空（任务结束时调用）"""

# 情景记忆 —— SQLite 持久化
class EpisodicMemory:
    """历史任务摘要"""

    async def store(self, agent_id: str, task_summary: TaskSummary) -> None:
        """存储任务摘要"""

    async def retrieve(self, agent_id: str, query: str, top_k: int = 5) -> list[TaskSummary]:
        """检索相似历史任务"""

    async def list_memories(self, agent_id: str) -> list[TaskSummary]:
        """列出 Agent 的所有情景记忆"""

    async def delete(self, memory_id: str) -> None:
        """删除指定记忆"""

    async def clear_all(self, agent_id: str) -> None:
        """清空 Agent 的全部情景记忆"""

class TaskSummary:
    id: str
    agent_id: str
    task_id: str
    goal: str                      # 任务目标
    key_steps: list[str]           # 关键步骤
    conclusion: str                # 最终结论
    token_usage: int
    duration_seconds: float
    created_at: datetime

# 知识记忆 —— ChromaDB 向量存储
class KnowledgeMemory:
    """RAG 知识库"""

    async def add_documents(self, kb_id: str, documents: list[Document]) -> None:
        """添加文档到知识库（解析 → 分块 → Embedding → 存储）"""

    async def delete_document(self, kb_id: str, doc_id: str) -> None:
        """删除文档"""

    async def search(self, kb_id: str, query: str, top_k: int = 5) -> list[RetrievalResult]:
        """语义检索"""

    async def reindex(self, kb_id: str) -> None:
        """重新索引"""

class Document:
    id: str
    filename: str
    filepath: str
    file_size: int
    chunk_count: int
    indexed_at: datetime

class RetrievalResult:
    content: str                   # 检索到的段落内容
    source_file: str               # 来源文件
    page_number: int | None        # 页码
    relevance_score: float         # 相关度分数
```

#### 2.5.2 文档处理 Pipeline

```
原始文档 → 格式解析 → 文本分块(Chunking) → Embedding 计算 → 向量存储
                     │                      │
                     ▼                      ▼
              PDF/Word/Excel/         本地: Ollama nomic-embed-text
              Markdown/CSV            云端: OpenAI text-embedding-3-small
```

**分块策略**：
- 默认块大小：512 tokens
- 重叠窗口：50 tokens
- 按段落/标题优先切分，避免截断句子
- 保留来源文件名与页码元数据

#### 2.5.3 知识库管理

```python
class KnowledgeBaseManager:
    """知识库生命周期管理"""

    async def create_kb(self, name: str, embedding_config: EmbeddingConfig) -> KnowledgeBase:
        """创建知识库"""

    async def add_source(self, kb_id: str, source: str) -> list[Document]:
        """添加数据源（文件路径或目录路径）"""

    async def watch_directory(self, kb_id: str, dir_path: str) -> None:
        """监听目录变更，自动增量索引"""

    async def get_kb_stats(self, kb_id: str) -> KBStats:
        """获取知识库统计信息"""

class EmbeddingConfig:
    provider: str                  # ollama | openai_compatible
    model_name: str                # 模型名称
    api_key: str | None
    base_url: str | None
    dimensions: int                # 向量维度
```

### 2.6 LLM 路由层

```python
class LLMRouter:
    """统一的 LLM 调用路由"""

    def __init__(self):
        self._providers: dict[str, LLMProvider] = {}

    async def chat(self, model_config: ModelConfig, messages: list[dict], tools: list[dict] | None = None) -> LLMResponse:
        """
        统一调用入口:
        1. 根据 provider 类型选择对应的 Provider 实现
        2. 格式化请求参数
        3. 调用模型
        4. 统一响应格式
        """

    async def stream_chat(self, model_config: ModelConfig, messages: list[dict], tools: list[dict] | None = None) -> AsyncIterator[LLMChunk]:
        """流式调用"""

class LLMProvider(ABC):
    """LLM Provider 抽象"""

    @abstractmethod
    async def chat(self, request: LLMRequest) -> LLMResponse:
        ...

    @abstractmethod
    async def stream_chat(self, request: LLMRequest) -> AsyncIterator[LLMChunk]:
        ...

class OllamaProvider(LLMProvider):
    """本地 Ollama 模型"""
    # 调用 Ollama REST API (http://localhost:11434)

class OpenAICompatibleProvider(LLMProvider):
    """OpenAI 兼容 API（支持各云端服务商）"""
    # 调用 OpenAI 格式 API
```

---

## 三、数据存储设计

### 3.1 SQLite 数据库 Schema

```sql
-- Agent 配置表
CREATE TABLE agents (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    avatar TEXT,
    description TEXT,
    tags TEXT,                        -- JSON array
    role TEXT NOT NULL DEFAULT 'worker',  -- supervisor | worker
    model_config TEXT NOT NULL,       -- JSON
    system_prompt TEXT,
    tool_permissions TEXT,            -- JSON {tool_name: bool}
    memory_config TEXT,               -- JSON
    status TEXT NOT NULL DEFAULT 'idle',
    is_archived INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

-- 任务表
CREATE TABLE tasks (
    id TEXT PRIMARY KEY,
    description TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    priority INTEGER NOT NULL DEFAULT 0,
    parent_task_id TEXT REFERENCES tasks(id),
    input_data TEXT,                  -- JSON
    output_data TEXT,                 -- JSON
    created_at TEXT NOT NULL,
    started_at TEXT,
    completed_at TEXT,
    timeout_seconds INTEGER DEFAULT 300,
    error_message TEXT
);

-- 任务-Agent 关联表
CREATE TABLE task_agents (
    task_id TEXT NOT NULL REFERENCES tasks(id),
    agent_id TEXT NOT NULL REFERENCES agents(id),
    role TEXT NOT NULL DEFAULT 'worker',  -- coordinator | worker
    PRIMARY KEY (task_id, agent_id)
);

-- 任务依赖关系表
CREATE TABLE task_dependencies (
    task_id TEXT NOT NULL REFERENCES tasks(id),
    depends_on TEXT NOT NULL REFERENCES tasks(id),
    PRIMARY KEY (task_id, depends_on)
);

-- ReAct 链路步骤表
CREATE TABLE react_steps (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id TEXT NOT NULL REFERENCES tasks(id),
    agent_id TEXT NOT NULL,
    step_number INTEGER NOT NULL,
    timestamp TEXT NOT NULL,
    thought TEXT,
    action TEXT,
    action_input TEXT,                -- JSON
    observation TEXT,
    token_input INTEGER,
    token_output INTEGER,
    duration_ms INTEGER
);

-- 情景记忆表
CREATE TABLE episodic_memories (
    id TEXT PRIMARY KEY,
    agent_id TEXT NOT NULL REFERENCES agents(id),
    task_id TEXT REFERENCES tasks(id),
    goal TEXT NOT NULL,
    key_steps TEXT,                   -- JSON array
    conclusion TEXT,
    token_usage INTEGER,
    duration_seconds REAL,
    created_at TEXT NOT NULL
);

-- 知识库表
CREATE TABLE knowledge_bases (
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

-- 知识库文档表
CREATE TABLE kb_documents (
    id TEXT PRIMARY KEY,
    kb_id TEXT NOT NULL REFERENCES knowledge_bases(id),
    filename TEXT NOT NULL,
    filepath TEXT NOT NULL,
    file_size INTEGER,
    chunk_count INTEGER,
    indexed_at TEXT NOT NULL,
    UNIQUE(kb_id, filepath)
);

-- 工具权限规则表
CREATE TABLE tool_permissions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    agent_id TEXT REFERENCES agents(id),  -- NULL 表示全局规则
    tool_name TEXT NOT NULL,
    rule_type TEXT NOT NULL,          -- always_allow | always_deny | confirm_once
    conditions TEXT,                  -- JSON
    created_at TEXT NOT NULL,
    UNIQUE(agent_id, tool_name, rule_type)
);

-- 定时任务表 (v2.0)
CREATE TABLE cron_schedules (
    id TEXT PRIMARY KEY,
    target_type TEXT NOT NULL,        -- agent | pipeline
    target_id TEXT NOT NULL,
    cron_expr TEXT NOT NULL,
    description TEXT,
    enabled INTEGER NOT NULL DEFAULT 1,
    last_run_at TEXT,
    next_run_at TEXT,
    created_at TEXT NOT NULL
);

-- 定时任务执行记录表 (v2.0)
CREATE TABLE cron_executions (
    id TEXT PRIMARY KEY,
    schedule_id TEXT NOT NULL REFERENCES cron_schedules(id),
    task_id TEXT REFERENCES tasks(id),
    status TEXT NOT NULL,             -- success | failed | timeout
    output_summary TEXT,
    started_at TEXT NOT NULL,
    completed_at TEXT,
    error_message TEXT
);

-- 系统配置表
CREATE TABLE system_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,              -- JSON
    updated_at TEXT NOT NULL
);
```

### 3.2 ChromaDB 向量存储

```python
# 每个知识库对应一个 ChromaDB Collection
# Collection 命名: kb_{knowledge_base_id}

# 文档元数据结构
metadata = {
    "doc_id": "doc_uuid",
    "filename": "产品手册.pdf",
    "filepath": "/Users/.../产品手册.pdf",
    "page_number": 42,
    "chunk_index": 7,
    "indexed_at": "2026-05-02T10:00:00"
}
```

### 3.3 文件存储结构

```
~/DigitalCrew/
├── config/
│   ├── agents/
│   │   ├── {agent_id}.yaml          # Agent 配置文件
│   │   └── ...
│   ├── pipelines/                   # v2.0
│   │   ├── {pipeline_id}.json
│   │   └── ...
│   ├── mcp_servers.yaml             # MCP Server 配置
│   └── settings.yaml                # 全局系统配置
├── data/
│   ├── db.sqlite                    # 主数据库
│   ├── db.sqlite-wal                # WAL 日志
│   └── vectordb/                    # ChromaDB 数据目录
│       ├── kb_{id1}/
│       └── kb_{id2}/
├── workspace/                       # Agent 默认工作目录
│   ├── {agent_id}/                  # 各 Agent 独立工作区
│   └── shared/                      # 共享工作区
├── knowledge/                       # 知识库原始文档
│   ├── {kb_id}/
│   └── ...
├── logs/
│   ├── system.jsonl                 # 系统日志
│   └── tasks/
│       └── {task_id}.jsonl          # 任务执行日志
└── backups/
    ├── auto/
    │   └── backup_{date}.zip
    └── manual/
```

---

## 四、API 设计

### 4.1 REST API 端点

```
Base URL: http://127.0.0.1:7700/api/v1
```

#### Agent 管理

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/agents` | 创建 Agent |
| GET | `/agents` | 列出 Agent（支持筛选） |
| GET | `/agents/{agent_id}` | 获取 Agent 详情 |
| PATCH | `/agents/{agent_id}` | 更新 Agent 配置 |
| DELETE | `/agents/{agent_id}` | 删除 Agent |
| POST | `/agents/{agent_id}/archive` | 归档 Agent |
| POST | `/agents/{agent_id}/start` | 启动 Agent |
| POST | `/agents/{agent_id}/pause` | 暂停 Agent |
| POST | `/agents/{agent_id}/resume` | 恢复 Agent |
| POST | `/agents/{agent_id}/terminate` | 终止 Agent |
| DELETE | `/agents/{agent_id}/memory` | 清空 Agent 记忆 |
| GET | `/agents/{agent_id}/memory/episodic` | 获取情景记忆列表 |
| GET | `/agents/{agent_id}/logs` | 获取 Agent 日志 |

#### 任务管理

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/tasks` | 提交即时任务 |
| GET | `/tasks` | 列出任务（支持筛选） |
| GET | `/tasks/{task_id}` | 获取任务详情 |
| POST | `/tasks/{task_id}/cancel` | 取消任务 |
| POST | `/tasks/{task_id}/pause` | 暂停任务（用户介入） |
| POST | `/tasks/{task_id}/resume` | 恢复任务 |
| POST | `/tasks/{task_id}/retry` | 重新执行任务 |
| GET | `/tasks/{task_id}/trace` | 获取 ReAct 链路 |
| GET | `/tasks/{task_id}/logs` | 获取任务日志 |
| POST | `/tasks/{task_id}/export` | 导出任务日志 |

#### 对话

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/chat/single` | 单 Agent 对话（返回 SSE 流） |
| POST | `/chat/team` | 团队对话（主管模式，返回 SSE 流） |
| POST | `/chat/{session_id}/intervene` | 对话中介入 |

#### 知识库

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/knowledge` | 创建知识库 |
| GET | `/knowledge` | 列出知识库 |
| GET | `/knowledge/{kb_id}` | 获取知识库详情 |
| DELETE | `/knowledge/{kb_id}` | 删除知识库 |
| POST | `/knowledge/{kb_id}/documents` | 上传文档 |
| DELETE | `/knowledge/{kb_id}/documents/{doc_id}` | 删除文档 |
| POST | `/knowledge/{kb_id}/reindex` | 重新索引 |
| POST | `/knowledge/{kb_id}/watch` | 设置目录监听 |

#### 工具

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/tools` | 列出所有可用工具 |
| GET | `/tools/{tool_name}` | 获取工具详情 |
| PUT | `/tools/{tool_name}/permissions` | 更新工具权限 |

#### 模型

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/models/local` | 列出本地 Ollama 模型 |
| GET | `/models/cloud` | 列出云端模型配置 |
| POST | `/models/cloud` | 添加云端模型配置 |
| POST | `/models/test` | 测试模型连通性 |

#### 系统

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/system/status` | 系统状态 |
| GET | `/system/resources` | 资源监控数据 |
| GET | `/system/settings` | 获取系统设置 |
| PATCH | `/system/settings` | 更新系统设置 |
| POST | `/system/backup` | 创建备份 |
| POST | `/system/restore` | 恢复备份 |

### 4.2 WebSocket / SSE 接口

```
# SSE: 任务执行实时事件流
GET /api/v1/events/tasks/{task_id}
# 事件类型: step_start | step_complete | tool_call | tool_result | task_complete | task_failed | user_confirm_required

# WebSocket: 全局事件推送
WS /api/v1/ws
# 消息类型:
#   agent_status_changed  — Agent 状态变更
#   task_update           — 任务进度更新
#   confirmation_request  — 工具确认请求
#   system_alert          — 系统警告
```

### 4.3 典型 API 请求/响应示例

#### 提交任务

```json
// POST /api/v1/tasks
// Request
{
    "description": "帮我做一份关于国内 AI 写作工具的竞品分析报告",
    "mode": "supervisor",           // supervisor | single
    "target_agent_id": null,        // single 模式时指定 Agent
    "priority": 0,
    "timeout_seconds": 600
}

// Response (201)
{
    "id": "task_abc123",
    "description": "帮我做一份关于国内 AI 写作工具的竞品分析报告",
    "status": "pending",
    "created_at": "2026-05-02T10:00:00Z"
}
```

#### 任务详情（含 ReAct 链路）

```json
// GET /api/v1/tasks/task_abc123
{
    "id": "task_abc123",
    "description": "帮我做一份关于国内 AI 写作工具的竞品分析报告",
    "status": "completed",
    "assigned_agents": [
        {"agent_id": "supervisor_001", "role": "coordinator"},
        {"agent_id": "search_001", "role": "worker"},
        {"agent_id": "writer_001", "role": "worker"}
    ],
    "subtasks": ["sub_001", "sub_002", "sub_003"],
    "output_data": {
        "report_path": "~/DigitalCrew/workspace/reports/竞品分析_20260502.md"
    },
    "created_at": "2026-05-02T10:00:00Z",
    "started_at": "2026-05-02T10:00:02Z",
    "completed_at": "2026-05-02T10:05:30Z"
}
```

---

## 五、前端架构设计

### 5.1 技术栈

| 组件 | 技术 | 说明 |
|------|------|------|
| 框架 | React 18 + TypeScript | 函数组件 + Hooks |
| 状态管理 | Zustand | 轻量级，适合中等复杂度 |
| 路由 | React Router v6 | SPA 路由 |
| UI 组件库 | Ant Design 5 / Shadcn/ui | 企业级 UI |
| 样式 | Tailwind CSS 3 | 原子化 CSS |
| HTTP 客户端 | Axios + React Query | 缓存 + 请求管理 |
| SSE/WS | EventSource / WebSocket API | 实时事件 |
| 画布 (v2.0) | ReactFlow | Pipeline 编辑器 |
| 图表 | Recharts | 资源监控图表 |

### 5.2 页面路由结构

```
/                           → 重定向到 /workspace
/workspace                  → 我的团队（Agent 卡片网格）
/workspace/:agentId         → Agent 详情页
/chat                       → 对话面板（默认团队对话）
/chat/:agentId              → 单 Agent 对话
/tasks                      → 任务中心
/knowledge                  → 知识库管理
/settings                   → 设置页
    /settings/models        → 模型配置
    /settings/tools         → 工具配置
    /settings/workspace     → 工作目录
    /settings/privacy       → 隐私设置
    /settings/backup        → 备份与恢复
    /settings/about         → 关于
/onboarding                 → 新用户引导向导
```

### 5.3 前端目录结构

```
src/
├── main.tsx                 # Electron 主进程入口
├── renderer/                # 渲染进程（前端应用）
│   ├── App.tsx
│   ├── index.html
│   ├── assets/
│   ├── components/          # 通用组件
│   │   ├── AgentCard/
│   │   ├── ChatMessage/
│   │   ├── ReactStepCard/
│   │   ├── ConfirmDialog/
│   │   └── StatusBadge/
│   ├── pages/               # 页面组件
│   │   ├── Workspace/
│   │   ├── Chat/
│   │   ├── Tasks/
│   │   ├── Knowledge/
│   │   ├── Settings/
│   │   └── Onboarding/
│   ├── hooks/               # 自定义 Hooks
│   │   ├── useAgent.ts
│   │   ├── useTask.ts
│   │   ├── useChat.ts
│   │   └── useSSE.ts
│   ├── stores/              # Zustand 状态
│   │   ├── agentStore.ts
│   │   ├── taskStore.ts
│   │   ├── chatStore.ts
│   │   └── systemStore.ts
│   ├── services/            # API 调用层
│   │   ├── agentApi.ts
│   │   ├── taskApi.ts
│   │   ├── chatApi.ts
│   │   └── systemApi.ts
│   ├── types/               # TypeScript 类型定义
│   └── utils/               # 工具函数
└── electron/                # Electron 主进程
    ├── main.ts
    ├── preload.ts
    └── backend.ts           # 内嵌后端进程管理
```

### 5.4 核心组件设计

#### 对话面板组件树

```
<ChatPanel>
├── <ChatSidebar>              # 会话列表
│   └── <SessionItem>
├── <ChatHeader>               # 当前对话信息
├── <MessageList>              # 消息流
│   ├── <UserMessage>
│   ├── <AgentMessage>
│   │   ├── <AgentAvatar>
│   │   ├── <MarkdownContent>
│   │   └── <ReactStepsCollapse>  # 可折叠的 ReAct 链路
│   │       └── <ReactStepCard>
│   │           ├── ThoughtSection
│   │           ├── ActionSection
│   │           └── ObservationSection
│   └── <ToolCallCard>        # 工具调用记录
├── <ConfirmDialog>            # 工具确认弹窗（悬浮）
└── <ChatInput>               # 输入区
    ├── <MentionDropdown>     # @Agent 提及下拉
    └── <SendButton>
```

---

## 六、安全设计

### 6.1 文件系统安全

```python
class FileSystemGuard:
    """文件系统访问控制"""

    BLOCKED_PATHS = [
        "/etc", "/sys", "/proc", "/dev",   # Linux 系统目录
        "C:\\Windows", "C:\\Program Files",  # Windows 系统目录
        "~/.ssh", "~/.gnupg",               # 敏感用户目录
    ]

    def validate_path(self, path: str, allowed_dirs: list[str]) -> bool:
        """
        验证路径安全性:
        1. 规范化路径（解析 .. 和符号链接）
        2. 检查是否在黑名单中
        3. 检查是否在白名单中
        """
```

### 6.2 代码沙箱安全

```
Docker 模式（推荐）:
- 独立容器，无宿主机网络访问（可配置例外）
- 只读挂载 workspace 目录
- 内存限制：512MB
- CPU 限制：1 核
- 执行超时：60 秒
- 任务结束后自动销毁容器

venv 降级模式:
- 独立虚拟环境
- 子进程运行，设置资源限制（ulimit）
- 超时后强制 kill
- 无网络隔离（需用户确认）
```

### 6.3 API Key 安全

```python
class SecureKeyStore:
    """API Key 加密存储"""

    async def store_key(self, key_name: str, key_value: str) -> None:
        """使用 OS 密钥链存储"""
        # macOS: Keychain
        # Windows: Credential Manager
        # Linux: Secret Service (libsecret)

    async def get_key(self, key_name: str) -> str:
        """读取 Key"""

    async def delete_key(self, key_name: str) -> None:
        """删除 Key"""
```

### 6.4 网络安全

- Web UI 默认监听 `127.0.0.1:7700`，不对外暴露
- 所有 API 请求需携带本地 Session Token（启动时生成）
- 敏感操作（删除、清空记忆等）需二次确认

---

## 七、部署架构

### 7.1 Docker Compose 部署（v1.0 推荐）

```yaml
version: "3.8"

services:
  backend:
    build: ./backend
    ports:
      - "127.0.0.1:7700:7700"
    volumes:
      - digitalcrew-data:/app/data
      - digitalcrew-config:/app/config
      - ${HOME}/DigitalCrew/workspace:/app/workspace
      - ${HOME}/DigitalCrew/knowledge:/app/knowledge
    environment:
      - OLLAMA_BASE_URL=http://host.docker.internal:11434
    depends_on:
      - sandbox

  frontend:
    build: ./frontend
    ports:
      - "127.0.0.1:3000:3000"
    depends_on:
      - backend

  sandbox:
    image: digitalcrew/sandbox:latest
    privileged: false
    network_mode: "none"             # 无网络访问
    volumes:
      - ${HOME}/DigitalCrew/workspace:/workspace:ro
    deploy:
      resources:
        limits:
          memory: 512M
          cpus: "1.0"

volumes:
  digitalcrew-data:
  digitalcrew-config:
```

### 7.2 Electron 桌面部署（v1.0 后期）

```
Electron App
├── 主进程 (main.ts)
│   ├── 窗口管理
│   ├── 系统托盘
│   ├── 内嵌后端进程管理（spawn/kill Python 后端）
│   └── 自动更新（electron-updater）
├── 渲染进程 (React App)
│   └── 前端 SPA，通过 localhost:7700 与后端通信
└── 后端进程
    └── Python FastAPI，随 Electron 启动/关闭
```

---

## 八、可观测性设计

### 8.1 日志体系

```python
import structlog

# 结构化日志配置
structlog.configure(
    processors=[
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.add_log_level,
        structlog.processors.JSONRenderer()
    ],
    logger_factory=structlog.PrintLoggerFactory(
        file=open("logs/system.jsonl", "a")
    )
)

# Agent 执行日志格式
{
    "timestamp": "2026-05-02T10:00:05.123Z",
    "level": "info",
    "event": "agent_step",
    "agent_id": "search_001",
    "task_id": "task_abc123",
    "step": {
        "number": 3,
        "thought": "我需要搜索更多关于 Jasper AI 的信息",
        "action": "web_search",
        "action_input": {"query": "Jasper AI features pricing 2026"},
        "observation": "Jasper AI 是一款面向营销团队的 AI 写作工具...",
        "token_input": 1250,
        "token_output": 380,
        "duration_ms": 2340
    }
}
```

### 8.2 资源监控

```python
class ResourceMonitor:
    """系统资源监控"""

    async def get_metrics(self) -> SystemMetrics:
        return SystemMetrics(
            cpu_percent=psutil.cpu_percent(interval=1),
            memory_used_mb=psutil.virtual_memory().used / 1024 / 1024,
            memory_total_mb=psutil.virtual_memory().total / 1024 / 1024,
            gpu_info=self._get_gpu_info(),     # pynvml / torch.cuda
            agent_processes=self._get_agent_process_metrics(),
            model_inference_speed=self._get_inference_speed(),
            disk_usage=self._get_disk_usage()
        )

    async def check_thresholds(self, metrics: SystemMetrics) -> list[Alert]:
        """检查是否超过阈值，生成告警"""
```

---

## 九、错误处理策略

### 9.1 错误分类与处理

| 错误类型 | 处理策略 | 用户提示 |
|----------|----------|----------|
| LLM 调用超时 | 自动重试 1 次，失败后上报主管 Agent | "模型响应超时，正在重试..." |
| LLM 调用限流 | 指数退避重试（最多 3 次） | "模型繁忙，排队等待中..." |
| 工具执行失败 | 上报主管 Agent，决定重试或换方法 | "工具执行异常：{错误摘要}" |
| 代码沙箱超时 | 强制终止沙箱，上报任务失败 | "代码执行超时（60 秒），已终止" |
| 知识库索引失败 | 跳过该文档，记录错误，继续处理其他文档 | "文档 {filename} 索引失败，已跳过" |
| Agent 崩溃 | 自动重启 Agent，恢复任务状态 | "Agent 已自动重启" |
| 数据库损坏 | 尝试从 WAL 恢复，失败则从最近备份恢复 | "数据异常，正在恢复..." |
| 网络不可达 | 标记为离线，使用缓存或降级 | "网络不可用，部分功能受限" |

### 9.2 主管 Agent 重试策略

```python
class RetryPolicy:
    max_retries: int = 1             # 默认允许主管自主重试 1 次
    backoff_base: float = 2.0        # 指数退避基数
    backoff_max: float = 30.0        # 最大退避时间

    async def should_retry(self, attempt: int, error: Exception) -> RetryDecision:
        if attempt >= self.max_retries:
            return RetryDecision.ESCALATE_TO_USER
        if isinstance(error, (TimeoutError, RateLimitError)):
            return RetryDecision.RETRY_SAME_AGENT
        if isinstance(error, ToolExecutionError):
            return RetryDecision.RETRY_DIFFERENT_AGENT
        return RetryDecision.ESCALATE_TO_USER
```

---

## 十、性能优化策略

### 10.1 LLM 调用优化

- **流式输出**：所有 LLM 调用默认使用 SSE 流式传输，首字延迟优化
- **上下文压缩**：长对话自动摘要早期消息，减少 Token 用量
- **并行推理**：多个无依赖 Agent 并行调用 LLM，充分利用并发

### 10.2 知识库优化

- **增量索引**：文件监听 + 哈希比对，仅重新索引变更文件
- **批量 Embedding**：多个文本块合并为一次 Embedding 请求
- **缓存策略**：热门查询结果缓存，TTL 5 分钟

### 10.3 前端优化

- **虚拟滚动**：长消息列表使用虚拟滚动（react-virtuoso）
- **乐观更新**：用户操作即时反馈，后台异步确认
- **代码分割**：按路由懒加载，减少首屏加载体积

---

## 十一、测试策略

### 11.1 测试层次

| 层次 | 工具 | 覆盖目标 |
|------|------|----------|
| 单元测试 | pytest + pytest-asyncio | 服务层、工具层逻辑 |
| 集成测试 | pytest + httpx | API 端点、数据库交互 |
| E2E 测试 | Playwright (JS) | 前端页面交互流程 |
| Agent 测试 | 自定义框架 | Agent 协同逻辑、ReAct 链路 |

### 11.2 关键测试场景

- Agent 创建 → 配置 → 启动 → 执行任务 → 完成的完整生命周期
- 主管 Agent 任务拆解 → 并行执行 → 结果整合的协同流程
- 工具权限确认弹窗的交互流程
- 任务中断 → 用户介入 → 恢复的流程
- 本地模型与云端模型的切换与降级
- 知识库文档上传 → 索引 → 检索的完整链路

---

## 十二、开放问题决策建议

| 问题 | 建议决策 | 理由 |
|------|----------|------|
| 推理资源调度 | 提供三种策略供用户选择，默认"排队等待" | 尊重用户对成本和体验的偏好 |
| Agent 间上下文格式 | v1.0 自由文本 + 可选 JSON | MVP 阶段优先验证功能，Schema 约束留待 v2.0 |
| Electron vs Web 优先级 | v1.0 优先 Docker Compose + Web UI | 快速验证核心功能，Electron 后期跟进 |
| 重试策略边界 | 默认允许主管自主重试 1 次 | 平衡自动化程度与用户控制感 |

---

*本文档为 v1.0 草稿，待技术评审后进入 v1.1 修订版。*
