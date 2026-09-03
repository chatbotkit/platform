test('exposes "TextEncoder"', () => {
  expect(globalThis).toHaveProperty('TextEncoder')
  expect(() => new TextEncoder()).not.toThrow()
  expect(Buffer.from(new TextEncoder().encode('hello'))).toEqual(
    Buffer.from(new Uint8Array([104, 101, 108, 108, 111]))
  )
})

test('exposes "TextDecoder"', () => {
  expect(globalThis).toHaveProperty('TextDecoder')
  expect(() => new TextDecoder()).not.toThrow()
  expect(
    new TextDecoder().decode(new Uint8Array([104, 101, 108, 108, 111]))
  ).toBe('hello')
})

test('exposes "CryptoKey"', () => {
  expect(globalThis).toHaveProperty('CryptoKey')
  expect(typeof CryptoKey).toBe('function')
})

test('exposes an AbortSignal compatible with fetch', async () => {
  const controller = new AbortController()

  const response = await globalThis.fetch('data:text/plain,hello', {
    signal: controller.signal,
  })

  await expect(response.text()).resolves.toBe('hello')
})

test('propagates an aborted jsdom signal through fetch', async () => {
  const controller = new AbortController()
  const reason = new Error('stopped')

  controller.abort(reason)

  await expect(
    globalThis.fetch('data:text/plain,hello', {
      signal: controller.signal,
    })
  ).rejects.toBe(reason)
})

test('exposes a Request compatible with jsdom AbortSignal', () => {
  const controller = new AbortController()
  const reason = new Error('stopped')

  const request = new Request('https://example.com', {
    signal: controller.signal,
  })

  expect(request.signal.aborted).toBe(false)

  controller.abort(reason)

  expect(request.signal.aborted).toBe(true)
  expect(request.signal.reason).toBe(reason)
})

test('exposes an AbortSignal compatible with DOM event targets', () => {
  const controller = new AbortController()
  let calls = 0

  window.addEventListener('abort-signal-test', () => calls++, {
    signal: controller.signal,
  })

  controller.abort()
  window.dispatchEvent(new Event('abort-signal-test'))

  expect(calls).toBe(0)
})
