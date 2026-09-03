import {
  createBlueprintBulletinCreateTemplate,
  createBlueprintBulletinListTemplate,
  createBlueprintMetaFetchTemplate,
  createBlueprintNoteListTemplate,
  createBlueprintResourceListTemplate,
  field,
} from '@/lib/ability.template'

/**
 * Catalogue of ChatBotKit blueprint abilities.
 */
const abilities = {
  'blueprint/resource/list': createBlueprintResourceListTemplate({
    provider: 'cbk',
    icon: '@logo/chatbotkit.com',
    name: 'List Current Blueprint Resources',
    description: 'List the resources available in the current blueprint',
    tags: ['blueprint', 'resource', 'list', 'beta'],
    commentary:
      'This ability lists all resources that are available in the current blueprint. You can optionally filter the resources by type, such as bot, dataset, skillset, ability, file, or secret.',
    instruction: {
      type: field({
        name: 'type',
        description: 'optional resource type to filter by',
        optional: true,
        enum: [
          'all',
          'bot',
          'dataset',
          'skillset',
          'ability',
          'file',
          'secret',
          'space',
          // @todo add integration type
        ],
        default: 'all',
        placeholder: true,
      }),
    },
  }),

  'blueprint/note/list': createBlueprintNoteListTemplate({
    provider: 'cbk',
    icon: '@logo/chatbotkit.com',
    name: 'List Current Blueprint Notes',
    description: 'List the notes stored in the current blueprint',
    tags: ['blueprint', 'note', 'list', 'beta'],
    commentary:
      'This ability lists all notes that are stored in the current blueprint metadata. Notes are typically used in the blueprint designer to document the blueprint structure and design decisions.',
    instruction: {},
  }),

  'blueprint/bulletin/list': createBlueprintBulletinListTemplate({
    provider: 'cbk',
    icon: '@logo/chatbotkit.com',
    name: 'List Current Blueprint Bulletins',
    description: 'List the bulletins on the current blueprint shared board',
    tags: ['blueprint', 'bulletin', 'list', 'beta'],
    commentary:
      'This ability lists the active bulletins on the current blueprint\'s shared board. Bulletins are short messages that agents within the same blueprint leave for one another. Expired bulletins are not returned.',
    instruction: {},
  }),

  'blueprint/bulletin/create': createBlueprintBulletinCreateTemplate({
    provider: 'cbk',
    icon: '@logo/chatbotkit.com',
    name: 'Post Current Blueprint Bulletin',
    description: 'Post a message to the current blueprint shared board',
    tags: ['blueprint', 'bulletin', 'create', 'beta'],
    commentary:
      'This ability posts a message to the current blueprint\'s shared bulletin board, where it can be read by other agents in the same blueprint. You can optionally set a time-to-live (in seconds) after which the bulletin expires. The board retains a limited number of the most recent bulletins.',
    instruction: {
      text: field({
        name: 'text',
        description: 'the message to post to the shared bulletin board',
      }),
      ttl: field({
        name: 'ttl',
        description:
          'optional time-to-live before the bulletin expires - a number of seconds or a duration like "1 hour", "30 minutes" or "2d"',
        type: 'string',
        optional: true,
        placeholder: true,
      }),
    },
  }),

  'blueprint/meta/fetch': createBlueprintMetaFetchTemplate({
    provider: 'cbk',
    icon: '@logo/chatbotkit.com',
    name: 'Fetch Current Blueprint Meta',
    description: 'Retrieve the meta information of the current blueprint',
    tags: ['blueprint', 'meta', 'fetch', 'beta'],
    commentary:
      'This ability retrieves the full meta object stored on the current blueprint. You can optionally narrow the result using a JSONPath expression (e.g. $.notes) or a JMESPath expression (e.g. notes.nodeId). Only one filter may be applied at a time; if both are provided, JSONPath takes precedence.',
    instruction: {
      jsonpath: field({
        name: 'jsonpath',
        description: 'optional JSONPath expression to filter the meta object (e.g. $.notes)',
        optional: true,
        placeholder: true,
      }),
      jmespath: field({
        name: 'jmespath',
        description: 'optional JMESPath expression to filter the meta object (e.g. notes.nodeId)',
        optional: true,
        placeholder: true,
      }),
    },
  }),
}

export default abilities
