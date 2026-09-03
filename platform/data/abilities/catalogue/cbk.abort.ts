import { createAbortTemplate, field } from '@/lib/ability.template'

/**
 * Catalogue of ChatBotKit abort abilities.
 */
const abilities = {
  abort: createAbortTemplate({
    provider: 'cbk',
    icon: '@logo/chatbotkit.com',
    name: 'Abort Operation',
    description: 'Abort the current operation',
    tags: ['abort'],
    instruction: {
      reason: field({
        name: 'reason',
        description:
          'a very short reason for the abort, e.g. "task succeeded", "task failed", etc',
      }),
    },
  }),

  'abort[success]': createAbortTemplate({
    provider: 'cbk',
    icon: '@logo/chatbotkit.com',
    name: 'Success',
    description:
      'Exit the current operation by marking the current operation as successful - must be called as the last operation once all tasks are completed',
    tags: ['success'],
    instruction: {
      reason: field({
        name: 'reason',
        description:
          'a very short reason for the abort, e.g. "task succeeded", "task completed", etc',
      }),
    },
  }),

  'abort[failure]': createAbortTemplate({
    provider: 'cbk',
    icon: '@logo/chatbotkit.com',
    name: 'Failure',
    description:
      'Exit the current operation by marking the current operation as failure - must be called as the last operation if an unrecoverable error is encountered',
    tags: ['fail'],
    instruction: {
      reason: field({
        name: 'reason',
        description:
          'a very short reason for the abort, e.g. "task failed", "task aborted", etc',
      }),
    },
  }),
}

export default abilities
