// @ts-check
import { parseDataURL } from '@/lib/dataurl.parse'
import debug from '@/lib/debug'
import { extname } from '@/lib/file.helpers'
import { getContentTypeHeader } from '@/lib/header'
import schema, { schemaErrorToError } from '@/lib/joi.handler'
import { withAny } from '@/lib/method'
import { typeToFileName } from '@/lib/mime'
import { nameToType } from '@/lib/mime2'
import { parseRequestJson } from '@/lib/request'
import {
  badRequest,
  limitsReached,
  methodNotAllowed,
  ok,
  respondFromError,
} from '@/lib/response'
import {
  getSessionFileTempDownloadURL,
  getSessionFileUploadInformation,
  uploadSessionFile,
  uploadSessionFileFromURL,
} from '@/lib/session.file'
import { withSession } from '@/lib/session.handler'
import { getObjectUploadUrl } from '@/lib/storage'
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
 * -@swagger
 *
 * /session/file/upload:
 *   post:
 *     operationId: uploadSessionFile
 *     summary: Upload a file as a session file
 *     description: |
 *       Upload the specified file to the session. The file can be specified
 *       either as a HTTP URL, a data URL, a multipart/form-data, or as a raw
 *       file stream. The maximum file size for uploads is determined
 *       dynamically based on user limits and configuration, and may vary.
 *     tags:
 *       - Session File
 *     parameters:
 *       - in: path
 *         name: sessionId
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
 *         description: The file was uploaded successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   description: The ID of the upload file
 *                   type: string
 *                 name:
 *                   description: The name of the uploaded file
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

    const contentTypeHeader = getContentTypeHeader(req, true)

    const maxFileSize = await getMaxFileSize(session.user)

    let fileId

    let fileName

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
            debug(`uploading file from URL`).log('api.v1.session.file.upload')

            const { fileId: _fileId, name: _fileName } =
              await uploadSessionFileFromURL(
                session.id,
                value.file,
                {},
                {
                  maxSize: maxFileSize,
                }
              )

            fileId = _fileId

            fileName = _fileName

            finalUploadRequest = undefined

            debug(`file upload completed`, {
              fileId,
              fileName,
              finalUploadRequest,
            }).log('api.v1.session.file.upload')

            break
          }

          case /^data:/.test(value.file): {
            debug(`parsing data URL`).log('api.v1.session.file.upload')

            const { data: _data, type: _type } = parseDataURL(value.file)

            const data = Buffer.from(_data)
            const size = data.length
            const type = _type
            const name = typeToFileName(type)

            debug(`checking file size`, { size }).log(
              'api.v1.session.file.upload'
            )

            if (size > maxFileSize) {
              return limitsReached()
            }

            debug(`uploading file`, {
              // data,
              size,
              type,
              name,
            }).log('api.v1.session.file.upload')

            const { fileId: _fileId, name: _fileName } =
              await uploadSessionFile(
                session.id,
                new Uint8Array(data),
                type,
                extname(name),
                {
                  maxSize: maxFileSize,
                }
              )

            fileId = _fileId

            fileName = _fileName

            finalUploadRequest = undefined

            debug(`file upload completed`, {
              fileId,
              fileName,
              finalUploadRequest,
            }).log('api.v1.session.file.upload')

            break
          }

          case typeof value.file === 'object' && value.file !== null: {
            debug(`checking file size`, { size: value.file.size }).log(
              'api.v1.session.file.upload'
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

            const {
              fileId: _fileId,
              name: _fileName,
              scope,
              key,
            } = getSessionFileUploadInformation(
              session.id,
              extname(contentName)
            )

            const url = await getObjectUploadUrl(scope, key, {
              size: value.file.size,
              type: contentType,
              name: contentName,
            })

            fileId = _fileId

            fileName = _fileName

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

            debug(`file upload completed`, {
              fileId,
              fileName,
              finalUploadRequest,
            }).log('api.v1.session.file.upload')

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
          'api.v1.session.file.upload'
        )

        const file = await getUploadFile(req)

        const data = await file.arrayBuffer()
        const size = file.size
        const type = file.type
        const name = file.name

        debug(`checking file size`, { size }).log('api.v1.session.file.upload')

        if (size > maxFileSize) {
          return limitsReached()
        }

        debug(`uploading file`, {
          // data,
          size,
          type,
          name,
        }).log('api.v1.session.file.upload')

        const { fileId: _fileId, name: _fileName } = await uploadSessionFile(
          session.id,
          new Uint8Array(data),
          type,
          extname(name),
          {
            maxSize: maxFileSize,
          }
        )

        fileId = _fileId

        fileName = _fileName

        finalUploadRequest = undefined

        debug(`file upload completed`, {
          fileId,
          fileName,
          finalUploadRequest,
        }).log('api.v1.session.file.upload')

        break
      }

      default: {
        debug(`obtaining incoming file stream`).log(
          'api.v1.session.file.upload'
        )

        const data = await req.arrayBuffer()
        const size = data.byteLength
        const type = contentTypeHeader
        const name = typeToFileName(type)

        debug(`checking file size`, { size }).log('api.v1.session.file.upload')

        if (size > maxFileSize) {
          return limitsReached()
        }

        debug(`uploading file`, {
          // data,
          size,
          type,
          name,
        }).log('api.v1.session.file.upload')

        const { fileId: _fileId, name: _fileName } = await uploadSessionFile(
          session.id,
          new Uint8Array(data),
          type,
          extname(name),
          {
            maxSize: maxFileSize,
          }
        )

        fileId = _fileId

        fileName = _fileName

        finalUploadRequest = undefined

        debug(`file upload completed`, {
          fileId,
          fileName,
          finalUploadRequest,
        }).log('api.v1.session.file.upload')

        break
      }
    }

    const finalDownloadRequest = {
      method: 'GET',
      url: await getSessionFileTempDownloadURL(session.id, fileName),
      headers: {},
    }

    return ok({
      id: fileId,
      name: fileName,
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
 * -@manual Session Files
 * @description Session files provide temporary file storage for conversation contexts, enabling you to upload files that can be accessed during AI interactions without permanent storage.
 * @category Sessions
 * @tags session, files, temporary-storage
 * @index 1
 *
 * Session files are temporary files that exist within the context of a
 * conversation or AI interaction session. Unlike permanent file storage, these
 * files are designed for short-term use during active conversations and are
 * automatically managed by the session lifecycle.
 *
 * ## Uploading Session Files
 *
 * Session file uploads enable you to provide contextual information, documents,
 * or images to AI agents during conversations. The upload system supports
 * multiple input formats to accommodate different integration scenarios, from
 * web browser uploads to programmatic API integrations.
 *
 * The system automatically handles file size validation based on your account
 * limits, content type detection, and temporary storage management. Files
 * remain accessible throughout the session and are automatically cleaned up
 * when no longer needed.
 *
 * ### Multipart Form Data Upload
 *
 * The standard method for uploading files from web browsers and form-based
 * applications uses multipart/form-data encoding:
 *
 * ```http
 * POST /api/v1/session/file/upload
 * Content-Type: multipart/form-data
 *
 * [multipart form data with 'file' field containing the binary file]
 * ```
 *
 * This method automatically captures the filename, content type, and file size
 * from the multipart data, making it the most convenient option for browser-
 * based uploads.
 *
 * ### Data URL Upload
 *
 * For uploading base64-encoded content (common in browser-based applications
 * using the FileReader API), send the data URL in a JSON request:
 *
 * ```http
 * POST /api/v1/session/file/upload
 * Content-Type: application/json
 *
 * {
 *   "file": "data:image/png;base64,iVBORw0KGgoAAAANS..."
 * }
 * ```
 *
 * The system automatically decodes the data URL, extracts the content type,
 * and stores the file in the session.
 *
 * ### HTTP/HTTPS URL Upload
 *
 * To upload a file from an external URL, provide the complete HTTP or HTTPS
 * URL in a JSON request:
 *
 * ```http
 * POST /api/v1/session/file/upload
 * Content-Type: application/json
 *
 * {
 *   "file": "https://example.com/document.pdf"
 * }
 * ```
 *
 * The system fetches the file from the provided URL and stores it in the
 * session. This is particularly useful for referencing external resources
 * without manual downloading and re-uploading.
 *
 * ### Pre-Signed Upload (Two-Phase Upload)
 *
 * For large files or when you need more control over the upload process, use
 * the two-phase upload method. First, register the file metadata:
 *
 * ```http
 * POST /api/v1/session/file/upload
 * Content-Type: application/json
 *
 * {
 *   "file": {
 *     "type": "application/pdf",
 *     "size": 1048576,
 *     "name": "document.pdf"
 *   }
 * }
 * ```
 *
 * The response includes an `uploadRequest` object with the URL, method, and
 * headers needed to complete the upload:
 *
 * ```json
 * {
 *   "id": "file-id",
 *   "name": "document.pdf",
 *   "uploadRequest": {
 *     "method": "PUT",
 *     "url": "https://storage.example.com/...",
 *     "headers": {
 *       "Content-Length": "1048576",
 *       "Content-Type": "application/pdf"
 *     }
 *   }
 * }
 * ```
 *
 * Then, upload the file directly to the provided URL using the specified
 * method and headers. This approach is ideal for client-side uploads that
 * bypass your server infrastructure.
 *
 * ### Raw Binary Upload
 *
 * For direct binary uploads without form encoding, send the file content as
 * the request body with the appropriate Content-Type header:
 *
 * ```http
 * POST /api/v1/session/file/upload
 * Content-Type: application/pdf
 *
 * [raw binary file content]
 * ```
 *
 * The system uses the Content-Type header to determine the file type and
 * automatically generates an appropriate filename.
 *
 * ## Response Format
 *
 * All successful uploads return a response containing:
 *
 * - `id`: The unique identifier for the uploaded file
 * - `name`: The filename (auto-generated or from the original file)
 * - `uploadRequest`: Optional pre-signed upload details (for two-phase uploads)
 * - `downloadRequest`: Download information with temporary URL for file access
 *
 * The `downloadRequest` provides immediate access to the uploaded file for
 * verification or further processing.
 *
 * ## File Size Limits
 *
 * Upload size limits are determined dynamically based on your account
 * configuration. If a file exceeds your limit, the upload will be rejected
 * with a 402 limits reached error. Contact your account administrator to
 * increase file size limits if needed.
 *
 * **Important:** The file size validation applies to all upload methods. For
 * URL-based uploads, the system checks the size after fetching the remote file.
 */
