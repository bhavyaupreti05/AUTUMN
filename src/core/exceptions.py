class IncompleteGenerationError(Exception):
    """Raised when the LLM generation terminates prematurely (e.g., due to max token limits)."""
    pass
