import requests

# Login
res = requests.post('http://localhost:8000/auth/login', data={'username': 'admin', 'password': 'password123'})
print('Login Cookies:', res.cookies.get_dict())
print('Login Set-Cookie:', res.headers.get('Set-Cookie'))

# Logout
res_out = requests.post('http://localhost:8000/auth/logout')
print('Logout Set-Cookie:', res_out.headers.get('Set-Cookie'))
