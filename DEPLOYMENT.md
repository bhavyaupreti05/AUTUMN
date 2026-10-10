# Linux Deployment Checklist

1. Create a dedicated service user and grant it ownership of `/opt/chatbot-2`.
2. Put the application code in `/opt/chatbot-2` and install its Python environment and dependencies.
3. Copy `.env.production.example` to `/opt/chatbot-2/.env`, generate `JWT_SECRET` with `python -c "import secrets; print(secrets.token_hex(32))"`, then set the exact HTTPS `ALLOWED_ORIGINS`. Set ownership to the service user and run `chmod 600 /opt/chatbot-2/.env`. Never commit the populated file.
4. Create the first administrator after the fresh database exists: `python -m scripts.create_admin`. Enter the username and password interactively; the password is never a command-line argument.
5. Copy the model files to the server. GGUF model files and the embedding model are not stored in Git and must be provisioned separately.
6. Create fresh server-side `DATABASE_URL`, `CHROMA_DB_PATH`, and `DOCUMENTS_DIR` locations. Never copy the development database or vector store to the server.
7. Put HTTPS in front of Uvicorn with nginx or an equivalent reverse proxy. Keep `COOKIE_SECURE=true` for production. Use a non-production environment for any HTTP-only smoke test; production configuration rejects insecure cookies.
8. Install `scripts/chatbot.service`, then run `systemctl daemon-reload`, `systemctl enable chatbot`, and `systemctl start chatbot`.
9. Check `/api/health` through the proxy. Health can degrade to approximately 2 seconds during generation, so configure the health-check timeout above 5 seconds.
10. View service logs with `journalctl -u chatbot -f`.

## Password recovery

Administrators can issue a single-use reset link for an approved non-admin user from the admin dashboard. The link is shown once, expires according to `PASSWORD_RESET_TTL_MINUTES`, and should be delivered directly to the user. Users are not auto-logged in after redeeming it. A locked-out administrator must use `python -m scripts.reset_password <username>` and enter the new password interactively.

After deploying this authentication change, every user must log in once again because existing access tokens are invalidated by the new session-version claim. The production web server must provide the existing SPA fallback for `/reset-password` so direct navigation to that route serves `index.html`.

## Nginx reverse proxy

Use the exact public HTTPS origin in `ALLOWED_ORIGINS` and keep the backend bound to loopback:

```nginx
server {
	listen 443 ssl;
	server_name chat.example.com;

	ssl_certificate /etc/letsencrypt/live/chat.example.com/fullchain.pem;
	ssl_certificate_key /etc/letsencrypt/live/chat.example.com/privkey.pem;

	client_max_body_size 16m;

	location / {
		proxy_pass http://127.0.0.1:8000;
		proxy_buffering off;
		proxy_read_timeout 300s;
		proxy_set_header Host $host;
		proxy_set_header X-Real-IP $remote_addr;
		proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
		proxy_set_header X-Forwarded-Proto $scheme;
	}
}
```

Uvicorn remains single-worker and binds locally in `scripts/chatbot.service`; the reverse proxy is the public HTTPS endpoint.
