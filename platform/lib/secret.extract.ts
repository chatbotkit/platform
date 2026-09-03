/**
 * A regular expression to match secret placeholders.
 */
export const secretVariableRegex = /\$\{SECRET_(\w+)\}|\{\{SECRET_(\w+)\}\}/

/**
 * Extract secrets from a string.
 */
export function extractSecrets(input: string): string[] {
  const regex = new RegExp(secretVariableRegex.source, 'g')

  const secrets: string[] = []

  while (true) {
    const match = regex.exec(input)

    if (!match) {
      break
    }

    secrets.push(match[1] || match[2])
  }

  return Array.from(new Set(secrets))
}
