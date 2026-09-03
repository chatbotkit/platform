import { flatten, omit } from '@/lib/object'
import { escape } from '@/lib/regex'

export interface Reference {
  id?: string
  url: string
  name?: string
  description?: string
}

export function extractReferences(input: object): Reference[] {
  const extractedReferences: Array<Reference & { score: number }> = []

  // obtain a flat object with all properties

  const flatProperties = omit(flatten(input || {}), [/^_|\._/])

  // identify keys that contain URLs

  const urlKeys = Object.entries(flatProperties)
    .filter(
      ([, value]) => typeof value === 'string' && /^https?:\/\//.test(value)
    )
    .map(([key]) => key)

  // construct the items

  for (const urlKey of urlKeys) {
    const item: Reference = {
      url: flatProperties[urlKey],
    }

    const levelKey = urlKey.split('.').slice(0, -1).join('.')

    if (levelKey) {
      const informationKeys = Object.keys(flatProperties).filter((key) => {
        return (
          key.startsWith(levelKey + '.') &&
          /id|documentId|name|title|description|summary|excerpt|text/i.test(key)
        )
      })

      const firstMatchingName = (name: string, whole: boolean = false) => {
        const regex = whole
          ? new RegExp(`^${escape(name)}$`, 'i')
          : new RegExp(`${escape(name)}`, 'i')

        const found = informationKeys.find((key) =>
          regex.test(key.split('.').pop() || '')
        )

        if (found) {
          return flatProperties[found]
        }
      }

      item.id = firstMatchingName('id', true) || firstMatchingName('documentId')

      item.name = firstMatchingName('name') || firstMatchingName('title')

      item.description =
        firstMatchingName('description') ||
        firstMatchingName('summary') ||
        firstMatchingName('excerpt') ||
        firstMatchingName('text')
    }

    extractedReferences.push({
      ...item,

      score:
        (item.id ? 1 : 0) + (item.name ? 1 : 0) + (item.description ? 1 : 0),
    })
  }

  // extract items with unique urls, sorted by score

  extractedReferences.sort((a, b) => b.score - a.score)

  const uniqueUrls = new Set<string>()

  const uniqueReferences: Reference[] = []

  for (const reference of extractedReferences) {
    if (!uniqueUrls.has(reference.url)) {
      uniqueUrls.add(reference.url)

      uniqueReferences.push({
        id: reference.id,
        url: reference.url,
        name: reference.name,
        description: reference.description,
      })
    }
  }

  // return the items

  return uniqueReferences
}
