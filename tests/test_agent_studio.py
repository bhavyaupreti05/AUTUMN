import unittest
import os
import json
from src.database.connection import init_db, get_connection
from src.database.agent_repository import AgentRepository, ROLE_PRESETS

class TestAgentStudio(unittest.TestCase):
    def setUp(self):
        from src.auth.db import init_users_table, create_user, get_user_by_username
        init_users_table()
        init_db()
        username = "agent_test_user@example.com"
        user = get_user_by_username(username)
        if not user:
            user = create_user(username, "hash123", is_admin=False, status="approved")
        self.test_user_id = user["id"]

    def test_role_presets_exist(self):
        self.assertIn("manager", ROLE_PRESETS)
        self.assertIn("builder", ROLE_PRESETS)
        self.assertIn("researcher", ROLE_PRESETS)
        self.assertIn("tester", ROLE_PRESETS)
        self.assertIn("reviewer", ROLE_PRESETS)

    def test_auto_seed_and_list_agents(self):
        agents = AgentRepository.list_agents(self.test_user_id)
        self.assertGreaterEqual(len(agents), 5)
        roles = {a["role"] for a in agents}
        self.assertTrue({"manager", "builder", "researcher", "tester", "reviewer"}.issubset(roles))

    def test_create_custom_agent(self):
        agent = AgentRepository.create_agent(
            user_id=self.test_user_id,
            name="Quantum Optimizer",
            role="custom",
            title="Quantum Simulation Specialist",
            system_prompt="Simulate quantum circuits and optimize gates.",
            tools=["python_sandbox"],
            icon="cpu"
        )
        self.assertIsNotNone(agent)
        self.assertEqual(agent["name"], "Quantum Optimizer")
        self.assertEqual(agent["role"], "custom")
        self.assertIn("python_sandbox", agent["tools"])

    def test_task_lifecycle_and_notifications(self):
        # 1. Create Task
        agents = AgentRepository.list_agents(self.test_user_id)
        builder = next(a for a in agents if a["role"] == "builder")
        
        task = AgentRepository.create_task(
            user_id=self.test_user_id,
            agent_id=builder["id"],
            title="Implement Binary Search Tree",
            prompt="Write a Python class for BST with insert, search, and delete."
        )
        self.assertEqual(task["status"], "pending")
        self.assertEqual(task["is_read"], 0)

        # 2. Update status to completed with artifacts
        artifacts = {
            "sandbox_execution": {"stdout": "BST tests passed", "exit_code": 0, "execution_time_ms": 12}
        }
        updated = AgentRepository.update_task_status(
            task_id=task["id"],
            status="completed",
            result="class BST: pass",
            artifacts=artifacts
        )
        self.assertEqual(updated["status"], "completed")
        self.assertEqual(updated["artifacts"]["sandbox_execution"]["exit_code"], 0)

        # 3. Check unread notifications
        notifications = AgentRepository.get_unread_notifications(self.test_user_id)
        self.assertTrue(any(n["id"] == task["id"] for n in notifications))

        # 4. Mark notification as read
        marked_count = AgentRepository.mark_notifications_as_read(self.test_user_id, [task["id"]])
        self.assertEqual(marked_count, 1)

        # 5. Verify unread notifications empty for this task
        notifications_after = AgentRepository.get_unread_notifications(self.test_user_id)
        self.assertFalse(any(n["id"] == task["id"] for n in notifications_after))

    def test_multi_phase_pipeline_creation(self):
        stages = [
            {"title": "Phase 1: Research", "role": "researcher", "instruction": "Find algorithms"},
            {"title": "Phase 2: Build", "role": "builder", "instruction": "Write code"},
            {"title": "Phase 3: Test", "role": "tester", "instruction": "Run tests"},
            {"title": "Phase 4: Review", "role": "reviewer", "instruction": "Review code"}
        ]
        pipeline = AgentRepository.create_pipeline(
            user_id=self.test_user_id,
            title="Multi-Phase Microservice Build",
            goal="Build high-performance microservice",
            stages=stages
        )
        self.assertIsNotNone(pipeline)
        self.assertEqual(pipeline["status"], "pending")
        self.assertEqual(len(pipeline["stages"]), 4)

        # Progress pipeline to Stage 2
        updated_pipe = AgentRepository.update_pipeline_progress(
            pipeline_id=pipeline["id"],
            current_stage=2,
            status="running"
        )
        self.assertEqual(updated_pipe["current_stage"], 2)
        self.assertEqual(updated_pipe["status"], "running")

    def test_task_with_documents_and_context_links(self):
        agents = AgentRepository.list_agents(self.test_user_id)
        builder = next(a for a in agents if a["role"] == "builder")

        context_links = ["https://example.com/api/v1/spec", "mcp://sandbox-executor/v1"]
        document_ids = ["doc-12345", "doc-67890"]

        task = AgentRepository.create_task(
            user_id=self.test_user_id,
            agent_id=builder["id"],
            title="Analyze External Architecture & Docs",
            prompt="Review API spec and document guidelines.",
            context_links=context_links,
            document_ids=document_ids
        )
        self.assertIsNotNone(task)
        self.assertEqual(task["context_links"], context_links)
        self.assertEqual(task["document_ids"], document_ids)

        fetched = AgentRepository.get_task(task["id"])
        self.assertIsNotNone(fetched)
        self.assertEqual(fetched["context_links"], context_links)
        self.assertEqual(fetched["document_ids"], document_ids)

if __name__ == "__main__":
    unittest.main()
