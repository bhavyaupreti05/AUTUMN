import requests
import sqlite3
import os

# Approve user
db_path = os.path.join(os.path.dirname(__file__), '..', 'data', 'chatbot.db')
conn = sqlite3.connect(db_path)
conn.execute("UPDATE users SET status = 'approved' WHERE username = 'pythontest3'")
conn.commit()
conn.close()

# Login
res = requests.post('http://localhost:8000/auth/login', data={'username': 'pythontest3', 'password': 'password'})
print('Login Status:', res.status_code)
print('Cookies:', res.cookies.get_dict())

# Call /me endpoint with cookies
res_me = requests.get('http://localhost:8000/auth/me', cookies=res.cookies)
print('/me Status:', res_me.status_code)
print('/me Data:', res_me.text)
