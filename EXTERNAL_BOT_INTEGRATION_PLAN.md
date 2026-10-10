# External Custom Bot Integration Plan

## Goal

Allow an admin to attach one specific custom bot to a future external website, while keeping the bot, knowledge documents, security settings, and enable/disable controls in the TRPW bbot admin dashboard.

There is no external website to connect today. The integration must therefore be designed as an opt-in capability and remain disabled for every bot until an admin explicitly enables it.

## Current Ownership

The existing custom bot remains the source of truth:

- `custom_bots` owns the bot name, personality, owner, and active status.
- `custom_bot_documents` owns the bot knowledge associations.
- `src/api/custom_bots.py` owns private admin CRUD and test chat.
- `ChatService` remains responsible for message persistence, retrieval, and model streaming.

The external integration layer should reuse these components. It must not create a second bot configuration or a second answer-generation pipeline.

## Proposed Structure

```text
Admin dashboard
    |
    | enable, disable, rotate key, set domains
    v
Bot integration settings
    |
    | validates integration key + origin + limits
    v
Public integration API
    |
    | resolves exactly one active custom bot
    v
Existing custom bot chat service
    |
    v
SSE response or JSON response
```

### Integration identity

Each enabled integration represents one custom bot. It should contain:

- `id`: integration record ID.
- `bot_id`: the one custom bot exposed externally.
- `owner_id`: the admin who owns the bot.
- `enabled`: whether external access is currently allowed.
- `public_key`: identifier safe to place in browser embed code.
- `secret_hash`: hashed secret used for server-to-server authentication.
- `allowed_origins`: explicit website origins, for example `https://example.com`.
- `created_at`, `updated_at`, `last_used_at`: lifecycle and monitoring data.

The raw secret must be shown only once when generated. The dashboard should support rotation and immediate disablement.

## Database Addition

Add a separate `custom_bot_integrations` table rather than adding public credentials directly to `custom_bots`.

```sql
CREATE TABLE custom_bot_integrations (
    id TEXT PRIMARY KEY,
    bot_id TEXT NOT NULL UNIQUE,
    owner_id TEXT NOT NULL,
    public_key TEXT NOT NULL UNIQUE,
    secret_hash TEXT NOT NULL,
    enabled BOOLEAN NOT NULL DEFAULT 0,
    allowed_origins TEXT NOT NULL DEFAULT '[]',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_used_at TIMESTAMP,
    FOREIGN KEY (bot_id) REFERENCES custom_bots (id) ON DELETE CASCADE,
    FOREIGN KEY (owner_id) REFERENCES users (id) ON DELETE CASCADE
);
```

Important rules:

- `bot_id` is unique, so one bot can have only one external attachment.
- The table is created empty, so current bots remain private.
- Deleting a bot automatically removes its integration record.
- `allowed_origins` stores normalized origins, not arbitrary URLs or paths.

## Admin API Shape

Keep these routes under the existing admin custom-bot boundary:

```text
GET    /api/admin/custom-bots/{bot_id}/integration
POST   /api/admin/custom-bots/{bot_id}/integration
PATCH  /api/admin/custom-bots/{bot_id}/integration
POST   /api/admin/custom-bots/{bot_id}/integration/rotate
DELETE /api/admin/custom-bots/{bot_id}/integration
```

Expected dashboard actions:

- Create integration settings for a selected bot.
- Enable or disable external access.
- Add or remove allowed website origins.
- Rotate the secret.
- Copy the embed configuration or server API credentials.
- See whether the integration has ever been used.

The admin response should never return `secret_hash`. A newly generated raw secret should be returned only from create or rotate and should not be retrievable later.

## Public API Shape

The public API should identify the integration, not expose admin routes:

```text
GET  /api/integrations/bots/{public_key}/config
POST /api/integrations/bots/{public_key}/chat
```

The chat request should support:

```json
{
  "message": "What are your opening hours?",
  "conversation_id": null,
  "visitor_id": "optional-client-generated-id"
}
```

The endpoint must resolve the bot through the integration record and then apply the existing checks:

1. Integration exists and is enabled.
2. Secret or signed request is valid.
3. Request origin is in `allowed_origins` for browser embeds.
4. The linked custom bot is active.
5. Bot documents are not still processing.
6. Rate and message-size limits pass.

For an embedded browser widget, use a short-lived session token issued by `/config` rather than putting a long-lived secret in page JavaScript. For a trusted server-to-server integration, accept the secret in an authorization header and never expose it to the browser.

## External Website Modes

### Mode 1: Embed widget

The future website adds one script tag. The script loads the selected bot configuration and renders the chat widget. The external website controls placement and branding options, while TRPW bbot controls the bot behavior and knowledge.

```html
<script src="https://bbot.example.com/embed.js" defer></script>
<script>
  window.TRPWBbotConfig = {
    publicKey: "issued-public-key"
  };
</script>
```

The widget should not contain the private secret. Its origin is checked by the backend and its session token is short-lived.

### Mode 2: Server-to-server API

Another project calls the public chat endpoint from its backend. This is appropriate when the other project needs its own UI and does not want a widget.

This mode uses the integration secret in a server-side environment variable, for example `TRPW_BBOT_INTEGRATION_SECRET`. It should not be placed in frontend source code.

## Dashboard UI Structure

Inside each custom bot card, keep the existing `Chat` and `Edit` actions. Add an `Integration` action that opens a separate panel:

```text
External Integration
  Status: Not connected / Enabled / Disabled
  Attached bot: [bot name]
  Allowed website origins: [origin list]
  [Enable integration] [Disable integration]
  [Rotate secret]
  [Copy embed setup]
  Last used: [date or Never]
```

The panel should show a warning when a secret is generated and should make clear that disabling integration does not delete the bot or its documents.

## Security Requirements

- Keep admin routes protected by the existing admin dependency.
- Store only a hash of the integration secret.
- Use constant-time secret comparison.
- Normalize and exact-match allowed origins.
- Do not use `Access-Control-Allow-Origin: *` with credentials.
- Apply a separate public rate limit per integration and per visitor/IP.
- Limit message length and request body size before model generation.
- Do not allow public document upload, bot editing, or arbitrary system prompts.
- Use opaque visitor conversation IDs and verify that every conversation belongs to the integration.
- Log integration ID, bot ID, origin, status, latency, and failure reason, but never message secrets.
- Disable integration immediately when the linked bot is deleted or inactive.

## Implementation Phases

### Phase 0: Documentation and contract

- Keep this plan as the reference contract.
- Decide the production API hostname and whether the first consumer will use embed or server-to-server mode.
- Do not change runtime behavior.

### Phase 1: Data and admin controls

- Add the integration table through the project's existing database initialization/migration pattern.
- Add backend admin CRUD and secret rotation.
- Add the dashboard integration panel.
- Keep `enabled` false by default.

### Phase 2: Public API

- Add integration authentication and origin validation.
- Extract shared bot-chat preparation from the admin endpoint so both routes use the same service path.
- Add public SSE chat first because the current app already streams responses.
- Add focused tests for disabled, wrong secret, wrong origin, inactive bot, and successful chat cases.

### Phase 3: First external consumer

- Build the embed widget or a small example client only when a real website is available.
- Register its exact production origin in the dashboard.
- Verify disablement and secret rotation from the admin dashboard.

### Phase 4: Operations

- Add usage counters and recent integration events.
- Add configurable quotas if the bot is exposed publicly.
- Add an integration health check and documented incident-disable procedure.

## Compatibility and Rollback

- Existing `/api/admin/custom-bots/...` routes remain unchanged.
- Existing custom bot cards, documents, and inline test chat remain unchanged.
- The new integration table starts empty and all integrations start disabled.
- Removing the integration record detaches the bot externally without deleting the custom bot.
- If the feature is disabled at deployment level, the public router can return `404` while admin data remains intact.

## Definition of Done for the Future Feature

- An admin can enable exactly one selected custom bot for external use.
- An admin can disable or rotate access without editing the external website code.
- An external website can send chat messages only to that selected bot.
- Other custom bots and private admin routes remain inaccessible.
- Origin, secret, rate, and bot-status checks are tested.
- The current frontend build, backend tests, and existing custom bot chat continue to pass.