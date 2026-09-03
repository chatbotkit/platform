# Module defaults

Every swappable module ships a public default that boots with nothing set.
This page records what each of those defaults actually does, so a deployment
can tell a working baseline from a feature that needs an operator
implementation. Booting is the guarantee, not production semantics.

How modules are swapped, and the conventions every module keeps, are in
[Architecture](./architecture.md#swappable-modules). The distribution flavors
bundle backing services over these defaults;
[Deployment](./deployment.md#distribution-flavors) lists what each flavor
changes. Each module's package README owns its environment-variable reference.

## Default behavior

### Database

The public database module uses SQLite in a file. It is suitable for the local
single-process baseline. Production operators own database durability,
concurrency, backup and restore behavior.

### Storage

The public storage module is an S3-protocol client with no built-in store. Bare
`docker compose up` provisions Garage. A host-side checkout must configure an
S3-compatible endpoint and buckets before storage-backed features work.

### Queue

The public queue delivers immediately and is non-durable. Publishing sends a
request back to the local route. Nothing outlives that request.

It accepts `delayInSeconds`, retries, flow ordering and callbacks but does not
act on them. A delayed message fires immediately, a failed delivery is not
retried and `parallel: 1` does not serialize work. Install a durable queue for
features that depend on those semantics. It does suppress duplicate deliveries
within one process for 30 minutes, but that memory is neither shared nor
durable.

### Cache

The public cache is a bounded in-process LRU unless `REDIS_URL` is set. State is
per process and is lost on restart. In a multi-process deployment, rate-limit
and cache state does not coordinate without a shared implementation.

### Vector storage

The public vector module stores records in local JSON files unless `QDRANT_URL`
is set. Embedding still requires a configured model provider, such as
`OPENAI_API_KEY`.

### Email

The public email module writes delivery information to the console. This makes
local email-code sign-in usable without SMTP but does not deliver external
mail.

### Sandbox

The public sandbox runs code in the application process for development and
refuses under `NODE_ENV=production`. Production code execution requires an
isolated implementation with explicit CPU, memory, disk, network, lifetime and
tenant boundaries.

### Unavailable service defaults

The public batch runner, realtime relay, screenshot capture and response
delivery modules keep the application importable but refuse their service
operations. Their `assertConfigured` checks fail so deployment readiness tests
cannot mistake an unavailable capability for a production backend. Features
that need scheduled batch work, live relay channels, captured pages, or
outbound response delivery require an operator implementation.

### Optional and no-op defaults

The default search engine finds nothing and the PII module passes content
through without detecting or redacting anything. Platform-secret and partner
catalogues are empty. Observability writes exceptions and messages to the
console; tags and spans are debug-only, and the framework adapters are no-ops.
Callers handle these states without requiring a vendor.
