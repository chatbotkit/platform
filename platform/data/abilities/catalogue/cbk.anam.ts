import { createAuxiliaryTemplate, field } from '@/lib/ability.template'

import type {
  ANAM_AVATAR_API_PATH,
  GET_AVATAR_URL_HANDLER_NAME,
  GetAvatarUrlSchema,
} from '@/pages/api/auxiliary/skillset/ability/chatbotkit/integration/anam'

const ANAM_API_PATH =
  '/api/auxiliary/skillset/ability/chatbotkit/integration/anam' satisfies typeof ANAM_AVATAR_API_PATH

const abilities = {
  'anam/avatar/url[by-id]': createAuxiliaryTemplate<GetAvatarUrlSchema>({
    provider: 'anam',
    icon: '@logo/anam.ai',
    name: 'Get Anam Avatar URL',
    description:
      'Returns the hosted Anam avatar frame URL for the selected integration.',
    tags: ['anam', 'avatar', 'video', 'integration'],
    path: ANAM_API_PATH,
    handler: 'getAvatarUrl' satisfies typeof GET_AVATAR_URL_HANDLER_NAME,
    instruction: {
      anamIntegrationId: field({
        name: 'anamIntegrationId',
        description: 'The ID of the Anam integration to use',
        placeholder: true,
      }),
    },
    options: {
      auth: 'internal',
    },
  }),
}

export default abilities
