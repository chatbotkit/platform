/** @jest-environment node */
import { unstable_getResponseFromNextConfig } from 'next/experimental/testing/server'

import staticConfig from './static.config'

// @note hostname selection is covered in proxy.utest.js; these tests cover
// the path policy applied after the proxy classifies a static host
describe('static host path routing', () => {
  it.each([
    '/',
    '/signin',
    '/overview',
    '/apps/chat',
    '/unknown/path',
    '/download.zip',
  ])('serves the existing text fallback for %s', async (pathname) => {
    const response = await unstable_getResponseFromNextConfig({
      nextConfig: staticConfig,
      url: `https://static.example.com${pathname}`,
      headers: { 'x-cbk-static': '1' },
    })

    expect(response.headers.get('x-middleware-rewrite')).toBe(
      'https://static.example.com/404.txt'
    )
  })

  it.each([
    '/integrations/widget/v1.js',
    '/integrations/widget/demo/frame',
    '/integrations/widget/demo/test',
    '/api/v1/bot/list',
    '/oauth/callback',
    '/_next/static/chunk.js',
    '/monitoring-tunnel',
    '/s/example',
    '/apps/demo/icon',
    '/partner/signin/acme',
    '/favicon.ico',
    '/assets/site.css',
  ])('preserves the existing exclusion for %s', async (pathname) => {
    const response = await unstable_getResponseFromNextConfig({
      nextConfig: staticConfig,
      url: `https://static.example.com${pathname}`,
      headers: { 'x-cbk-static': '1' },
    })

    expect(response.headers.get('x-middleware-rewrite')).toBeNull()
  })

  it.each([{}, { 'x-cbk-static': 'untrusted' }, { 'x-cbk-app': 'chat' }])(
    'requires the static classification marker: %j',
    async (headers) => {
      const response = await unstable_getResponseFromNextConfig({
        nextConfig: staticConfig,
        url: 'https://static.example.com/signin',
        headers,
      })

      expect(response.headers.get('x-middleware-rewrite')).toBeNull()
    }
  )
})
