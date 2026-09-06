/* eslint-disable import/extensions */
// @ts-check
import {
  buildCaptureAllSource,
  escapeRegex,
} from '../lib/nextjs.config.rewrites.js'

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
 * The dict of all app manifests. Manifests carry no host at all: hostnames
 * are derived from runtime deployment settings in config/apps.ts.
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

// @note proxy.ts assigns these markers using runtime host configuration;
// the app catalogue and path rules remain part of the build

const builtinAppPattern = builtinAppSlugs.map(escapeRegex).join('|')

const shellHas = [
  {
    type: /** @type {'header'} */ ('header'),
    key: 'x-cbk-app-shell',
    value: '1',
  },
]
const appHas = [
  {
    type: /** @type {'header'} */ ('header'),
    key: 'x-cbk-app',
    value: `(?<slug>${builtinAppPattern})`,
  },
]

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
        // the main and labs shells
        {
          source: buildCaptureAllSource({
            excludes: [...COMMON_EXCLUDES, ...builtinAppSlugs],
          }),
          has: shellHas,
          destination: '/apps/:path*',
        },
        {
          source: '/app.webmanifest',
          has: shellHas,
          destination: '/apps/app.webmanifest',
        },
        ...(builtinAppPattern
          ? [
              {
                source: `/:path((?:${builtinAppPattern}).*)`,
                has: shellHas,
                destination: '/apps/:path*',
              },
            ]
          : []),
        // @note keep the root after the catch-all so it cannot prefix /apps twice
        {
          source: '/',
          has: shellHas,
          destination: '/apps',
        },

        // registered app subdomains
        ...(builtinAppPattern
          ? [
              {
                source: buildCaptureAllSource({ excludes: COMMON_EXCLUDES }),
                has: appHas,
                destination: '/apps/:slug/:path*',
              },
              {
                source: '/app.webmanifest',
                has: appHas,
                destination: '/apps/app.webmanifest',
              },
              {
                source: '/',
                has: appHas,
                destination: '/apps/:slug',
              },
            ]
          : []),
      ],
      afterFiles: [],
      fallback: builtinAppPattern
        ? [{ source: '/:path*', has: appHas, destination: '/apps/:slug/404' }]
        : [],
    }
  },

  env: { APP_MANIFESTS_JSON },
}
