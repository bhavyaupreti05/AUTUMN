import uuid
import json
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional
from src.database.connection import get_connection

ROLE_PRESETS = {
    "manager": {
        "title": "Project Lead & Coordinator",
        "system_prompt": (
            "You are the Manager and Principal Orchestrator. Your role is to break down complex goals, "
            "plan execution milestones, coordinate worker agents (Builder, Researcher, Tester), "
            "and synthesize all deliverables into a clean, comprehensive final outcome."
        ),
        "tools": ["web_search", "python_sandbox"],
        "icon": "crown"
    },
    "builder": {
        "title": "Principal Software Engineer & Maker",
        "system_prompt": (
            "You are the Builder and Software Architect. Your specialty is writing clean, scalable, "
            "production-ready code (Python, TypeScript, SQL, Bash), structuring robust system architectures, "
            "and creating fully functional implementations."
        ),
        "tools": ["python_sandbox", "web_search"],
        "icon": "hammer"
    },
    "researcher": {
        "title": "Lead Intelligence & Data Scout",
        "system_prompt": (
            "You are the Researcher and Technical Scout. Your role is to search the live web, investigate "
            "documentation, analyze research papers and documents, extract key facts, source links, and benchmark data."
        ),
        "tools": ["web_search"],
        "icon": "search"
    },
    "tester": {
        "title": "Quality Assurance & Sandbox Runner",
        "system_prompt": (
            "You are the Tester and QA Engineer. Your role is to test code rigorously in the Python Sandbox, "
            "detect edge cases, inspect runtime stdout/stderr, verify exit codes, and report reproducible bugs."
        ),
        "tools": ["python_sandbox"],
        "icon": "zap"
    },
    "reviewer": {
        "title": "Senior Auditor & Quality Critic",
        "system_prompt": (
            "You are the Reviewer and Technical Critic. Your role is to evaluate work against high standards, "
            "detect hallucinations, check code readability, ensure requirements are fully satisfied, and polish deliverables."
        ),
        "tools": ["web_search"],
        "icon": "check-circle"
    }
}

class AgentRepository:
    """Repository for managing Autonomous Agents, Tasks, and Multi-Phase Pipelines."""

    @staticmethod
    def create_agent(
        user_id: str,
        name: str,
        role: str,
        title: Optional[str] = None,
        system_prompt: Optional[str] = None,
        tools: Optional[List[str]] = None,
        icon: Optional[str] = None
    ) -> Dict[str, Any]:
        agent_id = str(uuid.uuid4())
        preset = ROLE_PRESETS.get(role, {})
        
        assigned_title = title or preset.get("title", f"{role.capitalize()} Agent")
        assigned_prompt = system_prompt or preset.get("system_prompt", "You are an autonomous AI agent.")
        assigned_tools = tools if tools is not None else preset.get("tools", ["web_search", "python_sandbox"])
        assigned_icon = icon or preset.get("icon", "bot")

        tools_json = json.dumps(assigned_tools)

        with get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO custom_agents (id, user_id, name, role, title, system_prompt, tools, icon)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """, (agent_id, user_id, name, role, assigned_title, assigned_prompt, tools_json, assigned_icon))
            conn.commit()

        return AgentRepository.get_agent(agent_id, user_id)  # type: ignore

    @staticmethod
    def get_agent(agent_id: str, user_id: Optional[str] = None) -> Optional[Dict[str, Any]]:
        with get_connection() as conn:
            cursor = conn.cursor()
            if user_id:
                cursor.execute("SELECT * FROM custom_agents WHERE id = ? AND user_id = ?", (agent_id, user_id))
            else:
                cursor.execute("SELECT * FROM custom_agents WHERE id = ?", (agent_id,))
            row = cursor.fetchone()
            if not row:
                return None
            data = dict(row)
            data["tools"] = json.loads(data["tools"]) if data["tools"] else []
            return data

    @staticmethod
    def list_agents(user_id: str) -> List[Dict[str, Any]]:
        with get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM custom_agents WHERE user_id = ? ORDER BY created_at ASC", (user_id,))
            rows = cursor.fetchall()

        # If user has no agents yet, automatically seed default team
        if not rows:
            AgentRepository.seed_default_agents(user_id)
            return AgentRepository.list_agents(user_id)

        agents = []
        for r in rows:
            item = dict(r)
            item["tools"] = json.loads(item["tools"]) if item["tools"] else []
            agents.append(item)
        return agents

    @staticmethod
    def seed_default_agents(user_id: str):
        defaults = [
            ("Autumn Manager", "manager"),
            ("Dev Architect", "builder"),
            ("DocSynth Researcher", "researcher"),
            ("Sandbox Tester", "tester"),
            ("Code Reviewer", "reviewer"),
        ]
        for name, role in defaults:
            AgentRepository.create_agent(user_id=user_id, name=name, role=role)

    @staticmethod
    def delete_agent(agent_id: str, user_id: str) -> bool:
        with get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("DELETE FROM custom_agents WHERE id = ? AND user_id = ?", (agent_id, user_id))
            conn.commit()
            return cursor.rowcount > 0

    # -------------------------------------------------------------
    # TASKS (Independent & Background Execution)
    # -------------------------------------------------------------

    @staticmethod
    def create_task(
        user_id: str,
        title: str,
        prompt: str,
        agent_id: Optional[str] = None,
        pipeline_id: Optional[str] = None,
        phase_index: int = 0
    ) -> Dict[str, Any]:
        task_id = str(uuid.uuid4())
        with get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO agent_tasks (id, user_id, agent_id, pipeline_id, phase_index, title, prompt, status)
                VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')
            """, (task_id, user_id, agent_id, pipeline_id, phase_index, title, prompt))
            conn.commit()

        return AgentRepository.get_task(task_id, user_id)  # type: ignore

    @staticmethod
    def get_task(task_id: str, user_id: Optional[str] = None) -> Optional[Dict[str, Any]]:
        with get_connection() as conn:
            cursor = conn.cursor()
            query = """
                SELECT t.*, a.name as agent_name, a.role as agent_role, a.title as agent_title, a.icon as agent_icon
                FROM agent_tasks t
                LEFT JOIN custom_agents a ON t.agent_id = a.id
                WHERE t.id = ?
            """
            params = [task_id]
            if user_id:
                query += " AND t.user_id = ?"
                params.append(user_id)
            cursor.execute(query, tuple(params))
            row = cursor.fetchone()
            if not row:
                return None
            data = dict(row)
            data["artifacts"] = json.loads(data["artifacts"]) if data.get("artifacts") else None
            return data

    @staticmethod
    def update_task_status(
        task_id: str,
        status: str,
        result: Optional[str] = None,
        artifacts: Optional[Dict[str, Any]] = None,
        error_message: Optional[str] = None
    ) -> Optional[Dict[str, Any]]:
        completed_at = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S") if status in ("completed", "failed") else None
        artifacts_json = json.dumps(artifacts) if artifacts is not None else None

        with get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                UPDATE agent_tasks
                SET status = ?, result = COALESCE(?, result), artifacts = COALESCE(?, artifacts),
                    error_message = COALESCE(?, error_message), completed_at = COALESCE(?, completed_at)
                WHERE id = ?
            """, (status, result, artifacts_json, error_message, completed_at, task_id))
            conn.commit()

        return AgentRepository.get_task(task_id)

    @staticmethod
    def list_tasks(user_id: str, status: Optional[str] = None, limit: int = 50) -> List[Dict[str, Any]]:
        with get_connection() as conn:
            cursor = conn.cursor()
            query = """
                SELECT t.*, a.name as agent_name, a.role as agent_role, a.title as agent_title, a.icon as agent_icon
                FROM agent_tasks t
                LEFT JOIN custom_agents a ON t.agent_id = a.id
                WHERE t.user_id = ?
            """
            params = [user_id]
            if status:
                query += " AND t.status = ?"
                params.append(status)
            query += " ORDER BY t.created_at DESC LIMIT ?"
            params.append(limit)

            cursor.execute(query, tuple(params))
            rows = cursor.fetchall()

        tasks = []
        for r in rows:
            item = dict(r)
            item["artifacts"] = json.loads(item["artifacts"]) if item.get("artifacts") else None
            tasks.append(item)
        return tasks

    @staticmethod
    def get_unread_notifications(user_id: str) -> List[Dict[str, Any]]:
        with get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT t.id, t.title, t.status, t.completed_at, a.name as agent_name, a.role as agent_role
                FROM agent_tasks t
                LEFT JOIN custom_agents a ON t.agent_id = a.id
                WHERE t.user_id = ? AND t.is_read = 0 AND t.status IN ('completed', 'failed')
                ORDER BY t.completed_at DESC LIMIT 20
            """, (user_id,))
            rows = cursor.fetchall()
            return [dict(r) for r in rows]

    @staticmethod
    def mark_notifications_as_read(user_id: str, task_ids: Optional[List[str]] = None) -> int:
        with get_connection() as conn:
            cursor = conn.cursor()
            if task_ids:
                placeholders = ",".join("?" for _ in task_ids)
                cursor.execute(f"""
                    UPDATE agent_tasks SET is_read = 1
                    WHERE user_id = ? AND id IN ({placeholders})
                """, [user_id, *task_ids])
            else:
                cursor.execute("""
                    UPDATE agent_tasks SET is_read = 1 WHERE user_id = ? AND is_read = 0
                """, (user_id,))
            conn.commit()
            return cursor.rowcount

    # -------------------------------------------------------------
    # PIPELINES (Multi-Phase Interconnected Workflows)
    # -------------------------------------------------------------

    @staticmethod
    def create_pipeline(user_id: str, title: str, goal: str, stages: List[Dict[str, Any]]) -> Dict[str, Any]:
        pipeline_id = str(uuid.uuid4())
        stages_json = json.dumps(stages)

        with get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO agent_pipelines (id, user_id, title, goal, stages, status, current_stage)
                VALUES (?, ?, ?, ?, ?, 'pending', 0)
            """, (pipeline_id, user_id, title, goal, stages_json))
            conn.commit()

        return AgentRepository.get_pipeline(pipeline_id, user_id)  # type: ignore

    @staticmethod
    def get_pipeline(pipeline_id: str, user_id: Optional[str] = None) -> Optional[Dict[str, Any]]:
        with get_connection() as conn:
            cursor = conn.cursor()
            query = "SELECT * FROM agent_pipelines WHERE id = ?"
            params = [pipeline_id]
            if user_id:
                query += " AND user_id = ?"
                params.append(user_id)
            cursor.execute(query, tuple(params))
            row = cursor.fetchone()
            if not row:
                return None
            data = dict(row)
            data["stages"] = json.loads(data["stages"]) if data.get("stages") else []
            return data

    @staticmethod
    def update_pipeline_progress(
        pipeline_id: str,
        current_stage: int,
        status: Optional[str] = None,
        final_output: Optional[str] = None
    ) -> Optional[Dict[str, Any]]:
        completed_at = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S") if status in ("completed", "failed") else None

        with get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                UPDATE agent_pipelines
                SET current_stage = ?,
                    status = COALESCE(?, status),
                    final_output = COALESCE(?, final_output),
                    completed_at = COALESCE(?, completed_at)
                WHERE id = ?
            """, (current_stage, status, final_output, completed_at, pipeline_id))
            conn.commit()

        return AgentRepository.get_pipeline(pipeline_id)

    @staticmethod
    def list_pipelines(user_id: str, limit: int = 20) -> List[Dict[str, Any]]:
        with get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT * FROM agent_pipelines WHERE user_id = ? ORDER BY created_at DESC LIMIT ?
            """, (user_id, limit))
            rows = cursor.fetchall()

        pipelines = []
        for r in rows:
            item = dict(r)
            item["stages"] = json.loads(item["stages"]) if item.get("stages") else []
            pipelines.append(item)
        return pipelines
