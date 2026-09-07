/* eslint-disable import/extensions */
// @ts-check
import { buildCaptureAllSource } from '../lib/nextjs.config.rewrites.js'

// @note the proxy selects dedicated API hosts at startup, excluding site hosts
const apiHostHas = [
  {
    type: /** @type {'header'} */ ('header'),
    key: 'x-cbk-api',
    value: '1',
  },
]

// @note browser API access uses bearer tokens and deliberately allows any
// origin without credentials; the proxy shares this policy for clean /v1 paths
export const apiCorsHeaders = [
  { key: 'Access-Control-Allow-Origin', value: '*' },
  { key: 'Access-Control-Allow-Methods', value: 'GET,POST' },
  {
    key: 'Access-Control-Allow-Headers',
    value:
      'X-Requested-With, Accept, Content-Length, Content-Type, Authorization',
  },
]

// @note well-known endpoints that are not related to OAuth or the API catalog
// are rewritten here. They are deliberately NOT host-gated: they are served on
// the deployment's own host whether or not the API has a subdomain of its own.

const wellKnownRewrites = [
  {
    source: '/.well-known/api-catalog',
    destination: '/api/.well-known/api-catalog',
  },
  {
    source: '/.well-known/microsoft-identity-association.json',
    destination: '/api/.well-known/microsoft-identity-association.json',
  },
]

/** @type {import('next').NextConfig} */
export default {
  async rewrites() {
    return {
      beforeFiles: [
        ...wellKnownRewrites,

        // @note this rewrite captures all API requests and routes them to the
        // api handler, where they are processed by the appropriate route
        // handler. This allows us to keep all API logic in one place and avoid
        // having to define separate rewrites for each API route. The rewrite
        // excludes certain paths that are either whitelisted or handled by
        // other rewrites.
        {
          source: buildCaptureAllSource({
            excludes: [
              // @note we want to whitelist common pages

              'redirect',

              // @note well-known endpoints are rewritten by oauth.config.js

              '\\.well-known',

              // @note oauth endpoints are rewritten by oauth.config.js

              'oauth/',

              // @note portals can also serve secret callbacks

              'secrets\\/oauth\\/callback',
              'secrets\\/.+?\\/manager\\/authenticate',
              'secrets\\/.+?\\/manager\\/oauth\\/callback',

              // @note short links handled by short.config.js

              's\\/',
            ],
            standardExcludes: ['api'],
          }),
          has: apiHostHas,
          destination: '/api/:path*',
        },
        {
          source: '/',
          has: apiHostHas,
          destination: '/api',
        },
      ],

      afterFiles: [],

      fallback: [
        // 404

        {
          source: '/:path*',
          has: apiHostHas,
          destination: '/api/404',
        },
      ],
    }
  },

  async headers() {
    return [
      // @note this path is available on every host; host-dependent /v1 CORS
      // is applied by the proxy because configured headers run before it
      {
        source: '/api/v1/:path*',
        headers: [...apiCorsHeaders],
      },
    ]
  },
}
