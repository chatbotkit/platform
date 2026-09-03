// @ts-check
import prisma from '@/prisma/client'

import { encode } from '@/lib/b64'
import { parseDataURL } from '@/lib/dataurl.parse'
import debug from '@/lib/debug'
import fetch from '@/lib/egress.fetch'
import { getContentTypeHeader } from '@/lib/header'
import schema, { schemaErrorToError } from '@/lib/joi.handler'
import { withAny } from '@/lib/method'
import { catchAllParam, requiredUrlParam } from '@/lib/query.get'
import { parseRequestJson } from '@/lib/request'
import {
  badRequest,
  limitsReached,
  methodNotAllowed,
  notAuthorized,
  notFound,
  ok,
  respondFromError,
} from '@/lib/response'
import { withSession } from '@/lib/session.handler'
import {
  getSpaceStorageFileName,
  getStorageFileUploadUrl,
  storageDirectoryExists,
  uploadStorageFile,
} from '@/lib/space.storage'
import { normalizeText } from '@/lib/string'
import { getUploadFile } from '@/lib/upload'
import { getMaxFileSize } from '@/lib/user.limits'

export const bodySchema = schema.object({
  file: schema.alternatives().try(
    schema.string().uri().required(),

    schema.object({
      type: schema.string().required(),
      size: schema.number().required(),
      meta: schema.object().pattern(schema.string(), schema.string()),
    })
  ),
})

/**
 * @swagger
 *
 * /space/{spaceId}/storage/upload/{path}:
 *   post:
 *     operationId: uploadSpaceStoragePath
 *     summary: Upload a file to space storage
 *     description: |
 *       Upload a file to space storage. The file path is specified in the URL
 *       after /upload/. The file can be specified either as a HTTP URL, a data
 *       URL, a multipart/form-data, or as a raw file stream. The maximum file
 *       size for uploads is determined dynamically based on user limits and
 *       configuration, and may vary.
 *     tags:
 *       - Space Storage
 *     parameters:
 *       - in: path
 *         name: spaceId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: path
 *         required: true
 *         schema:
 *           description: The file path
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             oneOf:
 *               - type: object
 *                 properties:
 *                   file:
 *                     description: "The file to upload either as http: or data: URL"
 *                     type: string
 *               - type: object
 *                 properties:
 *                   file:
 *                     description: The file definition to upload
 *                     type: object
 *                     properties:
 *                       type:
 *                         description: The file type
 *                         type: string
 *                       size:
 *                         description: The file size
 *                         type: number
 *                       meta:
 *                         description: Optional metadata
 *                         type: object
 *                     required:
 *                       - type
 *                       - size
 *             required:
 *               - file
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file:
 *                 description: The file to upload
 *                 type: string
 *                 format: binary
 *             required:
 *               - file
 *         any/any:
 *           schema:
 *             type: string
 *             format: binary
 *     responses:
 *       200:
 *         description: The file was uploaded successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   description: The ID of the uploaded file
 *                   type: string
 *                 path:
 *                   type: string
 *                   description: The path where the file is stored
 *                 uploadRequest:
 *                   description: The request required to upload the file
 *                   type: object
 *                   properties:
 *                     method:
 *                       description: The HTTP method to use
 *                       type: string
 *                     url:
 *                       description: The HTTP url to use
 *                       type: string
 *                     headers:
 *                       description: The HTTP headers to use
 *                       type: object
 *                   required:
 *                     - method
 *                     - url
 *                     - headers
 *               required:
 *                 - id
 *                 - path
 *       default:
 *         $ref: '#/components/responses/ErrorResponse'
 */
export default withAny(
  withSession(async function (req, session) {
    if (req.method !== 'POST') {
      return methodNotAllowed()
    }

    const spaceId = requiredUrlParam(req, 'spaceId')

    const path = catchAllParam(req, 'path').join('/') || null

    if (!path) {
      return badRequest()
    }

    const pathId = encode(path, true)

    const space = await prisma.space.findUniqueByIdentifier(
      session.user,
      spaceId,
      {
        select: {
          id: true,
          userId: true,
        },
      }
    )

    if (!space) {
      return notFound()
    }

    if (space.userId !== session.user.id) {
      return notAuthorized()
    }

    // @todo support uploading directories (as zip?)

    if (await storageDirectoryExists({ spaceId: space.id, pathId })) {
      return badRequest()
    }

    const contentTypeHeader = getContentTypeHeader(req, true)

    const maxFileSize = await getMaxFileSize(session.user)

    let finalUploadRequest

    switch (true) {
      case contentTypeHeader === 'application/json': {
        const body = await parseRequestJson(req)

        const { value, error } = bodySchema.validate(body)

        if (error) {
          return respondFromError(schemaErrorToError(error))
        }

        switch (true) {
          case /^https?:\/\//.test(value.file): {
            debug(`fetching HTTP URL`).log('api.v1.space.storage.upload')

            const response = await fetch(value.file)

            if (!response.ok) {
              debug(`failed to fetch HTTP URL`, {
                status: response.status,
                statusText: response.statusText,
              }).log('api.v1.space.storage.upload')

              return badRequest()
            }

            const data = await response.arrayBuffer()
            const size = data.byteLength
            const type = getContentTypeHeader(response, true)

            debug(`checking file size`, { size }).log(
              'api.v1.space.storage.upload'
            )

            if (size > maxFileSize) {
              return limitsReached()
            }

            debug(`uploading file`, { size, type }).log(
              'api.v1.space.storage.upload'
            )

            await uploadStorageFile({
              spaceId: space.id,
              pathId: pathId,
              body: new Uint8Array(data),
              contentType: type,
            })

            finalUploadRequest = undefined

            debug(`file upload completed`, {
              finalUploadRequest,
            }).log('api.v1.space.storage.upload')

            break
          }

          case /^data:/.test(value.file): {
            debug(`parsing data URL`).log('api.v1.space.storage.upload')

            const { data: _data, type: _type } = parseDataURL(value.file)

            const data = Buffer.from(_data)
            const size = data.length
            const type = _type

            debug(`checking file size`, { size }).log(
              'api.v1.space.storage.upload'
            )

            if (size > maxFileSize) {
              return limitsReached()
            }

            debug(`uploading file`, {
              // data,
              size,
              type,
            }).log('api.v1.space.storage.upload')

            await uploadStorageFile({
              spaceId: space.id,
              pathId: pathId,
              body: new Uint8Array(data),
              contentType: type,
            })

            finalUploadRequest = undefined

            debug(`file upload completed`, {
              finalUploadRequest,
            }).log('api.v1.space.storage.upload')

            break
          }

          case typeof value.file === 'object' && value.file !== null: {
            debug(`checking file size`, { size: value.file.size }).log(
              'api.v1.space.storage.upload'
            )

            if (value.file.size > maxFileSize) {
              return limitsReached()
            }

            // @note we need to encode the content type just in case it contains non-ASCII characters

            const contentType = value.file.type
              ? normalizeText(value.file.type)
              : ''

            // @note we need to encode the content name just in case it contains non-ASCII characters

            const contentName = encodeURIComponent(
              normalizeText(
                getSpaceStorageFileName({ spaceId: space.id, pathId })
              )
            )

            const url = await getStorageFileUploadUrl({
              spaceId: space.id,
              pathId: pathId,
              size: value.file.size,
              type: contentType,
              metadata: value.file.meta,
            })

            finalUploadRequest = {
              method: 'PUT',
              url: url,
              headers: {
                'Content-Length': value.file.size.toString(),

                'Content-Type': contentType,

                ...(contentName && {
                  'Content-Disposition': `attachment; filename=${contentName}`,
                }),
              },
            }

            debug(`obtained upload request`, {
              finalUploadRequest,
            }).log('api.v1.space.storage.upload')

            break
          }

          default: {
            return badRequest()
          }
        }

        break
      }

      case contentTypeHeader === 'multipart/form-data': {
        debug(`obtaining incoming file stream`).log(
          'api.v1.space.storage.upload'
        )

        const file = await getUploadFile(req)

        const data = await file.arrayBuffer()
        const size = file.size
        const type = file.type

        debug(`checking file size`, { size }).log('api.v1.space.storage.upload')

        if (size > maxFileSize) {
          return limitsReached()
        }

        debug(`uploading file`, {
          // data,
          size,
          type,
        }).log('api.v1.space.storage.upload')

        await uploadStorageFile({
          spaceId: space.id,
          pathId: pathId,
          body: new Uint8Array(data),
          contentType: type,
        })

        finalUploadRequest = undefined

        debug(`file upload completed`, {
          finalUploadRequest,
        }).log('api.v1.space.storage.upload')

        break
      }

      default: {
        debug(`obtaining incoming file stream`).log(
          'api.v1.space.storage.upload'
        )

        const data = await req.arrayBuffer()
        const size = data.byteLength
        const type = contentTypeHeader

        debug(`checking file size`, { size }).log('api.v1.space.storage.upload')

        if (size > maxFileSize) {
          return limitsReached()
        }

        debug(`uploading file`, {
          // data,
          size,
          type,
        }).log('api.v1.space.storage.upload')

        await uploadStorageFile({
          spaceId: space.id,
          pathId: pathId,
          body: new Uint8Array(data),
          contentType: type || undefined,
        })

        finalUploadRequest = undefined

        debug(`file upload completed`, {
          finalUploadRequest,
        }).log('api.v1.space.storage.upload')

        break
      }
    }

    return ok({
      id: pathId,
      path: path,
      uploadRequest: finalUploadRequest,
    })
  })
)

export const config = {
  api: {
    bodyParser: false,
  },
}

/**
 * @manual Space Storage
 * @description Space storage provides file management capabilities within spaces, enabling secure file uploads, downloads, and organization with flexible path-based addressing.
 * @category Objects/Spaces
 * @tags space, storage, files
 * @index 16
 *
 * Space storage extends the spaces feature by providing dedicated file storage
 * capabilities for each workspace. This allows teams to store, organize, and
 * manage files directly within their spaces, creating a complete collaborative
 * environment that includes both conversational data and file assets.
 *
 * ## Understanding Space Storage
 *
 * Each space has its own isolated storage area, ensuring that files remain
 * organized and secure within their respective workspace contexts. Files are
 * addressed using path-based URLs, providing a familiar hierarchical structure
 * similar to traditional file systems.
 *
 * The storage system supports various file types and sizes, with limits
 * determined by your account configuration. Files can be uploaded through
 * multiple methods including direct binary uploads, multipart form data,
 * HTTP URLs, and data URLs, providing flexibility for different integration
 * scenarios.
 *
 * ## Uploading Files
 *
 * Uploading files to space storage is flexible and supports multiple input
 * methods to accommodate different use cases and integration patterns. The
 * system automatically handles file validation, size checks, and secure
 * storage placement.
 *
 * ### Direct Binary Upload
 *
 * For direct binary uploads, send the file content as the request body with
 * the appropriate content type and the file path in the URL:
 *
 * ```http
 * POST /api/v1/space/{spaceId}/storage/upload/photos/profile.png
 * Content-Type: image/png
 *
 * [binary file data]
 * ```
 *
 * ### Multipart Form Upload
 *
 * For traditional form-based uploads, use multipart/form-data encoding:
 *
 * ```http
 * POST /api/v1/space/{spaceId}/storage/upload/photos/profile.png
 * Content-Type: multipart/form-data; boundary=----WebKitFormBoundary
 *
 * ------WebKitFormBoundary
 * Content-Disposition: form-data; name="file"; filename="profile.png"
 * Content-Type: image/png
 *
 * [binary file data]
 * ------WebKitFormBoundary--
 * ```
 *
 * ### Upload via HTTP URL
 *
 * To upload a file from an existing HTTP URL, provide the URL in a JSON
 * request body:
 *
 * ```http
 * POST /api/v1/space/{spaceId}/storage/upload/photos/profile.png
 * Content-Type: application/json
 *
 * {
 *   "file": "https://example.com/images/profile.png"
 * }
 * ```
 *
 * ### Upload via Data URL
 *
 * For small files or inline data, use data URLs:
 *
 * ```http
 * POST /api/v1/space/{spaceId}/storage/upload/photos/profile.png
 * Content-Type: application/json
 *
 * {
 *   "file": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAUA..."
 * }
 * ```
 *
 * ### Two-Stage Upload for Large Files
 *
 * For large files or when you need more control over the upload process, use
 * the two-stage upload approach:
 *
 * ```http
 * POST /api/v1/space/{spaceId}/storage/upload/photos/profile.png
 * Content-Type: application/json
 *
 * {
 *   "file": {
 *     "type": "image/png",
 *     "size": 1024000,
 *     "meta": {
 *       "description": "User profile photo"
 *     }
 *   }
 * }
 * ```
 *
 * This returns an `uploadRequest` object with the URL and headers needed to
 * complete the upload:
 *
 * ```json
 * {
 *   "id": "cGhvdG9zL3Byb2ZpbGUucG5n",
 *   "path": "photos/profile.png",
 *   "uploadRequest": {
 *     "method": "PUT",
 *     "url": "https://storage.example.com/upload/...",
 *     "headers": {
 *       "Content-Type": "image/png",
 *       "Content-Length": "1024000"
 *     }
 *   }
 * }
 * ```
 *
 * Then complete the upload by sending the file to the provided URL.
 *
 * ## File Size Limits
 *
 * Upload size limits are determined by your account configuration and are
 * enforced during the upload process. If a file exceeds your limit, the
 * upload will be rejected with a limits reached error. Check your account
 * settings to view your current file size limits.
 *
 * ## Important Considerations
 *
 * - **Path Conflicts:** Uploading to an existing file path will overwrite
 *   the previous file. Ensure unique paths to preserve existing files.
 *
 * - **Directory Validation:** You cannot upload to a path that already
 *   exists as a directory. The system validates this to maintain storage
 *   integrity.
 *
 * - **Content Type Detection:** For direct binary uploads, provide accurate
 *   Content-Type headers to ensure proper file handling and future retrieval.
 */
