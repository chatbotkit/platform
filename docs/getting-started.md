# Getting started

The complete supported local baseline runs with Docker Compose. A host-side
development setup is available when you want a faster edit loop.

To run the prebuilt platform without a checkout, use the one-command
distribution stack described in [Deployment](./deployment.md) instead.

## Run the complete local stack

From the repository root (with Git LFS installed before cloning, so the binary
assets arrive as files rather than pointers):

```bash
docker compose up
```

Open <http://127.0.0.1:8080>. Sign in with any email address and read the
six-digit sign-in code from the `dev` service log (`docker compose logs -f
dev`).

This command starts:

- the platform development server on SQLite
- Redis for shared caching
- Qdrant for vector storage
- Garage as an S3-protocol object store
- `garage-init`, which provisions the development key and storage buckets

The checkout is mounted read-only and synchronized into the development
container. Editing the host working tree still triggers hot reload.

Browser-facing file flows use presigned URLs containing the Compose service
hostname. Add `127.0.0.1 garage` to the host machine's hosts file before testing
uploads or downloads in a containerized mode. Host-side development configured
with `SERVICE_AWS_ENDPOINT=http://localhost:3900` does not need that entry.

No hosted account, billing configuration or vendor credential is required to
boot. Model-backed agent responses require at least one model provider key.

## Configure the development container

The Compose service keeps its working copy in a writable volume and
deliberately excludes the host `.env` file from source synchronization. In a
second terminal, create or edit the host file and copy it into the running
container:

```bash
test -f platform/.env || cp platform/.env.example platform/.env
# Edit platform/.env, then:
docker compose cp platform/.env dev:/workspace/platform/.env
docker compose restart dev
```

Repeat the copy and restart after changing environment variables. A host-side
development server reads `platform/.env` directly and does not need this step.

## Add a model provider

The platform only advertises provider models when the matching credential is
configured. For example, add this to `platform/.env`, then update the running
container as described above when using Compose:

```bash
OPENAI_API_KEY=sk-...
```

The same key also powers dataset embeddings in the default vector setup. Other
provider variables are documented in `platform/.env.example`.

## Run the application on the host

Requirements:

- Node.js 24.20 or newer
- pnpm 11.24.0 or newer
- Git LFS - binary assets are LFS pointers; run `git lfs install` before
  cloning, or `git lfs pull` in an existing checkout

From the repository root:

```bash
pnpm install
cd platform
cp .env.example .env
pnpm db:push
pnpm dev
```

Open <http://127.0.0.1:8080>.

Run `pnpm db:push` from the application directory rather than invoking the
database module's CLI directly. The wrapper resolves the relative SQLite URL
against the application directory before the module runs.

The host-side baseline uses:

- SQLite on disk
- an in-process cache when `REDIS_URL` is unset
- local JSON vector files when `QDRANT_URL` is unset
- console email delivery
- no plan, billing or entitlement catalogue

## Configure object storage on the host

The public storage module is an S3-protocol client, not a local-filesystem
store. The application boots without storage, but file uploads, generated
images and speech, space assets and sandbox storage mounts refuse at the point
of use until a store is configured.

The quickest local option is the Compose Garage service:

```bash
docker compose up garage garage-init
```

It publishes a provisioned store on `127.0.0.1:3900`. Uncomment the matching
block in `.env.example`, including:

- `SERVICE_AWS_ENDPOINT`
- `SERVICE_AWS_REGION`
- `SERVICE_AWS_ACCESS_KEY_ID`
- `SERVICE_AWS_SECRET_ACCESS_KEY`
- `SERVICE_AWS_FORCE_PATH_STYLE`
- the `*_S3_BUCKET_NAME` variables

AWS S3, Cloudflare R2, SeaweedFS and other S3-compatible stores can be used with
their own values. Sandbox storage mounts additionally require
`SERVICE_AWS_STORAGE_ROLE_ARN` and an STS-capable store.

## Configure shared cache and vector storage

These services are optional for a host-side development server:

```bash
docker compose up redis qdrant
```

Then configure:

```bash
REDIS_URL=redis://localhost:6379
QDRANT_URL=http://localhost:6333
```

## Protect stored credentials

Before storing real credentials, configure `PRISMA_FIELD_ENCRYPTION_KEY`. An
unset value means scalar credential columns are stored as provided.

Generate a key from the application directory:

```bash
pnpm script:generate-encryption-key
```

Keep the key safe. Losing it makes encrypted credentials unrecoverable. See
[Configuration](./configuration.md#encryption-at-rest) for backfill and key
rotation.

## Next steps

- Review the [module defaults](./module-defaults.md) before evaluating
  queueing, storage, sandboxing or multi-process behavior.
- Read [deployment](./deployment.md) before exposing the application outside a
  local development environment.
- Read [configuration](./configuration.md) before setting any `*_CONFIG`
  variable. Leaving them unset is the supported default.
