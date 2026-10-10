# React + TypeScript + Vite

## E2E setup

From the repository root, create the ignored E2E environment file:

```powershell
Copy-Item .env.e2e.example .env.e2e
python -c "import secrets; print(secrets.token_hex(32))"
```

Put the generated value in `.env.e2e` as `JWT_SECRET`. Never commit `.env.e2e`.

This template provides a minimal setup to get React working in Vite with HMR and some Oxlint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the Oxlint configuration

If you are developing a production application, we recommend enabling type-aware lint rules by installing `oxlint-tsgolint` and editing `.oxlintrc.json`:

```json
{
  "$schema": "./node_modules/oxlint/configuration_schema.json",
  "plugins": ["react", "typescript", "oxc"],
  "options": {
    "typeAware": true
  },
  "rules": {
    "react/rules-of-hooks": "error",
    "react/only-export-components": ["warn", { "allowConstantExport": true }]
  }
}
```

See the [Oxlint rules documentation](https://oxc.rs/docs/guide/usage/linter/rules) for the full list of rules and categories.

## Password recovery

Administrators issue single-use password reset links from the admin dashboard. Users redeem the link at `/reset-password` and then log in normally. The CLI fallback for a locked-out administrator is `python -m scripts.reset_password <username>`; it prompts for the password and never accepts it as an argument. Production web servers must route `/reset-password` to the SPA fallback.

## Testing from another device (LAN, dev only)

Use these dev-only values in the local ignored `.env` file:

```env
ENVIRONMENT=development
COOKIE_SECURE=false
ALLOWED_ORIGINS=http://localhost:5173,http://127.0.0.1:5173,http://<host-ipv4>:5173
```

- Use `npm run dev` for localhost-only development.
- Use `npm run dev:lan` to listen on all interfaces for LAN testing.
- The backend and frontend must both be restarted after changing these values.
- This must never be used with `ENVIRONMENT=production` or on an untrusted network.
- In production, the origin is HTTPS and the allowed list is typically `ALLOWED_ORIGINS=https://your-domain`.

Open the Windows firewall for port 5173 from an Administrator PowerShell:

```powershell
New-NetFirewallRule -DisplayName "ChatBot dev 5173" -Direction Inbound -Protocol TCP -LocalPort 5173 -Action Allow -Profile Private
```

Remove it afterward:

```powershell
Remove-NetFirewallRule -DisplayName "ChatBot dev 5173"
```
