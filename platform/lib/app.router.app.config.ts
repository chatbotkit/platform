import '@/lib/scope.server'

import { redirect } from 'next/navigation'

import type { UnwrapPromise } from '@chatbotkit-dev/typescript-utils/promise'

import { appLabsHost, appMainHost } from '@/config/origins'

import prisma from '@/prisma/client'
import type { Portal } from '@/prisma/types'
import { PortalConfig } from '@/prisma/zod'

import {
  getAppConfig,
  getPublicConfig,
  getShadowConfig,
  getUserConfig,
} from '@/lib/app.config.helpers'
import {
  getAppConfigByHostname,
  getAppConfigBySlug,
  getAppGlobalByHostname,
  getAppGlobalBySlug,
  getAppManifestByHostname,
  getAppManifestBySlug,
  getAppSlugByHostname,
  isAppHostname,
} from '@/lib/app.helpers'
import { getSoftAppSession } from '@/lib/app.session'
import {
  getContextFrontendHost,
  getContextRequestHost,
} from '@/lib/context.store'
import debug from '@/lib/debug'
import { merge, omit } from '@/lib/object'
import { getPortalGlobalConfig } from '@/lib/portal.config'
import { getPortalSlugFromHostname } from '@/lib/portal.hostname'
import type { ZodObject, ZodRawShape } from '@/lib/zod.schema'
import z, { partialObjectParseAsync, tryParseAsync } from '@/lib/zod.schema'

/**
 * The exact hosts the app shells answer on, derived from their configured
 * origins - empty when no shell has an origin.
 */
const shellHostnames = [appMainHost, appLabsHost].filter(
  (hostname): hostname is string => !!hostname
)

function getContextAppHostname(): string | null {
  const hosts = [getContextFrontendHost(), getContextRequestHost()].filter(
    (host): host is string => !!host
  )

  // @note a custom frontend domain is public identity while the request host
  // retains the platform app or portal hostname used for internal routing
  return hosts.find((host) => isAppHostname(host)) || null
}

async function getPortalBySlug(slug: string): Promise<Portal | null> {
  const portal = await prisma.portal.findUnique({
    where: {
      slug: slug,
    },

    cacheStrategy: {
      ttl: 60,
      swr: 60,
    },
  })

  return portal
}

/**
 * This function extracts the public configuration for the app or portal. The
 * public configuration includes basic information without any sensitive data,
 * such as specific app configurations or user-related data.
 *
 * **NOTE:** This method does not require any form of authentication. The data
 * returned is considered to be public information.
 *
 * @todo take into account the individual app global configuration in the
 * app.manifest file
 */
export async function getPublicAppConfig(): Promise<ReturnType<
  typeof getPublicConfig
> | null> {
  debug(`getting public app config`).log(
    'app.router.app.config.getPublicAppConfig'
  )

  // app hostname
  {
    const host = getContextAppHostname()

    if (host && isAppHostname(host)) {
      debug(`getting public app config for app hostname`, { host }).log(
        'app.router.app.config.getPublicAppConfig'
      )

      // portals
      {
        const portalSlug = getPortalSlugFromHostname(host)

        if (portalSlug) {
          debug(`getting public app config for portal with slug`, {
            portalSlug,
          }).log('app.router.app.config.getPublicAppConfig')

          const portal = await getPortalBySlug(portalSlug)

          if (portal) {
            const portalConfig = await tryParseAsync(
              PortalConfig,
              portal.config
            )

            if (portalConfig) {
              // get the portal global config but filter out apps that are not
              // relevant to the current configuration

              const globalConfig =
                (await getPortalGlobalConfig(portal)) || {}

              // combine everything together to create the final configuration

              const totalConfig = merge(
                // lower priority

                getShadowConfig(globalConfig as Record<string, unknown>) || {},
                globalConfig,

                // higher priority

                getShadowConfig(portalConfig as Record<string, unknown>) || {},
                portalConfig,

                // highest priority

                {}
              )

              // extract just the public configuration

              const config = getPublicConfig(totalConfig)

              // return the public configuration

              return config
            }
          }

          return null
        }
      }

      // the app shell hosts (from the deployment's hostname table)
      {
        if (shellHostnames.includes(host)) {
          debug(`getting public app config for an app shell host`, {
            host,
          }).log('app.router.app.config.getPublicAppConfig')

          const appManifest = getAppManifestByHostname(host)

          if (appManifest) {
            const config = getPublicConfig(appManifest)

            return config
          }
        }
      }

      // hosted apps under the standalone app apex
      {
        const appSlug = getAppSlugByHostname(host)

        if (appSlug) {
          debug(`getting public app config for app with slug`, { appSlug }).log(
            'app.router.app.config.getPublicAppConfig'
          )

          const appManifest = getAppManifestBySlug(appSlug)
          const appGlobal = getAppGlobalBySlug(appSlug)
          const appConfig = getAppConfigBySlug(appSlug)

          if (appManifest) {
            const config = getPublicConfig(
              merge(
                // lower priority

                appManifest,

                // higher priority

                appGlobal || {},

                // higher priority

                appConfig || {}
              )
            )

            return config
          }

          return null
        }
      }

      return null
    }
  }

  // dashboard
  {
    debug(`getting public app config for dashboard`).log(
      'app.router.app.config.getPublicAppConfig'
    )

    const config = {}

    return config
  }

  return null
}

/**
 * This function retrieves the user-specific configuration for a given app. The
 * user-specific configuration will include app-specific settings, user
 * preferences, and any other information that is relevant to the user within
 * the context of the app. Null is returned if the user is not authenticated or
 * if the user configuration cannot be found therefore considered to be not
 * authorized to access the app.
 */
export async function getUserAppConfig<T extends ZodRawShape>(
  app: string,
  schema?: ZodObject<T>
): Promise<UnwrapPromise<ReturnType<typeof partialObjectParseAsync<T>>>> {
  debug(`getting user app config for app`, { app }).log(
    'app.router.app.config.getUserAppConfig'
  )

  let thisSchema = schema || z.object({} as T)

  thisSchema = thisSchema.passthrough()

  // app hostname
  {
    const host = getContextAppHostname()

    if (host) {
      debug(`resolved request host`, { host }).log(
        'app.router.app.config.getUserAppConfig'
      )

      if (isAppHostname(host)) {
        debug(`getting user app config for app hostname`, { app }).log(
          'app.router.app.config.getUserAppConfig'
        )

        // portals
        {
          const portalSlug = getPortalSlugFromHostname(host)

          if (portalSlug) {
            debug(`getting user app config for portal with slug`, {
              portalSlug,
              app,
            }).log('app.router.app.config.getUserAppConfig')

            const portal = await getPortalBySlug(portalSlug)

            debug(`fetched portal by slug`, { portal }).log(
              'app.router.app.config.getUserAppConfig'
            )

            if (portal) {
              const portalConfig = await tryParseAsync(
                PortalConfig,
                portal.config
              )

              if (portalConfig) {
                const session = await getSoftAppSession(app)

                // check if the user is authenticated, if the session is not
                // available, then redirect to the signin page

                if (!session) {
                  debug(`no session found, redirecting to signin`).log(
                    'app.router.app.config.getUserAppConfig'
                  )

                  redirect(`/signin`) // @todo add the current pathname somehow
                }

                // check if the user is authorized to access the portal, if the
                // portalId within the session options does not match the portal
                // being accessed, then redirect to the signin page

                if (session.options.portalId !== portal.id) {
                  debug(
                    `user not authorized for this portal, redirecting to signin`
                  ).log('app.router.app.config.getUserAppConfig')

                  redirect(`/signin`) // @todo add the current pathname somehow
                }

                // get the portal global config but filter out apps that are not
                // relevant to the current configuration

                const portalGlobalConfig =
                  (await getPortalGlobalConfig(portal)) || {}

                // merge the global config with the portal config to make the
                // combined configuration

                const combinedPortalConfig = merge(
                  // lower priority

                  portalGlobalConfig,

                  // higher priority

                  portalConfig,

                  // highest priority

                  {}
                )

                // obtain the user-specific configuration based on the session
                // options, which includes the portalUserId

                const userPortalConfig = getUserConfig(
                  {
                    id: session.options?.portalUserId,
                    email: session.options?.portalUserId,
                  },
                  combinedPortalConfig
                )

                // this is not an expected case, but if the user configuration
                // is not found, we redirect to the signin page

                if (!userPortalConfig) {
                  redirect(`/signin`) // @todo add the current pathname somehow
                }

                // combine everything together to create the total configuration

                const totalPortalConfig = merge(
                  // lower priority

                  combinedPortalConfig,

                  // higher priority

                  userPortalConfig,

                  // highest priority

                  {}
                )

                // check if the app configuration exists, if not, return null

                if (!app.startsWith(':')) {
                  // @note apps that start with : are considered to be special
                  // and always accessible, such as :index

                  if (!totalPortalConfig.apps || !totalPortalConfig.apps[app]) {
                    redirect(`/signin`) // @todo add the current pathname somehow
                  }
                }

                // extract just the app

                const appConfig = app.startsWith(':')
                  ? {}
                  : getAppConfig(totalPortalConfig, app)

                if (appConfig) {
                  debug(`extracted app config`, { appConfig }).log(
                    'app.router.app.config.getUserAppConfig'
                  )

                  const config = merge(
                    // lower priority

                    getAppGlobalBySlug(app) || {},

                    getPublicConfig(
                      omit(totalPortalConfig, [
                        'name',
                        'headline',
                        'description',
                      ])
                    ),

                    // higher priority

                    appConfig,

                    // highest priority

                    {}
                  )

                  debug(`returning user app config`, { config }).log(
                    'app.router.app.config.getUserAppConfig'
                  )

                  return await partialObjectParseAsync(thisSchema, config)
                }
              }
            }

            redirect('/signin') // @todo add the current pathname somehow
          }
        }

        // the app shell hosts (from the deployment's hostname table)
        {
          if (shellHostnames.includes(host)) {
            debug(`getting user app config for an app shell host`, {
              host,
              app,
            }).log('app.router.app.config.getUserAppConfig')

            const appManifest = getAppManifestByHostname(host)
            const appGlobal = getAppGlobalByHostname(host)
            const appConfig = getAppConfigByHostname(host)

            if (appManifest) {
              const totalConfig = merge(
                // lowest priority

                appManifest,

                // lower priority

                appGlobal || {},

                // higher priority

                appConfig || {},

                // highest priority

                {}
              )

              const thisAppConfig = app.startsWith(':')
                ? {}
                : getAppConfig(totalConfig, app)

              const config = merge(
                // lower priority

                getAppGlobalBySlug(app) || {},

                // middle priority

                getPublicConfig(totalConfig),

                // higher priority

                thisAppConfig || {},

                // highest priority

                {}
              )

              return await partialObjectParseAsync(thisSchema, config)
            }
          }
        }

        // hosted apps under the standalone app apex
        {
          const appSlug = getAppSlugByHostname(host)

          if (appSlug) {
            debug(`getting user app config for app with slug`, {
              appSlug,
              app,
            }).log('app.router.app.config.getUserAppConfig')

            const appManifest = getAppManifestBySlug(appSlug)
            const appGlobal = getAppGlobalBySlug(appSlug)
            const appConfig = getAppConfigBySlug(appSlug)

            if (appManifest) {
              const session = await getSoftAppSession(app)

              if (!session) {
                debug(`no session found, redirecting to signin`).log(
                  'app.router.app.config.getUserAppConfig'
                )

                redirect(`/signin`) // @todo add the current pathname somehow
              }

              const config = merge(
                // lowest priority

                appManifest,

                // lower priority

                appGlobal || {},

                // higher priority

                appConfig || {},

                // highest priority

                {}
              )

              return await partialObjectParseAsync(thisSchema, config)
            }
          }
        }

        debug(`no matching app hostname found, redirecting to signin`).log(
          'app.router.app.config.getUserAppConfig'
        )

        redirect('/signin') // @todo add the current pathname somehow
      }
    }
  }

  // dashboard
  {
    debug(`getting user app config for dashboard`, { app }).log(
      'app.router.app.config.getUserAppConfig'
    )

    const session = await getSoftAppSession(app)

    // check if the user is authenticated, if the session is not available, then
    // redirect to the signin page

    if (!session) {
      debug(`no session found, redirecting to signin`).log(
        'app.router.app.config.getUserAppConfig'
      )

      redirect(`/signin`) // @todo add the current pathname somehow
    }

    const config = merge(
      // lower priority

      getAppGlobalBySlug(app) || {},

      // @note surface the requested app's own manifest config (e.g. chat's
      // `models`/`sources`/`save`) so its server actions see the same config on
      // the dashboard host that they already get on the app's own hostname,
      // where `getPublicConfig` below would otherwise expose only public display
      // fields. Kept below the dashboard defaults so `apps`/`layout` still win.

      getAppConfigBySlug(app) || {},

      // higher priority

      {
        // this is the default list of apps available in the dashboard

        apps: {
          chat: getPublicConfig(getAppManifestBySlug('chat') || {}),
          task: getPublicConfig(getAppManifestBySlug('task') || {}),
          inbox: getPublicConfig(getAppManifestBySlug('inbox') || {}),
          code: getPublicConfig(getAppManifestBySlug('code') || {}),
          usage: getPublicConfig(getAppManifestBySlug('usage') || {}),
          e083ca0f: getPublicConfig(getAppManifestBySlug('e083ca0f') || {}),
        },

        // @note give the dashboard a sidebar so apps render the app navigation
        // chrome - matching the apps.chatbotkit.com host config. Without this
        // only apps that pass explicit sidebarItems (e.g. inbox) show a sidebar.
        // The App layout still hides it automatically when embedded.
        layout: {
          sidebar: {
            icon: '/icon.png;/icon.png#filter=invertGrayscale',

            maxItemsBeforeCollapse: 3,
          },
        },
      }
    )

    return await partialObjectParseAsync(thisSchema, config)
  }

  debug(`no matching configuration found, redirecting to signin`).log(
    'app.router.app.config.getUserAppConfig'
  )

  redirect('/signin') // @todo add the current pathname somehow
}
