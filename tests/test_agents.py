import unittest
from src.agents import get_agent_profile, list_agent_profiles, detect_best_agent

class TestAgents(unittest.TestCase):
    def test_list_agent_profiles(self):
        agents = list_agent_profiles()
        self.assertEqual(len(agents), 4)
        agent_ids = [a["id"] for a in agents]
        self.assertIn("dev", agent_ids)
        self.assertIn("researcher", agent_ids)
        self.assertIn("strategist", agent_ids)
        self.assertIn("data", agent_ids)

    def test_get_agent_profile(self):
        dev = get_agent_profile("dev")
        self.assertEqual(dev.id, "dev")
        self.assertEqual(dev.name, "DevArchitect")
        self.assertIn("Software Engineer", dev.title)
        self.assertIn("DevArchitect", dev.system_prompt)

        researcher = get_agent_profile("researcher")
        self.assertEqual(researcher.id, "researcher")
        self.assertEqual(researcher.name, "DocSynth")

        strategist = get_agent_profile("strategist")
        self.assertEqual(strategist.id, "strategist")
        self.assertEqual(strategist.name, "Strategist")

        data = get_agent_profile("data")
        self.assertEqual(data.id, "data")
        self.assertEqual(data.name, "DataMind")

    def test_detect_best_agent_code(self):
        agent = detect_best_agent("Write a python fastapi async function with unit tests")
        self.assertEqual(agent.id, "dev")
        self.assertEqual(agent.name, "DevArchitect")

        agent_debug = detect_best_agent("Fix this bug in my React typescript component")
        self.assertEqual(agent_debug.id, "dev")

    def test_detect_best_agent_research(self):
        agent = detect_best_agent("Summarize this document and cite the evidence")
        self.assertEqual(agent.id, "researcher")

        agent_doc = detect_best_agent("Hello", has_documents=True)
        self.assertEqual(agent_doc.id, "researcher")

    def test_detect_best_agent_data(self):
        agent = detect_best_agent("Analyze this revenue and calculate profit margin table")
        self.assertEqual(agent.id, "data")
        self.assertEqual(agent.name, "DataMind")

    def test_detect_best_agent_career(self):
        agent = detect_best_agent("Rewrite my resume bullets using Google's XYZ formula")
        self.assertEqual(agent.id, "strategist")
        self.assertEqual(agent.name, "Strategist")

if __name__ == "__main__":
    unittest.main()
