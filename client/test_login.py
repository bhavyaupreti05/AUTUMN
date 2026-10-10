import requests
import json

# Register
try:
    requests.post('http://localhost:8000/auth/register', json={'username': 'pythontest3', 'password': 'password'})
except Exception as e:
    pass

# Login
res = requests.post('http://localhost:8000/auth/login', data={'username': 'pythontest3', 'password': 'password'})
print('Login Status:', res.status_code)
print('Cookies:', res.cookies.get_dict())
