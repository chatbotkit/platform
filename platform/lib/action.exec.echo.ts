import { getConfigBySchema } from '@/lib/action.config'
import type {
  ActionInput,
  ActionOptions,
  ActionParams,
  ActionReturn,
} from '@/lib/action.exec.all'
import debug from '@/lib/debug'
import { logEvent } from '@/lib/log'
import { z } from '@/lib/zod.schema'

export const executeEchoSchema = z.object({
  result: z.unknown().optional(),
})

/**
 * Executes an echo action. This action is used to echo back the input as the
 * output.
 */
export async function executeEchoAction(
  input: ActionInput,
  params: ActionParams,
  options: ActionOptions
): Promise<ActionReturn> {
  debug(`using`, { input, params, options })

  await logEvent({
    user: { id: options.userId },
    type: 'action.echo',
    relations: {
      blueprintId: options.contextResources?.blueprintId,
      skillsetId: options.contextResources?.skillsetId,
      abilityId: options.contextResources?.abilityId,
    },
    meta: {
      params,
    },
  })

  const { result } = getConfigBySchema({
    input,
    params,
    initial: {},
    schema: executeEchoSchema,
    options,
  })

  return {
    result: result !== undefined ? result : input,
  }
}
