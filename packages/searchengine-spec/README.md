# @chatbotkit-dev/searchengine-spec

The **contract** for searching the web. Types only.

Separate from [`@chatbotkit-dev/searchengine`](../searchengine) because that
package is swappable: a deployment replaces it with its own implementation
through a pnpm override, and an implementation cannot import the package it
replaces.

## Results are read by a model

That single fact shapes the contract, so it is stated here rather than left to
each implementation to rediscover.

Titles and descriptions are **plain text**. Engines routinely wrap the matched
terms in `<strong>`, which a model gains nothing from and pays for in tokens, so
stripping it is the implementation's job and not the caller's.

Results arrive in the **engine's own relevance order** and the platform
preserves it. Ranking is most of what an engine does; a caller that re-sorted
would be discarding it.

## Failure is empty, misconfiguration is loud

`search` returns no results when a query cannot be served, rather than throwing.
The caller is in the middle of a conversation, where "I found nothing" is
something a model can work with and an exception is not.

That does not hide a deployment with no key set, because the two are separated:
`assertConfigured` fails the build for a credential that was never configured,
and `search` degrades for a request that failed today.

## What is deliberately absent

**Result counts, pagination, locale, freshness and safe search.** Every engine
has some of these and no two agree on their names or their units. None has a
caller in the platform today, and a contract that guessed would be fixing one
vendor's spelling as the neutral one.

**Anything about the index.** `SearchResultType` names a kind of result - news,
images - not a particular corpus. An engine without a separate news index
answers from what it has rather than refusing, because the caller asked for
recent articles and not for a shard.
