// @ts-check
import prisma from '@/prisma/client'

import { getRealInstruction } from '@/lib/ability.instruction'
import schema, { withSchema } from '@/lib/joi.handler'
import { getMeta } from '@/lib/meta'
import { withPost } from '@/lib/method'
import { requiredUrlParam } from '@/lib/query.get'
import { notAuthorized, notFound, ok } from '@/lib/response'
import { withSession } from '@/lib/session.handler'

import abilityDescriptionSchema from '@/schemas/abilityDescription'
import abilityInstructionSchema from '@/schemas/abilityInstruction'
import abilityNameSchema from '@/schemas/abilityName'
import aliasSchema from '@/schemas/alias'
import blueprintIdSchema from '@/schemas/blueprintId'
import botIdSchema from '@/schemas/botId'
import fileIdSchema from '@/schemas/fileId'
import metaSchema from '@/schemas/meta'
import secretIdSchema from '@/schemas/secretId'
import skillsetIdSchema from '@/schemas/skillsetId'
import spaceIdSchema from '@/schemas/spaceId'
import stateSchema from '@/schemas/state'

export const bodySchema = schema.object({
  alias: aliasSchema,

  name: abilityNameSchema,
  description: abilityDescriptionSchema,

  blueprintId: blueprintIdSchema('use'),

  skillsetId: skillsetIdSchema('use'),

  linkedSecretId: secretIdSchema('use'),

  linkedFileId: fileIdSchema('use'),

  linkedBotId: botIdSchema('use'),

  linkedSpaceId: spaceIdSchema('use'),

  instruction: abilityInstructionSchema,

  state: stateSchema,

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

        skillsetId: skillset,

        linkedSecretId: secret,

        linkedFileId: file,

        linkedBotId: bot,

        linkedSpaceId: space,

        instruction,

        state,

        meta,
      } = body

      const ability = await prisma.ability.findUniqueByIdentifier(
        session.user,
        requiredUrlParam(req, 'abilityId')
      )

      if (!ability) {
        return notFound()
      }

      if (ability.userId !== session.user.id) {
        return notAuthorized()
      }

      await prisma.ability.update({
        where: {
          id: ability.id,
        },

        data: {
          // ref

          alias,

          // basic information

          name,
          description,

          // resource linking

          blueprintId: blueprint?.id || blueprint,

          skillsetId: skillset?.id || skillset,

          linkedSecretId: secret?.id || secret,

          linkedFileId: file?.id || file,

          linkedBotId: bot?.id || bot,

          linkedSpaceId: space?.id || space,

          // resource specific

          instruction,

          // lifecycle

          state,

          // meta and others

          meta: {
            ...getMeta(meta, ability.meta),

            _instruction: await getRealInstruction(session.user, instruction),
          },
        },
      })

      return ok({ id: ability.id })
    })
  )
)

// @note this API route is not public - no documentation available
