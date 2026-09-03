/**
 * Normalizes a secret name by converting to lowercase, replacing non-word
 * characters with underscores, and removing leading/trailing underscores.
 */
export function normalizeSecretName(name: string): string {
  return name
    .trim()
    .replace(/\W+/g, '_')
    .replace(/[_-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toLowerCase()
}

/**
 * Humanizes a secret name by converting underscores to spaces and capitalizing
 * words appropriately.
 */
export function humanizeSecretName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .replace(/\b(Api)\b/g, (m) => m.toUpperCase())
}
