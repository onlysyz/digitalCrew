"""
LLM Router Service - Unified LLM interface for Ollama and OpenAI-compatible APIs
"""
import asyncio
import os
from abc import ABC, abstractmethod
from typing import AsyncIterator, Optional

import httpx
import structlog

from backend.models.schemas import ModelConfig

logger = structlog.get_logger()


class LLMError(Exception):
    """Base LLM error."""
    pass


class RateLimitError(LLMError):
    pass


class TimeoutError(LLMError):
    pass


class LLMProvider(ABC):
    """Abstract LLM provider."""

    @abstractmethod
    async def chat(
        self,
        messages: list[dict],
        model_config: ModelConfig,
        tools: Optional[list[dict]] = None,
    ) -> dict:
        """Non-streaming chat completion."""

    @abstractmethod
    async def stream_chat(
        self,
        messages: list[dict],
        model_config: ModelConfig,
        tools: Optional[list[dict]] = None,
    ) -> AsyncIterator[dict]:
        """Streaming chat completion."""


class OllamaProvider(LLMProvider):
    """Ollama local model provider."""

    def __init__(self, base_url: str = "http://localhost:11434"):
        self.base_url = base_url.rstrip("/")

    async def _make_request(
        self,
        endpoint: str,
        method: str = "POST",
        json_data: Optional[dict] = None,
        timeout: float = 120.0,
    ) -> dict:
        """Make a request to Ollama API."""
        url = f"{self.base_url}{endpoint}"

        async with httpx.AsyncClient(timeout=timeout) as client:
            try:
                if method == "POST":
                    response = await client.post(url, json=json_data)
                else:
                    response = await client.get(url)

                if response.status_code == 404:
                    raise LLMError(f"Model not found: {json_data.get('model', 'unknown')}")
                if response.status_code == 429:
                    raise RateLimitError("Rate limited by Ollama")
                if response.status_code != 200:
                    raise LLMError(f"Ollama error: {response.status_code} {response.text}")

                return response.json()

            except httpx.TimeoutException:
                raise TimeoutError(f"Ollama request timed out after {timeout}s")
            except httpx.RequestError as e:
                raise LLMError(f"Connection error: {str(e)}")

    async def chat(
        self,
        messages: list[dict],
        model_config: ModelConfig,
        tools: Optional[list[dict]] = None,
    ) -> dict:
        """Non-streaming chat completion."""
        payload = {
            "model": model_config.model_name,
            "messages": messages,
            "options": {
                "temperature": model_config.temperature,
                "top_p": model_config.top_p,
                "num_predict": model_config.max_output_tokens,
                "num_ctx": model_config.context_window,
            },
            "stream": False,
        }

        if tools:
            payload["tools"] = tools

        result = await self._make_request("/api/chat", json_data=payload)
        return {
            "content": result["message"]["content"],
            "model": result.get("model", model_config.model_name),
            "usage": {
                "input_tokens": result.get("eval_count", 0),
                "output_tokens": result.get("prompt_eval_count", 0),
            },
            "tool_calls": result.get("tool_calls", []),
        }

    async def stream_chat(
        self,
        messages: list[dict],
        model_config: ModelConfig,
        tools: Optional[list[dict]] = None,
    ) -> AsyncIterator[dict]:
        """Streaming chat completion."""
        payload = {
            "model": model_config.model_name,
            "messages": messages,
            "options": {
                "temperature": model_config.temperature,
                "top_p": model_config.top_p,
                "num_predict": model_config.max_output_tokens,
                "num_ctx": model_config.context_window,
            },
            "stream": True,
        }

        if tools:
            payload["tools"] = tools

        url = f"{self.base_url}/api/chat"

        async with httpx.AsyncClient(timeout=120.0) as client:
            async with client.stream("POST", url, json=payload) as response:
                if response.status_code == 404:
                    raise LLMError(f"Model not found: {model_config.model_name}")
                if response.status_code != 200:
                    raise LLMError(f"Ollama stream error: {response.status_code}")

                async for line in response.aiter_lines():
                    if line:
                        try:
                            import json
                            data = json.loads(line)
                            yield {
                                "content": data.get("message", {}).get("content", ""),
                                "done": data.get("done", False),
                                "tool_calls": data.get("tool_calls", []),
                            }
                        except json.JSONDecodeError:
                            continue


class MiniMaxProvider(LLMProvider):
    """MiniMax API provider (Anthropic-compatible API)."""

    def __init__(self, base_url: str = "https://api.minimaxi.com"):
        self.base_url = base_url.rstrip("/")

    def _get_proxy(self) -> Optional[str]:
        """Get proxy from environment if not connecting to local services."""
        # Skip proxy for localhost and local IPs
        return None

    def _get_headers(self, api_key: str) -> dict:
        return {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        }

    async def _make_request(
        self,
        endpoint: str,
        api_key: str,
        json_data: Optional[dict] = None,
        timeout: float = 120.0,
    ) -> dict:
        url = f"{self.base_url}{endpoint}"
        logger.info("minimax_request", url=url, endpoint=endpoint, base_url=self.base_url)

        async with httpx.AsyncClient(timeout=timeout, proxy=self._get_proxy()) as client:
            try:
                response = await client.post(
                    url,
                    json=json_data,
                    headers=self._get_headers(api_key),
                )

                logger.info("minimax_response", status=response.status_code, url=url)

                if response.status_code == 401:
                    raise LLMError("Invalid API key")
                if response.status_code == 429:
                    raise RateLimitError("Rate limited by API provider")
                if response.status_code != 200:
                    raise LLMError(f"API error: {response.status_code} {response.text}")

                return response.json()

            except httpx.TimeoutException:
                raise TimeoutError(f"API request timed out after {timeout}s")
            except httpx.RequestError as e:
                raise LLMError(f"Connection error: {str(e)}")

    async def chat(
        self,
        messages: list[dict],
        model_config: ModelConfig,
        tools: Optional[list[dict]] = None,
    ) -> dict:
        # MiniMax uses Anthropic-style /v1/messages endpoint
        payload = {
            "model": model_config.model_name,
            "messages": messages,
            "max_tokens": model_config.max_output_tokens or 1024,
        }

        result = await self._make_request(
            "/v1/messages",
            api_key=model_config.api_key or "",
            json_data=payload,
        )

        # Convert Anthropic response to OpenAI format
        return {
            "content": result.get("content", [{}])[0].get("text", ""),
            "model": result.get("model", model_config.model_name),
            "usage": result.get("usage", {}),
            "tool_calls": [],
        }

    async def stream_chat(
        self,
        messages: list[dict],
        model_config: ModelConfig,
        tools: Optional[list[dict]] = None,
    ) -> AsyncIterator[dict]:
        payload = {
            "model": model_config.model_name,
            "messages": messages,
            "max_tokens": model_config.max_output_tokens or 1024,
            "stream": True,
        }

        url = f"{self.base_url}/v1/messages"

        async with httpx.AsyncClient(timeout=120.0, proxy=self._get_proxy()) as client:
            async with client.stream(
                "POST", url, json=payload, headers=self._get_headers(model_config.api_key or "")
            ) as response:
                if response.status_code != 200:
                    error_text = await response.atext()
                    raise LLMError(f"Stream error: {response.status_code} {error_text}")

                async for line in response.aiter_lines():
                    if line.startswith("data: "):
                        data_str = line[6:]
                        if data_str == "[DONE]":
                            yield {"done": True, "content": ""}
                            return
                        try:
                            import json
                            data = json.loads(data_str)
                            if data.get("type") == "content_block_delta":
                                yield {
                                    "content": data.get("delta", {}).get("text", ""),
                                    "done": False,
                                    "tool_calls": [],
                                }
                        except (json.JSONDecodeError, KeyError):
                            continue


class OpenAICompatibleProvider(LLMProvider):
    """OpenAI-compatible API provider (supports various cloud services)."""

    def __init__(self, base_url: str = "https://api.openai.com/v1"):
        self.base_url = base_url.rstrip("/")

    def _get_proxy(self) -> Optional[str]:
        """Get proxy from environment if not connecting to local services."""
        # Skip proxy for localhost and local IPs
        return None

    def _get_headers(self, api_key: str) -> dict:
        return {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        }

    async def _make_request(
        self,
        endpoint: str,
        api_key: str,
        json_data: Optional[dict] = None,
        timeout: float = 120.0,
    ) -> dict:
        url = f"{self.base_url}{endpoint}"
        logger.info("minimax_request", url=url, endpoint=endpoint, base_url=self.base_url)

        async with httpx.AsyncClient(timeout=timeout, proxy=self._get_proxy()) as client:
            try:
                response = await client.post(
                    url,
                    json=json_data,
                    headers=self._get_headers(api_key),
                )

                logger.info("minimax_response", status=response.status_code, url=url)

                if response.status_code == 401:
                    raise LLMError("Invalid API key")
                if response.status_code == 429:
                    raise RateLimitError("Rate limited by API provider")
                if response.status_code != 200:
                    raise LLMError(f"API error: {response.status_code} {response.text}")

                return response.json()

            except httpx.TimeoutException:
                raise TimeoutError(f"API request timed out after {timeout}s")
            except httpx.RequestError as e:
                raise LLMError(f"Connection error: {str(e)}")

    async def chat(
        self,
        messages: list[dict],
        model_config: ModelConfig,
        tools: Optional[list[dict]] = None,
    ) -> dict:
        payload = {
            "model": model_config.model_name,
            "messages": messages,
            "temperature": model_config.temperature,
            "top_p": model_config.top_p,
            "max_tokens": model_config.max_output_tokens,
        }

        if tools:
            payload["tools"] = tools

        result = await self._make_request(
            "/chat/completions",
            api_key=model_config.api_key or "",
            json_data=payload,
        )

        message = result["choices"][0]["message"]
        return {
            "content": message.get("content", ""),
            "model": result.get("model", model_config.model_name),
            "usage": result.get("usage", {}),
            "tool_calls": message.get("tool_calls", []),
        }

    async def stream_chat(
        self,
        messages: list[dict],
        model_config: ModelConfig,
        tools: Optional[list[dict]] = None,
    ) -> AsyncIterator[dict]:
        payload = {
            "model": model_config.model_name,
            "messages": messages,
            "temperature": model_config.temperature,
            "top_p": model_config.top_p,
            "max_tokens": model_config.max_output_tokens,
            "stream": True,
        }

        if tools:
            payload["tools"] = tools

        url = f"{self.base_url}/chat/completions"

        async with httpx.AsyncClient(timeout=120.0, proxy=self._get_proxy()) as client:
            async with client.stream(
                "POST", url, json=payload, headers=self._get_headers(model_config.api_key or "")
            ) as response:
                if response.status_code != 200:
                    error_text = await response.atext()
                    raise LLMError(f"Stream error: {response.status_code} {error_text}")

                async for line in response.aiter_lines():
                    if line.startswith("data: "):
                        data_str = line[6:]
                        if data_str == "[DONE]":
                            yield {"done": True, "content": ""}
                            return
                        try:
                            import json
                            data = json.loads(data_str)
                            delta = data["choices"][0].get("delta", {})
                            yield {
                                "content": delta.get("content", ""),
                                "done": False,
                                "tool_calls": delta.get("tool_calls", []),
                            }
                        except (json.JSONDecodeError, KeyError):
                            continue


class LLMRouter:
    """
    Unified LLM router that dispatches to the appropriate provider.
    """

    def __init__(self):
        self._providers: dict[str, LLMProvider] = {}
        self._default_provider: Optional[str] = None

    def register_provider(self, name: str, provider: LLMProvider, default: bool = False):
        """Register an LLM provider."""
        self._providers[name] = provider
        if default or not self._default_provider:
            self._default_provider = name

    def get_provider(self, provider_name: str) -> LLMProvider:
        """Get a provider by name."""
        if provider_name not in self._providers:
            raise ValueError(f"Unknown provider: {provider_name}")
        return self._providers[provider_name]

    async def chat(
        self,
        messages: list[dict],
        model_config: ModelConfig,
        tools: Optional[list[dict]] = None,
        provider_name: Optional[str] = None,
    ) -> dict:
        """Send a chat request."""
        provider = self.get_provider(provider_name or model_config.provider)

        try:
            result = await provider.chat(messages, model_config, tools)
            logger.info(
                "llm_chat_completed",
                provider=provider_name or model_config.provider,
                model=model_config.model_name,
            )
            return result
        except Exception as e:
            logger.error(
                "llm_chat_failed",
                provider=provider_name or model_config.provider,
                error=str(e),
            )
            raise

    async def stream_chat(
        self,
        messages: list[dict],
        model_config: ModelConfig,
        tools: Optional[list[dict]] = None,
        provider_name: Optional[str] = None,
    ) -> AsyncIterator[dict]:
        """Stream a chat response."""
        provider = self.get_provider(provider_name or model_config.provider)

        try:
            async for chunk in provider.stream_chat(messages, model_config, tools):
                yield chunk
        except Exception as e:
            logger.error(
                "llm_stream_failed",
                provider=provider_name or model_config.provider,
                error=str(e),
            )
            raise

    async def list_local_models(self) -> list[dict]:
        """List models available in Ollama."""
        provider = self.get_provider("ollama")

        async with httpx.AsyncClient() as client:
            try:
                response = await client.get(f"{'http://localhost:11434'}/api/tags")
                if response.status_code == 200:
                    data = response.json()
                    return data.get("models", [])
                return []
            except Exception:
                return []

    async def test_connection(self, provider: str, base_url: str, api_key: Optional[str] = None) -> dict:
        """Test connection to a provider."""
        if provider == "ollama":
            p = OllamaProvider(base_url)
            try:
                models = await self.list_local_models()
                return {"success": True, "models": models}
            except Exception as e:
                return {"success": False, "error": str(e)}
        elif provider == "minimax":
            p = MiniMaxProvider(base_url)
            try:
                await p.chat(
                    [{"role": "user", "content": "hi"}],
                    ModelConfig(model_name="MiniMax-M2.7", api_key=api_key or "test"),
                )
                return {"success": True}
            except Exception as e:
                return {"success": False, "error": str(e)}
        elif provider in ["openai", "claude"]:
            # OpenAI and Claude use OpenAI-compatible API with /v1/chat/completions
            p = OpenAICompatibleProvider(base_url)
            try:
                model_name = {
                    "openai": "gpt-4o-mini",
                    "claude": "claude-3-5-sonnet-20241022"
                }.get(provider, "gpt-4o-mini")
                await p.chat(
                    [{"role": "user", "content": "hi"}],
                    ModelConfig(model_name=model_name, api_key=api_key or "test"),
                )
                return {"success": True}
            except Exception as e:
                return {"success": False, "error": str(e)}
        elif provider == "openai_compatible":
            p = OpenAICompatibleProvider(base_url)
            try:
                await p.chat(
                    [{"role": "user", "content": "test"}],
                    ModelConfig(model_name="gpt-4o-mini", api_key=api_key or "test"),
                )
                return {"success": True}
            except Exception as e:
                return {"success": False, "error": str(e)}
        return {"success": False, "error": f"Unknown provider: {provider}"}


# Global singleton with default providers
llm_router = LLMRouter()

# Register default providers
llm_router.register_provider(
    "ollama",
    OllamaProvider(os.environ.get("OLLAMA_BASE_URL", "http://localhost:11434")),
    default=True,
)
llm_router.register_provider(
    "openai_compatible",
    OpenAICompatibleProvider(),
    default=False,
)

# Register MiniMax provider
llm_router.register_provider(
    "minimax",
    MiniMaxProvider(),
    default=False,
)