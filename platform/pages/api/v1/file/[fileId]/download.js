/* eslint-disable custom-eslint-rules/no-plain-fetch-in-routes -- operator storage (presigned object URL) */
// @ts-check
import prisma from '@/prisma/client'
import { FileVisibility } from '@/prisma/types'

import { CACHE_PRESETS, getCacheHeaders } from '@/lib/cdn'
import fetch from '@/lib/fetch'
import {
  getAcceptHeader,
  getContentDispositionHeader,
  getContentTypeHeader,
} from '@/lib/header'
import { withGet } from '@/lib/method'
import { queryParam, requiredUrlParam } from '@/lib/query.get'
import {
  captureUnknownException,
  noContent,
  notAuthorized,
  notFound,
  ok,
  respondFromError,
  send,
} from '@/lib/response'
import { getSession } from '@/lib/session.get'
import { getObjectDownloadUrl } from '@/lib/storage'
import { getRandomId } from '@/lib/string'
import { joinPaths } from '@/lib/url'

/**
 * @swagger
 *
 * /file/{fileId}/download:
 *   get:
 *     operationId: downloadFile
 *     summary: Download a file
 *     description: |
 *       Download a file. If the file is not public, the user must be
 *       authenticated.
 *     tags:
 *       - File
 *     parameters:
 *       - in: path
 *         name: fileId
 *         required: true
 *         schema:
 *           description: The ID of the file to download
 *           type: string
 *     responses:
 *       200:
 *         description: The file was downloaded successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 url:
 *                   description: The URL to download the file
 *                   type: string
 *               required:
 *                 - url
 *           any/any:
 *             schema:
 *               type: string
 *               format: binary
 *       204:
 *         description: The file resource exists but has no content stored yet
 *       default:
 *         $ref: '#/components/responses/ErrorResponse'
 */
export default withGet(async function (req) {
  const cache = queryParam(req, 'cache') === 'true'

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

  const url = await getObjectDownloadUrl(
    'file',
    joinPaths(file.id, 'original')
  )

  const response = await fetch(url)

  const accept = getAcceptHeader(req, 'application/octet-stream')

  if (!response.ok) {
    // @note the file resource exists but has no content stored yet;
    // return 204 for binary/text requests so callers can open an editor with
    // empty content, but keep 404 for JSON requests since there is no URL
    if (accept === 'application/json') {
      return notFound()
    }

    return noContent()
  }

  const cacheHeaders = cache
    ? getCacheHeaders({
        ...CACHE_PRESETS.URL,
        visibility:
          file.visibility === FileVisibility.public ? 'public' : 'private',
      })
    : null

  switch (accept) {
    case 'application/json': {
      return ok({ url })
    }
  }

  return send(response.body, {
    'Content-Type': getContentTypeHeader(response, 'application/octet-stream'),
    'Content-Disposition': getContentDispositionHeader(
      response,
      `attachment; filename="${file.name?.trim() || getRandomId('file-')}.bin"`
    ),

    ...(cacheHeaders || null),
  })
})

/**
 * @manual Files
 *
 * ## Downloading Files
 *
 * Downloading file content is a core operation that allows you to retrieve the
 * actual data stored in a file resource. The download endpoint provides
 * flexible access options including direct binary streaming and URL
 * redirection, accommodating different client requirements and use cases.
 *
 * To download a file's content, make a GET request to the download endpoint:
 *
 * ```http
 * GET /api/v1/file/{fileId}/download
 * ```
 *
 * Replace `{fileId}` with the ID of the file you want to download. The behavior
 * of this endpoint depends on the file's visibility setting and your
 * authentication status:
 *
 * **Private Files**: If the file visibility is set to `private`, you must be
 * authenticated and be the owner of the file to download it. The API performs
 * security checks to verify ownership before allowing access to the content.
 *
 * **Public Files**: If the file visibility is set to `public`, anyone can
 * download the file without authentication, making it suitable for publicly
 * shared resources like documentation, images, or datasets that should be
 * accessible to all users.
 *
 * ### Response Formats
 *
 * The download endpoint supports two response formats based on the `Accept`
 * header:
 *
 * **Direct Binary Download** (default):
 *
 * ```http
 * GET /api/v1/file/{fileId}/download
 * Accept: application/octet-stream
 * ```
 *
 * This returns the file content directly as a binary stream with appropriate
 * `Content-Type` and `Content-Disposition` headers. The filename in the
 * response will match the file's name field or default to a generated name.
 *
 * **URL Response**:
 *
 * ```http
 * GET /api/v1/file/{fileId}/download
 * Accept: application/json
 * ```
 *
 * This returns a JSON object containing a pre-signed URL that you can use to
 * download the file:
 *
 * ```json
 * {
 *   "url": "https://storage.example.com/files/abc123/original?signature=..."
 * }
 * ```
 *
 * **Important Note:** The download endpoint streams content from secure storage
 * services and handles all necessary authentication and authorization. For
 * large files or high-traffic scenarios, consider using the JSON response
 * format to obtain a direct storage URL, which can reduce load on your
 * application servers.
 */

// @todo add documentation about caching options and performance optimization for file downloads
