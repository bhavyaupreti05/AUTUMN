import unittest
from unittest.mock import patch, MagicMock
from src.agents.tools.web_search import search_duckduckgo, format_search_results_for_prompt
from src.agents.orchestrator import orchestrator
from src.agents.registry import get_agent_profile

class TestWebSearch(unittest.TestCase):
    def test_search_duckduckgo_empty_query(self):
        res = search_duckduckgo("")
        self.assertEqual(res, [])

    @patch("src.agents.tools.web_search.httpx.Client")
    def test_search_duckduckgo_mocked(self, mock_client_cls):
        mock_client = MagicMock()
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.text = '''
        <h2 class="result__title">
            <a class="result__url" href="https://duckduckgo.com/l/?uddg=https%3A%2F%2Fpython.org%2F">python.org</a>
            <a class="result__snippet">Official Python programming language website</a>
        </h2>
        '''
        mock_client.__enter__.return_value.get.return_value = mock_resp
        mock_client_cls.return_value = mock_client

        results = search_duckduckgo("python", max_results=1)
        self.assertGreaterEqual(len(results), 1)
        self.assertEqual(results[0]["url"], "https://python.org/")
        self.assertIn("Official Python", results[0]["snippet"])

    def test_format_search_results_for_prompt(self):
        items = [{"title": "Python 3.12", "snippet": "New features in Python 3.12", "url": "https://python.org"}]
        context = format_search_results_for_prompt(items, "python 3.12")
        self.assertIn("Live Web Search Context", context)
        self.assertIn("https://python.org", context)

    def test_orchestrator_should_web_search(self):
        self.assertTrue(orchestrator.should_web_search("What is the latest news in AI in 2026?"))
        self.assertTrue(orchestrator.should_web_search("search the web for fastAPI"))
        self.assertFalse(orchestrator.should_web_search("hello autumn"))

    def test_orchestrator_reasoning_steps(self):
        agent = get_agent_profile("dev")
        steps = orchestrator.generate_reasoning_steps(agent, "write a function", has_docs=False, has_web_search=True)
        self.assertGreaterEqual(len(steps), 3)
        self.assertTrue(any("DevArchitect" in s for s in steps))
        self.assertTrue(any("live web" in s for s in steps))

    def test_orchestrator_execute_tool_web_search(self):
        with patch("src.agents.orchestrator.search_duckduckgo") as mock_search:
            mock_search.return_value = [{"title": "Test", "snippet": "Test snippet", "url": "https://test.com"}]
            out = orchestrator.execute_tool("web_search", query="test query", max_results=1)
            self.assertEqual(out["count"], 1)
            self.assertEqual(out["query"], "test query")

if __name__ == "__main__":
    unittest.main()
