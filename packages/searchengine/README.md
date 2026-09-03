# @chatbotkit-dev/searchengine

The **community search engine**. It has no index, so it finds nothing.

That is not a stub standing in for a missing implementation, it is the honest
one. Searching the web needs an index and a vendor to run it, and this package
must run with nothing configured.

Finding nothing is a shape the caller already handles: the contract in
[`@chatbotkit-dev/searchengine-spec`](../searchengine-spec) treats an empty
result set as a normal answer, because a failed upstream query returns one too.
So a deployment with no engine installed behaves exactly as it would without
this module at all - an agent asked to search reports that it found nothing, and
the conversation continues.

The alternative would be to throw, which puts an error in front of a user for a
capability their deployment never claimed to have. `assertConfigured` resolves
for the same reason: installing no search engine is a choice, not a
misconfiguration.

## Providing your own

Replace this package at install time with one satisfying
[`@chatbotkit-dev/searchengine-spec`](../searchengine-spec):

```yaml
# Root pnpm-workspace.yaml
overrides:
  '@chatbotkit-dev/searchengine': npm:your-searchengine-implementation@*
```

An implementation owns which index is consulted, how the query is scored, what
credential it needs and what a result costs. The spec package states the three
properties the platform depends on regardless: results are plain text, they keep
the engine's order, and a failed query is empty rather than thrown.
