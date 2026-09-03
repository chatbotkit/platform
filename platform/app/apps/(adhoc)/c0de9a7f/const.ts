export const APP_NAME = 'c0de9a7f'

/** One day, in seconds - the cost policy's usage window and block duration. */
export const DAY_IN_SECONDS = 24 * 60 * 60

/**
 * The starter daily token budget for a new factory's cost policy. Deliberately
 * tight - the user raises it on the Settings page. Used both to seed the policy
 * and as the fallback the server shows before the policy has been provisioned.
 */
export const DEFAULT_DAILY_TOKEN_BUDGET = 100_000

/**
 * Marker written to `blueprint.meta` so this app can list only the blueprints it
 * owns (its "factories") and ignore the user's other blueprints.
 */
export const FACTORY_META = { app: APP_NAME }

/**
 * The template revision. Stored on each factory's `blueprint.meta.templateVersion`
 * at create and on every re-apply, so a factory records which template it is on
 * (and a future migration can compare / roll back). Bump this whenever
 * `factory-template.ts` changes in a way worth tracking.
 */
export const TEMPLATE_VERSION = 2

/** The full meta stamped onto a factory blueprint. */
export function factoryMeta() {
  return { app: APP_NAME, templateVersion: TEMPLATE_VERSION }
}

/**
 * The alias prefix for a factory blueprint. Each factory is a distinct blueprint
 * aliased `f-<key>`; all of its resources are aliased `f-<key>-<role>`. Aliases
 * are unique per user (`@@unique([userId, alias])`), so every factory needs its
 * own key - hence the prefix rather than the fixed aliases a single-instance app
 * would use.
 */
export const FACTORY_ALIAS_PREFIX = 'f'

/**
 * Derives the `@alias` addresses for a factory's resources from its blueprint
 * alias. The single source of truth shared by the template (which stamps these
 * aliases onto the resources) and the server (which addresses them afterward).
 */
export function factoryAliases(factory: string) {
  return {
    blueprint: factory,
    bot: `${factory}-bot`,
    skillset: `${factory}-skillset`,
    workspace: `${factory}-workspace`,
    github: `${factory}-github`,
    policy: `${factory}-policy`,
  }
}

/** Whether a string looks like one of this app's factory aliases. */
export function isFactoryAlias(alias: string | null | undefined): boolean {
  return Boolean(alias && alias.startsWith(`${FACTORY_ALIAS_PREFIX}-`))
}
