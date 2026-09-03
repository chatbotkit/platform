// @ts-check
import prisma from '@/prisma/client'

import { parseDataURL } from '@/lib/dataurl.parse'
import debug from '@/lib/debug'
import fetch from '@/lib/egress.fetch'
import {
  getFileObjectDownloadUrl,
  getFileObjectUploadUrl,
  uploadFileObject,
} from '@/lib/file.storage'
import { getContentTypeHeader } from '@/lib/header'
import schema, { schemaErrorToError } from '@/lib/joi.handler'
import { withAny } from '@/lib/method'
import { typeToFileName } from '@/lib/mime'
import { nameToType } from '@/lib/mime2'
import { requiredUrlParam } from '@/lib/query.get'
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
import { normalizeText } from '@/lib/string'
import { getUploadFile } from '@/lib/upload'
import { getMaxFileSize } from '@/lib/user.limits'

export const bodySchema = schema.object({
  file: schema.alternatives().try(
    schema.string().uri().required(),

    schema.object({
      type: schema.string().allow('').required(),
      size: schema.number().required(),
      name: schema.string().allow(null, ''),
    })
  ),
})

/**
 * @swagger
 *
 * /file/{fileId}/upload:
 *   post:
 *     operationId: uploadFile
 *     summary: Upload the specified file
 *     description: |
 *       Upload the specified file to the file storage service. The file can be
 *       specified either as a HTTP URL, a data URL, a multipart/form-data, or
 *       as a raw file stream. There is currently a limit of 4.5MB for files
 *       uploaded via all available methods except for direct-to-source uploads
 *       when using application/json request body with a file object.
 *     tags:
 *       - File
 *     parameters:
 *       - in: path
 *         name: fileId
 *         required: true
 *         schema:
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
 *                       name:
 *                         description: The file name
 *                         type: string
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
 *         description: The file was upload successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   description: The ID of the upload file
 *                   type: string
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
 *       default:
 *         $ref: '#/components/responses/ErrorResponse'
 */
export default withAny(
  withSession(async function (req, session) {
    if (req.method !== 'POST') {
      return methodNotAllowed()
    }

    const file = await prisma.file.findUniqueByIdentifier(
      session.user,
      requiredUrlParam(req, 'fileId')
    )

    if (!file) {
      return notFound()
    }

    if (file.userId !== session.user.id) {
      return notAuthorized()
    }

    const contentTypeHeader = getContentTypeHeader(req, true)

    const maxFileSize = await getMaxFileSize(session.user)

    let finalContentType

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
            debug(`uploading file from URL`).log('api.v1.file.upload')

            const response = await fetch(value.file)

            if (!response.ok) {
              return badRequest()
            }

            const data = new Uint8Array(await response.arrayBuffer())
            const size = data.byteLength
            const type = getContentTypeHeader(response, true)

            debug(`checking file size`, { size })

            if (size > maxFileSize) {
              return limitsReached()
            }

            debug(`uploading file to S3`, { size, type })

            await uploadFileObject(file.id, data, {
              contentType: type,
            })

            finalContentType = type

            finalUploadRequest = undefined

            debug(`file upload completed`, {
              finalContentType,
              finalUploadRequest,
            })

            break
          }

          case /^data:/.test(value.file): {
            debug(`parsing data URL`).log('api.v1.file.upload')

            const { data: _data, type: _type } = parseDataURL(value.file)

            const data = _data
            const size = data.byteLength
            const type = _type
            const name = typeToFileName(type)

            debug(`checking file size`, { size }).log('api.v1.file.upload')

            if (size > maxFileSize) {
              return limitsReached()
            }

            debug(`uploading file`, {
              // data,
              size,
              type,
              name,
            }).log('api.v1.file.upload')

            await uploadFileObject(file.id, data, {
              contentType: type,
            })

            finalContentType = type

            finalUploadRequest = undefined

            debug(`file upload completed`, {
              finalContentType,
              finalUploadRequest,
            }).log('api.v1.file.upload')

            break
          }

          case typeof value.file === 'object' && value.file !== null: {
            debug(`checking file size`, { size: value.file.size }).log(
              'api.v1.file.upload'
            )

            if (value.file.size > maxFileSize) {
              return limitsReached()
            }

            // @note we need to encode the content name just in case it contains non-ASCII characters

            const contentName = value.file.name
              ? encodeURIComponent(normalizeText(value.file.name))
              : ''

            // @note browsers may provide an empty MIME type for some files

            const contentType = value.file.type
              ? normalizeText(value.file.type)
              : nameToType(value.file.name || '')

            const url = await getFileObjectUploadUrl(file.id, {
              size: value.file.size,
              type: contentType,
              name: contentName,
            })

            finalContentType = contentType

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
              finalContentType,
              finalUploadRequest,
            }).log('api.v1.file.upload')

            break
          }

          default: {
            return badRequest()
          }
        }

        break
      }

      case contentTypeHeader === 'multipart/form-data': {
        debug(`obtaining incoming file stream`).log('api.v1.file.upload')

        const fileObject = await getUploadFile(req)

        const data = new Uint8Array(await fileObject.arrayBuffer())
        const size = fileObject.size
        const type = fileObject.type
        const name = fileObject.name

        debug(`checking file size`, { size }).log('api.v1.file.upload')

        if (size > maxFileSize) {
          return limitsReached()
        }

        debug(`uploading file`, {
          // data,
          size,
          type,
          name,
        }).log('api.v1.file.upload')

        await uploadFileObject(file.id, data, {
          contentType: type,
        })

        finalContentType = type

        finalUploadRequest = undefined

        debug(`file upload completed`, {
          finalContentType,
          finalUploadRequest,
        }).log('api.v1.file.upload')

        break
      }

      default: {
        debug(`obtaining incoming file stream`).log('api.v1.file.upload')

        const data = new Uint8Array(await req.arrayBuffer())
        const size = data.byteLength
        const type = contentTypeHeader
        const name = typeToFileName(type)

        debug(`checking file size`, { size }).log('api.v1.file.upload')

        if (size > maxFileSize) {
          return limitsReached()
        }

        debug(`uploading file`, {
          // data,
          size,
          type,
          name,
        }).log('api.v1.file.upload')

        await uploadFileObject(file.id, data, {
          contentType: type,
        })

        finalContentType = type

        finalUploadRequest = undefined

        debug(`file upload completed`, {
          finalContentType,
          finalUploadRequest,
        }).log('api.v1.file.upload')

        break
      }
    }

    const finalDownloadRequest = {
      method: 'GET',
      url: await getFileObjectDownloadUrl(file.id),
      headers: {},
    }

    await prisma.file.update({
      where: {
        id: file.id,
      },

      data: {
        meta: {
          ...file.meta,

          contentType: finalContentType,
        },
      },
    })

    return ok({
      id: file.id,
      uploadRequest: finalUploadRequest,
      downloadRequest: finalDownloadRequest,
    })
  })
)

export const config = {
  api: {
    bodyParser: false,
  },
}

/**
 * @manual Files
 * @index 10
 *
 * ## Uploading File Content
 *
 * Uploading actual content to a file is a critical operation that stores your
 * data in the platform's secure storage system. The upload endpoint provides
 * multiple flexible methods to accommodate different file sizes, source
 * locations, and client capabilities, ensuring you can efficiently upload
 * content regardless of your specific requirements.
 *
 * After creating a file record using the create endpoint, you use the file ID
 * to upload content. The platform supports several upload methods, each
 * optimized for different scenarios ranging from small embedded files to large
 * multi-gigabyte resources.
 *
 * ### Upload Methods Overview
 *
 * The upload endpoint intelligently handles different content types and sources
 * based on the request format:
 *
 * **URL-Based Upload**: Provide an HTTP URL to a publicly accessible file, and
 * the platform will fetch and store the content. This method is ideal for
 * importing files from external sources or content delivery networks.
 *
 * **Data URL Upload**: Embed small files directly in the request as base64-encoded
 * data URLs, suitable for files under 4.5MB like images, documents, or
 * configuration files.
 *
 * **Multipart Form Upload**: Use standard multipart/form-data encoding, which is
 * the traditional method supported by web browsers and most HTTP clients, also
 * limited to 4.5MB.
 *
 * **Raw Stream Upload**: Send the file content directly in the request body with
 * appropriate Content-Type header, ideal for programmatic uploads up to 4.5MB.
 *
 * **Direct-to-Storage Upload**: For files larger than 4.5MB, request pre-signed
 * upload credentials and upload directly to the storage service, bypassing API
 * size limits and improving performance for large files.
 *
 * ### Method 1: URL-Based Upload
 *
 * ```http
 * POST /api/v1/file/{fileId}/upload
 * Content-Type: application/json
 *
 * {
 *   "file": "https://example.com/documents/report.pdf"
 * }
 * ```
 *
 * The platform fetches the file from the provided URL and stores it securely.
 * This method works with any publicly accessible HTTP or HTTPS URL.
 *
 * ### Method 2: Data URL Upload
 *
 * ```http
 * POST /api/v1/file/{fileId}/upload
 * Content-Type: application/json
 *
 * {
 *   "file": "data:text/csv;base64,SGVhZGVyMSxIZWFkZXIyCkRhdGExLERhdGEy"
 * }
 * ```
 *
 * Encode your file content as a base64 data URL with the appropriate MIME type.
 * This method is convenient for small files and embedded content.
 *
 * ### Method 3: Multipart Form Data Upload
 *
 * ```http
 * POST /api/v1/file/{fileId}/upload
 * Content-Type: multipart/form-data; boundary=----WebKitFormBoundary
 *
 * ------WebKitFormBoundary
 * Content-Disposition: form-data; name="file"; filename="document.pdf"
 * Content-Type: application/pdf
 *
 * [binary file content]
 * ------WebKitFormBoundary--
 * ```
 *
 * Standard multipart upload supported by all major HTTP clients and browsers.
 *
 * ### Method 4: Raw Stream Upload
 *
 * ```http
 * POST /api/v1/file/{fileId}/upload
 * Content-Type: application/pdf
 *
 * [binary file content]
 * ```
 *
 * Send the file content directly as the request body with the appropriate
 * Content-Type header. This is the simplest method for programmatic uploads.
 *
 * ### Method 5: Direct-to-Storage Upload (For Large Files)
 *
 * First, request upload credentials by providing file metadata:
 *
 * ```http
 * POST /api/v1/file/{fileId}/upload
 * Content-Type: application/json
 *
 * {
 *   "file": {
 *     "type": "video/mp4",
 *     "size": 104857600,
 *     "name": "presentation.mp4"
 *   }
 * }
 * ```
 *
 * The response includes pre-signed upload credentials:
 *
 * ```json
 * {
 *   "id": "file_abc123",
 *   "uploadRequest": {
 *     "method": "PUT",
 *     "url": "https://storage.example.com/...",
 *     "headers": {
 *       "Content-Length": "104857600",
 *       "Content-Type": "video/mp4",
 *       "Content-Disposition": "attachment; filename=presentation.mp4"
 *     }
 *   }
 * }
 * ```
 *
 * Then use the provided credentials to upload directly to storage:
 *
 * ```http
 * PUT https://storage.example.com/...
 * Content-Length: 104857600
 * Content-Type: video/mp4
 * Content-Disposition: attachment; filename=presentation.mp4
 *
 * [binary file content]
 * ```
 *
 * ### File Size Limits
 *
 * File size limits vary based on the upload method and your account tier:
 *
 * - **API-Based Methods** (URL, data URL, multipart, raw stream): Up to 4.5MB
 * - **Direct-to-Storage Method**: Size limits based on your account tier,
 *   typically much larger
 *
 * If you exceed size limits, you'll receive a limits reached error. Use the
 * direct-to-storage method for large files.
 *
 * **Important Notes:**
 *
 * - Uploading new content to a file replaces any existing content
 * - The file's metadata (content type) is automatically updated based on the
 *   uploaded content
 * - All uploads are performed securely with appropriate authentication and
 *   authorization checks
 * - Upload operations are atomic - if an upload fails, the previous content (if
 *   any) remains unchanged
 */

/**
 * @manual Dataset Files
 * @index 2
 *
 * ## Uploading File Content
 *
 * There are multiple ways to upload file content to be used as a data source
 * for your datasets.
 *
 * ### Upload via JSON URL or Data URL
 *
 * You can upload a file by providing a HTTP URL or a data URL in a JSON
 * request body. This method is suitable for smaller files (up to 4.5MB).
 *
 * ```http
 * POST /api/v1/file/{fileId}/upload
 * Content-Type: application/json
 *
 * {
 *   "file": "https://example.com/path/to/your/file.csv"
 * }
 * ```
 *
 * or
 *
 * ```http
 * POST /api/v1/file/{fileId}/upload
 * Content-Type: application/json
 *
 * {
 *   "file": "data:text/csv;base64,SGVhZGVyMSxIZWFkZXIyCkRhdGExLERhdGEyCg=="
 * }
 * ```
 *
 * ### Upload via Multipart/Form-Data
 *
 * You can upload a file using multipart/form-data. This method is suitable
 * for files up to 4.5MB.
 *
 * ```http
 * POST /api/v1/file/{fileId}/upload
 * Content-Type: multipart/form-data; boundary=----WebKitFormBoundary7MA4YWxkTrZu0gW
 *
 * ------WebKitFormBoundary7MA4YWxkTrZu0gW
 * Content-Disposition: form-data; name="file"; filename="file.csv"
 * Content-Type: text/csv
 *
 * Header1,Header2
 * Data1,Data2
 * ------WebKitFormBoundary7MA4YWxkTrZu0gW--
 * ```
 *
 * ### Upload via Raw File Stream
 *
 * You can upload a file by sending the raw file stream in the request body.
 * This method is suitable for files up to 4.5MB.
 *
 * ```http
 * POST /api/v1/file/{fileId}/upload
 * Content-Type: text/csv
 *
 * Header1,Header2
 * Data1,Data2
 * ```
 *
 * ### Direct-to-Source Uploads
 *
 * For larger files or more control over the upload process, you can obtain
 * a pre-signed upload request by providing the file metadata in a JSON
 * request body. You can then use the provided upload request to upload the
 * file directly to the storage service.
 *
 * ```http
 * POST /api/v1/file/{fileId}/upload
 * Content-Type: application/json
 *
 * {
 *   "file": {
 *     "type": "text/csv",
 *     "size": 10485760,
 *     "name": "large_file.csv"
 *   }
 * }
 * ```
 *
 * The response will include an `uploadRequest` object with the necessary
 * details to perform the upload.
 *
 * ```json
 * {
 *   "id": "fileId",
 *   "uploadRequest": {
 *     "method": "PUT",
 *     "url": "https://direct-upload-url/path/to/upload",
 *     "headers": {
 *       "Content-Length": "10485760",
 *       "Content-Type": "text/csv",
 *       "Content-Disposition": "attachment; filename=large_file.csv"
 *     }
 *   }
 * }
 * ```
 *
 * You can then use this `uploadRequest` to upload the file directly to the
 * storage service.
 *
 * ```http
 * PUT https://direct-upload-url/path/to/upload
 * Content-Length: 10485760
 * Content-Type: text/csv
 * Content-Disposition: attachment; filename=large_file.csv
 *
 * <file content>
 * ```
 */
