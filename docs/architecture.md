# Architecture

This repository is a self-contained pnpm monorepo with two kinds of members:
the shared and swappable module packages under `packages/`, and the platform
application under `platform/`. This document explains how they fit together
and the conventions that are not self-evident from the tree. All paths below
are relative to the open-code repository root.

Read this before concluding anything from the directory layout. The two most
common misreadings - that `pages/` and `app/` are a stalled router migration,
and that the flat `lib/` directory is disorganized - are both wrong, and both
are explained below.

## Repository layout

| Path        | What it is                                                        |
| ----------- | ----------------------------------------------------------------- |
| `packages/` | The `@chatbotkit-dev/*` libraries and module contracts (`*-spec`) |
| `platform/` | The platform application, `@chatbotkit/platform` (Next.js)      |
| `stubs/`    | Local dependency shims applied at install time                    |
| `patches/`  | pnpm dependency patches                                           |

The `pnpm-workspace.yaml`, lockfile and overrides in the repository root govern
dependency resolution across the application and its packages.

## Branches

The `next` branch is the development branch, and contributor pull requests
target it. The `main` branch is the stable release branch and advances through
a reviewed promotion from `next` after the required checks pass. See
`CONTRIBUTING.md` for the current contribution workflow.

## Swappable modules

The platform's deployment-specific behavior - configuration catalogues,
storage, email delivery, caching, database engine - lives behind swappable
modules. A swappable module is three packages, not one:

| Package                | Contains                                                                                                  |
| ---------------------- | --------------------------------------------------------------------------------------------------------- |
| `packages/<name>-spec` | The contract, plus shared schemas or derivation code where the contract requires them                     |
| `packages/<name>`      | The public default. Must boot with no configuration; a backing service may be required to use the feature |
| (a deployment's own)   | An implementation installed over the public name                                                          |

A deployment replaces a module by adding a pnpm override that resolves
`@chatbotkit-dev/<name>` to its own implementation package. Remove the
override and the platform resolves to the public default and still runs -
that is the property every module preserves, and it is why a fresh checkout
of this repository boots with no deployment-specific or vendor configuration.
Booting is the guarantee, not every feature: the public storage module is an
S3-protocol client that needs an endpoint, credentials and buckets before file
flows work (the Compose stack provisions Garage), and the public queue is
immediate and non-durable - delays, retries and ordering are accepted and
ignored.

[Module defaults](./module-defaults.md) lists the rest.

The public defaults differ in what "default" means, and the difference is
deliberate. `@chatbotkit-dev/email` logs messages to the console - a working,
if noisy, delivery path. The plan catalogue (`@/config/limits`, read from the
LIMITS_CONFIG environment variable) defaults to empty, which the platform
reads as "this deployment has no plan concept": every entitlement resolves
without limits and no interface renders a plan name. Defaults describe a
working planless, vendor-free deployment, not a crippled one.

Module conventions, enforced across the set:

- Configuration is resolved lazily, on first use, never at module load - so
  importing the platform never requires a vendor credential.
- Every module exposes an `assertConfigured` readiness check through the
  entry point defined by its contract. The application exercises every
  installed module in `platform/tests/config/providers.utest.js`, so the
  build and CI fail before an incomplete deployment reaches first use.
- A module's README is the authoritative environment-variable reference. The
  application's `.env.example` includes only the values useful for the
  supported baseline and common local setup.
- Application code depends on the public package name and contract, never on
  a deployment implementation. Runtime-specific behavior is generally
  concentrated in in-tree adapters such as `lib/queue.ts`, `lib/storage.ts`
  and `prisma/client.ts`.

## The application

### Two routers, by design

`platform/pages/` contains the dashboard, product surfaces and the entire
public API under `pages/api/v1/`. It uses the Pages Router.

`platform/app/` is the apps runtime, and almost nothing else: a root layout and
`app/apps/`. It uses the App Router because its manifest-driven model fits that
router's layout system.

The two coexist permanently. This is not an unfinished migration: they are
different products sharing one codebase. The platform is a multi-page
application; the apps runtime is a family of focused applications (chat, code,
tasks, usage, and others), served path-based by default or through configured
application hosts. Manifests define the application, while deployment
configuration owns its host topology.

### The apps runtime

Every app is a directory under `app/apps/` carrying an `app.manifest` - a
JSON file whose shape is declared in `app/apps/app.manifest.d.ts`. The
minimal complete example:

```json
{
  "start": "/apps/connect",
  "name": "Connect",
  "description": "Connect to your favorite apps and services",
  "icon": "@lucide/grid-2x2-plus",
  "order": 30,
  "category": "main",
  "config": {}
}
```

The parts of the contract that are not obvious:

- Manifests are discovered at build time by `next.config.d/apps.config.js`,
  which walks `app/apps/`, validates every manifest against a schema, and
  generates the host routing from the result. The app's slug is its
  directory name.
- `start` is the app's entry path. Host mappings do not live in the manifest;
  the deployment's app and shell configuration decides whether that path is
  served under the main site or a dedicated host.
- `global` is the app's baseline in every context. `config` supplies defaults
  on the dashboard and the app's standalone host; a portal uses its own
  global, app and user overlays. The complete precedence rules live in
  `lib/app.router.app.config.ts`.
- `order` and `category` provide listing defaults. App-shell and portal
  configuration can override them for a particular context.
- `category` is one of nine: `main`, `support`, `admin`, `user`,
  `developer`, `help`, `other`, `lab`, `service`.

Two kinds of app directory exist side by side: platform apps with descriptive
names (`chat/`, `code/`, `task/`) and apps under `(adhoc)/` with stable,
opaque 8-hex-digit slugs. "Ad-hoc" describes the route identity, not the app's
importance or maturity. The opaque slug avoids URL churn when a surface is
renamed or repositioned, while the manifest carries its human name and
category.

A catch-all route (`app/apps/[...path]/route.ts`) claims any `/apps/*` path
no named app claims, and mounts portal static content at the root - which is
what lets a site authored for root deployment resolve its absolute resource
paths when served through a portal.

### `lib/` - a tree encoded in filenames

`lib/` is one flat directory, with a co-located test beside most source files.
The organization is in the filename: dot-separated prefixes encode a
two-to-three-level tree, so `action.exec.mcp.ts` reads as _action → execution
→ MCP handler_ and `model.provider.openai.ts` as _model → provider →
OpenAI_.

The largest families are real architectural units. `model.*` is the model
catalogue and provider layer, with `model.provider.*` holding provider
integrations. `action.*` is the ability execution engine; each
`action.exec.*` file is one action runtime (fetch, shell, image, email, MCP,
and others) following a common internal structure: schemas, operation-name
constants, `do*` implementations, and an `execute*` router whose switch is
exhaustiveness-checked at compile time.
Other families mirror the domain model (`conversation.*`, `bot.*`,
`dataset.*`, `skillset.*`, `user.*`, `usage.*`, `limit.*`, `session.*`) and
the messaging integrations (`slack.*`, `twilio.*`, `telegram.*`,
`whatsapp.*`, `discord.*`, and others) - the flat directory doubles as the
integration registry.

When adding a file, join an existing family if one fits; a new prefix is a
new subsystem and should be a deliberate choice.

### `components/` and `hooks/`

Both are flat like `lib/`, but use word-prefix namespacing instead of dots:
`components/` primarily holds one PascalCase component per file
(`BotBlockStatus.jsx`, `DatasetList.jsx`) with its test and, where useful, a
Storybook story beside it; `hooks/` holds one `useThing` hook per file, with
the same co-location.
The prefix families (`Bot*`, `Dataset*`, `Conversation*`, `Theme*`,
`useConversation*`, `useScroll*`) mirror the same domain nouns as `lib/` and
the database schema.

UI code prefers plain HTML with the shared class vocabulary from
`styles/globals.css` (`default-button`, `primary-button`, `default-input`,
and friends) over bespoke styled components.

### `config/`

`config/` is the application's deployment and product-configuration boundary.
Its TypeScript and JavaScript modules parse operator-owned environment values,
derive origins and host topology, and expose catalogues for apps, models,
limits, navigation and feature defaults. Strict schemas make malformed
operator configuration fail during startup or build instead of silently
changing behavior.

YAML is used elsewhere for content, prompts and catalogue inputs. The webpack
YAML loader makes those imports available as JavaScript values and can select
entries through `lookupKey` and `lookupValue` resource queries.

### `next.config.d/`

`next.config.js` is a loader, not a config: it reads every `*.config.js` in
`next.config.d/`, orders them, and deep-merges the results (with defined
semantics for `webpack`, `headers`, `rewrites`, and `redirects`). Each
module owns one concern.

They fall into two groups. Portable application configuration covers bundling
and output modes, transpiled packages, security headers and CSP, environment
exposure, image domains, embed script entry points, API discovery headers and
agent content negotiation. Deployment-controlled routing covers app shells,
standalone apps, portals, space sites, partner hosts, request-affine host
mappings and optional multi-zone proxies. With those values unset, the
corresponding rules are inert and the supported single-domain, path-based
topology remains. The module boundaries keep portable behavior and optional
host routing visible file by file.

### `schemas/` - where authorization lives

`schemas/` holds one Joi schema per request field, and these are not just
shape validators: identifier schemas resolve the referenced resource and
enforce access on it. `schemas/botId.js`, for example, looks up the bot and
applies use-versus-manipulate access checks, throwing the appropriate
authentication or authorization error. API routes compose their request
validation from these files, so authorization is enforced at the validation
boundary rather than ad hoc inside handlers. `schemas/api/v1/` adds
per-resource response schemas for the public API.

### The database

The one hand-edited Prisma schema lives in
`packages/db-spec/prisma/schema.prisma`, kept complete for the richest
supported engine on purpose: engine-specific information only flows
downhill, so deriving is subtractive. Each database implementation derives
its own `schema.prisma` from it - the derived copies are generated, marked
as such, and committed so schema changes show up in review for every engine
they affect. Derivation also runs automatically at the start of every
`db:push` and `db:gen`, so a stale schema cannot reach a database or a
generated client.

`db-spec` also carries the shared analytics queries in `prisma/sql/`,
written to run unmodified on every supported engine.

Inside the application, `prisma/` is the data-access layer around the
generated client - the client singleton, custom model methods, field-level
encryption, caching, auditing, and retry - not the schema.

### Content and layouts

`content/` contains only the small catalogues still coupled to the product
runtime: FAQs and connection metadata under `other/`. Source-level `@doc` and
`@manual` blocks are publication inputs consumed by the documentation release
tooling. Published documentation is maintained outside the product runtime, so
the application does not depend on generated manuals or documentation content.

`layouts/` contains the reusable page shells used by the Pages Router, such as
the dashboard, app, exploration and administration layouts. App Router layouts
stay with their routes under `app/`.

### Everything else, briefly

`emails/` - React Email components, one per transactional message,
delivered through the swappable email module. `embeds/` - sources for the
embeddable widget and MCP scripts, injected as extra webpack entries.
`graphql/v1/` - the GraphQL schema and resolvers behind
`pages/api/v1/graphql`. `workers/` - browser web workers. `templates/` -
quick-setup wizard definitions. `data/` - ability, secret and other runtime
catalogues expressed as TypeScript DSLs and YAML or OpenAPI inputs. `prompts/`
contains versioned YAML prompt files. `scripts/` contains operational scripts
built mostly on a shared `runScript` harness with CLI and interactive modes.

## Conventions

### New source is TypeScript, new tests are JavaScript

The source tree is being migrated from JavaScript and JSX to TypeScript and
TSX. New source and files converted as part of a change use `.ts` or `.tsx`
and are type-checked by `pnpm check`; existing `.js` and `.jsx` files remain
valid until they are migrated deliberately.

New tests are JavaScript on purpose: a TypeScript test rejects the
wrong-on-purpose input that a test exists to cover. In the application, unit
tests are `*.utest.js` or `*.utest.jsx` and are normally co-located with their
source; in packages they are `*.test.js`. Existing TypeScript test files
predate this rule - leave them alone unless the surrounding test is already
being rewritten, and do not use them as models.

One placement exception, about the router: tests under `pages/` stay
co-located but carry an underscore prefix (`pages/api/v1/bot/_create.utest.js`,
`pages/admin/users/[userId]/_index.utest.js`) because the router ignores
`_`-prefixed files, so test files are never exposed as routes.

Integration tests are `*.itest.js` under `tests/integration/`, run
separately (`pnpm test:integration`).

### Comments

`@note` marks gotchas, side effects, and surprising behavior - the things
the next reader would otherwise rediscover the hard way. `@todo` marks
planned work. Both are single sentences, lowercase, no ending period. Plain
comments explain complex logic and use normal punctuation. The codebase
leans heavily on `@note`; when a piece of code depends on something the code
cannot show, that is where it is written down.

### Custom lint rules

The application ships its own ESLint rules under `eslint/custom-rules/`, each
encoding a repository invariant. They protect serialization, Prisma deletes,
typed SQL, disposable factory results, the custom router, package
transpilation, directive placement, controlled HTTP egress and centralized
documentation links. If one fires, its error message identifies the invariant;
the rule source and any co-located test show the exact boundary.

### Build-time machinery worth knowing about

The webpack layer under `platform/webpack/` carries the YAML loader described
above, a `.json.gz` loader, a markdown frontmatter loader
(`import meta from './file.md?frontmatter'`), and a source-map validation
plugin that fails the build if any emitted map embeds source content.
`app.manifest` files import as JSON via a dedicated rule.

## Building and verifying

From the repository root, begin with `pnpm install`. The CI quality gate runs
`build`, `lint`, `check` and `test` across the packages (filtering the
application out with `--filter='!@chatbotkit/platform'`) and then, in a
second job, type-checks the application and runs its unit suite from
`.env.example` and a fresh SQLite database. The application's lint and build
are still local responsibilities. See `CONTRIBUTING.md` for the exact commands
and setup.

Inside `platform/`: `pnpm dev` starts the development server, `pnpm check`
type-checks, `pnpm lint` lints, `pnpm test:unit` runs the unit suite (or pass a
single test path), and `pnpm storybook` starts the component workbench. A full
`pnpm build` regenerates the database and GraphQL clients, builds templates and
the API specification, runs the unit suite, builds the application, and
generates the sitemap. The `SKIP_*` environment variables it honors exist for
CI stages that cover selected steps separately.

The `docker-compose.yml` at this root offers two application modes. The
default profile starts a ready development server plus Redis, Qdrant and
Garage; it copies the read-only checkout into a container and preserves hot
reload. The `distro` profile builds and serves the compiled platform. The
backing services can also be started individually for host-side development.
