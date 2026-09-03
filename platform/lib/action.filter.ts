import type { AssertKeyNotExists } from '@chatbotkit-dev/typescript-utils/assert'
import { assertUnreachable } from '@chatbotkit-dev/typescript-utils/unreachable'

import type { ActionOptions } from '@/lib/action.exec.all'
import { getContextBot, getContextContact } from '@/lib/context.store'
import debug, { assert } from '@/lib/debug'
import { UserConfigError } from '@/lib/error'

/**
 * Scope type for resource filtering.
 */
export type ResourceScope = 'user' | 'blueprint' | 'bot' | 'contact'

/**
 * Parameters for generating scoped resource filters.
 */
export interface ScopedResourceFilterParams {
  /** The user for user-scoped filtering */
  userId: string

  /** The scope determining how resources are filtered. */
  scope: ResourceScope

  /** The linked resources from action options (e.g., secretId, spaceId) */
  linkedResources?: ActionOptions['linkedResources']

  /** The context resources from action options (e.g., blueprintId, skillsetId) */
  contextResources?: ActionOptions['contextResources']
}

/**
 * Return type for scoped resource filter - a Prisma-compatible filter object.
 * Always includes userId for security.
 */
export type ScopedResourceFilterResult =
  | { userId: string }
  | { userId: string; blueprintId: string }
  | { userId: string; botId: string }
  | { userId: string; contactId: string }

/**
 * Generates a Prisma filter for resource queries based on scope and context.
 *
 * @param params - The scoped resource filter parameters
 * @returns Prisma filter object based on the scope (always includes userId)
 * @throws {Error} If required context is missing for the specified scope
 */
export function getScopedResourceFilter(
  params: ScopedResourceFilterParams
): ScopedResourceFilterResult {
  const {
    userId,

    scope,

    linkedResources,

    contextResources,
  } = params

  assert(userId, `userId is required for getScopedResourceFilter`)

  debug(`getScopedResourceFilter`, {
    userId,
    scope,
    linkedResources,
    contextResources,
  }).log('action.filter.getScopedResourceFilter')

  switch (scope) {
    // @note 'user' scope returns filter with only userId

    case 'user': {
      const filter = { userId }

      debug(`filter`, { filter }).log('action.filter.getScopedResourceFilter')

      return filter
    }

    // @note 'blueprint' scope filters by blueprintId

    case 'blueprint': {
      const contextBot = getContextBot()

      const { blueprintId = contextBot?.blueprintId } = contextResources || {}

      if (!blueprintId) {
        throw new UserConfigError('No blueprintId provided for blueprint scope')
      }

      const filter = { userId, blueprintId }

      debug(`filter`, { filter }).log('action.filter.getScopedResourceFilter')

      return filter
    }

    // @note 'bot' scope filters by botId

    case 'bot': {
      const contextBot = getContextBot()

      const { botId = contextBot?.id } = linkedResources || {}

      if (!botId) {
        throw new UserConfigError('No botId provided for bot scope')
      }

      const filter = { userId, botId }

      debug(`filter`, { filter }).log('action.filter.getScopedResourceFilter')

      return filter
    }

    // @note 'contact' scope filters by contactId

    case 'contact': {
      // @note type assertion to ensure contactId is not in linkedResources
      {
        // @note if the assertion fails, this means that linkedResources now has
        // a contactId which means we need to use first before fallback to
        // context - this is a code change situation

        const _check: AssertKeyNotExists<
          ActionOptions['linkedResources'],
          'contactId'
        > = true
      }

      const contextContact = getContextContact()

      const { contactId = contextContact?.id } = {}

      if (!contactId) {
        throw new UserConfigError('No contactId provided for contact scope')
      }

      const filter = { userId, contactId }

      debug(`filter`, { filter }).log('action.filter.getScopedResourceFilter')

      return filter
    }

    default: {
      assertUnreachable(scope)
    }
  }
}
