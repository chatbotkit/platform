export function parse(input: string): Record<string, string> {
  const query = new URLSearchParams(input)

  return Array.from(query.entries()).reduce((acc, [key, value]) => {
    acc[key] = value

    return acc
  }, {} as Record<string, string>)
}

export function stringify(input: Record<string, string>): string {
  const query = new URLSearchParams()

  for (const [key, value] of Object.entries(input)) {
    query.set(key, value)
  }

  return query.toString()
}

export function isParsable(input: string): boolean {
  try {
    new URLSearchParams(input)

    return true
  } catch {
    return false
  }
}
