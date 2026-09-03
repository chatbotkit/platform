/**
 * Core Library Features:
 * 1. template`` tagged template literal
 * 2. when(condition, content?) function
 * 3. Preserves leading whitespace exactly
 * 4. Removes entire lines when when(false) with no content
 * 5. Clean, predictable output
 */

/**
 * Result object returned by when() function
 */
interface WhenResult {
  __isWhenResult: true

  condition: boolean
  content: string | undefined
  shouldRemoveLine: boolean
}

/**
 * Conditional content function - The core of line-aware templating
 *
 * BEHAVIOR MATRIX:
 * ┌─────────────┬──────────────┬─────────────────────────────────────────┐
 * │ Condition   │ Content      │ Result                                  │
 * ├─────────────┼──────────────┼─────────────────────────────────────────┤
 * │ true        │ undefined    │ Keeps line, removes ${when(true)}       │
 * │ true        │ "text"       │ Replaces ${when(true, "text")} with text│
 * │ false       │ undefined    │ REMOVES ENTIRE LINE                     │
 * │ false       │ "text"       │ REMOVES ENTIRE LINE (ignores text)      │
 * └─────────────┴──────────────┴─────────────────────────────────────────┘
 *
 * @param condition - Whether to include content or keep line
 * @param content - Content to include if condition is true.
 *                  If undefined, when(false) removes entire line
 * @returns Special object for template processor
 */
export function when(condition: boolean, content?: string): WhenResult {
  return {
    __isWhenResult: true,

    condition,
    content: condition ? content : undefined,
    shouldRemoveLine: !condition, // @note when condition is false, always remove line (whether content provided or not)
  }
}

/**
 * Normalize output while preserving intentional whitespace
 * Implements automatic dedenting by removing common leading whitespace
 */
function normalizeOutput(text: string): string {
  // Compress new lines characters up-to 2 instances
  text = text.replace(/\n{3,}/g, '\n\n')

  const lines = text.split('\n')

  // Remove leading and trailing empty lines, but preserve internal structure
  let start = 0
  let end = lines.length

  // Find first non-empty line
  while (start < lines.length && lines[start].trim() === '') {
    start++
  }

  // Find last non-empty line
  while (end > start && lines[end - 1].trim() === '') {
    end--
  }

  let contentLines = lines.slice(start, end)

  // Handle backslash line concatenation
  // @note lines ending with \ should concatenate with the next line
  const concatenatedLines: string[] = []

  for (let i = 0; i < contentLines.length; i++) {
    const line = contentLines[i]
    const trimmedLine = line.trimEnd()

    if (trimmedLine.endsWith('\\')) {
      // Line ends with backslash - concatenate with next line
      const lineWithoutBackslash = trimmedLine.slice(0, -1).trimEnd()

      if (i + 1 < contentLines.length) {
        // Concatenate with next line (trim both sides at join point)
        const nextLine = contentLines[i + 1].trimStart()

        concatenatedLines.push(lineWithoutBackslash + ' ' + nextLine)

        // Skip the next line since we've already processed it
        i++
      } else {
        // Last line ends with backslash - just remove the backslash
        concatenatedLines.push(lineWithoutBackslash)
      }
    } else {
      concatenatedLines.push(line)
    }
  }

  contentLines = concatenatedLines

  // If no content lines, return empty string
  if (contentLines.length === 0) {
    return ''
  }

  // Find minimum indentation (shortest whitespace prefix) among non-empty lines
  let minIndent = Infinity

  for (const line of contentLines) {
    if (line.trim() !== '') {
      // Only consider non-empty lines
      const match = line.match(/^[ \t]*/)

      if (match) {
        minIndent = Math.min(minIndent, match[0].length)
      }
    }
  }

  // If no indentation found (all lines start at column 0), no trimming needed
  if (minIndent === Infinity || minIndent === 0) {
    return contentLines.join('\n')
  }

  // Remove the common leading whitespace from each line
  const dedentedLines = contentLines.map((line) => {
    if (line.trim() === '') {
      // Preserve empty lines as empty
      return ''
    }

    // Remove the common prefix, preserving any additional indentation
    return line.slice(minIndent)
  })

  return dedentedLines.join('\n').trim()
}

/**
 * Tagged template literal processor
 * Handles conditional content and line removal
 */
export function template(
  strings: TemplateStringsArray,

  ...expressions: unknown[]
): string {
  // Track which expressions are productive (generate content)
  const productiveExpressions: Set<number> = new Set()

  // First pass: identify productive expressions and build result
  let result = ''

  for (let i = 0; i < strings.length; i++) {
    result += strings[i]

    if (i < expressions.length) {
      const expr = expressions[i]

      if (
        expr &&
        typeof expr === 'object' &&
        '__isWhenResult' in expr &&
        expr.__isWhenResult
      ) {
        const whenResult = expr as WhenResult

        if (whenResult.shouldRemoveLine) {
          result += '__REMOVE_LINE__'
        } else if (whenResult.content !== undefined) {
          result += whenResult.content
          productiveExpressions.add(i) // This expression produces content
        }
        // when(true) with no content adds nothing but is not productive
      } else {
        result += String(expr)

        // @note only mark as productive if the expression is not null/undefined
        // otherwise undefined values would prevent line removal when used with
        // when(false)

        if (expr !== null && expr !== undefined) {
          productiveExpressions.add(i) // Regular expressions are productive
        }
      }
    }
  }

  // Second pass: identify which lines have productive content
  const lines = result.split('\n')
  const linesToKeep: string[] = []

  // For each line, check if it contains removal markers AND has productive content
  for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    const line = lines[lineIndex]

    if (line.includes('__REMOVE_LINE__')) {
      // Check if this line contains any productive expressions
      let hasProductiveContent = false

      // Look for content from productive expressions in this line
      for (const exprIndex of productiveExpressions) {
        const expr = expressions[exprIndex]
        let expressionContent = ''

        if (
          expr &&
          typeof expr === 'object' &&
          '__isWhenResult' in expr &&
          expr.__isWhenResult &&
          'content' in expr &&
          typeof expr.content === 'string'
        ) {
          expressionContent = expr.content || ''
        } else {
          expressionContent = String(expr)
        }

        if (expressionContent && line.includes(expressionContent)) {
          hasProductiveContent = true

          break
        }
      }

      if (hasProductiveContent) {
        // Keep the line but remove markers
        linesToKeep.push(line.replace(/__REMOVE_LINE__/g, ''))
      } else {
        // Remove entire line - only has static text + when(false) calls
        continue
      }
    } else {
      // No removal markers, keep as is
      linesToKeep.push(line)
    }
  }

  result = linesToKeep.join('\n')

  // Normalize line endings and clean up
  return normalizeOutput(result)
}

template.when = when

export function templateLog(
  strings: TemplateStringsArray,

  ...expressions: unknown[]
): string {
  const output = template(strings, ...expressions)

  // eslint-disable-next-line no-console
  console.log(`[template] ${output}`)

  return output
}

template.log = templateLog
