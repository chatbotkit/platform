import debug from '@/lib/debug'
import { getInstructionType } from '@/lib/instruction.type'
import { execPrompt } from '@/lib/prompt'
import { Usage } from '@/lib/usage.model'

import generateInstructionFromText from '@/prompts/generate_instruction_from_text_v3.yaml'

interface User {
  id: string
}

/**
 * There are situations where we might need to pre-compute the instruction when
 * it is defined more fuzzily. This is the case when the instruction is detected
 * to be automatic. In these cases we use a model to analyze the text and based
 * on the context, we generate a more precise instruction. The function is used
 * to store _instruction in the meta field.
 */
export async function getRealInstruction(
  user: User,
  instruction: string | undefined
): Promise<string | undefined> {
  debug(`getRealInstruction`, { instruction })

  if (instruction === undefined) {
    return
  }

  instruction = instruction.trim()

  if (!instruction) {
    return ''
  }

  const type = getInstructionType(instruction)

  debug(`detected type`, { type })

  if (type !== 'automatic') {
    return undefined
  }

  const {
    completion: result,
    tokensUsed,
    modelUsed,
  } = await execPrompt(
    {
      ...generateInstructionFromText,

      user: user.id,
    },
    {
      input: instruction,
    }
  )

  debug(`using result`, { result: result.substring(0, 256) })

  await Usage.createAndRecord({
    user: user,
    token: tokensUsed,
    model: modelUsed,
    meta: {
      reason: 'instruction/generate',
    },
  })

  return result
}
