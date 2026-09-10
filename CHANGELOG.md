# Changelog

Notable changes to the platform application and shared packages are recorded
here. The release version is defined in the workspace root `package.json`.

## [Unreleased]

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
