// @ts-check
import prisma from '@/prisma/client'

import schema, { withSchema } from '@/lib/joi.handler'
import { withSessionLimits } from '@/lib/limit.handler'
import { withPost } from '@/lib/method'
import { RECALL_REGIONS, getRecallRegionStorageValue } from '@/lib/recall.bot'
import { ok } from '@/lib/response'

import aliasSchema from '@/schemas/alias'
import blueprintIdSchema from '@/schemas/blueprintId'
import botIdSchema from '@/schemas/botId'
import descriptionSchema from '@/schemas/description'
import metaSchema from '@/schemas/meta'
import nameSchema from '@/schemas/name'

export const bodySchema = schema.object({
  alias: aliasSchema,

  name: nameSchema,
  description: descriptionSchema,

  blueprintId: blueprintIdSchema('use'),

  botId: botIdSchema('use'),

  apiKey: schema.string().allow(null, ''),
  webhookSecret: schema.string().allow(null, ''),

  region: schema
    .string()
    .allow(null, '')
    .valid(null, '', ...RECALL_REGIONS),

  meta: metaSchema,
})

export default withPost(
  withSessionLimits(
    ['database/integration'],
    withSchema(bodySchema, async function (_req, session, body) {
      const {
        alias,

        name,
        description,

        blueprintId: blueprint,

        botId: bot,

        apiKey,

        webhookSecret,

        region,

        meta,
      } = body

      const { id } = await prisma.recallIntegration.create({
        data: {
          userId: session.user.id,

          // ref

          alias,

          // basic information

          name,
          description,

          // resource linking

          blueprintId: blueprint?.id || blueprint,
          botId: bot?.id || bot,

          // resource specific

          apiKey,

          webhookSecret,

          region: getRecallRegionStorageValue(region),

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
