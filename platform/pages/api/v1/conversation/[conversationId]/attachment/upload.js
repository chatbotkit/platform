// @ts-check
import prisma from '@/prisma/client'

import {
  getConversationAttachmentDownloadURL,
  getConversationAttachmentUploadInformation,
  makeConversationAttachmentUploadActivityMessages,
  uploadConversationAttachment,
  uploadConversationAttachmentFromURL,
} from '@/lib/conversation.attachment'
import { parseDataURL } from '@/lib/dataurl.parse'
import debug from '@/lib/debug'
import { extname } from '@/lib/file.helpers'
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
 * @swagger
 *
 * /conversation/{conversationId}/attachment/upload:
 *   post:
 *     operationId: uploadConversationAttachment
 *     summary: Upload a file as a conversation attachment
 *     description: |
 *       Upload the specified file to the conversation. The file can be
 *       specified either as a HTTP URL, a data URL, a multipart/form-data, or
 *       as a raw file stream. There is currently a limit of 4.5MB for files
 *       uploaded via all available methods except for direct-to-source uploads
 *       when using application/json request body with a file object.
 *     tags:
 *       - Conversation Attachment
 *     parameters:
 *       - in: path
 *         name: conversationId
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

    const conversation = await prisma.conversation.findUnique({
      where: {
        id: requiredUrlParam(req, 'conversationId'),
      },
    })

    if (!conversation) {
      return notFound()
    }

    if (conversation.userId !== session.user.id) {
      return notAuthorized()
    }

    const contentTypeHeader = getContentTypeHeader(req, true)

    const maxFileSize = await getMaxFileSize(session.user)

    let attachmentId

    let attachmentName

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
            debug(`uploading file from URL`).log(
              'api.v1.conversation.attachment.upload'
            )

            const { attachmentId: _attachmentId, name: _attachmentName } =
              await uploadConversationAttachmentFromURL(
                conversation.id,
                value.file,
                {},
                {
                  maxSize: maxFileSize,
                }
              )

            attachmentId = _attachmentId

            attachmentName = _attachmentName

            finalUploadRequest = undefined

            debug(`file upload completed`, {
              attachmentId,
              attachmentName,
              finalUploadRequest,
            }).log('api.v1.conversation.attachment.upload')

            break
          }

          case /^data:/.test(value.file): {
            debug(`parsing data URL`).log(
              'api.v1.conversation.attachment.upload'
            )

            const { data: _data, type: _type } = parseDataURL(value.file)

            const data = Buffer.from(_data)
            const size = data.length
            const type = _type
            const name = typeToFileName(type)

            debug(`checking file size`, { size }).log(
              'api.v1.conversation.attachment.upload'
            )

            if (size > maxFileSize) {
              return limitsReached()
            }

            debug(`uploading file`, {
              // data,
              size,
              type,
              name,
            }).log('api.v1.conversation.attachment.upload')

            const { attachmentId: _attachmentId, name: _attachmentName } =
              await uploadConversationAttachment(
                conversation.id,
                new Uint8Array(data),
                type,
                extname(name),
                {
                  maxSize: maxFileSize,
                }
              )

            attachmentId = _attachmentId

            attachmentName = _attachmentName

            finalUploadRequest = undefined

            debug(`file upload completed`, {
              attachmentId,
              attachmentName,
              finalUploadRequest,
            }).log('api.v1.conversation.attachment.upload')

            break
          }

          case typeof value.file === 'object' && value.file !== null: {
            debug(`checking file size`, { size: value.file.size }).log(
              'api.v1.conversation.attachment.upload'
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
              attachmentId: _attachmentId,
              name: _attachmentName,
              scope,
              key,
            } = getConversationAttachmentUploadInformation(
              conversation.id,
              extname(contentName)
            )

            const url = await getObjectUploadUrl(scope, key, {
              size: value.file.size,
              type: contentType,
              name: contentName,
            })

            attachmentId = _attachmentId

            attachmentName = _attachmentName

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
              attachmentId,
              attachmentName,
              finalUploadRequest,
            }).log('api.v1.conversation.attachment.upload')

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
          'api.v1.conversation.attachment.upload'
        )

        const file = await getUploadFile(req)

        const data = await file.arrayBuffer()
        const size = file.size
        const type = file.type
        const name = file.name

        debug(`checking file size`, { size }).log(
          'api.v1.conversation.attachment.upload'
        )

        if (size > maxFileSize) {
          return limitsReached()
        }

        debug(`uploading file`, {
          // data,
          size,
          type,
          name,
        }).log('api.v1.conversation.attachment.upload')

        const { attachmentId: _attachmentId, name: _attachmentName } =
          await uploadConversationAttachment(
            conversation.id,
            new Uint8Array(data),
            type,
            extname(name),
            {
              maxSize: maxFileSize,
            }
          )

        attachmentId = _attachmentId

        attachmentName = _attachmentName

        finalUploadRequest = undefined

        debug(`file upload completed`, {
          attachmentId,
          attachmentName,
          finalUploadRequest,
        }).log('api.v1.conversation.attachment.upload')

        break
      }

      default: {
        debug(`obtaining incoming file stream`).log(
          'api.v1.conversation.attachment.upload'
        )

        const data = await req.arrayBuffer()
        const size = data.byteLength
        const type = contentTypeHeader
        const name = typeToFileName(type)

        debug(`checking file size`, { size }).log(
          'api.v1.conversation.attachment.upload'
        )

        if (size > maxFileSize) {
          return limitsReached()
        }

        debug(`uploading file`, {
          // data,
          size,
          type,
          name,
        }).log('api.v1.conversation.attachment.upload')

        const { attachmentId: _attachmentId, name: _attachmentName } =
          await uploadConversationAttachment(
            conversation.id,
            new Uint8Array(data),
            type,
            extname(name),
            {
              maxSize: maxFileSize,
            }
          )

        attachmentId = _attachmentId

        attachmentName = _attachmentName

        finalUploadRequest = undefined

        debug(`file upload completed`, {
          attachmentId,
          attachmentName,
          finalUploadRequest,
        }).log('api.v1.conversation.attachment.upload')

        break
      }
    }

    const finalDownloadRequest = {
      method: 'GET',
      url: await getConversationAttachmentDownloadURL(
        conversation.id,
        attachmentName
      ),
      headers: {},
    }

    const {
      request: uploadRequestActivityMessage,
      response: uploadResponseActivityMessage,
    } = makeConversationAttachmentUploadActivityMessages({
      id: attachmentId,
      name: attachmentName,
      type:
        finalUploadRequest?.headers?.['Content-Type'] ||
        'application/octet-stream',
    })

    await prisma.message.createMany({
      data: [
        {
          conversationId: conversation.id,

          ...uploadRequestActivityMessage,
        },
        {
          conversationId: conversation.id,

          ...uploadResponseActivityMessage,
        },
      ],
    })

    return ok({
      id: attachmentId,
      name: attachmentName,
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
 * @manual Conversation Attachments
 * @description Conversation attachments enable users to upload files, images, and documents to conversations, enriching interactions with visual and textual context that can be processed by AI models.
 * @category Objects/Conversations
 * @tags conversation, attachments, file-upload, media
 * @index 15
 *
 * Conversation attachments provide a powerful way to enhance AI interactions
 * by including files, images, documents, and other media directly in the
 * conversation context. This feature allows users to share visual information,
 * reference documents, and provide rich context that goes beyond text-based
 * communication.
 *
 * The attachment system supports multiple upload methods to accommodate
 * different use cases and technical requirements, including direct file uploads,
 * URL-based uploads, data URLs, and direct-to-storage uploads for large files.
 * Each method is optimized for specific scenarios, ensuring efficient and
 * reliable file handling regardless of file size or source.
 *
 * Existing attachments can also be listed and downloaded after upload. This is
 * useful for dashboards, audit views, export tools, or applications that need
 * to show users which files have been collected during a conversation.
 *
 * ## Uploading Attachments
 *
 * Uploading attachments to a conversation can be accomplished through several
 * methods, each suited to different integration patterns and use cases. The
 * system automatically handles file validation, storage, and tracking, creating
 * activity entries in the conversation history to maintain a complete record
 * of all uploaded files.
 *
 * ### Method 1: Upload from HTTP URL
 *
 * The simplest method is to provide an HTTP or HTTPS URL pointing to an
 * existing file. The system will fetch the file from the URL and store it
 * as a conversation attachment:
 *
 * ```http
 * POST /api/v1/conversation/{conversationId}/attachment/upload
 * Content-Type: application/json
 *
 * {
 *   "file": "https://example.com/document.pdf"
 * }
 * ```
 *
 * This method is ideal when files are already hosted elsewhere and you want
 * to reference them in the conversation without re-uploading the data.
 *
 * ### Method 2: Upload from Data URL
 *
 * For smaller files, you can embed the file data directly in the request
 * using a data URL. This is particularly useful for images and small documents
 * that are generated client-side:
 *
 * ```http
 * POST /api/v1/conversation/{conversationId}/attachment/upload
 * Content-Type: application/json
 *
 * {
 *   "file": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgA..."
 * }
 * ```
 *
 * Data URLs are limited by request size constraints but provide a convenient
 * way to upload inline file data without additional requests.
 *
 * ### Method 3: Multipart Form Upload
 *
 * Traditional multipart form uploads are supported for direct file uploads
 * from web forms or applications:
 *
 * ```http
 * POST /api/v1/conversation/{conversationId}/attachment/upload
 * Content-Type: multipart/form-data; boundary=----WebKitFormBoundary
 *
 * ------WebKitFormBoundary
 * Content-Disposition: form-data; name="file"; filename="document.pdf"
 * Content-Type: application/pdf
 *
 * [binary file data]
 * ------WebKitFormBoundary--
 * ```
 *
 * This standard approach works with HTML forms and most HTTP clients.
 *
 * ### Method 4: Raw Binary Upload
 *
 * You can upload files as raw binary data by sending the file content directly
 * in the request body with the appropriate Content-Type header:
 *
 * ```http
 * POST /api/v1/conversation/{conversationId}/attachment/upload
 * Content-Type: image/jpeg
 *
 * [binary file data]
 * ```
 *
 * This method is efficient for programmatic uploads where the file type is
 * known in advance.
 *
 * ### Method 5: Direct-to-Storage Upload
 *
 * For large files, the system supports a two-step upload process that bypasses
 * the API servers entirely. First, request upload credentials:
 *
 * ```http
 * POST /api/v1/conversation/{conversationId}/attachment/upload
 * Content-Type: application/json
 *
 * {
 *   "file": {
 *     "type": "video/mp4",
 *     "size": 52428800,
 *     "name": "presentation.mp4"
 *   }
 * }
 * ```
 *
 * The API responds with pre-signed upload credentials:
 *
 * ```json
 * {
 *   "id": "att_abc123",
 *   "name": "presentation.mp4",
 *   "uploadRequest": {
 *     "method": "PUT",
 *     "url": "https://storage.example.com/...",
 *     "headers": {
 *       "Content-Length": "52428800",
 *       "Content-Type": "video/mp4",
 *       "Content-Disposition": "attachment; filename=presentation.mp4"
 *     }
 *   }
 * }
 * ```
 *
 * Then upload the file directly to the storage service using the provided
 * credentials. This method bypasses API size limits and enables efficient
 * handling of large media files.
 *
 * ## File Size Limits
 *
 * File size limits vary by upload method and account tier:
 *
 * - **Standard uploads** (Methods 1-4): 4.5MB limit
 * - **Direct-to-storage uploads** (Method 5): Account-specific limit (typically
 *   50MB or higher)
 * - File size limits are enforced based on the user's account settings
 * - Exceeding limits returns a `limitsReached` error
 *
 * ## Response Format
 *
 * All upload methods return consistent response data:
 *
 * ```json
 * {
 *   "id": "att_abc123",
 *   "name": "document.pdf",
 *   "downloadRequest": {
 *     "method": "GET",
 *     "url": "https://api.chatbotkit.com/...",
 *     "headers": {}
 *   }
 * }
 * ```
 *
 * For direct-to-storage uploads, an additional `uploadRequest` object is
 * included with credentials for uploading the file.
 *
 * ## Downloading Attachments
 *
 * To download an attachment, use the stored attachment name returned by the
 * upload or list endpoint:
 *
 * ```http
 * GET /api/v1/conversation/{conversationId}/attachment/{attachmentName}/download
 * ```
 *
 * The endpoint redirects to a temporary download URL for the stored file.
 *
 * **Important Notes:**
 *
 * - All uploaded files are scanned and validated before being made available
 * - File names are normalized to handle special characters and encodings
 * - Activity messages are automatically created to track upload events
 * - Only the conversation owner can upload attachments
 * - Attachments are automatically associated with the conversation and included
 *   in conversation exports
 * - File types should be appropriate for processing by AI models (images,
 *   documents, text files are commonly supported)
 */
