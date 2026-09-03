import { getAppGlobalBySlug, getAppManifestBySlug } from '@/lib/app.helpers'
import { emailMatchesPattern } from '@/lib/email.validation'
import { merge, omit, pick } from '@/lib/object'

export type GenericConfig<T> = T

export type GroupConfig<T> = GenericConfig<T> & {
  users?: Record<string, UserConfig<T>>
}

export type UserConfig<T> = GenericConfig<T> & {
  // pass
}

export interface AccessConfig<T> {
  groups?: Record<string, GroupConfig<T>>
  users?: Record<string, UserConfig<T>>
}

/**
 * Checks if a user matches user reference.
 */
export function userMatchesRef(
  user: { id?: string; email?: string },
  userRef: string
): boolean {
  if (userRef === '*') {
    return true // wildcard matches all users
  }

  if (user.id && user.id === userRef) {
    return true // user ID matches
  }

  if (user.email && emailMatchesPattern(user.email, userRef)) {
    return true // email matches pattern
  }

  // no match found

  return false
}

/**
 * Retrieves the specific configuration for a user. This function automatically
 * resolves the user specific user and group configurations. Returns null if no
 * configuration is found for the user. This will hold even when the user exists
 * within a group, but has no specific configuration.
 */
export function getUserConfig<T>(
  user: { id?: string; email?: string },
  config: AccessConfig<T>
): Record<string, unknown> | null {
  // aggregate all direct user configs

  const userConfigs: GenericConfig<T>[] = []

  {
    for (const [userRef, userConfig] of Object.entries(config.users || {})) {
      if (userMatchesRef(user, userRef)) {
        userConfigs.push(userConfig)
      }
    }

    if (userConfigs.length === 0) {
      return null // @note return null when the user does not exist - the group config is ignored
    }
  }

  // aggregate all group user configs

  const groupUserConfigs: Array<GenericConfig<T>> = []

  {
    for (const [, groupConfig] of Object.entries(config.groups || {})) {
      for (const [userRef, userConfig] of Object.entries(
        groupConfig.users || {}
      )) {
        if (userMatchesRef(user, userRef)) {
          groupUserConfigs.push(omit(groupConfig, ['users']))
          groupUserConfigs.push(userConfig)
        }
      }
    }

    if (groupUserConfigs.length === 0) {
      // @note proceed without group user configs
    }
  }

  // merge all configs together

  const mergedConfigs: Record<string, unknown> = merge(
    // low priority - less specific

    ...groupUserConfigs,

    // high priority - more specific

    ...userConfigs
  )

  return mergedConfigs
}

/**
 * Checks if the user exists in the configuration. This function checks only
 * if the user exists in the user configurations, not in any group.
 */
export function userInConfig(
  user: { id?: string; email?: string },
  config: AccessConfig<unknown>
): boolean {
  const userConfig = getUserConfig(user, config)

  return userConfig !== null
}

/**
 * Returns the shadow configuration from the main configuration. If no shadow
 * configuration exists, null is returned. The shadow configuration does not
 * introduce any new values, but only provides default values when the value is
 * required but not present in the main configuration. Shadow values are not
 * used when the value is explicitly set to null or empty.
 *
 * @todo add types
 */
export function getShadowConfig<T extends Record<string, unknown>>(
  config: Record<string, unknown>
): GenericConfig<T> | null {
  const shadow = config._ || null

  if (typeof shadow === 'object' && shadow !== null) {
    return shadow as GenericConfig<T>
  }

  return null
}

/**
 * Returns the public configuration from the main configuration. The public
 * configuration contains only non-sensitive information that can be exposed to
 * the public.
 *
 * @todo add types
 */
export function getPublicConfig(
  config: Record<string, unknown>
): Record<string, unknown> {
  const shadow = getShadowConfig(config)

  return {
    icon: config.icon,
    logo: config.logo,
    name: config.name,
    headline: config.headline,
    description: config.description,
    hidden: config.hidden,

    apps: Object.fromEntries(
      Object.entries(config.apps || {}).map(([key, app]) => {
        const config = pick(
          merge(
            // lowest priority

            getAppManifestBySlug(key) || {},

            // medium priority

            getAppGlobalBySlug(key) || {},

            // high priority

            shadow?.apps?.[key] || {},

            // highest priority

            app
          ),
          [
            'icon',
            'logo',
            'name',
            'headline',
            'description',
            'order',
            'category',
            'hidden',
            'sidebar',
          ]
        )

        return [key, config]
      })
    ),

    layout: config.layout,

    analytics: config.analytics,

    home: config.home,
  }
}

/**
 * Retrieves the specific app configuration from the main configuration. This
 * function automatically resolves the shadow configuration. Returns null if
 * the app configuration does not exist.
 */
export function getAppConfig(
  config: Record<string, unknown>,
  app: string
): Record<string, unknown> | null {
  const shadowConfig = getShadowConfig(config)

  const shadowAppConfig = shadowConfig?.apps?.[app]

  const appConfig = config.apps?.[app]

  if (!shadowAppConfig && !appConfig) {
    return null
  }

  const merged = merge(shadowAppConfig || {}, appConfig || {})

  return merged
}
