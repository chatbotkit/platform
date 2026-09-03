// @ts-check
import prisma from '@/prisma/client'
import { FileVisibility } from '@/prisma/types'

import schema, { withSchema } from '@/lib/joi.handler'
import { getMeta } from '@/lib/meta'
import { withPost } from '@/lib/method'
import { requiredUrlParam } from '@/lib/query.get'
import { notAuthorized, notFound, ok } from '@/lib/response'
import { withSession } from '@/lib/session.handler'

import aliasSchema from '@/schemas/alias'
import blueprintIdSchema from '@/schemas/blueprintId'
import descriptionSchema from '@/schemas/description'
import metaSchema from '@/schemas/meta'
import nameSchema from '@/schemas/name'

export const bodySchema = schema.object({
  alias: aliasSchema,

  name: nameSchema,
  description: descriptionSchema,

  blueprintId: blueprintIdSchema('use'),

  visibility: schema.string().valid(...Object.keys(FileVisibility)),

  meta: metaSchema,
})

/**
 * @swagger
 *
 * /file/{fileId}/update:
 *   post:
 *     operationId: updateFile
 *     summary: Update file
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
 *             allOf:
 *               - $ref: '#/components/schemas/InstanceRefProperties'
 *               - $ref: '#/components/schemas/InstanceCrudProps'
 *               - $ref: '#/components/schemas/BlueprintProps'
 *               - type: object
 *                 properties:
 *                   visibility:
 *                     $ref: '#/components/schemas/FileVisibility'
 *     responses:
 *       200:
 *         description: The file was updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   description: The ID of the updated file
 *                   type: string
 *               required:
 *                 - id
 *       default:
 *         $ref: '#/components/responses/ErrorResponse'
 */
export default withPost(
  withSession(
    withSchema(bodySchema, async function (req, session, body) {
      const {
        alias,

        name,
        description,

        blueprintId: blueprint,

        visibility,

        meta,
      } = body

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

      await prisma.file.update({
        where: {
          id: file.id,
        },

        data: {
          // ref

          alias,

          // basic information

          name,
          description,

          // resource linking

          blueprintId: blueprint?.id || blueprint,

          // resource specific

          visibility,

          // meta and others

          meta: getMeta(meta, file.meta),
        },
      })

      return ok({ id: file.id })
    })
  )
)

/**
 * @manual Files
 *
 * ## Updating File Metadata
 *
 * Updating file metadata allows you to modify the descriptive information and
 * configuration settings associated with a file without affecting the actual
 * file content. This is useful for organizing files, updating descriptions,
 * changing access controls, or modifying blueprint associations as your
 * application requirements evolve.
 *
 * To update a file's metadata, make a POST request to the update endpoint with
 * the file ID and the fields you want to modify:
 *
 * ```http
 * POST /api/v1/file/{fileId}/update
 * Content-Type: application/json
 *
 * {
 *   "name": "Updated Product Catalog",
 *   "description": "Q1 2024 product catalog with pricing updates",
 *   "visibility": "private",
 *   "blueprintId": "blueprint_xyz789"
 * }
 * ```
 *
 * All fields in the update request are optional, allowing you to modify only
 * the properties you need to change. The fields you can update include:
 *
 * - **name**: A descriptive name for the file that helps identify its purpose
 * - **description**: Detailed information about the file's content and purpose
 * - **visibility**: Access control setting that can be either `private` or
 *   `public`, controlling who can access the file
 * - **blueprintId**: Associate the file with a blueprint resource, or set to
 *   `null` to remove blueprint association
 * - **meta**: Custom metadata object for storing additional file-specific
 *   information
 *
 * The visibility setting is particularly important for security. When set to
 * `private`, only the file owner can download or access the file content. When
 * set to `public`, the file becomes accessible to anyone with the file ID,
 * which is useful for publicly shared resources.
 *
 * The update operation preserves any fields not included in the request,
 * performing a partial update rather than replacing the entire file resource.
 * The actual file content and upload status remain unchanged - this endpoint
 * only modifies metadata.
 *
 * **Example: Changing File Visibility**
 *
 * ```http
 * POST /api/v1/file/{fileId}/update
 * Content-Type: application/json
 *
 * {
 *   "visibility": "public"
 * }
 * ```
 *
 * **Security Note:** You can only update files that belong to your user
 * account. The API validates ownership before allowing any modifications,
 * ensuring proper access control and preventing unauthorized changes to other
 * users' files.
 */
