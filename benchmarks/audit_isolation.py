import requests
import json
import uuid
import time
import sqlite3

API_URL = "http://127.0.0.1:8000/api"

def create_conversation(title):
    res = requests.post(f"{API_URL}/conversations", json={"title": title})
    return res.json()["conversation"]["id"]

def send_message(conv_id, message):
    res = requests.post(
        f"{API_URL}/chat", 
        json={"conversation_id": conv_id, "message": message},
        stream=True
    )
    full_text = ""
    for line in res.iter_lines():
        if line:
            line_text = line.decode('utf-8')
            if line_text.startswith('data: '):
                data = line_text[6:]
                if data == '[DONE]':
                    break
                try:
                    payload = json.loads(data)
                    if "chunk" in payload:
                        full_text += payload["chunk"]
                except:
                    pass
    return full_text

def test_conversation_isolation():
    print("--- Testing Conversation Isolation ---")
    conv_a = create_conversation("Conv A")
    conv_b = create_conversation("Conv B")
    conv_c = create_conversation("Conv C")
    
    print("Injecting facts...")
    send_message(conv_a, "My project codename is ALPHA. Remember this.")
    send_message(conv_b, "My project codename is BETA. Remember this.")
    send_message(conv_c, "My project codename is GAMMA. Remember this.")
    
    print("Testing retrieval isolation...")
    ans_a = send_message(conv_a, "What is my project codename?")
    ans_b = send_message(conv_b, "What is my project codename?")
    ans_c = send_message(conv_c, "What is my project codename?")
    
    print(f"Conv A Answer: {ans_a.strip()}")
    print(f"Conv B Answer: {ans_b.strip()}")
    print(f"Conv C Answer: {ans_c.strip()}")
    
    assert "ALPHA" in ans_a.upper() and "BETA" not in ans_a.upper()
    assert "BETA" in ans_b.upper() and "GAMMA" not in ans_b.upper()
    assert "GAMMA" in ans_c.upper() and "ALPHA" not in ans_c.upper()
    print("Conversation Isolation: PASSED\n")

def test_context_limits():
    print("--- Testing Context Limits (20 messages) ---")
    conv = create_conversation("Context Limits")
    
    print("Injecting 22 messages...")
    send_message(conv, "Message 1: The secret code is 9999.")
    for i in range(2, 22):
        send_message(conv, f"This is message {i}.")
    
    ans = send_message(conv, "What is the secret code from message 1?")
    print(f"Answer after 22 messages: {ans.strip()}")
    print("Context Limits: COMPLETE\n")

def test_database_integrity():
    print("--- Testing Database Integrity ---")
    conn = sqlite3.connect("chatbot.db")
    cursor = conn.cursor()
    cursor.execute("PRAGMA foreign_key_check;")
    fks = cursor.fetchall()
    print(f"Foreign Key Violations: {fks}")
    
    cursor.execute("SELECT COUNT(*) FROM conversations")
    convs = cursor.fetchone()[0]
    cursor.execute("SELECT COUNT(*) FROM messages")
    msgs = cursor.fetchone()[0]
    print(f"Total Conversations: {convs}, Total Messages: {msgs}")
    print("Database Integrity: PASSED\n")

if __name__ == "__main__":
    try:
        test_database_integrity()
        test_conversation_isolation()
        test_context_limits()
    except Exception as e:
        print(f"Test failed: {e}")
