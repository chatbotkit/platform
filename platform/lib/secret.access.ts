import { type Secret, SecretKind, SecretVisibility } from '@/prisma/types'

import { captureException } from '@/lib/error'
import type { User } from '@/lib/user.get'
import { getRelatedUsers } from '@/lib/user.relation'

// @note we require the email not because we need it but to prevent adding other
// objects that have id field

/**
 * Checks if a user can use a secret based on ownership, visibility, and kind settings
 */
export async function canUseSecret(
  user: Pick<User, 'id' | 'email'>,
  secret: Pick<Secret, 'userId' | 'visibility' | 'kind'>
): Promise<boolean> {
  // the user is the owner of the secret

  if (secret.userId === user.id) {
    return true
  }

  // the secret is public

  if (secret.visibility === SecretVisibility.public) {
    // the secret is personal

    if (secret.kind === SecretKind.personal) {
      return true
    }
  }

  // the secret is protected

  if (secret.visibility === SecretVisibility.protected) {
    // the secret is personal

    if (secret.kind === SecretKind.personal) {
      try {
        const relatedUsers = await getRelatedUsers(user)

        if (
          relatedUsers.some((relatedUser) => relatedUser.id === secret.userId)
        ) {
          return true
        }
      } catch (error) {
        await captureException(error)
      }
    }
  }

  return false
}

/**
 * Checks if a user can manipulate (modify/delete) a secret based on ownership
 */
export async function canManipulateSecret(
  user: Pick<User, 'id' | 'email'>,
  secret: Pick<Secret, 'userId' | 'visibility'>
): Promise<boolean> {
  // the user is the owner of the secret

  if (secret.userId === user.id) {
    return true
  }

  return false
}
