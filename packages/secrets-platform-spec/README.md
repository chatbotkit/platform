# @chatbotkit-dev/secrets-platform-spec

The **contract** for the platform secret catalogue. Types only, for now.

This package is deliberately separate from
[`@chatbotkit-dev/secrets-platform`](../secrets-platform) because that package is
*swappable*: a deployment replaces it with its own catalogue through a pnpm
override. An implementation cannot import the package it replaces, so the shared
contract has to live somewhere that is never overridden.

That is this package. Both the community catalogue and any private
implementation depend on it, and so can any consumer that wants to reason about
catalogue entries without depending on a particular catalogue.

## What belongs here

The types every implementation must satisfy, and nothing else. No data, so it
can be published alongside the platform without disclosing anything, and no
behaviour, so an implementation is free to satisfy the contract however it
likes.

A conformance suite would be the one justified exception later: tests an
implementation runs against itself, for the behaviour types cannot express.

## Versioning

Because implementations are checked against it, changing this contract breaks
every implementation at once. With a single private implementation that is
cheap. If third party implementations ever exist, this package becomes a public
API and needs a deprecation policy.
