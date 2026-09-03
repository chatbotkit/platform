import { escape } from '@chatbotkit-dev/regex'

/**
 * This is a primitive markdown linkifier. It does not handle all edge cases but
 * it is sufficient for our use case.
 */
export function linkifyMarkdown(
  content: string,
  keyword: string,
  url: string,
  times: number = Infinity
): string {
  // @todo this one requires much better implementation because the current one
  // is potentially breaking the markdown syntax - a better approach is to parse
  // the markdown and then replace the text

  // @note this regex matches the keyword if it is not already part of a
  // markdown link text or URL - It ensures the keyword is surrounded by word
  // boundaries (\b) and is not preceded by "(" or "[" or followed by "]"

  const regex = new RegExp(
    `(?<![\\(\\[][^\\)\\]\`]*)\\b${escape(keyword)}\\b(?![^\\[\\(]*[\\)\\]\`])`,
    'gi'
  )

  // @note this function replaces the matched keyword with the markdown link
  // syntax

  const replacer = (match: string): string => {
    times--

    if (times <= 0) {
      return match
    } else {
      return `[${match}](${url})`
    }
  }

  // replace all instances of the keyword

  let skip = false

  return content
    .split('\n')
    .map((line) => {
      switch (true) {
        case skip: {
          return line
        }

        case line.trim().startsWith('#'): {
          return line
        }

        case line.trim().startsWith('|'): {
          return line
        }

        case line.trim().startsWith('```'): {
          skip = !skip

          return line
        }
      }

      return line.replace(regex, replacer)
    })
    .join('\n')
}
