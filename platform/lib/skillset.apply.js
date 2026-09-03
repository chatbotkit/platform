// @ts-check
import { getTextTokensLength } from '@chatbotkit-dev/gpt'
import { assertUnreachable } from '@chatbotkit-dev/typescript-utils/unreachable'

import { MessageType } from '@/prisma/types'

import { getAbilityFunctionName } from '@/lib/ability.function'
import { executeAction } from '@/lib/action.exec.all'
import debug from '@/lib/debug'
import { SafeError, captureException, captureObservation } from '@/lib/error'
import { TimeoutError } from '@/lib/fetch'
import { transformAutomaticInstruction } from '@/lib/instruction.transform.automatic'
import { transformComplexInstruction } from '@/lib/instruction.transform.complex'
import { transformSimpleInstruction } from '@/lib/instruction.transform.simple'
import { transformStructuredInstruction } from '@/lib/instruction.transform.structured'
import { transformTemplateInstruction } from '@/lib/instruction.transform.template'
import { getInstructionType } from '@/lib/instruction.type'
import {
  LARGE_RESPONSE_TOKEN_THRESHOLD,
  storeChunkedResponse,
} from '@/lib/skillset.chunk'
import { Usage } from '@/lib/usage.model'

/**
 * @typedef {import('@/lib/conversation.tag').Sink} Sink
 *
 * @typedef {{
 *   type: MessageType,
 *   text: string,
 *   meta?: Record<string,any>
 * }} Message
 */

/**
 * @typedef {import('@/prisma/types').Ability & { inlineSecrets?: Record<string,{value: string}>}} Ability
 * @typedef {import('@/prisma/types').Skillset} Skillset
 */

/**
 * @param {string} userId
 * @param {import('@/prisma/types').Skillset & {abilities: Ability[]}} skillset
 * @param {string} name
 * @param {string} input
 * @param {{
 *   sink?: Sink,
 *   messages?: Message[],
 *   usageMeta?: Record<string,any>,
 *   substitutions?: Record<string,string>,
 *   justification?: string,
 *   signal?: AbortSignal,
 *   chunking?: boolean,
 *   debug?: boolean
 * }} [options]
 * @returns {Promise<{
 *   usage: { token: number, model: string },
 *   error?: string,
 *   result: any,
 *   messages: Message[],
 *   meta?: Record<string,any>
 * }>}
 * @todo use options.sink to report progress
 */
export async function applySkillset(
  userId,

  skillset,

  name,
  input,

  options
) {
  debug(`apply skillset`, { userId, skillset, name, input, options }).log(
    'skillset.apply.applySkillset'
  )

  const justification = options?.justification

  const usage = new Usage()

  /**
   * @param {Error} [error]
   */
  function abort(error) {
    debug(`aborting skillset application`, { error }).log(
      'skillset.apply.applySkillset'
    )

    const messages = []

    if (error instanceof SafeError) {
      messages.push({
        type: MessageType.context,
        text: error.message,

        // @todo document why we need to pass this meta here

        /** @type {import('@/lib/meta').SkillsetMeta} */
        meta: {
          skillset: {
            id: skillset.id,
            action: {
              name,
              input,
              justification,
            },
          },
        },
      })
    } else {
      debug(`skillset application failed with error`, { error })
        .log('skillset.apply.applySkillset')
        .log('temp.skillset.applySkillset.error')

      messages.push({
        type: MessageType.context,
        text: `There is a problem fulfilling the request.`,

        // @todo document why we need to pass this meta here

        /** @type {import('@/lib/meta').SkillsetMeta} */
        meta: {
          skillset: {
            id: skillset.id,
            action: {
              name,
              input,
              justification,
            },
          },
        },
      })
    }

    return {
      usage: usage.toTokenModelObject(),

      result: null,

      messages: messages,
    }
  }

  const ability = skillset.abilities.find((ability) => {
    return [ability.name, getAbilityFunctionName(ability)].includes(name)
  })

  if (!ability) {
    debug('skip skillset application due to missing ability').log(
      'skillset.apply.applySkillset'
    )

    return abort()
  }

  // @note the _instruction meta field takes precedence over the instruction
  // field because it is used to store the pre-processed instruction that is
  // ready to be used by skillset
  // @todo move the _instruction meta field into an actual computed field in the
  // database for better type safety and performance

  const instruction = ability.meta?._instruction || ability.instruction

  /** @type {import('@/lib/instruction.transform.types').InstructionTransformResult | null | undefined} */
  let transformResult

  // @note the most universal way is to use an LLM to do the actual
  // transformation because it will know how to do the encoding as well but we
  // do this here simply for the sake of cost and performance.

  const instructionType = getInstructionType(instruction)

  debug(`instruction type`, { instructionType }).log(
    'skillset.apply.applySkillset'
  )

  // @note we need to detect what is the instruction type in order to apply
  // some optimizations for better performance, cost and accuracy

  switch (instructionType) {
    case 'template': {
      // This is a template case scenario where the instruction is a template
      // that needs to be used to transform the input.

      debug(`transform template instruction`, {
        instruction,
        input,
      }).log('skillset.apply.applySkillset')

      try {
        transformResult = await transformTemplateInstruction(
          instruction,
          input,
          {
            userId,
            substitutions: options?.substitutions,
            signal: options?.signal,
          }
        )

        if (!transformResult) {
          debug(
            `skip skillset application due to missing transform result`
          ).log('skillset.apply.applySkillset')

          return abort()
        }

        usage.addTokens(
          transformResult.usage.tokensUsed,
          transformResult.usage.modelUsed
        )
      } catch (e) {
        await captureException(e)

        return abort(e)
      }

      debug(`template ability transformation finished`, {
        transformResult,
      }).log('skillset.apply.applySkillset')

      break
    }

    case 'complex': {
      // This is a complex case scenario where the instruction needs to run via
      // a model to figure out the response.

      debug(`transform complex instruction`, {
        instruction,
        input,
      }).log('skillset.apply.applySkillset')

      try {
        transformResult = await transformComplexInstruction(
          instruction,
          input,
          {
            userId,
            substitutions: options?.substitutions,
          }
        )

        if (!transformResult) {
          debug(
            `skip skillset application due to missing transform result`
          ).log('skillset.apply.applySkillset')

          return abort()
        }

        usage.addTokens(
          transformResult.usage.tokensUsed,
          transformResult.usage.modelUsed
        )
      } catch (e) {
        await captureException(e)

        return abort(e)
      }

      debug(`complex ability transformation finished`, {
        transformResult,
      }).log('skillset.apply.applySkillset')

      break
    }

    case 'simple': {
      // This is a simple case scenario where the instruction can be run
      // directly by substituting the fields without using a model or a
      // template.

      debug(`transform simple instruction`, {
        instruction,
        input,
      }).log('skillset.apply.applySkillset')

      try {
        transformResult = await transformSimpleInstruction(instruction, input, {
          userId,
          substitutions: options?.substitutions,
          signal: options?.signal,
        })

        if (!transformResult) {
          debug(
            `skip skillset application due to missing transform result`
          ).log('skillset.apply.applySkillset')

          return abort()
        }

        usage.addTokens(
          transformResult.usage.tokensUsed,
          transformResult.usage.modelUsed
        )
      } catch (e) {
        await captureException(e)

        return abort(e)
      }

      debug(`simple ability transformation finished`, {
        transformResult,
      }).log('skillset.apply.applySkillset')

      break
    }

    case 'structured': {
      // This is a structured case scenario where the instruction uses YAML
      // action tags like !fetch, etc.

      debug(`transform structured instruction`, {
        instruction,
        input,
      }).log('skillset.apply.applySkillset')

      try {
        transformResult = await transformStructuredInstruction(
          instruction,
          input,
          {
            userId,
            substitutions: options?.substitutions,
            signal: options?.signal,
          }
        )

        if (!transformResult) {
          debug(
            `skip skillset application due to missing transform result`
          ).log('skillset.apply.applySkillset')

          return abort()
        }

        usage.addTokens(
          transformResult.usage.tokensUsed,
          transformResult.usage.modelUsed
        )
      } catch (e) {
        await captureException(e)

        return abort(e)
      }

      debug(`structured ability transformation finished`, {
        transformResult,
      }).log('skillset.apply.applySkillset')

      break
    }

    case 'automatic': {
      // @note automatic instructions are not fully implemented yet so the
      // transform returns null - we abort gracefully in this case

      debug(`transform automatic instruction`, {
        instruction,
        input,
      }).log('skillset.apply.applySkillset')

      try {
        transformResult = await transformAutomaticInstruction(
          instruction,
          input,
          {
            userId,
            substitutions: options?.substitutions,
            signal: options?.signal,
          }
        )

        if (!transformResult) {
          debug(
            `skip skillset application due to missing transform result`
          ).log('skillset.apply.applySkillset')

          return abort()
        }

        usage.addTokens(
          transformResult.usage.tokensUsed,
          transformResult.usage.modelUsed
        )
      } catch (e) {
        await captureException(e)

        return abort(e)
      }

      debug(`automatic ability transformation finished`, {
        transformResult,
      }).log('skillset.apply.applySkillset')

      break
    }

    default: {
      // @note it should not be possible to reach this point because the
      // instruction type is always known

      assertUnreachable(instructionType)
    }
  }

  // @note instruction transforms now return structured results directly with
  // action, params, text, and usage - no need to re-parse the text

  const {
    action: actionName,
    params: actionParams,
    text: actionText,
  } = transformResult

  debug(`processing action from transform`, {
    action: actionName,
    params: actionParams,
    text: actionText,
  }).log('skillset.apply.applySkillset')

  // @todo it should be doable to pass additional actions, such as these defined
  // by integrations, into this function here

  // @note options.substitutions are now passed INTO each transform function,
  // allowing each transform to apply substitutions using its own method
  // (bracket notation, YAML tags, etc.). This enables future transforms like
  // tag:action and tag:template to use different substitution mechanisms.
  //
  // Each transform function is responsible for:
  // 1. Applying substitutions from options.substitutions
  // 2. Cleaning up any remaining unfilled fields (except special fields)

  let actionReturn

  try {
    // this method may throw for whatever reason (like timeout) so we need
    // to make sure that exceptions are handled

    /**
     * Ensure that the references we pass on are valid and not temporary
     * references, which might be the case for inline skillsets and abilities.
     *
     * @param {string|null|undefined} input
     * @returns {string|undefined}
     */
    const ref = (input) => {
      if (!input) {
        return undefined
      }

      if (!(typeof input === 'string')) {
        return undefined
      }

      if (input === '-') {
        return undefined
      }

      if (input.startsWith('temp-')) {
        return undefined
      }

      if (input.startsWith('tmp-')) {
        return undefined
      }

      return input
    }

    actionReturn = await executeAction(
      actionName,
      actionText,
      { ...actionParams, debug: options?.debug },
      {
        userId: userId,

        contextResources: {
          blueprintId: ref(skillset.blueprintId),
          skillsetId: ref(skillset.id),
          abilityId: ref(ability.id),
        },

        linkedResources: {
          secretId: ref(ability.linkedSecretId),
          fileId: ref(ability.linkedFileId),
          botId: ref(ability.linkedBotId),
          spaceId: ref(ability.linkedSpaceId),
        },

        inlineSecrets: ability.inlineSecrets,

        // @ts-ignore we get an error due to some Message implementation using strings instead of the type
        messages: options?.messages,

        usageMeta: options?.usageMeta,

        sink: options?.sink,

        signal: options?.signal,
      }
    )
  } catch (e) {
    await captureException(e)

    if (options?.debug) {
      actionReturn = {
        error: e instanceof Error ? e.message : String(e),
      }
    } else if (e instanceof TimeoutError) {
      actionReturn = {
        error:
          'The operation timed out. Please try again or contact support if the issue persists.',
      }
    } else if (e instanceof SafeError) {
      actionReturn = {
        error: e.message,
      }
    } else {
      actionReturn = {
        error: 'An unexpected error occurred.',
      }
    }
  }

  if (!actionReturn) {
    debug(`aborting skillset action application due to no action return`).log(
      'skillset.apply.applySkillset'
    )

    return abort()
  }

  debug(`received action return`, { name, input, actionReturn }).log(
    'skillset.apply.applySkillset'
  )

  // @note detect large responses and optionally chunk them for retrieval via
  // _readChunk - we use token count for threshold detection but character count
  // for splitting because character-based splitting is more predictable and
  // faster, while tokens vary by content type - the 8k character default
  // roughly corresponds to ~2k tokens chunking is disabled by default but can
  // be enabled via the options.chunking flag
  {
    const chunkingEnabled = options?.chunking ?? false

    // @note skip processing for null/undefined results

    if (actionReturn.result != null) {
      let resultText

      try {
        resultText =
          typeof actionReturn.result === 'string'
            ? actionReturn.result
            : JSON.stringify(actionReturn.result)
      } catch {
        // @note if JSON.stringify fails (circular refs, etc.), skip processing
        // the result will be passed through as-is and may cause issues
        // downstream

        debug(
          'failed to stringify result, skipping large response handling'
        ).log('skillset.apply.applySkillset')

        resultText = null
      }

      if (resultText !== null) {
        const tokenCount = getTextTokensLength(resultText)

        if (tokenCount > LARGE_RESPONSE_TOKEN_THRESHOLD) {
          debug('large response detected', {
            tokenCount: tokenCount,
            threshold: LARGE_RESPONSE_TOKEN_THRESHOLD,
            chunkingEnabled: chunkingEnabled,
          }).log('skillset.apply.applySkillset')

          // @note always capture observation for large responses, regardless of
          // whether chunking is enabled - this helps with monitoring and
          // debugging

          void captureObservation('skillset action returned large response', {
            tokenCount: tokenCount,
            action: actionName,
            userId: userId,
            blueprintId: skillset.blueprintId,
            skillsetId: skillset.id,
            abilityId: ability.id,
            chunked: chunkingEnabled,
          })

          // @note only chunk the response if chunking is enabled

          if (chunkingEnabled) {
            try {
              const chunkedMetadata = await storeChunkedResponse(resultText)

              debug('response chunked successfully', { chunkedMetadata }).log(
                'skillset.apply.applySkillset'
              )

              // @note replace the result with chunked metadata so the LLM can
              // use the _read_chunk internal function to retrieve individual
              // chunks

              actionReturn.result = chunkedMetadata
            } catch (e) {
              // @note if chunking fails, log the error but continue with
              // original result to avoid breaking the flow

              await captureException(e)

              debug('failed to chunk response, continuing with original', {
                error: e,
              }).log('skillset.apply.applySkillset')
            }
          }
        }
      }
    }
  }

  const messages = []

  messages.push(
    ...[
      ...(actionReturn.messages || []),
      ...(actionReturn.hintMessages || []),
    ].map((message) => {
      return {
        ...message,

        /** @type {import('@/lib/meta').SkillsetMeta} */
        meta: {
          ...message.meta,

          skillset: {
            id: skillset.id,
            action: {
              name,
              input,
              justification,
            },
          },
        },
      }
    })
  )

  const ret = {
    usage: usage.toTokenModelObject(),

    error: actionReturn.error || undefined,

    result: actionReturn.result || undefined,

    messages,

    /** @type {import('@/lib/meta').SkillsetMeta} */
    meta: {
      skillset: {
        id: skillset.id,
        action: {
          name,
          input,
          justification,
        },
      },
    },
  }

  debug(`skillset application result`, { ret }).log(
    'skillset.apply.applySkillset'
  )

  return ret
}
