# Deployment configuration

Most of what a deployment needs is an ordinary environment variable - a URL, a
credential, a feature toggle - and [`platform/.env.example`](../platform/.env.example)
documents those where they are used.

This document covers the five variables that are different in kind. Each carries
a JSON document rather than a scalar, and each answers a question the code
cannot answer for you: who administers this deployment, what it sells, what a
plan grants, which hostnames it answers on, who gets exceptions, and which
paths belong to an external application zone. They are **operator-owned data**,
deliberately kept out of the source tree so that a deployment's business model
and routing topology are not code changes.

Every one of them is optional. A deployment that sets none of them boots and
works: no administrators, no plans, no billing, no exceptions, no additional
host mappings, no external zones, and every surface served path-based on a
single host. That is the supported self-hosted default, not a degraded mode.

| Variable               | Answers                                     | Unset means            |
| ---------------------- | ------------------------------------------- | ---------------------- |
| `ADMINS_CONFIG`        | Who reaches `/admin`                        | Nobody                 |
| `LIMITS_CONFIG`        | What each plan grants                       | No plan concept at all |
| `OVERRIDES_CONFIG`     | Per-account exceptions and grants           | No exceptions          |
| `HOSTS_CONFIG`         | Request-affine host mappings                | Scalar host defaults   |
| `ZONE_CONFIG`          | Paths proxied to external application zones | No external zones      |

The four application configuration variables are parsed in `platform/config/`.
`ZONE_CONFIG` is parsed by `platform/next.config.d/zone.config.js` when Next.js
builds its routing table. Those source headers are the authoritative shape
references. This page is the operator's view: what to set, what it costs you to
get it wrong, and what changes safely.

## Validation rules

**The four application configuration variables are parsed with strict schemas
when their modules load. An unrecognised key, a missing required key, or a
malformed document fails startup or the build. It does not warn and continue.**

`ZONE_CONFIG` is different because it generates Next.js rewrites. It is parsed
at build time and validates route shapes as the rewrites are generated. Invalid
JSON or paths fail the build. Changes therefore require a rebuild and redeploy.
The variable must be present in the environment that runs `next build`; setting
it only in the final container's runtime environment is too late.

This is deliberate. These variables decide entitlements, administrator access
and routing; a table that silently ignored a key it did not understand would
deny a customer, expose an admin route, or 404 a whole surface with nothing in
the logs to say why. Failing at boot is the safe direction.

The cost is that **adding a required key to one of the four strict schemas is a
breaking change for every operator who sets that variable**. Their deployment
stops booting until they edit it. So:

- Additive keys should land **optional with a documented default**.
- Unknown keys must keep failing loudly - do not relax `.strict()` to make a
  migration easier.
- Any exception travels in the release notes as a configuration migration.

`HOSTS_CONFIG` is shared by build-time routing and runtime URL selection. The
build flattens every configured API and static target into its routing rules.
At runtime, request-context setup selects a mapping once from the authenticated
frontend host or trusted normalized request host. URL helpers then read only
the resolved context; the raw mapping is not exposed to the browser. The
operator-defined mapping names are only stable configuration identifiers; they
do not select branding, tenancy, or a canonical host.

## Validating before you deploy

The four application values are parsed when their modules load, so the cheapest
check is a development boot:

```bash
# from platform
ADMINS_CONFIG='["ops@example.com"]' pnpm dev
```

A malformed document fails immediately with a zod error naming the offending
path. Validating in the shell first is worthwhile for the larger ones:

```bash
echo "$LIMITS_CONFIG" | jq . > /dev/null && echo "valid JSON"
```

Valid JSON is necessary but not sufficient. The application checks the four
strict schemas, while a Next.js build checks `ZONE_CONFIG` and generates its
rewrites.

Two catalogues are **coupled**. A `plan` grant in `OVERRIDES_CONFIG` is
validated against `LIMITS_CONFIG` when the override module loads, and the
configuration conformity test suite checks the two together. Run the
application quality gate before deploying changes to these values. Set the
limits catalogue first so a granted plan is never left undefined.

---

## `ADMINS_CONFIG`

Who may reach the administration console at `/admin` and `/api/admin`.

```json
["ops@example.com", "clxyz0000000000000000000n"]
```

An array of identifiers. An entry is **either** a user id **or** an email
address, with no marker saying which - the check compares both fields of the
signed-in user against every entry.

That distinction matters when you add one. An **email** is a claim about a
person and follows whoever currently holds that address. An **id** is a claim
about an account and survives the person changing their address. Prefer the id
for anything long-lived.

> **Security.** This is the whole gate. The console ships in every deployment
> and authorizes nobody until this is set, so an empty value is safe and a
> careless value is not. An address you do not control - a former employee's,
> or a domain you have let lapse - is an administrator.

## `LIMITS_CONFIG`

The plan catalogue: one **complete** limit table per plan name.

```json
{
  "pro": { "tokens": 3000000, "conversations": 2500, "...": "every other key" }
}
```

The example above is **abbreviated and would not boot** - shown for shape only.
A real table carries every limit key; start from the one documented in
`platform/config/limits.ts`.

Plan names are yours - `pro`, `team`, `enterprise`, whatever you sell. The
limit _keys_ are platform vocabulary and the table must be complete: the schema
is strict, so a missing or misspelled key fails the boot rather than quietly
resolving to zero.

Unset is a **working configuration**, not an empty one. With no catalogue the
deployment has no plan concept: every limit lookup resolves to the unlimited
table, enumeration stays empty so no surface renders an invented plan name, and
the entitlement checks short-circuit. It is explicitly _not_ "everyone on the
lowest plan".

The code reserves three structural names. `free` means no subscription or
grant, and `trial` means a trialing subscription. `unlimited` always resolves to
the unlimited table: it is implicitly available for grants and manual
subscriptions but is never enumerated in plan lists. Do not define
`unlimited` in `LIMITS_CONFIG`.

## `OVERRIDES_CONFIG`

Per-account exceptions. The key used depends on the field: plan grants are
looked up by email, while VIP status and enforcement-time limit overrides are
looked up by account id. Some account-summary paths fall back to email for
limits, but enforcement does not, so email-keyed limit entries are not a
dependable deployment contract.

```json
{
  "ops@example.com": { "plan": "enterprise" },
  "clxyz0000000000000000000n": {
    "limits": { "database": { "files": 300 } },
    "plans": { "premium": { "limits": { "tokens": 5000000 } } }
  }
}
```

- **`plan`** is an email-keyed _grant_: treat this account as if it bought that
  plan. No subscription, no billing. This is the comp mechanism. It may name a
  catalogue plan other than `free` or `trial`, or the implicit `unlimited`
  plan.
- **`vip`** is account-id keyed and skips the hub publishing review queue.
- **`limits`** bends specific values whatever plan the account is on. Key these
  entries by account id so the enforcement paths apply them.
- **`plans[name].limits`** bends them only while on that plan, so a
  grandfathered exception does not leak into a downgraded one. These keys must
  name plans in `LIMITS_CONFIG`; `free` and `trial` are valid here when they are
  present in the catalogue. The surrounding entry should also use the account
  id.

A malformed or unknown plan reference fails when the override configuration is
loaded. An id key follows the account; an address-keyed plan grant follows
whoever holds the address. A key matching nothing is silently an override that
never applies, which is why attribution matters.

> **Operational note.** Record _which customer_ an entry belongs to as a comment
> beside the value in your encrypted environment file. An exception nobody can
> attribute is one nobody can ever remove.

## Apex hostnames

Four scalar variables define the apexes beneath which the deployment creates
subdomains. They identify canonical deployment-owned domains and are therefore
separate from the routing table.

| Variable        | Serves                                          | Unset means                                 |
| --------------- | ----------------------------------------------- | ------------------------------------------- |
| `APP_APEX`      | Standalone apps at `<slug>.<APP_APEX>`          | Standalone apps are path-based              |
| `PORTAL_APEX`   | Portals at `<slug>.<PORTAL_APEX>`               | Portals use custom domains or the site host |
| `SPACE_APEX`    | Space sites at `<slug>.<SPACE_APEX>`            | Deployment-issued space hostnames disabled  |
| `PARTNERS_APEX` | Partner experiences at `<slug>.<PARTNERS_APEX>` | Partners use custom domains or the site URL |

Values are hostnames without a protocol or wildcard, for example:

```dotenv
APP_APEX=example.app
PORTAL_APEX=example.agency
SPACE_APEX=example.site
PARTNERS_APEX=example.partners
```

## App shell origins

Two scalar origins identify the canonical app-shell endpoints. An origin must
include its protocol and must not include a path, query, hash, or trailing
slash.

| Variable          | Serves                  | Unset means                      |
| ----------------- | ----------------------- | -------------------------------- |
| `APP_MAIN_ORIGIN` | The main Apps shell     | The shell remains path-based     |
| `APP_LABS_ORIGIN` | The optional Labs shell | The Labs shell is not registered |

```dotenv
APP_MAIN_ORIGIN=https://apps.example.com
APP_LABS_ORIGIN=https://labs.example.com
```

## `HOSTS_CONFIG`

Optional request-affine host mappings. Each operator-defined key groups the
site, API, static, and widget hosts that must stay together when the deployment
answers on several domain families.

```json
{
  "example": {
    "match": [
      "example.com",
      "api.example.com",
      "static.example.com",
      "widgets.example.com"
    ],
    "site": "example.com",
    "api": "api.example.com",
    "static": "static.example.com",
    "widgets": "widgets.example.com"
  }
}
```

| Field     | Purpose                                                   |
| --------- | --------------------------------------------------------- |
| `match`   | Exact incoming hostnames that select this mapping         |
| `site`    | Site or application host for request-affine frontend URLs |
| `api`     | API host for request-affine API URLs and clean API routes |
| `static`  | Static host for public assets and static-host routing     |
| `widgets` | Host for private MCP widget bundles                       |

Values are exact hostnames without a protocol, wildcard, path, query, or hash.
Every target that can receive a request should also appear in `match`, so a
request arriving on an API or static host selects the same mapping.

At build time, every `api` and `static` target is enabled unconditionally. At
runtime, context injection selects the mapping once when the authenticated
frontend host or normalized request host appears in `match`. Server URL helpers
read the resolved targets from that context. The HTML document exposes only the
resolved site, API, static, and widget hosts for client hooks. An unknown host
keeps the existing custom-domain behavior.

`SITE_URL` remains the canonical and requestless default. When no mapping is
selected, `API_URL`, `STATIC_URL`, and `WIDGET_URL` all fall back to
`SITE_URL` - the deployment then serves the API at `/api/v1`, and the static
and widget paths, on its own host, with no host-gated routing derived. The
scalar targets are also routed alongside the mapped ones: an `API_URL` naming
a host other than the site host is routed to the API just as a `STATIC_URL`
host is routed to the static rules, so a deployment with a single dedicated
API subdomain needs only the scalar. There is no implicit `api.<site domain>`
derivation: advertised API URLs follow `API_URL`, and unset it they stay on
the site host. App shells and apex-based routing are controlled independently
by the scalar variables above.

The configuration fails validation on malformed hostnames, missing fields,
unknown fields, or a hostname matched by more than one mapping.

## `ZONE_CONFIG`

Optional build-time routing for applications deployed separately while this
application remains the public domain gateway. The value is an array of zones;
the legacy single-zone object is also accepted.

```json
[
  {
    "origin": "https://marketing.example.com",
    "hosts": ["example.com", "www.example.com"],
    "root": true,
    "paths": ["/pricing", "/careers"],
    "exactPaths": ["/platform"],
    "prefixes": ["/media/marketing"],
    "exceptions": ["/pricing/internal-tool"],
    "aliases": { "/pricing-preview": "/pricing" },
    "assetPrefix": "/marketing-static"
  }
]
```

| Field         | Purpose                                                          |
| ------------- | ---------------------------------------------------------------- |
| `origin`      | Deployment origin to which the owned routes are proxied          |
| `hosts`       | Exact incoming hostnames on which this zone applies              |
| `root`        | Whether the bare `/` belongs to the zone                         |
| `paths`       | Top-level segments, their subtrees, and Pages Router data routes |
| `exactPaths`  | Top-level paths owned only at the exact path                     |
| `prefixes`    | Multi-segment subtrees whose parent segment remains shared       |
| `exceptions`  | Subtrees retained locally beneath a segment listed in `paths`    |
| `aliases`     | Temporary local paths that proxy to another path in the zone     |
| `assetPrefix` | Unique JS and CSS chunk prefix, defaulting to `/zone-static`     |

Only zones with both a non-empty `origin` and at least one host become active.
Hosts not listed in a zone, including white-label and preview hosts, stay with
this application. `paths` and `exactPaths` accept single top-level segments;
`prefixes` and `exceptions` accept multi-segment paths. An exception must sit
beneath an entry in `paths`.

This variable is deployment topology rather than tenant or branding data. To
return a path to this application, remove it from the table and rebuild. The
experimental `distro` Dockerfile does not currently forward operator `.env`
values into the build, so extending that build definition is required for a
zoned compiled image.

---

## Built-in assistants and public examples

The assistant and example widgets need two decisions that application code
cannot make for an operator: which model to use, and which account owns an
unauthenticated public conversation.

| Variable                 | Purpose                                                            | Unset means                            |
| ------------------------ | ------------------------------------------------------------------ | -------------------------------------- |
| `AUTO_WIDGET_MODEL`      | Model for the built-in dashboard, blueprint and website assistants | Built-in assistants are disabled       |
| `AUTO_WIDGET_USER_ID`    | Service-account owner for the unauthenticated website assistant    | The website assistant is not public    |
| `EXAMPLE_WIDGET_USER_ID` | Service-account owner for unauthenticated live examples            | Live examples require a signed-in user |

Authenticated dashboard, blueprint and example requests always use the
signed-in account. A service account is only a deliberate owner for an
unauthenticated public surface; it is never substituted for a signed-in user.
If no owner can be resolved, conversation creation fails closed with a 401.

## Portal rewrite assertions

Most community deployments do not need internal routing headers. When the
separate portal frontend rewrites a public or custom domain to the platform,
however, the platform still needs the original frontend host for tenant
selection and URL generation, and may need the ingress-provided client address.

Set the same `INTERNAL_HEADERS_SECRET` value, with at least 16 characters, in
the portal and platform environments. The portal serializes each value as an
independently authenticated assertion under a non-canonical wire name. The
platform verifies allowlisted assertions once and promotes them into request
context. Raw `x-chatbotkit-internal-*` headers, unknown assertions, malformed
values and invalid signatures are ignored. If the secret is unset, the
platform behaves as if no portal assertions were supplied.

When this value is missing or shorter than 16 characters, the assertion sender
and receiver emit a debug message where the value is used. Incoming portal
assertions are treated as untrusted and internal self-calls emit no assertions.
The portal follows the same fail-closed behavior for outgoing assertions. Use a
randomly generated secret rather than treating the minimum length as an entropy
guarantee.

This secret does not make ordinary `Host`, `x-forwarded-host` or client-IP
headers trustworthy. A deployment proxy must overwrite those headers and
prevent direct application access according to its own topology.

## Reverse-proxy headers

The platform trusts `x-forwarded-host`, `x-forwarded-proto` and the client
address headers (`x-real-ip`, else the last `x-forwarded-for` hop - the one
the proxy itself appended) only when the deployment sets
`TRUST_PROXY_HEADERS=true`. The values are normalized once
into request context and downstream code reads only that context; when trust
is disabled, the forwarded values are ignored and the application uses the
ordinary `Host` header, the request URL protocol where available, and the
directly connected socket address for rate limiting and audit records.

Behind a reverse proxy this flag also decides whether the sign-in abuse
controls work at all: without it every client shares the proxy's socket
address, so the per-address budgets for code issuance and verification become
one global budget - a handful of failed attempts from anyone locks sign-in for
everyone until the window passes.

The flag is a deployment-topology assertion, not authentication. Enable it
only when the reverse proxy removes client-supplied forwarded headers, writes
its own values, and prevents clients from reaching the application origin
directly. If those conditions cannot be guaranteed, leave it unset.

## Platform capacity cap

`PLATFORM_MAX_TOKENS_PER_MONTH` is an optional deployment-wide safety ceiling,
not a subscription plan. Set it to a positive number to stop non-exempt model
traffic after that many calibrated base tokens in a billing period. Leaving it
unset, or setting it to `Infinity`, gives a community deployment no artificial
hosted quota. Hosted and resource-constrained operators should set a finite
value explicitly.

## Credential cache

`PLATFORM_CREDENTIAL_CACHE_TTL` is the number of seconds an API secret key or
OAuth access token lookup may be served from cache when a request
authenticates. It defaults to `0`: every API request reads the credential row,
so revoking a key takes effect on the next request. A deployment whose API
volume makes that read expensive (a metered database, for instance) can set a
small positive value to trade a bounded delay for fewer reads. Be explicit
about what is bought: a revoked key or token keeps working for up to that many
seconds. There is no stale-while-revalidate on top, so the window is exactly
the value set.

## Encryption at rest

`PRISMA_FIELD_ENCRYPTION_KEY` encrypts the database columns that hold
credentials - every column carrying a `/// @encrypted` annotation in the
schema: stored secrets and their values, every integration's tokens, app
secrets, API keys, private keys and webhook secrets, the MCP identity
provider's client secret, next-auth's provider tokens and outbound webhook
secrets (`ENCRYPTED_FIELDS` in `platform/prisma/encryption.ts` is the list) -
through the Prisma extension in that module. Not encrypted, by design: the
columns the platform looks up by equality (API keys, its own OAuth server's
tokens and client secrets - `/// @digest` in the schema), because a
ciphertext with a random nonce cannot be searched. It is optional, and **setting it is the
decision to encrypt**: unset, the extension is inert and those columns are
stored as given. It is a separate concern from `CLOAK_ENCRYPTION_KEY`, the
general-purpose key the rest of the application uses (transient OAuth state,
values encrypted out of band with `pnpm script:encrypt`); the two are never
substituted for each other.

**What you get.** Writes are encrypted on the way in, reads decrypted on the
way out, including `include`-d relations; a test fails if the schema
annotations and the extension's field map ever disagree. AES-256-GCM with a
fresh random nonce per value, and each ciphertext bound to its column
(`<Model>.<column>` as authenticated data), so a value copied by raw SQL from
one column or model to another is rejected on read rather than granting the
target row a credential it never had. Audit rows only ever see ciphertext.
A copy of the database - a backup, a replica, an injection, a script gone
wrong - is useless without the key. It does not protect against someone who
holds the runtime, and it is one key for the whole deployment rather than
per tenant.

**Generating a key.**

```bash
# from platform
pnpm script:generate-encryption-key
```

prints a `k1.aesgcm256.<43 base64url characters>=` value - 32 random bytes.
Back it up somewhere that is not the database: losing every key loses every
encrypted value, and there is no recovery. A malformed value is not
silently ignored; the first write to an encrypted column fails.

**Rotation.** The variable is a comma-separated keychain: the first key
encrypts, every key decrypts. Rotation therefore needs no downtime and no
window during which reads fail:

1. Generate a new key and **prepend** it: `PRISMA_FIELD_ENCRYPTION_KEY=<new>,<old>`.
   Deploy. New writes use the new key; existing rows still read.
2. Run `pnpm script:backfill-database-encryption`. It walks every encrypted
   column and rewrites each value that is not already under the first key
   with its column binding, in batches, and reports counts. Without
   `--execute` it is a dry run and only counts. It is safe to re-run, and it
   stops - rather than skipping - on a value that no configured key accepts.
3. Remove the old key. Do not do this before step 2 completes: values still
   under it become unreadable, and the script cannot recover them.

**Turning it on later.** The same script is the one-time migration for a
deployment that ran without a key: set the key, deploy, run the script once.
Reads pass plaintext rows through, so nothing breaks in the meantime, but a
production estate should not rely on "re-save to encrypt". Removing the key
later does not decrypt anything - rows encrypted while it was set come back
as ciphertext until it is restored.

---

## Related

- [`platform/.env.example`](../platform/.env.example) - every other variable
- [Architecture](./architecture.md) - the configuration boundary and module
  architecture
- `packages/*/README.md` - each swappable module's own variables
