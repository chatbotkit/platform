/** @jest-environment node */
import { unstable_getResponseFromNextConfig } from 'next/experimental/testing/server'

import spaces from './spaces.config'

describe('space site path routing', () => {
  it.each([
    '/',
    '/index.html',
    '/assets/site.css',
    '/scripts/app.js',
    '/docs/page',
    '/downloads/archive.zip',
    '/favicon.ico',
  ])('serves the public path %s', async (pathname) => {
    const response = await unstable_getResponseFromNextConfig({
      nextConfig: spaces,
      url: `http://localhost:3000${pathname}`,
      headers: { 'x-cbk-space-site': '1' },
    })

    expect(response.headers.get('x-middleware-rewrite')).toBe(
      `http://localhost:3000/api/v1/space/system/site${pathname}`
    )
  })

  it('preserves the framework trailing-slash redirect before rewriting', async () => {
    const response = await unstable_getResponseFromNextConfig({
      nextConfig: spaces,
      url: 'http://localhost:3000/docs/page/',
      headers: { 'x-cbk-space-site': '1' },
    })

    expect(response.status).toBe(308)
    expect(response.headers.get('location')).toBe(
      'http://localhost:3000/docs/page'
    )
  })

  it.each([
    '/_next/static/chunk.js',
    '/api/v1/space/123',
    '/apiary',
    '/oauth/callback',
    '/monitoring-tunnel',
    '/s/example',
    '/apps/demo/icon',
    '/partner/signin/acme',
    '/redirect',
    '/redirect/target',
  ])('preserves the platform route exclusion for %s', async (pathname) => {
    const response = await unstable_getResponseFromNextConfig({
      nextConfig: spaces,
      url: `http://localhost:3000${pathname}`,
      headers: { 'x-cbk-space-site': '1' },
    })

    expect(response.headers.get('x-middleware-rewrite')).toBeNull()
  })

  it.each([{}, { 'x-cbk-portal': '1' }, { 'x-cbk-space-site': 'untrusted' }])(
    'requires the space classification marker: %j',
    async (headers) => {
      const response = await unstable_getResponseFromNextConfig({
        nextConfig: spaces,
        url: 'http://test.space.localhost:3000/',
        headers,
      })

      expect(response.headers.get('x-middleware-rewrite')).toBeNull()
    }
  )
})
