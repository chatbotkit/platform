'use server'

import { ActionName } from '@/lib/action.name'
import { stringifyAction } from '@/lib/action.parse'
import { appContactActionHandler } from '@/lib/app.action'
import type { ConfiguredBot} from '@/lib/app.config.bot';
import { getConfiguredBots } from '@/lib/app.config.bot'
import { getSessionClient } from '@/lib/cbk.sdk'
import debug from '@/lib/debug'
import { toSlug } from '@/lib/string'

import ConfigSchema from './config'
import {
  APP_NAME,
  CONTACT_NAMESPACE,
  SUBMIT_PRIORITIES_FUNCTION_NAME,
} from './const'
import prompts from './prompt.yaml'

import { stream } from '@chatbotkit/react/utils/stream'

import { z } from 'zod'

/**
 * Represents a single priority item returned by the orchestrator agent.
 */
export interface Priority {
  id: string
  title: string
  description: string
  importance: 'critical' | 'high' | 'medium' | 'low'
  source: {
    botId: string
    botName: string
  }
  createdAt: number
}

/**
 * Raw priority item from the function call arguments.
 */
export interface RawPriorityItem {
  title?: string
  description?: string
  importance?: string
  source?: string
}

/**
 * Dispatches a background job to fetch priorities using an orchestrator agent.
 *
 * @action
 */
export const gatherPriorities = appContactActionHandler(
  APP_NAME,
  CONTACT_NAMESPACE,
  ConfigSchema,
  z.object({
    channelId: z.string().min(24).optional(),
  }),
  async (
    config,
    session,
    contact,
    { channelId: _channelId }
  ): Promise<{
    channelId: string
    bots: ConfiguredBot[]
    totalMaxPriorities: number
  }> => {
    debug(`dispatching priorities job`).log('apps.30fc6ef2.dispatchPriorities')

    const MAX_AGENTS = 10

    const allBots = await getConfiguredBots(config, session)

    const bots = allBots.slice(0, MAX_AGENTS)

    const userClient = await getSessionClient(session)

    const totalMaxPriorities = config.totalMaxPriorities || 5

    const agentAbilities = bots.map(({ id, name, description }) => ({
      name: `Call Once Agent: ${name}`,
      description: `Call the "${name}" agent once to get priorities. ${
        description?.trim() ? `This agent handles: ${description.trim()}` : ''
      } Any priorities from this agent should have source set to "${name}". The agent should be called exactly once.`,
      instruction: stringifyAction({
        name: ActionName.bot,
        params: { call: '' },
        text: {
          prompt: {
            $field: {
              type: 'string',
              name: 'action',
              description: 'Ask about top priorities the user should focus on',
              required: true,
            },
          },
          botId: id,
        },
      }),
    }))

    const { channelId } = await userClient.conversation.dispatch(null, {
      channelId: _channelId,

      contactId: contact.id,

      // @ts-ignore because it is a non-standard field
      namespace: session.id,

      backstory: prompts.orchestrator,

      messages: [
        {
          type: 'user',
          text: `Please gather the top priorities from all available agents and compile them into a consolidated list.

Return up to ${totalMaxPriorities} priorities sorted by importance.

## Available Agents

${bots
  .map(
    (bot) => `### ${bot.name}
- Slug: ${toSlug(bot.name || bot.id)}
- Description: ${bot.description || 'No description available'}`
  )
  .join('\n\n')}

YOU MUST RUN ALL AGENTS IN PARALLEL TO GATHER THEIR PRIORITIES.`,
        },
      ],

      functions: [
        {
          name: SUBMIT_PRIORITIES_FUNCTION_NAME,
          description:
            'Submit the final compiled list of priorities - MUST be called at the very end after gathering all priorities from agents.',
          parameters: {
            type: 'object',
            properties: {
              priorities: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    title: {
                      type: 'string',
                      description: 'Brief title of the priority',
                    },
                    description: {
                      type: 'string',
                      description:
                        'Detailed description of why this is important and what action to take',
                    },
                    importance: {
                      type: 'string',
                      enum: ['critical', 'high', 'medium', 'low'],
                      description: 'The importance level of this priority',
                    },
                    source: {
                      type: 'string',
                      description:
                        'The exact name of the agent that identified this priority',
                    },
                  },
                  required: ['title', 'description', 'importance', 'source'],
                },
                description:
                  'The compiled list of priorities sorted by importance',
              },
            },
            required: ['priorities'],
          },
          result: {
            data: {
              status: 'ok', // @note static result since we only use this function for data extraction
            },
          },
          call: {
            end: true,
          },
        },
      ],

      extensions: {
        skillsets: [
          {
            name: 'Agent Orchestration',
            description:
              'Skills for calling sub-agents to gather priority information. Each agent has access to different integrations and can provide unique insights about user priorities.',
            abilities: agentAbilities,
          },
        ],
      },
    })

    debug(`priorities job dispatched`, { channelId }).log(
      'apps.30fc6ef2.dispatchPriorities.complete'
    )

    return { channelId, bots, totalMaxPriorities }
  }
)

/**
 * Streams events from a given channel.
 *
 * @action
 */
export const streamChannelEvents = appContactActionHandler(
  APP_NAME,
  CONTACT_NAMESPACE,
  ConfigSchema,
  z.object({
    channelId: z.string(),
    lastMessageIndex: z.number().optional(),
  }),
  async (_config, session, _contact, { channelId, lastMessageIndex }) => {
    return stream(
      (async function* () {
        const userClient = await getSessionClient(session)

        const subscription = userClient.channel.subscribe(channelId, {
          historyLength: 10_000,
        })

        let index = 0

        for await (const event of subscription.stream()) {
          if (lastMessageIndex !== undefined && index++ <= lastMessageIndex) {
            continue
          }

          yield event
        }
      })()
    )
  }
)
