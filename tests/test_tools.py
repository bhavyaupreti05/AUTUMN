import unittest
from src.agents.tools.code_runner import execute_python_code
from src.agents.orchestrator import orchestrator

class TestCodeRunnerAndOrchestrator(unittest.TestCase):
    def test_execute_python_basic(self):
        code = "print(2 + 2)"
        res = execute_python_code(code)
        self.assertTrue(res["success"])
        self.assertEqual(res["stdout"].strip(), "4")
        self.assertEqual(res["exit_code"], 0)

    def test_execute_python_loop_math(self):
        code = "squares = [x**2 for x in range(5)]\nprint(squares)"
        res = execute_python_code(code)
        self.assertTrue(res["success"])
        self.assertEqual(res["stdout"].strip(), "[0, 1, 4, 9, 16]")

    def test_execute_python_timeout(self):
        code = "import time\ntime.sleep(10)"
        res = execute_python_code(code, timeout_seconds=1)
        self.assertFalse(res["success"])
        self.assertIn("timed out", res["stderr"])

    def test_execute_python_security_block(self):
        code = "import shutil\nshutil.rmtree('/tmp')"
        res = execute_python_code(code)
        self.assertFalse(res["success"])
        self.assertIn("Security restriction", res["stderr"])

    def test_orchestrator_complex_signals(self):
        self.assertTrue(orchestrator.is_complex_goal("Please write this code and provide a unit test for it"))
        self.assertTrue(orchestrator.is_complex_goal("Analyze this report and write a script to plot it"))
        self.assertFalse(orchestrator.is_complex_goal("Hello how are you"))

if __name__ == "__main__":
    unittest.main()
