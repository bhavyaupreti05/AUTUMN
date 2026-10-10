import os
import pytest
from unittest.mock import patch
import logging

def test_startup_warning_fires(caplog):
    """
    Simulates the multi-worker condition by ensuring SINGLE_WORKER_CONFIRMED is absent,
    and verifies the loud warning fires during app initialization.
    """
    # Temporarily remove SINGLE_WORKER_CONFIRMED if it's in the environment
    with patch.dict(os.environ, clear=False):
        if "SINGLE_WORKER_CONFIRMED" in os.environ:
            del os.environ["SINGLE_WORKER_CONFIRMED"]
            
        # Import the main module to trigger initialization
        # Use importlib.reload if it was already imported, but in pytest it might be cached
        import importlib
        import src.api.main
        
        with caplog.at_level(logging.CRITICAL):
            importlib.reload(src.api.main)
            
        assert "CRITICAL SECURITY WARNING: SINGLE_WORKER_CONFIRMED is not set to 'true'!" in caplog.text
        assert "rate limit will be bypassed by attackers" in caplog.text

def test_startup_warning_suppressed(caplog):
    """
    Verifies that setting the environment variable correctly suppresses the warning.
    """
    with patch.dict(os.environ, {"SINGLE_WORKER_CONFIRMED": "true"}):
        import importlib
        import src.api.main
        
        with caplog.at_level(logging.CRITICAL):
            importlib.reload(src.api.main)
            
        assert "CRITICAL SECURITY WARNING" not in caplog.text
