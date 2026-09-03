import { toThemeAwareIcon } from '@/lib/icon.theme'
import { parseTemplateInstruction } from '@/lib/instruction.template.parse'
import { nameToIcon } from '@/lib/name.icon'
import { getTemplate, getTemplateRealName } from '@/lib/template'

/**
 * The subset of an ability we need to work out its icon - both the persisted
 * ability (from the API) and a designer node's `data` satisfy this.
 */
interface IconableAbility {
  name?: string | null
  instruction?: string | null
}

/**
 * A catalogue entry, as far as icon resolution cares. Deliberately loose so the
 * same resolver works over the designer's `abilityResources` (which carry
 * `title`) and the flat `useAbilityTemplates` items (which carry `name`).
 */
interface TemplateResource {
  icon?: unknown
  name?: string | null
  title?: string | null
}

/**
 * Last-resort icon for an ability that resolves to no catalogue template and
 * whose name matches none of the name-keyword heuristics.
 */
export const GENERIC_ABILITY_ICON = '@heroicons/sparkles'

/**
 * Build a template catalogue keyed by template id from the flat list that
 * {@link useAbilityTemplates} returns. Keyed the same way {@link getTemplate}
 * looks entries up, so it slots straight into {@link resolveAbilityTemplate}.
 */
export function buildTemplateCatalogue<T extends { template?: string | null }>(
  templates: T[] = []
): Record<string, T> {
  return Object.fromEntries(
    templates
      .filter((template) => template?.template)
      .map((template) => [
        getTemplateRealName(template.template as string),
        template,
      ])
  )
}

/**
 * Recover the catalogue template an ability was created from.
 *
 * Abilities added from the catalogue embed their template id in the persisted
 * instruction (a callable template instruction), so the template - and its
 * authoritative icon - is recoverable at render time without snapshotting
 * anything at creation. Falls back to matching a catalogue entry by display
 * name, which covers abilities whose instruction was edited away from the
 * callable-template form.
 */
export function resolveAbilityTemplate<T extends TemplateResource>(
  ability: IconableAbility | null | undefined,
  catalogue: Record<string, T> = {}
): T | null {
  // @note the template id lives in the instruction - a hand-written or edited
  // instruction may not parse as a template, hence the guard
  try {
    const { template } = parseTemplateInstruction(ability?.instruction || '')

    const resource = getTemplate(template, catalogue)

    if (resource) {
      return resource
    }
  } catch {
    // pass - fall through to the name match
  }

  if (ability?.name) {
    return (
      Object.values(catalogue).find(
        (resource) =>
          resource.title === ability.name || resource.name === ability.name
      ) || null
    )
  }

  return null
}

/**
 * Resolve the icon for an ability from its catalogue template, or `null` when
 * no template matches. Callers layer their own final fallback on top (e.g. the
 * name-keyword heuristic and the generic icon).
 */
export function resolveAbilityIcon(
  ability: IconableAbility | null | undefined,
  catalogue: Record<string, TemplateResource> = {}
): string | null {
  const resource = resolveAbilityTemplate(ability, catalogue)

  const icon = resource?.icon

  return typeof icon === 'string' && icon ? icon : null
}

/**
 * Resolve the display icon for an ability, most authoritative source first:
 *
 *   1. the icon of the catalogue template it was built from
 *   2. the name-keyword heuristic - a last-resort net that keeps recognizable
 *      abilities looking right when the catalogue is slow, unavailable, or the
 *      ability was hand-written with no template
 *   3. the generic fallback
 *
 * The result is passed through {@link toThemeAwareIcon} so a monochrome brand
 * logo (e.g. ChatBotKit's) does not vanish against a dark background.
 *
 * @note the heuristic only ever fires when (1) finds nothing, so it can never
 * override or contradict a template-backed ability's icon.
 */
export function resolveAbilityDisplayIcon(
  ability: IconableAbility | null | undefined,
  catalogue: Record<string, TemplateResource> = {}
): string {
  return toThemeAwareIcon(
    resolveAbilityIcon(ability, catalogue) ||
      nameToIcon(ability?.name || '') ||
      GENERIC_ABILITY_ICON
  )
}
