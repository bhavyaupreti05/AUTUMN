import subprocess
import sys
import os
sys.stdout.reconfigure(encoding='utf-8')

def run_script(path: str):
    print(f"\n{'='*50}\nRunning {path}...\n{'='*50}")
    result = subprocess.run([sys.executable, path], cwd=os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    if result.returncode != 0:
        print(f"\n❌ FAILED: {path}")
        return False
    print(f"\n✅ PASSED: {path}")
    return True

if __name__ == "__main__":
    scripts = [
        "scripts/stress_test_integrity.py",
        "scripts/stress_test_security.py",
        "tests/test_security_regression.py"
    ]
    
    # Just checking if the tests exist before running
    # Let's focus on the new ones if the old ones aren't found.
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    
    all_passed = True
    for script in scripts:
        if os.path.exists(os.path.join(base_dir, script)):
            success = run_script(script)
            if not success:
                all_passed = False
        else:
            print(f"Skipping {script}, not found.")
            
    if not all_passed:
        print("\n❌ SOME TESTS FAILED.")
        sys.exit(1)
    else:
        print("\n✅ ALL TEST SUITES PASSED.")
        sys.exit(0)
