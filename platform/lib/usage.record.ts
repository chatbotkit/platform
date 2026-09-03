import prisma from '@/prisma/client'
import type { User } from '@/prisma/types'

import {
  getContextBot,
  getContextContact,
  getContextConversation,
  getContextRequestIpAddress,
} from '@/lib/context.store'
import debug, { createSpan } from '@/lib/debug'
import { UnexpectedStateError } from '@/lib/error'
import { runTasks } from '@/lib/job'
import {
  PLATFORM_TOKEN_USAGE_TYPE,
  getPlatformTokenUsageKey,
} from '@/lib/limit.platform'
import memcache from '@/lib/memcache'
import {
  audioModelToUseType,
  getBaseImageModelTokenCount,
  getBaseLanguageModelTokenCount,
  getBaseRerankModelTokenCount,
  getBaseVideoModelTokenCount,
  imageModelToUseType,
  languageModelToUseType,
  rerankModelToUseType,
  useTypeToImageModelMapping,
  useTypeToLanguageModelMapping,
  useTypeToRerankModelMapping,
  useTypeToVideoModelMapping,
  videoModelToUseType,
} from '@/lib/model.utils'
import queue from '@/lib/queue'
import { USAGE_PERIOD_IN_SECONDS } from '@/lib/usage.period'
import {
  USAGE_TYPE_TO_POLICY_METRIC,
  evaluateUsagePolicies,
} from '@/lib/usage.policy'
import { UseType } from '@/lib/usage.types'
import { fastGetUserById } from '@/lib/user.get'

import type { RecordEvent } from '@/pages/api/v1/usage/queue'

/**
 * Returns the unique usage key for a user and a usage type. This is used to
 * store the usage count for a user and a usage type.
 */
export function getUsageKey(userId: string, type: string): string {
  return `usage-${userId}-${type}`
}

/**
 * Returns whether usage recording is skipped. This is useful for testing.
 */
export function isUsageRecordingSkipped(): boolean {
  return !!process.env.SKIP_USAGE_RECORDING
}

/**
 * Extracts the base type from a compound use type string.
 */
export function convertUseTypeToBaseType(type: string): string {
  const baseType = (type.split('_').pop() as string).toLowerCase()

  // @todo perform some basic validation

  return baseType
}

/**
 * Calibrates a raw usage count into the base count used for billing and
 * platform accounting.
 *
 * The user is charged for the tokens they consume but each model has a
 * different token ratio, so the raw count is converted to a calibrated base
 * count based on the model. Usage types without a model calibration are
 * returned unchanged.
 */
export function getCalibratedBaseCount(type: string, count: number): number {
  if (useTypeToLanguageModelMapping[type]) {
    return getBaseLanguageModelTokenCount(
      useTypeToLanguageModelMapping[type],
      count
    )
  }

  if (useTypeToImageModelMapping[type]) {
    return getBaseImageModelTokenCount(useTypeToImageModelMapping[type], count)
  }

  if (useTypeToVideoModelMapping[type]) {
    return getBaseVideoModelTokenCount(useTypeToVideoModelMapping[type], count)
  }

  if (useTypeToRerankModelMapping[type]) {
    return getBaseRerankModelTokenCount(
      useTypeToRerankModelMapping[type],
      count
    )
  }

  return count
}

/**
 * Resets the Redis usage counter for a user and type.
 */
export async function resetUsage(userId: string, type: string): Promise<void> {
  debug(`resting usage for ${type}`).log('usage.record.resetUsage')

  const baseType = convertUseTypeToBaseType(type)
  const usageKey = getUsageKey(userId, baseType)

  await memcache.del(usageKey)
}

/**
 * Optional resource IDs associated with a usage event.
 */
export interface UsageReferences {
  conversationId?: string
  messageId?: string
  taskId?: string
  contactId?: string
  blueprintId?: string
  botId?: string
  datasetId?: string
  skillsetId?: string
  abilityId?: string
  slackIntegrationId?: string
}

/**
 * Options for captureUsage and queueUsage.
 */
interface CaptureUsageOptions {
  confirm: boolean
  user: Pick<User, 'id'>
  type: string
  count: number
  meta?: Record<string, unknown>
  references?: UsageReferences
}

/**
 * Captures a usage event by creating a database record and incrementing a Redis
 * counter for the current billing period.
 *
 * Each usage record stores parentUserId directly so that the parent
 * relationship is preserved on the record itself even if the child User is
 * later deleted. When a User belongs to a parent User (user.parentId),
 * usage is recorded twice by the caller (recordUsage): once for the child
 * User and once for the parent User. This ensures the parent User has its
 * own independent usage records that survive child User deletion. The User
 * table uses onDelete: NoAction on the Usage relation so userId values are
 * retained after deletion, but resolving userId to parentId via the User
 * table would fail. The parentUserId field avoids that dependency.
 *
 * Defense layers for parentUserId:
 *
 * 1. The User interface in lib/user.get.ts declares parentId as a required
 *    key (parentId: string | null, not optional-key) so TypeScript
 *    errors if it is removed from the interface or from getUserObject.
 * 2. The satisfies assertion below on userInstance.parentId produces a
 *    compile error if the property disappears from the type.
 * 3. Unit tests on fastGetUserById assert that the Prisma select includes
 *    parentId and that the returned object contains it.
 * 4. Unit tests on captureUsage assert the exact prisma.usage.create payload
 *    including parentUserId for both parent and no-parent scenarios.
 */
export async function captureUsage({
  confirm,

  user,

  type,

  count,

  meta = undefined,

  references = undefined,
}: CaptureUsageOptions): Promise<void> {
  debug(`capturing usage`, { user, type, count, meta, references }).log(
    'usage.record.captureUsage'
  )

  if (confirm !== true) {
    throw new Error(`Usage not confirmed`)
  }

  if (!count) {
    return
  }

  // The calibrated count is used because the user is charged for the tokens
  // they consume but each model has a different token ratio. Notice that the
  // actual count as per the usage type is recorded correctly on the db record.

  const baseCount = getCalibratedBaseCount(type, count)

  // @note validate baseCount before passing to Redis to prevent errors like
  // "ERR value is not an integer or out of range"
  {
    if (!Number.isFinite(baseCount)) {
      throw new UnexpectedStateError(
        `Invalid baseCount: expected finite number, got ${baseCount} (type=${type}, count=${count})`
      )
    }

    if (!Number.isInteger(baseCount)) {
      throw new UnexpectedStateError(
        `Invalid baseCount: expected integer, got ${baseCount} (type=${type}, count=${count})`
      )
    }

    // @note Redis INCRBY supports signed 64-bit integers (negative values are
    // allowed for decrements like refunds and credits). JavaScript's
    // MAX_SAFE_INTEGER (2^53 - 1) is well within Redis bounds.

    if (Math.abs(baseCount) > Number.MAX_SAFE_INTEGER) {
      throw new UnexpectedStateError(
        `Invalid baseCount: exceeds safe integer range, got ${baseCount} (type=${type}, count=${count})`
      )
    }
  }

  const tasks: Promise<unknown>[] = []

  // create usage record
  {
    let parentUserId: string | undefined

    {
      const userInstance = await fastGetUserById(user.id)

      if (userInstance) {
        // Usage records must always capture the parent User relationship so
        // that billing aggregation and reporting work correctly across child
        // and parent Users. Do not remove this property access. If parentId
        // is removed from the User type returned by fastGetUserById, this line
        // will produce a compile error, which is
        // the intended safety net.

        parentUserId =
          (userInstance.parentId satisfies string | null) || undefined
      }
    }

    const conversation = getContextConversation()

    const contact = getContextContact()

    const bot = getContextBot()

    const conversationId = references?.conversationId || conversation?.id

    const messageId = references?.messageId

    const contactId =
      references?.contactId || conversation?.contactId || contact?.id

    const botId = references?.botId || conversation?.botId || bot?.id

    const datasetId =
      references?.datasetId || conversation?.datasetId || bot?.datasetId

    const skillsetId =
      references?.skillsetId || conversation?.skillsetId || bot?.skillsetId

    const data = {
      userId: user.id,

      parentUserId: parentUserId,

      type: type,

      count: count,

      conversationId: conversationId,
      messageId: messageId,
      contactId: contactId,
      botId: botId,
      datasetId: datasetId,
      skillsetId: skillsetId,

      meta: {
        ipAddress: getContextRequestIpAddress() || undefined,

        ...meta,
      },
    }

    debug(`creating usage record`, { data }).log('usage.record.captureUsage')

    tasks.push(
      prisma.usage.create({
        data,
      })
    )
  }

  // increment usage count
  {
    const baseType = convertUseTypeToBaseType(type)
    const usageKey = getUsageKey(user.id, baseType)

    debug(`incrementing usage count`, {
      usageKey,
      baseCount,
    }).log('usage.record.captureUsage')

    // It is important to describe what is going on here and some of the caveats
    // that we are dealing with. The purpose of this code is to record the usage
    // count for a user and a usage type. We are setting an expiration on the
    // key to ensure that the usage count is reset after a month. This
    // expiration counts from the time the key was last set (right now).
    //
    // Customers on the free plan will have their usage count reset
    // automatically when the key expires.
    //
    // Customers on monthly plans reset the usage count every month when their
    // subscription renews. This is handled in the billing webhook.
    //
    // In the past we used to have annual plans but they proved to be too much
    // hassle to manage so we are not offering them anymore. Instead, for annual
    // plans we will just charge the customer every month and give them a
    // credit based on the annual plan fee. Needless to say that different
    // customers may have different plan types and fees.
    //
    // @note incrementing and expiring cannot be two round trips: a burst of
    // concurrent requests would each find the counter absent, each start a
    // fresh window, and the period would never close. The atomicity lives in
    // the key-value module now - see @chatbotkit-dev/memcache-spec.

    tasks.push(
      memcache.incrementInWindow(usageKey, baseCount, USAGE_PERIOD_IN_SECONDS)
    )
  }

  // evaluate per-bot usage policies (block / notify on threshold). Runs
  // concurrently with the increments above; it keeps its own per-policy window
  // counters and never throws into the recording path.
  {
    const conversation = getContextConversation()
    const bot = getContextBot()

    const botId = references?.botId || conversation?.botId || bot?.id

    const baseType = convertUseTypeToBaseType(type)

    if (botId && USAGE_TYPE_TO_POLICY_METRIC[baseType]) {
      tasks.push(
        evaluateUsagePolicies({
          userId: user.id,
          botId,
          baseType,
          amount: baseCount,
        })
      )
    }
  }

  await runTasks(tasks)
}

/**
 * Queues a usage event for asynchronous processing.
 */
export async function queueUsage({
  confirm,

  user,

  type,
  count,

  meta = undefined,

  references = undefined,
}: CaptureUsageOptions): Promise<void> {
  if (confirm !== true) {
    throw new Error(`Usage not confirmed`)
  }

  if (!count) {
    return
  }

  if (isUsageRecordingSkipped()) {
    debug(`skipping usage queueing`, { user, type, count, meta }).log(
      'usage.queueUsage'
    )

    return
  }

  debug(`queue usage`, { user, type, count, meta }).log(
    'usage.record.queueUsage'
  )

  if (!count) {
    return
  }

  debug(`recording ${type} use: ${count}`).log('usage.record.queueUsage')

  const span = createSpan({ name: 'captureUsage' })

  try {
    /**
     * We might be over-engineering this but we are using a queue to record the
     * usage event. This is because we want to make sure that the usage event is
     * recorded consistently and this may take longer time to reconcile.
     */
    const queueData: RecordEvent = {
      // The reason we don't use the imported RECORD_EVENT_TYPE is because this
      // lib is used in edge functions where the billing provider does not compile. That being
      // said, the typescript should correctly catch any errors in the data
      // structure if it changes.

      type: 'record',

      payload: {
        userId: user.id,

        type: type,

        count: count,

        meta: {
          ipAddress: getContextRequestIpAddress(),

          conversationId: getContextConversation()?.id,

          contactId: getContextContact()?.id,

          ...meta,
        },

        references,
      },
    }

    await queue(`/api/v1/usage/queue`, queueData)
  } finally {
    span.finish()
  }
}

/**
 * Options for recordUsage.
 */
interface RecordUsageOptions {
  user: Pick<User, 'id'>
  type: string
  count: number
  meta?: Record<string, unknown>
  references?: UsageReferences
}

/**
 * Records usage for a User and, if applicable, their parent User.
 */
export async function recordUsage({
  user,
  type,
  count,
  meta,
  references,
}: RecordUsageOptions): Promise<void> {
  debug(`recording usage`, { user, type, count, meta, references })
    .log('usage.record.recordUsage')
    .log('metric.usage') // @note parsed by external log drains to emit platform_usage_total Prometheus metrics

  if (!count) {
    debug(`no usage to record`, { user, type, count, meta, references }).log(
      'usage.record.recordUsage'
    )

    return
  }

  // @note the reason we disable the queue approach is because it is not
  // actually faster because upstash queues are based in EU and the latency is
  // too high for this operation

  // @todo revise this approach at later time

  const useQueue = false // @todo make this configurable flag

  if (isUsageRecordingSkipped()) {
    debug(`skipping usage recording`, {
      user,
      type,
      count,
      meta,
      references,
    }).log('usage.record.recordUsage')

    return
  }

  const span = createSpan({ name: 'recordUsage' })

  try {
    const userInstance = await fastGetUserById(user.id)

    if (!userInstance) {
      throw new Error(`User not found: ${user.id}`)
    }

    const fn: typeof captureUsage | typeof queueUsage = useQueue
      ? queueUsage
      : captureUsage

    const tasks: Promise<void>[] = []

    tasks.push(
      // @note capture the usage for the user

      fn({
        confirm: true,

        user: { id: userInstance.id },
        type,
        count,

        meta: {
          ...meta,
        },

        references,
      })
    )

    if (userInstance.parentId) {
      // @note capture the usage for the parent user

      tasks.push(
        fn({
          confirm: true,

          user: { id: userInstance.parentId },
          type,
          count,

          meta: {
            ...meta,

            userId: userInstance.id,
            childId: userInstance.id,
          },

          references,
        })
      )
    }

    // Increment the platform-wide token counter exactly once per usage event
    // (not per parent/child mirror) so the global monthly budget reflects real
    // consumption. See platformBudgetOk in @/lib/limit.platform. Tracked only
    // for the token base type, on the same monthly expiry window as the
    // per-user counter.
    {
      const baseType = convertUseTypeToBaseType(type)

      if (baseType === PLATFORM_TOKEN_USAGE_TYPE) {
        const baseCount = getCalibratedBaseCount(type, count)

        if (Number.isInteger(baseCount) && baseCount !== 0) {
          tasks.push(
            memcache
              .incrementInWindow(
                getPlatformTokenUsageKey(),
                baseCount,
                USAGE_PERIOD_IN_SECONDS
              )
              .then(() => undefined)
          )
        }
      }
    }

    await Promise.all(tasks)
  } finally {
    span.finish()
  }
}

/**
 * Options for recordConversationUsage.
 */
interface RecordConversationUsageOptions {
  user: Pick<User, 'id'>
  count: number
  meta?: Record<string, unknown>
  references?: UsageReferences
}

/**
 * Records conversation usage.
 */
export async function recordConversationUsage({
  user,
  count = 1,
  meta,
  references,
}: RecordConversationUsageOptions): Promise<void> {
  debug(`recording conversation usage`, { user, count, meta, references }).log(
    'usage.record.recordConversationUsage'
  )

  const type = UseType.CHATBOTKIT_CONVERSATION

  await recordUsage({ user, type, count, meta, references })
}

/**
 * Options for recordMessageUsage.
 */
interface RecordMessageUsageOptions {
  user: Pick<User, 'id'>
  count: number
  meta?: Record<string, unknown>
  references?: UsageReferences
}

/**
 * Records message usage.
 */
export async function recordMessageUsage({
  user,
  count = 1,
  meta,
  references,
}: RecordMessageUsageOptions): Promise<void> {
  debug(`recording message usage`, { user, count, meta, references }).log(
    'usage.record.recordMessageUsage'
  )

  const type = UseType.CHATBOTKIT_MESSAGE

  await recordUsage({ user, type, count, meta, references })
}

/**
 * Options for recordLanguageTokenUsage.
 */
interface RecordLanguageTokenUsageOptions {
  user: Pick<User, 'id'>
  count: number
  model: string
  meta?: Record<string, unknown>
  references?: UsageReferences
}

/**
 * Records language model token usage.
 */
export async function recordLanguageTokenUsage({
  user,
  count,
  model,
  meta,
  references,
}: RecordLanguageTokenUsageOptions): Promise<void> {
  debug(`recording language token usage`, {
    user,
    count,
    model,
    meta,
    references,
  }).log('usage.record.recordLanguageTokenUsage')

  const type = languageModelToUseType(model)

  // @note the reason we do not calibrate here is because this operation is
  // handled by the usage queue

  await recordUsage({ user, type, count, meta, references })
}

/**
 * Options for recordImageTokenUsage.
 */
interface RecordImageTokenUsageOptions {
  user: Pick<User, 'id'>
  count: number
  model: string
  meta?: Record<string, unknown>
  references?: UsageReferences
}

/**
 * Records image model token usage.
 */
export async function recordImageTokenUsage({
  user,
  count,
  model,
  meta,
  references,
}: RecordImageTokenUsageOptions): Promise<void> {
  debug(`recording image token usage`, {
    user,
    count,
    model,
    meta,
    references,
  }).log('usage.record.recordImageTokenUsage')

  const type = imageModelToUseType(model)

  // @note the reason we do not calibrate here is because this operation is
  // handled by the usage queue

  await recordUsage({ user, type, count, meta, references })
}

/**
 * Options for recordVideoTokenUsage.
 */
interface RecordVideoTokenUsageOptions {
  user: Pick<User, 'id'>
  count: number
  model: string
  meta?: Record<string, unknown>
  references?: UsageReferences
}

/**
 * Records video model token usage.
 */
export async function recordVideoTokenUsage({
  user,
  count,
  model,
  meta,
  references,
}: RecordVideoTokenUsageOptions): Promise<void> {
  debug(`recording video token usage`, {
    user,
    count,
    model,
    meta,
    references,
  }).log('usage.record.recordVideoTokenUsage')

  const type = videoModelToUseType(model)

  // @note the reason we do not calibrate here is because this operation is
  // handled by the usage queue

  await recordUsage({ user, type, count, meta, references })
}

/**
 * Options for recordRerankTokenUsage.
 */
interface RecordRerankTokenUsageOptions {
  user: Pick<User, 'id'>
  count: number
  model: string
  meta?: Record<string, unknown>
  references?: UsageReferences
}

/**
 * Records rerank model token usage.
 */
export async function recordRerankTokenUsage({
  user,
  count,
  model,
  meta,
  references,
}: RecordRerankTokenUsageOptions): Promise<void> {
  debug(`recording rerank token usage`, {
    user,
    count,
    model,
    meta,
    references,
  }).log('usage.record.recordRerankTokenUsage')

  const type = rerankModelToUseType(model)

  // @note the reason we do not calibrate here is because this operation is
  // handled by the usage queue

  await recordUsage({ user, type, count, meta, references })
}

/**
 * Options for recordAudioTokenUsage.
 */
interface RecordAudioTokenUsageOptions {
  user: Pick<User, 'id'>
  count: number
  model: string
  meta?: Record<string, unknown>
  references?: UsageReferences
}

/**
 * Records audio model token usage.
 */
export async function recordAudioTokenUsage({
  user,
  count,
  model,
  meta,
  references,
}: RecordAudioTokenUsageOptions): Promise<void> {
  debug(`recording audio token usage`, {
    user,
    count,
    model,
    meta,
    references,
  }).log('usage.record.recordAudioTokenUsage')

  const type = audioModelToUseType(model)

  await recordUsage({ user, type, count, meta, references })
}

/**
 * Options for recordImageUsage.
 */
interface RecordImageUsageOptions {
  user: Pick<User, 'id'>
  count: number
  model: string
  meta?: Record<string, unknown>
  references?: UsageReferences
}

/**
 * Records image generation usage.
 */
export async function recordImageUsage({
  user,
  count,
  model,
  meta,
  references,
}: RecordImageUsageOptions): Promise<void> {
  debug(`recording image usage`, { user, count, model, meta, references }).log(
    'usage.record.recordImageUsage'
  )

  const type = UseType.CHATBOTKIT_IMAGE

  await recordUsage({
    user,
    type,
    count,
    meta: { ...meta, model },
    references,
  })
}

/**
 * Options for recordVideoUsage.
 */
interface RecordVideoUsageOptions {
  user: Pick<User, 'id'>
  count: number
  model: string
  meta?: Record<string, unknown>
  references?: UsageReferences
}

/**
 * Records generated video usage.
 */
export async function recordVideoUsage({
  user,
  count,
  model,
  meta,
  references,
}: RecordVideoUsageOptions): Promise<void> {
  debug(`recording video usage`, { user, count, model, meta, references }).log(
    'usage.record.recordVideoUsage'
  )

  const type = UseType.CHATBOTKIT_VIDEO

  await recordUsage({
    user,
    type,
    count,
    meta: { ...meta, model },
    references,
  })
}

/**
 * Options for recordAudioUsage.
 */
interface RecordAudioUsageOptions {
  user: Pick<User, 'id'>
  count: number
  model: string
  meta?: Record<string, unknown>
  references?: UsageReferences
}

/**
 * Records audio transcription usage.
 */
export async function recordAudioUsage({
  user,
  count,
  model,
  meta,
  references,
}: RecordAudioUsageOptions): Promise<void> {
  debug(`recording audio usage`, { user, count, model, meta, references }).log(
    'usage.record.recordAudioUsage'
  )

  const type = UseType.CHATBOTKIT_AUDIO

  await recordUsage({
    user,
    type,
    count,
    meta: { ...meta, model },
    references,
  })
}

/**
 * Options for recordFetchUsage.
 */
interface RecordFetchUsageOptions {
  user: Pick<User, 'id'>
  count: number
  meta?: Record<string, unknown>
  references?: UsageReferences
}

/**
 * Records fetch usage.
 */
export async function recordFetchUsage({
  user,
  count,
  meta,
  references,
}: RecordFetchUsageOptions): Promise<void> {
  debug(`recording fetch usage`, { user, count, meta, references }).log(
    'usage.record.recordFetchUsage'
  )

  const type = UseType.CHATBOTKIT_FETCH

  await recordUsage({ user, type, count, meta, references })
}

/**
 * Options for recordEmailUsage.
 */
interface RecordEmailUsageOptions {
  user: Pick<User, 'id'>
  count: number
  meta?: Record<string, unknown>
  references?: UsageReferences
}

/**
 * Records email usage.
 */
export async function recordEmailUsage({
  user,
  count,
  meta,
  references,
}: RecordEmailUsageOptions): Promise<void> {
  debug(`recording email usage`, { user, count, meta, references }).log(
    'usage.record.recordEmailUsage'
  )

  const type = UseType.CHATBOTKIT_EMAIL

  await recordUsage({ user, type, count, meta, references })
}
