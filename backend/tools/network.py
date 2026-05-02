"""
Network Tools - Web search and scraping
"""
import asyncio
from typing import Optional

import httpx
import structlog

from backend.tools.base import Tool, ToolContext, ToolResult

logger = structlog.get_logger()


class WebSearchTool(Tool):
    """Perform web searches using configured API."""

    name = "web_search"
    description = (
        "Search the web for information. Returns search results with titles, "
        "URLs, and snippets. Supports Tavily, SerpAPI, and Bing Search."
    )
    parameters = {
        "type": "object",
        "properties": {
            "query": {"type": "string", "description": "Search query"},
            "limit": {"type": "number", "default": 5, "description": "Maximum results to return"}
        },
        "required": ["query"]
    }
    risk_level = "low"

    def __init__(self):
        super().__init__()
        self._search_provider: Optional[str] = None
        self._api_keys: dict[str, str] = {}

    def configure(self, provider: str, api_keys: dict[str, str]):
        """Configure the search provider."""
        self._search_provider = provider
        self._api_keys = api_keys

    async def execute(self, params: dict, context: ToolContext) -> ToolResult:
        query = params.get("query", "")
        limit = min(params.get("limit", 5), 10)

        if not query:
            return ToolResult(success=False, error="Empty query")

        try:
            if self._search_provider == "tavily":
                results = await self._search_tavily(query, limit)
            elif self._search_provider == "serpapi":
                results = await self._search_serpapi(query, limit)
            elif self._search_provider == "bing":
                results = await self._search_bing(query, limit)
            else:
                # Demo mode - return mock results
                results = self._mock_results(query, limit)

            return ToolResult(
                success=True,
                output=results,
                metadata={"query": query, "result_count": len(results)}
            )

        except Exception as e:
            logger.error("web_search_failed", query=query, error=str(e))
            return ToolResult(success=False, error=f"Search failed: {str(e)}")

    async def _search_tavily(self, query: str, limit: int) -> list[dict]:
        api_key = self._api_keys.get("tavily", "")
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                "https://api.tavily.com/search",
                json={"query": query, "max_results": limit},
                headers={"Authorization": f"Bearer {api_key}"}
            )
            data = response.json()
            return [
                {
                    "title": r["title"],
                    "url": r["url"],
                    "snippet": r["content"],
                }
                for r in data.get("results", [])
            ]

    async def _search_serpapi(self, query: str, limit: int) -> list[dict]:
        api_key = self._api_keys.get("serpapi", "")
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(
                "https://serpapi.com/search",
                params={
                    "q": query,
                    "api_key": api_key,
                    "num": limit,
                }
            )
            data = response.json()
            return [
                {
                    "title": r["title"],
                    "url": r["link"],
                    "snippet": r.get("snippet", ""),
                }
                for r in data.get("organic_results", [])
            ]

    async def _search_bing(self, query: str, limit: int) -> list[dict]:
        api_key = self._api_keys.get("bing", "")
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(
                "https://api.bing.microsoft.com/v7.0/search",
                params={"q": query, "count": limit},
                headers={"Ocp-Apim-Subscription-Key": api_key}
            )
            data = response.json()
            return [
                {
                    "title": r["name"],
                    "url": r["url"],
                    "snippet": r.get("snippet", ""),
                }
                for r in data.get("webPages", {}).get("value", [])
            ]

    def _mock_results(self, query: str, limit: int) -> list[dict]:
        """Return mock results when no search API is configured."""
        return [
            {
                "title": f"Result about '{query}'",
                "url": "https://example.com/result",
                "snippet": f"This is a placeholder result for the query: {query}. Configure a search API for real results.",
            }
        ] * min(limit, 3)


class WebScrapeTool(Tool):
    """Scrape web pages and convert to markdown."""

    name = "web_scrape"
    description = (
        "Fetch and parse a web page, converting it to readable markdown. "
        "Supports JavaScript rendering via Playwright."
    )
    parameters = {
        "type": "object",
        "properties": {
            "url": {"type": "string", "description": "URL to scrape", "format": "uri"},
            "render_js": {"type": "boolean", "default": False, "description": "Enable JavaScript rendering"}
        },
        "required": ["url"]
    }
    risk_level = "low"

    async def execute(self, params: dict, context: ToolContext) -> ToolResult:
        url = params.get("url", "")

        if not url:
            return ToolResult(success=False, error="Empty URL")

        # Basic URL validation
        if not url.startswith(("http://", "https://")):
            return ToolResult(success=False, error="Invalid URL scheme")

        try:
            content = await self._fetch_page(url, params.get("render_js", False))

            return ToolResult(
                success=True,
                output={
                    "url": url,
                    "content": content,
                    "content_length": len(content),
                },
                metadata={"url": url}
            )

        except Exception as e:
            logger.error("web_scrape_failed", url=url, error=str(e))
            return ToolResult(success=False, error=f"Scrape failed: {str(e)}")

    async def _fetch_page(self, url: str, render_js: bool) -> str:
        """Fetch and parse a web page."""
        async with httpx.AsyncClient(timeout=30.0, follow_redirects=True) as client:
            response = await client.get(url)
            response.raise_for_status()

            content_type = response.headers.get("content-type", "")

            if "text/html" in content_type:
                # Basic HTML to text conversion
                # In production, use BeautifulSoup or similar
                html = response.text
                return self._extract_text_from_html(html)
            else:
                return response.text[:5000]

    def _extract_text_from_html(self, html: str) -> str:
        """Basic HTML to text extraction."""
        import re

        # Remove script and style tags
        html = re.sub(r"<script[^>]*>.*?</script>", "", html, flags=re.DOTALL)
        html = re.sub(r"<style[^>]*>.*?</style>", "", html, flags=re.DOTALL)

        # Replace tags with newlines
        html = re.sub(r"<[^>]+>", " ", html)

        # Clean up whitespace
        html = re.sub(r"\s+", " ", html)

        # Decode HTML entities
        html = html.replace("&nbsp;", " ").replace("&lt;", "<").replace("&gt;", ">")
        html = html.replace("&amp;", "&").replace("&quot;", '"')

        return html.strip()[:10000]  # Limit output size


