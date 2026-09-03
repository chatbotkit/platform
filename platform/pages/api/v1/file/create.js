// @ts-check
import prisma from '@/prisma/client'
import { FileVisibility } from '@/prisma/types'

import schema, { withSchema } from '@/lib/joi.handler'
import { withLimits } from '@/lib/limit.handler'
import { withPost } from '@/lib/method'
import { ok } from '@/lib/response'
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
 * /file/create:
 *   post:
 *     operationId: createFile
 *     summary: Create file
 *     tags:
 *       - File
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
 *         description: The file was created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   description: The ID of the created file
 *                   type: string
 *               required:
 *                 - id
 *       default:
 *         $ref: '#/components/responses/ErrorResponse'
 */
export default withPost(
  withSession(
    withLimits(
      ['database/file'],
      withSchema(bodySchema, async function (_req, session, body) {
        const {
          alias,

          name,
          description,

          blueprintId: blueprint,

          visibility,

          meta,
        } = body

        const { id } = await prisma.file.create({
          data: {
            userId: session.user.id,

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

            meta,
          },

          select: {
            id: true,
          },
        })

        return ok({ id })
      })
    )
  )
)

/**
 * @manual Files
 * @index 5
 *
 * ## Creating Files
 *
 * Creating a file is the foundational step in managing file resources within
 * the platform. File creation establishes a file record in the system with
 * metadata and configuration settings, after which you can upload actual
 * content to the file resource.
 *
 * To create a new file, make a POST request to the create endpoint with the
 * file's metadata and configuration:
 *
 * ```http
 * POST /api/v1/file/create
 * Content-Type: application/json
 *
 * {
 *   "name": "Product Catalog 2024",
 *   "description": "Comprehensive product listing with specifications",
 *   "visibility": "private"
 * }
 * ```
 *
 * The create operation returns a file ID that you'll use for all subsequent
 * operations including content upload, updates, and downloads. All fields in
 * the request body are optional, allowing you to create a minimal file record
 * and populate details later.
 *
 * ### Available Configuration Options
 *
 * When creating a file, you can specify the following properties:
 *
 * - **name**: A descriptive name for the file (optional, can be set later)
 * - **description**: Detailed information about the file's purpose and contents
 *   (optional)
 * - **visibility**: Access control setting - either `private` (default) or
 *   `public`
 * - **blueprintId**: Associate the file with a blueprint resource for
 *   organizational purposes (optional)
 * - **meta**: Custom metadata object for storing additional file-specific
 *   information (optional)
 *
 * The visibility setting is particularly important for security and access
 * control. Setting a file to `private` ensures that only you can access it,
 * while `public` visibility allows anyone with the file ID to download the
 * content. Choose the appropriate visibility based on your security
 * requirements and use case.
 *
 * ### Creation Workflow
 *
 * The typical workflow for working with files involves two distinct steps:
 *
 * 1. **Create the file record**: Use this endpoint to establish the file
 *    resource with metadata
 * 2. **Upload content**: Use the upload endpoint with the returned file ID to
 *    add actual file content
 *
 * This two-step process provides flexibility, allowing you to configure file
 * metadata before or after content upload, and enables you to replace file
 * content while maintaining the same file ID and metadata.
 *
 * **Example Response:**
 *
 * ```json
 * {
 *   "id": "file_abc123"
 * }
 * ```
 *
 * The response includes the unique file ID that you'll use for uploading
 * content and performing other file operations. Store this ID for future
 * reference as it serves as the primary identifier for the file resource.
 *
 * **Rate Limiting**: File creation is subject to database resource limits based
 * on your account tier. If you reach your file creation limit, you'll need to
 * delete existing files or upgrade your account to create additional files.
 */

/**
 * @manual Dataset Files
 * @description Learn how to use files as data sources for your datasets.
 * @category Resources/Datasets
 * @tags dataset, file, data
 * @index 1
 *
 * Files can be used to provide a source of records in your datasets. You can
 * create files, attach them to datasets, and sync them to import records.
 *
 * ## Create File
 *
 * Creating a file is the first step to using it as a data source for your
 * datasets. You can create a file by making a POST request to the following
 * endpoint:
 *
 * ```http
 * POST /api/v1/dataset/file/create
 * Content-Type: application/json
 *
 * {
 *  "name": "My File",
 *  "description": "A description of my file",
 * }
 * ```
 */
