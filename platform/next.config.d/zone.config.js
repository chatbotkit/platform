/* eslint-disable import/no-anonymous-default-export */
// @ts-check

/**
 * Multi-zone routing: proxies paths owned by a secondary zone application
 * (for example a separately deployed marketing site) to its deployment,
 * while this application remains the domain gateway for everything else.
 *
 * The routing table is deployment configuration, not code: it is read from
 * the ZONE_CONFIG environment variable as JSON at build time. Without it the
 * zone is disabled and this application serves every path - so open-source
 * and self-hosted deployments carry no routing table at all.
 *
 * ZONE_CONFIG is an array of zones (all keys optional except origin and hosts):
 *
 *     [{
 *       "origin": "https://zone-app.example.com",
 *       "hosts": ["example.com", "www.example.com"],
 *       "root": true,
 *       "paths": ["/pricing", "/careers"],
 *       "exactPaths": ["/platform"],
 *       "prefixes": ["/media/marketing"],
 *       "exceptions": ["/pricing/internal-tool"],
 *       "aliases": { "/pricing2": "/pricing" },
 *       "assetPrefix": "/zone-static"
 *     }]
 *
 * The previous single-zone object remains accepted as a one-element array.
 *
 * - origin - the zone application's deployment URL; rewrites proxy to it.
 * - hosts - exact hostnames the routing applies to. Any host not listed
 *   (white-label domains, preview URLs) always serves this application.
 * - root - route the bare / to the zone application's homepage.
 * - paths - single top-level segments owned by the zone: the page, its
 *   subtree, and the Pages Router data routes. The rule count stays constant
 *   as paths are added (segments compile into one regex group).
 * - exactPaths - segments owned by the zone for the EXACT path only; their
 *   subroutes stay with this application.
 * - prefixes - multi-segment subtrees owned by the zone while their parent
 *   segment stays shared (asset directories, typically).
 * - exceptions - multi-segment subtrees that stay with THIS application even
 *   though the zone owns their parent segment.
 * - aliases - scratch paths that proxy to a zone page for side-by-side
 *   review before the real path is added to paths.
 * - assetPrefix - the zone application's unique JS/CSS chunk prefix.
 *
 * To take a path back from the zone, remove it from the table and redeploy.
 */

/**
 * @typedef {{
 *   source: string,
 *   destination: string,
 *   has?: {type: 'host', value: string}[],
 *   basePath?: false
 * }} ZoneRewrite
 *
 * @typedef {{
 *   beforeFiles: ZoneRewrite[],
 *   afterFiles: ZoneRewrite[],
 *   fallback: ZoneRewrite[]
 * }} ZoneRewrites
 *
 * @typedef {Omit<import('next').NextConfig, 'rewrites'> & {
 *   index: number,
 *   rewrites(): Promise<ZoneRewrites>
 * }} ZoneConfig
 */

function normalizeZone(config) {
  return {
    origin: config?.origin || '',
    hosts: config?.hosts || [],
    root: !!config?.root,
    paths: config?.paths || [],
    exactPaths: config?.exactPaths || [],
    prefixes: config?.prefixes || [],
    exceptions: config?.exceptions || [],
    aliases: config?.aliases || {},
    assetPrefix: config?.assetPrefix || '/zone-static',
  }
}

// @note a malformed ZONE_CONFIG fails the build loudly on purpose - a routing
// table that silently no-ops would 404 every zone-owned path in production
const zoneConfig = process.env.ZONE_CONFIG
  ? JSON.parse(process.env.ZONE_CONFIG)
  : []
const ZONES = (Array.isArray(zoneConfig) ? zoneConfig : [zoneConfig])
  .map(normalizeZone)
  .filter((zone) => zone.origin && zone.hosts.length)

// --- mechanism -------------------------------------------------------------

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function toSlugGroup(list, kind) {
  return list
    .map((pathname) => {
      const slug = pathname.replace(/^\//, '')

      if (slug === '' || slug.includes('/')) {
        throw new Error(
          `zone.config.js: ${kind} must be single top-level segments, got ${pathname}`
        )
      }

      return escapeRegex(slug)
    })
    .join('|')
}

/**
 * @param {ReturnType<typeof normalizeZone>} ZONE
 */
function makeZoneConfig(ZONE) {
  /**
   * Exception subtrees grouped by the owned segment they carve out of, e.g.
   * '/pricing/internal-tool' -> { pricing: ['internal-tool'] }.
   *
   * @note an exception CANNOT be expressed as a rewrite of the subtree back to
   * itself: Next treats a rewrite whose destination equals its source as a
   * no-op and keeps evaluating the remaining beforeFiles rules, so the owning
   * segment rule matched anyway and the subtree still proxied to the zone. The
   * exclusion has to happen inside the segment rule's own matcher, which is why
   * segments carrying exceptions get dedicated rules below instead of riding
   * the shared group.
   */
  const exceptionsByParent = new Map()

  for (const exception of ZONE.exceptions) {
    if (!/^(\/[\w-]+){2,}$/.test(exception)) {
      throw new Error(
        `zone.config.js: exceptions must be multi-segment paths, got ${exception}`
      )
    }

    const [, parent, ...rest] = exception.split('/')

    if (!ZONE.paths.includes(`/${parent}`)) {
      throw new Error(
        `zone.config.js: exception ${exception} has no owning entry in paths`
      )
    }

    exceptionsByParent.set(parent, [
      ...(exceptionsByParent.get(parent) || []),
      rest.join('/'),
    ])
  }

  const isCarvedOut = (pathname) =>
    exceptionsByParent.has(pathname.replace(/^\//, ''))

  const group = toSlugGroup(
    ZONE.paths.filter((pathname) => !isCarvedOut(pathname)),
    'paths'
  )

  // @note data routes cover every owned segment, carved-out ones included: an
  // exception is served by this application from its own path, so its data
  // requests never take this shape and cannot collide
  const dataGroup = toSlugGroup(ZONE.paths, 'paths')

  const exactGroup = toSlugGroup(ZONE.exactPaths, 'exactPaths')

  const hostPattern = `(?:${ZONE.hosts.map(escapeRegex).join('|')})`

  /** @type {{type: 'host', value: string}[]} */
  const has = [{ type: 'host', value: hostPattern }]

  const ZONE_ORIGIN = ZONE.origin

  /** @type {ZoneConfig} */
  return {
    // @note config merge order: after llms.config (index 0, markdown Accept
    // negotiation must stay first) but before the alphabetical rest - zone
    // rules must win over any beforeFiles rewrite another config defines for a
    // zone-owned path
    index: 1,

    async rewrites() {
      const prefixRules = ZONE.prefixes.map((prefix) => {
        if (!/^(\/[\w-]+){2,}$/.test(prefix)) {
          throw new Error(
            `zone.config.js: prefixes must be multi-segment paths, got ${prefix}`
          )
        }

        return {
          source: `${prefix}/:path*`,
          destination: `${ZONE_ORIGIN}${prefix}/:path*`,
          has,
          basePath: /** @type {false} */ (false),
        }
      })

      // @note segments carrying exceptions get their own page + subtree rules,
      // the subtree matcher excluding the carved-out children with a negative
      // lookahead so those requests fall through to this application's own
      // filesystem and afterFiles rewrites (see exceptionsByParent above)
      const carvedRules = [...exceptionsByParent.entries()].flatMap(
        ([parent, children]) => {
          const exclusion = children.map(escapeRegex).join('|')

          return [
            {
              source: `/${parent}`,
              destination: `${ZONE_ORIGIN}/${parent}`,
              has,
              basePath: /** @type {false} */ (false),
            },
            {
              source: `/${parent}/:path((?!(?:${exclusion})(?:/|$)).*)`,
              destination: `${ZONE_ORIGIN}/${parent}/:path`,
              has,
              basePath: /** @type {false} */ (false),
            },
          ]
        }
      )

      const rootRules = ZONE.root
        ? [
            {
              source: '/',
              destination: `${ZONE_ORIGIN}/`,
              has,
              basePath: /** @type {false} */ (false),
            },
            {
              source: '/_next/data/:buildId/index.json',
              destination: `${ZONE_ORIGIN}/_next/data/:buildId/index.json`,
              has,
              basePath: /** @type {false} */ (false),
            },
          ]
        : []

      const aliasRules = Object.entries(ZONE.aliases).flatMap(
        ([alias, target]) => [
          {
            source: alias,
            destination: `${ZONE_ORIGIN}${target}`,
            has,
            basePath: /** @type {false} */ (false),
          },
          {
            source: `${alias}/:path*`,
            destination: `${ZONE_ORIGIN}${target}/:path*`,
            has,
            basePath: /** @type {false} */ (false),
          },
        ]
      )

      // @note exact-match rules cover only the bare segment and its data route -
      // no subtree rule, so subroutes fall through to this application
      const exactRules = exactGroup
        ? [
            {
              source: `/:slug(${exactGroup})`,
              destination: `${ZONE_ORIGIN}/:slug`,
              has,
              basePath: /** @type {false} */ (false),
            },
            {
              source: `/_next/data/:buildId/:file((?:${exactGroup})\\.json)`,
              destination: `${ZONE_ORIGIN}/_next/data/:buildId/:file`,
              has,
              basePath: /** @type {false} */ (false),
            },
          ]
        : []

      return {
        beforeFiles: [
          ...carvedRules,
          ...rootRules,
          ...prefixRules,
          ...aliasRules,
          ...exactRules,
          ...(group
            ? [
                {
                  source: `/:slug(${group})`,
                  destination: `${ZONE_ORIGIN}/:slug`,
                  has,
                  basePath: /** @type {false} */ (false),
                },
                {
                  source: `/:slug(${group})/:path*`,
                  destination: `${ZONE_ORIGIN}/:slug/:path*`,
                  has,
                  basePath: /** @type {false} */ (false),
                },
              ]
            : []),
          ...(dataGroup
            ? [
                {
                  source: `/_next/data/:buildId/:file((?:${dataGroup})\\.json)`,
                  destination: `${ZONE_ORIGIN}/_next/data/:buildId/:file`,
                  has,
                  basePath: /** @type {false} */ (false),
                },
                {
                  source: `/_next/data/:buildId/:slug(${dataGroup})/:path*`,
                  destination: `${ZONE_ORIGIN}/_next/data/:buildId/:slug/:path*`,
                  has,
                  basePath: /** @type {false} */ (false),
                },
              ]
            : []),
          {
            source: `${ZONE.assetPrefix}/:path*`,
            destination: `${ZONE_ORIGIN}${ZONE.assetPrefix}/:path*`,
            has,
            basePath: /** @type {false} */ (false),
          },
        ],

        afterFiles: [],

        fallback: [],
      }
    },
  }
}

const zoneConfigs = ZONES.map(makeZoneConfig)

/** @type {ZoneConfig} */
export default {
  index: 1,

  async rewrites() {
    const rewrites = await Promise.all(
      zoneConfigs.map((config) => config.rewrites())
    )

    return {
      beforeFiles: rewrites.flatMap((rules) => rules.beforeFiles),
      afterFiles: rewrites.flatMap((rules) => rules.afterFiles),
      fallback: rewrites.flatMap((rules) => rules.fallback),
    }
  },
}
