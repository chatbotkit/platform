import { createAuxiliaryTemplate, field } from '@/lib/ability.template'

import type {
  JOIN_MEETING_HANDLER_NAME,
  JoinMeetingSchema,
  RECALL_MEETING_API_PATH,
} from '@/pages/api/auxiliary/skillset/ability/chatbotkit/integration/recall'

const RECALL_API_PATH =
  '/api/auxiliary/skillset/ability/chatbotkit/integration/recall' satisfies typeof RECALL_MEETING_API_PATH

const abilities = {
  'recall/meeting/join[by-id]': createAuxiliaryTemplate<JoinMeetingSchema>({
    provider: 'recall',
    icon: '@logo/recall.ai',
    name: 'Join Recall Meeting',
    description:
      'Joins a meeting URL through a Recall integration and starts the meeting bot with the provided instruction.',
    tags: ['recall', 'meeting', 'video', 'integration'],
    path: RECALL_API_PATH,
    handler: 'joinMeeting' satisfies typeof JOIN_MEETING_HANDLER_NAME,
    instruction: {
      recallIntegrationId: field({
        name: 'recallIntegrationId',
        description: 'The ID of the Recall integration to use',
        placeholder: true,
      }),
      meetingUrl: field({
        name: 'meetingUrl',
        description: 'The meeting URL to join',
        placeholder: true,
      }),
      text: field({
        name: 'text',
        description: 'The initial instruction to use when joining the meeting',
        placeholder: true,
      }),
      botName: field({
        name: 'botName',
        description: 'Optional display name for the Recall bot',
        placeholder: true,
        optional: true,
      }),
      joinAt: field({
        name: 'joinAt',
        description:
          'Optional ISO 8601 date-time for joining a future meeting. Use this for future meetings only, not meetings to join now.',
        placeholder: true,
        optional: true,
      }),
    },
    options: {
      auth: 'internal',
    },
  }),
}

export default abilities
