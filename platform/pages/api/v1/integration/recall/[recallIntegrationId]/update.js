// @ts-check
import prisma from '@/prisma/client'

import schema, { withSchema } from '@/lib/joi.handler'
import { getMeta } from '@/lib/meta'
import { withPost } from '@/lib/method'
import { requiredUrlParam } from '@/lib/query.get'
import { RECALL_REGIONS, getRecallRegionStorageValue } from '@/lib/recall.bot'
import { notAuthorized, notFound, ok } from '@/lib/response'
import { withSession } from '@/lib/session.handler'

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
  withSession(
    withSchema(bodySchema, async function (req, session, body) {
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

      const recallIntegration =
        await prisma.recallIntegration.findUniqueByIdentifier(
          session.user,
          requiredUrlParam(req, 'recallIntegrationId')
        )

      if (!recallIntegration) {
        return notFound()
      }

      if (recallIntegration.userId !== session.user.id) {
        return notAuthorized()
      }

      await prisma.recallIntegration.update({
        where: {
          id: recallIntegration.id,
        },

        data: {
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

          meta: getMeta(meta, recallIntegration.meta),
        },
      })

      return ok({ id: recallIntegration.id })
    })
  )
)
