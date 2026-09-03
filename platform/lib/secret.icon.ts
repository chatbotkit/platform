import { nameToIcon } from '@/lib/name.icon'
import { getTemplateRealName } from '@/lib/template'

/**
 * The subset of a secret we need to work out its icon.
 */
interface IconableSecret {
  name?: string | null
  config?: { template?: string | null } | null
}

/**
 * A secret catalogue entry, as far as icon resolution cares.
 */
interface SecretTemplate {
  template?: string | null
  name?: string | null
  icon?: unknown
}

/**
 * Last-resort icon for a connection that resolves to no secret template.
 */
export const GENERIC_SECRET_ICON = '@heroicons/key'

/**
 * Recover the catalogue secret template a connection was created from.
 *
 * A live connection is a persisted secret, so it carries no template id of its
 * own. It is matched back to the catalogue by the template reference some
 * secrets keep in their config, then by the name it inherited from the template
 * when it was created.
 */
export function resolveSecretTemplate<T extends SecretTemplate>(
  secret: IconableSecret | null | undefined,
  secretTemplates: T[] = []
): T | null {
  const configTemplate = secret?.config?.template

  if (configTemplate) {
    const key = getTemplateRealName(configTemplate)

    const byTemplate = secretTemplates.find(
      (template) =>
        template.template && getTemplateRealName(template.template) === key
    )

    if (byTemplate) {
      return byTemplate
    }
  }

  if (secret?.name) {
    return (
      secretTemplates.find((template) => template.name === secret.name) || null
    )
  }

  return null
}

/**
 * Resolve the icon of the catalogue secret template a connection maps to, or
 * `null` when none matches. Callers layer their own final fallback on top.
 */
export function resolveSecretIcon(
  secret: IconableSecret | null | undefined,
  secretTemplates: SecretTemplate[] = []
): string | null {
  const icon = resolveSecretTemplate(secret, secretTemplates)?.icon

  return typeof icon === 'string' && icon ? icon : null
}

/**
 * Resolve the display icon for a connection, most authoritative source first:
 *
 *   1. the icon of the catalogue secret template it maps to
 *   2. the name-keyword heuristic - a last-resort net for connections that map
 *      to no template (hand-created, or the catalogue has not loaded)
 *   3. the generic key
 *
 * @note deliberately not theme-mapped: connections render on a fixed light tile
 * (`bg-white`) in both themes, so a monochrome logo already reads fine and a
 * dark-mode invert would make it vanish (light-on-light) instead.
 */
export function resolveSecretDisplayIcon(
  secret: IconableSecret | null | undefined,
  secretTemplates: SecretTemplate[] = []
): string {
  return (
    resolveSecretIcon(secret, secretTemplates) ||
    nameToIcon(secret?.name || '') ||
    GENERIC_SECRET_ICON
  )
}
