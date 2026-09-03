# Distribution stacks

One folder per package flavor. Each folder holds a self-contained, image-only
`compose.yml` that CI publishes as a Compose OCI artifact to
`ghcr.io/chatbotkit/platform-<flavor>`, digest-pinned to the matching
application and initializer images. Consumers run the whole stack with:

```bash
docker compose -f oci://ghcr.io/chatbotkit/platform-<flavor>:latest up -d
```

## Naming

- One grammar for every published package:
  `platform-<flavor>[-<component>]:<channel | sha-<commit>>`. The name says
  what it is; the tag says which build it is.
- The bare `platform-<flavor>` name is the Compose distribution artifact -
  the one consumers type. Its component images are `platform-<flavor>-app`
  and `platform-<flavor>-init` (e.g. `platform-community-app:next`).
- Tags are single-axis: channels `next`, `main` and `latest` (follows
  `main`), plus immutable `sha-<commit>` tags on the component images.
- Never mix flavors or revisions between the application and initializer
  images inside one stack - schema and client must come from the same build.

## Hard constraints

- **No bind mounts, no `build:`, no profiles.** `docker compose publish`
  rejects bind mounts, and plain `up -d` must start the stack. Configuration
  is inlined via the top-level `configs` element; scripts ship inside
  published images (the Garage provisioning script rides in the initializer
  image as `/garage-init.mjs`).
- Inline `configs.content` is interpolated: `${...}` must be escaped as
  `$${...}`. This is why scripts are baked into images instead of inlined.
- The inline Garage configuration duplicates `docker/garage/garage.toml` -
  keep them in sync.
- `env_file` entries are dropped at publish; operator overrides flow through
  interpolated variables (`${VAR:-default}`), which Compose presents to the
  consumer as a confirmation table on `up`.

## Adding a flavor

1. A flavor is a compile-time package selection (e.g. the database package),
   not a runtime service swap. Add the Docker build path for it first (see
   the note in `docker/Dockerfile` and the matrix comment in the deploy
   workflow).
2. Create `docker/distro/<flavor>/compose.yml`, starting from `community/`.
   Swap only what the flavor changes (e.g. a `postgres` service replacing the
   SQLite volume); keep service names, healthchecks and the variable surface
   consistent.
3. Add the flavor to the matrix in
   `.github/workflows/publish-ghcr-platform.yaml` with its application and
   initializer targets. Everything downstream - images, smoke test, artifact
   publish - is parameterized on `matrix.flavor` and needs no other change.
4. Verify before relying on CI: `docker compose -f
   docker/distro/<flavor>/compose.yml config --quiet`, then publish to a
   scratch registry (ttl.sh works) and boot the artifact from an empty
   directory with `docker compose -f oci://... up -d -y`.

Do not create a flavor folder before the flavor's image build exists - the
convention is the structure; empty placeholders are not.
