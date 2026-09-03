# Platform

The application: the dashboard, the built-in apps and the public API, all
served from one Next.js codebase. The packages it composes live in
`../packages`; see [`../docs/architecture.md`](../docs/architecture.md).

## Development

Create a local environment file from the example:

```sh
cp .env.example .env
pnpm db:push                           # provision the local SQLite database
```

`.env.example` lists every variable the application understands, with working
local defaults. Nothing needs filling in to boot: sign-in uses an emailed code
that is printed to the console, and the rest can stay as it is until you touch
the feature that uses it. A model provider key is the first thing you will
want; see [`../docs/getting-started.md`](../docs/getting-started.md).

Then start the development server:

```sh
pnpm dev
```

It listens on `http://127.0.0.1:8080` by default. Set `APP_PORT` to use a
different port.

### Checks

```sh
pnpm test:unit path/to/file.utest.js   # unit tests, or omit the path for all
pnpm lint                              # eslint across the app and scripts
pnpm check                             # typescript, no emit
pnpm storybook                         # component workshop on port 8001
```

Unit tests sit beside their source as `*.utest.js`. The one exception is
`config/` - it holds data seams only, so its tests go in `tests/config/`.

### Quick building

A full `pnpm build` regenerates the database and GraphQL clients, builds the
templates, runs the unit tests, builds the API spec, then the Next.js output
and the sitemap. While iterating you usually want to skip the tests and the
type check:

```sh
NODE_ENV=production SKIP_BUILD_TESTS=true SKIP_CHECK=y pnpm build
```

### Running as a specific user

Set `RUNAS_USERID` to have the development server act as a particular account,
which is useful when reproducing something that depends on a user's data or
plan:

```sh
RUNAS_USERID=<user-id> pnpm dev
```

## Principles

### Integrations

There are two types of integrations:

- **Direct integration** - provided by the platform
- **Hosted integration** - provided outside the platform

The difference is subtle but important. Direct integrations are raw and
flexible, usable as building blocks for applications that are not built by
ChatBotKit. Hosted integrations are designed for a specific platform, served as
standalone apps, and provide very specific integration features.

## Caveats

### Dependencies

- `nprogress-v2@1.0.4` is pinned because the progress bar stopped showing on
  later versions.

## Notes

### Favicons

Favicons are generated with https://favicon.io/favicon-converter/.

### Database performance

https://db-latency.vercel.app/ is a useful tool for measuring database latency
issues.

### Vector storage size

Estimate the memory needed for a set of vectors with:

```
memory_size = number_of_vectors * vector_dimension * 4 bytes * 1.5
```
