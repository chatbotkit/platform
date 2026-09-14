// @ts-check
import { MessageType } from '@/prisma/types'

import schema from '@/lib/joi.schema'

import descriptionSchema from '@/schemas/description'
import messageText from '@/schemas/messageText'
import metaSchema from '@/schemas/meta'
import nameSchema from '@/schemas/name'

/**
 * An activity message is a function trigger, request or response and the
 * model side of the conversation relies on its meta to say which - see
 * `lib/message.ts`. Throws when the meta does not describe one.
 *
 * @param {{ type?: string, meta?: any }} message
 * @throws {Error} when the message is of type 'activity' but its meta does not describe a valid activity
 */
export function assertActivityMessage(message) {
  if (message.type === 'activity') {
    const { meta } = message

    if (!meta) {
      throw new Error(`missing 'meta' for message of type 'activity'`)
    }

    const { activity } = meta

    if (!activity) {
      throw new Error(
        `missing 'activity' in 'meta' for message of type 'activity'`
      )
    }

    const { type: _type, function: _function } = activity

    if (!['request', 'response', 'trigger'].includes(_type)) {
      throw new Error(
        `invalid 'meta.activity.type' for message of type 'activity'`
      )
    }

    if (!_function) {
      throw new Error(
        `missing 'meta.activity.function' for message of type 'activity'`
      )
    }
  }
}

/**
 * The fields of a message without the activity rule - for a route that takes
 * a partial message and has to check the rule against what is stored.
 */
export const messageFieldsSchema = schema.object({
  name: nameSchema,
  description: descriptionSchema,

  type: schema
    .string()
    .valid(...Object.keys(MessageType))
    .required(),
  text: messageText.required(),

  meta: metaSchema,

  // @note these are not used but required to simplify some development workflows
  // @todo remove these fields but test before removing them
  ...{
    id: schema.string().allow(null, ''),
    createdAt: schema.any().allow(null),
  },
})

export const messageSchema = messageFieldsSchema.external((message) => {
  assertActivityMessage(message)

  return message
})

export const allMessagesSchema = schema.array().items(messageSchema).allow(null)

export const userMessagesSchema = schema
  .array()
  .items(
    schema.object({
      name: nameSchema,
      description: descriptionSchema,

      type: schema.string().valid(MessageType.user).required(),
      text: messageText.required(),

      meta: metaSchema,

      // @note these are not used but required to simplify some development workflows
      // @todo remove these fields but test before removing them
      ...{
        id: schema.string().allow(null, ''),
        createdAt: schema.number().allow(null),
      },
    })
  )
  .allow(null)

export const botMessagesSchema = schema
  .array()
  .items(
    schema.object({
      name: nameSchema,
      description: descriptionSchema,

      type: schema.string().valid(MessageType.bot).required(),
      text: messageText.required(),

      meta: metaSchema,

      // @note these are not used but required to simplify some development workflows
      // @todo remove these fields but test before removing them
      ...{
        id: schema.string().allow(null, ''),
        createdAt: schema.number().allow(null),
      },
    })
  )
  .allow(null)

export default allMessagesSchema
