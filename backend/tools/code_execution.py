"""
Code Execution Tool - Sandboxed Python execution
"""
import asyncio
import uuid
from pathlib import Path
from typing import Optional

import structlog

from backend.tools.base import Tool, ToolContext, ToolResult

logger = structlog.get_logger()


class CodeExecutionTool(Tool):
    """Execute Python code in a sandboxed environment."""

    name = "code_execution"
    description = (
        "Execute Python code in an isolated sandbox. "
        "Returns stdout, stderr, and execution time. "
        "Supports pip install for temporary packages."
    )
    parameters = {
        "type": "object",
        "properties": {
            "code": {"type": "string", "description": "Python code to execute"},
            "timeout": {"type": "number", "default": 60, "description": "Timeout in seconds"},
            "install_packages": {"type": "array", "items": {"type": "string"}, "description": "Packages to pip install"}
        },
        "required": ["code"]
    }
    risk_level = "medium"
    requires_confirmation = True

    def __init__(self):
        super().__init__()
        self._container_pool: dict[str, asyncio.Task] = {}
        self._max_containers = 3

    async def execute(self, params: dict, context: ToolContext) -> ToolResult:
        code = params.get("code", "")
        timeout = min(params.get("timeout", 60), context.timeout)
        install_packages = params.get("install_packages", [])

        if not code.strip():
            return ToolResult(success=False, error="Empty code provided")

        execution_id = str(uuid.uuid4())[:8]

        try:
            result = await self._execute_in_sandbox(
                code=code,
                timeout=timeout,
                install_packages=install_packages,
                execution_id=execution_id,
                workspace_dir=context.workspace_dir,
            )

            return result

        except asyncio.TimeoutError:
            return ToolResult(
                success=False,
                error=f"Code execution timed out after {timeout}s",
                metadata={"execution_id": execution_id}
            )
        except Exception as e:
            logger.error("code_execution_failed", execution_id=execution_id, error=str(e))
            return ToolResult(
                success=False,
                error=f"Execution error: {str(e)}",
                metadata={"execution_id": execution_id}
            )

    async def _execute_in_sandbox(
        self,
        code: str,
        timeout: int,
        install_packages: list[str],
        execution_id: str,
        workspace_dir: Path,
    ) -> ToolResult:
        """Execute code in a subprocess sandbox."""

        # Build the execution command
        import sys
        import tempfile

        # Create a temp script file
        with tempfile.NamedTemporaryFile(
            mode="w",
            suffix="_execution.py",
            delete=False,
            dir=str(workspace_dir),
            encoding="utf-8"
        ) as f:
            f.write(code)
            script_path = f.name

        try:
            # Build command
            cmd = [sys.executable, script_path]

            # Set environment for isolation
            env = {
                "PATH": "/usr/bin:/bin:/usr/local/bin",
                "HOME": str(workspace_dir),
                "TMPDIR": str(workspace_dir / "tmp"),
            }

            # Pre-install packages if requested
            if install_packages:
                install_cmd = [sys.executable, "-m", "pip", "install", "-q"] + install_packages
                proc = await asyncio.create_subprocess_exec(
                    *install_cmd,
                    stdout=asyncio.subprocess.PIPE,
                    stderr=asyncio.subprocess.PIPE,
                    env=env,
                    cwd=str(workspace_dir),
                )
                install_out, install_err = await proc.communicate()
                if proc.returncode != 0:
                    logger.warning("package_install_failed", stderr=install_err.decode())

            # Execute the code
            proc = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                env=env,
                cwd=str(workspace_dir),
            )

            try:
                stdout, stderr = await asyncio.wait_for(
                    proc.communicate(),
                    timeout=timeout
                )
            except asyncio.TimeoutError:
                proc.kill()
                await proc.wait()
                raise asyncio.TimeoutError()

            output = stdout.decode("utf-8", errors="replace")
            error = stderr.decode("utf-8", errors="replace")

            success = proc.returncode == 0

            return ToolResult(
                success=success,
                output={
                    "stdout": output,
                    "stderr": error,
                    "exit_code": proc.returncode,
                },
                metadata={
                    "execution_id": execution_id,
                    "timeout": timeout,
                }
            )

        finally:
            # Clean up temp script
            Path(script_path).unlink(missing_ok=True)

    async def _execute_in_docker(
        self,
        code: str,
        timeout: int,
        install_packages: list[str],
        execution_id: str,
        workspace_dir: Path,
    ) -> ToolResult:
        """Execute code in a Docker container (more secure isolation)."""
        import json

        container_id = f"digitalcrew-sandbox-{execution_id}"

        docker_cmd = [
            "docker", "run",
            "--rm",
            "--network=none",
            "--memory=512m",
            "--cpus=1",
            "-v", f"{workspace_dir}:/workspace:ro",
            "-w", "/workspace",
            "python:3.11-slim",
            "python", "-c", code
        ]

        try:
            proc = await asyncio.create_subprocess_exec(
                *docker_cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )

            try:
                stdout, stderr = await asyncio.wait_for(
                    proc.communicate(),
                    timeout=timeout
                )
            except asyncio.TimeoutError:
                proc.kill()
                await proc.wait()
                raise asyncio.TimeoutError()

            output = stdout.decode("utf-8", errors="replace")
            error = stderr.decode("utf-8", errors="replace")

            return ToolResult(
                success=proc.returncode == 0,
                output={
                    "stdout": output,
                    "stderr": error,
                    "exit_code": proc.returncode,
                },
                metadata={"execution_id": execution_id, "docker": True}
            )

        except FileNotFoundError:
            # Docker not available, fall back to subprocess
            logger.warning("docker_not_available_falling_back")
            return await self._execute_in_sandbox(
                code, timeout, install_packages, execution_id, workspace_dir
            )