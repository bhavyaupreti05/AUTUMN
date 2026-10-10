import requests

session = requests.Session()

# 0. Register
try:
    requests.post('http://localhost:8000/auth/register', json={'username': 'teste2e', 'password': 'password123'})
except:
    pass

# 1. Login
res_login = session.post('http://localhost:8000/auth/login', data={'username': 'teste2e', 'password': 'password123'})
print("Login Status:", res_login.status_code)
print("Login Set-Cookie:", res_login.headers.get('Set-Cookie'))
print("Cookies after login:", session.cookies.get_dict())

# 2. Authenticated request using only the cookie
res_me = session.get('http://localhost:8000/auth/me')
print("/me Status:", res_me.status_code)

# 3. Logout
res_logout = session.post('http://localhost:8000/auth/logout')
print("Logout Set-Cookie:", res_logout.headers.get('Set-Cookie'))

# 4. Authenticated request after logout
res_me_after = session.get('http://localhost:8000/auth/me')
print("/me after logout Status:", res_me_after.status_code)
