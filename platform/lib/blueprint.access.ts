import type { Blueprint } from '@/prisma/types'

import type { User } from '@/lib/user.get'

type BlueprintUser = Pick<User, 'id' | 'email'>
type BlueprintAccess = Pick<Blueprint, 'userId'>

/**
 * Checks if a user can use a blueprint
 */
export function canUseBlueprint(
  user: BlueprintUser,
  blueprint: BlueprintAccess
): boolean {
  return (
    // the user is the owner
    blueprint.userId === user.id
  )
}

/**
 * Checks if a user can manipulate a blueprint
 */
export function canManipulateBlueprint(
  user: BlueprintUser,
  blueprint: BlueprintAccess
): boolean {
  return (
    // the user is the owner
    blueprint.userId === user.id
  )
}
