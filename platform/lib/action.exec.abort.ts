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

// @see data/abilities/catalogue/cbk.abort.ts for ability definitions related
// to these schemas

/**
 * Abort schema defines the parameters for abort actions.
 */
export const abortSchema = z.object({
  reason: z.string().min(1),
})

export type AbortSchema = z.infer<typeof abortSchema>

/**
 * Executes an abort action. This stops the current operation without
 * implying whether the outcome is successful or failed.
 */
export async function executeAbortAction(
  input: ActionInput,
  params: ActionParams,
  options: ActionOptions
): Promise<ActionReturn> {
  debug(`using`, { input, params, options })

  const config = getConfigBySchema({
    input,
    params,
    initial: { reason: input },
    schema: abortSchema,
    options,
  })

  const { reason } = config

  await logEvent({
    user: { id: options.userId },
    type: 'action.abort',
    relations: {
      blueprintId: options.contextResources?.blueprintId,
      skillsetId: options.contextResources?.skillsetId,
      abilityId: options.contextResources?.abilityId,
    },
    meta: params,
  })

  const controller = new AbortController()

  controller.abort(reason)

  return {
    result: controller.signal,
  }
}
