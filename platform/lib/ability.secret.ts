// @note an ability template names the secret it needs by pointing at a secret
// template in the platform catalogue:
//
//   @ably                 -> secret template `ably`
//                            ("Ably API Key", a plain value you paste in)
//   @platform/google/mail -> secret template `platform/google/mail`
//                            ("Google Mail", an oauth secret you authorize)
//
// The secret template carries the name, type, kind and config, so there is
// nothing to guess - see data/secrets/catalogue and /platform/secret/list.
//
// `#secret`, on the generic MCP template, names nothing: it means "bring your
// own", so there is no template to resolve and nothing we can create.

/**
 * The key of the secret template an ability template asks for, or null when it
 * does not name one.
 */
export function getSecretTemplateKey(hint?: string | null): string | null {
  return hint?.startsWith('@') ? hint.slice(1) : null
}

/**
 * The secret template an ability template asks for, out of the platform
 * catalogue. Null when the ability names no secret, or names one the catalogue
 * has no entry for.
 */
export function findSecretTemplate<T extends { template: string }>(
  hint: string | null | undefined,
  secretTemplates: T[]
): T | null {
  const key = getSecretTemplateKey(hint)

  if (!key) {
    return null
  }

  return secretTemplates.find(({ template }) => template === key) || null
}
