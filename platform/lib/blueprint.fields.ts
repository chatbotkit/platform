/**
 * Fields whose value is owned by the resource itself, not by a template:
 * secret values and integration auth tokens.
 *
 * - Export strips these so they never leak into a transportable document.
 * - Reconcile (import-by-alias update) skips them so re-syncing a template
 *   never overwrites a credential the user configured.
 *
 * The two endpoints share this single set so the "what is a credential"
 * definition can't drift between them.
 */

// @note every field name below is asserted to be a real column on at least one
// resource model by `blueprint.fields.utest.ts`, so a typo or a renamed/removed
// Prisma column cannot silently turn a credential-strip into a no-op.
export const UNMANAGED_FIELDS = new Set([
  'value', // secret value
  'signingSecret', // slack
  'botToken', // slack, discord, telegram
  'userToken', // slack
  'verifyToken', // whatsapp, messenger, instagram
  'appSecret', // whatsapp, messenger, instagram (validates x-hub-signature-256)
  'accessToken', // whatsapp, messenger, instagram, mcpserver, skillserver
  'secret', // trigger integration
  'token', // notion
  'apiKey', // anam, recall
  'authToken', // twilio
  'serviceAccountKey', // google chat
  'botFrameworkAppSecret', // microsoft teams
  'tenantId', // microsoft teams
  'privateKey', // github (the App's RSA private key)
  'webhookSecret', // github (validates x-hub-signature-256)
])

// @note each category-field pair is asserted against that model's Prisma columns
// by `blueprint.fields.utest.ts` (see UNMANAGED_FIELDS above).
export const UNMANAGED_FIELDS_BY_CATEGORY: Record<string, Set<string>> = {
  secret: new Set([
    'config', // may contain clientSecret/password/pass/etc.
  ]),
  mcpserverIntegration: new Set([
    // OAuth connections are reference-only and are not exported/cloned.
    'oAuthConnectionId',
  ]),
}

export function isUnmanagedBlueprintField(
  key: string,
  category?: string
): boolean {
  return (
    UNMANAGED_FIELDS.has(key) ||
    Boolean(category && UNMANAGED_FIELDS_BY_CATEGORY[category]?.has(key))
  )
}

// ── Reference fields ─────────────────────────────────────────────────────────

const LINKED_REFERENCE_PREFIX = 'linked'

/**
 * The resource type a `*Id` reference field points at.
 *
 * Plain references name their type directly (`botId` → `bot`). An ability's
 * linked resources - the resource the ability acts on, as opposed to its owner
 * or containers - carry the `linked` prefix (`linkedSecretId` → `secret`,
 * `linkedBotId` → `bot`). Every place that derives a type from a field name
 * goes through here so the prefix is understood uniformly.
 *
 * Returns null for a field that is not a `*Id` reference.
 */
export function getReferenceFieldType(field: string): string | null {
  if (typeof field !== 'string' || !field.endsWith('Id')) {
    return null
  }

  const base = field.slice(0, -2)

  if (
    base.startsWith(LINKED_REFERENCE_PREFIX) &&
    base.length > LINKED_REFERENCE_PREFIX.length &&
    /[A-Z]/.test(base[LINKED_REFERENCE_PREFIX.length])
  ) {
    const rest = base.slice(LINKED_REFERENCE_PREFIX.length)

    return rest[0].toLowerCase() + rest.slice(1)
  }

  return base
}

/**
 * Whether a `*Id` reference field points at the given resource type.
 */
export function isReferenceFieldFor(field: string, type: string): boolean {
  return getReferenceFieldType(field) === type
}
