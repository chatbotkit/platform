import { ResourceState } from '@/prisma/types'

/**
 * Returns the abilities of a skillset that are *active* - i.e. installable or
 * exposable as tools.
 *
 * The lifecycle gate is:
 * - a disabled skillset contributes **no** abilities (the whole bundle is off);
 * - otherwise every ability that is not explicitly `disabled` is included.
 *
 * This centralizes the gate shared by every surface that turns a skillset's
 * abilities into callable tools (the skillset install action, the skill server,
 * and the MCP server) so a disabled skillset/ability can never be exposed on one
 * surface while being hidden on another. The engine's `getFunctions` applies the
 * equivalent gate inline because it also has to handle synthetic inline skillsets.
 *
 * Blacklist semantics (`!== disabled` rather than `=== enabled`) keep it robust
 * to rows that predate the `state` backfill - in practice the column defaults to
 * `enabled`, so the two are equivalent.
 */
export function getActiveSkillsetAbilities<
  A extends { state?: ResourceState | null },
>(
  skillset:
    | { state?: ResourceState | null; abilities?: A[] | null }
    | null
    | undefined
): A[] {
  if (!skillset || skillset.state === ResourceState.disabled) {
    return []
  }

  return (skillset.abilities ?? []).filter(
    (ability) => ability.state !== ResourceState.disabled
  )
}
