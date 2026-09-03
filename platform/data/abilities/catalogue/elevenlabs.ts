import {
  createFetchTemplate,
  field,
  object,
  secret,
} from '@/lib/ability.template'

const abilities = {
  'elevenlabs/agent/list': createFetchTemplate({
    provider: 'elevenlabs',
    icon: '@logo/elevenlabs.io',
    name: 'List Agents',
    description:
      'List ElevenLabs conversational AI agents with optional search, ownership, sorting, and pagination filters.',
    tags: ['elevenlabs', 'agent', 'list', 'convai'],
    secret: '@elevenlabs',
    instruction: {
      method: 'GET',
      url: 'https://api.elevenlabs.io',
      path: ['/v1/convai/agents'],
      query: {
        page_size: field({
          name: 'pageSize',
          type: 'number',
          description: 'maximum number of agents to return per page (1-100)',
          optional: true,
          default: 30,
        }),
        search: field({
          name: 'search',
          description: 'search by agent name',
          optional: true,
        }),
        archived: field({
          name: 'archived',
          type: 'boolean',
          description: 'filter agents by archived status',
          optional: true,
          default: false,
        }),
        show_only_owned_agents: field({
          name: 'showOnlyOwnedAgents',
          type: 'boolean',
          description:
            'deprecated ElevenLabs filter to return only agents owned by the authenticated user',
          optional: true,
          default: false,
        }),
        created_by_user_id: field({
          name: 'createdByUserId',
          description:
            "creator user ID filter. Use '@me' for the authenticated user",
          optional: true,
        }),
        sort_direction: field({
          name: 'sortDirection',
          description: 'the direction to sort the results',
          enum: ['asc', 'desc'],
          optional: true,
        }),
        sort_by: field({
          name: 'sortBy',
          description: 'the field to sort the results by',
          enum: ['name', 'created_at', 'call_count_7d'],
          optional: true,
        }),
        cursor: field({
          name: 'cursor',
          description: 'pagination cursor returned from a previous response',
          optional: true,
        }),
      },
      headers: {
        'xi-api-key': secret(),
      },
    },
  }),

  'elevenlabs/sip-trunk-call/start': createFetchTemplate({
    provider: 'elevenlabs',
    icon: '@logo/elevenlabs.io',
    name: 'Start SIP Trunk Outbound Call',
    description:
      'Start an outbound ElevenLabs phone call using a SIP trunk phone number assigned to an agent.',
    tags: ['elevenlabs', 'sip-trunk', 'call', 'start', 'convai'],
    secret: '@elevenlabs',
    instruction: {
      method: 'POST',
      url: 'https://api.elevenlabs.io',
      path: ['/v1/convai/sip-trunk/outbound-call'],
      headers: {
        'xi-api-key': secret(),
        'Content-Type': 'application/json',
      },
      body: {
        agent_id: field({
          name: 'agentId',
          description: 'the ElevenLabs agent ID that should handle the call',
          placeholder: true,
        }),
        agent_phone_number_id: field({
          name: 'agentPhoneNumberId',
          description:
            'the SIP trunk phone number ID assigned to the agent for outbound calling',
          placeholder: true,
        }),
        to_number: field({
          name: 'toNumber',
          description:
            'the destination phone number to dial, typically in E.164 format',
          placeholder: true,
        }),
        conversation_initiation_client_data: object({
          name: 'conversationInitiationClientData',
          description:
            'optional client data used when initiating the conversation, including user, environment, and dynamic variables',
          optional: true,
          shape: {
            user_id: field({
              name: 'userId',
              description:
                'an optional end-user identifier for the initiated conversation',
              optional: true,
            }),
            environment: field({
              name: 'environment',
              description:
                'the environment to use for resolving environment variables such as production or staging',
              optional: true,
            }),
            dynamic_variables: field({
              name: 'dynamicVariables',
              description:
                'optional dynamic variables object encoded as JSON text',
              optional: true,
            }),
          },
        }),
        telephony_call_config: object({
          name: 'telephonyCallConfig',
          description: 'optional telephony settings for the outbound call',
          optional: true,
          shape: {
            ringing_timeout_secs: field({
              name: 'ringingTimeoutSecs',
              type: 'number',
              description:
                'how long to ring the recipient before giving up, in seconds',
              optional: true,
              default: 60,
            }),
          },
        }),
      },
    },
  }),

  'elevenlabs/api/call': createFetchTemplate({
    provider: 'elevenlabs',
    icon: '@logo/elevenlabs.io',
    name: 'Call ElevenLabs API',
    description:
      'Make a generic API call to ElevenLabs. This is a flexible template that can be used to call any ElevenLabs API endpoint by specifying the method, URL, and request body.',
    tags: ['elevenlabs', 'api', 'call', 'generic', 'convai'],
    secret: '@elevenlabs',
    instruction: {
      method: field({
        name: 'method',
        description: 'HTTP method (GET, POST, PUT, DELETE, etc.)',
      }),
      url: field({
        name: 'url',
        description: 'The full URL of the ElevenLabs API endpoint to call',
      }),
      headers: {
        'xi-api-key': secret(),
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
