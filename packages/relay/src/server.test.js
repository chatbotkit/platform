import WebSocket from 'ws'

import { RELAY_MAX_PENDING_MESSAGES_PER_SIDE, startRelayServer } from './server'

// @note the channel protocol from the two sides' point of view, against a
// live listener on an ephemeral port: what a browser and the runner see, not
// the class behind it.

const CHANNEL = 'realtime-' + 'a'.repeat(30)

let server
let sockets

// @note a socket refused at the handshake emits an error when terminated
// during cleanup; without a listener that is an unhandled event
function track(ws) {
  ws.on('error', () => {})
  sockets.push(ws)

  return ws
}

function dial(side) {
  return track(
    new WebSocket(`ws://127.0.0.1:${server.port}/channel/${CHANNEL}?side=${side}`)
  )
}

function connect(side, options = {}) {
  const url = new URL(`/channel/${CHANNEL}`, `ws://127.0.0.1:${server.port}`)

  url.searchParams.set('side', side)

  if (options.events) {
    url.searchParams.set('events', '1')
  }

  const ws = track(new WebSocket(url.toString()))

  return new Promise((resolve, reject) => {
    ws.once('open', () => resolve(ws))
    ws.once('unexpected-response', (_, response) => {
      let body = ''

      response.on('data', (chunk) => {
        body += chunk
      })
      response.on('end', () =>
        reject(Object.assign(new Error(body), { status: response.statusCode }))
      )
    })
    ws.once('error', reject)
  })
}

function nextMessage(ws) {
  return new Promise((resolve) =>
    ws.once('message', (data) => resolve(data.toString()))
  )
}

function collect(ws, count) {
  const out = []

  return new Promise((resolve) => {
    ws.on('message', (data) => {
      out.push(data.toString())

      if (out.length === count) {
        resolve(out)
      }
    })
  })
}

beforeEach(async () => {
  sockets = []
  server = await startRelayServer({ port: 0, host: '127.0.0.1' })
})

afterEach(async () => {
  for (const ws of sockets) {
    ws.terminate()
  }

  await server.close()
})

describe('relay server', () => {
  it('copies bytes between two sides', async () => {
    const a = await connect('client')
    const b = await connect('runner')

    const fromA = nextMessage(b)
    const fromB = nextMessage(a)

    a.send('hello')
    b.send('world')

    expect(await fromA).toBe('hello')
    expect(await fromB).toBe('world')
  })

  it('queues messages sent before the peer joins and flushes them in order', async () => {
    const a = await connect('client')

    a.send('one')
    a.send('two')

    const b = dial('runner')

    expect(await collect(b, 2)).toEqual(['one', 'two'])
  })

  it('keeps only the latest pending messages after overflow', async () => {
    const a = await connect('client')

    for (let i = 0; i < RELAY_MAX_PENDING_MESSAGES_PER_SIDE + 8; i++) {
      a.send(`msg-${i}`)
    }

    const b = dial('runner')

    const received = await collect(b, RELAY_MAX_PENDING_MESSAGES_PER_SIDE)

    expect(received[0]).toBe('msg-8')
    expect(received.at(-1)).toBe(
      `msg-${RELAY_MAX_PENDING_MESSAGES_PER_SIDE + 7}`
    )
  })

  it('tells a subscribed side about its peer connecting and closing', async () => {
    const a = await connect('runner', { events: true })

    const connected = nextMessage(a)
    const b = await connect('client')

    expect(JSON.parse(await connected)).toEqual({
      type: 'relay.peer.connected',
      side: 'client',
    })

    const closed = nextMessage(a)

    b.close(1000, 'bye')

    expect(JSON.parse(await closed)).toEqual({
      type: 'relay.peer.closed',
      side: 'client',
      code: 1000,
      reason: 'bye',
    })

    expect(a.readyState).toBe(WebSocket.OPEN)
  })

  it('closes an unsubscribed side with its peer', async () => {
    const a = await connect('runner')
    const b = await connect('client')

    const closed = new Promise((resolve) => a.once('close', resolve))

    b.close(1000, 'bye')

    expect(await closed).toBe(1000)
  })

  it('lets a side reconnect and replaces its old socket', async () => {
    const a = await connect('runner', { events: true })
    const b1 = await connect('client')

    await nextMessage(a)

    b1.terminate()

    await nextMessage(a)

    const reconnected = nextMessage(a)
    const b2 = await connect('client')

    expect(JSON.parse(await reconnected).type).toBe('relay.peer.connected')

    const fromB2 = nextMessage(a)

    b2.send('back')

    expect(await fromB2).toBe('back')
  })

  it('refuses a third side', async () => {
    await connect('runner')
    await connect('client')

    await expect(connect('observer')).rejects.toMatchObject({ status: 409 })
  })

  it('refuses a side that is already connected', async () => {
    await connect('runner')

    await expect(connect('runner')).rejects.toMatchObject({ status: 409 })
  })

  it('validates the channel id and side', async () => {
    await expect(
      new Promise((resolve, reject) => {
        const ws = track(
          new WebSocket(`ws://127.0.0.1:${server.port}/channel/short?side=client`)
        )

        ws.once('unexpected-response', (_, response) =>
          reject(Object.assign(new Error(), { status: response.statusCode }))
        )
        ws.once('open', resolve)
      })
    ).rejects.toMatchObject({ status: 400 })

    await expect(connect('bad side')).rejects.toMatchObject({ status: 400 })
  })

  it('answers plain requests with what it expected', async () => {
    const base = `http://127.0.0.1:${server.port}`

    expect((await fetch(`${base}/health`)).status).toBe(200)
    expect((await fetch(`${base}/nope`)).status).toBe(404)
    expect((await fetch(`${base}/channel/short`)).status).toBe(400)
    expect((await fetch(`${base}/channel/${CHANNEL}`)).status).toBe(426)
  })

  it('forgets a channel once both sides are gone', async () => {
    const a = await connect('runner')
    const b = await connect('client')

    expect(server.channels).toBe(1)

    const closed = new Promise((resolve) => a.once('close', resolve))

    b.close()

    await closed

    expect(server.channels).toBe(0)
  })
})
