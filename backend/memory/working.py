"""
Working Memory - LLM context window management
"""
from typing import Any


class WorkingMemory:
    """
    Manages working memory - the LLM context window.
    Automatically manages context window size and summarization.
    """

    def __init__(self, max_tokens: int = 4096):
        self.max_tokens = max_tokens
        self.messages: list[dict] = []
        self._token_count = 0

    def add_message(self, role: str, content: str, metadata: dict | None = None) -> None:
        """Add a message to working memory."""
        message = {
            "role": role,
            "content": content,
            "metadata": metadata or {},
        }
        self.messages.append(message)

        # Estimate token count (rough: ~4 chars per token for English, ~2 for Chinese)
        estimated_tokens = len(content) // 4
        self._token_count += estimated_tokens

    def get_context(self) -> list[dict]:
        """Get current context for LLM."""
        # If over window, summarize early messages
        if self._token_count > self.max_tokens * 0.8:
            self._compress_context()

        return self.messages

    def _compress_context(self) -> None:
        """Compress context by summarizing early messages."""
        if len(self.messages) <= 2:
            return

        # Keep system message and last few messages
        system_msg = None
        if self.messages[0]["role"] == "system":
            system_msg = self.messages[0]

        recent = self.messages[-4:]

        summary_content = (
            f"[Previous conversation summarized ({len(self.messages) - 4} messages omitted)]"
        )

        self.messages = []
        if system_msg:
            self.messages.append(system_msg)
        self.messages.append({
            "role": "system",
            "content": summary_content,
            "metadata": {"type": "summary"}
        })
        self.messages.extend(recent)

        # Recalculate token count
        self._token_count = sum(
            len(m["content"]) // 4 for m in self.messages
        )

    def clear(self) -> None:
        """Clear all working memory."""
        self.messages.clear()
        self._token_count = 0

    def count_messages(self) -> int:
        """Get number of messages."""
        return len(self.messages)

    def get_token_count(self) -> int:
        """Get estimated token count."""
        return self._token_count
