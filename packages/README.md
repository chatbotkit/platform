# Packages

This directory contains the public libraries and module contracts used by the
platform application. Some pairs define a swappable module: a `*-spec` package
owns the contract, while its sibling package supplies the default implementation
that a standalone checkout runs.

Every package must build, test and document its configuration without relying on
code outside this repository. Package-specific behavior and environment
variables are documented in each package's README. The shared authoring and
verification rules live in [AGENTS.md](./AGENTS.md).
