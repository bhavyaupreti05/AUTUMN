import os
from pathlib import Path
from pydantic import field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

PROJECT_ROOT = Path(__file__).resolve().parent.parent

class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        extra="ignore",
        hide_input_in_errors=True,
    )

    # Auth & Environment Settings
    ENVIRONMENT: str = "development"
    JWT_SECRET: str = ""
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440
    PASSWORD_RESET_TTL_MINUTES: int = 30
    COOKIE_SECURE: bool = False
    ALLOWED_ORIGINS: str = ""
    ADMIN_RECOVERY_KEY: str | None = None

    @model_validator(mode="before")
    @classmethod
    def set_environment_defaults(cls, values):
        environment = values.get("ENVIRONMENT", "development")
        if not values.get("JWT_SECRET") and not os.environ.get("JWT_SECRET"):
            import secrets
            values["JWT_SECRET"] = secrets.token_hex(32)
        if "COOKIE_SECURE" not in values:
            values["COOKIE_SECURE"] = environment == "production"
        if "ALLOWED_ORIGINS" not in values and environment != "production":
            values["ALLOWED_ORIGINS"] = ",".join((
                "http://localhost:5173",
                "http://127.0.0.1:5173",
                "http://localhost:5174",
                "http://localhost:8000",
                "http://localhost:8080",
                "http://192.168.1.159:5173",
                "http://192.168.1.159:8000",
            ))
        return values

    @model_validator(mode="after")
    def validate_production_origins(self):
        if self.ENVIRONMENT == "production" and not self.ALLOWED_ORIGINS:
            raise ValueError("ALLOWED_ORIGINS must be set in production")
        if self.ENVIRONMENT == "production" and not self.COOKIE_SECURE:
            raise ValueError("COOKIE_SECURE must be true in production")
        return self

    @model_validator(mode="after")
    def ensure_admin_recovery_key(self):
        if not self.ADMIN_RECOVERY_KEY:
            import secrets
            key = f"TRPW-{secrets.token_hex(4)}-{secrets.token_hex(4)}-{secrets.token_hex(4)}".upper()
            self.ADMIN_RECOVERY_KEY = key
            try:
                env_path = PROJECT_ROOT / ".env"
                with open(env_path, "a") as f:
                    f.write(f"\nADMIN_RECOVERY_KEY={key}\n")
                print(f"\n[SECURITY] Generated new Admin Recovery Key: {key}")
                print(f"[SECURITY] This key has been saved to .env. Please store it securely!")
            except Exception as e:
                print(f"[WARNING] Could not save ADMIN_RECOVERY_KEY to .env: {e}")
        return self

    @field_validator("JWT_SECRET")
    @classmethod
    def validate_jwt_secret(cls, value: str) -> str:
        normalized = value.strip().casefold()
        forbidden = (
            "changeme",
            "change-me",
            "your-secret",
            "your_secret",
            "secret-here",
            "example",
            "placeholder",
            "insecure",
            "do_not_use",
        )
        if not normalized or len(value) < 32 or any(token in normalized for token in forbidden):
            raise ValueError("JWT_SECRET must be at least 32 characters and not a known placeholder")
        return value

    @field_validator("PASSWORD_RESET_TTL_MINUTES")
    @classmethod
    def validate_password_reset_ttl(cls, value: int) -> int:
        if not 5 <= value <= 1440:
            raise ValueError("PASSWORD_RESET_TTL_MINUTES must be between 5 and 1440")
        return value

    # API Settings
    API_HOST: str = "0.0.0.0"
    API_PORT: int = 8000
    
    # Model Settings
    # Path to the downloaded model
    MODEL_REPO: str = "Qwen/Qwen2.5-3B-Instruct-GGUF"
    MODEL_FILE: str = "qwen2.5-3b-instruct-q4_k_m.gguf"
    
    @property
    def MODEL_PATH(self) -> str:
        local_path = os.environ.get("MODEL_PATH", self.MODEL_FILE)
        if os.path.exists(local_path):
            return local_path
        
        try:
            from huggingface_hub import hf_hub_download
            return hf_hub_download(repo_id=self.MODEL_REPO, filename=self.MODEL_FILE)
        except Exception:
            return local_path
            
    MODEL_NAME: str = "Qwen2.5 3B"
    QUANTIZATION: str = "q4_k_m"
    
    # Database Settings
    DATABASE_URL: str = str(PROJECT_ROOT / "data" / "chatbot.db")
    DOCUMENTS_DIR: str = str(PROJECT_ROOT / "data" / "documents")
    
    # Document Processing Settings
    MAX_PDF_SIZE_MB: int = 15
    MAX_DOCUMENT_PAGES: int = 500
    MAX_EXTRACTED_TEXT_MB: int = 50
    MAX_DOCX_UNCOMPRESSED_MB: int = 100
    MAX_CUSTOM_BOT_DOCUMENTS: int = 3
    CHUNK_SIZE: int = 1000
    CHUNK_OVERLAP: int = 200
    
    # RAG Settings
    RAG_ENABLED: bool = True
    CHROMA_DB_PATH: str = str(PROJECT_ROOT / "data" / "chroma")
    # A modest increase in candidate retrieval keeps valid facts available while
    # preserving the current safeguarded fallback behavior.
    RAG_TOP_K: int = 15
    RAG_SIMILARITY_THRESHOLD: float = 1.0
    RAG_MAX_CHARS: int = 8000

    # Memory-based improvements. Only explicit user preferences are learned;
    # ordinary answers and unsupported claims are never automatically stored.
    MEMORY_ENABLED: bool = True
    MEMORY_MAX_ITEMS: int = 5
    MEMORY_MAX_CHARS: int = 1200

    
    # Inference Settings
    CONTEXT_SIZE: int = 6144
    MAX_CONTEXT_MESSAGES: int = 20
    MAX_CONTEXT_CHARS: int = 16000
    TEMPERATURE: float = 0.7
    MAX_OUTPUT_TOKENS: int = 2048
    # Determine threads dynamically or hardcode for i7-8650U (4 cores, 8 threads)
    # CPU inference typically benefits from physical cores.
    CPU_THREADS: int = 4
    LLM_MAX_CONCURRENCY: int = 1
    # Foreground requests may wait for a long document-grounded generation.
    # Background summaries should still fail fast when the model is busy.
    LLM_LOCK_TIMEOUT_SECONDS: int = 400
    
# Global settings instance
settings = Settings()
