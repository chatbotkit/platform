/** @jest-environment node */
import { getInternalAssertionHeaders } from '@/lib/header.assertion'
import { runScript } from '@/lib/script'

import './run-proxy'

import http from 'http'
import httpProxy from 'http-proxy'

jest.mock('@/lib/script', () => ({
  runScript: jest.fn(),
  log: jest.fn(),
}))

jest.mock('@/lib/header.assertion', () => ({
  getInternalAssertionHeaders: jest.fn(() => ({})),
}))

jest.mock('http', () => ({
  createServer: jest.fn(),
}))

jest.mock('http-proxy', () => ({
  createProxyServer: jest.fn(),
}))

const { handler } = runScript.mock.calls[0][0]

describe('local proxy frontend host assertion', () => {
  it.each([
    ['quench.qsbx.ai', '8086', 'quench.qsbx.ai:8086'],
    ['quench.qsbx.ai:9000', '8086', 'quench.qsbx.ai:9000'],
    ['::1', '8086', '[::1]:8086'],
    ['[::1]:9000', '8086', '[::1]:9000'],
    ['quench.qsbx.ai', '443', 'quench.qsbx.ai'],
    ['', '8086', ''],
  ])(
    'asserts %s on port %s as %s',
    async (frontendHost, port, expected) => {
      httpProxy.createProxyServer.mockReturnValue({ on: jest.fn() })
      http.createServer.mockReturnValue({ on: jest.fn(), listen: jest.fn() })
      getInternalAssertionHeaders.mockReturnValue({})

      await handler({
        host: 'console.localhost',
        port,
        target: 'http://localhost:8080',
        frontendHost,
      })

      expect(getInternalAssertionHeaders).toHaveBeenCalledWith({
        frontendHost: expected,
      })
    }
  )
})

describe('local proxy host forwarding', () => {
  it.each([
    ['console.localhost', '3000', 'console.localhost:3000'],
    ['console.localhost', '80', 'console.localhost'],
    ['console.localhost:9000', '3000', 'console.localhost:9000'],
    ['::1', '3000', '[::1]:3000'],
    ['[::1]', '3000', '[::1]:3000'],
    ['[::1]:9000', '3000', '[::1]:9000'],
  ])(
    'forwards %s on port %s as %s for HTTP and WebSockets',
    async (host, port, expected) => {
      const proxy = { on: jest.fn() }
      const server = { on: jest.fn(), listen: jest.fn() }

      httpProxy.createProxyServer.mockReturnValue(proxy)
      http.createServer.mockReturnValue(server)
      getInternalAssertionHeaders.mockReturnValue({
        'x-test-assertion': 'value',
      })

      await handler({ host, port, target: 'http://localhost:8080' })

      for (const event of ['proxyReq', 'proxyReqWs']) {
        const listener = proxy.on.mock.calls.find(([name]) => name === event)[1]
        const request = { setHeader: jest.fn() }

        listener(request)

        expect(request.setHeader).toHaveBeenCalledWith('Host', expected)
        expect(request.setHeader).toHaveBeenCalledWith(
          'x-forwarded-host',
          expected
        )
        expect(request.setHeader).toHaveBeenCalledWith(
          'x-test-assertion',
          'value'
        )
      }

      expect(server.listen).toHaveBeenCalledWith(Number(port))
    }
  )
})
