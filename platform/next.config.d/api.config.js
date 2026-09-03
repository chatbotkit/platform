/* eslint-disable import/extensions */
// @ts-check
import { hosts } from '../config/hosts.js'
import { apiHostname, siteHostname } from '../config/site.js'
import {
  buildCaptureAllSource,
  buildHostPattern,
} from '../lib/nextjs.config.rewrites.js'

// @note every configured API target is routed unconditionally, mirroring the
// static targets in static.config.js: the hostnames named by HOSTS_CONFIG plus
// the API_URL scalar. An API host that is also a site host - API_URL left at
// its site URL default, or a single-domain HOSTS_CONFIG mapping where the API
// answers under /api on the site host - derives no routing, as the capture-all
// below would otherwise swallow the site itself.

const siteHostnames = new Set([siteHostname, ...hosts.site])

const apiHostnames = [...new Set([...hosts.api, apiHostname])].filter(
  (hostname) => hostname && !siteHostnames.has(hostname)
)

const apiHostPattern = buildHostPattern(apiHostnames, 'host')

const apiHostHas = apiHostPattern
  ? [{ type: /** @type {'host'} */ ('host'), value: apiHostPattern }]
  : []

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
    if (!apiHostPattern) {
      return {
        beforeFiles: [
          // @note the well-known endpoints are not host-gated - they are
          // served on the deployment's own host either way
          ...wellKnownRewrites,
        ],
        afterFiles: [],
        fallback: [],
      }
    }

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

              'oauth\/',

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
    const corsHeaders = [
      {
        key: 'Access-Control-Allow-Origin',
        value: '*',
      },
      {
        key: 'Access-Control-Allow-Methods',
        value: 'GET,POST',
      },
      {
        key: 'Access-Control-Allow-Headers',
        value:
          'X-Requested-With, Accept, Content-Length, Content-Type, Authorization',
      },
    ]

    return [
      // @note browser access to the v1 API is deliberately public. An earlier
      // comment here claimed the opposite - that CORS was restricted to a
      // specified origin - which the `*` below has never matched. It is `*`
      // on purpose: v1 authenticates with a bearer token, not a cookie, and
      // no `Access-Control-Allow-Credentials` is sent, so a foreign origin can
      // only reach the API with a token its own user gave it. Restricting the
      // origin would break every browser SDK caller without protecting
      // anything.

      // @note the clean `/v1` path only exists where the API answers on a host
      // of its own, so this rule is emitted only then
      ...(apiHostPattern
        ? [
            {
              source: '/v1/:path*',
              has: apiHostHas,
              headers: [...corsHeaders],
            },
          ]
        : []),

      // @note `/api/v1` is the path every deployment serves, including a
      // single-domain one with no API subdomain at all, so it carries the CORS
      // headers unconditionally. On a deployment that does have an API host
      // this is the same content already reachable cross-origin through the
      // rule above - the headers follow the endpoint rather than the hostname.
      {
        source: '/api/v1/:path*',
        headers: [...corsHeaders],
      },
    ]
  },
}
