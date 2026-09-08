# Changelog

Notable changes to the platform application and shared packages are recorded
here. The release version is defined in the workspace root `package.json`.

## [Unreleased]

## [0.2.0] - 2026-09-08

### Added

- Add the OpenAI `gpt-image-2.5-flare` and `gpt-image-2.5-sunburst` image
  models with their pricing and supported sizes.

### Fixed

- Allow plain-http image, script, style, font, media, frame and worker
  sources in the Content Security Policy when `SITE_URL` itself is served
  without TLS, matching the existing websocket allowance. The app shells on a
  local http deployment load banners from the site or static origin, which the
  browser refused before.

## [0.1.0] - 2026-09-08

### Added

- Establish the first versioned platform source snapshot as the baseline for
  future releases, with `package.json` as the authoritative platform version.
- Validate the release version and changelog on promotion pull requests and
  on every publication run, so a promotion to `main` needs an unused version
  and a dated changelog entry.
- Tag the published images and Compose artifacts of each promotion with the
  release version, alongside the channel and commit tags.
- Create an annotated Git snapshot tag and a GitHub Release with the changelog
  notes and source downloads once every flavor's images carry the version.
- Require protected `main` before the workflow can create a source snapshot.

This release records the existing platform as a baseline. Earlier development
history remains available in Git.
