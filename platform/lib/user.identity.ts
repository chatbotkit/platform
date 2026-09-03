import '@/lib/scope.server'

const USER_IDENTITY_DOMAIN = 'user.internal'

/**
 * Derive the database-only email identity for a Child User.
 *
 * @throws {Error} When the User ID is empty.
 */
export function getChildUserIdentityEmail(userId: string): string {
  if (!userId) {
    throw new Error('A Child User ID is required')
  }

  return `${userId}@${USER_IDENTITY_DOMAIN}`
}

/**
 * Returns whether a value is a database-only User identity.
 */
export function isUserIdentityEmail(email: unknown): boolean {
  if (typeof email !== 'string') {
    return false
  }

  const [local, domain, ...rest] = email.trim().toLowerCase().split('@')

  return Boolean(local) && domain === USER_IDENTITY_DOMAIN && rest.length === 0
}
