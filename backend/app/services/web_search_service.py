"""Live Web Search service supporting Tavily API and DuckDuckGo search fallback."""

import html
import re
import urllib.parse
from typing import List, Optional, Tuple
import httpx
from backend.app.core.config import get_settings
from backend.app.schemas.document import WebSourceItem


class WebSearchService:
    """Orchestrates live web search queries with real source retrieval."""

    @property
    def enabled(self) -> bool:
        """Check if live web search is enabled dynamically from settings."""
        return get_settings().WEB_SEARCH_ENABLED

    @property
    def provider(self) -> str:
        """Get configured search provider in lowercase ('tavily', 'duckduckgo')."""
        return (get_settings().WEB_SEARCH_PROVIDER or "tavily").lower().strip()

    @property
    def tavily_api_key(self) -> str:
        """Get Tavily API key from backend settings (never exposed to frontend)."""
        return (get_settings().TAVILY_API_KEY or "").strip()

    def is_configured(self) -> bool:
        """Check if web search is enabled and operational."""
        return bool(self.enabled)

    async def search(self, query: str, max_results: int = 5) -> Tuple[List[WebSourceItem], Optional[str]]:
        """Execute real web search using configured provider with automatic fallback."""
        if not self.is_configured():
            return [], "Live Web Search is currently disabled in backend settings (WEB_SEARCH_ENABLED=false)."

        # Provider: Tavily
        if self.provider == "tavily":
            if self.tavily_api_key and self.tavily_api_key not in ["your_tavily_api_key_here", ""]:
                items, err = await self._search_tavily(query, max_results)
                if items:
                    return items, None
                # If Tavily returned error (quota, network, invalid key), gracefully fall back to DuckDuckGo
                print(f"[WebSearch] Tavily failed ({err}); falling back to DuckDuckGo...")
                return await self._search_duckduckgo(query, max_results)
            else:
                # Tavily API key not configured yet; automatically fall back to DuckDuckGo
                return await self._search_duckduckgo(query, max_results)

        # Provider: DuckDuckGo
        elif self.provider in ["duckduckgo", "ddg"]:
            return await self._search_duckduckgo(query, max_results)

        else:
            # Fallback to DuckDuckGo for any unrecognized provider
            return await self._search_duckduckgo(query, max_results)

    async def _search_tavily(self, query: str, max_results: int = 5) -> Tuple[List[WebSourceItem], Optional[str]]:
        """Query Tavily Search REST API with key protection."""
        if not self.tavily_api_key or self.tavily_api_key == "your_tavily_api_key_here":
            return [], "TAVILY_API_KEY is not configured in .env."

        url = "https://api.tavily.com/search"
        payload = {
            "api_key": self.tavily_api_key,
            "query": query,
            "search_depth": "basic",
            "include_answer": False,
            "max_results": max_results,
        }
        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                res = await client.post(url, json=payload)
                if res.status_code != 200:
                    err_msg = res.text[:200]
                    if self.tavily_api_key:
                        err_msg = err_msg.replace(self.tavily_api_key, "[REDACTED]")
                    return [], f"Tavily returned HTTP {res.status_code}: {err_msg}"

                data = res.json()
                items: List[WebSourceItem] = []
                for r in data.get("results", []):
                    items.append(
                        WebSourceItem(
                            title=r.get("title", "Untitled Web Result"),
                            url=r.get("url", ""),
                            snippet=r.get("content", "").strip(),
                            score=r.get("score"),
                        )
                    )
                return items, None
        except httpx.TimeoutException:
            return [], "Tavily web search request timed out."
        except Exception as exc:
            return [], f"Failed to execute Tavily search: {str(exc)}"

    async def _search_duckduckgo(self, query: str, max_results: int = 5) -> Tuple[List[WebSourceItem], Optional[str]]:
        """Query DuckDuckGo for live internet results without requiring an API key."""
        url = "https://html.duckduckgo.com/html/"
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        }
        try:
            async with httpx.AsyncClient(timeout=15.0, follow_redirects=True) as client:
                res = await client.post(url, data={"q": query}, headers=headers)
                if res.status_code != 200:
                    return [], f"DuckDuckGo search error: HTTP {res.status_code}"

                raw_html = res.text
                items: List[WebSourceItem] = []

                # Find all result link anchors
                link_matches = re.finditer(
                    r'<a[^>]+class="[^"]*result__a[^"]*"[^>]+href="([^"]+)"[^>]*>(.*?)</a>',
                    raw_html,
                    re.DOTALL,
                )

                for lm in link_matches:
                    raw_href = lm.group(1)
                    title_html = lm.group(2)
                    clean_title = html.unescape(re.sub(r'<[^>]+>', '', title_html).strip())

                    # Extract destination URL from DuckDuckGo redirect wrapper if present
                    uddg_match = re.search(r'uddg=([^&]+)', raw_href)
                    clean_url = urllib.parse.unquote(uddg_match.group(1)) if uddg_match else raw_href

                    if not clean_url.startswith("http"):
                        continue

                    # Look for snippet near this link
                    start_pos = lm.end()
                    chunk = raw_html[start_pos : start_pos + 3500]
                    snip_match = re.search(r'<a[^>]+class="[^"]*result__snippet[^"]*"[^>]*>(.*?)</a>', chunk, re.DOTALL)
                    clean_snippet = ""
                    if snip_match:
                        clean_snippet = html.unescape(re.sub(r'<[^>]+>', '', snip_match.group(1)).strip())

                    items.append(
                        WebSourceItem(
                            title=clean_title or "Web Result",
                            url=clean_url,
                            snippet=clean_snippet,
                        )
                    )

                    if len(items) >= max_results:
                        break

                if not items:
                    return [], "No web search results found for query."

                return items, None
        except httpx.TimeoutException:
            return [], "DuckDuckGo web search request timed out."
        except Exception as exc:
            return [], f"Failed to execute DuckDuckGo search: {str(exc)}"


# Global WebSearchService singleton
_web_search_instance: Optional[WebSearchService] = None


def get_web_search_service() -> WebSearchService:
    global _web_search_instance
    if _web_search_instance is None:
        _web_search_instance = WebSearchService()
    return _web_search_instance
