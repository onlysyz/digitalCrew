"""
Graph nodes for the supervisor state machine.

Each node: async def node_name(state: GraphState, emit: Callable) -> dict
Returns: Partial[GraphState] delta to merge into state.
"""

import asyncio
import json
import structlog
from typing import Any, Callable, AsyncIterator

from backend.models.schemas import AgentConfig, ModelConfig
from backend.services.graph.state import GraphState, SubTask, SubAgentContext
from backend.services.graph.events import GraphEvent
from backend.services.graph.registry import agent_registry
from backend.services.llm_router import llm_router
from backend.core.config import DATA_DIR

logger = structlog.get_logger()


async def plan_node(state: GraphState, emit: Callable) -> dict:
    """
    Decompose goal into subtasks using LLM with function calling.

    Instead of string-matching agent names, we provide the LLM with
    delegate_to_{agent_id} tools and let it select agents based on capabilities.
    """
    goal = state["goal"]
    agents = state.get("available_agents", [])

    # Register agents in the global registry
    agent_registry_snapshot = []
    for agent in agents:
        caps = getattr(agent, 'capabilities', [])
        agent_registry.register(agent, caps)
        agent_registry_snapshot.append({
            "id": agent.id,
            "name": agent.name,
            "capabilities": caps,
            "description": agent.description or "",
        })

    # Build LLM tools for agent delegation
    tools = agent_registry.as_llm_tools()

    system_prompt = f"""You are a task decomposition expert with access to multiple specialized agents.

Available agents (with their capabilities):
{json.dumps(agent_registry_snapshot, indent=2)}

You must use the delegate_to_{{agent_id}} tool to assign each subtask to an agent.
Do NOT select agents by name string matching - use the provided tools.

Output a JSON plan with:
{{
  "subtasks": [
    {{
      "id": "unique_task_id",
      "description": "what to do",
      "target_agent_id": "agent_id from the tools",
      "depends_on": [],
      "parallel_group": 1
    }}
  ]
}}

Rules:
- Use the delegate_to_{{agent_id}} tool for EVERY subtask
- No dependency cycles
- Tasks without dependencies can run in parallel
- id MUST be a string
- Each subtask should be atomic and focused
"""

    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": f"Decompose this goal: {goal}"},
    ]

    plan: list[SubTask] = []
    status = "planning"

    try:
        # Try with tools first - but if content is empty, retry without tools
        response = await llm_router.chat(
            messages=messages,
            model_config=agents[0].llm_config if agents else None,
            tools=tools if tools else None,
        )

        # Parse response - may contain tool_calls or text
        content = response.get("content", "{}")
        tool_calls = response.get("tool_calls", [])

        # If content is empty and no tool_calls, retry without tools
        if not content and not tool_calls and tools:
            logger.info("plan_llm_no_response_with_tools_retrying_without")
            response = await llm_router.chat(
                messages=messages,
                model_config=agents[0].llm_config if agents else None,
                tools=None,
            )
            content = response.get("content", "{}")
            tool_calls = response.get("tool_calls", [])

        subtasks_data = []

        # If LLM used tool calls, extract agent assignments from them
        if tool_calls:
            for tc in tool_calls:
                func_name = tc.get("function", {}).get("name", "")
                func_args = tc.get("function", {}).get("arguments", {})

                if func_name.startswith("delegate_to_"):
                    actual_agent_id = func_name.replace("delegate_to_", "")
                    subtasks_data.append({
                        "id": f"task_{len(subtasks_data) + 1}",
                        "description": func_args.get("task", ""),
                        "target_agent_id": actual_agent_id,
                        "depends_on": func_args.get("depends_on", []),
                        "parallel_group": func_args.get("parallel_group", 1),
                    })
        else:
            # Fallback: parse JSON text output
            try:
                if "```" in content:
                    start = content.find("```json") + 7
                    if start > 6:
                        end = content.find("```", start)
                        content = content[start:end]
                    else:
                        start = content.find("```") + 3
                        end = content.rfind("```")
                        content = content[start:end]
                parsed = json.loads(content.strip())
                if isinstance(parsed, list):
                    subtasks_data = parsed
                else:
                    subtasks_data = parsed.get("subtasks", [])
            except (json.JSONDecodeError, TypeError, KeyError) as e:
                logger.warning("failed_to_parse_plan", error=str(e), content=content[:200])
                subtasks_data = []

        for st_data in subtasks_data:
            # depends_on can be list of strings or list of dicts like [{"id": "task1"}]
            depends_on_raw = st_data.get("depends_on", [])
            depends_on = []
            for d in depends_on_raw:
                if isinstance(d, str):
                    depends_on.append(d)
                elif isinstance(d, dict) and "id" in d:
                    depends_on.append(str(d["id"]))
            plan.append(SubTask(
                id=str(st_data["id"]),
                description=st_data["description"],
                target_agent_id=st_data.get("target_agent_id", ""),
                depends_on=depends_on,
                parallel_group=st_data.get("parallel_group", 1),
            ))

        # Fallback: single task if nothing parsed
        if not plan:
            plan.append(SubTask(
                id="main",
                description=goal,
                target_agent_id=agents[0].id if agents else "default",
                depends_on=[],
                parallel_group=1,
            ))

        status = "executing" if plan else "error"

    except Exception as e:
        logger.error("plan_node_error", error=str(e))
        plan.append(SubTask(
            id="main",
            description=goal,
            target_agent_id=agents[0].id if agents else "default",
            depends_on=[],
            parallel_group=1,
        ))
        status = "error"

    node_end_result = emit(GraphEvent(
        type="node_end",
        node="plan",
        state_delta={"plan": [st.model_dump() for st in plan], "status": status},
    ))
    if asyncio.iscoroutine(node_end_result):
        await node_end_result
    else:
        async for _ in node_end_result:
            pass

    return {
        "plan": plan,
        "current_step": 0,
        "status": status,
    }


# Context offloading threshold (characters)
CONTEXT_THRESHOLD = 2000

# Retry settings
DEFAULT_MAX_RETRIES = 1
DEFAULT_TIMEOUT_SECONDS = 120


def offload_context(full_output: str, subtask_id: str) -> tuple[str, str]:
    """
    Offload large output to file and return (summary, filepath_reference).

    Args:
        full_output: The complete output text
        subtask_id: Unique ID for naming the output file

    Returns:
        (summary, filepath_reference_string)
    """
    import hashlib

    output_dir = DATA_DIR / "outputs"
    output_dir.mkdir(parents=True, exist_ok=True)
    filename = f"{subtask_id}_{hashlib.md5(full_output[:100].encode()).hexdigest()[:8]}.txt"
    filepath = output_dir / filename
    filepath.write_text(full_output, encoding="utf-8")

    return full_output[:200] + "...", f"[详细输出已存储: {filepath.name}]"


async def summarize_output(full_output: str, model_config: ModelConfig) -> str:
    """Summarize large output using LLM."""
    try:
        summary_messages = [
            {"role": "user", "content": f"请用200字以内总结以下内容的主要信息：\n\n{full_output[:3000]}"},
        ]
        summary_response = await llm_router.chat(summary_messages, model_config)
        return summary_response.get("content", full_output[:200] + "...")
    except Exception:
        return full_output[:200] + "..."


async def execute_subtask_isolated(
    subtask: SubTask,
    agent: AgentConfig,
    parent_context: SubAgentContext,
    model_config: ModelConfig,
    emit: Callable,
    max_retries: int = DEFAULT_MAX_RETRIES,
    timeout_seconds: int = DEFAULT_TIMEOUT_SECONDS,
) -> AsyncIterator[tuple[str, str, str]]:
    """
    Execute a single subtask with isolated context and retry support.
    Yields stream_token events and returns (subtask_id, summary, full_output_or_filepath).
    """
    # Build isolated context - agent only sees task + constraints + previous results summary
    previous_results_str = ""
    if parent_context.previous_results:
        prev_items = [f"- {k}: {v[:200]}" for k, v in parent_context.previous_results.items()]
        previous_results_str = "\n".join(prev_items)

    isolated_messages = [
        {"role": "system", "content": agent.system_prompt or f"You are {agent.name}."},
        {"role": "user", "content": f"""任务: {subtask.description}
约束: {parent_context.constraints or '无'}
前置结果摘要: {previous_results_str or '无'}

请简洁地完成此任务，直接输出结果，不要重复任务描述。"""},
    ]

    last_error = None
    for attempt in range(max_retries + 1):
        output_chunks = []
        try:
            async for chunk in llm_router.stream_chat(isolated_messages, model_config):
                output_chunks.append(chunk)
                # Yield stream token so it propagates through the iterator chain to SSE
                if chunk.get("content"):
                    yield {
                        "type": "stream_token",
                        "agent_id": agent.id,
                        "subtask_id": subtask.id,
                        "token": chunk["content"],
                    }

            full_output = "".join(c.get("content", "") if isinstance(c, dict) else str(c) for c in output_chunks)
            break  # Success, exit retry loop

        except asyncio.TimeoutError:
            last_error = TimeoutError(f"Subtask {subtask.id} timed out after {timeout_seconds}s")
            logger.warning("subtask_timeout", subtask_id=subtask.id, attempt=attempt + 1)
            if attempt < max_retries:
                async for _ in emit(GraphEvent(
                    type="status",
                    content=f"任务 {subtask.id} 超时，{timeout_seconds}秒后重试... (尝试 {attempt + 2}/{max_retries + 1})",
                )):
                    pass
                await asyncio.sleep(2)  # Brief backoff before retry
            continue

        except Exception as e:
            last_error = e
            logger.error("subtask_execution_error", subtask_id=subtask.id, error=str(e), attempt=attempt + 1)
            if attempt < max_retries:
                async for _ in emit(GraphEvent(
                    type="status",
                    content=f"任务 {subtask.id} 执行失败: {str(e)}，重试中... (尝试 {attempt + 2}/{max_retries + 1})",
                )):
                    pass
                await asyncio.sleep(1)
            continue

    else:
        # All retries exhausted
        yield subtask.id, f"[Error: {str(last_error)} after {max_retries + 1} attempts]", ""
        return

    full_output = "".join(c.get("content", "") if isinstance(c, dict) else str(c) for c in output_chunks)

    # Context offloading: if output > threshold, summarize and store to file
    if len(full_output) > CONTEXT_THRESHOLD:
        summary = await summarize_output(full_output, model_config)
        summary, filepath_ref = offload_context(full_output, subtask.id)
        yield subtask.id, summary, filepath_ref
    else:
        yield subtask.id, full_output, full_output


async def execute_node(state: GraphState, emit: Callable) -> AsyncIterator[dict]:
    """Execute current step's subtask(s) in parallel with context isolation. Yields stream events."""
    plan = state["plan"]
    current_step = state["current_step"]
    results = dict(state.get("results", {}))
    raw_outputs = dict(state.get("raw_outputs", {}))
    available_agents: list[AgentConfig] = state.get("available_agents", [])
    pending_events: list[dict] = []

    groups: dict[int, list[SubTask]] = {}
    for st in plan:
        if st.status == "pending":
            g = st.parallel_group
            if g not in groups:
                groups[g] = []
            groups[g].append(st)

    if not groups:
        yield {"status": "integrating", "_pending_events": pending_events}
        return

    target_groups = sorted(g for g in groups.keys() if g >= current_step)
    if not target_groups:
        yield {"status": "integrating", "_pending_events": pending_events}
        return

    for g in target_groups:
        group_tasks = groups[g]

        # Emit node_start - iterate the async generator
        node_start_result = emit(GraphEvent(
            type="node_start",
            node="execute",
            content=f"执行第 {g} 组任务，共 {len(group_tasks)} 个",
        ))
        if asyncio.iscoroutine(node_start_result):
            gen = await node_start_result
            async for _ in gen:
                pass
        else:
            async for _ in node_start_result:
                pass

        parent_context = state.get("context", SubAgentContext(goal=state["goal"]))
        completed_results = {}
        for completed_st in plan:
            if completed_st.status == "completed" and completed_st.output:
                completed_results[completed_st.id] = completed_st.output
        parent_context.previous_results = completed_results

        for st in group_tasks:
            # Run subtask and collect events
            target_agent = next(
                (a for a in available_agents if a.id == st.target_agent_id),
                available_agents[0] if available_agents else None,
            )

            if not target_agent:
                continue

            # Emit subtask_start
            subtask_start_result = emit(GraphEvent(type="subtask_start", node="execute", agent_id=target_agent.id, subtask_id=st.id))
            if asyncio.iscoroutine(subtask_start_result):
                gen = await subtask_start_result
                async for _ in gen:
                    pass
            else:
                async for _ in subtask_start_result:
                    pass

            model_config = target_agent.llm_config or ModelConfig(
                model_name="llama3.2:latest", provider="ollama"
            )

            async def emit_collect(event: GraphEvent):
                """Wrap emit to accumulate stream events."""
                result = emit(event)
                if asyncio.iscoroutine(result):
                    result = await result
                if hasattr(result, '__aiter__'):
                    async for item in result:
                        yield item
                else:
                    yield result

            subtask_result = None
            async for item in execute_subtask_isolated(st, target_agent, parent_context, model_config, emit_collect):
                if isinstance(item, dict):
                    yield item
                else:
                    subtask_result = item

            if subtask_result:
                subtask_id, summary, full_output = subtask_result
                results[subtask_id] = summary
                raw_outputs[subtask_id] = full_output

                is_error = summary.startswith("[Error:")
                agent_id = st.target_agent_id
                if is_error:
                    err_result = emit(GraphEvent(type="subtask_error", agent_id=agent_id, subtask_id=subtask_id, content=summary))
                    if asyncio.iscoroutine(err_result):
                        gen = await err_result
                        async for _ in gen:
                            pass
                    else:
                        async for _ in err_result:
                            pass
                else:
                    comp_result = emit(GraphEvent(type="subtask_complete", agent_id=agent_id, subtask_id=subtask_id, content=summary))
                    if asyncio.iscoroutine(comp_result):
                        gen = await comp_result
                        async for _ in gen:
                            pass
                    else:
                        async for _ in comp_result:
                            pass

                st.output = summary
                st.status = "completed" if not is_error else "error"

    next_step = current_step + 1
    if next_step >= len(plan):
        status = "integrating"
    else:
        status = "executing"

    yield {"results": results, "raw_outputs": raw_outputs, "current_step": next_step, "status": status, "_pending_events": pending_events}


async def integrate_node(state: GraphState, emit: Callable) -> dict:
    """Combine all results into final output."""
    results = state.get("results", {})
    raw_outputs = state.get("raw_outputs", {})

    if not results:
        final_output = ""
    elif len(results) == 1:
        final_output = list(results.values())[0] or ""
    else:
        summaries = []
        for subtask_id, output in results.items():
            summaries.append(f"## {subtask_id}\n{output or ''}")
        final_output = "\n\n---\n\n".join(summaries)

    node_end_result = emit(GraphEvent(
        type="node_end",
        node="integrate",
        content=final_output[:200] if final_output else "No output",
    ))
    if asyncio.iscoroutine(node_end_result):
        await node_end_result
    else:
        async for _ in node_end_result:
            pass

    return {
        "status": "done",
        "results": results,
    }


async def route_after_plan(state: GraphState) -> str:
    """Route after plan_node - go to execute if we have plan, else error."""
    plan = state.get("plan", [])
    return "execute" if plan else "error"


async def route_after_execute(state: GraphState) -> str:
    """Route after execute_node - continue if more steps, else integrate."""
    status = state.get("status", "")
    if status == "integrating":
        return "integrate"
    elif status == "executing":
        return "execute"  # Continue to next group
    elif status == "error":
        return "error"
    return "END"
