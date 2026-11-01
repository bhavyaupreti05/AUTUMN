import sys
import subprocess
import time
import tempfile
import os
from typing import Dict, Any

BLOCKED_PATTERNS = [
    "shutil.rmtree",
    "os.remove",
    "os.unlink",
    "os.system('rm",
    "os.system(\"rm",
    "subprocess.Popen(['rm",
    "__import__('os').system",
]

def execute_python_code(code: str, timeout_seconds: int = 5) -> Dict[str, Any]:
    """
    Executes Python code in an isolated subprocess with strict timeouts
    and safety validation.
    """
    # 1. Safety check against destructive disk operations
    for pattern in BLOCKED_PATTERNS:
        if pattern in code:
            return {
                "success": False,
                "stdout": "",
                "stderr": f"Security restriction: Use of '{pattern}' is blocked in sandbox.",
                "execution_time_ms": 0,
                "exit_code": 1
            }

    # 2. Write code to a temporary file
    temp_file = None
    try:
        with tempfile.NamedTemporaryFile("w", suffix=".py", delete=False, encoding="utf-8") as f:
            temp_file = f.name
            f.write(code)

        start_time = time.perf_counter()
        
        # 3. Run in subprocess
        process = subprocess.run(
            [sys.executable, temp_file],
            capture_output=True,
            text=True,
            timeout=timeout_seconds,
            cwd=tempfile.gettempdir()
        )
        
        execution_time_ms = int((time.perf_counter() - start_time) * 1000)
        
        stdout = process.stdout[:15000] if process.stdout else ""
        stderr = process.stderr[:10000] if process.stderr else ""
        
        return {
            "success": process.returncode == 0,
            "stdout": stdout,
            "stderr": stderr,
            "execution_time_ms": execution_time_ms,
            "exit_code": process.returncode
        }

    except subprocess.TimeoutExpired:
        return {
            "success": False,
            "stdout": "",
            "stderr": f"Execution timed out after {timeout_seconds} seconds (infinite loop protection).",
            "execution_time_ms": timeout_seconds * 1000,
            "exit_code": -1
        }
    except Exception as e:
        return {
            "success": False,
            "stdout": "",
            "stderr": f"Execution failed: {str(e)}",
            "execution_time_ms": 0,
            "exit_code": -1
        }
    finally:
        if temp_file and os.path.exists(temp_file):
            try:
                os.remove(temp_file)
            except OSError:
                pass
