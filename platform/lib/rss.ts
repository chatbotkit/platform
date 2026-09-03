import { url } from '@/lib/url'

interface FileInfo {
  pathname: string
  type: string
}

interface RssItem {
  preview?: FileInfo
  file?: FileInfo
  image?: string
  card?: string
  thumbnail?: string
}

interface Enclosure {
  enclosure: {
    _attrs: {
      url: string
      type: string
    }
  }
}

/**
 * Generates RSS enclosure elements from an item's media
 */
export function getEnclosure(item: RssItem): Enclosure[] {
  const items: Enclosure[] = []

  switch (true) {
    case !!item.preview: {
      items.push({
        enclosure: {
          _attrs: {
            url: url(item.preview!.pathname, process.env.SITE_URL!),
            type: item.preview!.type,
          },
        },
      })

      break
    }

    case !!item.file: {
      items.push({
        enclosure: {
          _attrs: {
            url: url(item.file!.pathname, process.env.SITE_URL!),
            type: item.file!.type,
          },
        },
      })

      break
    }

    case !!(item.image || item.card || item.thumbnail): {
      items.push({
        enclosure: {
          _attrs: {
            url: item.image || item.card || item.thumbnail!,
            type: 'image/png',
          },
        },
      })

      break
    }
  }

  return items
}
