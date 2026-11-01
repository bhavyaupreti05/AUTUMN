import re
from src.agents.registry import get_agent_profile, AgentProfile

def detect_best_agent(message: str, has_documents: bool = False) -> AgentProfile:
    """
    Analyzes prompt semantics and context to assign the most effective
    Level 2 specialized worker agent.
    """
    normalized = message.lower().strip()

    # 1. Developer / Code Intent
    code_keywords = [
        "code", "function", "python", "typescript", "javascript", "react", "fastapi",
        "bug", "error", "traceback", "debug", "refactor", "pytest", "unit test",
        "api", "database", "sql", "git", "class", "async", "algorithm", "complexity",
        "endpoint", "backend", "frontend", "docker", "deploy", "build"
    ]
    if any(re.search(rf"\b{re.escape(kw)}\b", normalized) for kw in code_keywords):
        return get_agent_profile("dev")

    # 2. Document & Research Intent
    research_keywords = [
        "summarize", "summary", "pdf", "document", "paper", "citation", "cite",
        "page", "extract", "findings", "research", "methodology", "literature",
        "report", "article", "source", "evidence"
    ]
    if has_documents or any(re.search(rf"\b{re.escape(kw)}\b", normalized) for kw in research_keywords):
        return get_agent_profile("researcher")

    # 3. Quantitative / Data Intent
    data_keywords = [
        "csv", "excel", "table", "data", "chart", "metrics", "revenue", "profit",
        "loss", "p&l", "statistic", "trend", "percentage", "sales", "analytics",
        "forecast", "growth", "cac", "ltv", "roi"
    ]
    if any(re.search(rf"\b{re.escape(kw)}\b", normalized) for kw in data_keywords):
        return get_agent_profile("data")

    # 4. Career & Strategic Life Planning Intent
    career_keywords = [
        "resume", "cv", "job", "interview", "career", "study plan", "schedule",
        "roadmap", "eisenhower", "timeline", "routine", "productivity", "goal",
        "email", "proposal", "cover letter"
    ]
    if any(re.search(rf"\b{re.escape(kw)}\b", normalized) for kw in career_keywords):
        return get_agent_profile("strategist")

    # Default to DevArchitect or general Autonomous persona
    return get_agent_profile("auto")
