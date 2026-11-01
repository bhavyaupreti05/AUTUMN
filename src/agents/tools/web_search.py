"""
Autumn Live Web Search Tool
Provides real-time web retrieval via DuckDuckGo without external API keys.
"""

from typing import List, Dict, Any
import httpx
from urllib.parse import quote_plus, unquote
import re
import html
import logging

logger = logging.getLogger(__name__)

def search_duckduckgo(query: str, max_results: int = 5) -> List[Dict[str, str]]:
    """
    Executes a web search query via DuckDuckGo and returns structured results.
    Each item contains 'title', 'snippet', and 'url'.
    """
    clean_query = query.strip()
    if not clean_query:
        return []

    url = f"https://html.duckduckgo.com/html/?q={quote_plus(clean_query)}"
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.7",
    }

    results: List[Dict[str, str]] = []

    try:
        with httpx.Client(timeout=8.0, follow_redirects=True) as client:
            resp = client.get(url, headers=headers)
            if resp.status_code == 200:
                for b in re.finditer(
                    r'<h2 class="result__title">[\s\S]*?<a class="result__url"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)</a>[\s\S]*?<a class="result__snippet"[^>]*>([\s\S]*?)</a>',
                    resp.text
                ):
                    raw_url = b.group(1)
                    actual_url = raw_url
                    if "uddg=" in raw_url:
                        match = re.search(r'uddg=([^&]+)', raw_url)
                        if match:
                            actual_url = unquote(match.group(1))

                    title = re.sub(r'<[^>]+>', '', b.group(2)).strip()
                    snippet = re.sub(r'<[^>]+>', '', b.group(3)).strip()
                    
                    if title and snippet:
                        results.append({
                            "title": html.unescape(title),
                            "snippet": html.unescape(snippet),
                            "url": actual_url
                        })
                    if len(results) >= max_results:
                        break

            # Fallback to DuckDuckGo Instant Answer API if HTML results were empty
            if not results:
                api_url = f"https://api.duckduckgo.com/?q={quote_plus(clean_query)}&format=json&no_html=1"
                api_resp = client.get(api_url, headers=headers)
                if api_resp.status_code == 200:
                    data = api_resp.json()
                    if data.get("AbstractText"):
                        results.append({
                            "title": data.get("Heading", clean_query),
                            "snippet": data.get("AbstractText"),
                            "url": data.get("AbstractURL", "")
                        })
                    for topic in data.get("RelatedTopics", [])[:max_results]:
                        if isinstance(topic, dict) and topic.get("Text"):
                            results.append({
                                "title": topic.get("Text")[:60] + "...",
                                "snippet": topic.get("Text"),
                                "url": topic.get("FirstURL", "")
                            })
                            if len(results) >= max_results:
                                break

    except Exception as e:
        logger.warning(f"DuckDuckGo search warning for '{clean_query}': {e}")

    return results

def format_search_results_for_prompt(results: List[Dict[str, str]], query: str) -> str:
    """Formats search results as groundable context for the LLM prompt."""
    if not results:
        return ""

    lines = [f"[Live Web Search Context for: \"{query}\"]"]
    for idx, r in enumerate(results, start=1):
        lines.append(f"{idx}. {r.get('title', 'Source')}")
        lines.append(f"   Snippet: {r.get('snippet', '')}")
        lines.append(f"   Source URL: {r.get('url', '')}")
    lines.append("Use these live web findings to provide accurate, up-to-date answers and cite the source URLs when referencing specific claims.")
    return "\n".join(lines)
