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
    
    # If no custom stages are provided, generate standard 4-phase team pipeline
    stages = payload.stages
    if not stages:
        agents = AgentRepository.list_agents(user_id)
        role_map = {a["role"]: a["id"] for a in agents}
        
        stages = [
            {
                "title": "Phase 1: Research & Discovery",
                "role": "researcher",
                "agent_id": role_map.get("researcher"),
                "instruction": f"Perform deep technical research and gather relevant docs/facts for: {payload.goal}"
            },
            {
                "title": "Phase 2: Architecture & Implementation",
                "role": "builder",
                "agent_id": role_map.get("builder"),
                "instruction": f"Using the Phase 1 research, design the architecture and write clean, robust code for: {payload.goal}"
            },
            {
                "title": "Phase 3: Sandbox Verification & Testing",
                "role": "tester",
                "agent_id": role_map.get("tester"),
                "instruction": f"Inspect the implementation, run tests in Python Sandbox, and verify edge cases for: {payload.goal}"
            },
            {
                "title": "Phase 4: Senior Audit & Review",
                "role": "reviewer",
                "agent_id": role_map.get("reviewer"),
                "instruction": f"Review all phase deliverables, verify quality, and assemble the executive report for: {payload.goal}"
            }
        ]

    pipeline = AgentRepository.create_pipeline(
        user_id=user_id,
        title=payload.title,
        goal=payload.goal,
        stages=stages
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
