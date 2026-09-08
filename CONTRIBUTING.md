# Contributing

Thank you for helping improve CBK.

Contributions are welcome. By submitting a contribution for inclusion in CBK,
you agree to license it under the Apache License 2.0 and confirm that you have
the right to submit it.

Start with [Architecture](./docs/architecture.md). It explains the two things
every contributor needs before touching the tree: how the swappable module
packages and the application fit together, and the conventions - the two
routers, the `lib/` naming scheme, new TypeScript source with new JavaScript
tests - that are not self-evident from the directory layout.

## Before starting

- Search existing issues and pull requests before beginning work.
- Open an issue before a large feature, architectural, or behavioral change -
  the issue is where the shape gets agreed, the pull request is where it gets
  reviewed.
- Report security vulnerabilities privately, per [SECURITY.md](./SECURITY.md),
  never through the issue tracker.
- Keep changes focused. One concern per pull request; unrelated cleanup slows
  the review of both.

## Branches

Open contributor pull requests against `next`, the development branch. The
`main` branch is the stable release branch and accepts reviewed promotions from
`next`, not direct feature pull requests.

## Development setup

Node.js 24.20 and pnpm 11.24 or later, plus Git LFS - binary assets (images,
fonts, sample documents) are LFS pointers, so run `git lfs install` before
cloning or `git lfs pull` afterwards.

```sh
pnpm install
```

To run the application:

```sh
cd platform
cp .env.example .env
pnpm db:push                         # provision the local SQLite database
pnpm dev                             # → http://127.0.0.1:8080
```

A fresh checkout boots after copying `.env.example`, with no vendor or
deployment-specific configuration: the module defaults are a working
vendor-free deployment (email prints to the console, caching is in-process,
queue delivery is immediate and non-durable, and there is no plan or billing
concept). The one default that needs a backing service to do anything is
storage. The public module speaks the S3 protocol, so file flows refuse at the
point of use until the storage block in `.env.example` is uncommented (it
points at the Compose `garage` service: `docker compose up garage
garage-init`). Anything that needs credentials documents them in its own
package README.

Alternatively, `docker compose up` at this root is the complete default stack -
the dev server with SQLite, Redis, Qdrant and Garage - `docker compose up redis
qdrant garage garage-init` starts the backing services only for host-side
development, and `docker compose --profile distro up --build platform` builds
and serves the full compiled stack.

## Quality checks

The CI quality gate (`.github/workflows/_verify.yaml`) runs on every pull
request, and it is exactly what a fresh checkout gets:

```sh
# every package
pnpm install --frozen-lockfile
pnpm audit --prod --audit-level low
pnpm turbo run build --continue --filter='!@chatbotkit/platform'
pnpm turbo run lint  --continue --filter='!@chatbotkit/platform'
pnpm turbo run check --continue --filter='!@chatbotkit/platform'
pnpm turbo run test  --continue --filter='!@chatbotkit/platform'

# the application - from .env.example and a fresh SQLite database
cd platform
pnpm lint                                 # eslint across app and scripts
pnpm check                                # typescript, no emit
pnpm test                                 # unit suite with coverage
```

The package steps exclude the application only because it has its own steps:
the gate copies `.env.example`, pushes an empty SQLite database through the
community database module, generates the client, and then lints, type-checks
and tests the application against that clean-clone module graph.

**Not in the gate: the application build, a formatting check, and the
self-host smoke test.** The image-publication workflow builds and smoke-tests
the application on pushes to `next`; if your change touches build
configuration, run `pnpm build` locally before you push.

Two more practical consequences. If you change any `package.json`, refresh
`pnpm-lock.yaml` in the same commit or the frozen install fails. And new
behavior or a bug fix should come with a test - unit tests are `*.utest.js` or
`*.utest.jsx` co-located with their source in the application and `*.test.js`
in packages, written in JavaScript by convention (see `docs/architecture.md`
for why).

Inside `platform/`, the narrower loops are `pnpm check`, `pnpm lint`,
`pnpm test:unit path/to/file.utest.js`, and `pnpm storybook`.

## Source releases

The workspace root `package.json` holds the platform release version. It covers
the application and shared packages as one source snapshot; individual package
versions and Studio's version are independent. The workspace stays private.

Add notable changes to [CHANGELOG.md](./CHANGELOG.md) under `Unreleased`, using
`Added`, `Changed`, `Fixed`, `Removed`, or `Security` as appropriate. Include any
required database migrations, configuration changes, and upgrade steps.

To prepare a release:

1. Choose the next `major.minor.patch` version and update the root `package.json`.
   Use patch releases for compatible fixes, minor releases for features, and
   major releases for breaking changes after 1.0. Before 1.0, use minor releases
   for breaking changes and call them out in the notes.
2. Move the accumulated notes into `## [VERSION] - YYYY-MM-DD`, keeping an empty
   `## [Unreleased]` section above it.
3. Complete the quality checks for the changes being released. The
   **Validate release metadata** job of the publication workflow checks the
   version and changelog on every push to `next` as an early warning; it does
   not hold back `next` images.
4. Commit and push the release changes to `next`, then open the promotion pull
   request to `main`. The **Check source release** job checks the changelog and
   rejects a version whose tag already exists.
5. Merge the promotion pull request. The **Publish GHCR Platform** workflow
   publishes the images and Compose artifacts for that merge commit under the
   `v` + `VERSION` tag alongside the channel tags, and only once every flavor
   carries it does the workflow create and push an annotated
   `platform/vVERSION` tag, using the changelog entry as its annotation. It then
   publishes a GitHub Release titled `Platform VERSION` against that tag, with
   the same changelog entry as its release notes. The release page includes
   GitHub's source ZIP and tarball downloads.

Every promotion to `main` needs an unused version and dated changelog entry.
Version bumps and notes are prepared in the source before promotion; CI does
not write commits back to `main` or `next`. Configure **Check source release**
as a required check in the repository's branch rules to enforce it before merge.

The promotion pull request inherits the verification of its `next` head, which
runs on the push to `next`. The merge commit carries the same tree, so the
release does not verify it again; branch protection is what makes that hold,
and the release job refuses to run on an unprotected `main`. A promotion that
changes no build input still gets version-tagged images: the `main` channel
images were built from the same build inputs, so they are carried under the
version tag without minting new channel or commit tags.

The same flow applies when a subtree manager pushes this workspace to `next`
and opens the promotion pull request: the workflow travels inside this
workspace's `.github` directory and runs in the destination repository.

For a failed run, rerun **Publish GHCR Platform** on the failed run, or
dispatch it on `main`. Retries are safe: already published images are found by
their `sha-` tag and retagged, an existing annotated tag on the same commit is
accepted, and if the tag was pushed but release creation failed, the retry
creates the missing GitHub Release. An already published release with
matching title and notes is accepted; conflicting release metadata fails
without overwriting it. A tag pointing elsewhere fails the release and is never
moved. A manual dispatch uses the selected `main` commit; rerun the original
run to retry an older merge.

All release validation, tagging and publication logic lives in the GitHub
workflows and the shared `release-metadata` action under `.github/actions`.
There are no local release scripts or package commands. The source downloads
contain no installed dependencies, compiled application, databases, or container
images; those are the version-tagged images and Compose artifacts. Only the
release job holds a repository write token.

Workflow checks govern tags created by this automation. To restrict direct tag
pushes as well, configure a repository tag ruleset for `platform/v*`, limiting
creation to the release identity and preventing updates and deletion. Branch
protection alone does not enforce those tag restrictions.

## Pull requests

- Explain the problem and the outcome, not just the diff.
- Link the relevant issue or discussion.
- Describe how the change was verified.
- Call out schema changes, compatibility concerns, security implications, and
  follow-up work explicitly.
- Never include credentials, production data, customer information, or
  generated build artifacts.

## Conduct

Participation is covered by [CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md).
