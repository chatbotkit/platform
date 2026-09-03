# Code

Mint stateless coding tokens scoped to the conversation completion endpoint.

## Purpose

- Mints a "coding token": a normal secret key (`sk-...`) scoped to the stateless
  `conversation/complete` endpoint via `config.allowedRoutes`.
- Lists and revokes only the tokens it minted, identified by `meta.app === 'code'`.

## Architecture

```
code/
  app.manifest      # App configuration (slug derived from directory name)
  const.ts          # APP_NAME, scope (allowedRoutes) and meta.app marker
  config.ts         # Zod schema for app configuration
  layout.jsx        # App layout with standard header/footer
  page.tsx          # Server component for initial data loading
  components.jsx     # Client components (List + mint/revoke flows)
  server.ts         # Server actions: mint, list, revoke
  README.md         # This file
```

## Key Behavior

- **Mint** creates a token with `config.allowedRoutes = ['conversation/complete']`
  and `meta.app = 'code'`. The secret is shown once at mint time and never again.
- **List** returns only tokens owned by the user that carry `meta.app === 'code'`.
- **Revoke** deletes a token after verifying it belongs to the user and was minted
  by this app.
