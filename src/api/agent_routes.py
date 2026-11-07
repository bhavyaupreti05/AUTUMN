from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks
from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional
from src.auth.dependencies import get_current_user
from src.database.agent_repository import AgentRepository, ROLE_PRESETS
from src.agents.task_service import TaskService
from src.agents.pipeline_runner import PipelineRunner
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/agents", tags=["agents"])

# Pydantic Request Models
class CreateAgentRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    role: str = Field(..., pattern="^(manager|builder|researcher|tester|reviewer|custom)$")
    title: Optional[str] = None
    system_prompt: Optional[str] = None
    tools: Optional[List[str]] = None
    icon: Optional[str] = "bot"

class CreateTaskRequest(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    prompt: str = Field(..., min_length=1)
    context_links: Optional[List[str]] = Field(default_factory=list)
    document_ids: Optional[List[str]] = Field(default_factory=list)

class CreatePipelineRequest(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    goal: str = Field(..., min_length=1)
    stages: Optional[List[Dict[str, Any]]] = None
    document_ids: Optional[List[str]] = Field(default_factory=list)
    context_links: Optional[List[str]] = Field(default_factory=list)
    save_as_template: Optional[bool] = False
    template_name: Optional[str] = None
    template_description: Optional[str] = None

class CreateTemplateRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    description: Optional[str] = ""
    stages: List[Dict[str, Any]] = Field(..., min_items=1)

BUILTIN_FLOW_PRESETS = [
    {
        "id": "preset-fullstack",
        "name": "Full-Stack Development & QA (4-Phase)",
        "description": "Sequential discovery, architectural implementation, sandbox testing, and executive code audit.",
        "stages": [
            {
                "title": "Phase 1: Research & Discovery",
                "role": "researcher",
                "instruction": "Scout technical architecture patterns, dependencies, edge cases, and documentation."
            },
            {
                "title": "Phase 2: Architecture & Implementation",
                "role": "builder",
                "instruction": "Design the system architecture and implement production-ready, clean, modular code."
            },
            {
                "title": "Phase 3: Sandbox Verification & QA",
                "role": "tester",
                "instruction": "Execute the code in the Python Sandbox, run stress and regression tests, and isolate runtime errors."
            },
            {
                "title": "Phase 4: Senior Audit & Review",
                "role": "reviewer",
                "instruction": "Audit code quality, evaluate performance, and assemble the final executive deliverable."
            }
        ]
    },
    {
        "id": "preset-research",
        "name": "Deep Research & Strategic Synthesis (3-Phase)",
        "description": "Live intelligence gathering, structured data extraction, and strategic roadmap delivery.",
        "stages": [
            {
                "title": "Phase 1: Live Intelligence Gathering",
                "role": "researcher",
                "instruction": "Search live web and attached knowledge base documents to extract evidence and benchmarks."
            },
            {
                "title": "Phase 2: Data Extraction & Structuring",
                "role": "builder",
                "instruction": "Structure findings into comparison matrices, key metrics, and actionable breakdown."
            },
            {
                "title": "Phase 3: Strategic Roadmap & Whitepaper",
                "role": "reviewer",
                "instruction": "Deliver an executive whitepaper with strategic recommendations, risk analysis, and citations."
            }
        ]
    },
    {
        "id": "preset-bugfix",
        "name": "Bug Investigation & Sandbox Patch (3-Phase)",
        "description": "Root cause isolation, targeted patch construction, and sandbox validation.",
        "stages": [
            {
                "title": "Phase 1: Root Cause Analysis",
                "role": "researcher",
                "instruction": "Inspect error logs, trace execution paths, and isolate the exact bug."
            },
            {
                "title": "Phase 2: Targeted Patch Engineering",
                "role": "builder",
                "instruction": "Write a clean, minimal code patch that resolves the issue without regressions."
            },
            {
                "title": "Phase 3: Sandbox Validation Test",
                "role": "tester",
                "instruction": "Execute test cases in the Python sandbox to verify the bug is completely resolved."
            }
        ]
    }
]

class MarkReadRequest(BaseModel):
    task_ids: Optional[List[str]] = None

# --- AGENT CRUD ---

@router.get("")
def list_agents(user: Dict[str, Any] = Depends(get_current_user)):
    user_id = user["id"]
    return AgentRepository.list_agents(user_id)

@router.get("/roles/presets")
def get_role_presets():
    return ROLE_PRESETS

@router.post("")
def create_agent(payload: CreateAgentRequest, user: Dict[str, Any] = Depends(get_current_user)):
    user_id = user["id"]
    agent = AgentRepository.create_agent(
        user_id=user_id,
        name=payload.name,
        role=payload.role,
        title=payload.title,
        system_prompt=payload.system_prompt,
        tools=payload.tools,
        icon=payload.icon
    )
    return agent

@router.delete("/{agent_id}")
def delete_agent(agent_id: str, user: Dict[str, Any] = Depends(get_current_user)):
    user_id = user["id"]
    success = AgentRepository.delete_agent(agent_id, user_id)
    if not success:
        raise HTTPException(status_code=404, detail="Agent not found or already deleted")
    return {"message": "Agent deleted successfully"}

# --- TASKS (Independent Execution) ---

@router.post("/{agent_id}/tasks")
def dispatch_task(
    agent_id: str,
    payload: CreateTaskRequest,
    background_tasks: BackgroundTasks,
    user: Dict[str, Any] = Depends(get_current_user)
):
    user_id = user["id"]
    agent = AgentRepository.get_agent(agent_id, user_id)
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")

    task = AgentRepository.create_task(
        user_id=user_id,
        agent_id=agent_id,
        title=payload.title,
        prompt=payload.prompt,
        context_links=payload.context_links,
        document_ids=payload.document_ids
    )

    # Launch in background async task
    background_tasks.add_task(TaskService.run_task, task["id"])
    return {
        "message": f"Task dispatched to {agent['name']} ({agent['role']})",
        "task": task
    }

@router.get("/tasks")
def list_tasks(status: Optional[str] = None, user: Dict[str, Any] = Depends(get_current_user)):
    user_id = user["id"]
    return AgentRepository.list_tasks(user_id, status=status)

@router.get("/tasks/{task_id}")
def get_task(task_id: str, user: Dict[str, Any] = Depends(get_current_user)):
    user_id = user["id"]
    task = AgentRepository.get_task(task_id, user_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return task

# --- NOTIFICATIONS ---

@router.get("/notifications")
def get_notifications(user: Dict[str, Any] = Depends(get_current_user)):
    user_id = user["id"]
    return AgentRepository.get_unread_notifications(user_id)

@router.post("/notifications/mark-read")
def mark_notifications_read(payload: MarkReadRequest, user: Dict[str, Any] = Depends(get_current_user)):
    user_id = user["id"]
    updated_count = AgentRepository.mark_notifications_as_read(user_id, payload.task_ids)
    return {"marked_count": updated_count}

# --- MULTI-PHASE PIPELINES ---

@router.post("/pipelines")
def create_and_run_pipeline(
    payload: CreatePipelineRequest,
    background_tasks: BackgroundTasks,
    user: Dict[str, Any] = Depends(get_current_user)
):
    user_id = user["id"]
    
    # Ensure every stage has a mapped agent_id
    agents = AgentRepository.list_agents(user_id)
    role_map = {a["role"]: a["id"] for a in agents}
    default_agent_id = agents[0]["id"] if agents else None

    stages = payload.stages
    if not stages:
        stages = [
            {
                "title": "Phase 1: Research & Discovery",
                "role": "researcher",
                "agent_id": role_map.get("researcher", default_agent_id),
                "instruction": f"Perform deep technical research and gather relevant docs/facts for: {payload.goal}"
            },
            {
                "title": "Phase 2: Architecture & Implementation",
                "role": "builder",
                "agent_id": role_map.get("builder", default_agent_id),
                "instruction": f"Using the Phase 1 research, design the architecture and write clean, robust code for: {payload.goal}"
            },
            {
                "title": "Phase 3: Sandbox Verification & Testing",
                "role": "tester",
                "agent_id": role_map.get("tester", default_agent_id),
                "instruction": f"Inspect the implementation, run tests in Python Sandbox, and verify edge cases for: {payload.goal}"
            },
            {
                "title": "Phase 4: Senior Audit & Review",
                "role": "reviewer",
                "agent_id": role_map.get("reviewer", default_agent_id),
                "instruction": f"Review all phase deliverables, verify quality, and assemble the executive report for: {payload.goal}"
            }
        ]
    else:
        # Fill in agent_id if omitted in stage
        for s in stages:
            if not s.get("agent_id"):
                stage_role = s.get("role", "builder")
                s["agent_id"] = role_map.get(stage_role, default_agent_id)

    # Save as custom template if requested
    template_id = None
    if payload.save_as_template and payload.template_name:
        template = AgentRepository.create_pipeline_template(
            user_id=user_id,
            name=payload.template_name.strip(),
            description=payload.template_description or "",
            stages=stages
        )
        template_id = template["id"]

    pipeline = AgentRepository.create_pipeline(
        user_id=user_id,
        title=payload.title,
        goal=payload.goal,
        stages=stages,
        document_ids=payload.document_ids or [],
        context_links=payload.context_links or [],
        template_id=template_id
    )

    # Launch pipeline in background
    background_tasks.add_task(PipelineRunner.run_pipeline, pipeline["id"])
    return {
        "message": f"Autonomous pipeline '{pipeline['title']}' launched with {len(stages)} stages.",
        "pipeline": pipeline
    }

@router.get("/pipelines")
def list_pipelines(user: Dict[str, Any] = Depends(get_current_user)):
    user_id = user["id"]
    return AgentRepository.list_pipelines(user_id)

@router.get("/pipelines/{pipeline_id}")
def get_pipeline(pipeline_id: str, user: Dict[str, Any] = Depends(get_current_user)):
    user_id = user["id"]
    pipeline = AgentRepository.get_pipeline(pipeline_id, user_id)
    if not pipeline:
        raise HTTPException(status_code=404, detail="Pipeline not found")
    return pipeline

# --- PIPELINE FLOW TEMPLATES ---

@router.get("/templates")
def list_templates(user: Dict[str, Any] = Depends(get_current_user)):
    user_id = user["id"]
    user_templates = AgentRepository.list_pipeline_templates(user_id)
    return {
        "templates": user_templates,
        "presets": BUILTIN_FLOW_PRESETS
    }

@router.post("/templates")
def create_template(payload: CreateTemplateRequest, user: Dict[str, Any] = Depends(get_current_user)):
    user_id = user["id"]
    template = AgentRepository.create_pipeline_template(
        user_id=user_id,
        name=payload.name.strip(),
        description=payload.description or "",
        stages=payload.stages
    )
    return {
        "message": f"Flow template '{template['name']}' saved successfully.",
        "template": template
    }

@router.delete("/templates/{template_id}")
def delete_template(template_id: str, user: Dict[str, Any] = Depends(get_current_user)):
    user_id = user["id"]
    deleted = AgentRepository.delete_pipeline_template(template_id, user_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Template not found")
    return {"message": "Flow template deleted successfully."}
