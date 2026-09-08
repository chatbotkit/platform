# Changelog

Notable changes to the platform application and shared packages are recorded
here. The release version is defined in the workspace root `package.json`.

## [Unreleased]

## [0.1.0] - 2026-09-08

### Added

- Establish the first versioned platform source snapshot as the baseline for
  future releases.
- Add release metadata validation and annotated Git snapshot tags, with
  `package.json` as the authoritative platform version.
- Automatically create and push the source snapshot when changes merge into
  `main`, with release metadata checks before promotion.
- Publish a GitHub Release for each snapshot with its matching changelog notes
  and GitHub's source archive downloads.
- Require protected `main` and successful verification of the exact release
  commit before the workflow can create a source snapshot.

This release records the existing platform as a baseline. Earlier development
history remains available in Git.
