import subprocess
import sys

def test_requirements_install():
    """Verify pip install -r requirements.txt succeeds"""
    result = subprocess.run(
        [sys.executable, "-m", "pip", "install", "-r", "requirements.txt"],
        capture_output=True,
        text=True
    )
    assert result.returncode == 0, f"pip install failed: {result.stderr}"

def test_slowapi_importable():
    """Verify slowapi is installed and importable"""
    try:
        import slowapi
    except ImportError:
        assert False, "slowapi could not be imported"
