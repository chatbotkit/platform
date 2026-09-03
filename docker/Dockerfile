# =============================================================================
# ChatBotKit Platform Image (standalone)
# =============================================================================
# Builds the platform application from this folder alone, using this folder's
# own workspace manifests and lockfile - it does not reach into any parent
# repository, so it works identically in the public repository and inside the
# monorepo.
#
# In this context every `@chatbotkit-dev/*` module resolves to the open
# default implementation in ./packages: SQLite for the database, the
# in-process or Redis key-value store, and so on. The docker-compose.yml next
# to this file wires the full stack together; to build by hand:
#
#   docker build -f Dockerfile -t chatbotkit-platform .   # from this folder
#
# This is the only container image. A hosted-deployment image with the
# internal module overrides would be a deliberate variant of this file built
# from the monorepo root, not a separate lineage.
# =============================================================================

# -----------------------------------------------------------------------------
# Stage 0: Base
# -----------------------------------------------------------------------------

FROM node:24.20.0-alpine AS base

# Required system dependencies for native modules (better-sqlite3 builds from
# source on alpine)
RUN apk add --no-cache libc6-compat python3 make g++

# Enable the pnpm version required by package.json's packageManager field.
RUN corepack enable && corepack prepare pnpm@11.24.0 --activate

WORKDIR /app

# -----------------------------------------------------------------------------
# Stage 1: Workspace dependencies
# -----------------------------------------------------------------------------

FROM base AS dependencies

# @note image builds are non-interactive: pnpm must auto-confirm prompts
# (e.g. recreating the modules directory when hoist settings change) instead
# of aborting for want of a TTY
ENV CI=true

WORKDIR /app

# Workspace configuration first, for layer caching
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json .pnpmfile.cjs turbo.json ./
COPY patches ./patches/
COPY stubs ./stubs/

# @note the one local file: dependency that lives inside the application
# source - fetch scans local dependencies, so it must exist before fetch runs
COPY platform/eslint ./platform/eslint/

# @note fetch resolves from the lockfile alone, so editing source does not
# invalidate the dependency layer - the install below links offline from the
# fetched store
RUN pnpm fetch

# Workspace members
COPY packages ./packages/
COPY platform ./platform/

RUN pnpm install --frozen-lockfile --offline

# -----------------------------------------------------------------------------
# Stage 2: Application builder
# -----------------------------------------------------------------------------

FROM dependencies AS builder

ENV NEXT_OUTPUT_MODE=standalone
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# @note the Next.js build needs far more heap than node's ~4GB default - the
# hosted CI grants it 80% of a heavy runner's memory. Lower this only if the
# build host must, and expect the build to fail under ~8GB.
ARG NODE_HEAP_MB=16384

# @note the emfile guard makes fs.promises retry when the descriptor table
# is full - next's trace collection otherwise dies with EMFILE on hosts with
# modest ulimits, even after the raise below
ENV NODE_OPTIONS="--max-old-space-size=$NODE_HEAP_MB --require /app/platform/scripts/emfile-guard.cjs"

# @note the build asserts a site url; override for a real deployment. Secrets
# should NOT be passed as build args - use BuildKit secret mounts.
ARG SITE_URL=http://localhost:3000
ENV SITE_URL=$SITE_URL

# @note apex host rewrites are generated at build time, so the image bakes a
# `.localhost` pair browsers resolve to loopback without DNS: space sites at
# `<slug>.space.localhost`, portals at `<slug>.portal.localhost`. The runtime
# environment must name the same apexes (the compose files do).
# @todo move the apex host rewrites out of next.config.d into a runtime proxy
# so one image digest serves any domain without a rebuild
ARG SPACE_APEX=space.localhost
ENV SPACE_APEX=$SPACE_APEX
ARG PORTAL_APEX=portal.localhost
ENV PORTAL_APEX=$PORTAL_APEX
ARG APP_APEX=
ENV APP_APEX=$APP_APEX
ARG PARTNERS_APEX=
ENV PARTNERS_APEX=$PARTNERS_APEX

# @note source maps ship without source content by default; pass 'full'
# explicitly to embed the source for debuggable self-hosted images
ARG BUILD_SOURCEMAPS=nosources
ENV BUILD_SOURCEMAPS=$BUILD_SOURCEMAPS

# @note build-time database: the graphql codegen and static generation
# construct the client, so they need a real (empty) schema to point at. This
# file never leaves the builder stage - the runtime database comes from
# PRISMA_DATABASE_URL at run time (the compose file sets it to the volume).
ENV PRISMA_DATABASE_URL=file:/tmp/build.db
RUN pnpm -F @chatbotkit-dev/db db:push

# @note unit tests, lint and type validation run as separate CI gates rather
# than during image assembly. Keep the image build focused on producing the
# deployable artifact from an already-validated checkout.
ENV SKIP_BUILD_TESTS=true
ENV SKIP_LINT=1
ENV SKIP_CHECK=1

WORKDIR /app/platform

# @note the build imports every route module while collecting page data, and
# some modules assert their configuration at import. The example env provides
# documented placeholder values for exactly that; the runtime environment
# comes from the compose file and .env at run time, never from here.
RUN cp .env.example .env

# @note the cache mount persists Next's incremental compiler cache across
# image rebuilds on the build host, so a source edit costs an incremental
# build rather than a cold one (BuildKit required, which is docker's default)
# @note next's build tracing opens thousands of files concurrently; raise
# the descriptor limit to the hard maximum or the trace dies with EMFILE
RUN --mount=type=cache,target=/app/platform/.next/cache,uid=0,gid=0 ulimit -n $(ulimit -H -n) && pnpm build

# @note Next copies the builder's .env into the standalone output, where its
# documented placeholder values would silently backfill anything the runtime
# environment leaves unset. Strip it so a missing variable fails loudly at
# boot instead.
RUN rm -f .next/standalone/platform/.env .next/standalone/platform/.env.production

# -----------------------------------------------------------------------------
# Stage 3: Database initializer
# -----------------------------------------------------------------------------

# Produce a portable package containing the database implementation, schema
# tooling and workspace dependencies, without carrying the application build
# or pnpm store into the published initializer image.
FROM dependencies AS initializer-deployer

WORKDIR /app

RUN pnpm --filter @chatbotkit-dev/db deploy --legacy /initializer

FROM node:24.20.0-alpine AS initializer

RUN apk add --no-cache libc6-compat

WORKDIR /app

COPY --from=initializer-deployer /initializer ./

# @note the Garage provisioning script rides along so the distribution stack
# (docker/distro/*) can run it from this image instead of bind-mounting the
# checkout - a published Compose OCI artifact cannot carry bind mounts
COPY docker/garage/init.mjs /garage-init.mjs

RUN mkdir -p /data

# @note schema derivation writes inside the installed database package, so the
# one-shot initializer runs as root. The final chown hands SQLite files to the
# uid/gid used by the non-root application image. Network databases ignore the
# otherwise empty /data directory.
CMD ["sh", "-c", "npm run db:push && chown -R 1001:1001 /data"]

# -----------------------------------------------------------------------------
# Stage 4: Application
# -----------------------------------------------------------------------------

FROM node:24.20.0-alpine AS application

WORKDIR /app

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Standalone output preserves the workspace structure (platform/...)
COPY --from=builder --chown=nextjs:nodejs /app/platform/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/platform/public ./platform/public
COPY --from=builder --chown=nextjs:nodejs /app/platform/.next/static ./platform/.next/static

RUN mkdir -p platform/.next
RUN chown nextjs:nodejs platform/.next

# Writable location for the SQLite database volume
RUN mkdir -p /data
RUN chown nextjs:nodejs /data

# @note generates missing secrets on first boot - see docker/entrypoint.sh;
# a no-op for deployments that set them
COPY --chmod=755 docker/entrypoint.sh /entrypoint.sh

USER nextjs

EXPOSE 3000

ENTRYPOINT ["/entrypoint.sh"]

CMD ["node", "platform/server.js"]
