# DigitalCrew Architecture Optimization TODO

> 参考项目：LangGraph (supervisor pattern)、DeerFlow (ByteDance)、langchain-ai/deepagents
>
> 目标：在现有 FastAPI + React/Zustand 栈上，借鉴以上项目的最佳实践重构 agent 编排层

---

## 当前架构问题一览

| # | 问题 | 严重度 | 影响 |
|---|------|--------|------|
| 1 | supervisor.py 是单体函数，没有中间状态 | 高 | 前端拿不到执行进度，无法介入 |
| 2 | sub-agent 没有上下文隔离 | 高 | context window 爆炸，agent 互相干扰 |
| 3 | agent 匹配靠 name 字符串比较 | 高 | 同名/子串误匹配 |
| 4 | session/task 纯内存存储 | 中 | 重启全丢 |
| 5 | intervene 端点是假的 | 中 | 用户介入不生效 |
| 6 | 前端 streaming state 分裂 | 中 | 组件 state 和 store 不同步 |
| 7 | task_scheduler 和 supervisor 双向依赖 | 中 | 循环 import，代码重复 |
| 8 | _handle_failure 定义了但没调用 | 低 | 失败直接跳过，无重试 |
| 9 | _execute_plan (callback) 和 _execute_plan_gen (generator) 并存 | 低 | 死代码，维护混乱 |

---

## Phase 1：基础重构（核心 bug 修复 + 架构骨架）

### 1.1 定义 Graph State 协议

**目标**：用 TypedDict 定义 supervisor 执行的完整状态，每一步都是显式的。

**新建文件**：`backend/services/graph/state.py`

```python
from typing import TypedDict, Annotated, Literal
from pydantic import BaseModel

class SubTask(BaseModel):
    id: str
    description: str
    target_agent_id: str          # 用 agent id 而非 name
    depends_on: list[str] = []
    parallel_group: int = 1
    status: Literal["pending", "running", "completed", "failed"] = "pending"
    output: str | None = None
    error: str | None = None

class SubAgentContext(BaseModel):
    """传递给 sub-agent 的隔离上下文"""
    goal: str
    constraints: str = ""
    parent_summary: str = ""      # 摘要，不是全量 history
    previous_results: dict[str, str] = {}  # 其他已完成 subtask 的摘要

class GraphState(TypedDict):
    thread_id: str
    goal: str
    plan: list[SubTask]
    current_step: int
    results: dict[str, str]       # subtask_id -> output summary
    raw_outputs: dict[str, str]   # subtask_id -> full output
    status: Literal["planning", "executing", "integrating", "done", "error", "interrupted"]
    error: str | None
    context: SubAgentContext
```

**改动文件**：`backend/models/schemas.py`
- 保留现有 schema 不动，GraphState 是 supervisor 内部状态，不污染公共 schema

**验证方式**：`from backend.services.graph.state import GraphState` 不报错

---

### 1.2 定义统一 SSE 事件协议

**目标**：所有 supervisor 事件统一格式，前端只处理一种事件结构。

**新建文件**：`backend/services/graph/events.py`

```python
from pydantic import BaseModel
from typing import Literal, Optional

class GraphEvent(BaseModel):
    type: Literal[
        "state_update",       # state 变更（前端核心驱动事件）
        "node_start",         # 某个 node 开始
        "node_end",           # 某个 node 结束
        "stream_token",       # LLM streaming token
        "subtask_progress",   # subtask 粒度进度
        "react_step",         # ReAct 思考步骤
        "error",              # 错误
        "interrupt",          # 需要用户介入
        "done",               # 整体完成
    ]
    node: Optional[str] = None
    agent_id: Optional[str] = None
    agent_name: Optional[str] = None
    subtask_id: Optional[str] = None
    state_delta: Optional[dict] = None    # GraphState 的增量
    content: Optional[str] = None
    token: Optional[str] = None
    step: Optional[dict] = None           # ReAct step data
    metadata: dict = {}
```

**改动文件**：`backend/api/routes/chat.py`
- `/team/stream` 端点的所有 yield 改为 `yield f"data: {event.model_dump_json()}\n\n"`
- 去掉现在散落的各种 dict 格式

**改动文件**：`src/pages/ChatPanel.tsx`
- `StreamEvent` interface 改为和 `GraphEvent` 对齐
- `handleStreamEvent` 简化，`state_update` 驱动主 UI，其他事件更新辅助状态

**验证方式**：发送团队消息，前端能看到 `planning → executing → integrating → done` 状态流转

---

### 1.3 重写 Supervisor 为 Node-based 执行

**目标**：把 supervisor.py 的大函数拆成独立的 node，每个 node 输入 state、输出 state delta。

**新建文件**：`backend/services/graph/nodes.py`

```python
# 每个 node 签名：async def xxx_node(state: GraphState, emit: Callable) -> dict  # 返回 Partial[GraphState]

async def plan_node(state: GraphState, emit) -> dict:
    """调用 LLM 分解任务，返回 {plan: [...], status: 'executing'}"""
    ...

async def execute_node(state: GraphState, emit) -> dict:
    """执行当前 step 的 subtask(s)，返回 {results: {...}, current_step: N}"""
    ...

async def integrate_node(state: GraphState, emit) -> dict:
    """整合所有 results，返回最终输出"""
    ...

async def route_after_plan(state: GraphState) -> str:
    """条件路由"""
    return "execute" if state["plan"] else "error"

async def route_after_execute(state: GraphState) -> str:
    """检查是否还有更多 step"""
    if state["current_step"] < len(state["plan"]) - 1:
        return "execute"  # 继续下一步
    return "integrate"    # 全部完成，整合
```

**新建文件**：`backend/services/graph/engine.py`

```python
class GraphEngine:
    """状态机引擎，按 node 定义的图执行"""

    def __init__(self):
        self._nodes: dict[str, Callable] = {}
        self._edges: dict[str, str | Callable] = {}  # node -> next_node | routing_fn
        self._interrupt_nodes: set[str] = set()

    def add_node(self, name: str, fn: Callable):
        self._nodes[name] = fn

    def add_edge(self, from_node: str, to_node: str):
        self._edges[from_node] = to_node

    def add_conditional_edge(self, from_node: str, routing_fn: Callable):
        self._edges[from_node] = routing_fn

    def add_interrupt(self, node_name: str):
        self._interrupt_nodes.add(node_name)

    async def execute(self, initial_state: GraphState, emit) -> GraphState:
        """从 START 节点开始执行到 END"""
        state = initial_state
        current = "plan"

        while current != "END":
            if current in self._interrupt_nodes:
                # 保存 checkpoint，等待 resume
                ...

            node_fn = self._nodes[current]
            delta = await node_fn(state, emit)
            state = {**state, **delta}

            # emit state_update
            await emit(GraphEvent(type="state_update", node=current, state_delta=delta))

            # 路由到下一个 node
            edge = self._edges.get(current, "END")
            if callable(edge):
                current = edge(state)
            else:
                current = edge

        return state
```

**删除**：`backend/services/supervisor.py` 中的 `_execute_plan` (callback 版本，406-483 行) — 这是死代码

**改动文件**：`backend/services/supervisor.py`
- `SupervisorRuntime.execute()` 改为构建 GraphEngine 并执行
- `_decompose_task` 移入 `plan_node`
- `_execute_subtask_gen` 移入 `execute_node`
- `_integrate_results` 移入 `integrate_node`

**改动文件**：`backend/api/routes/chat.py`
- `/team/stream` 调用新的 GraphEngine 而非旧的 supervisor_runtime

**验证方式**：
- 发送 "帮我写一个 hello world 程序并解释" → 看到 plan → execute → integrate 三阶段
- 每个阶段都有 state_update SSE 事件

---

### 1.4 修复 @mention 匹配

**改动文件**：`backend/api/routes/chat.py`

```python
# 现在（有 bug）:
mentioned_agents = [a for a in all_agents if any(name.lower() in a.name.lower() for name in mentioned_names)]

# 改为精确匹配，优先 id 匹配，fallback 到 name 精确匹配:
def match_mentioned_agents(mentioned_names: list[str], all_agents: list[AgentConfig]) -> list[AgentConfig]:
    matched = []
    for name in mentioned_names:
        # 1. 按 id 精确匹配
        agent = next((a for a in all_agents if a.id == name), None)
        if agent:
            matched.append(agent)
            continue
        # 2. 按 name 精确匹配（大小写不敏感）
        agent = next((a for a in all_agents if a.name.lower() == name.lower()), None)
        if agent:
            matched.append(agent)
            continue
        # 3. 按 name 子串匹配（最后 fallback，仅在无精确匹配时）
        candidates = [a for a in all_agents if name.lower() in a.name.lower()]
        if len(candidates) == 1:  # 只有唯一匹配才用
            matched.append(candidates[0])
    return matched
```

**验证方式**：有 agent "coder" 和 "code_reviewer" 时，`@coder` 只匹配 "coder"

---

### 1.5 修复 subtask_token 错配

**改动文件**：`src/pages/ChatPanel.tsx`

```typescript
// 现在（有 bug）:
if (a.id === event.agent_id || a.status === 'working') {

// 改为精确匹配:
if (a.id === event.agent_id) {
```

同时在 `subtask_start` 事件中，只把真正被 supervisor 分配了 subtask 的 agent 设为 working，而不是提前给所有 agent 发 `subtask_start`。

**改动文件**：`backend/services/graph/nodes.py` (execute_node)
- `subtask_start` 事件在 agent 真正开始执行时才 emit，不在 plan 阶段批量发

---

## Phase 2：能力增强

### 2.1 Agent Registry + Capability-based Routing

**目标**：用 agent capability 匹配替代 name 字符串匹配，supervisor 通过 function calling 选择 agent。

**新建文件**：`backend/services/graph/registry.py`

```python
class AgentRegistry:
    def __init__(self):
        self._agents: dict[str, AgentEntry] = {}

    def register(self, agent: AgentConfig, capabilities: list[str]):
        ...

    def find_by_capability(self, capability: str) -> list[AgentEntry]:
        ...

    def as_llm_tools(self) -> list[dict]:
        """把 agent 转成 LLM function calling 格式"""
        return [
            {
                "type": "function",
                "function": {
                    "name": f"delegate_to_{entry.agent.id}",
                    "description": f"{entry.agent.name}: {entry.agent.description}",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "task": {"type": "string"},
                            "context": {"type": "string"},
                        },
                        "required": ["task"],
                    },
                },
            }
            for entry in self._agents.values()
        ]
```

**改动文件**：`backend/models/schemas.py`
- `AgentConfig` 增加 `capabilities: list[str] = []` 字段

**改动文件**：`src/components/modals/AgentModal.tsx` + `AgentEditModal.tsx`
- Agent 编辑表单增加 capabilities 多选/标签输入

**改动文件**：`backend/services/graph/nodes.py` (plan_node)
- `_decompose_task` 的 system prompt 从 "匹配 agent name" 改为 "使用 delegate_to_xxx tool"
- 或者：plan_node 输出的 subtask 里 `target_agent_id` 直接填 id 而非 name

**验证方式**：
- 创建 agent 时填 capabilities: ["code", "research"]
- 发送 "帮我写代码" → supervisor 自动路由到有 "code" capability 的 agent

---

### 2.2 Sub-Agent 上下文隔离

**目标**：每个 worker agent 只拿到必要的上下文，不共享完整 conversation history。

**改动文件**：`backend/services/graph/nodes.py` (execute_node)

```python
async def execute_subtask_isolated(
    subtask: SubTask,
    agent: AgentConfig,
    parent_context: SubAgentContext,
    emit: Callable,
) -> str:
    # 1. 构建隔离 context
    isolated_messages = [
        {"role": "system", "content": agent.system_prompt},
        {"role": "user", "content": f"""
任务: {subtask.description}
约束: {parent_context.constraints}
前置结果摘要: {parent_context.previous_results}
"""},
    ]

    # 2. 流式执行
    output = ""
    async for chunk in llm_router.stream_chat(isolated_messages, agent.llm_config):
        if chunk.get("content"):
            output += chunk["content"]
            await emit(GraphEvent(
                type="stream_token",
                agent_id=agent.id,
                subtask_id=subtask.id,
                token=chunk["content"],
            ))

    # 3. 返回 full output（存 raw_outputs）和 summary（传给后续 subtask）
    return output
```

**改动文件**：`backend/services/graph/state.py`
- `GraphState` 增加 `raw_outputs: dict[str, str]` 存完整输出
- `SubAgentContext.previous_results` 只存摘要

**验证方式**：
- 3 个 agent 并行执行，每个 agent 的 system prompt 日志里只有自己的 task，看不到其他 agent 的输出

---

### 2.3 Checkpoint 持久化

**目标**：supervisor 执行的每一步都可恢复，重启不丢状态。

**新建文件**：`backend/services/graph/checkpoint.py`

```python
import json
import sqlite3
from pathlib import Path

class CheckpointStore:
    def __init__(self, db_path: Path):
        self._db_path = db_path
        self._init_db()

    def _init_db(self):
        with sqlite3.connect(self._db_path) as conn:
            conn.execute("""
                CREATE TABLE IF NOT EXISTS graph_checkpoints (
                    thread_id TEXT NOT NULL,
                    step INTEGER NOT NULL,
                    state_json TEXT NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    PRIMARY KEY (thread_id, step)
                )
            """)

    def save(self, thread_id: str, step: int, state: dict):
        with sqlite3.connect(self._db_path) as conn:
            conn.execute(
                "INSERT OR REPLACE INTO graph_checkpoints (thread_id, step, state_json) VALUES (?, ?, ?)",
                (thread_id, step, json.dumps(state, default=str))
            )

    def load(self, thread_id: str, step: int | None = None) -> dict | None:
        with sqlite3.connect(self._db_path) as conn:
            if step is not None:
                row = conn.execute(
                    "SELECT state_json FROM graph_checkpoints WHERE thread_id = ? AND step = ?",
                    (thread_id, step)
                ).fetchone()
            else:
                row = conn.execute(
                    "SELECT state_json FROM graph_checkpoints WHERE thread_id = ? ORDER BY step DESC LIMIT 1",
                    (thread_id,)
                ).fetchone()
            return json.loads(row[0]) if row else None

    def list_steps(self, thread_id: str) -> list[int]:
        with sqlite3.connect(self._db_path) as conn:
            rows = conn.execute(
                "SELECT step FROM graph_checkpoints WHERE thread_id = ? ORDER BY step",
                (thread_id,)
            ).fetchall()
            return [r[0] for r in rows]
```

**改动文件**：`backend/services/graph/engine.py`
- 每个 node 执行完后调用 `checkpoint_store.save(thread_id, step, state)`

**改动文件**：`backend/core/config.py`
- 增加 `CHECKPOINT_DB_PATH = DATA_DIR / "checkpoints.db"`

**验证方式**：
- 执行到一半 kill 服务 → 重启 → 发送同一 thread_id 的 resume 请求 → 从上次 checkpoint 继续

---

### 2.4 真实介入机制

**目标**：用户可以在 supervisor 执行过程中修改 plan 或注入指令。

**改动文件**：`backend/services/graph/engine.py`

```python
async def execute(self, initial_state: GraphState, emit) -> GraphState:
    state = initial_state
    current = "plan"

    while current != "END":
        if current in self._interrupt_nodes:
            checkpoint_store.save(state["thread_id"], state["current_step"], state)
            await emit(GraphEvent(type="interrupt", node=current, state_delta=state))
            # 挂起，等待 resume
            user_input = await self._wait_for_resume(state["thread_id"])
            if user_input:
                state = {**state, "goal": user_input.get("goal", state["goal"])}
                # 如果用户修改了 plan，重新进入 plan node
                if user_input.get("replan"):
                    current = "plan"
                    continue

        node_fn = self._nodes[current]
        delta = await node_fn(state, emit)
        state = {**state, **delta}
        ...
```

**新建文件**：`backend/api/routes/graph.py`

```python
@router.post("/{thread_id}/resume")
async def resume_graph(thread_id: str, request: ResumeRequest):
    """用户介入后恢复执行"""
    engine = get_pending_engine(thread_id)
    engine.submit_resume(request.input)
    return {"status": "resumed"}
```

**改动文件**：`src/pages/ChatPanel.tsx`
- 收到 `interrupt` 事件后，显示编辑 UI（修改 plan / 注入指令）
- 用户确认后调用 `POST /api/v1/graph/{thread_id}/resume`

**验证方式**：
- supervisor 分解出 3 个 subtask → 用户看到 plan → 删除第 3 个 subtask → resume → 只执行前 2 个

---

## Phase 3：高级特性

### 3.1 Context Offloading（大输出存文件）

**借鉴**：DeepAgents 的虚拟文件系统模式

**目标**：sub-agent 输出超过阈值时，存到文件而非全部传给 supervisor context。

**改动文件**：`backend/services/graph/nodes.py`

```python
CONTEXT_THRESHOLD = 2000  # 字符数

async def execute_subtask_isolated(...) -> SubTaskResult:
    output = ...  # 完整输出

    if len(output) > CONTEXT_THRESHOLD:
        # 存到文件
        filepath = WORKSPACE_DIR / "outputs" / f"{subtask.id}.md"
        filepath.write_text(output)
        summary = await llm_router.chat(
            messages=[{"role": "user", "content": f"Summarize this in 200 words:\n{output[:3000]}"}],
            model_config=agent.llm_config,
        )
        return SubTaskResult(summary=summary["content"], file_ref=str(filepath))
    else:
        return SubTaskResult(summary=output, file_ref=None)
```

---

### 3.2 失败重试策略

**改动文件**：`backend/services/graph/nodes.py` (execute_node)

```python
async def execute_with_retry(subtask, agent, context, emit, max_retries=1):
    for attempt in range(max_retries + 1):
        try:
            return await execute_subtask_isolated(subtask, agent, context, emit)
        except TimeoutError:
            if attempt < max_retries:
                await emit(GraphEvent(type="subtask_progress", subtask_id=subtask.id, content=f"超时重试 ({attempt+1}/{max_retries})"))
                continue
            raise
        except RateLimitError:
            if attempt < max_retries:
                await asyncio.sleep(2 ** attempt)
                continue
            raise
        except Exception as e:
            if attempt < max_retries:
                # 尝试换一个 agent
                alt_agent = find_alternative_agent(subtask, agent)
                if alt_agent:
                    agent = alt_agent
                    continue
            raise
```

**调用**：在 `execute_node` 中替换直接调用为 `execute_with_retry`

---

### 3.3 前端状态统一

**目标**：streaming state 和 persist state 统一管理。

**新建文件**：`src/stores/threadStore.ts`

```typescript
interface ThreadState {
  threadId: string | null;
  graphState: GraphState | null;
  events: GraphEvent[];
  isStreaming: boolean;

  // Actions
  startThread: (message: string) => Promise<void>;
  resumeThread: (input?: any) => Promise<void>;
  cancelThread: () => Promise<void>;
}
```

**改动文件**：`src/pages/ChatPanel.tsx`
- 移除组件内的 `useState` for `assignedAgents`, `reactSteps`, `executionPlan`, `statusMessage`
- 全部由 `threadStore` 管理
- `handleStreamEvent` 只做一件事：`threadStore.applyEvent(event)`

**改动文件**：`src/stores/chatStore.ts`
- `sendTeamMessage` 删除（死代码）
- 单 agent 模式保留 `sendMessage`

---

## 文件变更总览

### 新建文件

| 文件 | 用途 |
|------|------|
| `backend/services/graph/__init__.py` | graph 包 |
| `backend/services/graph/state.py` | GraphState, SubTask, SubAgentContext 定义 |
| `backend/services/graph/events.py` | GraphEvent 统一事件定义 |
| `backend/services/graph/nodes.py` | plan_node, execute_node, integrate_node |
| `backend/services/graph/engine.py` | GraphEngine 状态机 |
| `backend/services/graph/registry.py` | AgentRegistry |
| `backend/services/graph/checkpoint.py` | CheckpointStore (SQLite) |
| `backend/api/routes/graph.py` | /graph/stream, /graph/{id}/resume 端点 |
| `src/stores/threadStore.ts` | 前端 thread 状态管理 |

### 修改文件

| 文件 | 变更 |
|------|------|
| `backend/services/supervisor.py` | 删除 `_execute_plan` 死代码，`execute()` 改为调用 GraphEngine |
| `backend/api/routes/chat.py` | `/team/stream` 改用 GraphEngine；修复 @mention 匹配；删除假 intervene |
| `backend/models/schemas.py` | AgentConfig 增加 capabilities 字段 |
| `src/pages/ChatPanel.tsx` | streaming state 移入 threadStore；修复 subtask_token 匹配 |
| `src/stores/chatStore.ts` | 删除 sendTeamMessage |

### 不动的文件

| 文件 | 原因 |
|------|------|
| `backend/services/agent_manager.py` | agent CRUD 逻辑不变 |
| `backend/services/llm_router.py` | LLM 调用层不变 |
| `backend/services/session_store.py` | 单 agent chat 继续用 |
| `src/pages/SetupWizard.tsx` | 首次设置流程不变 |

---

## 每个 Task 的验收标准

### P1 任务

- [x] **1.1 GraphState**：`python -c "from backend.services.graph.state import GraphState; print(GraphState.__annotations__)"` 成功
- [x] **1.2 GraphEvent**：`python -c "from backend.services.graph.events import GraphEvent; print(GraphEvent(type='done'))"` 成功
- [x] **1.3 GraphEngine**：写一个最小 test case，plan→execute→integrate 三步走通
- [x] **1.4 @mention**：test case "coder" 和 "code_reviewer"，`@coder` 只匹配一个
- [x] **1.5 subtask_token**：多个 agent 并行时，token 不会错配到其他 agent

### P2 任务

- [x] **2.1 Registry**：创建 agent 带 capabilities，supervisor 通过 capability 找到 agent
- [x] **2.2 Context Isolation**：并行 agent 的 system prompt 日志不含其他 agent 的输出
- [x] **2.3 Checkpoint**：执行中 kill → 重启 → resume → 从断点继续
- [x] **2.4 Interrupt**：plan 阶段 interrupt → 用户修改 plan → resume → 按新 plan 执行

### P3 任务

- [x] **3.1 Context Offloading**：超过 2000 字的输出存文件，supervisor context 只有摘要
- [x] **3.2 Retry**：subtask 超时自动重试 1 次，rate limit 自动 backoff
- [x] **3.3 Frontend State**：ChatPanel 组件内无 streaming 相关 useState

---

## 实施顺序建议

```
Week 1: 1.1 → 1.2 → 1.3（骨架搭起来）
Week 2: 1.4 → 1.5 → 接入前端（修 bug，前端能用）
Week 3: 2.1 → 2.2（能力路由 + 上下文隔离）
Week 4: 2.3 → 2.4（持久化 + 真实介入）
Week 5+: 3.1 → 3.2 → 3.3（高级特性）
```
