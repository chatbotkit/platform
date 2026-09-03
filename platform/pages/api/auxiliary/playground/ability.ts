import {
  getAbilityFunctionDescription,
  getAbilityFunctionName,
  getAbilityFunctionParameters,
} from '@/lib/ability.function'
import { authenticatedMultiHandler } from '@/lib/auxiliary.handler'
import type { Session } from '@/lib/session.handler'
import { z } from '@/lib/zod.schema'

const toolCallSchema = z.object({
  instruction: z.string().describe('The ability instruction text'),
  name: z
    .string()
    .default('ability_name')
    .describe('The ability name for the tool call'),
  description: z
    .string()
    .default('')
    .describe('The ability description for the tool call'),
})

type ToolCallSchema = z.infer<typeof toolCallSchema>

async function toolCallHandler(_session: Session, parameters: ToolCallSchema) {
  const { instruction, name, description } = parameters

  const functionParameters = getAbilityFunctionParameters({
    instruction,
    meta: {},
  })

  return {
    type: 'function',
    function: {
      name: getAbilityFunctionName({ name }),
      description: getAbilityFunctionDescription({ description }),
      parameters: functionParameters,
    },
  }
}

export default authenticatedMultiHandler({
  toolCall: {
    schema: toolCallSchema,
    fn: toolCallHandler,
  },
})
