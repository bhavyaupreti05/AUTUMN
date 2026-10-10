import requests
res = requests.post('http://localhost:8000/auth/login', data={'username': 'pythontest3', 'password': 'password'})
print('Set-Cookie:', res.headers.get('Set-Cookie'))
