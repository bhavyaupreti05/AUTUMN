from typing import List, Dict, Any, Optional
from src.agents.registry import get_agent_profile, AgentProfile
from src.agents.tools.code_runner import execute_python_code

class Orchestrator:
    """
    Level 1 Meta-Orchestrator:
    - Analyzes complex multi-phase user requests.
    - Coordinates Level 2 worker agents (DevArchitect, DocSynth, Strategist, DataMind).
    - Interfaces with execution tools (Python Sandbox).
    """

    @staticmethod
    def is_complex_goal(message: str) -> bool:
        normalized = message.lower()
        # Checks if request explicitly asks for multiple components:
        # e.g., "code AND test", "analyze report AND write script", "roadmap AND sample code"
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
    def execute_tool(tool_name: str, **kwargs) -> Dict[str, Any]:
        if tool_name == "python_sandbox":
            code = kwargs.get("code", "")
            return execute_python_code(code)
        return {"error": f"Unknown tool: {tool_name}"}

orchestrator = Orchestrator()
