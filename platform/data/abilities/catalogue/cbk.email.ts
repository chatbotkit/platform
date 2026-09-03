import { createAuxiliaryTemplate, field } from '@/lib/ability.template'

import type {
  EMAIL_CONVERSATION_API_PATH,
  START_CONVERSATION_HANDLER_NAME,
  StartConversationSchema,
} from '@/pages/api/auxiliary/skillset/ability/chatbotkit/integration/email'

// --- Path Constants ---

const EMAIL_API_PATH =
  '/api/auxiliary/skillset/ability/chatbotkit/integration/email' satisfies typeof EMAIL_CONVERSATION_API_PATH

/**
 * Catalogue of ChatBotKit Email integration abilities.
 */
const abilities = {
  'email/conversation/start[by-id]':
    createAuxiliaryTemplate<StartConversationSchema>({
      provider: 'cbk',
      icon: '@logo/chatbotkit.com',
      name: 'Start Email Conversation',
      description:
        'Initiates a new conversation by sending an email to a recipient.',
      tags: ['email', 'conversation', 'message', 'integration'],
      path: EMAIL_API_PATH,
      handler:
        'startConversation' satisfies typeof START_CONVERSATION_HANDLER_NAME,
      options: {
        auth: 'internal',
      },
      instruction: {
        emailIntegrationId: field({
          name: 'emailIntegrationId',
          description: 'The ID of the email integration to use',
          placeholder: true,
        }),
        email: field({
          name: 'email',
          description: 'The recipient email address to send to',
          placeholder: true,
        }),
        subject: field({
          name: 'subject',
          description: 'The subject line of the email',
          placeholder: true,
        }),
        text: field({
          name: 'text',
          description:
            'The opening instruction telling the agent what to say or do to start the conversation',
          placeholder: true,
        }),
        context: field({
          name: 'context',
          description:
            'Optional context about the recipient or conversation, which will be used to inform how to proceed with the conversation',
          placeholder: true,
          optional: true,
        }),
      },
    }),
}

export default abilities
