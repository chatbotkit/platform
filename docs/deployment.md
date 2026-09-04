# Deployment

The repository provides a complete development stack, a locally compiled image
profile and prebuilt community images produced by trusted pushes. These are
application distribution artifacts, not infrastructure provisioning recipes.
Production operators remain responsible for the surrounding deployment and
its operational guarantees.

## Compose profiles

Run the complete development stack:

```bash
docker compose up
```

Run only backing services for host-side development:

```bash
docker compose up redis qdrant garage garage-init
```

Build and run the experimental compiled image:

```bash
docker compose --profile distro up --build platform
```

The first compiled build can take more than 15 minutes depending on available
CPU, memory and network cache state.

## Pull the community image

Trusted pushes to `main` and `next` publish matching application and database
initializer images. Names follow `platform-<flavor>-<component>`; tags carry
only the build: the moving `main` and `next` tags are channels (`latest`
follows `main`), and `sha-<commit>` tags identify an immutable source
revision.

The publication workflow derives the registry owner and image name from the
GitHub repository. In `chatbotkit/platform` this resolves to the official image
names below without repository-specific workflow configuration.

The public ChatBotKit images use `ghcr.io/chatbotkit/platform-community-app`
and `ghcr.io/chatbotkit/platform-community-init`. Start the Compose profile
without allowing a source build. Each tag is a multi-platform image for
`linux/amd64` and `linux/arm64`, so Docker selects the host architecture
automatically:

```bash
docker compose --profile distro up --no-build --pull always platform
```

By default this pulls:

```text
ghcr.io/chatbotkit/platform-community-app:next
ghcr.io/chatbotkit/platform-community-init:next
```

Select another matching channel or immutable revision by setting both image
references:

```bash
PLATFORM_IMAGE=ghcr.io/chatbotkit/platform-community-app:main \
PLATFORM_INIT_IMAGE=ghcr.io/chatbotkit/platform-community-init:main \
  docker compose --profile distro up --no-build --pull always platform
```

Never mix application and initializer revisions. The database schema and
generated application client must come from the same source and package flavor.

## One-command distribution stack

Each trusted push also publishes the flavor's complete Compose application as
an OCI artifact under `ghcr.io/chatbotkit/platform-<flavor>`. The artifact is
self-contained - the application, database initializer, Redis, Qdrant and
Garage with its configuration and provisioning - and every image reference in
it is resolved to a digest, so an artifact tag identifies an exact, immutable
stack. No checkout, no bind mounts:

```bash
docker compose -f oci://ghcr.io/chatbotkit/platform-community:latest up
```

The `latest` tag follows `main`; `next` follows the `next` branch. Compose
v2.34 or newer is required. On `up`, Compose shows the stack's variables -
site URL, secrets, optional provider keys - and their defaults before
proceeding; set them in the shell, in a `.env` file in the directory the
command runs from (picked up automatically), or via an explicit `--env-file`,
and pass `-y` to skip the confirmation in scripts. Shell values win over
`.env`, and only variables the stack declares are consumed - the published
artifact carries no `env_file` mounts, so arbitrary extra entries do nothing.

### Persisted configuration

Values can also live in the platform data volume, where they survive
restarts and upgrades and never touch a file on the host. The application
entrypoint reads `/data/config.env` (one `KEY=VALUE` per line, no quoting)
and exports every entry the container environment does not already set. Any
variable the application honours is accepted, not only the ones the stack
declares. `setup` writes the file:

```bash
# prompts for the provider keys, input hidden; Enter keeps, "-" clears
docker compose -f oci://ghcr.io/chatbotkit/platform-community:latest run --rm --no-deps platform setup

# prompts for named variables, or sets them without a terminal
docker compose -f oci://ghcr.io/chatbotkit/platform-community:latest run --rm --no-deps platform setup OPENROUTER_MODELS_API_KEY
docker compose -f oci://ghcr.io/chatbotkit/platform-community:latest run --rm --no-deps platform setup OPENROUTER_MODELS_API_KEY=sk-or-... OPENAI_API_KEY=
```

A running `platform` service applies the change on its own: the entrypoint
polls `config.env` every `PLATFORM_CONFIG_WATCH_INTERVAL` seconds (default
5) and restarts the application process when it changes, so expect a short
interruption rather than a reload. Set the interval to `0` in an override
file to disable the watch and run the application as the container's main
process; the service then needs a `docker compose restart platform` after
each change. Precedence, highest first: the container environment (shell,
`.env`, `--env-file`, `-e`), then `config.env`, then the secrets generated
on first boot. An empty environment value counts as unset, so the stack's
`${OPENAI_API_KEY:-}` defaults never mask a persisted value; to override one
for a single run, set it in the shell. The file is owned by the application
user with mode `0600`; back it up with the volume, and prefer
`PRISMA_FIELD_ENCRYPTION_KEY` in the environment rather than next to the
database it protects.

### Several instances on one host

The stack declares no project name, so Compose derives one. Two instances
started from the same artifact would share that project - and with it the
`platform-data` volume - and both would try to publish port 3000. Give each
instance its own project with `-p` and move its published ports with an
override file; the override applies after the artifact, so pass both, in that
order, on every command for that instance:

```yaml
# staging.yml
services:
  platform:
    ports: !override
      - '3001:3000'
```

```bash
docker compose -p cbk-staging \
  -f oci://ghcr.io/chatbotkit/platform-community:latest -f staging.yml up -d
docker compose -p cbk-staging \
  -f oci://ghcr.io/chatbotkit/platform-community:latest -f staging.yml logs platform
```

Set `SITE_URL` and `NEXTAUTH_URL` to the instance's published address
(`http://localhost:3001` here) and `STORAGE_PORT` to a free store port
(`3901`) - in the shell or through `--env-file`, since a
single `.env` in the working directory cannot describe both instances. Volumes,
networks and container names are all prefixed with the project name, so each
instance keeps its own database, generated secrets, object store and vector
index, and `-p` is also how `logs`, `ps` and `down` find the right one.

The artifact is published from
[docker/distro/community/compose.yml](../docker/distro/community/compose.yml),
which also runs directly from a checkout. One folder per package flavor lives
under `docker/distro/`; a future PostgreSQL flavor publishes as
`ghcr.io/chatbotkit/platform-postgresql` from its own folder, built from the
matching image flavor.

Browser-facing file upload and download flows presign URLs against the
in-stack store, published on port 3900 (`STORAGE_PORT`) under one name,
`http://cbk-storage.localhost:3900`: a `*.localhost` name browsers resolve to
loopback like the relay and app shells, and an alias of the `garage` service
inside the Compose network, since the application fetches the same URLs. Set
`STORAGE_URL` to an address both browsers and the containers can reach (with
TLS if the site has it) when browsers do not reach the host itself. `garage-init` grants every bucket a CORS
rule for `STORAGE_CORS_ORIGINS` (default `*` - the presigned URL is the access
control; narrow it for a store reachable beyond the host).

### Distribution flavors

A flavor is the baseline of [module defaults](./module-defaults.md) plus the
backing services its stack provisions. Everything not listed keeps the
default - in the community flavor the database is SQLite in the platform data
volume, the queue is immediate and non-durable, sign-in codes are read from
the container log, and agent code runs in the default in-process sandbox with
its workspaces kept under `/data/sandbox` in the same volume.

| Flavor      | Database                | Cache | Vector | Storage |
| ----------- | ----------------------- | ----- | ------ | ------- |
| `community` | SQLite (default module) | Redis | Qdrant | Garage  |

A PostgreSQL flavor would swap the database column only; the other services
travel unchanged.

## Production boundary

The `distro` profile demonstrates that the application can be compiled and run
from the published tree. It deliberately does not stand up an operator's
production infrastructure. A production deployment still needs:

- TLS termination and a trusted reverse proxy that overwrites forwarded headers
- protection and backup of the runtime secrets generated into the persistent
  platform data volume, or explicit operator-provided values
- durable database, object-storage and backup policies
- a durable queue when delayed delivery, retries, callbacks or ordering matter
- a sandbox with kernel-level isolation and per-tenant resource accounting if
  agent code execution is exposed to untrusted users; the default runs agent
  code in a userspace VM inside the application process - see
  [module defaults](./module-defaults.md)
- monitoring, restore testing and an upgrade and rollback procedure

The repository does not yet publish versioned releases, SBOMs or signed
provenance, so branch and commit images remain pre-release artifacts. This
status concerns release provenance and compatibility, not whether Compose
should provision the operator-owned infrastructure listed above.

The experimental Dockerfile builds with `.env.example`; Compose attaches the
optional operator `.env` file only to the running container. Configuration
consumed by Next.js while it builds, including `ZONE_CONFIG` and the build-time
parts of host and subscription configuration, is therefore not baked into the
`distro` image. A production pipeline must supply those values during the build
and keep secrets out of image layers.

The current community image deliberately bakes the neutral single-host
topology: `SITE_URL=http://cbk.localhost:3000`, with no external zones. Two
apexes are baked alongside it so deployment-issued subdomains work out of the
box: `SPACE_APEX=cbk-space.localhost` and `PORTAL_APEX=cbk-portal.localhost`,
and the two app shells answer at `http://cbk-apps.localhost:3000` and
`http://cbk-labs.localhost:3000` through `APP_MAIN_ORIGIN` and
`APP_LABS_ORIGIN`.
Browsers resolve any `*.localhost` name to loopback, so a space site published
as `acme` answers at `http://acme.cbk-space.localhost:3000` with no DNS or
hosts-file setup (`curl` needs `--resolve`). The runtime apexes and shell
origins must name the same hosts as the build, which the compose files ensure;
a different host needs a rebuild with the matching build arguments. Runtime service variables
such as the database, Redis, Qdrant and S3-compatible storage endpoints remain
configurable. Deployment identity that Next currently exposes through
`next.config.js` is still frozen at build time; do not present the same digest
as portable across arbitrary public domains until that migration is complete.

## API endpoint

Every deployment serves the API at `/api/v1` on its own host - nothing to
configure. To advertise and serve it on a dedicated origin instead, set
`API_URL` (e.g. `https://api.example.com`), point that DNS name at the
deployment, and rebuild: the host is then routed to the API (answering under
the clean `/v1` path) and every externally advertised URL - webhook
registrations, embeds, the OpenAPI spec - follows it. Unset, advertised URLs
stay on the site host under `/api`. Multi-domain deployments name their API
hosts in `HOSTS_CONFIG` instead; see
[Configuration](./configuration.md#hosts_config). Both are read at build time,
so changing them requires a rebuild, not just a restart.

## Reverse proxy trust

Set `TRUST_PROXY_HEADERS=true` only when the reverse proxy overwrites forwarded
host, protocol and client-address headers and the application origin cannot be
reached directly. See [Configuration](./configuration.md) for the complete
trust-boundary requirements.

## Persistent state

The development stack stores state in Compose volumes. A production design must
make the retention, backup and restore behavior explicit for:

- the application database
- object-storage buckets
- Redis when it carries shared rate-limit or cache state
- Qdrant or the selected vector implementation
- encryption keys and other runtime secrets

Backing up ciphertext without its encryption key is not a recoverable backup.

## Module limits

The public defaults prioritize a vendor-free boot and an honest development
experience. Some defaults are intentionally not production implementations.
Read [Module defaults](./module-defaults.md) before selecting production
backends.
