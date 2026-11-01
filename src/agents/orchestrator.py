from typing import List, Dict, Any, Optional
import re
from src.agents.registry import get_agent_profile, AgentProfile
from src.agents.tools.code_runner import execute_python_code
from src.agents.tools.web_search import search_duckduckgo, format_search_results_for_prompt

class Orchestrator:
    """
    Level 1 Meta-Orchestrator:
    - Analyzes complex multi-phase user requests.
    - Coordinates Level 2 worker agents (DevArchitect, DocSynth, Strategist, DataMind).
    - Interfaces with execution tools (Python Sandbox, Live DuckDuckGo Web Search).
    - Streams dynamic thinking/reasoning steps to the user interface.
    """

    @staticmethod
    def is_complex_goal(message: str) -> bool:
        normalized = message.lower()
        signals = [
            ("code", "test"),
            ("build", "plan"),
            ("analyze", "script"),
            ("summary", "action items"),
            ("algorithm", "benchmark"),
            ("compare", "recommend")
        ]
        return any(s1 in normalized and s2 in normalized for s1, s2 in signals)

    @staticmethod
    def should_web_search(message: str) -> bool:
        """
        Determines if a prompt requires live internet retrieval (news, current events, latest tech).
        """
        normalized = message.lower()
        search_triggers = [
            r"\b(search the web|google|search online|web search)\b",
            r"\b(latest|current|recent|today's|today|news|weather|stock price)\b",
            r"\b(release date|version|whats happening|what happened)\b",
            r"\b(2025|2026)\b"
        ]
        return any(re.search(pat, normalized) for pat in search_triggers)

    @staticmethod
    def generate_reasoning_steps(agent: AgentProfile, message: str, has_docs: bool = False, has_web_search: bool = False) -> List[str]:
        """
        Generates contextual reasoning/thinking steps for the UI stream.
        """
        steps = []
        steps.append(f"Analyzing objective with {agent.title} ({agent.name}).")

        if has_docs:
            steps.append("Analyzing attached document knowledge base for contextual evidence.")
        
        if has_web_search:
            steps.append("Searching the live web for verified facts and real-time updates.")

        if agent.id == "dev":
            steps.append("Inspecting architecture requirements, syntax standards, and Big-O efficiency.")
        elif agent.id == "researcher":
            steps.append("Cross-referencing factual evidence, citation claims, and document synthesis.")
        elif agent.id == "strategist":
            steps.append("Framing actionable milestones, strategic trade-offs, and execution timeline.")
        elif agent.id == "data":
            steps.append("Validating statistical parameters, quantitative formulations, and ROI metrics.")
        else:
            steps.append("Structuring comprehensive reasoning and formatting final answer.")

        return steps

    @staticmethod
    def execute_tool(tool_name: str, **kwargs) -> Dict[str, Any]:
        if tool_name == "python_sandbox":
            code = kwargs.get("code", "")
            return execute_python_code(code)
        elif tool_name == "web_search":
            query = kwargs.get("query", "")
            max_results = kwargs.get("max_results", 5)
            results = search_duckduckgo(query, max_results=max_results)
            return {
                "query": query,
                "results": results,
                "count": len(results)
            }
        return {"error": f"Unknown tool: {tool_name}"}

orchestrator = Orchestrator()
