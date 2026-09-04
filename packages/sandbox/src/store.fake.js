// @note an in-memory stand-in for the storage contract, for the tests. It
// keeps the shape a real object store has - flat keys, a delimiter that
// groups them into "directories", paging - because those are the seams the
// mount driver is written against.

/**
 * @param {Record<string, string>} [initial] keys to contents, per scope-less key
 */
export function createFakeStore(initial = {}) {
  /** @type {Map<string, { bytes: Uint8Array, updatedAt: Date }>} */
  const objects = new Map()

  const put = (key, content) => {
    objects.set(key, {
      bytes:
        typeof content === 'string'
          ? new TextEncoder().encode(content)
          : new Uint8Array(content),
      updatedAt: new Date(),
    })
  }

  for (const [key, content] of Object.entries(initial)) {
    put(key, content)
  }

  const missing = (key) => {
    const error = new Error(`NoSuchKey: ${key}`)

    error.name = 'NoSuchKey'

    return error
  }

  return {
    objects,

    async listObjects(_scope, prefix, options = {}) {
      const { delimiter, maxKeys = 1000, continuationToken } = options

      const keys = [...objects.keys()].filter((key) => key.startsWith(prefix)).sort()

      const items = []
      const prefixes = new Set()

      for (const key of keys) {
        const rest = key.slice(prefix.length)

        if (delimiter && rest.includes(delimiter)) {
          prefixes.add(prefix + rest.slice(0, rest.indexOf(delimiter) + 1))
        } else {
          items.push({ key, size: objects.get(key).bytes.byteLength, updatedAt: objects.get(key).updatedAt })
        }
      }

      const start = continuationToken ? Number(continuationToken) : 0
      const page = items.slice(start, start + maxKeys)
      const truncated = start + maxKeys < items.length

      return {
        items: page,
        prefixes: start === 0 ? [...prefixes] : [],
        truncated,
        nextToken: truncated ? String(start + maxKeys) : undefined,
      }
    },

    async headObject(_scope, key) {
      const object = objects.get(key)

      if (!object) {
        throw missing(key)
      }

      return { size: object.bytes.byteLength, updatedAt: object.updatedAt }
    },

    async getObject(_scope, key) {
      const object = objects.get(key)

      if (!object) {
        throw missing(key)
      }

      const bytes = object.bytes

      return {
        size: bytes.byteLength,
        updatedAt: object.updatedAt,
        body: {
          arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
          text: async () => new TextDecoder().decode(bytes),
          stream: () => new Blob([bytes]).stream(),
        },
      }
    },

    async putObject(_scope, key, body) {
      put(key, body)
    },

    async moveObject(_scope, sourceKey, destinationKey) {
      const object = objects.get(sourceKey)

      if (!object) {
        throw missing(sourceKey)
      }

      objects.set(destinationKey, object)
      objects.delete(sourceKey)
    },

    async deleteObject(_scope, key) {
      objects.delete(key)
    },

    text(key) {
      const object = objects.get(key)

      return object ? new TextDecoder().decode(object.bytes) : undefined
    },
  }
}
