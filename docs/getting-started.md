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

Browser-facing file flows use presigned URLs against the store itself, which
is published on port 3900 (`STORAGE_PORT`) under its own name,
`http://cbk-storage.localhost:3900` - a `*.localhost` name browsers resolve to
loopback with no DNS setup, like the relay and app shells. Set `STORAGE_URL`
when the browser reaches the machine by another address.

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

It publishes a provisioned store on port 3900. Uncomment the matching block in
`.env.example`, including:

- `STORAGE_ENDPOINT`
- `STORAGE_REGION`
- `STORAGE_ACCESS_KEY_ID`
- `STORAGE_SECRET_ACCESS_KEY`
- `STORAGE_FORCE_PATH_STYLE`
- the `*_S3_BUCKET_NAME` variables

AWS S3, Cloudflare R2, SeaweedFS and other S3-compatible stores can be used with
their own values. Sandbox storage mounts additionally require
`STORAGE_ROLE_ARN` and an STS-capable store.

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

## Configure email delivery

Without an email vendor, sign-in codes and invitations are printed to the
server log. To deliver real mail, set one vendor's credential and a verified
sender; the module detects the vendor from the credential:

```bash
EMAIL_FROM="Login <noreply@example.com>"

RESEND_API_KEY=re_...
# or SENDGRID_API_KEY=SG....
# or SES_AWS_REGION=eu-west-1 SES_AWS_ACCESS_KEY_ID=... SES_AWS_SECRET_ACCESS_KEY=...
```

`EMAIL_PROVIDER` pins a vendor when more than one credential is present, and
`EMAIL_REPLY_TO` and `EMAIL_ACTIONS_FROM` are optional. The email module's
README has the full reference.

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
