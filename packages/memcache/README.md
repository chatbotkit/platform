# @chatbotkit-dev/memcache

The community default for the key-value contract in
`@chatbotkit-dev/memcache-spec`, with two backends:

- **Redis**, selected when `REDIS_URL` is set: a shared store over any
  standard Redis (the docker compose at the repository root stands one up),
  so limits, sessions and dedupe markers hold across processes and restarts.
- **In-process**, selected otherwise: a store inside the Node process, so the
  platform runs with no key-value service configured at all.

Both speak the same serialization - a port of what `@upstash/redis` does over
the wire - so a deployment can start on the in-process store, point
`REDIS_URL` at a server when it grows, and install a module override when it
outgrows that, without any caller changing.

## What works

All of it. Caches, sessions, OAuth codes, dedupe markers, idle-conversation
timers, sandbox state, tool environments and channel history run against this
exactly as they run against Redis, including expiry, the key-space scan, and the
two atomic operations that a Redis backend implements with Lua.

Rate limiting works too. `slidingWindow` is on the contract because the platform
did not previously use the store to count requests - it handed the client itself
to `@upstash/ratelimit`, which reaches inside it for `eval` and `evalsha`. The
two-window approximation here is the same one that library uses.

Values round trip through a string, the same way they do over the wire, so a
value read back is a copy and not the object that was stored. That is not
politeness - a shared reference would let one caller's mutation corrupt every
later reader, and the bug would exist only here, vanishing the moment a
deployment installed a real backend.

## What the in-process backend does not do

**It is not shared.** Every process has its own store. A deployment running more
than one instance has as many rate-limit counters as it has instances, and each
of them counts a fraction of the traffic, so limits are effectively multiplied
by the instance count. A restart is a cold start.

**It is bounded.** Ten thousand entries, least-recently-used evicted after that.
A cache tolerates this. A session store under real load does not: a busy hour can
evict a session that has not expired, and the user is signed out.

Both are the same underlying fact - an in-process store is not a database - and
both are why a deployment serving more than one instance, or more than a modest
amount of traffic, should install an override. See `packages/AGENTS.md`.

Neither limitation applies to the Redis backend: set `REDIS_URL` and the
store is shared and as durable as the Redis behind it.

## Configuration

`REDIS_URL` - optional. A `redis://` url; when set, the Redis backend is used
and `assertConfigured` requires the server to answer a PING. When unset, the
in-process backend is used and `assertConfigured` resolves, because there is
nothing to configure - not because nothing is configured.
