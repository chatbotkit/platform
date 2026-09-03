import type { AppManifest } from '@/app/apps/app.manifest'
import { appApex, portalApex } from '@/config/apexes'
import { appLabsHost, appMainHost } from '@/config/origins'
import { siteUrl, staticUrl } from '@/config/site'
import type { ZodSchemaFor } from '@/lib/zod.schema'

import { z } from 'zod'

/**
 * @note that the types deliberately start with a colon to avoid conflicts with
 * possible subdomains
 */
export const MAIN_TYPE = ':main' // the main app shell
export const LABS_TYPE = ':labs' // the labs app shell
export const BUILTIN_TYPE = ':builtin' // builtin apps provided by the platform
export const PORTAL_TYPE = ':portal' // the portal app
export const CUSTOM_TYPE = ':custom' // custom apps created by users (not used)

/**
 * List of all app types. These are used throughout the codebase to identify
 * different types of apps but also represent app slugs for the root apps of the
 * same type.
 */
export const APP_TYPES: readonly (
  | typeof MAIN_TYPE
  | typeof LABS_TYPE
  | typeof BUILTIN_TYPE
  | typeof PORTAL_TYPE
  | typeof CUSTOM_TYPE
)[] = Object.freeze([
  MAIN_TYPE,
  LABS_TYPE,
  BUILTIN_TYPE,
  PORTAL_TYPE,
  CUSTOM_TYPE,
])

/**
 * Validate environment variables.
 *
 * @note APP_MANIFESTS_JSON is never set by hand - Next computes and inlines it
 * from the app.manifest files. Outside a Next build (graphql codegen, scripts,
 * any tool that imports the graphql schema) it is absent, which just means no
 * builtin apps are known; that must not fail the import.
 */
const env = z
  .object({
    APP_MANIFESTS_JSON: z.string().default('[]'),
  })
  .parse({
    APP_MANIFESTS_JSON: process.env.APP_MANIFESTS_JSON,
  })

const shellHosts = {
  [MAIN_TYPE]: appMainHost,
  [LABS_TYPE]: appLabsHost,
}

/**
 * Load apps from the environment. This should be passed from the apps nextjs
 * config file, which discovers the manifests. It is not a perfect solution
 * but it works.
 *
 * @note manifests carry no host - the hostname is pure deployment routing,
 * derived here from APP_APEX when configured and absent (path-served) when it
 * is not.
 */
export const apps = z
  .array(
    z.object({
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
    } satisfies ZodSchemaFor<AppManifest & { slug: string }>)
  )
  .parse(JSON.parse(env.APP_MANIFESTS_JSON))
  .map(({ start, ...rest }) => ({
    ...rest,

    host: appApex
      ? `${rest.slug}.${appApex}`
      : (undefined as string | undefined),

    ...(rest.banner
      ? { banner: new URL(rest.banner, staticUrl).href }
      : undefined),

    start: new URL(start, siteUrl).href,
  }))

/**
 * The shared shell configuration - the platform's own curation of which
 * builtin apps a shell surfaces and how. This is platform product, not
 * deployment data: every app referenced here ships with the platform.
 */
const shellConfig = {
  apps: {
    chat: {
      category: 'main',
      order: 1,
      models: true,
      sources: {
        datasets: true,
        skillsets: true,
        spaces: true,
        mcps: true,
        web: true,
        creative: true,
      },
      save: true,
    },
    task: {
      category: 'main',
      order: 2,
    },
    '8ea0112f': {
      // memories
      category: 'user',
      order: 3,
    },
    '9f3b5e2a': {
      // spaces
      category: 'user',
      order: 4,
    },
    d6d4b7eb: {
      // about me
      category: 'user',
    },
    usage: {
      category: 'admin',
    },
    e083ca0f: {
      // customize
      category: 'other',
    },
  },

  layout: {
    sidebar: {
      icon: '/icon.png;/icon.png#filter=invertGrayscale',

      maxItemsBeforeCollapse: 3,
    },
  },
}

const shellDescription =
  'Discover a range of cutting-edge conversational AI apps, each uniquely designed and powered by the advanced capabilities of the platform.'

/**
 * Add the main app shell. It always exists - hostless deployments serve it
 * path-based - and picks up a hostname when the table names one.
 */
apps.push({
  slug: MAIN_TYPE,
  host: shellHosts[MAIN_TYPE],
  start: new URL('/', siteUrl).href,
  name: 'Apps',
  description: shellDescription,
  config: shellConfig,
})

/**
 * Add the labs shell - surfaces the builtin apps categorized as labs. Exists
 * only when the table names a hostname for it.
 */
if (shellHosts[LABS_TYPE]) {
  apps.push({
    slug: LABS_TYPE,
    host: shellHosts[LABS_TYPE],
    start: new URL('/', siteUrl).href,
    name: 'Apps',
    description: shellDescription,
    config: {
      apps: {
        ...Object.fromEntries(
          apps
            .filter(({ category }) => category === 'lab')
            .map(({ slug }) => [slug, { category: 'main' }])
        ),
      },

      layout: shellConfig.layout,
    },
  })
}

/**
 * Create a list of app slugs.
 */
export const appSlugs = Object.freeze(apps.map(({ slug }) => slug))

/**
 * Create a list of app hostnames. Hostless apps (a deployment with no
 * deployment hostname configuration) simply do not appear - nothing matches
 * by host.
 */
export const appHostnames = Object.freeze(
  apps.map(({ host }) => host).filter((host): host is string => !!host)
)

/**
 * Create a mapping of app slugs to url.
 */
export const appSlugToUrlMap = Object.freeze({
  ...Object.fromEntries(
    apps.map(({ slug, start }) => {
      return [slug, start]
    })
  ),
})

/**
 * Create a mapping of app slug to hostname. Hostless entries are omitted so
 * host matching never compares against nothing.
 */
export const appSlugToHostnameMap: Readonly<Record<string, string>> =
  Object.freeze({
    ...Object.fromEntries(
      apps
        .filter(({ host }) => !!host)
        .map(({ slug, host }) => {
          return [slug, host]
        })
    ),

    // @note these are special slugs that map to the deployment's own
    // hostnames - present only when the deployment configures them

    ...(shellHosts[MAIN_TYPE] ? { [MAIN_TYPE]: shellHosts[MAIN_TYPE] } : {}),
    ...(appApex ? { [BUILTIN_TYPE]: appApex } : {}),
    ...(portalApex ? { [PORTAL_TYPE]: portalApex } : {}),

    // @note CUSTOM_TYPE does not have a specific hostname
  })
