# Auxiliary APIs

Auxiliary routes are internal implementation endpoints used by the platform's
ability executor and selected browser flows. They support third-party service
proxies, data processing helpers and authentication flows, but they are not a
versioned part of the public REST API. External clients should use the public API
or an ability template instead of calling these routes directly.

## Overview

Auxiliary APIs are designed to:

- **Proxy third-party services**: Provide secure, rate-limited access to external APIs
- **Implement specialized interfaces**: Add SQL and GraphQL capabilities for services that don't natively support them
- **Process and transform data**: Handle file chunking, data conversion, and other utilities
- **Manage authentication flows**: Support OAuth and other authorization mechanisms

Route paths and payloads may change with their platform callers. Changes still
require the same authentication, egress and test review as public routes.

## Trust boundary

Every auxiliary route requires an authenticated platform session. There is no
anonymous auxiliary route: platform-owned compute and network helpers (math,
`url/*`, screenshot, unfurl, dataset chunking, the playground tool-call preview)
and the provider-token proxies (`google/*`, `notion/*`, the SQL/proxy/RPC routes
for third-party services) are all wrapped in `authenticatedHandler` /
`authenticatedMultiHandler` from `lib/auxiliary.handler.ts` (the SQL wrappers in
`lib/auxiliary.sql.ts` delegate to the same), or in `withSession` for the
non-schema routes. The anonymous `handler` / `multiHandler` wrappers remain in
the library for reference but must not be used by a route.

The rationale: the action executor always runs with a user session, so
authenticating the call costs nothing and gives the platform metering and
attribution for the work it performs on the caller's behalf. A public,
unmetered proxy has no legitimate caller.

How the credential reaches the route:

- Ability templates in `data/abilities/catalogue/` that target an auxiliary
  route carry `options.auth: internal` (or a fenced fetch instruction whose
  info string is `fetch/auth=internal`). The action executor
  (`lib/action.exec.fetch.ts`) injects
  `Authorization: Bearer <temporary user token>` for self-origin URLs when that
  option is present.
- Abilities created from the catalogue store a template reference and
  re-resolve the instruction at execution, so they follow the catalogue.
  Hand-written fetch instructions targeting `/api/auxiliary/` must set the
  option themselves.
- Browser callers (the ability playground) send the session cookie.
- Server-side callers (`lib/dsd2.ts` for dataset chunking, `lib/mcp.edge.ts`)
  mint a short-lived temporary user token for the acting user.

Conformity is enforced by `lib/auxiliary.handler.conformity.utest.js` (no route
may use the anonymous wrappers), `data/abilities/auth.utest.js`
(every auxiliary template carries the internal auth option) and
`lib/auxiliary.handler.boundary.utest.js` (anonymous POSTs are rejected with
401 before the route body runs). The Pipedream secret OAuth routes under
`secret/oauth/pipedream/` are browser OAuth flows secured separately.
