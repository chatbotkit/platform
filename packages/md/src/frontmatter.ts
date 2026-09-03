import * as yaml from '@chatbotkit-dev/yaml'

interface FrontmatterResult {
  data: Record<string, unknown>
  content: string
}

interface FrontmatterInput {
  data?: Record<string, unknown>
  content: string
}

/**
 * Splits a markdown page into frontmatter data and content
 *
 * @throws Error if the frontmatter cannot be parsed or does not parse to an object
 */
export function splitFrontmatter(page: string): FrontmatterResult {
  const match = page.match(
    /^(?:---+\n(?<header>[\s\S]*?)---+(?:\n|$))?(?<body>[\s\S]*)/
  )

  const header = match?.groups?.header || '{}'
  const body = match?.groups?.body || ''

  if (header.trim() === '') {
    return { data: {}, content: body }
  }

  const parsed = yaml.parse(header)

  if (typeof parsed !== 'object' || parsed === null) {
    throw new Error('frontmatter must parse to an object')
  }

  const data = parsed as Record<string, unknown>
  const content = body

  return { data, content }
}

/**
 * Combines frontmatter data and content back into a markdown page
 */
export function unsplitFrontmatter(page: FrontmatterInput): string {
  const parts: string[] = []

  if (page.data) {
    const data = yaml.stringify(page.data).trim()

    if (data !== '{}') {
      parts.push(`---\n${data}\n---`)
    }
  }

  parts.push(page.content.trim())

  return parts.join('\n\n')
}
