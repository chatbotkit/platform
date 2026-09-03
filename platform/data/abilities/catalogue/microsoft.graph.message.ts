import { createFetchTemplate, field, secret } from '@/lib/ability.template'

/**
 * Catalogue of Microsoft Graph Mail/Message abilities.
 *
 * @see https://learn.microsoft.com/en-us/graph/api/resources/mail-api-overview
 */
const abilities = {
  'microsoft/graph/message/search': createFetchTemplate({
    provider: 'microsoft',
    icon: '@logo/microsoft.com',
    name: 'Search Messages',
    description: "Find messages in a user's mailbox that match a search query",
    tags: ['microsoft', 'outlook', 'messages'],
    secret: '@platform/microsoft/365',
    instruction: {
      method: 'GET',
      url: 'https://graph.microsoft.com/v1.0/me/messages',
      headers: {
        Authorization: secret(),
        'Content-Type': 'application/json',
      },
      query: {
        $search: field({
          name: 'search',
          description: 'string to search in messages',
        }),
        $select: field({
          name: 'select',
          description: 'fields to select, e.g., subject, from, bodyPreview',
          optional: true,
        }),
        $top: field({
          name: 'top',
          type: 'number',
          description: 'number of messages to return',
          placeholder: true,
          default: 10,
          optional: true,
        }),
        $skip: field({
          name: 'skip',
          type: 'number',
          description: 'number of messages to skip for pagination',
          optional: true,
        }),
      },
      options: {
        jmespath: `value[*].{
  id: id,
  subject: subject,
  from: from.emailAddress.address,
  bodyPreview: bodyPreview,
  receivedDateTime: receivedDateTime
}`,
      },
    },
  }),

  'microsoft/graph/message/list': createFetchTemplate({
    provider: 'microsoft',
    icon: '@logo/microsoft.com',
    name: 'List Messages',
    description: "Retrieve a list of recent messages from a user's mailbox",
    tags: ['microsoft', 'outlook', 'messages'],
    secret: '@platform/microsoft/365',
    instruction: {
      method: 'GET',
      url: 'https://graph.microsoft.com/v1.0/me/messages',
      headers: {
        Authorization: secret(),
        'Content-Type': 'application/json',
      },
      query: {
        $select: field({
          name: 'select',
          description: 'fields to select, e.g., subject, from, bodyPreview',
          optional: true,
        }),
        $top: field({
          name: 'top',
          type: 'number',
          description: 'number of messages to return',
          placeholder: true,
          default: 10,
          optional: true,
        }),
        $skip: field({
          name: 'skip',
          type: 'number',
          description: 'number of messages to skip for pagination',
          optional: true,
        }),
      },
      options: {
        jmespath: `value[*].{
  id: id,
  subject: subject,
  from: from.emailAddress.address,
  bodyPreview: bodyPreview,
  receivedDateTime: receivedDateTime
}`,
      },
    },
  }),

  'microsoft/graph/message/fetch': createFetchTemplate({
    provider: 'microsoft',
    icon: '@logo/microsoft.com',
    name: 'Fetch Message',
    description: 'Get the details of a specific message by its ID',
    tags: ['microsoft', 'outlook', 'messages'],
    secret: '@platform/microsoft/365',
    instruction: {
      method: 'GET',
      url: 'https://graph.microsoft.com/v1.0/me/messages',
      path: [
        '/',
        field({
          name: 'messageId',
          description: 'the message ID',
        }),
      ],
      headers: {
        Authorization: secret(),
        'Content-Type': 'application/json',
        Prefer: 'outlook.body-content-type="text"',
      },
      options: {
        jmespath: `{
  id: id,
  subject: subject,
  from: from.emailAddress.address,
  bodyPreview: bodyPreview,
  receivedDateTime: receivedDateTime,
  bodyContent: body.content
}`,
      },
    },
  }),

  'microsoft/graph/message/create': createFetchTemplate({
    provider: 'microsoft',
    icon: '@logo/microsoft.com',
    name: 'Create Message',
    description: "Compose and save a new message in a user's mailbox",
    tags: ['microsoft', 'outlook', 'messages'],
    secret: '@platform/microsoft/365',
    instruction: {
      method: 'POST',
      url: 'https://graph.microsoft.com/v1.0/me/messages',
      headers: {
        Authorization: secret(),
        'Content-Type': 'application/json',
      },
      body: {
        subject: field({
          name: 'subject',
          description: 'subject of the message',
        }),
        body: {
          contentType: 'Text',
          content: field({
            name: 'content',
            description: 'body content of the message',
          }),
        },
        toRecipients: [
          {
            emailAddress: {
              address: field({
                name: 'recipientEmail',
                description: 'email address of the recipient',
              }),
            },
          },
        ],
      },
      options: {
        jmespath: `{
  id: id,
  subject: subject,
  from: from.emailAddress.address,
  bodyPreview: bodyPreview,
  receivedDateTime: receivedDateTime
}`,
      },
    },
  }),
}

export default abilities
