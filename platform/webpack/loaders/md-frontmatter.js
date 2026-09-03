// @ts-check

/**
 * Custom webpack loader to extract frontmatter from markdown files
 *
 * Usage:
 * import frontMatter from './file.md?frontmatter'
 *
 * Example:
 * For a file "example.md" with content:
 * ---
 * title: My Article
 * tags: [web, dev]
 * ---
 * # Article Content
 *
 * The import `import meta from './example.md!frontmatter'` will return:
 * { title: "My Article", tags: ["web", "dev"] }
 *
 * This loader extracts and returns only the frontmatter section of markdown files
 * as JSON, using inline frontmatter parsing to avoid module resolution issues.
 */

import jsYaml from 'js-yaml'

/**
 * Parse frontmatter from markdown content
 *
 * @param {string} page - The markdown content
 * @returns {{data: Record<string,any>, content: string}}
 */
function splitFrontmatter(page) {
  const match = page.match(
    /^(?:---+\n(?<header>[\s\S]*?)---+(?:\n|$))?(?<body>[\s\S]*)/
  )

  const header = match?.groups?.header || '{}'
  const body = match?.groups?.body || ''

  try {
    const data = jsYaml.load(header) || {}
    const content = body

    return { data, content }
  } catch (error) {
    // @note if YAML parsing fails return empty frontmatter to avoid breaking builds

    return { data: {}, content: page }
  }
}

/**
 * Webpack loader function
 *
 * @param {string} source - The markdown file content
 * @returns {string} - JavaScript module exporting the frontmatter data
 */
export default function mdFrontmatterLoader(source) {
  // @note parse frontmatter using inline functionality to avoid import issues

  const { data } = splitFrontmatter(source)

  // @note return frontmatter as JSON export - formatted for readability

  return `export default ${JSON.stringify(data, null, 2)};`
}
