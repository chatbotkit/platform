/* eslint-disable custom-eslint-rules/no-plain-fetch-in-routes -- operator storage (presigned object URL) */
// @ts-check
import prisma from '@/prisma/client'

import { encode } from '@/lib/b64'
import fetch from '@/lib/fetch'
import {
  getAcceptHeader,
  getContentDispositionHeader,
  getContentTypeHeader,
} from '@/lib/header'
import { withGet } from '@/lib/method'
import { catchAllParam, requiredUrlParam } from '@/lib/query.get'
import { badRequest, notAuthorized, notFound, ok, send } from '@/lib/response'
import { withSession } from '@/lib/session.handler'
import {
  getStorageFileDownloadUrl,
  storageFileExists,
} from '@/lib/space.storage'
import { getRandomId } from '@/lib/string'

/**
 * @swagger
 *
 * /space/{spaceId}/storage/download/{path}:
 *   get:
 *     operationId: downloadSpaceStoragePath
 *     summary: Download a file from space storage
 *     description: |
 *       Download a file from space storage. The file path is specified in the
 *       URL after /download/. Can return either the direct file content
 *       (default) or a presigned download URL (when Accept: application/json).
 *     tags:
 *       - Space Storage
 *     parameters:
 *       - in: path
 *         name: spaceId
 *         required: true
 *         schema:
 *           description: The ID of the space
 *           type: string
 *       - in: path
 *         name: path
 *         required: true
 *         schema:
 *           description: The file path
 *           type: string
 *     responses:
 *       200:
 *         description: The file was downloaded successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   description: The ID of the file
 *                   type: string
 *                 url:
 *                   description: The presigned URL to download the file
 *                   type: string
 *               required:
 *                 - id
 *                 - url
 *           application/octet-stream:
 *             schema:
 *               type: string
 *               format: binary
 *       default:
 *         $ref: '#/components/responses/ErrorResponse'
 */
export default withGet(
  withSession(async function (req, session) {
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

    // @todo support downloading directories (as zip?)

    if (!(await storageFileExists({ spaceId: space.id, pathId }))) {
      return notFound()
    }

    const url = await getStorageFileDownloadUrl({ spaceId: space.id, pathId })

    const accept = getAcceptHeader(req, 'application/octet-stream')

    switch (accept) {
      case 'application/json': {
        return ok({
          id: pathId,
          url: url,
        })
      }

      default: {
        const response = await fetch(url)

        if (!response.ok) {
          return notFound()
        }

        const filename = path.split('/').pop() || getRandomId('file-')

        return send(response.body, {
          'Content-Type': getContentTypeHeader(
            response,
            'application/octet-stream'
          ),
          'Content-Disposition': getContentDispositionHeader(
            response,
            `attachment; filename="${filename}"`
          ),
        })
      }
    }
  })
)

/**
 * @manual Space Storage
 * @index 30
 *
 * ## Downloading Files from Space Storage
 *
 * Once files are uploaded to space storage, you can retrieve them either as
 * direct file downloads or as presigned URLs for deferred downloading. This
 * flexibility allows you to choose between immediate file access and
 * generating shareable download links.
 *
 * The download operation supports content negotiation, meaning you can control
 * the response format by setting the appropriate Accept header. This is
 * useful when integrating with different types of clients or when building
 * file management interfaces.
 *
 * ### Direct File Download
 *
 * To download a file directly, specify the path in the URL:
 *
 * ```http
 * GET /api/v1/space/{spaceId}/storage/download/documents/report.pdf
 * ```
 *
 * ### Presigned URL Download
 *
 * To get a presigned download URL instead of the file content, set the
 * Accept header to application/json:
 *
 * ```http
 * GET /api/v1/space/{spaceId}/storage/download/documents/report.pdf
 * Accept: application/json
 * ```
 */
