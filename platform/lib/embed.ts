import { omit } from '@/lib/object'
import { removeSpaces } from '@/lib/string'

/**
 * Remove new lines, collapse spaces and lowers the casing.
 */
export function prepareTextForEmbedding(text: string): string {
  text = removeSpaces(text).toLowerCase()

  return text
}

/**
 * Prepare meta by converting it to a flatter object.
 */
export function prepareMetaForEmbedding(
  meta: Record<string, unknown>
): Record<string, string | number | boolean> {
  return Object.fromEntries(
    Object.entries(omit(meta, [/^[\W_]/]))
      .map(([name, value]) => {
        switch (true) {
          case Array.isArray(value):
            value = value
              .map((value) => {
                switch (typeof value) {
                  case 'string':
                  case 'number':
                  case 'boolean':
                    return value

                  default:
                    return undefined
                }
              })
              // @note using != explicitly
              .filter((v) => v != null)
              .join(',')

          default: {
            switch (typeof value) {
              case 'string':
              case 'number':
              case 'boolean':
                break

              default:
                value = undefined
            }
          }
        }

        return [name, value]
      })
      .filter(([, value]) => {
        return value !== undefined
      })
  )
}
