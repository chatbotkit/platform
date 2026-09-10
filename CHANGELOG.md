# Changelog

Notable changes to the platform application and shared packages are recorded
here. The release version is defined in the workspace root `package.json`.

## [Unreleased]

## [0.4.0] - 2026-09-10

### Changed

- Media Graph now generates, transforms, uploads and saves through route
  handlers instead of server actions, so several nodes can generate at the
  same time. Server actions are queued one at a time by the browser, which
  made every generation wait for the previous one. The `appContactRouteHandler`
  helper is the route counterpart of `appContactActionHandler`.

### Fixed

- Resolve cookie sessions in App Router route handlers. `getSession` handed
  next-auth the Web `Request`, which carries neither the `cookies` map nor
  the plain `headers` object next-auth reads, so every cookie-authenticated
  route handler answered 401. Those requests now resolve through
  `next/headers`, the same way server actions already did.
- Keep the dev server's Server Components HMR cache off. On a refresh after
  a code change Next replayed every fetch of the render, keyed by URL and
  body, and `cache: 'no-store'` does not opt a call out. The PlanetScale
  driver's `BEGIN` request has the same body every time, so the driver was
  handed the session of an already committed transaction and the following
  statement failed with `transaction ... ended (transaction committed)`.
  Development only; production never had the cache.
- Stop a failed session expiry bump from signing the user out of a request.
  With database sessions NextAuth refreshes the expiry once its update window
  has passed and treated any failure of that update as a lost session, so App
  Router pages bounced to sign-in and on to the overview. The adapter now
  reports the failure and keeps the session, which was already read with a
  valid expiry.
- Stop the sidebar logo from reporting a hydration mismatch in dark mode.
  The icon picked its dark variant from the theme on the first client render
  while the server had rendered the light one, so React flagged the filter
  style. The theme is now applied only after hydration.
- Stop the App Router build of `next/link` warning about the `locale` prop.
  The shared `Link` wrapper forwarded the default locale on every link; it
  now forwards a locale only when a caller sets one.
- Price multi-backend Vercel AI Gateway models at the most expensive backend
  the gateway can route to. The gateway bills each request at the rate of the
  backend it picks, so DeepSeek V4 Flash, DeepSeek V4 Pro, DeepSeek V4.1
  Flash, Gemma 4 31B, GLM-5.2, GLM-5.3 Flash, MiMo V2.5, MiMo V2.5 Pro and
  MiniMax M3 no longer bill below what the gateway can charge.

## [0.3.3] - 2026-09-10

### Fixed

- Let the platform fetch its own URLs on the Community and Studio stacks.
  The egress boundary refused every loopback and private destination outside
  development, and those stacks run the production build on loopback, so
  proxied images, attachments and presigned objects failed with `egress to
  127.0.0.1 is not allowed`. The boundary now recognises the deployment
  itself: the configured site, static, widget, API and app shell origins
  connect unchecked, and where the site lives on loopback so does every
  loopback and `*.localhost` destination. Other private addresses stay
  refused, and a hosted deployment's public origins gain nothing.
- Stop the upgrade page from offering a checkout the billing API refuses.
  An account that already holds a subscription - live, or lapsed after a
  failed payment - is sent to the billing portal to change it, a lapsed one
  is told its payment needs fixing, and a child account is told billing
  belongs to the owner. A refused checkout now surfaces its message instead
  of the button silently doing nothing. Billing modules gain
  `hasOpenSubscription` on the subscription model.
- Retry a sandbox command that the AgentOS runtime refused to start because it
  was still tearing down the previous command after a timeout. The refusal
  surfaced as exit 127 with empty output on the first command after any
  timed-out one, most often under load.

## [0.3.2] - 2026-09-10

### Fixed

- Listen on the published application and relay ports inside the Community
  and Studio containers. The application reaches itself through the address a
  request arrived on, so publishing `31000` in front of a container listening
  on `3000` refused every server-side API call in Studio with
  `ECONNREFUSED 127.0.0.1:31000`, and the same happened to any Community
  instance moved with `PLATFORM_PORT`.

### Changed

- Bill GLM-5.3 through Vercel AI Gateway at the standard rate again, matching
  the gateway catalogue after the launch discount ended.

## [0.3.1] - 2026-09-10

### Added

- Support DeepSeek V4.1 Flash through Vercel AI Gateway, DeepSeek, and
  OpenRouter, with image input, reasoning, tool calls, provider-specific model
  identifiers, token limits, and usage pricing.

## [0.3.0] - 2026-09-10

### Added

- Declare where the Community and Studio Compose stacks answer in an `x-cbk`
  endpoint manifest inside each published artifact, resolved with
  `docker compose config --format json`, so a launcher reads the stack's
  addresses instead of assuming port 3000.

### Changed

- Move the published application port with `PLATFORM_PORT` and the site
  hostname with `PLATFORM_HOST` in the Community and Studio stacks. The site,
  sign-in, app shell, space and portal addresses follow the port, and
  `RELAY_URL` now follows `RELAY_PORT`, so a second instance on one host needs
  the port variables rather than an override file.
- Publish the Studio stack on `31000`, `31001` and `31900` instead of
  Community's `3000`, `3001` and `3900`, so it runs beside a developer's
  existing services on `3000` and beside a Community stack on the same host.
  Container ports are unchanged.

## [0.2.2] - 2026-09-10

### Fixed

- Upgrade the default sandbox runtime to AgentOS `0.2.20-rc.1` so fast shell
  pipelines finish without waiting for the blocking-read watchdog at each
  stage. Node output redirection and slow-writer limitations remain documented
  in the sandbox package.
- Pin the multi-architecture image manifests in the published Compose
  distribution artifacts. A freshly built release pinned one arbitrary
  per-architecture digest per image, so `docker compose -f oci://...` failed
  with `unsupported: "platform linux/arm64"` (or amd64) depending on the
  build.

## [0.2.1] - 2026-09-10

### Fixed

- Use the runtime API URL in both Twilio webhook instructions and the install
  popup, preserving the deployment scheme, port and route prefix.
- Carry the port everywhere a host is named. The `chatbotkit.host` cookie, the
  `data-*-host` attributes and their fallbacks now all hold the host as the
  request context records it; app, portal and partner lookups reduce it to a
  hostname first, and a `HOSTS_CONFIG` mapping is selected by exact host,
  then by hostname, so a deployment reached on a port
  resolves its shells, the API, static and widget origins, portal sign-in,
  partner domains, embed frame policies and canonical URLs the same way one
  on the default port does. Portal origins minted from `PORTAL_APEX` take the
  `SITE_URL` port, and apex links built in the browser follow the page port;
  a target on a different port needs a `HOSTS_CONFIG` mapping. The
  cookie is written by the proxy at runtime from the host the context trusts
  and is `Secure` only when `SITE_URL` is https, so plain-http deployments
  receive it too.
- Keep a mapped host that spells its default port on the page's scheme, and
  let links to the page's own host follow the scheme and port the page was
  reached on rather than the configured origin.
- Recognize mapped API hosts with explicit default ports in HTTP tools, and
  bracket IPv6 addresses when the local proxy forwards a host with a port.
- Return app-host sign-ins to their app instead of the platform onboarding
  route, which is not served on main, labs or individual app hosts.
- Advertise the mapped API host and its route prefix in the OpenAPI spec,
  including deployments whose frontend and API use separate hosts.
- Retain the configured site port in app manifest IDs when no request host is
  available.
- Use the runtime API URL in both Recall webhook instructions and the install
  popup.
- Use the resolved deployment in API docs examples: raw HTTP includes the
  required `/api` prefix on shared sites, and Node and Go clients use the
  deployment's API origin.
- Select portal and partner authentication by hostname when the request host
  includes a port.
- Advertise the OpenAPI server URL with the deployment's scheme when the
  request carries none, so a plain-http deployment no longer publishes an
  https server it does not serve.
- Use the deployment's scheme and port when the Slack integrations app builds
  install manifests, including the configured-site fallback.
- Use the deployment's scheme and port in widget frame policies and preview
  capture URLs, and resolve auto-widget partner branding by hostname.
- Include the deployment's scheme and port in portal URLs returned by GraphQL
  and preserve the site port in generated portal hosts.
- Preserve static and widget host ports, resolve mapped asset URL schemes, and
  include the served widget origin in MCP resource policies.
- Preserve configured ports in host values and read server-provided origins
  when initializing browser configuration.
- Allow tool-specific MCP widgets to load their validated bundle origin in the
  resource policy, including its scheme and port.
- Strip ports before portal login email domain and team invitation partner
  lookups.
- Keep local testing proxy redirects on the browser's origin when accessed
  through an HTTPS tunnel or a different local host and port.
- Honor the configured scheme of a separate API origin, including APIs on a
  different port of the site hostname and HTTPS loopback origins.
- Clear a dedicated API's port when in-app HTTP tools translate its URL onto
  a frontend origin using the default port.
- Send API playground requests through the frontend's actual port when the
  entered API URL uses another port or omits it.
- Keep app install manifests discoverable when a host mapping assigns a
  separate frontend hostname to the main or labs shell.
- Preserve static app asset paths, portal configuration lookup and missing-page
  handling when the mapped frontend differs from the app or portal routing host.
- Resolve space-site storage from its routing hostname when its host mapping
  names a separate frontend, preventing valid space sites from returning 404.
- Match Pipedream relative-path integrations by hostname when the target URL
  includes a port.
- Resolve request-context host mappings by exact host first, then hostname,
  and match API, static and app routing targets without their ports, including
  IPv6 app origins.

## [0.2.0] - 2026-09-08

### Added

- Add the OpenAI `gpt-image-2.5-flare` and `gpt-image-2.5-sunburst` image
  models with their pricing and supported sizes.

### Fixed

- Allow plain-http image, script, style, font, media, frame and worker
  sources in the Content Security Policy when `SITE_URL` itself is served
  without TLS, matching the existing websocket allowance. The app shells on a
  local http deployment load banners from the site or static origin, which the
  browser refused before.
- Recognise the labs shell host in the browser, so its sidebar links resolve
  to `/<slug>` instead of `/apps/<slug>`, which the shell rewrite turned into a
  404. Only the main shell host was overlaid from the runtime attributes.
- Preserve explicit ports and bracket IPv6 addresses for both request and
  asserted frontend hosts in the local reverse proxy.

## [0.1.0] - 2026-09-08

### Added

- Establish the first versioned platform source snapshot as the baseline for
  future releases, with `package.json` as the authoritative platform version.
- Validate the release version and changelog on promotion pull requests and
  on every publication run, so a promotion to `main` needs an unused version
  and a dated changelog entry.
- Tag the published images and Compose artifacts of each promotion with the
  release version, alongside the channel and commit tags.
- Create an annotated Git snapshot tag and a GitHub Release with the changelog
  notes and source downloads once every flavor's images carry the version.
- Require protected `main` before the workflow can create a source snapshot.

This release records the existing platform as a baseline. Earlier development
history remains available in Git.
