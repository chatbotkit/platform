// @note the relay itself: a single-node implementation of the channel
// protocol this package addresses, channels held in memory. Two sides dial
// `/channel/<id>?side=<side>` and bytes are copied between them; see the
// README for the protocol.
//
// It runs inside the platform process - `listen` in ./index starts it on
// RELAY_PORT - because that is the one long-lived process a single-node
// deployment has. A restart drops every channel, but a restart drops the
// platform's own side of each channel anyway.
//
// The channel id is the only credential. The platform makes it unguessable;
// a deployment whose browsers are not on the host puts this behind TLS and a
// reachable RELAY_URL.

import debug from '@chatbotkit-dev/debug'

import { createServer, type IncomingMessage, type ServerResponse } from 'http'
import type { Duplex } from 'stream'

import WebSocket, { WebSocketServer } from 'ws'

export const RELAY_MAX_PENDING_MESSAGES_PER_SIDE = 32
export const RELAY_MAX_PENDING_BYTES_PER_SIDE = 1024 * 1024
export const RELAY_MAX_MESSAGE_BYTES = 1024 * 1024
export const RELAY_HEARTBEAT_INTERVAL_MS = 30_000

const CHANNEL_ID_PATTERN = /^[a-zA-Z0-9_-]{32,256}$/
const SIDE_PATTERN = /^[a-zA-Z0-9_-]{1,64}$/

type Side = string

interface PendingMessage {
  data: Buffer
  binary: boolean
}

type CloseDetails = Record<string, unknown> & {
  code?: number
  reason?: string
}

class RelayChannel {
  readonly sockets = new Map<Side, WebSocket>()

  readonly subscribers = new Set<Side>()

  readonly pending = new Map<Side, PendingMessage[]>()

  private heartbeat: ReturnType<typeof setInterval>

  constructor(
    readonly id: string,
    private readonly onEmpty: (channel: RelayChannel) => void
  ) {
    this.heartbeat = setInterval(() => this.ping(), RELAY_HEARTBEAT_INTERVAL_MS)
    this.heartbeat.unref()
  }

  get empty(): boolean {
    return this.sockets.size === 0 && this.pending.size === 0
  }

  private peerSide(side: Side): Side | undefined {
    return [...this.sockets.keys()].find((candidate) => candidate !== side)
  }

  private event(
    targetSide: Side,
    type: string,
    side: Side,
    details: Record<string, unknown> = {}
  ): void {
    const socket = this.sockets.get(targetSide)

    if (!this.subscribers.has(targetSide) || socket?.readyState !== WebSocket.OPEN) {
      return
    }

    socket.send(JSON.stringify({ type, side, ...details }))
  }

  private ping(): void {
    for (const side of this.subscribers) {
      const socket = this.sockets.get(side)

      if (socket?.readyState === WebSocket.OPEN) {
        socket.send(
          JSON.stringify({ type: 'relay.ping', timestamp: Date.now() })
        )
      }
    }
  }

  join(side: Side, socket: WebSocket, subscribed: boolean): void {
    const existing = this.sockets.get(side)

    if (existing) {
      this.leave(side, existing, { code: 1006, reason: 'replaced' })

      if (existing.readyState !== WebSocket.CLOSED) {
        existing.close(1001, 'replaced')
      }
    }

    this.sockets.set(side, socket)

    if (subscribed) {
      this.subscribers.add(side)
    }

    // @note deferred past the upgrade so the handshake reaches the client in
    // its own write; a peer that only attaches listeners after `open` would
    // otherwise miss frames coalesced with it
    setImmediate(() => {
      if (this.sockets.get(side) !== socket) {
        return
      }

      const peerSide = this.peerSide(side)

      if (peerSide) {
        this.event(peerSide, 'relay.peer.connected', side)
        this.event(side, 'relay.peer.connected', peerSide)
      }

      for (const [senderSide, messages] of this.pending) {
        if (senderSide === side) {
          continue
        }

        for (const { data, binary } of messages) {
          socket.send(data, { binary })
        }

        this.pending.delete(senderSide)
      }
    })
  }

  message(side: Side, data: Buffer, binary: boolean): void {
    if (data.byteLength > RELAY_MAX_MESSAGE_BYTES) {
      this.event(side, 'relay.message.rejected', side, { reason: 'too_large' })

      return
    }

    const peerSide = this.peerSide(side)
    const peer = peerSide ? this.sockets.get(peerSide) : undefined

    if (peer?.readyState === WebSocket.OPEN) {
      peer.send(data, { binary })

      return
    }

    const messages = this.pending.get(side) || []
    let overflowed = false

    messages.push({ data, binary })

    let totalBytes = messages.reduce((sum, m) => sum + m.data.byteLength, 0)

    while (messages.length > RELAY_MAX_PENDING_MESSAGES_PER_SIDE) {
      totalBytes -= (messages.shift() as PendingMessage).data.byteLength
      overflowed = true
    }

    while (totalBytes > RELAY_MAX_PENDING_BYTES_PER_SIDE && messages.length > 0) {
      totalBytes -= (messages.shift() as PendingMessage).data.byteLength
      overflowed = true
    }

    this.pending.set(side, messages)

    if (overflowed) {
      this.event(side, 'relay.messages.dropped', side)
    }
  }

  leave(side: Side, socket: WebSocket, closeDetails: CloseDetails): void {
    if (this.sockets.get(side) !== socket) {
      return
    }

    this.sockets.delete(side)
    this.subscribers.delete(side)

    const peerSide = this.peerSide(side)

    if (!peerSide) {
      this.pending.clear()
      this.settle()

      return
    }

    const peer = this.sockets.get(peerSide)

    if (peer?.readyState !== WebSocket.OPEN) {
      this.settle()

      return
    }

    // @note a side subscribed to events stays open across its peer going away,
    // so it can wait for the reconnect; one that is not is closed with it
    if (this.subscribers.has(peerSide)) {
      this.event(peerSide, 'relay.peer.closed', side, closeDetails)

      return
    }

    this.sockets.delete(peerSide)
    this.pending.delete(peerSide)
    peer.close(1000, 'peer closed')
    this.settle()
  }

  private settle(): void {
    if (this.empty) {
      clearInterval(this.heartbeat)
      this.onEmpty(this)
    }
  }
}

function parseChannelId(pathname: string): string | null {
  const match = pathname.match(/^\/channel\/([^/]+)$/)

  return match ? decodeURIComponent(match[1]) : null
}

function json(response: ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, { 'Content-Type': 'application/json' })
  response.end(JSON.stringify(body))
}

function refuse(
  socket: Duplex,
  status: number,
  code: string,
  message: string
): void {
  const body = JSON.stringify({ success: false, code, message })

  socket.write(
    `HTTP/1.1 ${status} ${message}\r\nContent-Type: application/json\r\nContent-Length: ${Buffer.byteLength(body)}\r\nConnection: close\r\n\r\n${body}`
  )
  socket.destroy()
}

export interface RelayServerOptions {
  port: number
  host?: string
}

export interface RelayServer {
  /** The bound port, useful when 0 was requested. */
  readonly port: number
  /** Channels currently held. */
  readonly channels: number
  close(): Promise<void>
}

/**
 * Starts the relay on the given port and resolves once it listens.
 */
export async function startRelayServer({
  port,
  host = '0.0.0.0',
}: RelayServerOptions): Promise<RelayServer> {
  const channels = new Map<string, RelayChannel>()

  const server = createServer(
    (request: IncomingMessage, response: ServerResponse) => {
      const url = new URL(request.url || '/', 'http://relay')

      if (url.pathname === '/health') {
        json(response, 200, { success: true, channels: channels.size })

        return
      }

      const channelId = parseChannelId(url.pathname)

      if (!channelId) {
        json(response, 404, {
          success: false,
          code: 'NOT_FOUND',
          message: 'Route not found',
        })

        return
      }

      if (!CHANNEL_ID_PATTERN.test(channelId)) {
        json(response, 400, {
          success: false,
          code: 'INVALID_CHANNEL_ID',
          message: 'Invalid channel id',
        })

        return
      }

      json(response, 426, {
        success: false,
        code: 'EXPECTED_WEBSOCKET',
        message: 'Expected WebSocket upgrade',
      })
    }
  )

  const wss = new WebSocketServer({
    noServer: true,
    maxPayload: RELAY_MAX_MESSAGE_BYTES * 2,
  })

  server.on('upgrade', (request, socket, head) => {
    const url = new URL(request.url || '/', 'http://relay')
    const channelId = parseChannelId(url.pathname)

    if (!channelId) {
      return refuse(socket, 404, 'NOT_FOUND', 'Route not found')
    }

    if (!CHANNEL_ID_PATTERN.test(channelId)) {
      return refuse(socket, 400, 'INVALID_CHANNEL_ID', 'Invalid channel id')
    }

    const side = url.searchParams.get('side')

    if (!side || !SIDE_PATTERN.test(side)) {
      return refuse(socket, 400, 'INVALID_SIDE', 'Invalid or missing side')
    }

    const channel = channels.get(channelId)
    const existing = channel?.sockets.get(side)

    if (existing?.readyState === WebSocket.OPEN) {
      return refuse(
        socket,
        409,
        'SIDE_ALREADY_CONNECTED',
        'Side already connected'
      )
    }

    if (channel && !existing && channel.sockets.size >= 2) {
      return refuse(
        socket,
        409,
        'CHANNEL_FULL',
        'Relay channel already has two connected sides'
      )
    }

    wss.handleUpgrade(request, socket, head, (ws) => {
      let target = channels.get(channelId)

      if (!target) {
        target = new RelayChannel(channelId, (emptied) => {
          if (channels.get(channelId) === emptied) {
            channels.delete(channelId)
          }
        })

        channels.set(channelId, target)
      }

      const current = target

      current.join(side, ws, url.searchParams.get('events') === '1')

      ws.on('message', (data, binary) => {
        current.message(
          side,
          Buffer.isBuffer(data)
            ? data
            : Array.isArray(data)
              ? Buffer.concat(data)
              : Buffer.from(data),
          binary
        )
      })

      ws.on('close', (code, reason) => {
        current.leave(side, ws, { code, reason: reason.toString() })
      })

      ws.on('error', (error) => {
        debug('relay socket error', { channelId, side, error })
      })
    })
  })

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject)
    server.listen(port, host, () => {
      server.off('error', reject)
      resolve()
    })
  })

  const address = server.address()
  const boundPort = typeof address === 'object' && address ? address.port : port

  debug(`relay listening on ${host}:${boundPort}`)

  return {
    get port() {
      return boundPort
    },
    get channels() {
      return channels.size
    },
    close() {
      for (const client of wss.clients) {
        client.terminate()
      }

      return new Promise<void>((resolve) => {
        wss.close(() => server.close(() => resolve()))
      })
    },
  }
}
