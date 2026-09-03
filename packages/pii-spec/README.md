# @chatbotkit-dev/pii-spec

The **contract** for detecting and redacting personally identifiable
information. Types only.

Separate from [`@chatbotkit-dev/pii`](../pii) because that package is swappable:
a deployment replaces it with its own implementation through a pnpm override,
and an implementation cannot import the package it replaces.

## The round trip

The platform sends text out — to a model, an agent, a third party — and gets a
reply back. `detectPiiEntities` finds the personal data,
`getSafeTextAndEntities` swaps each value for an opaque token, and
`unredactEntities` puts the values back when the reply returns.

Two properties of that round trip belong to the caller rather than to an
implementation, so the contract states them. Tokens are **stable** — one value
gets one token throughout a call, so a name mentioned twice does not come back
as two people. And redaction is **reversible** — the user reads their own text
back rather than a token.

`redactEntities` exists alongside `getSafeTextAndEntities` because the two work
from different things. The latter works from offsets into one specific string;
the former works from the values, so it can be applied to text *derived* from
the original, where those offsets no longer mean anything.

## What is deliberately absent

What counts as personal data. There is no enumeration of entity types here:
`type` is an open string because every detector classifies with its own
taxonomy, and the platform only carries the value into the token. Likewise
`scoreThreshold` is a number on the detector's own confidence scale, with the
default supplied by whichever implementation is installed.
