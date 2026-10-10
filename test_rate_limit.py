import requests

for i in range(6):
    res = requests.post('http://localhost:8000/auth/login', data={'username': 'pythontest3', 'password': 'wrong'})
    print(f"Attempt {i+1}: Status {res.status_code}")
