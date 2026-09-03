import { createAuxiliaryTemplate, field } from '@/lib/ability.template'

import type {
  AVATAR_INTEGRATION_API_PATH,
  GET_AVATAR_URL_HANDLER_NAME,
  GetAvatarUrlSchema,
} from '@/pages/api/auxiliary/skillset/ability/chatbotkit/integration/avatar'

const AVATAR_API_PATH =
  '/api/auxiliary/skillset/ability/chatbotkit/integration/avatar' satisfies typeof AVATAR_INTEGRATION_API_PATH

const abilities = {
  'avatar/url[integration-by-id]': createAuxiliaryTemplate<GetAvatarUrlSchema>({
    provider: 'cbk',
    icon: '@logo/chatbotkit.com',
    name: 'Get Avatar Integration URL',
    description:
      'Returns the hosted ChatBotKit avatar frame URL for the selected Avatar integration.',
    tags: ['avatar', 'video', 'integration'],
    path: AVATAR_API_PATH,
    handler: 'getAvatarUrl' satisfies typeof GET_AVATAR_URL_HANDLER_NAME,
    instruction: {
      avatarIntegrationId: field({
        name: 'avatarIntegrationId',
        description: 'The ID of the Avatar integration to use',
        placeholder: true,
      }),
    },
    options: {
      auth: 'internal',
    },
  }),
}

export default abilities
