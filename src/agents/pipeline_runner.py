import asyncio
import logging
from typing import Dict, Any, List
from src.database.agent_repository import AgentRepository
from src.agents.task_service import TaskService

logger = logging.getLogger(__name__)

class PipelineRunner:
    """
    Executes interconnected multi-phase agent workflows.
    Sequentially pipes the deliverable of Phase N into the prompt of Phase N+1.
    """

    @staticmethod
    async def run_pipeline(pipeline_id: str) -> Dict[str, Any]:
        pipeline = AgentRepository.get_pipeline(pipeline_id)
        if not pipeline:
            logger.error(f"Pipeline {pipeline_id} not found")
            return {"error": "Pipeline not found"}

        AgentRepository.update_pipeline_progress(pipeline_id, current_stage=0, status="running")
        stages: List[Dict[str, Any]] = pipeline.get("stages", [])
        user_id = pipeline["user_id"]
        goal = pipeline["goal"]

        previous_deliverable = ""
        stage_results: List[Dict[str, Any]] = []

        try:
            for idx, stage in enumerate(stages):
                AgentRepository.update_pipeline_progress(pipeline_id, current_stage=idx, status="running")
                
                agent_id = stage.get("agent_id")
                stage_title = stage.get("title", f"Phase {idx + 1}")
                stage_instruction = stage.get("instruction", f"Execute phase {idx + 1} for goal: {goal}")

                # Build chained prompt with context from earlier phase
                prompt_parts = []
                prompt_parts.append(f"OVERALL PIPELINE GOAL: {goal}\n")
                if previous_deliverable:
                    prev_role = stages[idx - 1].get("role", "Worker Agent")
                    prompt_parts.append(
                        f"\n--- [INPUT FROM PHASE {idx} ({prev_role})] ---\n"
                        f"{previous_deliverable}\n"
                        f"--- [END PREVIOUS INPUT] ---\n"
                    )

                prompt_parts.append(
                    f"\nYOUR ASSIGNED PHASE {idx + 1} OBJECTIVE:\n"
                    f"{stage_instruction}\n"
                    f"Incorporate the findings from previous phases to produce your specialized deliverable."
                )
                
                full_stage_prompt = "\n".join(prompt_parts)

                # Create task for this stage
                task = AgentRepository.create_task(
                    user_id=user_id,
                    title=f"[{pipeline['title']}] - {stage_title}",
                    prompt=full_stage_prompt,
                    agent_id=agent_id,
                    pipeline_id=pipeline_id,
                    phase_index=idx
                )

                # Execute this stage's task
                executed_task = await TaskService.run_task(task["id"])
                stage_output = executed_task.get("result", "")
                previous_deliverable = stage_output

                stage_results.append({
                    "stage_index": idx,
                    "title": stage_title,
                    "agent_id": agent_id,
                    "task_id": task["id"],
                    "status": executed_task.get("status", "completed"),
                    "output_preview": stage_output[:300] if stage_output else "",
                    "artifacts": executed_task.get("artifacts")
                })

                if executed_task.get("status") == "failed":
                    logger.warning(f"Pipeline {pipeline_id} stage {idx} encountered failure: {executed_task.get('error_message')}")

            # Assemble synthesis / final package
            final_output_blocks = [
                f"# Autonomous Workflow Deliverable: {pipeline['title']}\n\n",
                f"**Overall Goal:** {goal}\n\n",
                "## Execution Phases Summary\n"
            ]
            for sr in stage_results:
                final_output_blocks.append(f"### {sr['title']} ({sr['status'].upper()})\n")
            
            final_output_blocks.append("\n## Final Synthesized Outcome\n")
            final_output_blocks.append(previous_deliverable if previous_deliverable else "All pipeline phases concluded.")

            final_text = "".join(final_output_blocks)

            updated = AgentRepository.update_pipeline_progress(
                pipeline_id=pipeline_id,
                current_stage=len(stages),
                status="completed",
                final_output=final_text
            )
            return updated or {}

        except Exception as e:
            logger.exception(f"Error running pipeline {pipeline_id}: {e}")
            updated = AgentRepository.update_pipeline_progress(
                pipeline_id=pipeline_id,
                current_stage=pipeline.get("current_stage", 0),
                status="failed",
                final_output=f"Pipeline aborted due to error: {str(e)}"
            )
            return updated or {}
