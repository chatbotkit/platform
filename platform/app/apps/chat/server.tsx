'use server'

import { Fragment } from 'react'
import { prompt } from 'react-prompt-kit/src'

import { ONE_MINUTE_IN_SECONDS } from '@chatbotkit-dev/time'
import type { UnwrapPromise } from '@chatbotkit-dev/typescript-utils/promise'

import { visibleLanguageModels } from '@/config/models'

import {
  MAX_DB_STRING_BYTES_LENGTH,
  MAX_DB_TEXT_BYTES_LENGTH,
} from '@/prisma/constraints'

import { importManyByGlob } from '@/lib/ability.catalogue'
import { ActionName } from '@/lib/action.name'
import { stringifyAction } from '@/lib/action.parse'
import { appActionHandler, appContactActionHandler } from '@/lib/app.action'
import { withAppAudienceCache } from '@/lib/app.cache'
import { getConfiguredBots } from '@/lib/app.config.bot'
import { buildContact, ensureContact } from '@/lib/app.contact'
import { appMethodHandler } from '@/lib/app.method'
import { isAppAudience, isTrustedAudience } from '@/lib/audience.helpers'
import { isModelBot } from '@/lib/bot.kind'
import { getSessionGraphQLClient } from '@/lib/cbk.graphql'
import { getSessionClient } from '@/lib/cbk.sdk'
import type { Feature } from '@/lib/conversation.engine'
import { TAG_OPERATION_END } from '@/lib/conversation.tag'
import debug from '@/lib/debug'
import { errorToErrorResponse } from '@/lib/error'
import { buildTemplateInstruction } from '@/lib/instruction.template.parse'
import { runTasks } from '@/lib/job'
import { getBaseLanguageModelTokenCount } from '@/lib/model.utils'
import { nameToIcon } from '@/lib/name.icon'
import { execPrompt } from '@/lib/prompt'
import {
  NOT_AUTHORIZED_CODE,
  NOT_FOUND_CODE,
  throwConflict,
  throwNotFound,
  throwUnprocessableEntity,
} from '@/lib/response'
import type { Session } from '@/lib/session.get'
import { byteSlice, toCamelCase, toSlug } from '@/lib/string'
import { Usage } from '@/lib/usage.model'
import { stringify as stringifyYaml } from '@/lib/yaml'
import type { ZodSchemaFor } from '@/lib/zod.schema'
import { z } from '@/lib/zod.schema'
import type { InlineAbility } from '@/schemas/inlineExtensions'

import autoAgentPrompt from '@/prompts/auto_agent_v1.yaml'

import ConfigSchema from './config'
import { APP_NAME, CONTACT_NAMESPACE } from './const'
import { getFeatures, isEphemeral } from './lib'

import { streamComplete } from '@chatbotkit/react/actions/complete'
import type {
  ConversationMessageFetchResponse,
  ConversationMessageType,
} from '@chatbotkit/sdk/conversation/message/v1'
import type {
  ConversationCompleteRequest,
  ConversationFetchResponse,
} from '@chatbotkit/sdk/conversation/v1'

/**
 *
 */
type ConversationInstance = ConversationFetchResponse & {
  // add extra fields if needed
}

/**
 *
 */
type ConversationMessageInstance = ConversationMessageFetchResponse & {
  from?: string

  reasoning?: string

  actions?: { name: string; icon?: string }[]
}

/**
 * Represents a bot configuration in the chat application.
 *
 * @property default - UI flag: When true, this bot is pre-selected in the
 *                     interface. Only one bot should be marked as default. If
 *                     no bot has default: true, the system automatically sets
 *                     the first auto bot as default. The default auto bot must
 *                     not have default: true to avoid conflicts.
 *
 * @property auto - Capability flag: When true, this bot can intelligently
 *                  select or delegate to other bots based on the task. Auto
 *                  bots use special prompts to determine which actual bot to
 *                  use. If no auto bot exists, a fallback "Auto" bot is
 *                  created automatically.
 *
 * @property multi - Capability flag: When true, this bot can invoke/orchestrate
 *                   multiple other bots simultaneously. Enables "Search
 *                   Multiple Agents" ability and parallel execution across
 *                   agents. Independent from auto flag, though the default
 *                   auto bot has both auto: true and multi: true.
 */
type Bot = {
  id: string

  name: string
  description?: string

  nick: string
  icon: string | null

  default?: boolean

  auto?: boolean

  multi?: boolean

  blueprintId?: string
}

/**
 * Retrieves a list of bots.
 *
 * @action
 */
export const listBots = appActionHandler(
  APP_NAME,
  ConfigSchema,
  z.object({
    blueprintId: z.string().optional(),
  }),
  async (config, session, { blueprintId }): Promise<Bot[]> => {
    const configuredBots = await withAppAudienceCache(
      () => getConfiguredBots(config, session, { blueprintId }),
      {
        app: APP_NAME,
        category: 'bots',
        session: session,
        timeInSeconds: ONE_MINUTE_IN_SECONDS,
      }
    )

    const bots: Bot[] = configuredBots
      .filter((bot): bot is typeof bot & { name: string } => {
        return typeof bot.name === 'string' && !!bot.name.trim()
      })
      .map(
        ({
          id,

          name,
          description,

          nick: _nick,
          icon: _icon,

          default: _default,

          auto,

          multi,

          blueprintId,
        }) => {
          return {
            id: id,

            name: name,
            description: description,

            nick: _nick
              ? toCamelCase(_nick).toLowerCase()
              : toCamelCase(name || id).toLowerCase(),

            icon:
              (_icon ?? ((name) => nameToIcon(name as string))(name)) || null,

            default: _default,

            auto,

            multi,

            blueprintId,
          }
        }
      )

    // @note if there is no auto bot, then by convention set the auto flag to
    // the first bot that has the name 'Auto'

    if (!bots.some(({ auto }) => !!auto)) {
      bots.forEach((bot) => {
        if (bot.nick === 'auto') {
          bot.auto = true
        }
      })
    }

    // @note if there is no auto bot, then add a default auto bot

    if (!bots.some(({ auto }) => !!auto)) {
      bots.push({
        id: 'auto',

        name: 'Auto',
        description: 'Auto-selects the best bot for the task at hand',

        nick: 'auto',

        icon: null,

        default: undefined,

        auto: true,

        multi: true,
      })
    }

    // @note if there is no default bot, then set the first auto bot as the
    // default bot

    if (!bots.some(({ default: _default }) => !!_default)) {
      const autoBot = bots.find(({ auto }) => !!auto)

      if (autoBot) {
        autoBot.default = true
      }
    }

    // sort default on top

    bots.sort((a, b) => (b.default ? 1 : 0) - (a.default ? 1 : 0))

    return bots
  }
)

/**
 * Represents a language model configuration in the chat application.
 *
 * @property default - UI flag: When true, this model is pre-selected in the
 *                     interface. Only one model should be marked as default. If
 *                     no model has default: true, the system automatically sets
 *                     the first auto model as default.
 *
 * @property auto - Capability flag: When true, this model can intelligently
 *                  select the best underlying model for the task. If no auto
 *                  model exists, a fallback "Auto" model is created
 *                  automatically.
 */
type Model = {
  id: string

  name: string
  description?: string

  nick?: string
  icon: string | null

  default?: boolean

  auto?: boolean
}

/**
 * Retrieves a list of models.
 *
 * @action
 */
export const listModels = appActionHandler(
  APP_NAME,
  ConfigSchema,
  z.object({}),
  async (config, session, {}): Promise<Model[]> => {
    const configuredModels = await withAppAudienceCache(
      async () => {
        const selectedModels: string[] = []

        if (config.models) {
          if (Array.isArray(config.models)) {
            selectedModels.push(...config.models)
          } else {
            // @note with no explicit model list, surface every visible model
            // flagged `featured` in the model config. This keeps the default
            // set in sync with the catalogue - mark a model `featured: true` in
            // config/models.js to add it here (it also drives the model
            // pickers' ordering via getLanguageModelSortPriority).
            selectedModels.push(
              ...Object.entries(visibleLanguageModels)
                .filter(([, model]) => model.featured)
                .map(([id]) => id)
            )
          }
        }

        return selectedModels
          .filter((modelId) => !!visibleLanguageModels[modelId])
          .map((modelId) => ({
            id: modelId,
            name: modelId,
            description: visibleLanguageModels[modelId].description,
            nick: modelId,
            icon: nameToIcon(modelId),
          }))
      },
      {
        app: APP_NAME,
        category: 'models',
        session: session,
        timeInSeconds: ONE_MINUTE_IN_SECONDS,
        // bypass: true  // @todo make this happen
      }
    )

    const models: Model[] = configuredModels
      .filter((model): model is typeof model & { name: string } => {
        return typeof model.name === 'string' && !!model.name.trim()
      })
      .map(
        ({
          id,

          name,
          description,
        }) => {
          return {
            id: id,

            name: name,
            description: description,

            nick: toCamelCase(id).toLowerCase(),

            icon: nameToIcon(id),
          }
        }
      )

    // @note if there is no auto model, then by convention set the auto flag to
    // the first model that has the name 'Auto'

    if (!models.some(({ auto }) => !!auto)) {
      models.forEach((model) => {
        if (model.nick === 'auto') {
          model.auto = true
        }
      })
    }

    // @note if there is no auto model, then add a default auto model

    if (!models.some(({ auto }) => !!auto)) {
      models.push({
        id: 'auto',

        name: 'Auto',
        description: 'Auto-selects the best model for the task at hand',

        nick: 'auto',

        icon: null,

        default: undefined,

        auto: true,
      })
    }

    // @note if there is no default model, then set the first auto model as the
    // default model

    if (!models.some(({ default: _default }) => !!_default)) {
      const autoModel = models.find(({ auto }) => !!auto)

      if (autoModel) {
        autoModel.default = true
      }
    }

    // sort default on top

    models.sort((a, b) => (b.default ? 1 : 0) - (a.default ? 1 : 0))

    return models
  }
)

/**
 *
 */
interface InternalCoreSource {
  id: string

  name: string
  description?: string

  nick?: string
  icon: string | null

  default?: boolean

  auto?: boolean
}

interface InternalAutoSource extends InternalCoreSource {
  type: 'auto'
}

interface InternalDatasetSource extends InternalCoreSource {
  type: 'dataset'
}

interface InternalSkillsetSource extends InternalCoreSource {
  type: 'skillset'

  abilities: Array<InlineAbility & { id: string }>
}

interface InternalMcpSource extends InternalCoreSource {
  type: 'mcp'
  url: string
}

interface InternalSpaceSource extends InternalCoreSource {
  type: 'space'
}

type InternalSource =
  | InternalAutoSource
  | InternalDatasetSource
  | InternalSkillsetSource
  | InternalMcpSource
  | InternalSpaceSource

/**
 * Retrieves a list of sources.
 *
 * @method
 */
const listInternalSources = appMethodHandler(
  APP_NAME,
  z.object({
    sources: z
      .union([
        z.boolean(),

        z.object({
          datasets: z.boolean().optional(),

          skillsets: z.boolean().optional(),

          spaces: z.boolean().optional(),

          mcps: z
            .union([
              z.boolean(),
              z.array(
                z.object({
                  id: z.string(),
                  icon: z.string().optional(),
                  name: z.string().optional(),
                  description: z.string().optional(),
                  url: z.string(),
                })
              ),
              z.record(
                z.string(),
                z.object({
                  name: z.string().optional(),
                  icon: z.string().optional(),
                  description: z.string().optional(),
                  url: z.string(),
                })
              ),
            ])
            .optional(),

          web: z
            .union([
              z.boolean().optional(),
              z.object({
                web: z.boolean().optional(),
                news: z.boolean().optional(),
                image: z.boolean().optional(),
                video: z.boolean().optional(),
              }),
            ])
            .optional(),

          creative: z.boolean().optional(),

          shell: z.boolean().optional(),
        }),
      ])
      .optional(),
  }),
  z.object({
    // @note when set, account-level sources (datasets, skillsets, spaces) are
    // filtered to those belonging to the blueprint - mirroring how bots are
    // scoped via configuredBots({ blueprintIds }). Used by the blueprint
    // designer / dashboard agent console.
    blueprintId: z.string().optional(),

    // @note embedded surfaces (dashboard agent console, widgets) don't need MCP
    // sources, so the client signals embedded mode to skip them
    embedded: z.boolean().optional(),
  }),
  async (
    config,
    session,
    { blueprintId, embedded }
  ): Promise<InternalSource[]> => {
    const configuredSources = await withAppAudienceCache(
      async () => {
        const sources: InternalSource[] = []

        if (config.sources) {
          const includeDatasets: boolean =
            config.sources === true || !!(config.sources.datasets ?? true)
          const includeSkillsets: boolean =
            config.sources === true || !!(config.sources.skillsets ?? true)
          const includeSpaces: boolean =
            config.sources === true || !!(config.sources.spaces ?? false)
          const includeMcps: boolean =
            !embedded &&
            (config.sources === true || !!(config.sources.mcps ?? false))
          const includeWeb: boolean =
            config.sources === true || !!(config.sources.web ?? true)
          const includeCreative: boolean =
            config.sources === true || !!(config.sources.creative ?? false)
          const includeShell: boolean =
            config.sources === true || !!(config.sources.shell ?? true)

          const userClient = await getSessionGraphQLClient(session)

          const result = await userClient.availableSources()

          if (includeDatasets && result.datasets && result.datasets.edges) {
            for (const source of result.datasets.edges) {
              if (source && source.node) {
                if (source.node.id && source.node.name) {
                  if (
                    blueprintId &&
                    source.node.blueprint?.id !== blueprintId
                  ) {
                    continue
                  }

                  sources.push({
                    type: 'dataset',

                    id: source.node.id,
                    name: source.node.name,
                    description: source.node.description || undefined,

                    nick: toSlug(source.node.name).toLowerCase(),
                    icon: nameToIcon(source.node.name),
                  })
                }
              }
            }
          }

          if (includeSkillsets && result.skillsets && result.skillsets.edges) {
            for (const source of result.skillsets.edges) {
              if (source && source.node) {
                if (source.node.id && source.node.name) {
                  if (
                    blueprintId &&
                    source.node.blueprint?.id !== blueprintId
                  ) {
                    continue
                  }

                  sources.push({
                    type: 'skillset',

                    id: source.node.id,
                    name: source.node.name,
                    description: source.node.description || undefined,

                    nick: toSlug(source.node.name).toLowerCase(),
                    icon: nameToIcon(source.node.name),

                    abilities: (source.node.abilities?.edges || [])
                      .filter((edge) => !!edge?.node)
                      .flatMap((edge) => {
                        if (
                          !edge ||
                          !edge.node ||
                          !edge.node.id ||
                          !edge.node.name ||
                          !edge.node.instruction
                        ) {
                          return []
                        }

                        return [
                          {
                            id: edge.node.id,
                            name: edge.node.name,
                            description: edge.node.description || '', // @note technically the description cannot be null
                            instruction: edge.node.instruction,
                            linkedSecretId: edge.node.linkedSecret?.id || undefined,
                          },
                        ]
                      }),
                  })
                }
              }
            }
          }

          // @note spaces are listed via the same account-level GraphQL query
          // as datasets/skillsets (rather than the contact REST API). The
          // contact-scoped `contact.space.list()` path was not authorized in
          // embedded audiences (e.g. the dashboard agent console), so spaces
          // were silently dropped there and never reached the source selector.
          // The GraphQL `availableSources` query is authorized for the same
          // session, so spaces now surface consistently across surfaces.

          if (includeSpaces && result.spaces && result.spaces.edges) {
            for (const source of result.spaces.edges) {
              if (source && source.node) {
                if (source.node.id && source.node.name) {
                  if (
                    blueprintId &&
                    source.node.blueprint?.id !== blueprintId
                  ) {
                    continue
                  }

                  sources.push({
                    type: 'space',

                    id: source.node.id,
                    name: source.node.name,
                    description: source.node.description || undefined,

                    nick: toSlug(source.node.name).toLowerCase(),
                    icon: nameToIcon(source.node.name),
                  })
                }
              }
            }
          }

          if (includeMcps) {
            let mcps: {
              id: string
              name?: string
              description?: string
              icon?: string
              url: string
            }[]

            if (
              (typeof config.sources === 'boolean' &&
                config.sources === true) ||
              config.sources.mcps === true
            ) {
              mcps = [
                {
                  id: 'notion',
                  name: 'Notion',
                  description: 'Connects to Notion knowledge bases',

                  icon: '@favicon/notion.so',

                  url: 'https://mcp.notion.com/mcp',
                },
                {
                  id: 'linear',
                  name: 'Linear',
                  description: 'Connects to Linear issue tracking systems',

                  icon: '@favicon/linear.app',

                  url: 'https://mcp.linear.app/mcp',
                },
                {
                  id: 'box',
                  name: 'Box',
                  description: 'Connects to Box cloud storage',

                  icon: '@favicon/box.com',

                  url: 'https://mcp.box.com/',
                },
                // @note disabled because we are not on their allowed list
                // @todo get canva to approve us
                // {
                //   id: 'canva',
                //   name: 'Canva',
                //   description: 'Connects to Canva design platform',

                //   icon: '@favicon/canva.com',

                //   url: 'https://mcp.canva.com/mcp',
                // },
                {
                  id: 'ahref',
                  name: 'Ahref',
                  description: 'Connects to Ahref SEO platform',

                  icon: '@favicon/ahrefs.com',

                  url: 'https://api.ahrefs.com/mcp/mcp',
                },
                {
                  id: 'figma',
                  name: 'Figma',
                  description: 'Connects to Figma design platform',

                  icon: '@favicon/figma.com',

                  url: 'https://mcp.figma.com/mcp',
                },
              ]
            } else {
              if (Array.isArray(config.sources.mcps)) {
                mcps = config.sources.mcps
              } else {
                mcps = Object.entries(config.sources.mcps || {}).map(
                  ([id, mcp]) => ({
                    id,
                    name: mcp.name,
                    description: mcp.description,
                    icon: mcp.icon,
                    url: mcp.url,
                  })
                )
              }
            }

            for (const mcp of mcps) {
              if (mcp.id && mcp.url) {
                sources.push({
                  type: 'mcp',

                  id: mcp.id,
                  name: mcp.name || mcp.id,
                  description: mcp.description || undefined,

                  nick: toSlug(mcp.name || mcp.id).toLowerCase(),
                  icon: mcp.icon || nameToIcon(mcp.name || mcp.id),

                  url: mcp.url,
                })
              }
            }
          }

          if (includeWeb) {
            const includeWebSearch =
              typeof config.sources === 'boolean' ||
              typeof config.sources.web === 'boolean'
                ? typeof config.sources === 'boolean'
                  ? config.sources
                  : config.sources.web
                : (config.sources.web?.web ?? true)

            const includeWebNews =
              typeof config.sources === 'boolean' ||
              typeof config.sources.web === 'boolean'
                ? typeof config.sources === 'boolean'
                  ? config.sources
                  : config.sources.web
                : (config.sources.web?.news ?? true)

            const includeWebImage =
              typeof config.sources === 'boolean' ||
              typeof config.sources.web === 'boolean'
                ? typeof config.sources === 'boolean'
                  ? config.sources
                  : config.sources.web
                : (config.sources.web?.image ?? true)

            const includeWebVideo =
              typeof config.sources === 'boolean' ||
              typeof config.sources.web === 'boolean'
                ? typeof config.sources === 'boolean'
                  ? config.sources
                  : config.sources.web
                : (config.sources.web?.video ?? true)

            if (includeWebSearch) {
              sources.push({
                type: 'skillset',

                id: 'tmp-web-search',

                name: 'Web Search',
                description: 'Search the web for relevant information',

                nick: 'websearch',
                icon: '@lucide/earth',

                abilities: [
                  {
                    id: 'tmp-web-search',

                    name: 'Search the Web',
                    description: 'Perform a web search to find information',

                    instruction: buildTemplateInstruction({
                      template: 'search/web',
                    }),
                  },
                ],
              })
            }

            if (includeWebNews) {
              sources.push({
                type: 'skillset',

                id: 'tmp-web-news',

                name: 'News Search',
                description: 'Stay updated with the latest news from the web',

                nick: 'webnews',
                icon: '@lucide/newspaper',

                abilities: [
                  {
                    id: 'tmp-web-news',
                    name: 'Search Web News',
                    description: 'Search the latest news articles from the web',

                    instruction: buildTemplateInstruction({
                      template: 'search/news',
                    }),
                  },
                ],
              })
            }

            if (includeWebImage) {
              sources.push({
                type: 'skillset',

                id: 'tmp-web-image',

                name: 'Image Search',
                description: 'Search the web for images',

                nick: 'webimage',
                icon: '@lucide/image',

                abilities: [
                  {
                    id: 'tmp-web-image',
                    name: 'Search the Web for Images',
                    description: 'Perform a web search to find images',

                    instruction: buildTemplateInstruction({
                      template: 'search/images',
                    }),
                  },
                ],
              })
            }

            if (includeWebVideo) {
              sources.push({
                type: 'skillset',

                id: 'tmp-web-video',

                name: 'Video Search',
                description: 'Search the web for videos',

                nick: 'webvideo',
                icon: '@lucide/video',

                abilities: [
                  {
                    id: 'tmp-web-video',
                    name: 'Search the Web for Videos',
                    description: 'Perform a web search to find videos',

                    instruction: buildTemplateInstruction({
                      template: 'search/videos',
                    }),
                  },
                ],
              })
            }
          }

          if (includeCreative) {
            sources.push({
              type: 'skillset',

              id: 'tmp-creative',

              name: 'Image Tools',
              description: 'Create and manipulate images using AI tools',

              nick: 'creative',
              icon: '@lucide/brush',

              abilities: [
                {
                  id: 'tmp-creative-create-image',
                  name: 'Create Image',
                  description: 'Generate an image from text prompts',

                  instruction: buildTemplateInstruction({
                    template: 'image/generate[gpt-image-1]',
                  }),
                },
                {
                  id: 'tmp-creative-edit-image',
                  name: 'Edit Image',
                  description: 'Edit an existing image using text prompts',

                  instruction: buildTemplateInstruction({
                    template: 'image/modify[gpt-image-1]',
                  }),
                },
              ],
            })
          }

          if (includeShell) {
            sources.push({
              type: 'skillset',

              id: 'tmp-shell',

              name: 'Shell',
              description:
                'Run bash commands and manage files in a secure sandbox',

              nick: 'shell',
              icon: '@lucide/square-terminal',

              abilities: [
                {
                  id: 'tmp-shell-exec',
                  name: 'Execute Shell Command',
                  description:
                    'Execute a bash shell command or script in the sandbox environment',

                  instruction: buildTemplateInstruction({
                    template: 'shell/exec',
                  }),
                },
                {
                  id: 'tmp-shell-rw',
                  name: 'Read/Write File',
                  description:
                    'Read or write file content in the shell sandbox environment',

                  instruction: buildTemplateInstruction({
                    template: 'shell/rw',
                  }),
                },
                {
                  id: 'tmp-shell-import',
                  name: 'Import URL to Shell',
                  description:
                    'Import data from a URL and save it to a file in the shell environment',

                  instruction: buildTemplateInstruction({
                    template: 'shell/import',
                  }),
                },
              ],
            })
          }
        }

        return sources
      },
      {
        app: APP_NAME,
        category: 'sources',
        session: session,
        timeInSeconds: ONE_MINUTE_IN_SECONDS,
      }
    )

    const sources: InternalSource[] = configuredSources

    // @note if there is no auto source, then by convention set the auto flag to
    // the first source that has the name 'Auto'

    if (!sources.some(({ auto }) => !!auto)) {
      sources.forEach((source) => {
        if (source.nick === 'auto') {
          source.auto = true
        }
      })
    }

    // @note if there is no auto source, then add a default auto source

    if (!sources.some(({ auto }) => !!auto)) {
      sources.push({
        id: 'auto',

        type: 'auto',

        name: 'Auto',
        description: 'Auto-selects the best source for the task at hand',

        nick: 'auto',

        icon: null,

        default: undefined,

        auto: true,
      })
    }

    // @note if there is no default source, then set the first auto source as
    // the default source

    if (!sources.some(({ default: _default }) => !!_default)) {
      const autoSource = sources.find(({ auto }) => !!auto)

      if (autoSource) {
        autoSource.default = true
      }
    }

    // sort default on top

    sources.sort((a, b) => (b.default ? 1 : 0) - (a.default ? 1 : 0))

    return sources
  },
  true
)

/**
 * Represents a data source configuration in the chat application.
 *
 * @property default - UI flag: When true, this source is pre-selected in the
 *                     interface. Only one source should be marked as default.
 *                     If no source has default: true, the system automatically
 *                     sets the first auto source as default.
 *
 * @property auto - Capability flag: When true, this source can intelligently
 *                  select or delegate to other sources based on the task. If no
 *                  auto source exists, a fallback "Auto" source with type
 *                  'auto' is created automatically.
 */
type Source = {
  id: string

  type: 'auto' | 'dataset' | 'skillset' | 'mcp' | 'space'

  name: string
  description?: string

  nick?: string
  icon: string | null

  default?: boolean

  auto?: boolean
}

/**
 * Represents a conversation item with optional task information.
 */
type ConversationListItem = {
  id: string

  name?: string
  description?: string

  meta?: Record<string, unknown>

  createdAt?: string | number
  updatedAt?: string | number

  task?: {
    id: string

    status?: string
    outcome?: string
  }
}

/**
 * Retrieves a list of sources.
 *
 * @action
 */
export const listSources = appActionHandler(
  APP_NAME,
  ConfigSchema,
  z.object({
    blueprintId: z.string().optional(),
    embedded: z.boolean().optional(),
  }),
  async (_config, _session, { blueprintId, embedded }): Promise<Source[]> => {
    const result = await listInternalSources({ blueprintId, embedded })

    if ('error' in result) {
      throw errorToErrorResponse(result.error)
    }

    const sources: Source[] = result.map((source) => ({
      id: source.id,

      type: source.type,

      name: source.name,
      description: source.description,

      nick: source.nick,
      icon: source.icon,

      default: source.default,

      auto: source.auto,
    }))

    return sources
  }
)

/**
 * Fetches conversations.
 *
 * @action
 */
export const listConversations = appContactActionHandler(
  APP_NAME,
  CONTACT_NAMESPACE,
  ConfigSchema,
  z.object({
    cursor: z.string().optional(),
    order: z.enum(['desc', 'asc']).optional(),
    take: z.number().optional(),
  }),
  async (
    _config,
    session,
    contact,
    { cursor, order = 'desc', take = 100 }
  ): Promise<ConversationListItem[]> => {
    const userClient = await getSessionGraphQLClient(session)

    const result = await userClient.listContactConversations({
      contactIds: [contact.id],

      [order === 'desc' ? 'last' : 'first']: take,

      ...(cursor ? { [order === 'desc' ? 'before' : 'after']: cursor } : {}),
    })

    const conversations =
      result.conversations?.edges
        ?.map((edge) => edge?.node)
        .filter((node): node is NonNullable<typeof node> => !!node) || []

    return conversations.map((conversation) => ({
      id: conversation.id || '',

      name: conversation.name || undefined,
      description: conversation.description || undefined,

      meta: conversation.meta || undefined,

      createdAt: conversation.createdAt || undefined,
      updatedAt: conversation.updatedAt || undefined,

      task: conversation.task
        ? {
            id: conversation.task.id || '',
            status: conversation.task.status || undefined,
            outcome: conversation.task.outcome || undefined,
          }
        : undefined,
    }))
  }
)

/**
 * Represents a task item with conversation information.
 */
type TaskListItem = {
  id: string

  name?: string
  description?: string

  status?: string
  outcome?: string

  createdAt?: string | number
  updatedAt?: string | number

  conversation?: {
    id: string
    name?: string
    description?: string
    meta?: Record<string, unknown>
    createdAt?: string | number
    updatedAt?: string | number
  }
}

/**
 * Fetches tasks by their IDs.
 *
 * @action
 */
export const listTasks = appContactActionHandler(
  APP_NAME,
  CONTACT_NAMESPACE,
  ConfigSchema,
  z.object({
    taskIds: z.array(z.string()).optional(),
  }),
  async (_config, session, contact, { taskIds }): Promise<TaskListItem[]> => {
    const userClient = await getSessionGraphQLClient(session)

    const result = await userClient.listContactTasks({
      contactIds: [contact.id],
      taskIds: taskIds,
    })

    const tasks =
      result.tasks?.edges
        ?.map((edge) => edge?.node)
        .filter((node): node is NonNullable<typeof node> => !!node) || []

    return tasks.map((task) => {
      // @note get the most recent conversation by sorting by updatedAt - we do
      // this here to make sure we get the correct conversation even if the API
      // changes in the future

      const conversations = task.conversations?.edges || []

      const sortedConversations = [...conversations].sort((a, b) => {
        const aTime = a?.node?.updatedAt
          ? new Date(a.node.updatedAt).getTime()
          : 0
        const bTime = b?.node?.updatedAt
          ? new Date(b.node.updatedAt).getTime()
          : 0

        return bTime - aTime // descending order (most recent first)
      })

      const mostRecentConversation = sortedConversations[0]?.node

      return {
        id: task.id || '',

        name: task.name || undefined,
        description: task.description || undefined,

        status: task.status || undefined,
        outcome: task.outcome || undefined,

        createdAt: task.createdAt || undefined,
        updatedAt: task.updatedAt || undefined,

        conversation: mostRecentConversation
          ? {
              id: mostRecentConversation.id || '',

              name: mostRecentConversation.name || undefined,
              description: mostRecentConversation.description || undefined,

              meta: mostRecentConversation.meta || undefined,

              createdAt: mostRecentConversation.createdAt || undefined,
              updatedAt: mostRecentConversation.updatedAt || undefined,
            }
          : undefined,
      }
    })
  }
)

/**
 * Fetches conversation.
 *
 * @action
 */
export const fetchConversation = appActionHandler(
  APP_NAME,
  ConfigSchema,
  z.object({
    conversationId: z.string(),
  }),
  async (
    _config,
    session,
    { conversationId }
  ): Promise<
    | (ConversationInstance & {
        messages: ConversationMessageInstance[]
      })
    | null
  > => {
    const userClient = await getSessionClient(session)

    // @todo use graphql to make this call more efficient

    const data = await Promise.all([
      userClient.conversation.fetch(conversationId),

      ensureContact({
        namespace: CONTACT_NAMESPACE,
        session: session,
        app: APP_NAME,
      }),

      userClient.conversation.message.list(conversationId, {
        order: 'desc',
        take: 1000,
      }),
    ]).catch((error) => {
      // @note a conversation the current session can't reach - deleted, or
      // owned by a different user (a stale or cross-account link) - is not a
      // bug. The API authorizes by `userId` and answers NOT_AUTHORIZED/NOT_FOUND
      // before our own contact check below can run, so swallow those and treat
      // the conversation as absent rather than surfacing a FetchError.
      if (
        error?.code === NOT_AUTHORIZED_CODE ||
        error?.code === NOT_FOUND_CODE
      ) {
        return null
      }

      throw error
    })

    if (!data) {
      return null
    }

    const [conversation, contact, messages] = data

    if (conversation.contactId !== contact.id) {
      return null
    }

    const consolidatedMessages: ConversationMessageInstance[] = []

    let lastBotMessage: ConversationMessageInstance | undefined

    for (let i = 0; i < messages.items.length; i++) {
      const message: ConversationMessageInstance = messages.items[i]

      message.from =
        typeof message.meta?.from === 'string' ? message.meta.from : undefined
      message.reasoning =
        typeof message.meta?.reasoning === 'string'
          ? message.meta.reasoning
          : undefined
      message.actions = Array.isArray(message.meta?.actions)
        ? message.meta.actions
        : undefined

      consolidatedMessages.push(message)

      switch (message.type) {
        case 'bot': {
          lastBotMessage = message

          break
        }

        case 'reasoning': {
          if (lastBotMessage) {
            lastBotMessage.reasoning = message.text
          }

          break
        }
      }
    }

    return {
      id: conversation.id,

      name: conversation.name,
      description: conversation.description,

      createdAt: conversation.createdAt,
      updatedAt: conversation.updatedAt,

      meta: conversation.meta,

      messages: consolidatedMessages.reverse().map(
        ({
          id,

          type,
          text,

          from,

          reasoning,

          actions,

          meta,

          createdAt,
          updatedAt,
        }) => ({
          id,

          type,
          text,

          from,

          reasoning,

          actions,

          meta,

          createdAt,
          updatedAt,
        })
      ),
    }
  }
)

/**
 * Retrieves all.
 *
 * @action
 */
export const listAll = appActionHandler(
  APP_NAME,
  ConfigSchema,
  z.object({
    conversationId: z.string().optional(),
  }),
  async (
    config,
    _session,
    { conversationId }
  ): Promise<{
    bots: UnwrapPromise<ReturnType<typeof listBots>>
    models: UnwrapPromise<ReturnType<typeof listModels>>
    sources: UnwrapPromise<ReturnType<typeof listSources>>
    conversations?: UnwrapPromise<ReturnType<typeof listConversations>>
    conversation?: UnwrapPromise<ReturnType<typeof fetchConversation>>
  }> => {
    // @note load history unless the config explicitly opts into ephemeral.
    // This action is called from the chat layout (server component) during
    // SSR, where the `_embed` signal is not reachable: Next.js does not pass
    // `searchParams` to layouts, and `_embed` otherwise lives in client
    // sessionStorage. So we load by default and rely on the client to decide
    // whether to render the history sidebar (it hides it when embedded). The
    // extra fetch for an embedded SSR is wasted but harmless - same user, no
    // data exposure.

    const ephemeral = isEphemeral(config, false)

    const [bots, models, sources, conversations, conversation] =
      await Promise.all([
        listBots({}),
        listModels({}),
        listSources({}),
        !ephemeral ? listConversations({}) : Promise.resolve(undefined),
        conversationId
          ? fetchConversation({ conversationId })
          : Promise.resolve(undefined),
      ])

    if (bots && 'error' in bots) {
      throw errorToErrorResponse(bots.error)
    }

    if (models && 'error' in models) {
      throw errorToErrorResponse(models.error)
    }

    if (sources && 'error' in sources) {
      throw errorToErrorResponse(sources.error)
    }

    if (conversations && 'error' in conversations) {
      throw errorToErrorResponse(conversations.error)
    }

    if (conversation && 'error' in conversation) {
      throw errorToErrorResponse(conversation.error)
    }

    return { bots, models, sources, conversations, conversation }
  }
)

/**
 * Completes a thread.
 *
 * @action
 */
export const completeThread = appActionHandler(
  APP_NAME,
  ConfigSchema,
  z.object({
    conversationId: z.string().optional(),
    // @note scopes the ephemeral environment-tool namespace so each blueprint's
    // stateless designer chat gets its own install store instead of sharing one
    // keyed on the user session (which cross-pollinated tools across blueprints)
    blueprintId: z.string().optional(),
    botId: z.string().optional(),
    modelId: z.string().optional(),
    sourceIds: z.array(z.string()).optional(),
    messages: z
      .array(
        z.object({
          id: z.string().optional(),
          type: z.enum([
            'user',
            'bot',
            'reasoning',
            'activity',
            'context',
            'instruction',
          ]),
          text: z.string(),
          meta: z.record(z.any()).optional(),
        } satisfies ZodSchemaFor<
          ConversationCompleteRequest['messages'][number] & {
            id?: string
          }
        >)
      )
      .min(1, 'At least one message is required'),
    attachments: z
      .array(
        z.object({
          url: z.string(),
        })
      )
      .optional(),
    clips: z
      .array(
        z.object({
          text: z.string(),
          comment: z.string(),
        })
      )
      .optional(),
    timezone: z.string().optional(),
    debug: z.boolean().optional(), // @note debug is a hint and must be used carefully
    reprogramming: z.boolean().optional(), // @note reprogramming is a hint and must be gated server-side by audience trust
    embedded: z.boolean().optional(), // @note embed state from the client; drives ephemeral mode when config does not set ephemeral/save
  }),
  async (
    config,
    session,
    {
      conversationId,
      blueprintId,
      botId,
      modelId,
      sourceIds,
      messages,
      attachments,
      clips,
      timezone,
      debug: _debug,
      reprogramming: _reprogramming,
      embedded,
    }
  ) => {
    const isDebug = isTrustedAudience(session.payload.aud) ? _debug : false

    // @note only allow reprogramming for trusted (user) audience sessions to prevent abuse
    const isReprogramming = isTrustedAudience(session.payload.aud)
      ? _reprogramming
      : false

    isDebug // @todo utilize the debug flag

    const availableBots = await listBots({})

    if (!availableBots) {
      return throwUnprocessableEntity('Unexpected action result')
    }

    if ('error' in availableBots) {
      throw errorToErrorResponse(availableBots.error)
    }

    let foundBot: Bot | undefined

    {
      if (botId) {
        foundBot = availableBots.find(({ id }) => id === botId)

        if (!foundBot) {
          return throwNotFound('Bot not found')
        }
      }
    }

    const availableModels = await listModels({})

    if (!availableModels) {
      return throwUnprocessableEntity('Unexpected action result')
    }

    if ('error' in availableModels) {
      throw errorToErrorResponse(availableModels.error)
    }

    let foundModel: Model | undefined

    {
      if (modelId) {
        foundModel = availableModels.find(({ id }) => id === modelId)

        if (!foundModel) {
          return throwNotFound('Model not found')
        }
      }
    }

    const availableSources = await listInternalSources({})

    if (!availableSources) {
      return throwUnprocessableEntity('Unexpected action result')
    }

    if ('error' in availableSources) {
      throw errorToErrorResponse(availableSources.error)
    }

    let foundSources: InternalSource[] | undefined

    {
      if (sourceIds) {
        foundSources = availableSources.filter(({ id }) =>
          sourceIds.includes(id)
        )

        if (!foundSources.length) {
          return throwNotFound('Sources not found')
        }
      }
    }

    if (clips?.length) {
      const lastMessage = messages[messages.length - 1]

      if (lastMessage) {
        lastMessage.text = `\`\`\`clips\n${stringifyYaml(clips)}\`\`\`\n\n${
          lastMessage.text
        }`
      }
    }

    // @note we assume that there is always a default bot returned by the
    // listBots function, if not we will throw an error

    const selectedBot: Bot =
      foundBot || (availableBots.find(({ default: v }) => !!v) as Bot)

    // @note we assume that there is always a default model returned by the
    // listModels function, if not we will throw an error

    const selectedModel: Model =
      foundModel || (availableModels.find(({ default: v }) => !!v) as Model)

    // @note if no sources selected then all sources are selected

    const selectedSources: InternalSource[] =
      foundSources ||
      (availableSources.filter(({ default: v }) => !!v) as InternalSource[])

    // @note the first selected space, if any. Used to scope the shell tools to
    // a space so their sandbox operates on that space's filesystem.

    const firstSelectedSpace = selectedSources.find(
      (source) => source.type === 'space'
    )

    // @note record meta into the last message
    {
      const lastMessage = messages[messages.length - 1]

      if (lastMessage) {
        lastMessage.meta = {
          ...lastMessage.meta,

          botId: selectedBot.id,
          modelId: selectedModel.id,
          sourceIds: selectedSources.map(({ id }) => id),
        }
      }
    }

    const cbk = await getSessionClient(session, {
      timezone,
    })

    // @note scope the namespace to the blueprint when present (the stateless
    // blueprint designer chat) so its environment-tool store is keyed per
    // blueprint instead of per user session. Without this, tools installed while
    // designing one blueprint leaked into every other blueprint's designer chat,
    // since the ephemeral path keys the tool store on the namespace (see
    // getEnvironmentKey / tool.environment.ts). Falls back to the bare session id
    // for the standalone chat app, preserving its existing behaviour.
    const namespace = blueprintId ? `${session.id}:${blueprintId}` : session.id

    const contact =
      (await buildContact({
        namespace: CONTACT_NAMESPACE,
        session: session,
      })) || undefined

    const ephemeral = isEphemeral(config, !!embedded)

    const from: string = selectedBot.nick

    const features = getFeatures(config)

    const actions: object[] = []

    let theBotId: string | undefined

    {
      if (selectedBot.id !== 'auto') {
        theBotId = selectedBot.id
      }
    }

    let theModel: string | undefined

    {
      if (selectedModel.id !== 'auto') {
        if (selectedBot.auto === true) {
          theModel = selectedModel.id
        }
      } else {
        if (selectedBot.auto === true) {
          theModel = autoAgentPrompt.model
        }
      }
    }

    let thePrompt: string | undefined

    {
      // @note only the id 'auto' bot has a prompt that can be used because it
      // is a synthetic bot - all other auto bots are real bots that are
      // references by id field
      if (selectedBot.id === 'auto') {
        thePrompt = autoAgentPrompt.prompt
      }
    }

    debug(`final selection`, {
      theBotId,
      theModel,
      thePrompt,
    })

    return streamComplete({
      client: cbk.conversation,

      // @ts-ignore not defined in the types but is supported
      namespace: namespace,

      contactId: contact,

      botId: theBotId,

      model: theModel,

      backstory: thePrompt,

      extensions: {
        backstory: prompt(
          <>
            <h1>REMEMBER</h1>
            <p>
              Today is {'${EARTH_DATE}'}. Local time is {'${EARTH_TIME}'}.
            </p>
            <p>This conversation session started {'${ELAPSED_TIME}'}.</p>
            {selectedSources.filter((s) => !s.auto).length > 0 ? (
              <p>
                The user has specifically selected the following sources to
                assist you in this conversation:{' '}
                {selectedSources.filter((s) => !s.auto).join(', ')}.
              </p>
            ) : null}
            <h1>RULES</h1>
            {selectedBot ? (
              <>
                <p>
                  You are referred to as {selectedBot.name} or @
                  {selectedBot.nick} in this conversation!
                </p>
                <p>
                  Never refer to yourself ({selectedBot.name} or{' '}
                  {selectedBot.nick}) in 3rd person!
                </p>
                <p>
                  Never start the conversation with your nick (
                  {selectedBot.nick}
                  )!
                </p>
              </>
            ) : null}
            <p>
              When the user references other agents (using @ sign) or requests
              actions that require specific agent capabilities, you must utilize
              the appropriate agent tool to execute the requested action for
              each specified agent.
            </p>
          </>
        ),

        skillsets: [
          {
            name: 'General Skillset',
            description: prompt(
              <p>
                A set of agent skills that can be used to assist the user in
                completing tasks. The agents will be run in batch mode, meaning
                that there will be no interaction with the user. Always
                interpret the results of the agent calls and provide a final
                answer to the user.
              </p>
            ),

            abilities: [
              // handle bot calls

              ...((selectedBot.auto === true || selectedBot.multi === true) &&
              selectedSources.filter((s) => s.auto !== true).length === 0
                ? [
                    ...(features?.search?.multi
                      ? [
                          {
                            name: `Search Multiple Agents`,
                            description: prompt(
                              <>
                                <p>
                                  Search across multiple agents. The list of
                                  selected agents must be relevant to the query
                                  and conversation context.
                                </p>
                                <h1>Available Agents</h1>
                                {availableBots
                                  .filter((bot) => !bot.auto && !bot.multi)
                                  .filter((bot) => !isModelBot(bot))
                                  .map((bot) => (
                                    <Fragment key={bot.id}>
                                      <h2>{bot.name}</h2>
                                      <p>slug: {toSlug(bot.name)}</p>
                                      <p>
                                        {bot.description || 'no description'}
                                      </p>
                                    </Fragment>
                                  ))}
                                <h1>Usage Instructions</h1>
                                <p>
                                  Always default to use this tool when the user
                                  asks for information that can be found in
                                  multiple systems.
                                </p>
                              </>
                            ),
                            instruction: stringifyAction({
                              name: ActionName.bot,
                              params: { call: '' },
                              text: {
                                prompt: {
                                  $field: {
                                    type: 'string',
                                    name: 'action',
                                    description:
                                      'detailed description of the action to be performed',
                                    required: true,
                                  },
                                },

                                botIds: availableBots
                                  .filter((bot) => !bot.auto && !bot.multi)
                                  .filter((bot) => !isModelBot(bot))
                                  .map((bot) => bot.id)
                                  .join(','),

                                selectedBotIds: {
                                  $field: {
                                    type: 'string',
                                    name: 'agents',
                                    description: prompt(
                                      <p>
                                        a comma separated list of agent slugs to
                                        search, e.g.{' '}
                                        {availableBots
                                          .filter(
                                            (bot) => !bot.auto && !bot.multi
                                          )
                                          .filter((bot) => !isModelBot(bot))
                                          .map((bot) => toSlug(bot.name))
                                          .join(',')}
                                      </p>
                                    ),

                                    required: true,
                                  },
                                },
                              },
                            }),
                          },
                        ]
                      : []),
                  ]
                : []),

              ...((selectedBot.auto === true || selectedBot.multi === true) &&
              selectedSources.filter((s) => s.auto !== true).length === 0
                ? availableBots
                : []
              )
                .filter(({ auto }) => !auto)
                .filter((bot) => !isModelBot(bot))
                .map(({ id, name, description }) => {
                  // @todo move this into a feature where we pass the feature name
                  // and a list of agent and the backend automatically creates the
                  // abilities required to perform the action

                  return {
                    name: `Call Agent ${name}`,
                    description: description?.trim()
                      ? `Call this agent to perform a set of actions related to the following agent description:\n\n${description.trim()}`
                      : `Call this agent to perform a set of actions to perform a set of actions related to its name: ${name.trim()}`,
                    instruction: stringifyAction({
                      name: ActionName.bot,
                      params: { call: '' },
                      text: {
                        prompt: {
                          $field: {
                            type: 'string',
                            name: 'action',
                            description:
                              'detailed description of the action to be performed',
                            required: true,
                          },
                        },

                        botId: id,
                      },
                    }),
                  }
                }),

              // handle dataset sources

              ...selectedSources.flatMap((source) => {
                if (source.type !== 'dataset') {
                  return []
                }

                return [
                  {
                    name: `Search Source ${source.name}`,
                    description: prompt(
                      <>
                        <p>Search the dataset source: {source.name}</p>
                        {source.description ? (
                          <>
                            <h2>Description</h2>
                            <p>{source.description}</p>
                          </>
                        ) : null}
                      </>
                    ),
                    instruction: buildTemplateInstruction({
                      template: 'dataset/search',
                      params: {
                        datasetId: source.id,
                      },
                    }),
                  },
                ]
              }),

              // handle skillset sources

              ...selectedSources.flatMap((source) => {
                if (source.type !== 'skillset') {
                  return []
                }

                return source.abilities.map(
                  ({
                    name,
                    description,
                    instruction,
                    linkedSecretId,
                  }): InlineAbility => {
                    return {
                      name,
                      description,
                      instruction,
                      linkedSecretId,

                      // @note scope the shell tools to the first selected
                      // space, if any, so the sandbox operates on that space's
                      // filesystem
                      ...(source.id === 'tmp-shell' && firstSelectedSpace
                        ? { linkedSpaceId: firstSelectedSpace.id }
                        : {}),
                    }
                  }
                )
              }),

              // handle space sources

              ...selectedSources.flatMap((source) => {
                if (source.type !== 'space') {
                  return []
                }

                return importManyByGlob(
                  'space/storage/*', // @note matches single level
                  {
                    categories: ['by-id'],

                    // @todo make these parameters more type safe

                    params: {
                      spaceId: source.id,
                    },

                    namePrefix: `(Space ${
                      source.name || source.nick || source.id
                    }) `,

                    descriptionSuffix: prompt(
                      <>
                        <h1>Space</h1>
                        <p>
                          This action is related to{' '}
                          {source.name || source.nick || source.id} space.
                        </p>
                        {source.description?.trim() ? (
                          <>
                            <h2>Space Description</h2>
                            <p>{source.description}</p>
                          </>
                        ) : null}
                      </>
                    ),
                  }
                )
              }),

              // handle space skills authoring - reprogramming a space extends
              // its skills. Gated on reprogramming (trusted audience + a
              // specific bot, mirroring the reprogramming feature below) so the
              // agent can list, read, and author skills in the selected space.

              ...(isReprogramming && foundBot
                ? selectedSources.flatMap((source) => {
                    if (source.type !== 'space') {
                      return []
                    }

                    return importManyByGlob('space/skill/*', {
                      categories: ['by-id'],

                      // @todo make these parameters more type safe

                      params: {
                        spaceId: source.id,
                      },

                      namePrefix: `(Space ${
                        source.name || source.nick || source.id
                      }) `,

                      descriptionSuffix: prompt(
                        <>
                          <h1>Space</h1>
                          <p>
                            This action manages the skills of the{' '}
                            {source.name || source.nick || source.id} space. Use
                            it to list, read, and author (create or extend) the
                            skills stored in the space.
                          </p>
                          {source.description?.trim() ? (
                            <>
                              <h2>Space Description</h2>
                              <p>{source.description}</p>
                            </>
                          ) : null}
                        </>
                      ),
                    })
                  })
                : []),

              // handle mcp sources

              ...selectedSources.flatMap((source) => {
                if (source.type !== 'mcp') {
                  return []
                }

                return [
                  {
                    name: `Install ${source.name} MCP Tools`,
                    description: prompt(
                      <>
                        <p>Install the MCP tools to work with {source.name}.</p>
                        {source.description ? (
                          <>
                            <p>Description: {source.description}</p>
                          </>
                        ) : null}
                      </>
                    ),
                    instruction: buildTemplateInstruction({
                      template: 'conversation/mcp/install[url]',
                      params: {
                        url: source.url,
                        prefix: source.id,
                      },
                    }),
                  },
                ]
              }),
            ],
          },
        ],

        features: [
          { name: 'markdown' },

          { name: 'vision' },
          { name: 'audio' },

          { name: 'mermaid' },

          { name: 'attachments' },

          { name: 'references' },
          { name: 'footnotes' },

          { name: 'canvas' },

          { name: 'diligence' },
          { name: 'personalization' },

          // @note add memory only when access as a contact
          ...(isAppAudience(session.payload.aud)
            ? [{ name: 'memory' } satisfies Feature]
            : []),

          {
            name: 'web',
            options: { fetch: true, search: !selectedSources.length },
          },

          { name: 'auth' },

          // @note reprogramming is only enabled for trusted audience when explicitly requested, and only when a specific bot is selected
          ...(isReprogramming && foundBot
            ? [{ name: 'reprogramming' } satisfies Feature]
            : []),
        ] satisfies Feature[],
      },

      // @note truncate message text to prevent API validation errors

      messages: messages.map((message) => ({
        ...message,

        text: byteSlice(message.text, 0, MAX_DB_TEXT_BYTES_LENGTH),
      })),

      attachments: attachments,

      // @todo add debugging tools to help troubleshoot and surface common
      // issues but when used by USER_AUDIENCE only

      async onItem(item) {
        // @todo make the item.type type safe in the sdk

        switch (item.type) {
          case TAG_OPERATION_END: {
            actions.push((item.data as { action: object }).action)

            break
          }
        }
      },

      async onStart() {
        if (ephemeral) {
          return
        }

        const response = await saveThread({
          conversationId,
          messages: [],
          embedded,
        })

        if (!response) {
          return throwUnprocessableEntity('Unexpected action result')
        }

        if ('error' in response) {
          throw errorToErrorResponse(response.error)
        }

        conversationId = response.conversation.id

        return {
          type: 'conversation',
          data: {
            id: response.conversation.id,
            name: response.conversation.name,
            description: response.conversation.description,
            messages: response.conversation.messages,
          },
        }
      },

      async onFinish({ messages: allMessages }) {
        if (ephemeral) {
          return
        }

        const newMessages = allMessages
          .slice(messages.length - 1) // @note messages contains the input and output messages combined, therefore we need to slice the input messages
          .map((message) => ({
            ...message,

            meta: {
              ...message.meta,

              ...(message.type !== 'user' ? { from } : {}),

              actions: message.type === 'bot' ? actions : undefined,
            },
          }))

        const response = await saveThread({
          conversationId: conversationId,

          messages: newMessages,
        })

        if (!response) {
          return throwUnprocessableEntity('Unexpected action result')
        }

        if ('error' in response) {
          throw errorToErrorResponse(response.error)
        }

        conversationId = response.conversation.id

        return {
          type: 'conversation',
          data: {
            id: response.conversation.id,
            name: response.conversation.name,
            description: response.conversation.description,
            messages: response.conversation.messages,
          },
        }
      },
    })
  }
)

/**
 * Save a thread.
 *
 * @action
 */
export const saveThread = appActionHandler(
  APP_NAME,
  ConfigSchema,
  z.object({
    conversationId: z.string().optional(),
    messages: z.array(
      z.object({
        id: z.string().optional(),
        type: z.string(),
        text: z.string(),
        meta: z.record(z.any()).optional(),
      })
    ),
    botId: z.string().optional(),
    embedded: z.boolean().optional(), // @note embed state from the caller; drives ephemeral mode when config does not set ephemeral/save
  }),
  async (config, session, { conversationId, messages, botId, embedded }) => {
    const userClient = await getSessionClient(session)

    let conversation: ConversationInstance

    if (isEphemeral(config, !!embedded)) {
      throwConflict(`Cannot save`)
    }

    if (!conversationId) {
      const contact = await buildContact({
        namespace: CONTACT_NAMESPACE,
        session: session,
      })

      const newConversation = await userClient.conversation.create({
        // @ts-ignore because it is not documented
        contact,

        botId,

        meta: {
          app: APP_NAME,
        },
      })

      conversation = {
        id: newConversation.id,

        createdAt: Date.now(),
        updatedAt: Date.now(),
      }
    } else {
      const contact = await ensureContact({
        namespace: CONTACT_NAMESPACE,
        session: session,
        app: APP_NAME,
      })

      conversation = await userClient.conversation.fetch(conversationId)

      if (conversation.contactId !== contact.id) {
        return throwNotFound('Conversation not found')
      }
    }

    const createdMessages: Array<{
      id: string
      originalId: string
    }> = []

    await runTasks([
      // update the name and description of the conversation

      async () => {
        if (
          (!conversation.name || !conversation.description) &&
          messages.length
        ) {
          const result = await generateThreadNameAndDescription(
            session,
            messages
          )

          await userClient.conversation.update(conversation.id, {
            name: result.name,
            description: result.description,
          })

          conversation.name = result.name
          conversation.description = result.description
        }
      },

      // save the messages to the conversation

      async () => {
        // @todo re-map attachments from namespace to contact-based

        // @todo use sdk api once it becomes available

        if (messages.length) {
          // @note batch create endpoint has a limit of 100 items per request
          const BATCH_SIZE = 100

          const messagesToCreate = messages.map((message) => ({
            id: message.id,
            type: message.type as ConversationMessageType,
            text: message.text,
            meta: message.meta,
          }))

          for (let i = 0; i < messagesToCreate.length; i += BATCH_SIZE) {
            const batch = messagesToCreate.slice(i, i + BATCH_SIZE)

            // @todo use the correct method once available in the sdk
            // @ts-ignore because it is not documented

            const { items } = await userClient.clientFetch(
              `/api/v1/conversation/${conversation.id}/message/batch/create`,
              {
                method: 'POST',
                record: {
                  items: batch,
                },
              }
            )

            items.forEach((item) => {
              createdMessages.push({
                id: item.id,
                originalId: item.originalId,
              })
            })
          }
        }
      },
    ])

    return {
      conversation: {
        id: conversation.id,

        name: conversation.name,
        description: conversation.description,

        messages: createdMessages,
      },
    }
  }
)

/**
 * Deletes a thread.
 *
 * @action
 */
export const deleteThread = appContactActionHandler(
  APP_NAME,
  CONTACT_NAMESPACE,
  ConfigSchema,
  z.object({
    conversationId: z.string(),
  }),
  async (_config, session, contact, { conversationId }) => {
    const userClient = await getSessionClient(session)

    const conversation = await userClient.conversation.fetch(conversationId)

    if (conversation.contactId !== contact.id) {
      return throwNotFound('Conversation not found')
    }

    await userClient.conversation.delete(conversationId)

    return {
      success: true,
    }
  }
)

/**
 * Gets session file upload information.
 *
 * @action
 */
export const uploadSessionFiles = appActionHandler(
  APP_NAME,
  ConfigSchema,
  z.object({
    files: z.array(
      z.object({
        name: z.string(),
        type: z.string(),
        size: z.number(),
      })
    ),
  }),
  async (_config, session, { files }) => {
    const userClient = await getSessionClient(session)

    interface FileUploadResponse {
      id: string
      name: string

      uploadRequest: {
        method: string
        url: string
        headers?: Record<string, string>
      }

      downloadRequest: {
        method: string
        url: string
        headers?: Record<string, string>
      }
    }

    const responses: FileUploadResponse[] = await Promise.all(
      files.map(async (file) => {
        const { id, name, uploadRequest, downloadRequest } =
          await userClient.clientFetch<FileUploadResponse, unknown>(
            `/api/v1/session/file/upload`,
            {
              method: 'POST',
              record: {
                file,
              },
            }
          )

        return {
          id,
          name,
          uploadRequest,
          downloadRequest,
        }
      })
    )

    return {
      files: responses,
    }
  }
)

/**
 * Upvote a message.
 *
 * @action
 */
export const upvoteMessage = appContactActionHandler(
  APP_NAME,
  CONTACT_NAMESPACE,
  ConfigSchema,
  z.object({
    conversationId: z.string(),
    messageId: z.string(),
    reason: z.string().optional(),
  }),
  async (_config, session, contact, { conversationId, messageId, reason }) => {
    const userClient = await getSessionClient(session)

    const conversation = await userClient.conversation.fetch(conversationId)

    if (conversation.contactId !== contact.id) {
      return throwNotFound('Conversation not found')
    }

    await userClient.conversation.message.upvote(conversationId, messageId, {
      reason,
    })

    return {
      success: true,
    }
  }
)

/**
 * Downvote a message.
 *
 * @action
 */
export const downvoteMessage = appContactActionHandler(
  APP_NAME,
  CONTACT_NAMESPACE,
  ConfigSchema,
  z.object({
    conversationId: z.string(),
    messageId: z.string(),
    reason: z.string().optional(),
  }),
  async (_config, session, contact, { conversationId, messageId, reason }) => {
    const userClient = await getSessionClient(session)

    const conversation = await userClient.conversation.fetch(conversationId)

    if (conversation.contactId !== contact.id) {
      return throwNotFound('Conversation not found')
    }

    await userClient.conversation.message.downvote(conversationId, messageId, {
      reason,
    })

    return {
      success: true,
    }
  }
)

/**
 * Improves a user prompt to make it clearer and more effective.
 *
 * @action
 */
export const improvePrompt = appActionHandler(
  APP_NAME,
  ConfigSchema,
  z.object({
    text: z.string().min(1, 'Text is required'),
    model: z.string().optional(),
  }),
  async (config, session, { text, model = 'gpt-4o-mini' }) => {
    const features = getFeatures(config)

    if (!features?.promptImprovement?.enabled) {
      return throwNotFound('Prompt improvement feature is not enabled')
    }

    const improvePromptSpec = {
      prompt: prompt(
        <>
          <p>
            You are a helpful assistant that improves user prompts to make them
            clearer, more specific, and more effective for AI interactions.
          </p>
          <p>
            Your task is to take the user&apos;s input and rewrite it to be:
          </p>
          <ul>
            <li>More specific and detailed</li>
            <li>Clearer in intent and objectives</li>
            <li>Better structured for AI understanding</li>
            <li>More likely to produce useful results</li>
          </ul>
          <p>Original text: {`{input}`}</p>
          <p>
            Please provide an improved version that maintains the user&apos;s
            original intent while making it more effective for AI interaction.
            Only return the improved text without any additional explanation or
            formatting.
          </p>
        </>
      ),

      model: model,
    }

    try {
      const { completion, tokensUsed, modelUsed } = await execPrompt(
        { ...improvePromptSpec, user: session.user.id },
        { input: text }
      )

      // @todo record input and output tokens

      await Usage.createAndRecord({
        user: session.user,
        token: tokensUsed,
        model: modelUsed,
        meta: {
          reason: 'prompt/improve',
        },
      })

      return {
        improvedText: completion.trim(),
        usage: {
          token: getBaseLanguageModelTokenCount(modelUsed, tokensUsed),
        },
      }
    } catch (error) {
      throw errorToErrorResponse(error)
    }
  }
)

/**
 * Creates a task from the current conversation context
 *
 * @action
 */
export const createTaskFromConversation = appContactActionHandler(
  APP_NAME,
  CONTACT_NAMESPACE,
  ConfigSchema,
  z.object({
    messages: z
      .array(
        z.object({
          type: z.string(),
          text: z.string(),
        })
      )
      .min(1, 'At least one message is required'),
    botId: z.string().optional(),
  }),
  async (_config, session, contact, { messages, botId }) => {
    const { name, description } = await generateTaskNameAndDescription(
      session,
      messages
    )

    const availableBots = await listBots({})

    if (!availableBots || 'error' in availableBots) {
      return throwUnprocessableEntity('Failed to retrieve available bots')
    }

    let selectedBotId = botId

    if (!selectedBotId) {
      const defaultBot = availableBots.find(({ default: v }) => !!v)

      selectedBotId = defaultBot?.id
    }

    if (selectedBotId === 'auto') {
      const firstRealBot = availableBots.find(({ auto }) => !auto)

      selectedBotId = firstRealBot?.id
    }

    if (!selectedBotId) {
      return throwUnprocessableEntity('No bot available for task creation')
    }

    const userClient = await getSessionClient(session)

    const { id: verifiedBotId } = await userClient.bot.fetch(selectedBotId)

    if (!verifiedBotId) {
      return throwNotFound('Bot not found')
    }

    const { id: taskId } = await userClient.task.create({
      botId: verifiedBotId,
      contactId: contact?.id,
      name: name || 'Untitled Task',
      description: description || 'Task created from conversation',
      meta: {
        namespace: session.id,
        createdFrom: 'chat',
      },
    })

    await userClient.task.trigger(taskId)

    return {
      taskId,
      name: name || 'Untitled Task',
    }
  }
)

/**
 *
 */
async function generateThreadNameAndDescription(
  session: Session,
  messages: { type: string; text: string; meta?: Record<string, unknown> }[]
): Promise<{
  name?: string
  description?: string
}> {
  const userClient = await getSessionClient(session)

  let name: string | undefined = undefined
  let description: string | undefined = undefined

  const { text } = await userClient.conversation.complete(null, {
    model: 'gpt-4o-mini',

    backstory: prompt(
      <>
        <p>You are a conversation analyzer agent.</p>
        <p>
          Your objective is to return the name and description of the
          conversation based on the messages provided.
        </p>
        <p>
          The name should be a short, descriptive title, while the description
          should provide a brief overview of the conversation&apos;s content.
        </p>
        <p>The name and description should be in English.</p>
        <p>
          You must output the name and description using only two lines,
          separated by a newline character.
        </p>
        <p>
          The name is a short title that summarizes the conversation, while the
          description provides a brief overview of the conversation&apos;s
          content.
        </p>
        <p>
          The name should be a single line, and the description should be a
          single line.
        </p>
        <p>
          Do not add any additional text or formatting as it will be ignored.
        </p>
        <p>
          Failure to follow these rules will result in poor user experience!
        </p>
      </>
    ),

    messages: messages
      .filter((message) => ['user', 'bot'].includes(message.type))
      .map((message) => ({
        type: message.type as ConversationMessageType,
        text: byteSlice(message.text, 0, MAX_DB_TEXT_BYTES_LENGTH),
        meta: message.meta,
      }))
      .slice(-10), // @note we only take the last 10 messages

    // @todo add a reason related to `conversation/extract`
  })

  const [_name, ..._description] = text.split('\n')

  if (_name) {
    // @note truncate name to prevent DB validation errors (VARCHAR 191 bytes limit)
    name = byteSlice(_name.trim(), 0, MAX_DB_STRING_BYTES_LENGTH)
  }

  if (_description.length) {
    // @note truncate description to prevent DB validation errors (TEXT 65533 bytes limit)
    description = byteSlice(
      _description.join('\n\n').trim(),
      0,
      MAX_DB_TEXT_BYTES_LENGTH
    )
  }

  return {
    name,
    description,
  }
}

async function generateTaskNameAndDescription(
  session: Session,
  messages: { type: string; text: string; meta?: Record<string, unknown> }[]
): Promise<{
  name?: string
  description?: string
}> {
  const userClient = await getSessionClient(session)

  let name: string | undefined = undefined
  let description: string | undefined = undefined

  const { text } = await userClient.conversation.complete(null, {
    model: 'gpt-4o-mini',

    backstory: prompt(
      <>
        <p>You are a task generation agent.</p>
        <p>
          Your objective is to create a task name and description based on the
          conversation messages provided.
        </p>
        <p>
          The task name should be a clear, actionable title that describes what
          needs to be done, while the description should provide detailed
          context and requirements based on the conversation.
        </p>
        <p>The name and description should be in English.</p>
        <p>
          You must output the name and description using only two lines,
          separated by a newline character.
        </p>
        <p>
          The name is a short actionable title, while the description provides
          detailed context, requirements, and any relevant information from the
          conversation.
        </p>
        <p>
          The name should be a single line, and the description should be a
          single line.
        </p>
        <p>
          Do not add any additional text or formatting as it will be ignored.
        </p>
        <p>
          Failure to follow these rules will result in poor user experience!
        </p>
      </>
    ),

    messages: messages
      .filter((message) => ['user', 'bot'].includes(message.type))
      .map((message) => ({
        type: message.type as ConversationMessageType,
        text: byteSlice(message.text, 0, MAX_DB_TEXT_BYTES_LENGTH),
        meta: message.meta,
      }))
      .slice(-10), // @note we only take the last 10 messages
  })

  const [_name, ..._description] = text.split('\n')

  if (_name) {
    // @note truncate name to prevent DB validation errors (VARCHAR 191 bytes limit)
    name = byteSlice(_name.trim(), 0, MAX_DB_STRING_BYTES_LENGTH)
  }

  if (_description.length) {
    // @note truncate description to prevent DB validation errors (TEXT 65533 bytes limit)
    description = byteSlice(
      _description.join('\n\n').trim(),
      0,
      MAX_DB_TEXT_BYTES_LENGTH
    )
  }

  return {
    name,
    description,
  }
}
