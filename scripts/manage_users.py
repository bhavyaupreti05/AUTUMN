"""
User Management CLI
Usage:
  python scripts/manage_users.py list
  python scripts/manage_users.py approve <username>
  python scripts/manage_users.py reject <username>
  python scripts/manage_users.py make-admin <username>
  python scripts/manage_users.py reset-users --yes-i-am-sure
"""

import argparse
import sys
import os

# Add root project dir to path so we can import src
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from src.auth.db import get_db_connection, get_user_by_username, update_user_status

def cmd_list():
    with get_db_connection() as conn:
        users = conn.execute("SELECT id, username, is_admin, status, created_at FROM users ORDER BY created_at ASC").fetchall()
    
    if not users:
        print("No users found in database.")
        return

    print(f"{'ID':<40} | {'Username':<20} | {'Admin':<7} | {'Status':<10} | {'Created At'}")
    print("-" * 110)
    for u in users:
        is_admin = "Yes" if u["is_admin"] else "No"
        print(f"{u['id']:<40} | {u['username']:<20} | {is_admin:<7} | {u['status']:<10} | {u['created_at']}")

def cmd_approve(username):
    user = get_user_by_username(username)
    if not user:
        print(f"Error: No user found with username '{username}'")
        return
    
    if update_user_status(user["id"], "approved", admin_id="SYSTEM_CLI"):
        print(f"Success: User '{username}' has been approved.")
    else:
        print(f"Error: Failed to approve user '{username}'.")

def cmd_reject(username):
    user = get_user_by_username(username)
    if not user:
        print(f"Error: No user found with username '{username}'")
        return
    
    if update_user_status(user["id"], "rejected", admin_id="SYSTEM_CLI"):
        print(f"Success: User '{username}' has been rejected.")
    else:
        print(f"Error: Failed to reject user '{username}'.")

def cmd_make_admin(username):
    user = get_user_by_username(username)
    if not user:
        print(f"Error: No user found with username '{username}'")
        return
    
    import datetime
    now = datetime.datetime.now(datetime.timezone.utc).isoformat()
    with get_db_connection() as conn:
        conn.execute("UPDATE users SET is_admin = 1, status = 'approved', approved_by = 'SYSTEM_CLI', approved_at = ? WHERE id = ?", (now, user["id"]))
        conn.commit()
    print(f"Success: User '{username}' is now an approved admin.")

def cmd_reset_users(sure):
    if not sure:
        print("Error: You must provide the --yes-i-am-sure flag to confirm reset.")
        return
        
    print("WARNING: This will delete ALL users from the database.")
    with get_db_connection() as conn:
        conn.execute("DELETE FROM users")
        conn.commit()
    print("Success: All users have been deleted. Next registration will trigger bootstrap admin flow.")

def main():
    parser = argparse.ArgumentParser(description="Manage users in the local SQLite database.")
    subparsers = parser.add_subparsers(dest="command", required=True)
    
    subparsers.add_parser("list", help="List all users")
    
    approve_parser = subparsers.add_parser("approve", help="Approve a pending user")
    approve_parser.add_argument("username", help="Username of the user to approve")
    
    reject_parser = subparsers.add_parser("reject", help="Reject a pending user")
    reject_parser.add_argument("username", help="Username of the user to reject")
    
    make_admin_parser = subparsers.add_parser("make-admin", help="Make a user an approved admin")
    make_admin_parser.add_argument("username", help="Username of the user to make admin")
    
    reset_parser = subparsers.add_parser("reset-users", help="Delete all users from the database")
    reset_parser.add_argument("--yes-i-am-sure", action="store_true", help="Confirm deletion")
    
    args = parser.parse_args()
    
    if args.command == "list":
        cmd_list()
    elif args.command == "approve":
        cmd_approve(args.username)
    elif args.command == "reject":
        cmd_reject(args.username)
    elif args.command == "make-admin":
        cmd_make_admin(args.username)
    elif args.command == "reset-users":
        cmd_reset_users(args.yes_i_am_sure)

if __name__ == "__main__":
    main()
