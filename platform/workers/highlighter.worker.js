import { regex } from '@/lib/regex'
import { inclusiveRecursiveSplit } from '@/lib/string'

function escapeHtml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

self.onmessage = async function ({ data: { value = '', keywords = [] } }) {
  if (!value || !keywords || !keywords.length) {
    self.postMessage(escapeHtml(value))

    return
  }

  const parts = inclusiveRecursiveSplit(
    value,
    keywords.map((keyword) => regex(keyword))
  )

  value = parts
    .map((part) => {
      let matched = false

      for (const keyword of keywords) {
        part = part.replace(keyword, (match, ...rest) => {
          matched = true

          const groups = rest.pop()

          if (typeof groups === 'object' && groups !== null) {
            const key = Object.keys(groups)[0]

            const group = groups[key]

            if (group) {
              const prefix = match.slice(0, match.indexOf(group))
              const suffix = match.slice(match.indexOf(group) + group.length)

              return `${escapeHtml(prefix)}<mark class="${key}">${escapeHtml(
                group
              )}</mark>${escapeHtml(suffix)}`
            }
          }

          return `<mark>${escapeHtml(match)}</mark>`
        })

        if (matched) {
          break
        }
      }

      return matched ? part : escapeHtml(part)
    })
    .join('')

  self.postMessage(value)
}
