import os
import sys
import argparse
from pathlib import Path
from dotenv import load_dotenv

# Add project root to path
project_root = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(project_root))
e2e_env_file = project_root / ".env.e2e"


def load_e2e_environment():
    if not e2e_env_file.exists():
        print(
            "Error: .env.e2e is missing. Copy .env.e2e.example to .env.e2e "
            "and generate JWT_SECRET with secrets.token_hex(32).",
            file=sys.stderr,
        )
        sys.exit(1)
    load_dotenv(e2e_env_file)

def seed_db():
    from src.auth.db import create_user, init_users_table
    from src.auth.security import get_password_hash
    from src.database.connection import init_db
    from src.database.repository import ConversationRepository
    
    # Ensure db path exists
    db_url = os.environ.get("DATABASE_URL")
    if not db_url:
        print("Error: DATABASE_URL not set in environment.", file=sys.stderr)
        sys.exit(1)
        
    db_path = Path(db_url)
    db_path.parent.mkdir(parents=True, exist_ok=True)
    
    # Read credentials from environment
    username = os.environ.get("TEST_USERNAME")
    password = os.environ.get("TEST_PASSWORD")
    admin_username = os.environ.get("E2E_ADMIN_USERNAME", "e2e_admin_user")
    admin_password = os.environ.get("E2E_ADMIN_PASSWORD", "E2E-Admin-Password-1")
    
    if not username or not password:
        print("Error: TEST_USERNAME or TEST_PASSWORD not set in environment.", file=sys.stderr)
        sys.exit(1)
        
    print(f"Seeding DB at {db_url} with user '{username}'...")
    
    init_users_table()
    init_db()

    admin = create_user(admin_username, get_password_hash(admin_password), is_admin=True, status="approved")
    print(f"Successfully seeded E2E administrator '{admin['username']}'.")

    user = create_user(username, get_password_hash(password), status="approved")
    print(f"Successfully seeded test user '{user['username']}'.")

    repository = ConversationRepository()
    conversation_id = repository.create_conversation("Massive Conversation", user["id"])
    for index in range(150):
        repository.save_message(conversation_id, "user", f"Message {index * 2}: Hello! Tell me a long story.")
        repository.save_message(
            conversation_id,
            "assistant",
            f"Message {index * 2 + 1}: This is a very long response that contains a lot of text to simulate a realistic chat application."
        )
    print("Successfully seeded massive conversation.")

    status_conversation_id = repository.create_conversation("Status Messages", user["id"])
    repository.save_message(status_conversation_id, "user", "Give me a partial answer")
    repository.save_message(status_conversation_id, "assistant", "Partial answer", status="aborted")
    repository.save_message(status_conversation_id, "user", "Give me another answer")
    repository.save_message(status_conversation_id, "assistant", "", status="error")
    print("Successfully seeded status conversation.")

def cleanup_db():
    db_url = os.environ.get("DATABASE_URL")
    chroma_path = os.environ.get("CHROMA_DB_PATH")
    
    if db_url and os.path.exists(db_url):
        try:
            os.remove(db_url)
            print(f"Removed {db_url}")
        except PermissionError:
            print(f"Warning: Could not remove {db_url} because it is still in use.")
        
    if chroma_path and os.path.exists(chroma_path):
        import shutil
        shutil.rmtree(chroma_path, ignore_errors=True)
        print(f"Removed {chroma_path}")

if __name__ == "__main__":
    load_e2e_environment()
    parser = argparse.ArgumentParser()
    parser.add_argument("--cleanup", action="store_true")
    args = parser.parse_args()
    
    if args.cleanup:
        cleanup_db()
    else:
        seed_db()
