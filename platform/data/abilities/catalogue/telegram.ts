import { createFetchTemplate, field, secret } from '@/lib/ability.template'

const abilities = {
  'telegram/message/send': createFetchTemplate({
    provider: 'telegram',
    icon: '@logo/telegram.org',
    name: 'Send Telegram Message',
    description: 'Send a message to a specific chat in Telegram',
    tags: ['telegram', 'message', 'send'],
    secret: '@telegram',
    instruction: {
      method: 'POST',
      url: 'https://api.telegram.org',
      path: ['/bot', secret(), '/sendMessage'],
      headers: {
        'Content-Type': 'application/json',
      },
      body: {
        chat_id: field({
          name: 'chat_id',
          description: 'the chat ID',
        }),
        text: field({
          name: 'message',
          description: 'the message content',
        }),
        parse_mode: field({
          name: 'parse_mode',
          type: 'string',
          description:
            'mode for parsing entities (Markdown, MarkdownV2, or HTML)',
          optional: true,
        }),
        disable_notification: field({
          name: 'disable_notification',
          type: 'boolean',
          description: 'send the message silently',
          optional: true,
          default: false,
          placeholder: true,
        }),
        reply_to_message_id: field({
          name: 'reply_to_message_id',
          type: 'number',
          description: 'message ID to reply to',
          optional: true,
          placeholder: true,
        }),
      },
    },
  }),

  'telegram/message/update': createFetchTemplate({
    provider: 'telegram',
    icon: '@logo/telegram.org',
    name: 'Edit Telegram Message',
    description: 'Edit text of an existing message in Telegram',
    tags: ['telegram', 'message', 'update'],
    secret: '@telegram',
    instruction: {
      method: 'POST',
      url: 'https://api.telegram.org',
      path: ['/bot', secret(), '/editMessageText'],
      headers: {
        'Content-Type': 'application/json',
      },
      body: {
        chat_id: field({
          name: 'chat_id',
          description: 'the chat ID',
          placeholder: true,
        }),
        message_id: field({
          name: 'message_id',
          type: 'number',
          description: 'the message ID to edit',
          placeholder: true,
        }),
        text: field({
          name: 'message',
          description: 'the new message content',
        }),
        parse_mode: field({
          name: 'parse_mode',
          type: 'string',
          description:
            'mode for parsing entities (Markdown, MarkdownV2, or HTML)',
          optional: true,
        }),
      },
    },
  }),

  'telegram/message/delete': createFetchTemplate({
    provider: 'telegram',
    icon: '@logo/telegram.org',
    name: 'Delete Telegram Message',
    description: 'Delete a message from a chat in Telegram',
    tags: ['telegram', 'message', 'delete'],
    secret: '@telegram',
    instruction: {
      method: 'POST',
      url: 'https://api.telegram.org',
      path: ['/bot', secret(), '/deleteMessage'],
      headers: {
        'Content-Type': 'application/json',
      },
      body: {
        chat_id: field({
          name: 'chat_id',
          description: 'the chat ID',
          placeholder: true,
        }),
        message_id: field({
          name: 'message_id',
          type: 'number',
          description: 'the message ID to delete',
          placeholder: true,
        }),
      },
    },
  }),

  'telegram/message/forward': createFetchTemplate({
    provider: 'telegram',
    icon: '@logo/telegram.org',
    name: 'Forward Telegram Message',
    description: 'Forward a message from one chat to another in Telegram',
    tags: ['telegram', 'message', 'forward'],
    secret: '@telegram',
    instruction: {
      method: 'POST',
      url: 'https://api.telegram.org',
      path: ['/bot', secret(), '/forwardMessage'],
      headers: {
        'Content-Type': 'application/json',
      },
      body: {
        chat_id: field({
          name: 'chat_id',
          description: 'the destination chat ID',
          placeholder: true,
        }),
        from_chat_id: field({
          name: 'from_chat_id',
          description: 'the source chat ID',
          placeholder: true,
        }),
        message_id: field({
          name: 'message_id',
          type: 'number',
          description: 'the message ID to forward',
          placeholder: true,
        }),
        disable_notification: field({
          name: 'disable_notification',
          type: 'boolean',
          description: 'send the message silently',
          optional: true,
          default: false,
          placeholder: true,
        }),
      },
    },
  }),

  'telegram/message/pin': createFetchTemplate({
    provider: 'telegram',
    icon: '@logo/telegram.org',
    name: 'Pin Telegram Message',
    description: 'Pin a message in a chat in Telegram',
    tags: ['telegram', 'message', 'pin'],
    secret: '@telegram',
    instruction: {
      method: 'POST',
      url: 'https://api.telegram.org',
      path: ['/bot', secret(), '/pinChatMessage'],
      headers: {
        'Content-Type': 'application/json',
      },
      body: {
        chat_id: field({
          name: 'chat_id',
          description: 'the chat ID',
          placeholder: true,
        }),
        message_id: field({
          name: 'message_id',
          type: 'number',
          description: 'the message ID to pin',
          placeholder: true,
        }),
        disable_notification: field({
          name: 'disable_notification',
          type: 'boolean',
          description: 'pin the message silently',
          optional: true,
          default: false,
          placeholder: true,
        }),
      },
    },
  }),

  'telegram/message/unpin': createFetchTemplate({
    provider: 'telegram',
    icon: '@logo/telegram.org',
    name: 'Unpin Telegram Message',
    description: 'Unpin a message in a chat in Telegram',
    tags: ['telegram', 'message', 'unpin'],
    secret: '@telegram',
    instruction: {
      method: 'POST',
      url: 'https://api.telegram.org',
      path: ['/bot', secret(), '/unpinChatMessage'],
      headers: {
        'Content-Type': 'application/json',
      },
      body: {
        chat_id: field({
          name: 'chat_id',
          description: 'the chat ID',
          placeholder: true,
        }),
        message_id: field({
          name: 'message_id',
          type: 'number',
          description: 'the message ID to unpin',
          optional: true,
          placeholder: true,
        }),
      },
    },
  }),

  'telegram/photo/send': createFetchTemplate({
    provider: 'telegram',
    icon: '@logo/telegram.org',
    name: 'Send Telegram Photo',
    description: 'Send a photo to a chat in Telegram',
    tags: ['telegram', 'photo', 'send'],
    secret: '@telegram',
    instruction: {
      method: 'POST',
      url: 'https://api.telegram.org',
      path: ['/bot', secret(), '/sendPhoto'],
      headers: {
        'Content-Type': 'application/json',
      },
      body: {
        chat_id: field({
          name: 'chat_id',
          description: 'the chat ID',
        }),
        photo: field({
          name: 'photo',
          description: 'photo URL or file_id',
        }),
        caption: field({
          name: 'caption',
          description: 'photo caption',
          optional: true,
        }),
        parse_mode: field({
          name: 'parse_mode',
          type: 'string',
          description:
            'mode for parsing entities (Markdown, MarkdownV2, or HTML)',
          optional: true,
        }),
        disable_notification: field({
          name: 'disable_notification',
          type: 'boolean',
          description: 'send the message silently',
          optional: true,
          default: false,
          placeholder: true,
        }),
        reply_to_message_id: field({
          name: 'reply_to_message_id',
          type: 'number',
          description: 'message ID to reply to',
          optional: true,
          placeholder: true,
        }),
      },
    },
  }),

  'telegram/api/call': createFetchTemplate({
    provider: 'telegram',
    icon: '@logo/telegram.org',
    name: 'Call Telegram API',
    description:
      'Make a generic API call to Telegram. This is a flexible template that can be used to call any Telegram API endpoint by specifying the method, URL, and request body.',
    tags: ['telegram', 'api', 'call', 'generic'],
    secret: '@telegram',
    instruction: {
      method: field({
        name: 'method',
        description: 'HTTP method (GET, POST, PUT, DELETE, etc.)',
      }),
      url: field({
        name: 'url',
        description: 'The full URL of the Telegram API endpoint to call',
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
