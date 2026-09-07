/** @jest-environment node */
import { unstable_getResponseFromNextConfig } from 'next/experimental/testing/server'

import apiConfig from './api.config'

// @note runtime hostname and clean /v1 CORS selection are covered in proxy
// tests; this config retains the API path rules and unconditional /api/v1 CORS
describe('API path routing', () => {
  it.each([
    ['/', '/api/'],
    ['/v1/probe', '/api/v1/probe'],
    ['/health', '/api/health'],
  ])('rewrites %s on a classified API host', async (pathname, destination) => {
    const response = await unstable_getResponseFromNextConfig({
      nextConfig: apiConfig,
      url: `https://api.example.com${pathname}`,
      headers: { 'x-cbk-api': '1' },
    })

    expect(response.headers.get('x-middleware-rewrite')).toBe(
      `https://api.example.com${destination}`
    )
  })

  it.each([{}, { 'x-cbk-api': 'untrusted' }, { 'x-cbk-static': '1' }])(
    'requires the API classification marker: %j',
    async (headers) => {
      const response = await unstable_getResponseFromNextConfig({
        nextConfig: apiConfig,
        url: 'https://api.example.com/v1/probe',
        headers,
      })

      expect(response.headers.get('x-middleware-rewrite')).toBeNull()
      expect(response.headers.get('access-control-allow-origin')).toBeNull()
    }
  )

  it.each(['api-catalog', 'microsoft-identity-association.json'])(
    'serves the well-known %s without an API host',
    async (path) => {
      const response = await unstable_getResponseFromNextConfig({
        nextConfig: apiConfig,
        url: `https://example.com/.well-known/${path}`,
      })

      expect(response.headers.get('x-middleware-rewrite')).toBe(
        `https://example.com/api/.well-known/${path}`
      )
    }
  )

  it.each(['/api/v1', '/api/v1/probe'])(
    'keeps public, credential-free CORS on %s for every host',
    async (pathname) => {
      const response = await unstable_getResponseFromNextConfig({
        nextConfig: apiConfig,
        url: `https://example.com${pathname}`,
      })

      expect(response.headers.get('access-control-allow-origin')).toBe('*')
      expect(response.headers.get('access-control-allow-methods')).toBe(
        'GET,POST'
      )
      expect(response.headers.get('access-control-allow-headers')).toBe(
        'X-Requested-With, Accept, Content-Length, Content-Type, Authorization'
      )
      expect(
        response.headers.get('access-control-allow-credentials')
      ).toBeNull()
    }
  )
})
