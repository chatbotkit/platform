/* eslint-disable import/extensions, import/no-anonymous-default-export */
// @ts-check
import {
  buildCaptureAllSource,
  escapeRegex,
} from '../lib/nextjs.config.rewrites.js'
import { APEXES } from '../config/apexes.js'
import { ORIGIN_HOSTS } from '../config/origins.js'

import fs from 'fs'
import path from 'path'
import { z } from 'zod'

/**
 * Find all app.manifest files recursively in a given directory
 * - ignores node_modules and .git directories
 * - returns an array of absolute paths
 * - missing directory is ignored
 *
 * @param {string} baseDir
 */
function findManifestsRecursively(baseDir) {
  /** @type {string[]} */
  const found = []

  /** @type {Set<string>} */
  const ignore = new Set(['node_modules', '.git'])

  /** @param {string} dir */
  function walk(dir) {
    if (!fs.existsSync(dir)) {
      return
    } // @note missing directory is ignored

    const entries = fs.readdirSync(dir, { withFileTypes: true })

    for (const entry of entries) {
      const entryPath = path.join(dir, entry.name)

      if (entry.isDirectory()) {
        if (!ignore.has(entry.name)) {
          walk(entryPath)
        }

        continue
      }

      if (entry.isFile() && entry.name === 'app.manifest') {
        found.push(entryPath)
      }
    }
  }

  walk(baseDir)

  return found
}

/**
 * Read, parse and normalize manifests for a given root
 * - slug is derived from the manifest's parent directory name
 * - invalid manifests are skipped
 *
 * @param {string} baseDir
 */
function readAppManifestsFrom(baseDir) {
  return findManifestsRecursively(baseDir)
    .map((manifestPath) => {
      try {
        const dir = path.dirname(manifestPath)
        const slug = path.basename(dir) // @todo confirm slug rules for nested paths

        const json = fs.readFileSync(manifestPath, 'utf8')
        const parsed = JSON.parse(json)

        return { slug, ...parsed }
      } catch {
        // @note invalid or unreadable manifest is skipped

        return null
      }
    })
    .filter(Boolean)
}

/**
 * The deployment's app host configuration. APP_APEX controls standalone app
 * subdomains and APP_MAIN_ORIGIN / APP_LABS_ORIGIN control exact shell hosts.
 * Empty means no host-based app routing: every available app serves
 * path-based under /apps.
 */

/**
 * The dict of all app manifests. Manifests carry no host at all: hostnames
 * are pure deployment routing, derived from APP_APEX when it is configured.
 */
const appManifests = z
  .array(
    z.object(
      /** @satisfies {import('@/lib/zod.schema').ZodSchemaFor<import('@/app/apps/app.manifest.d.ts').AppManifest & {slug: string}>} */ ({
        slug: z.string(),
        start: z.string(),
        name: z.string(),
        description: z.string(),
        headline: z.string().optional(),
        icon: z.string().optional(),
        logo: z.string().optional(),
        banner: z.string().optional(),
        order: z.number().optional(),
        category: z
          .enum([
            'main',
            'support',
            'admin',
            'user',
            'developer',
            'help',
            'other',
            'lab',
            'service',
          ])
          .optional(),
        config: z.record(z.any()).optional(),
        global: z.record(z.any()).optional(),
        hidden: z.boolean().optional(),
      })
    )
  )
  .parse([
    // ./app/apps

    ...(fs.existsSync('./app/apps') ? readAppManifestsFrom('./app/apps') : []),
  ])

/**
 * The list of builtin app slugs - every discovered manifest is a builtin app.
 */
const builtinAppSlugs = appManifests.map(({ slug }) => slug)

/**
 * The JSON representation of the app manifests. We also need to set this as an
 * environment variable for the test environment.
 *
 * @todo move this into a lib to be imported and compiled at runtime
 */
const APP_MANIFESTS_JSON = JSON.stringify(appManifests)

if (process.env.NODE_ENV === 'test') {
  process.env.APP_MANIFESTS_JSON = APP_MANIFESTS_JSON
}

// --- host routing -----------------------------------------------------------
// Every rule below exists only when the deployment names the domain it routes.

const shellHostList = [
  ...(ORIGIN_HOSTS.appMain ? [ORIGIN_HOSTS.appMain] : []),
  ...(ORIGIN_HOSTS.appLabs ? [ORIGIN_HOSTS.appLabs] : []),
]

const shellHostPattern = shellHostList.length
  ? `(?<host>(?:${shellHostList.map(escapeRegex).join('|')}))`
  : ''

const appApexHostPattern = APEXES.app
  ? `(?<slug>(?:${builtinAppSlugs.join('|')})).${escapeRegex(
      APEXES.app
    )}`
  : ''

/**
 * The pages every host keeps serving from the platform itself.
 */
const COMMON_EXCLUDES = [
  // @note we want to whitelist common pages

  'redirect',

  'signin',

  'welcome',

  // @note portals can also serve secret callbacks

  'secrets\\/oauth\\/callback',
  'secrets\\/.+?\\/manager\\/authenticate',
  'secrets\\/.+?\\/manager\\/oauth\\/callback',

  // @note we want to whitelist webmanifest

  'app\\.webmanifest',
]

/** @type {import('next').NextConfig} */
export default {
  async rewrites() {
    return {
      beforeFiles: [
        // the app shells

        ...(shellHostPattern
          ? [
              {
                source: buildCaptureAllSource({
                  excludes: [
                    ...COMMON_EXCLUDES,

                    // @note we want to whitelist the builtin apps

                    ...builtinAppSlugs,
                  ],
                }),
                has: [
                  {
                    type: /** @type {'host'} */ ('host'),
                    value: shellHostPattern,
                  },
                ],
                destination: `/apps/:path*`,
              },
              {
                source: '/app.webmanifest',
                has: [
                  {
                    type: /** @type {'host'} */ ('host'),
                    value: shellHostPattern,
                  },
                ],
                destination: `/apps/app.webmanifest`,
              },
              {
                source: `/:path((?:${builtinAppSlugs.join('|')}).*)`,
                has: [
                  {
                    type: /** @type {'host'} */ ('host'),
                    value: shellHostPattern,
                  },
                ],
                destination: '/apps/:path*',
              },
              {
                source: '/',
                has: [
                  {
                    type: /** @type {'host'} */ ('host'),
                    value: shellHostPattern,
                  },
                ],
                destination: '/apps',
              },
            ]
          : []),

        // <slug>.<APP_APEX>

        ...(appApexHostPattern
          ? [
              {
                source: buildCaptureAllSource({
                  excludes: COMMON_EXCLUDES,
                }),
                has: [
                  {
                    type: /** @type {'host'} */ ('host'),
                    value: appApexHostPattern,
                  },
                ],
                destination: `/apps/:slug/:path*`,
              },
              {
                source: '/app.webmanifest',
                has: [
                  {
                    type: /** @type {'host'} */ ('host'),
                    value: appApexHostPattern,
                  },
                ],
                destination: `/apps/app.webmanifest`,
              },
              {
                source: '/',
                has: [
                  {
                    type: /** @type {'host'} */ ('host'),
                    value: appApexHostPattern,
                  },
                ],
                destination: `/apps/:slug`,
              },
            ]
          : []),
      ],

      afterFiles: [],

      fallback: [
        // 404

        // <slug>.<APP_APEX>

        ...(appApexHostPattern
          ? [
              {
                source: '/:path*',
                has: [
                  {
                    type: /** @type {'host'} */ ('host'),
                    value: appApexHostPattern,
                  },
                ],
                destination: `/apps/:slug/404`,
              },
            ]
          : []),
      ],
    }
  },

  async redirects() {
    return [
      // <slug>.<APP_APEX>

      ...(appApexHostPattern
        ? [
            {
              source: '/overview',
              has: [
                {
                  type: /** @type {'host'} */ ('host'),
                  value: appApexHostPattern,
                },
              ],
              destination: '/',
              permanent: false,
            },
          ]
        : []),
    ]
  },

  env: {
    APP_MANIFESTS_JSON,
  },
}
