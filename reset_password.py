import argparse
import sys
import os

# Add the root directory to sys.path so we can import src modules
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

try:
    from src.auth.db import get_db_connection
    from src.auth.security import get_password_hash
except ImportError as e:
    print(f"Error importing modules: {e}")
    print("Please make sure you are running this script from the root directory of the project.")
    sys.exit(1)

def reset_password(username, new_password):
    with get_db_connection() as conn:
        # Check if user exists
        user = conn.execute("SELECT * FROM users WHERE username = ?", (username,)).fetchone()
        if not user:
            print(f"Error: User '{username}' not found in the database.")
            sys.exit(1)
            
        # Generate new password hash
        hashed_password = get_password_hash(new_password)
        
        conn.execute(
            "UPDATE users SET password_hash = ? WHERE username = ?",
            (hashed_password, username)
        )
        conn.commit()
        print(f"Success! Password for user '{username}' has been successfully reset.")
        
        if user["is_admin"]:
            print("Note: This is an admin account.")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Reset a user's password locally. Useful if an admin is locked out.")
    parser.add_argument("username", help="The username of the account to reset")
    parser.add_argument("new_password", help="The new password to set")
    
    args = parser.parse_args()
    
    reset_password(args.username, args.new_password)
