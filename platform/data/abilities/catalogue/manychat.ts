import { createFetchTemplate, field, secret } from '@/lib/ability.template'

const abilities = {
  'manychat/page/info': createFetchTemplate({
    provider: 'manychat',
    icon: '@logo/manychat.com',
    name: 'Get ManyChat Page Info',
    description: 'Get information about the connected Facebook page/bot',
    tags: ['manychat', 'page', 'info'],
    secret: '@manychat',
    instruction: {
      method: 'GET',
      url: 'https://api.manychat.com/fb/page/getInfo',
      headers: {
        Authorization: secret(),
        'Content-Type': 'application/json',
      },
    },
  }),

  'manychat/tag/list': createFetchTemplate({
    provider: 'manychat',
    icon: '@logo/manychat.com',
    name: 'List ManyChat Tags',
    description: 'Get all tags available for your ManyChat page',
    tags: ['manychat', 'tag', 'list'],
    secret: '@manychat',
    instruction: {
      method: 'GET',
      url: 'https://api.manychat.com/fb/page/getTags',
      headers: {
        Authorization: secret(),
        'Content-Type': 'application/json',
      },
    },
  }),

  'manychat/tag/create': createFetchTemplate({
    provider: 'manychat',
    icon: '@logo/manychat.com',
    name: 'Create ManyChat Tag',
    description: 'Create a new tag on your ManyChat page',
    tags: ['manychat', 'tag', 'create'],
    secret: '@manychat',
    instruction: {
      method: 'POST',
      url: 'https://api.manychat.com/fb/page/createTag',
      headers: {
        Authorization: secret(),
        'Content-Type': 'application/json',
      },
      body: {
        name: field({
          name: 'name',
          description: 'the name of the tag to create',
        }),
      },
    },
  }),

  'manychat/tag/remove': createFetchTemplate({
    provider: 'manychat',
    icon: '@logo/manychat.com',
    name: 'Remove ManyChat Tag',
    description: 'Remove a tag from your ManyChat page by tag ID',
    tags: ['manychat', 'tag', 'remove'],
    secret: '@manychat',
    instruction: {
      method: 'POST',
      url: 'https://api.manychat.com/fb/page/removeTag',
      headers: {
        Authorization: secret(),
        'Content-Type': 'application/json',
      },
      body: {
        tag_id: field({
          name: 'tag_id',
          type: 'number',
          description: 'the ID of the tag to remove',
          placeholder: true,
        }),
      },
    },
  }),

  'manychat/subscriber/fetch': createFetchTemplate({
    provider: 'manychat',
    icon: '@logo/manychat.com',
    name: 'Get ManyChat Subscriber Info',
    description:
      'Get full information about a specific subscriber by subscriber ID',
    tags: ['manychat', 'subscriber', 'fetch'],
    secret: '@manychat',
    instruction: {
      method: 'GET',
      url: 'https://api.manychat.com/fb/subscriber/getInfo',
      headers: {
        Authorization: secret(),
        'Content-Type': 'application/json',
      },
      query: {
        subscriber_id: field({
          name: 'subscriber_id',
          description: 'the subscriber ID to get information about',
          placeholder: true,
        }),
      },
    },
  }),

  'manychat/subscriber/search[by-name]': createFetchTemplate({
    provider: 'manychat',
    icon: '@logo/manychat.com',
    name: 'Find ManyChat Subscriber by Name',
    description: 'Search for subscribers by their name',
    tags: ['manychat', 'subscriber', 'search'],
    secret: '@manychat',
    instruction: {
      method: 'GET',
      url: 'https://api.manychat.com/fb/subscriber/findByName',
      headers: {
        Authorization: secret(),
        'Content-Type': 'application/json',
      },
      query: {
        name: field({
          name: 'name',
          description: 'the name to search for',
        }),
      },
    },
  }),

  'manychat/subscriber/tag/add': createFetchTemplate({
    provider: 'manychat',
    icon: '@logo/manychat.com',
    name: 'Add Tag to ManyChat Subscriber',
    description: 'Add a tag to a subscriber by tag ID',
    tags: ['manychat', 'subscriber', 'tag', 'add'],
    secret: '@manychat',
    instruction: {
      method: 'POST',
      url: 'https://api.manychat.com/fb/subscriber/addTag',
      headers: {
        Authorization: secret(),
        'Content-Type': 'application/json',
      },
      body: {
        subscriber_id: field({
          name: 'subscriber_id',
          description: 'the subscriber ID to add the tag to',
          placeholder: true,
        }),
        tag_id: field({
          name: 'tag_id',
          type: 'number',
          description: 'the ID of the tag to add',
          placeholder: true,
        }),
      },
    },
  }),

  'manychat/subscriber/tag/add[by-name]': createFetchTemplate({
    provider: 'manychat',
    icon: '@logo/manychat.com',
    name: 'Add Tag to ManyChat Subscriber by Name',
    description: 'Add a tag to a subscriber by tag name',
    tags: ['manychat', 'subscriber', 'tag', 'add'],
    secret: '@manychat',
    instruction: {
      method: 'POST',
      url: 'https://api.manychat.com/fb/subscriber/addTagByName',
      headers: {
        Authorization: secret(),
        'Content-Type': 'application/json',
      },
      body: {
        subscriber_id: field({
          name: 'subscriber_id',
          description: 'the subscriber ID to add the tag to',
          placeholder: true,
        }),
        tag_name: field({
          name: 'tag_name',
          description: 'the name of the tag to add',
        }),
      },
    },
  }),

  'manychat/subscriber/tag/remove': createFetchTemplate({
    provider: 'manychat',
    icon: '@logo/manychat.com',
    name: 'Remove Tag from ManyChat Subscriber',
    description: 'Remove a tag from a subscriber by tag ID',
    tags: ['manychat', 'subscriber', 'tag', 'remove'],
    secret: '@manychat',
    instruction: {
      method: 'POST',
      url: 'https://api.manychat.com/fb/subscriber/removeTag',
      headers: {
        Authorization: secret(),
        'Content-Type': 'application/json',
      },
      body: {
        subscriber_id: field({
          name: 'subscriber_id',
          description: 'the subscriber ID to remove the tag from',
          placeholder: true,
        }),
        tag_id: field({
          name: 'tag_id',
          type: 'number',
          description: 'the ID of the tag to remove',
          placeholder: true,
        }),
      },
    },
  }),

  'manychat/subscriber/tag/remove[by-name]': createFetchTemplate({
    provider: 'manychat',
    icon: '@logo/manychat.com',
    name: 'Remove Tag from ManyChat Subscriber by Name',
    description: 'Remove a tag from a subscriber by tag name',
    tags: ['manychat', 'subscriber', 'tag', 'remove'],
    secret: '@manychat',
    instruction: {
      method: 'POST',
      url: 'https://api.manychat.com/fb/subscriber/removeTagByName',
      headers: {
        Authorization: secret(),
        'Content-Type': 'application/json',
      },
      body: {
        subscriber_id: field({
          name: 'subscriber_id',
          description: 'the subscriber ID to remove the tag from',
          placeholder: true,
        }),
        tag_name: field({
          name: 'tag_name',
          description: 'the name of the tag to remove',
        }),
      },
    },
  }),

  'manychat/content/send': createFetchTemplate({
    provider: 'manychat',
    icon: '@logo/manychat.com',
    name: 'Send Content to ManyChat Subscriber',
    description:
      'Send content (text, images, etc.) to a subscriber using dynamic message format',
    tags: ['manychat', 'content', 'send', 'message'],
    secret: '@manychat',
    instruction: {
      method: 'POST',
      url: 'https://api.manychat.com/fb/sending/sendContent',
      headers: {
        Authorization: secret(),
        'Content-Type': 'application/json',
      },
      body: {
        subscriber_id: field({
          name: 'subscriber_id',
          description: 'the subscriber ID to send content to',
          placeholder: true,
        }),
        data: {
          version: 'v2',
          content: {
            messages: [
              {
                type: 'text',
                text: field({
                  name: 'message',
                  description: 'the text message to send',
                }),
              },
            ],
          },
        },
        message_tag: field({
          name: 'message_tag',
          description:
            'required for sending messages outside 24h window. Use CONFIRMED_EVENT_UPDATE for event reminders, POST_PURCHASE_UPDATE for order updates, or ACCOUNT_UPDATE for account changes',
          optional: true,
        }),
      },
    },
  }),

  'manychat/flow/send': createFetchTemplate({
    provider: 'manychat',
    icon: '@logo/manychat.com',
    name: 'Send Flow to ManyChat Subscriber',
    description: 'Trigger a specific flow for a subscriber by flow namespace',
    tags: ['manychat', 'flow', 'send'],
    secret: '@manychat',
    instruction: {
      method: 'POST',
      url: 'https://api.manychat.com/fb/sending/sendFlow',
      headers: {
        Authorization: secret(),
        'Content-Type': 'application/json',
      },
      body: {
        subscriber_id: field({
          name: 'subscriber_id',
          description: 'the subscriber ID to send the flow to',
          placeholder: true,
        }),
        flow_ns: field({
          name: 'flow_ns',
          description: 'the flow namespace/ID to trigger',
          placeholder: true,
        }),
      },
    },
  }),

  'manychat/field/set': createFetchTemplate({
    provider: 'manychat',
    icon: '@logo/manychat.com',
    name: 'Set ManyChat Subscriber Custom Field',
    description: 'Set a custom field value for a subscriber',
    tags: ['manychat', 'subscriber', 'field', 'set'],
    secret: '@manychat',
    instruction: {
      method: 'POST',
      url: 'https://api.manychat.com/fb/subscriber/setCustomField',
      headers: {
        Authorization: secret(),
        'Content-Type': 'application/json',
      },
      body: {
        subscriber_id: field({
          name: 'subscriber_id',
          description: 'the subscriber ID to set the custom field for',
          placeholder: true,
        }),
        field_id: field({
          name: 'field_id',
          type: 'number',
          description: 'the custom field ID',
          placeholder: true,
        }),
        field_value: field({
          name: 'field_value',
          description: 'the value to set for the custom field',
        }),
      },
    },
  }),

  'manychat/field/set[by-name]': createFetchTemplate({
    provider: 'manychat',
    icon: '@logo/manychat.com',
    name: 'Set ManyChat Subscriber Custom Field by Name',
    description: 'Set a custom field value for a subscriber by field name',
    tags: ['manychat', 'subscriber', 'field', 'set'],
    secret: '@manychat',
    instruction: {
      method: 'POST',
      url: 'https://api.manychat.com/fb/subscriber/setCustomFieldByName',
      headers: {
        Authorization: secret(),
        'Content-Type': 'application/json',
      },
      body: {
        subscriber_id: field({
          name: 'subscriber_id',
          description: 'the subscriber ID to set the custom field for',
          placeholder: true,
        }),
        field_name: field({
          name: 'field_name',
          description: 'the custom field name',
        }),
        field_value: field({
          name: 'field_value',
          description: 'the value to set for the custom field',
        }),
      },
    },
  }),

  'manychat/field/list': createFetchTemplate({
    provider: 'manychat',
    icon: '@logo/manychat.com',
    name: 'List ManyChat Custom Fields',
    description: 'Get all custom fields available for your ManyChat page',
    tags: ['manychat', 'field', 'list'],
    secret: '@manychat',
    instruction: {
      method: 'GET',
      url: 'https://api.manychat.com/fb/page/getCustomFields',
      headers: {
        Authorization: secret(),
        'Content-Type': 'application/json',
      },
    },
  }),

  'manychat/bot-field/list': createFetchTemplate({
    provider: 'manychat',
    icon: '@logo/manychat.com',
    name: 'List ManyChat Bot Fields',
    description: 'Get all bot fields (global variables) for your ManyChat page',
    tags: ['manychat', 'bot-field', 'list'],
    secret: '@manychat',
    instruction: {
      method: 'GET',
      url: 'https://api.manychat.com/fb/page/getBotFields',
      headers: {
        Authorization: secret(),
        'Content-Type': 'application/json',
      },
    },
  }),

  'manychat/bot-field/set': createFetchTemplate({
    provider: 'manychat',
    icon: '@logo/manychat.com',
    name: 'Set ManyChat Bot Field',
    description: 'Set a bot field (global variable) value',
    tags: ['manychat', 'bot-field', 'set'],
    secret: '@manychat',
    instruction: {
      method: 'POST',
      url: 'https://api.manychat.com/fb/page/setBotField',
      headers: {
        Authorization: secret(),
        'Content-Type': 'application/json',
      },
      body: {
        field_id: field({
          name: 'field_id',
          type: 'number',
          description: 'the bot field ID',
          placeholder: true,
        }),
        field_value: field({
          name: 'field_value',
          description: 'the value to set for the bot field',
        }),
      },
    },
  }),

  'manychat/bot-field/set[by-name]': createFetchTemplate({
    provider: 'manychat',
    icon: '@logo/manychat.com',
    name: 'Set ManyChat Bot Field by Name',
    description: 'Set a bot field (global variable) value by field name',
    tags: ['manychat', 'bot-field', 'set'],
    secret: '@manychat',
    instruction: {
      method: 'POST',
      url: 'https://api.manychat.com/fb/page/setBotFieldByName',
      headers: {
        Authorization: secret(),
        'Content-Type': 'application/json',
      },
      body: {
        field_name: field({
          name: 'field_name',
          description: 'the bot field name',
        }),
        field_value: field({
          name: 'field_value',
          description: 'the value to set for the bot field',
        }),
      },
    },
  }),

  'manychat/api/call': createFetchTemplate({
    provider: 'manychat',
    icon: '@logo/manychat.com',
    name: 'Call Manychat API',
    description:
      'Make a generic API call to Manychat. This is a flexible template that can be used to call any Manychat API endpoint by specifying the method, URL, and request body.',
    tags: ['manychat', 'api', 'call', 'generic'],
    secret: '@manychat',
    instruction: {
      method: field({
        name: 'method',
        description: 'HTTP method (GET, POST, PUT, DELETE, etc.)',
      }),
      url: field({
        name: 'url',
        description: 'The full URL of the Manychat API endpoint to call',
      }),
      headers: {
        Authorization: secret(),
        'Content-Type': 'application/json',
      },
      body: field({
        name: 'body',
        description:
          'the request body as JSON text for POST, PUT, or PATCH requests',
        optional: true,
      }),
    },
  }),
}

export default abilities
