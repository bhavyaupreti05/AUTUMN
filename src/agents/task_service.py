import asyncio
import re
import logging
from typing import Dict, Any, Optional
from src.database.agent_repository import AgentRepository, ROLE_PRESETS
from src.llm.provider import get_llm_provider
from src.agents.tools.code_runner import execute_python_code
from src.agents.tools.web_search import search_duckduckgo, format_search_results_for_prompt

logger = logging.getLogger(__name__)

class TaskService:
    """Service for running independent agent tasks in background with tool support."""

    @staticmethod
    def _extract_python_code(text: str) -> Optional[str]:
        match = re.search(r"```(?:python|py)\n(.*?)```", text, re.DOTALL)
        if match:
            return match.group(1).strip()
        return None

    @staticmethod
    async def run_task(task_id: str) -> Dict[str, Any]:
        task = AgentRepository.get_task(task_id)
        if not task:
            logger.error(f"Task {task_id} not found")
            return {"error": "Task not found"}

        AgentRepository.update_task_status(task_id, status="running")
        artifacts: Dict[str, Any] = {
            "search_citations": [],
            "sandbox_execution": None,
            "grounded_documents": [],
            "context_links": []
        }

        try:
            agent = AgentRepository.get_agent(task["agent_id"]) if task.get("agent_id") else None
            role = agent.get("role", "builder") if agent else "builder"
            preset = ROLE_PRESETS.get(role, {})
            system_prompt = agent.get("system_prompt") if agent else preset.get("system_prompt", "You are an autonomous AI assistant.")
            tools = agent.get("tools", []) if agent else preset.get("tools", ["web_search", "python_sandbox"])

            # 1. Document Grounding (PDF/DOCX/CSV/XLSX RAG)
            doc_context = ""
            doc_ids = task.get("document_ids") or []
            if doc_ids:
                from src.database.document_repository import DocumentRepository
                doc_repo = DocumentRepository()
                grounded_docs = []
                for doc_id in doc_ids:
                    doc = doc_repo.get_document(doc_id)
                    if doc:
                        grounded_docs.append({"id": doc_id, "filename": doc.get("filename")})
                        chunks = doc_repo.get_chunks(doc_id)
                        if chunks:
                            combined = "\n".join(c.get("text", "") for c in chunks[:8])
                            doc_context += f"\n--- [ATTACHED KNOWLEDGE BASE: {doc.get('filename')}] ---\n{combined[:5000]}\n--- [END {doc.get('filename')}] ---\n"
                        elif doc.get("summary"):
                            doc_context += f"\n--- [ATTACHED DOCUMENT SUMMARY: {doc.get('filename')}] ---\n{doc.get('summary')}\n"
                artifacts["grounded_documents"] = grounded_docs

            # 2. External Context & MCP Connection Links
            links_context = ""
            links = task.get("context_links") or []
            if links:
                artifacts["context_links"] = links
                links_context += "\n--- [EXTERNAL CONTEXT & MCP CONNECTION RESOURCES] ---\n"
                for link in links:
                    links_context += f"• Connection / Resource: {link}\n"
                links_context += "--- [END EXTERNAL RESOURCES] ---\n"

            search_context = ""
            # If web_search is enabled for this agent
            if "web_search" in tools:
                needs_search = role == "researcher" or any(k in task["prompt"].lower() for k in ["search", "latest", "news", "current", "find", "explore", "docs"])
                if needs_search:
                    try:
                        search_results = search_duckduckgo(task["prompt"], max_results=4)
                        if search_results:
                            search_context = format_search_results_for_prompt(search_results)
                            artifacts["search_citations"] = search_results
                    except Exception as search_err:
                        logger.warning(f"Background web search failed: {search_err}")

            # Assemble complete prompt for LLM
            prompt_parts = [
                f"<|im_start|>system\n{system_prompt}\n"
                f"You are operating as role: {role.upper()}.\n"
                f"Provide a clear, high-quality, actionable response.\n"
            ]
            if doc_context:
                prompt_parts.append(f"\n{doc_context}\n")
            if links_context:
                prompt_parts.append(f"\n{links_context}\n")
            if search_context:
                prompt_parts.append(f"\n{search_context}\n")
            
            prompt_parts.append(
                f"<|im_end|>\n<|im_start|>user\n{task['prompt']}\n<|im_end|>\n<|im_start|>assistant\n"
            )
            full_prompt = "".join(prompt_parts)

            # Generate via LLM Provider
            llm = get_llm_provider()
            generated_chunks = []
            
            # Run generator in threadpool to keep async loop unblocked
            def _generate():
                for chunk in llm.generate_stream(full_prompt, is_background_task=True):
                    if chunk.get("type") == "text":
                        generated_chunks.append(chunk.get("content", ""))
                    elif chunk.get("type") == "error":
                        raise RuntimeError(chunk.get("error", "LLM generation failed"))
            
            try:
                await asyncio.to_thread(_generate)
            except Exception as gen_err:
                from src.llm.provider import Llama, QwenProvider
                if Llama is not None and not generated_chunks:
                    logger.warning(f"Task {task_id} primary generation failed ({gen_err}), attempting local fallback...")
                    def _local_generate():
                        local_llm = QwenProvider()
                        for chunk in local_llm.generate_stream(full_prompt, is_background_task=True):
                            if chunk.get("type") == "text":
                                generated_chunks.append(chunk.get("content", ""))
                    await asyncio.to_thread(_local_generate)
                else:
                    raise gen_err
            final_text = "".join(generated_chunks).strip()

            # Tool execution: Python Sandbox
            # If agent is Tester, or prompt specifically requests running/testing code
            if "python_sandbox" in tools:
                extracted_code = TaskService._extract_python_code(final_text)
                if extracted_code and (role == "tester" or "run" in task["prompt"].lower() or "execute" in task["prompt"].lower()):
                    try:
                        exec_result = execute_python_code(extracted_code)
                        artifacts["sandbox_execution"] = exec_result
                    except Exception as exec_err:
                        artifacts["sandbox_execution"] = {
                            "stdout": "",
                            "stderr": str(exec_err),
                            "execution_time_ms": 0,
                            "exit_code": 1
                        }

            # Update task to completed
            updated_task = AgentRepository.update_task_status(
                task_id=task_id,
                status="completed",
                result=final_text,
                artifacts=artifacts
            )
            return updated_task or {}

        except Exception as e:
            logger.exception(f"Error executing task {task_id}: {e}")
            updated_task = AgentRepository.update_task_status(
                task_id=task_id,
                status="failed",
                error_message=str(e)
            )
            return updated_task or {}
