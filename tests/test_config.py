import pytest
from pydantic import ValidationError

from src.config import Settings


def assert_invalid_secret(secret: str) -> None:
    with pytest.raises(ValidationError) as error:
        Settings(JWT_SECRET=secret)

    assert "JWT_SECRET must be at least 32 characters" in str(error.value)
    if secret:
        assert secret not in str(error.value)
        assert secret not in repr(error.value)


def test_jwt_secret_rejects_empty():
    assert_invalid_secret("")


def test_jwt_secret_rejects_31_characters():
    assert_invalid_secret("a" * 31)


def test_jwt_secret_rejects_test_value_without_echoing_it():
    assert_invalid_secret("test")


def test_jwt_secret_rejects_placeholder():
    assert_invalid_secret("your-secret-" + "a" * 32)


def test_jwt_secret_accepts_64_character_random_hex():
    secret = "9f4c2a7d8b1e6f305a9c7e2b4d8f1a6c3e5b7d9f2a4c6e8b1d3f5a7c9e2b4d6f"
    settings = Settings(JWT_SECRET=secret)

    assert settings.JWT_SECRET == secret


def test_production_settings_require_allowed_origins():
    with pytest.raises(ValidationError, match="ALLOWED_ORIGINS must be set in production"):
        Settings(
            ENVIRONMENT="production",
            JWT_SECRET="9f4c2a7d8b1e6f305a9c7e2b4d8f1a6c3e5b7d9f2a4c6e8b1d3f5a7c9e2b4d6f",
            ALLOWED_ORIGINS="",
        )
