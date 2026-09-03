// @ts-check
import { buildFileIconSvg } from '@/lib/file.icon'

import prisma from '@/prisma/client'
import { FileVisibility } from '@/prisma/types'

import { CACHE_PRESETS, getCacheHeaders } from '@/lib/cdn'
import { getFileInstance } from '@/lib/file.storage'
import { getExternalAPIHostURL } from '@/lib/host'
import { createThumbnail, isSupportedImageType } from '@/lib/image.transform'
import { withGet } from '@/lib/method'
import { getQuery, queryParam, requiredUrlParam } from '@/lib/query.get'
import {
  captureUnknownException,
  notAuthorized,
  notFound,
  redirect,
  respondFromError,
  send,
} from '@/lib/response'
import { getSession } from '@/lib/session.get'

export default withGet(async function (req) {
  const cache = queryParam(req, 'cache') === 'true'
  const strategy = queryParam(req, 'strategy') || undefined

  const file = await prisma.file.findUnique({
    where: {
      id: requiredUrlParam(req, 'fileId'),
    },

    // @todo how do I invalidate the cache based on the cache key
    ...(cache
      ? {
          cacheStrategy: {
            swr: 60,
            ttl: 60,
          },
        }
      : {}),
  })

  if (!file) {
    return notFound()
  }

  if (file.visibility === FileVisibility.public) {
    // @note the file is public so no need to check if the user is authenticated
  } else {
    try {
      const session = await getSession(req)

      if (file.userId !== session.user.id) {
        return notAuthorized()
      }
    } catch (e) {
      await captureUnknownException(e)

      return respondFromError(e)
    }
  }

  const contentType = file.meta?.contentType || 'application/octet-stream'

  const cacheHeaders = cache
    ? getCacheHeaders({
        ...CACHE_PRESETS.URL,
        visibility:
          file.visibility === FileVisibility.public ? 'public' : 'private',
      })
    : null

  // @note when strategy is 'auto' and the file is a GIF, redirect to the
  // original file to preserve animation

  if (strategy === 'auto') {
    if (contentType === 'image/gif') {
      const u = new URL(
        `/api/v1/file/${file.id}/download`,
        process.env.SITE_URL
      )

      for (const [key, value] of Object.entries(getQuery(req))) {
        const array = []

        if (Array.isArray(value)) {
          array.push(...value)
        } else {
          if (value) {
            array.push(value)
          }
        }

        for (const item of array) {
          u.searchParams.append(key, item)
        }
      }

      return redirect(new URL(getExternalAPIHostURL(u.pathname + u.search)))
    }
  }

  if (isSupportedImageType(contentType)) {
    try {
      const fileInstance = await getFileInstance(file.id)

      if (!fileInstance) {
        return notFound()
      }

      const imageData = await fileInstance.arrayBuffer()
      const { buffer: thumbnailBuffer, mimeType } = await createThumbnail(
        imageData,
        { contentType }
      )

      return send(thumbnailBuffer, {
        'Content-Type': mimeType,

        ...(cacheHeaders || null),
      })
    } catch (e) {
      await captureUnknownException(e)

      // @note fallback to icon on error
    }
  }

  // @note for non-supported image types or on error, serve a generated icon
  // labeled from the file name / content type - see lib/file.icon.ts

  return send(buildFileIconSvg(file.name, { contentType }), {
    'Content-Type': 'image/svg+xml',

    ...(cacheHeaders || null),
  })
})

// @todo add comprehensive documentation about thumbnail transformations including caching, version control, and advanced features
