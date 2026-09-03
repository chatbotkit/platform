import { assertUnreachable } from '@chatbotkit-dev/typescript-utils/unreachable'

import limits, { PLAN_UNLIMITED, hasPlans, overrides } from '@/config/limits'
import type {
  LimitType,
  Limits,
  OverrideEntry,
  OverrideLimits,
} from '@/config/limits'

import prisma from '@/prisma/client'

import debug, { assert, createSpan } from '@/lib/debug'
import { defer } from '@/lib/defer'
import { captureException } from '@/lib/error'
import { promises } from '@/lib/it'
import {
  getApproximateTotalAbilities,
  getApproximateTotalBots,
  getApproximateTotalDatasets,
  getApproximateTotalFiles,
  getApproximateTotalPolicies,
  getApproximateTotalPortals,
  getApproximateTotalRecords,
  getApproximateTotalSkillsets,
  getApproximateTotalTeamMembers,
  getApproximateTotalTeams,
} from '@/lib/limit.estimate'
import { platformBudgetOk } from '@/lib/limit.platform'
import memcache from '@/lib/memcache'
import {
  notifyExceededAccountLimits,
  notifyExceededDatabaseLimits,
  notifyExceededRateLimits,
  notifyNearlyExceededAccountLimits,
  notifyNearlyExceededDatabaseLimits,
} from '@/lib/notify'
import { flatten, merge, unflatten } from '@/lib/object'
import { slidingWindow } from '@/lib/ratelimit'
import { throwLimitsReached } from '@/lib/response'
import { getSafeSessionStore } from '@/lib/session.context'
import { getUsageKey } from '@/lib/usage.record'
import { fastGetUserById } from '@/lib/user.get'
import type { RevealUserPlanInput } from '@/lib/user.plan'
import { revealUserPlan } from '@/lib/user.plan'
import { isChildUser } from '@/lib/user.type'

import pluralize from 'pluralize'

/**
 * The user a limit check operates on. The fields declared here are the ones
 * this module reads itself; the rest is inherited from the plan-resolution
 * input (`@/lib/user.plan`), because every check hands the user through to
 * `revealUserPlan` - pass a fully loaded user row so the plan resolves
 * correctly.
 */
export interface LimitUser extends RevealUserPlanInput {
  id: string
  email: string
}

// @todo remove plural limits

export type RateLimitTypeSingle =
  | 'rate/record'
  | 'rate/ability'
  | 'rate/conversation'
  | 'rate/message'
  | 'rate/poll'
export type RateLimitTypePlural =
  | 'rate/records'
  | 'rate/abilities'
  | 'rate/conversations'
  | 'rate/messages'
  | 'rate/polls'
export type RateLimitType = RateLimitTypeSingle | RateLimitTypePlural

export type DatabaseLimitTypeSingle =
  | 'database/bot'
  | 'database/dataset'
  | 'database/record'
  | 'database/skillset'
  | 'database/ability'
  | 'database/file'
  | 'database/portal'
  | 'database/user'
  | 'database/policy'
  | 'database/team'
  | 'database/teamMember'
  | 'database/integration'
export type DatabaseLimitTypePlural =
  | 'database/bots'
  | 'database/datasets'
  | 'database/records'
  | 'database/skillsets'
  | 'database/abilities'
  | 'database/files'
  | 'database/portals'
  | 'database/users'
  | 'database/policies'
  | 'database/teams'
  | 'database/teamMembers'
  | 'database/integrations'
export type DatabaseLimitType = DatabaseLimitTypeSingle | DatabaseLimitTypePlural

export type FileLimitTypeSingle = 'file/maxFileSize'
export type FileLimitTypePlural = 'file/maxFileSize'
export type FileLimitType = FileLimitTypeSingle | FileLimitTypePlural

export type AccountLimitTypeSingle =
  | 'token'
  | 'conversation'
  | 'message'
  | 'image'
  | 'video'
  | 'audio'
  | 'fetch'
  | 'email'
export type AccountLimitTypePlural =
  | 'tokens'
  | 'conversations'
  | 'messages'
  | 'images'
  | 'videos'
  | 'audios'
  | 'fetches'
  | 'emails'
export type AccountLimitType = AccountLimitTypeSingle | AccountLimitTypePlural

export type StandardLimitType =
  | RateLimitType
  | DatabaseLimitType
  | FileLimitType
  | AccountLimitType

export type SpecialRateLimitType = 'special/rate/initiate'

export type AllTypes = StandardLimitType | SpecialRateLimitType

/**
 * Not used but kept for reference.
 */
export const KNOWN_RATE_LIMITS: RateLimitType[] = [
  'rate/conversation',
  'rate/message',
  'rate/record',
  'rate/ability',
  'rate/poll',
]

/**
 * Not used but kept for reference.
 */
export const KNOWN_DATABASE_LIMITS: DatabaseLimitType[] = [
  'database/bot',
  'database/dataset',
  'database/record',
  'database/skillset',
  'database/ability',
  'database/file',
  'database/portal',
  'database/user',
  'database/policy',
  'database/team',
  'database/teamMember',
  'database/integration',
]

/**
 * Not used but kept for reference.
 */
export const KNOWN_FILE_LIMITS: FileLimitType[] = ['file/maxFileSize']

/**
 * Used to reset the account limits after each billing cycle.
 */
export const KNOWN_ACCOUNT_LIMITS: AccountLimitType[] = [
  'token',
  'conversation',
  'message',
  'image',
  'video',
  'audio',
  'fetch',
  'email',
]

/**
 * Used for special purposes.
 */
export const KNOWN_SPECIAL_RATE_LIMITS: SpecialRateLimitType[] = [
  'special/rate/initiate',
]

/**
 * This function splits the limits into two categories: rate and account.
 */
export function splitLimits(limits: AllTypes[]): {
  rateLimits: RateLimitType[]
  databaseLimits: DatabaseLimitType[]
  fileLimits: FileLimitType[]
  accountLimits: AccountLimitType[]
  specialRateLimits: SpecialRateLimitType[]
} {
  const rateLimits: RateLimitType[] = []

  const databaseLimits: DatabaseLimitType[] = []

  const accountLimits: AccountLimitType[] = []

  const fileLimits: FileLimitType[] = []

  const specialRateLimits: SpecialRateLimitType[] = []

  for (const limit of limits) {
    if (limit.startsWith('rate/')) {
      rateLimits.push(limit as RateLimitType)
    } else if (limit.startsWith('database/')) {
      databaseLimits.push(limit as DatabaseLimitType)
    } else if (limit.startsWith('file/')) {
      fileLimits.push(limit as FileLimitType)
    } else if (limit.startsWith('special/')) {
      specialRateLimits.push(limit as SpecialRateLimitType)
    } else {
      assert(
        limit.indexOf('/') === -1,
        `unexpected limit with category ${limit}`
      )

      accountLimits.push(limit as AccountLimitType)
    }
  }

  return {
    rateLimits,
    databaseLimits,
    fileLimits,
    accountLimits,
    specialRateLimits: specialRateLimits,
  }
}

/**
 * Creates a key from parts.
 */
export function createKey(...parts: (string | number)[]) {
  return parts.filter(Boolean).join('-')
}

/**
 * Resolves the effective limit overrides contributed by a single override entry.
 *
 * An override entry may carry two kinds of limits:
 *
 *   - `limits` - applied unconditionally, regardless of the user's plan.
 *   - `plans[plan].limits` - applied only when the user is currently on that
 *     specific plan, and taking precedence over the unconditional `limits`.
 *
 * The plan-specific form lets us grandfather an account onto a higher limit
 * without that exception leaking into a different (e.g. downgraded) plan.
 */
export function resolveOverrideLimits(
  entry: OverrideEntry | undefined,
  plan: string
): OverrideLimits {
  if (!entry) {
    return {}
  }

  return merge(entry.limits ?? {}, entry.plans?.[plan]?.limits ?? {})
}

/**
 * This function returns all limits for the specific user. The limits are based
 * on the user's plan and any overrides that may exist.
 */
export async function getUserPlanLimits(
  user: LimitUser,
  plan: string
): Promise<Limits> {
  // @note in the planless deployment (empty catalogue) every plan resolves to
  // the unlimited table, so there is no key set to validate against; the
  // structural unlimited plan is valid in every deployment
  assert(
    !hasPlans || plan === PLAN_UNLIMITED || Object.keys(limits).includes(plan),
    `unknown plan ${plan}`
  )

  let base = merge(
    // lower priority

    limits[plan] ?? {},

    // highest priority

    resolveOverrideLimits(overrides[user?.id || ''], plan)
  )

  if (isChildUser(user)) {
    const childUser = await fastGetUserById(user.id)

    if (typeof childUser?.limits === 'object' && childUser?.limits !== null) {
      const flatLimits = flatten(childUser.limits)
      const flatBase = flatten(base)

      for (const key in flatLimits) {
        if (!(key in flatBase)) {
          delete flatLimits[key]
        }

        flatLimits[key] = Math.min(flatLimits[key], flatBase[key])

        if (
          isNaN(flatLimits[key]) ||
          !isFinite(flatLimits[key]) ||
          flatLimits[key] < 0
        ) {
          delete flatLimits[key]
        }
      }

      const unflattenedLimits = unflatten(flatLimits)

      base = merge(
        // lower priority

        base,

        // higher priority

        unflattenedLimits
      )
    }
  }

  return base
}

/**
 * This function returns all limits for the specific user. The limits are based
 * on the user's plan and any overrides that may exist.
 */
export async function getUserLimits(user: LimitUser): Promise<Limits> {
  const { plan } = await revealUserPlan(user)

  return await getUserPlanLimits(user, plan)
}

/**
 * The limits an account effectively enjoys, for display surfaces (usage and
 * overview dashboards). Unlike the enforcement path above, this is an
 * account-summary helper: overrides resolve by id with an email fallback, and
 * the effective (parent) user's overrides apply too - see the overrides
 * header in `@/config/limits`. It does not apply the child-user clamp, so a
 * child's dashboard shows the plan's limits, not the parent-assigned cut.
 */
export async function getUserDisplayLimits(user: LimitUser): Promise<LimitType> {
  const { plan, effectiveUser } = await revealUserPlan(user)

  const userOverrides = resolveOverrideLimits(
    overrides[user.id] ?? overrides[user.email],
    plan
  )

  const effectiveUserOverrides = resolveOverrideLimits(
    overrides[effectiveUser.id] ?? overrides[effectiveUser.email],
    plan
  )

  return merge(
    limits[plan],
    userOverrides,
    effectiveUserOverrides
  ) as LimitType
}

/**
 * This function converts a limit to a value. The value is checked to ensure it
 * is finite and if not then it is replaced with the maximum safe integer.
 *
 * @todo use `getUserPlanLimits` instead for better consistency
 */
export async function standardLimitToValue(
  plan: string,
  limit: StandardLimitType,
  user?: LimitUser
): Promise<number> {
  // @note in the planless deployment (empty catalogue) every plan resolves to
  // the unlimited table, so there is no key set to validate against; the
  // structural unlimited plan is valid in every deployment
  assert(
    !hasPlans || plan === PLAN_UNLIMITED || Object.keys(limits).includes(plan),
    `unknown plan ${plan}`
  )

  let overrideRoot = resolveOverrideLimits(overrides[user?.id || ''], plan)
  let limitRoot = limits[plan] ?? {}

  let category

  if (limit.indexOf('/') > 0) {
    ;[category, limit] = limit.split('/') as [string, StandardLimitType]
  }

  let customRoot = {}

  {
    if (user && isChildUser(user)) {
      const childUser = await fastGetUserById(user.id)

      customRoot = childUser?.limits ?? {}

      // @note we need to ensure that the custom limits are equal or lower to
      // the merged limits
      {
        const mergedLimits = merge(
          // lower priority

          limitRoot,

          // higher priority

          overrideRoot
        )

        const flatCustomRoot = flatten(customRoot)
        const flatMergedLimits = flatten(mergedLimits)

        for (const key in flatCustomRoot) {
          flatCustomRoot[key] = Math.min(
            flatCustomRoot[key],
            flatMergedLimits[key]
          )

          if (
            isNaN(flatCustomRoot[key]) ||
            !isFinite(flatCustomRoot[key]) ||
            flatCustomRoot[key] < 0
          ) {
            delete flatCustomRoot[key]
          }
        }

        customRoot = unflatten(flatCustomRoot)
      }
    }
  }

  if (category) {
    customRoot = customRoot[category] ?? {}
    overrideRoot = overrideRoot[category] ?? {}
    limitRoot = limitRoot[category] ?? {}

    assert(!!limitRoot, `unknown category ${category}`)
  }

  // @todo simplify this with better types

  const l1 = limit
  const l2 = pluralize(limit, 2)
  const l3 = pluralize(limit, 1)
  const keys = [l1, l2, l3]

  const hasValue = [customRoot, overrideRoot, limitRoot].some((root) =>
    keys.some((key) => Object.hasOwn(root, key))
  )

  const customValue = customRoot[l1] ?? customRoot[l2] ?? customRoot[l3]
  const overrideValue = overrideRoot[l1] ?? overrideRoot[l2] ?? overrideRoot[l3]
  const limitValue = limitRoot[l1] ?? limitRoot[l2] ?? limitRoot[l3]

  const value = customValue ?? overrideValue ?? limitValue ?? null

  if (value === null) {
    return hasValue ? Number.MAX_SAFE_INTEGER : 0
  }

  return isFinite(value) ? value : Number.MAX_SAFE_INTEGER
}

/**
 * This function converts a special rate limit to a value.
 *
 * @todo use `getUserPlanLimits` instead for better consistency
 */
export async function specialRateLimitToValue(
  plan: string,
  limit: SpecialRateLimitType,
  userId?: string
): Promise<number> {
  plan
  limit
  userId

  switch (limit) {
    case 'special/rate/initiate': {
      return 100 // @note increase from 1
    }

    default: {
      const result: never = limit

      return result
    }
  }
}

/**
 * Retrieves the exceeded rate limits for the user.
 */
export async function getExceededRateLimits(
  user: LimitUser,
  limits: RateLimitType[]
): Promise<RateLimitType[]> {
  const span = createSpan({ name: 'getExceededRateLimits' })

  try {
    const { plan, effectiveUser } = await revealUserPlan(user)

    const tasks: Promise<[RateLimitType, boolean]>[] = []

    for (const limit of limits) {
      const task = async (): Promise<[RateLimitType, boolean]> => {
        const span = createSpan({
          name: `getExceededRateLimits/task/${limit}`,
        })

        const key = createKey('rate', limit, 'user', effectiveUser.id)

        const value = await standardLimitToValue(plan, limit, user)

        try {
          const { success } = await slidingWindow(key, value, '60 s')

          return [limit, success]
        } finally {
          span.finish()
        }
      }

      tasks.push(task())
    }

    const resolvedTasks = await Promise.all(tasks)

    return resolvedTasks
      .filter(([, success]) => !success)
      .map(([limit]) => limit)
  } finally {
    span.finish()
  }
}

/**
 * Retrieves the exceeded database limits for the user.
 */
export async function getExceededDatabaseLimits(
  user: LimitUser,
  limits: DatabaseLimitType[]
): Promise<{
  exceededLimits: DatabaseLimitType[]
  nearlyExceededLimits: DatabaseLimitType[]
}> {
  const transaction = createSpan({ name: 'getExceededDatabaseLimits' })

  try {
    const { plan, effectiveUser } = await revealUserPlan(user)

    const results: number[] = await Promise.all(
      limits.map(async (limit) => {
        const name = pluralize(limit, 1) as DatabaseLimitTypeSingle

        switch (name) {
          case 'database/bot': {
            return await getApproximateTotalBots(effectiveUser)
          }

          case 'database/dataset': {
            return await getApproximateTotalDatasets(effectiveUser)
          }

          case 'database/record': {
            return await getApproximateTotalRecords(effectiveUser)
          }

          case 'database/skillset': {
            return await getApproximateTotalSkillsets(effectiveUser)
          }

          case 'database/ability': {
            return await getApproximateTotalAbilities(effectiveUser)
          }

          case 'database/file': {
            return await getApproximateTotalFiles(effectiveUser)
          }

          case 'database/user': {
            return await prisma.user.count({
              where: {
                parentId: effectiveUser.id,
              },
            })
          }

          case 'database/portal': {
            return await getApproximateTotalPortals(effectiveUser)
          }

          case 'database/policy': {
            return await getApproximateTotalPolicies(effectiveUser)
          }

          case 'database/team': {
            return await getApproximateTotalTeams(effectiveUser)
          }

          case 'database/teamMember': {
            return await getApproximateTotalTeamMembers(effectiveUser)
          }

          case 'database/integration': {
            return 0 // @todo find a way to count integrations
          }

          default: {
            assertUnreachable(name)
          }
        }
      })
    )

    const resultsMap: [DatabaseLimitType, number, number, number][] =
      await Promise.all(
        results.map(async (value, index) => {
          const limit = limits[index]
          const planValue = await standardLimitToValue(
            plan,
            limit,
            effectiveUser
          )

          return [limit, value, planValue - value, value / planValue]
        })
      )

    const exceededLimits = resultsMap
      .filter(([, , diff]) => diff <= 0)
      .map(([limit]) => limit)

    const nearlyExceededLimits = resultsMap
      .filter(([, , diff, percent]) => diff > 0 && percent > 0.9)
      .map(([limit]) => limit)

    // @todo iterate over the exceeded limits and compare them to the available
    // booster packs; if a booster pack for the limit is found then adjust then
    // adjust the booster accordingly by removing the exceeded value; remove the
    // limit if no-longer exceeded

    return { exceededLimits, nearlyExceededLimits }
  } finally {
    transaction.finish()
  }
}

/**
 * Retrieves the exceeded account limits for the user.
 */
export async function getExceededAccountLimits(
  user: LimitUser,
  limits: AccountLimitType[]
): Promise<{
  exceededLimits: AccountLimitType[]
  nearlyExceededLimits: AccountLimitType[]
}> {
  const transaction = createSpan({ name: 'getExceededAccountLimits' })

  try {
    const { plan, effectiveUser } = await revealUserPlan(user)

    let chain = memcache.pipeline()

    for (const limit of limits) {
      chain = chain.get(getUsageKey(effectiveUser.id, limit))
    }

    const results: number[] = await chain.exec()

    const resultsMap: [AccountLimitType, number, number, number][] =
      await Promise.all(
        results.map(async (value, index) => {
          const limit = limits[index]
          const planValue = await standardLimitToValue(plan, limit, user)

          return [limit, value, planValue - value, value / planValue]
        })
      )

    const exceededLimits = resultsMap
      .filter(([, , diff]) => diff <= 0)
      .map(([limit]) => limit)

    const nearlyExceededLimits = resultsMap
      .filter(([, , diff, percent]) => diff > 0 && percent > 0.9)
      .map(([limit]) => limit)

    // @todo iterate over the exceeded limits and compare them to the available
    // booster packs; if a booster pack for the limit is found then adjust then
    // adjust the booster accordingly by removing the exceeded value; remove the
    // limit if no-longer exceeded

    return { exceededLimits, nearlyExceededLimits }
  } finally {
    transaction.finish()
  }
}

/**
 * Retrieves the exceeded special rate limits for the user.
 */
export async function getExceededSpecialRateLimits(
  user: LimitUser,
  limits: SpecialRateLimitType[]
): Promise<SpecialRateLimitType[]> {
  const span = createSpan({ name: 'getExceededSpecialRateLimits' })

  const session = await getSafeSessionStore()

  let specialLimitId

  if (session.options?.limits?.special?.rate?.id) {
    specialLimitId = session.options.limits.special.rate.id
  } else {
    limits = []
  }

  try {
    const { plan, effectiveUser } = await revealUserPlan(user)

    const tasks: Promise<[SpecialRateLimitType, boolean]>[] = []

    for (const limit of limits) {
      const task = async (): Promise<[SpecialRateLimitType, boolean]> => {
        const span = createSpan({
          name: `getExceededSpecialRateLimits/task/${limit}`,
        })

        const key = createKey(
          'special-rate',
          limit.replace(/^special\//, ''),
          'user',
          effectiveUser.id,
          'id',
          specialLimitId
        )

        const value = await specialRateLimitToValue(plan, limit, user.id)

        try {
          const { success } = await slidingWindow(key, value, '300 s')

          return [limit, success]
        } finally {
          span.finish()
        }
      }

      tasks.push(task())
    }

    const resolvedTasks = await Promise.all(tasks)

    return resolvedTasks
      .filter(([, success]) => !success)
      .map(([limit]) => limit)
  } finally {
    span.finish()
  }
}

/**
 * The function resets the rate limits for the user.
 */
export async function resetRateLimits(
  user: LimitUser,
  limits: RateLimitType[]
): Promise<void> {
  debug(`resetting rate limits`, { user, limits }).log('limit.resetRateLimits')

  let chain = memcache.pipeline()

  for (const limit of limits) {
    chain = chain.del(getUsageKey(user.id, limit))
  }

  await chain.exec()
}

/**
 * The function resets the database limits for the user.
 */
export async function resetDatabaseLimits(
  user: LimitUser,
  limits: DatabaseLimitType[]
): Promise<void> {
  debug(`resetting database limits`, { user, limits }).log(
    'limit.resetDatabaseLimits'
  )

  throw new Error('not implemented')
}

/**
 * The function resets the account limits for the user.
 */
export async function resetAccountLimits(
  user: LimitUser,
  limits: AccountLimitType[]
): Promise<void> {
  debug(`resetting account limits`, { user, limits }).log(
    'limit.resetAccountLimits'
  )

  let chain = memcache.pipeline()

  for (const limit of limits) {
    chain = chain.del(getUsageKey(user.id, limit))
  }

  await chain.exec()
}

export async function rateLimitsOk(
  user: LimitUser,
  limits: RateLimitType[],
  context?: { exceededLimits: RateLimitType[] }
): Promise<boolean> {
  if (process.env.SKIP_LIMITS_CHECK) {
    debug(`skipping rate limit check`, { user, limits, context }).log(
      'limit.rateLimitsOk'
    )

    return true
  }

  // @note the planless deployment has no entitlements to enforce: pass
  // straight through without reading any counter. Child users are the
  // one exception - their limits are set by the parent user rather than
  // derived from a plan, so they stay enforced without a catalogue. The
  // hierarchy check uses parentId and requires no lookup.
  if (!hasPlans && !isChildUser(user)) {
    return true
  }

  debug(`checking rate limits`, { user, limits, context }).log(
    'limit.rateLimitsOk'
  )

  const exceededLimits = await getExceededRateLimits(user, limits)

  if (exceededLimits.length > 0) {
    if (context) {
      context.exceededLimits.push(...exceededLimits)
    }

    try {
      await notifyExceededRateLimits(user, exceededLimits)
    } catch (e) {
      await captureException(e)
    }

    return false
  }

  return true
}

export async function databaseLimitsOk(
  user: LimitUser,
  limits: DatabaseLimitType[],
  context?: {
    exceededLimits: DatabaseLimitType[]
    nearlyExceededLimits: DatabaseLimitType[]
  }
): Promise<boolean> {
  if (process.env.SKIP_LIMITS_CHECK) {
    debug(`skipping database limit check`, { user, limits, context }).log(
      'limit.databaseLimitsOk'
    )

    return true
  }

  // @note the planless deployment has no entitlements to enforce: pass
  // straight through without reading any counter. Child users are the
  // one exception - their limits are set by the parent user rather than
  // derived from a plan, so they stay enforced without a catalogue. The
  // hierarchy check uses parentId and requires no lookup.
  if (!hasPlans && !isChildUser(user)) {
    return true
  }

  debug(`checking database limits`, { user, limits, context }).log(
    'limit.databaseLimitsOk'
  )

  const { exceededLimits, nearlyExceededLimits } =
    await getExceededDatabaseLimits(user, limits)

  if (exceededLimits.length > 0) {
    if (context) {
      context.exceededLimits.push(...exceededLimits)
    }

    try {
      await notifyExceededDatabaseLimits(user, exceededLimits)
    } catch (e) {
      await captureException(e)
    }

    return false
  }

  if (nearlyExceededLimits.length > 0) {
    if (context) {
      context.nearlyExceededLimits.push(...nearlyExceededLimits)
    }

    await defer(notifyNearlyExceededDatabaseLimits(user, nearlyExceededLimits))
  }

  return true
}

export async function accountLimitsOk(
  user: LimitUser,
  limits: AccountLimitType[],
  context?: {
    exceededLimits: AccountLimitType[]
    nearlyExceededLimits: AccountLimitType[]
  }
): Promise<boolean> {
  if (process.env.SKIP_LIMITS_CHECK) {
    debug(`skipping account limit check`, { user, limits, context }).log(
      'limit.accountLimitsOk'
    )

    return true
  }

  // @note the planless deployment has no entitlements to enforce: pass
  // straight through without reading any counter. Child users are the
  // one exception - their limits are set by the parent user rather than
  // derived from a plan, so they stay enforced without a catalogue. The
  // hierarchy check uses parentId and requires no lookup.
  if (!hasPlans && !isChildUser(user)) {
    return true
  }

  debug(`checking account limits`, { user, limits, context })

  const { exceededLimits, nearlyExceededLimits } =
    await getExceededAccountLimits(user, limits)

  if (exceededLimits.length > 0) {
    if (context) {
      context.exceededLimits.push(...exceededLimits)
    }

    try {
      await notifyExceededAccountLimits(user, exceededLimits)
    } catch (e) {
      await captureException(e)
    }

    return false
  }

  if (nearlyExceededLimits.length > 0) {
    if (context) {
      context.nearlyExceededLimits.push(...nearlyExceededLimits)
    }

    await defer(notifyNearlyExceededAccountLimits(user, nearlyExceededLimits))
  }

  return true
}

export async function accountConversationalLimitsOk(
  user: LimitUser
): Promise<boolean> {
  return accountLimitsOk(user, ['conversation', 'message', 'token'])
}

/**
 * @note deliberately not gated on `hasPlans`: the special rate limits are
 * abuse protection that a session's options opt into (widget initiate), with
 * hardcoded values - they are not entitlements, so they apply in the planless
 * deployment too.
 */
export async function specialRateLimitsOk(
  user: LimitUser,
  limits: SpecialRateLimitType[],
  context?: { exceededLimits: SpecialRateLimitType[] }
): Promise<boolean> {
  if (process.env.SKIP_LIMITS_CHECK) {
    debug(`skipping special rate limit check`, { user, limits, context }).log(
      'limit.specialRateLimitsOk'
    )

    return true
  }

  debug(`checking special rate limits`, { user, limits, context }).log(
    'limit.specialRateLimitsOk'
  )

  const exceededLimits = await getExceededSpecialRateLimits(user, limits)

  if (exceededLimits.length > 0) {
    if (context) {
      context.exceededLimits.push(...exceededLimits)
    }

    return false
  }

  return true
}

export function constructExceededRateLimitsMessage(
  exceededLimits: RateLimitType[]
): string {
  return `You have exceeded your allocated rate limits: ${exceededLimits.join(
    ', '
  )}`
}

export function constructExceededDatabaseLimitsMessage(
  exceededLimits: DatabaseLimitType[]
): string {
  return `You have exceeded your allocated database limits: ${exceededLimits.join(
    ', '
  )}`
}

export function constructExceededAccountLimitsMessage(
  exceededLimits: AccountLimitType[]
): string {
  return `You have exceeded your allocated account limits: ${exceededLimits.join(
    ', '
  )}`
}

export function constructExceededSpecialRateLimitsMessage(
  exceededLimits: SpecialRateLimitType[]
): string {
  return `You have exceeded your allocated limits: ${exceededLimits.join(', ')}`
}

export async function checkLimits(limits: AllTypes[], user: LimitUser) {
  const { rateLimits, databaseLimits, accountLimits, specialRateLimits } =
    splitLimits(limits)

  type LimitFailure = [
    typeof throwLimitsReached,
    ...Parameters<typeof throwLimitsReached>,
  ]

  const tasks: Array<() => Promise<LimitFailure | void>> = []

  // platform-wide token budget: enforced on every request, evaluated
  // concurrently with the per-user limit checks below
  tasks.push(async () => {
    if (!(await platformBudgetOk(user))) {
      return [throwLimitsReached]
    }
  })

  if (rateLimits.length > 0) {
    tasks.push(async () => {
      const context = {
        exceededLimits: [],
      }

      if (!(await rateLimitsOk(user, rateLimits, context))) {
        return [
          throwLimitsReached,
          constructExceededRateLimitsMessage(context.exceededLimits),
        ]
      }
    })
  }

  if (databaseLimits.length > 0) {
    tasks.push(async () => {
      const context = {
        exceededLimits: [],
        nearlyExceededLimits: [],
      }

      if (!(await databaseLimitsOk(user, databaseLimits, context))) {
        return [
          throwLimitsReached,
          constructExceededDatabaseLimitsMessage(context.exceededLimits),
        ]
      }
    })
  }

  if (accountLimits.length > 0) {
    tasks.push(async () => {
      const context = {
        exceededLimits: [],
        nearlyExceededLimits: [],
      }

      if (!(await accountLimitsOk(user, accountLimits, context))) {
        return [
          throwLimitsReached,
          constructExceededAccountLimitsMessage(context.exceededLimits),
        ]
      }
    })
  }

  if (specialRateLimits.length > 0) {
    tasks.push(async () => {
      const context = {
        exceededLimits: [],
      }

      if (!(await specialRateLimitsOk(user, specialRateLimits, context))) {
        return [
          throwLimitsReached,
          constructExceededSpecialRateLimitsMessage(context.exceededLimits),
        ]
      }
    })
  }

  const span = createSpan({ name: 'checkLimits' })

  try {
    for await (const result of promises(tasks.map((fn) => fn()))) {
      if (result) {
        const [throwFn, ...args] = result

        return throwFn(...args)
      }
    }
  } finally {
    span.finish()
  }
}
