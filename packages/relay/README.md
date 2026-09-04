# @chatbotkit-dev/relay

The community default for realtime channels. It mints the websocket address
each side of a channel dials, for any relay that speaks the platform's channel
protocol. It is the public half of a swappable module; a deployment with a
different relay replaces it with a pnpm override:

```yaml
overrides:
  '@chatbotkit-dev/relay': npm:your-relay-implementation@*
```

The override's default export must satisfy `RelayProvider` from
`@chatbotkit-dev/relay-spec`.

## Environment

| Variable     | Purpose                                                        |
| ------------ | -------------------------------------------------------------- |
| `RELAY_URL`  | The origin a relay speaking the channel protocol listens on    |
| `RELAY_PORT` | Set to host the built-in relay in the platform process (below) |
| `RELAY_HOST` | Address the built-in relay binds, default all interfaces       |

The websocket scheme is derived from it - `https` becomes `wss`, `http`
becomes `ws` - so a deployment cannot end up with the two half moved. Unset,
the platform boots but live features (realtime voice, avatars, meeting bots,
streamed calls) refuse at the point of use, and `assertConfigured` fails the
readiness check.

Nothing is read at import.

## The protocol

One route, upgraded to a websocket:

```
/channel/<channelId>?side=<side>[&events=1]
```

A channel pairs exactly two distinct sides. Bytes sent by one side are
delivered to the other; messages sent before the peer arrives are queued (32
messages or 1 MiB per side, oldest dropped first) and flushed when it joins.
A side that passes `events=1` also receives the channel's own lifecycle
messages as JSON: `relay.peer.connected`, `relay.peer.closed`, `relay.ping`
every 30 seconds, `relay.messages.dropped` and `relay.message.rejected`. A
side reconnecting replaces its previous socket; a third side is refused.

## The built-in server

This package is also a relay. `listen()`, which the platform calls once at
server start, hosts a single-node implementation of the protocol inside the
platform process when `RELAY_PORT` is set: `src/server.ts`, on top of the
`ws` package, with channels held in memory, answering `/health` for probes.
The compose stacks set it, so `RELAY_URL=http://localhost:3001` is valid from
the platform process and from a browser on the Docker host alike. It carries
no authentication beyond the channel id, which the platform makes
unguessable; put it behind TLS and a real address when the browser is not on
the host.

`startRelayServer({ port, host })` is exported for embedding it elsewhere.

## Which sides are reachable locally

Realtime voice and avatar sessions work with a local relay: the platform's own
queue handler dials one side and the browser dials the other. Meeting bots and
telephony are dialled in by an external service, so those need a relay that
service can reach.
