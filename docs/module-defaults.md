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

The public email module delivers through whichever vendor it finds credentials
for - Resend (`RESEND_API_KEY`), SendGrid (`SENDGRID_API_KEY`) or Amazon SES
(`SES_AWS_ACCESS_KEY_ID` with its region and secret) - detected in that order,
or pinned with `EMAIL_PROVIDER`. A vendor also needs `EMAIL_FROM`, a sender on
a domain verified with that vendor; `assertConfigured` fails until both are
present.

With no credentials it writes delivery information to the console, text body
included. This makes local email-code sign-in usable without a vendor but does
not deliver external mail. Inbound mail is not supported by any of the vendors;
an inbound implementation replaces the module.

### Sandbox

The public sandbox runs agent commands in [AgentOS](https://github.com/rivet-dev/agentos):
a userspace Linux with its own filesystem, process table and network stack,
owned by a native sidecar process that brokers every guest syscall. Shell,
coreutils, Node.js and `npm` work; outbound network is open, with loopback,
private and link-local destinations refused; each sandbox keeps a `/workspace`
directory under `SANDBOX_DATA_DIR` that survives restarts. Python is reported as
unsupported until the sidecar ships its runtime. The isolation is the
sidecar's, not the kernel's, and CPU is shared with the application, so a
deployment exposing code execution to untrusted tenants at scale still wants
an implementation with kernel-level isolation and per-tenant accounting.

### Realtime relay

The public relay module builds channel addresses for any relay speaking the
platform's channel protocol, from `RELAY_URL`. It is also a relay: when
`RELAY_PORT` is set its `listen` hosts a single-node one inside the
application process, which the compose stacks do, so realtime voice and
avatar sessions work locally. Unset, the module refuses
at the point of use and fails the readiness check. Meeting bots and telephony
are dialled in from outside and need a relay that party can reach - see
`packages/relay/README.md`.

### Unavailable service defaults

The public batch runner, screenshot capture and response delivery modules keep
the application importable but refuse their service operations. Their
`assertConfigured` checks fail so deployment readiness tests cannot mistake an
unavailable capability for a production backend. Features that need scheduled
batch work, captured pages, or outbound response delivery require an operator
implementation.

### Optional and no-op defaults

The default search engine finds nothing and the PII module passes content
through without detecting or redacting anything. Platform-secret and partner
catalogues are empty. Observability writes exceptions and messages to the
console; tags and spans are debug-only, and the framework adapters are no-ops.
Callers handle these states without requiring a vendor.
