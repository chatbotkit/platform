import '@/lib/scope.server'

import partners from '@chatbotkit-dev/partners'

import { overrides } from '@/config/limits'

import { fastGetUserById } from '@/lib/user.get'

// --- Account Hierarchy ---

/**
 * Check whether a user is structurally owned by another user.
 *
 * Partner status and database email identity are deliberately irrelevant to
 * this relationship. `User.parentId` is its only source of truth.
 */
export function isChildUser(user: unknown): boolean {
  return Boolean(
    user && typeof user === 'object' && 'parentId' in user && user.parentId
  )
}

// --- Vip ---

/**
 * Check if a user is a VIP user.
 *
 * @note a per-account exception, so it lives with the rest of them: an
 * override entry carrying `vip: true` in OVERRIDES_CONFIG.
 */
export function isVip(user: { id: string }): boolean {
  return overrides[user.id]?.vip === true
}

/**
 * The plan granted to this email address by an override, if any. Plan grants
 * live in the overrides catalogue as email-keyed entries with a `plan` - the
 * same catalogue that carries the per-account limit overrides, so there is a
 * single place to make an account an exception.
 */
export function grantedPlan(email: string): string | undefined {
  return overrides[email]?.plan
}

// --- Partner Accounts ---

// @note bounds the ancestor walk so a corrupted parent chain (a cycle, or a
// pathologically deep hierarchy) degrades to "no partner" instead of hanging

const MAX_ANCESTOR_DEPTH = 16

/**
 * Resolve the partner config a user belongs to, if any. Ancestors win over
 * the user's own id - a partner-minted child account belongs to the partner
 * that owns it, nearest ancestor first - and the user's own id is only
 * consulted when no ancestor matches, so an account the catalogue names
 * directly keeps its partner even when it hangs off a non-partner parent.
 */
export async function getEffectivePartner(user: {
  id: string
  parentId?: string | null
}): Promise<(typeof partners)[string] | null> {
  const match = (candidate: { id: string }) =>
    Object.values(partners).find((partner) =>
      candidate.id.endsWith(partner.id)
    ) ?? null

  const seen = new Set([user.id])

  let parentId = user.parentId

  for (let depth = 0; parentId && depth < MAX_ANCESTOR_DEPTH; depth++) {
    if (seen.has(parentId)) {
      break
    }

    seen.add(parentId)

    const ancestor = await fastGetUserById(parentId)

    if (!ancestor) {
      break
    }

    const partner = match(ancestor)

    if (partner) {
      return partner
    }

    parentId = ancestor.parentId
  }

  return match(user)
}

/**
 * Check if a user is a configured partner account.
 */
export function isPartnerAccount(user: { id: string }): boolean {
  return Object.values(partners).some((partner) => user.id.endsWith(partner.id))
}

/**
 * Check if a user or one of their ancestors is a partner account.
 */
export async function isEffectivePartnerAccount(user: {
  id: string
  parentId?: string | null
}): Promise<boolean> {
  return !!(await getEffectivePartner(user))
}

/**
 * Check if a user (or their parent user) belongs to a whitelabel partner.
 */
export async function isEffectiveWhitelabelAccount(user: {
  id: string
  parentId?: string | null
}): Promise<boolean> {
  const partner = await getEffectivePartner(user)

  return !!partner?.whitelabel
}
