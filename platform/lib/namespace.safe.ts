import { v5 as uuidv5 } from 'uuid'

export const SAFE_NAMESPACE = '67b8f341-6f7c-4877-b12d-07540d393e3a' // @note do not change

interface UserWithId {
  id: string
}

/**
 * Gets a namespace unique to the current user.
 */
export function getSafeNamespace(user: UserWithId, namespace: string): string {
  return uuidv5(
    [`userId[${user.id}]`, `namespace[${namespace}]`].join(':::'),
    SAFE_NAMESPACE
  ).toLowerCase()
}
