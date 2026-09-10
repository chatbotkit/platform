import {
  getContextAPIHost,
  getContextFrontendHost,
  getContextRequestHost,
  getContextRequestProtocol,
} from '@/lib/context.store'
import { getExternalAPIHost, getExternalFrontendHostURL } from '@/lib/host'

import handler from './spec'

import fs from 'fs'

jest.mock('fs', () => ({
  readFileSync: jest.fn(),
}))

jest.mock('@/lib/context.store', () => ({
  getContextAPIHost: jest.fn(),
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

  it.each([
    ['api.mapped.localhost:4300', '/v1/spec', '/v1'],
    ['api.mapped.localhost:4300', '/api/v1/spec', '/v1'],
    ['mapped.localhost:4300', '/v1/spec', '/api/v1'],
  ])('advertises the mapped API %s from %s', async (apiHost, pathname, apiPath) => {
    fs.readFileSync.mockReturnValueOnce(JSON.stringify({ openapi: '3.0.0' }))
    getContextFrontendHost.mockReturnValue('mapped.localhost:4300')
    getContextRequestHost.mockReturnValue(apiHost)
    getContextAPIHost.mockReturnValue(apiHost)

    const response = await handler(new Request(`http://${apiHost}${pathname}`))
    const body = await response.json()

    expect(body.servers).toEqual([{ url: `http://${apiHost}${apiPath}` }])
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

  it('stays on http for a loopback deployment without a request scheme', async () => {
    fs.readFileSync.mockReturnValueOnce(JSON.stringify({ openapi: '3.0.0' }))
    getContextRequestHost.mockReturnValue('cbk.localhost:3000')

    const response = await handler(
      new Request('http://ignored.example.com/api/v1/spec')
    )
    const body = await response.json()

    expect(body.servers).toEqual([{ url: 'http://cbk.localhost:3000/api/v1' }])
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

    // @note the scheme follows the deployment for its own host
    expect(body.servers).toEqual([
      { url: getExternalFrontendHostURL('/', getExternalAPIHost()) },
    ])
  })
})
