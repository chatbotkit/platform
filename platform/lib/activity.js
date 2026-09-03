// @ts-check
import { equal } from '@/lib/object'
import { tryParse as tryParseYaml } from '@/lib/yaml'
import { tryRepair as tryRepairYaml } from '@/lib/yaml.repair'

// @note we use yaml as a more universal json parser that can also handle things
// simple key: value pairs, etc

export const TRIGGER_ACTIVITY_TYPE = 'trigger'
export const REQUEST_ACTIVITY_TYPE = 'request'
export const RESPONSE_ACTIVITY_TYPE = 'response'

/**
 * @typedef {{
 *  type: 'trigger',
 *  function: {
 *   name: string,
 *  }
 * }} TriggerActivity
 *
 * @typedef {{
 *  type: 'request',
 *  function: {
 *   name: string,
 *   arguments: any,
 *  }
 * }} RequestActivity
 *
 * @typedef {{
 *  type: 'response',
 *  function: {
 *   name: string,
 *   arguments: any,
 *   result: any,
 *  }
 * }} ResponseActivity
 */

/**
 * @param {{type: string, meta?: Record<string,any>}} message
 * @returns {boolean}
 */
export function isActivityMessage(message) {
  return message.type === 'activity'
}

/**
 * @param {{type: string, meta?: Record<string,any>}} message
 * @returns {boolean}
 */
export function isTriggerActivityMessage(message) {
  return (
    message.type === 'activity' &&
    message.meta?.activity?.type === TRIGGER_ACTIVITY_TYPE
  )
}

/**
 * @param {{type: string, meta?: Record<string,any>}} message
 * @returns {boolean}
 */
export function isRequestActivityMessage(message) {
  return (
    message.type === 'activity' &&
    message.meta?.activity?.type === REQUEST_ACTIVITY_TYPE
  )
}

/**
 * @param {{type: string, meta?: Record<string,any>}} message
 * @returns {boolean}
 */
export function isResponseActivityMessage(message) {
  return (
    message.type === 'activity' &&
    message.meta?.activity?.type === RESPONSE_ACTIVITY_TYPE
  )
}

/**
 * @param {{type: string, meta?: Record<string,any>}} messageA
 * @param {{type: string, meta?: Record<string,any>}} messageB
 * @returns {boolean}
 */
export function isTheSameTriggerActivityMessage(messageA, messageB) {
  if (!isActivityMessage(messageA) || !isActivityMessage(messageB)) {
    return false
  }

  const activityA =
    /** @type {import('@/lib/message').ActivityMessage['meta']['activity']} */ (
      messageA.meta?.activity
    )

  const activityB =
    /** @type {import('@/lib/message').ActivityMessage['meta']['activity']} */ (
      messageB.meta?.activity
    )

  if (!activityA || !activityB) {
    return false
  }

  if (activityA.type !== TRIGGER_ACTIVITY_TYPE) {
    return false
  }

  if (activityB.type !== TRIGGER_ACTIVITY_TYPE) {
    return false
  }

  if (activityA.function.name !== activityB.function.name) {
    return false
  }

  return true
}

/**
 * @param {{type: string, meta?: Record<string,any>}} messageA
 * @param {{type: string, meta?: Record<string,any>}} messageB
 * @returns {boolean}
 */
export function isTheSameRequestActivityMessage(messageA, messageB) {
  if (!isActivityMessage(messageA) || !isActivityMessage(messageB)) {
    return false
  }

  const activityA =
    /** @type {import('@/lib/message').ActivityMessage['meta']['activity']} */ (
      messageA.meta?.activity
    )

  const activityB =
    /** @type {import('@/lib/message').ActivityMessage['meta']['activity']} */ (
      messageB.meta?.activity
    )

  if (!activityA || !activityB) {
    return false
  }

  if (activityA.type !== REQUEST_ACTIVITY_TYPE) {
    return false
  }

  if (activityB.type !== REQUEST_ACTIVITY_TYPE) {
    return false
  }

  if (activityA.function.name !== activityB.function.name) {
    return false
  }

  if (activityA.function.arguments !== activityB.function.arguments) {
    if (
      typeof activityA.function.arguments === 'object' &&
      activityA.function.arguments !== null &&
      typeof activityB.function.arguments === 'object' &&
      activityB.function.arguments !== null
    ) {
      return equal(
        activityA.function.arguments || {},
        activityB.function.arguments || {}
      )
    }

    if (
      typeof activityA.function.arguments === 'string' &&
      typeof activityB.function.arguments === 'string'
    ) {
      const objA = tryParseYaml(activityA.function.arguments)
      const objB = tryParseYaml(activityB.function.arguments)

      return equal(objA || {}, objB || {})
    }
  }

  return true
}

/**
 * @param {{type: string, meta?: Record<string,any>}} messageA
 * @param {{type: string, meta?: Record<string,any>}} messageB
 * @returns {boolean}
 */
export function isTheSameResponseActivityMessage(messageA, messageB) {
  if (!isActivityMessage(messageA) || !isActivityMessage(messageB)) {
    return false
  }

  const activityA =
    /** @type {import('@/lib/message').ActivityMessage['meta']['activity']} */ (
      messageA.meta?.activity
    )

  const activityB =
    /** @type {import('@/lib/message').ActivityMessage['meta']['activity']} */ (
      messageB.meta?.activity
    )

  if (!activityA || !activityB) {
    return false
  }

  if (activityA.type !== RESPONSE_ACTIVITY_TYPE) {
    return false
  }

  if (activityB.type !== RESPONSE_ACTIVITY_TYPE) {
    return false
  }

  if (activityA.function.name !== activityB.function.name) {
    return false
  }

  if (activityA.function.arguments !== activityB.function.arguments) {
    if (
      typeof activityA.function.arguments === 'object' &&
      activityA.function.arguments !== null &&
      typeof activityB.function.arguments === 'object' &&
      activityB.function.arguments !== null
    ) {
      return equal(
        activityA.function.arguments || {},
        activityB.function.arguments || {}
      )
    }

    if (
      typeof activityA.function.arguments === 'string' &&
      typeof activityB.function.arguments === 'string'
    ) {
      const objA = tryParseYaml(activityA.function.arguments)
      const objB = tryParseYaml(activityB.function.arguments)

      return equal(objA || {}, objB || {})
    }
  }

  if (activityA.function.result !== activityB.function.result) {
    if (
      typeof activityA.function.result === 'object' &&
      activityA.function.result !== null &&
      typeof activityB.function.result === 'object' &&
      activityB.function.result !== null
    ) {
      return equal(
        activityA.function.result || {},
        activityB.function.result || {}
      )
    }

    if (
      typeof activityA.function.result === 'string' &&
      typeof activityB.function.result === 'string'
    ) {
      const objA = tryParseYaml(activityA.function.result)
      const objB = tryParseYaml(activityB.function.result)

      return equal(objA || {}, objB || {})
    }
  }

  return true
}

/**
 * @param {{type: string, meta?: Record<string,any>}} messageA
 * @param {{type: string, meta?: Record<string,any>}} messageB
 * @returns {boolean}
 */
export function isTheSameActivityMessage(messageA, messageB) {
  return (
    isTheSameTriggerActivityMessage(messageA, messageB) ||
    isTheSameRequestActivityMessage(messageA, messageB) ||
    isTheSameResponseActivityMessage(messageA, messageB)
  )
}

/**
 * @param {{type: string, meta?: Record<string,any>}} messageA
 * @param {{type: string, meta?: Record<string,any>}} messageB
 * @returns {boolean}
 */
export function isPairedActivityMessage(messageA, messageB) {
  if (!isActivityMessage(messageA) || !isActivityMessage(messageB)) {
    return false
  }

  const activityA =
    /** @type {import('@/lib/message').ActivityMessage['meta']['activity']} */ (
      messageA.meta?.activity
    )

  const activityB =
    /** @type {import('@/lib/message').ActivityMessage['meta']['activity']} */ (
      messageB.meta?.activity
    )

  if (!activityA || !activityB) {
    return false
  }

  if (activityA.type === activityB.type) {
    return false
  }

  if (
    activityA.type !== REQUEST_ACTIVITY_TYPE &&
    activityA.type !== RESPONSE_ACTIVITY_TYPE
  ) {
    return false
  }

  if (
    activityB.type !== REQUEST_ACTIVITY_TYPE &&
    activityB.type !== RESPONSE_ACTIVITY_TYPE
  ) {
    return false
  }

  if (activityA.function.name !== activityB.function.name) {
    return false
  }

  if (activityA.function.arguments !== activityB.function.arguments) {
    if (
      typeof activityA.function.arguments === 'object' &&
      activityA.function.arguments !== null &&
      typeof activityB.function.arguments === 'object' &&
      activityB.function.arguments !== null
    ) {
      return equal(
        activityA.function.arguments || {},
        activityB.function.arguments || {}
      )
    }

    if (
      typeof activityA.function.arguments === 'string' &&
      typeof activityB.function.arguments === 'string'
    ) {
      const objA = tryParseYaml(activityA.function.arguments)
      const objB = tryParseYaml(activityB.function.arguments)

      return equal(objA || {}, objB || {})
    }
  }

  return true
}

/**
 * @param {any} functionArguments
 * @returns {string}
 */
function getSyntheticActivityJustification(functionArguments) {
  if (typeof functionArguments === 'object' && functionArguments !== null) {
    if (
      'justification' in functionArguments &&
      typeof functionArguments.justification === 'string'
    ) {
      return functionArguments.justification
    }

    return ''
  }

  if (typeof functionArguments === 'string') {
    const yaml = tryRepairYaml(functionArguments)

    if (!yaml) {
      return ''
    }

    const parsed = tryParseYaml(yaml)

    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      'justification' in parsed &&
      typeof parsed.justification === 'string'
    ) {
      return parsed.justification
    }
  }

  return ''
}

/**
 * @param {any} functionArguments
 * @returns {any}
 */
function stripSyntheticActivityJustification(functionArguments) {
  if (typeof functionArguments === 'object' && functionArguments !== null) {
    if ('input' in functionArguments && 'justification' in functionArguments) {
      const { justification, ...rest } = functionArguments

      justification

      return rest
    }

    return functionArguments
  }

  if (typeof functionArguments === 'string') {
    const yaml = tryRepairYaml(functionArguments)

    if (!yaml) {
      return functionArguments
    }

    const parsed = tryParseYaml(yaml)

    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      'input' in parsed &&
      'justification' in parsed
    ) {
      const { justification, ...rest } = parsed

      justification

      return JSON.stringify(rest)
    }
  }

  return functionArguments
}

/**
 * @param {string} functionName
 * @param {Record<string,any>} [meta]
 * @returns {import('@/lib/message').FunctionTriggerActivityMessage}
 */
export function makeTriggerActivityMessage(functionName, meta) {
  return {
    type: 'activity',

    text: '',

    meta: {
      ...meta,

      /** @type {TriggerActivity} */
      activity: {
        type: TRIGGER_ACTIVITY_TYPE,

        function: {
          name: functionName,
        },
      },
    },
  }
}

/**
 * @param {string} functionName
 * @param {any} functionArguments
 * @param {Record<string,any>} [meta]
 * @returns {import('@/lib/message').FunctionRequestActivityMessage}
 */
export function makeRequestActivityMessage(
  functionName,
  functionArguments,
  meta
) {
  const text = getSyntheticActivityJustification(functionArguments)

  const sanitizedFunctionArguments =
    stripSyntheticActivityJustification(functionArguments)

  return {
    type: 'activity',

    text,

    meta: {
      ...meta,

      /** @type {RequestActivity} */
      activity: {
        type: REQUEST_ACTIVITY_TYPE,

        function: {
          name: functionName,
          arguments: sanitizedFunctionArguments,
        },
      },
    },
  }
}

/**
 * @param {string} functionName
 * @param {any} functionArguments
 * @param {any} functionResult
 * @param {Record<string,any>} [meta]
 * @returns {import('@/lib/message').FunctionResponseActivityMessage}
 */
export function makeResponseActivityMessage(
  functionName,
  functionArguments,
  functionResult,
  meta
) {
  const sanitizedFunctionArguments =
    stripSyntheticActivityJustification(functionArguments)

  return {
    type: 'activity',

    text: '',

    meta: {
      ...meta,

      /** @type {ResponseActivity} */
      activity: {
        type: RESPONSE_ACTIVITY_TYPE,

        function: {
          name: functionName,
          arguments: sanitizedFunctionArguments,
          result: functionResult,
        },
      },
    },
  }
}

/**
 * @param {string} functionName
 * @param {any} functionArguments
 * @param {any} functionResult
 * @param {Record<string,any>} [meta]
 * @returns {[import('@/lib/message').FunctionRequestActivityMessage, import('@/lib/message').FunctionResponseActivityMessage]}
 */
export function makeActivityMessagePair(
  functionName,
  functionArguments,
  functionResult,
  meta
) {
  return [
    makeRequestActivityMessage(functionName, functionArguments, meta),
    makeResponseActivityMessage(
      functionName,
      functionArguments,
      functionResult,
      meta
    ),
  ]
}

/**
 * @param {import('@/lib/message').ActivityMessage['meta']['activity']} activity
 * @returns {any}
 */
export function getActivityArguments(activity) {
  if (!activity) {
    return null
  }

  if (
    typeof activity.function !== 'object' ||
    activity.function === null
  ) {
    return null
  }

  if ('arguments' in activity.function) {
    if (
      typeof activity.function.arguments === 'object' &&
      activity.function.arguments !== null
    ) {
      return activity.function.arguments
    } else if (typeof activity.function.arguments === 'string') {
      const yaml = tryRepairYaml(activity.function.arguments)

      return yaml
        ? tryParseYaml(yaml) || activity.function.arguments
        : activity.function.arguments
    } else {
      return activity.function.arguments
    }
  }

  return null
}

/**
 * @param {import('@/lib/message').ActivityMessage['meta']['activity']} activity
 * @returns {any}
 */
export function getActivityResult(activity) {
  if (!activity) {
    return null
  }

  if (
    typeof activity.function !== 'object' ||
    activity.function === null
  ) {
    return null
  }

  if ('result' in activity.function) {
    if (
      typeof activity.function.result === 'object' &&
      activity.function.result !== null
    ) {
      return activity.function.result
    } else if (typeof activity.function.result === 'string') {
      const yaml = tryRepairYaml(activity.function.result)

      return yaml
        ? tryParseYaml(yaml) || activity.function.result
        : activity.function.result
    } else {
      return activity.function.result
    }
  }

  return null
}

/**
 * @param {import('@/lib/message').ActivityMessage['meta']['activity']} activity
 * @returns {any}
 */
export function getActivityArgumentsAndResult(activity) {
  if (!activity) {
    return { arguments: null, result: null }
  }

  return {
    arguments: getActivityArguments(activity),
    result: getActivityResult(activity),
  }
}

/**
 * @param {import('@/lib/message').ActivityMessage} message
 * @returns {any}
 */
export function getActivityMessageResult(message) {
  if (!isActivityMessage(message)) {
    return null
  }

  return getActivityResult(message.meta?.activity)
}

/**
 * Groups paired request/response activity messages into combined activities.
 * When a request activity has a matching response, they are merged into a
 * single message with type 'request-response' that contains both arguments
 * and result.
 *
 * @param {{type: string, meta?: Record<string,any>}[]} messages
 * @returns {{type: string, meta?: Record<string,any>}[]}
 */
export function groupActivityMessages(messages) {
  /** @type {{type: string, meta?: Record<string,any>}[]} */
  const result = []

  /** @type {Set<number>} */
  const processedIndices = new Set()

  for (let i = 0; i < messages.length; i++) {
    if (processedIndices.has(i)) {
      continue
    }

    const message = messages[i]

    if (!isRequestActivityMessage(message)) {
      result.push(message)

      continue
    }

    // @note look for a matching response activity message
    let matchedResponseIndex = -1

    for (let j = i + 1; j < messages.length; j++) {
      if (processedIndices.has(j)) {
        continue
      }

      const candidateMessage = messages[j]

      if (isPairedActivityMessage(message, candidateMessage)) {
        matchedResponseIndex = j

        break
      }
    }

    if (matchedResponseIndex === -1) {
      result.push(message)

      continue
    }

    const responseMessage = messages[matchedResponseIndex]

    processedIndices.add(matchedResponseIndex)

    // @note merge request and response into a combined activity
    const combinedActivity = {
      ...message,

      meta: {
        ...message.meta,
        ...responseMessage.meta,

        activity: {
          type: 'request-response',

          function: {
            ...message.meta?.activity?.function,
            ...responseMessage.meta?.activity?.function,
          },
        },
      },
    }

    result.push(combinedActivity)
  }

  return result
}
