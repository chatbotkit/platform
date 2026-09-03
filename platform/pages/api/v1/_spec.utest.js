import {
  getContextFrontendHost,
  getContextRequestHost,
  getContextRequestProtocol,
} from '@/lib/context.store'
import { getExternalAPIHost } from '@/lib/host'

import handler from './spec'

import fs from 'fs'

jest.mock('fs', () => ({
  readFileSync: jest.fn(),
}))

jest.mock('@/lib/context.store', () => ({
  getContextFrontendHost: jest.fn(),
  getContextRequestHost: jest.fn(),
  getContextRequestProtocol: jest.fn(),
}))

jest.mock('@/lib/method', () => ({
  withGet: (fn) => fn,
}))

describe('/api/v1/spec', () => {
  beforeEach(() => {
    jest.resetAllMocks()
    getContextFrontendHost.mockReturnValue(undefined)
    getContextRequestHost.mockReturnValue(undefined)
    getContextRequestProtocol.mockReturnValue(undefined)
  })

  it('returns spec with server URL using frontend host and context protocol', async () => {
    fs.readFileSync.mockReturnValueOnce(
      JSON.stringify({
        openapi: '3.0.0',
        servers: [{ url: 'https://old.example.com/api/v1' }],
      })
    )
    getContextFrontendHost.mockReturnValueOnce('frontend.example.com')
    getContextRequestHost.mockReturnValueOnce('host.example.com')
    getContextRequestProtocol.mockReturnValueOnce('http')

    const response = await handler(
      new Request('https://ignored.example.com/api/v1/spec')
    )
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.servers).toEqual([
      { url: 'http://frontend.example.com/api/v1' },
    ])
  })

  it('falls back to host header and default https protocol', async () => {
    fs.readFileSync.mockReturnValueOnce(
      JSON.stringify({
        openapi: '3.0.0',
      })
    )
    getContextRequestHost.mockReturnValue('api.example.com')

    const response = await handler(
      new Request('https://ignored.example.com/api/v1/spec')
    )
    const body = await response.json()

    expect(body.servers).toEqual([{ url: 'https://api.example.com/api/v1' }])
  })

  it('uses platform default host when no host headers are available', async () => {
    fs.readFileSync.mockReturnValueOnce(
      JSON.stringify({
        openapi: '3.0.0',
      })
    )

    const response = await handler(
      new Request('https://ignored.example.com/spec')
    )
    const body = await response.json()

    expect(body.servers).toEqual([{ url: `https://${getExternalAPIHost()}/` }])
  })
})
