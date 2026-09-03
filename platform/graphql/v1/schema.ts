/* eslint-disable unused-imports/no-unused-vars */
import type { Session } from 'next-auth'

import { getDatamodel } from '@chatbotkit-dev/db/pothos'
import type PrismaTypes from '@chatbotkit-dev/db/pothos'

import type { Prisma } from '@/prisma/client'
import prisma from '@/prisma/client'
import {
  BlueprintVisibility as _BlueprintVisibility,
  BotVisibility as _BotVisibility,
  DatasetVisibility as _DatasetVisibility,
  FileVisibility as _FileVisibility,
  MessageType as _MessageType,
  PolicyType as _PolicyType,
  ResourceState as _ResourceState,
  Schedule as _Schedule,
  SecretKind as _SecretKind,
  SecretType as _SecretType,
  SecretVisibility as _SecretVisibility,
  SkillsetVisibility as _SkillsetVisibility,
  TaskOutcome as _TaskOutcome,
  TaskStatus as _TaskStatus,
} from '@/prisma/types'

import { getSessionClient } from '@/lib/cbk.sdk'
import { maskSecretConfig } from '@/lib/credential.mask'
import { captureException } from '@/lib/error'
import { buildMetaQueryFilter, buildValueQueryFilter } from '@/lib/filter'
import {
  getIntegrationCredentialSelection,
  getIntegrationVerification,
} from '@/lib/integration.verification'
import { OMIT_NULL, omit, omitNullExcept } from '@/lib/object'
import { getPortalFrontendHost } from '@/lib/portal.slug'
import { getRelatedUsers } from '@/lib/user.relation'

import type {
  BlueprintCreateRequest as _BlueprintCreateRequest,
  BlueprintCreateResponse as _BlueprintCreateResponse,
  BlueprintDeleteResponse as _BlueprintDeleteResponse,
  BlueprintUpdateRequest as _BlueprintUpdateRequest,
  BlueprintUpdateResponse as _BlueprintUpdateResponse,
} from '@chatbotkit/sdk/blueprint/v1'
import type {
  BotCreateRequestBody as _BotCreateRequestBody,
  BotCreateResponse as _BotCreateResponse,
  BotDeleteResponse as _BotDeleteResponse,
  BotUpdateRequestBody as _BotUpdateRequestBody,
  BotUpdateResponse as _BotUpdateResponse,
} from '@chatbotkit/sdk/bot/v1'
import type {
  DatasetCreateRequest as _DatasetCreateRequest,
  DatasetCreateResponse as _DatasetCreateResponse,
  DatasetDeleteResponse as _DatasetDeleteResponse,
  DatasetUpdateRequest as _DatasetUpdateRequest,
  DatasetUpdateResponse as _DatasetUpdateResponse,
} from '@chatbotkit/sdk/dataset/v1'
import type {
  FileCreateRequest as _FileCreateRequest,
  FileCreateResponse as _FileCreateResponse,
  FileDeleteResponse as _FileDeleteResponse,
  FileUpdateRequest as _FileUpdateRequest,
  FileUpdateResponse as _FileUpdateResponse,
} from '@chatbotkit/sdk/file/v1'
import type {
  DiscordIntegrationCreateRequest as _DiscordIntegrationCreateRequest,
  DiscordIntegrationCreateResponse as _DiscordIntegrationCreateResponse,
  DiscordIntegrationDeleteResponse as _DiscordIntegrationDeleteResponse,
  DiscordIntegrationUpdateRequest as _DiscordIntegrationUpdateRequest,
  DiscordIntegrationUpdateResponse as _DiscordIntegrationUpdateResponse,
} from '@chatbotkit/sdk/integration/discord/v1'
import type {
  EmailIntegrationCreateRequest as _EmailIntegrationCreateRequest,
  EmailIntegrationCreateResponse as _EmailIntegrationCreateResponse,
  EmailIntegrationDeleteResponse as _EmailIntegrationDeleteResponse,
  EmailIntegrationUpdateRequest as _EmailIntegrationUpdateRequest,
  EmailIntegrationUpdateResponse as _EmailIntegrationUpdateResponse,
} from '@chatbotkit/sdk/integration/email/v1'
import type {
  ExtractIntegrationCreateRequest as _ExtractIntegrationCreateRequest,
  ExtractIntegrationCreateResponse as _ExtractIntegrationCreateResponse,
  ExtractIntegrationDeleteResponse as _ExtractIntegrationDeleteResponse,
  ExtractIntegrationUpdateRequest as _ExtractIntegrationUpdateRequest,
  ExtractIntegrationUpdateResponse as _ExtractIntegrationUpdateResponse,
} from '@chatbotkit/sdk/integration/extract/v1'
import type {
  GooglechatIntegrationCreateRequest as _GooglechatIntegrationCreateRequest,
  GooglechatIntegrationCreateResponse as _GooglechatIntegrationCreateResponse,
  GooglechatIntegrationDeleteResponse as _GooglechatIntegrationDeleteResponse,
  GooglechatIntegrationUpdateRequest as _GooglechatIntegrationUpdateRequest,
  GooglechatIntegrationUpdateResponse as _GooglechatIntegrationUpdateResponse,
} from '@chatbotkit/sdk/integration/googlechat/v1'
import type {
  InstagramIntegrationCreateRequest as _InstagramIntegrationCreateRequest,
  InstagramIntegrationCreateResponse as _InstagramIntegrationCreateResponse,
  InstagramIntegrationDeleteResponse as _InstagramIntegrationDeleteResponse,
  InstagramIntegrationUpdateRequest as _InstagramIntegrationUpdateRequest,
  InstagramIntegrationUpdateResponse as _InstagramIntegrationUpdateResponse,
} from '@chatbotkit/sdk/integration/instagram/v1'
import type {
  McpServerIntegrationCreateRequest as _McpserverIntegrationCreateRequest,
  McpServerIntegrationCreateResponse as _McpserverIntegrationCreateResponse,
  McpServerIntegrationDeleteResponse as _McpserverIntegrationDeleteResponse,
  McpServerIntegrationUpdateRequest as _McpserverIntegrationUpdateRequest,
  McpServerIntegrationUpdateResponse as _McpserverIntegrationUpdateResponse,
} from '@chatbotkit/sdk/integration/mcpserver/v1'
import type {
  MessengerIntegrationCreateRequest as _MessengerIntegrationCreateRequest,
  MessengerIntegrationCreateResponse as _MessengerIntegrationCreateResponse,
  MessengerIntegrationDeleteResponse as _MessengerIntegrationDeleteResponse,
  MessengerIntegrationUpdateRequest as _MessengerIntegrationUpdateRequest,
  MessengerIntegrationUpdateResponse as _MessengerIntegrationUpdateResponse,
} from '@chatbotkit/sdk/integration/messenger/v1'
import type {
  MicrosoftteamsIntegrationCreateRequest as _MicrosoftteamsIntegrationCreateRequest,
  MicrosoftteamsIntegrationCreateResponse as _MicrosoftteamsIntegrationCreateResponse,
  MicrosoftteamsIntegrationDeleteResponse as _MicrosoftteamsIntegrationDeleteResponse,
  MicrosoftteamsIntegrationUpdateRequest as _MicrosoftteamsIntegrationUpdateRequest,
  MicrosoftteamsIntegrationUpdateResponse as _MicrosoftteamsIntegrationUpdateResponse,
} from '@chatbotkit/sdk/integration/microsoftteams/v1'
import type {
  NotionIntegrationCreateRequest as _NotionIntegrationCreateRequest,
  NotionIntegrationCreateResponse as _NotionIntegrationCreateResponse,
  NotionIntegrationDeleteResponse as _NotionIntegrationDeleteResponse,
  NotionIntegrationUpdateRequest as _NotionIntegrationUpdateRequest,
  NotionIntegrationUpdateResponse as _NotionIntegrationUpdateResponse,
} from '@chatbotkit/sdk/integration/notion/v1'
import type {
  SitemapIntegrationCreateRequest as _SitemapIntegrationCreateRequest,
  SitemapIntegrationCreateResponse as _SitemapIntegrationCreateResponse,
  SitemapIntegrationDeleteResponse as _SitemapIntegrationDeleteResponse,
  SitemapIntegrationUpdateRequest as _SitemapIntegrationUpdateRequest,
  SitemapIntegrationUpdateResponse as _SitemapIntegrationUpdateResponse,
} from '@chatbotkit/sdk/integration/sitemap/v1'
import type {
  SkillServerIntegrationCreateRequest as _SkillserverIntegrationCreateRequest,
  SkillServerIntegrationCreateResponse as _SkillserverIntegrationCreateResponse,
  SkillServerIntegrationDeleteResponse as _SkillserverIntegrationDeleteResponse,
  SkillServerIntegrationUpdateRequest as _SkillserverIntegrationUpdateRequest,
  SkillServerIntegrationUpdateResponse as _SkillserverIntegrationUpdateResponse,
} from '@chatbotkit/sdk/integration/skillserver/v1'
import type {
  SlackIntegrationCreateRequest as _SlackIntegrationCreateRequest,
  SlackIntegrationCreateResponse as _SlackIntegrationCreateResponse,
  SlackIntegrationDeleteResponse as _SlackIntegrationDeleteResponse,
  SlackIntegrationUpdateRequest as _SlackIntegrationUpdateRequest,
  SlackIntegrationUpdateResponse as _SlackIntegrationUpdateResponse,
} from '@chatbotkit/sdk/integration/slack/v1'
import type {
  SupportIntegrationCreateRequest as _SupportIntegrationCreateRequest,
  SupportIntegrationCreateResponse as _SupportIntegrationCreateResponse,
  SupportIntegrationDeleteResponse as _SupportIntegrationDeleteResponse,
  SupportIntegrationUpdateRequest as _SupportIntegrationUpdateRequest,
  SupportIntegrationUpdateResponse as _SupportIntegrationUpdateResponse,
} from '@chatbotkit/sdk/integration/support/v1'
import type {
  TelegramIntegrationCreateRequest as _TelegramIntegrationCreateRequest,
  TelegramIntegrationCreateResponse as _TelegramIntegrationCreateResponse,
  TelegramIntegrationDeleteResponse as _TelegramIntegrationDeleteResponse,
  TelegramIntegrationUpdateRequest as _TelegramIntegrationUpdateRequest,
  TelegramIntegrationUpdateResponse as _TelegramIntegrationUpdateResponse,
} from '@chatbotkit/sdk/integration/telegram/v1'
import type {
  TriggerIntegrationCreateRequest as _TriggerIntegrationCreateRequest,
  TriggerIntegrationCreateResponse as _TriggerIntegrationCreateResponse,
  TriggerIntegrationDeleteResponse as _TriggerIntegrationDeleteResponse,
  TriggerIntegrationUpdateRequest as _TriggerIntegrationUpdateRequest,
  TriggerIntegrationUpdateResponse as _TriggerIntegrationUpdateResponse,
} from '@chatbotkit/sdk/integration/trigger/v1'
import type {
  TwilioIntegrationCreateRequest as _TwilioIntegrationCreateRequest,
  TwilioIntegrationCreateResponse as _TwilioIntegrationCreateResponse,
  TwilioIntegrationDeleteResponse as _TwilioIntegrationDeleteResponse,
  TwilioIntegrationUpdateRequest as _TwilioIntegrationUpdateRequest,
  TwilioIntegrationUpdateResponse as _TwilioIntegrationUpdateResponse,
} from '@chatbotkit/sdk/integration/twilio/v1'
import type {
  WhatsAppIntegrationCreateRequest as _WhatsAppIntegrationCreateRequest,
  WhatsAppIntegrationCreateResponse as _WhatsAppIntegrationCreateResponse,
  WhatsAppIntegrationDeleteResponse as _WhatsAppIntegrationDeleteResponse,
  WhatsAppIntegrationUpdateRequest as _WhatsAppIntegrationUpdateRequest,
  WhatsAppIntegrationUpdateResponse as _WhatsAppIntegrationUpdateResponse,
} from '@chatbotkit/sdk/integration/whatsapp/v1'
import type {
  WidgetIntegrationCreateRequest as _WidgetIntegrationCreateRequest,
  WidgetIntegrationCreateResponse as _WidgetIntegrationCreateResponse,
  WidgetIntegrationDeleteResponse as _WidgetIntegrationDeleteResponse,
  WidgetIntegrationUpdateRequest as _WidgetIntegrationUpdateRequest,
  WidgetIntegrationUpdateResponse as _WidgetIntegrationUpdateResponse,
} from '@chatbotkit/sdk/integration/widget/v1'
import type {
  PlatformAbilityListItem as _PlatformAbilityListItem,
  PlatformAbilitySearchResponse as _PlatformAbilitySearchResponse,
} from '@chatbotkit/sdk/platform/ability/v1'
import type { PlatformActionListItem as _PlatformActionListItem } from '@chatbotkit/sdk/platform/action/v1'
import type { PlatformExampleListItem as _PlatformExampleListItem } from '@chatbotkit/sdk/platform/example/v1'
import type { PlatformModelListItem as _PlatformModelListItem } from '@chatbotkit/sdk/platform/model/v1'
import type { PlatformReportListItem as _PlatformReportListItem } from '@chatbotkit/sdk/platform/report/v1'
import type {
  PlatformSecretListItem as _PlatformSecretListItem,
  PlatformSecretSearchResponse as _PlatformSecretSearchResponse,
} from '@chatbotkit/sdk/platform/secret/v1'
import type {
  PolicyCreateRequest as _PolicyCreateRequest,
  PolicyCreateResponse as _PolicyCreateResponse,
  PolicyDeleteResponse as _PolicyDeleteResponse,
  PolicyUpdateRequest as _PolicyUpdateRequest,
  PolicyUpdateResponse as _PolicyUpdateResponse,
} from '@chatbotkit/sdk/policy/v1'
import type {
  PortalCreateRequest as _PortalCreateRequest,
  PortalCreateResponse as _PortalCreateResponse,
  PortalDeleteResponse as _PortalDeleteResponse,
  PortalUpdateRequest as _PortalUpdateRequest,
  PortalUpdateResponse as _PortalUpdateResponse,
} from '@chatbotkit/sdk/portal/v1'
import type {
  SecretCreateRequest as _SecretCreateRequest,
  SecretCreateResponse as _SecretCreateResponse,
  SecretDeleteResponse as _SecretDeleteResponse,
  SecretRevokeResponse as _SecretRevokeResponse,
  SecretUpdateRequest as _SecretUpdateRequest,
  SecretUpdateResponse as _SecretUpdateResponse,
} from '@chatbotkit/sdk/secret/v1'
import type {
  SkillsetAbilityCreateRequest as _SkillsetAbilityCreateRequest,
  SkillsetAbilityCreateResponse as _SkillsetAbilityCreateResponse,
  SkillsetAbilityDeleteResponse as _SkillsetAbilityDeleteResponse,
  SkillsetAbilityUpdateRequest as _SkillsetAbilityUpdateRequest,
  SkillsetAbilityUpdateResponse as _SkillsetAbilityUpdateResponse,
} from '@chatbotkit/sdk/skillset/ability/v1'
import type {
  SkillsetCreateRequest as _SkillsetCreateRequest,
  SkillsetCreateResponse as _SkillsetCreateResponse,
  SkillsetDeleteResponse as _SkillsetDeleteResponse,
  SkillsetUpdateRequest as _SkillsetUpdateRequest,
  SkillsetUpdateResponse as _SkillsetUpdateResponse,
} from '@chatbotkit/sdk/skillset/v1'
import type {
  SpaceSiteCreateRequest as _SpaceSiteCreateRequest,
  SpaceSiteCreateResponse as _SpaceSiteCreateResponse,
  SpaceSiteDeleteResponse as _SpaceSiteDeleteResponse,
  SpaceSiteUpdateRequest as _SpaceSiteUpdateRequest,
  SpaceSiteUpdateResponse as _SpaceSiteUpdateResponse,
} from '@chatbotkit/sdk/space/site/v1'
import type {
  SpaceCreateRequest as _SpaceCreateRequest,
  SpaceCreateResponse as _SpaceCreateResponse,
  SpaceDeleteResponse as _SpaceDeleteResponse,
  SpaceUpdateRequest as _SpaceUpdateRequest,
  SpaceUpdateResponse as _SpaceUpdateResponse,
} from '@chatbotkit/sdk/space/v1'
import type {
  TaskCreateRequest as _TaskCreateRequest,
  TaskCreateResponse as _TaskCreateResponse,
  TaskDeleteResponse as _TaskDeleteResponse,
  TaskUpdateRequest as _TaskUpdateRequest,
  TaskUpdateResponse as _TaskUpdateResponse,
} from '@chatbotkit/sdk/task/v1'
import SchemaBuilder from '@pothos/core'
import PrismaPlugin from '@pothos/plugin-prisma'
import RelayPlugin from '@pothos/plugin-relay'
import { resolveArrayConnection } from '@pothos/plugin-relay'
import SimpleObjectsPlugin from '@pothos/plugin-simple-objects'

import { GraphQLDateTime } from 'graphql-scalars'
import { GraphQLJSONObject } from 'graphql-type-json'

export interface Context {
  session: Session // @note the current user session

  caller: string | null // @note the caller identifier from request headers
}

type JsonValue = Record<string, unknown>

// ---

// @note the ability update route accepts `null` for the alias (clears it) and
// for the blueprint and linked-resource links
const ABILITY_CLEARABLE_KEYS = [
  'alias',
  'blueprintId',
  'linkedSecretId',
  'linkedFileId',
  'linkedBotId',
  'linkedSpaceId',
]

// @note the Meta (WhatsApp, Messenger, Instagram) integration update routes
// accept `null` for the alias (clears it) and for the credentials
const META_INTEGRATION_CLEARABLE_KEYS = ['alias', 'accessToken', 'appSecret']

const builder = new SchemaBuilder<{
  Context: Context
  PrismaTypes: PrismaTypes
  Scalars: {
    JsonObject: { Input: JsonValue; Output: JsonValue }
    DateTime: { Input: Date; Output: Date | string }
  }
}>({
  plugins: [SimpleObjectsPlugin, RelayPlugin, PrismaPlugin],

  relay: {
    cursorType: 'ID',
  },

  prisma: {
    client: prisma,
    dmmf: getDatamodel(),
  },
})

builder.addScalarType('JsonObject', GraphQLJSONObject, {})

builder.addScalarType('DateTime', GraphQLDateTime, {})

const Meta = 'JsonObject' as const

const ListOrder = builder.enumType('ListOrder', {
  values: ['asc', 'desc'] as const,
  description: 'The order of items in a paginated list',
})

const RatingSentiment = builder.enumType('RatingSentiment', {
  values: ['upvote', 'downvote'] as const,
  description:
    'The sentiment of a rating: upvote (value >= 0) or downvote (value < 0)',
})

/**
 * Standard creation-time ordering for cursor-paginated lists. The id
 * tiebreaker is required for stable cursor pagination: Prisma cursors
 * misbehave when the sort key is not unique and createdAt values collide.
 */
function orderByCreation(order?: 'asc' | 'desc' | null): {
  createdAt?: 'asc' | 'desc'
  id?: 'asc' | 'desc'
}[] {
  const direction = order || 'desc'

  return [{ createdAt: direction }, { id: direction }]
}

const TaskStatus = builder.enumType('TaskStatus', {
  values: Object.values(_TaskStatus),
  description: 'Status of task execution',
})

const TaskOutcome = builder.enumType('TaskOutcome', {
  values: Object.values(_TaskOutcome),
  description: 'Outcome of task execution',
})

const BotVisibility = builder.enumType('BotVisibility', {
  values: Object.values(_BotVisibility),
  description: 'Visibility options for bots',
})

const DatasetVisibility = builder.enumType('DatasetVisibility', {
  values: Object.values(_DatasetVisibility),
  description: 'Visibility options for datasets',
})

const SkillsetVisibility = builder.enumType('SkillsetVisibility', {
  values: Object.values(_SkillsetVisibility),
  description: 'Visibility options for skillsets',
})

const ResourceState = builder.enumType('ResourceState', {
  values: Object.values(_ResourceState),
  description:
    'Lifecycle state for resources that can be toggled on/off without deletion',
})

const FileVisibility = builder.enumType('FileVisibility', {
  values: Object.values(_FileVisibility),
  description: 'Visibility options for files',
})

const SecretVisibility = builder.enumType('SecretVisibility', {
  values: Object.values(_SecretVisibility),
  description: 'Visibility options for secrets',
})

const BlueprintVisibility = builder.enumType('BlueprintVisibility', {
  values: Object.values(_BlueprintVisibility),
  description: 'Visibility options for blueprints',
})

const SecretType = builder.enumType('SecretType', {
  values: Object.values(_SecretType),
  description: 'Types of secrets that can be used in the system',
})

const SecretKind = builder.enumType('SecretKind', {
  values: Object.values(_SecretKind),
  description: 'Kinds of secrets that can be used in the system',
})

const MessageType = builder.enumType('MessageType', {
  values: Object.values(_MessageType),
  description: 'Types of messages in a conversation',
})

const Schedule = builder.enumType('Schedule', {
  values: Object.values(_Schedule),
  description: 'Schedule options for trigger integrations',
})

const User = builder.prismaObject('User', {
  fields: (t) => ({
    // properties
    id: t.exposeID('id', {
      description: 'The unique identifier of the user',
      nullable: true,
    }),
    name: t.exposeString('name', {
      description: 'The name of the user',
      nullable: true,
    }),
    description: t.exposeString('description', {
      description: 'The description of the user',
      nullable: true,
    }),
    goal: t.exposeString('goal', {
      description: 'The goal of the user',
      nullable: true,
    }),
    image: t.exposeString('image', {
      description: 'The image of the user',
      nullable: true,
    }),
    email: t.field({
      type: 'String',
      description: 'The email of the user',
      nullable: true,
      select: {
        email: true,
        parentId: true,
        parentContextEmail: true,
      },
      resolve: (user) => (user.parentId ? user.parentContextEmail : user.email),
    }),
    usage: t.field({
      type: 'JsonObject',
      description: 'The current usage of the user',
      nullable: true,
      resolve: async (user) => {
        try {
          // @note imported lazily - the usage module drags in the model
          // utilities, which the schema codegen cannot load
          const { getUsage } = await import('@/lib/usage.get')

          return await getUsage(user.id)
        } catch {
          // @note usage is decorative - the list should not fail with the
          // usage store
          return null
        }
      },
    }),
    meta: t.expose('meta', {
      type: 'JsonObject',
      description: 'The metadata associated with the user',
      nullable: true,
    }),
    createdAt: t.expose('createdAt', {
      type: 'DateTime',
      description: 'The date and time when the user was created',
      nullable: true,
    }),
    updatedAt: t.expose('updatedAt', {
      type: 'DateTime',
      description: 'The date and time when the user was last updated',
      nullable: true,
    }),
  }),
})

const Contact = builder.prismaObject('Contact', {
  fields: (t) => ({
    // properties
    id: t.exposeID('id', {
      description: 'The unique identifier of the contact',
      nullable: true,
    }),
    name: t.exposeString('name', {
      description: 'The name of the contact',
      nullable: true,
    }),
    description: t.exposeString('description', {
      description: 'The description of the contact',
      nullable: true,
    }),
    fingerprint: t.exposeString('fingerprint', {
      description: 'The fingerprint of the contact',
      nullable: true,
    }),
    email: t.exposeString('email', {
      description: 'The email of the contact',
      nullable: true,
    }),
    phone: t.exposeString('phone', {
      description: 'The phone number of the contact',
      nullable: true,
    }),
    nick: t.exposeString('nick', {
      description: 'The nickname of the contact',
      nullable: true,
    }),
    verifiedAt: t.expose('verifiedAt', {
      type: 'DateTime',
      description: 'The date and time when the contact was verified',
      nullable: true,
    }),
    meta: t.expose('meta', {
      type: 'JsonObject',
      description: 'The metadata associated with the contact',
      nullable: true,
    }),
    // analytics
    createdAt: t.expose('createdAt', {
      type: 'DateTime',
      description: 'The date and time when the contact was created',
      nullable: true,
    }),
    updatedAt: t.expose('updatedAt', {
      type: 'DateTime',
      description: 'The date and time when the contact was last updated',
      nullable: true,
    }),
    // relations
    tasks: t.relatedConnection('tasks', {
      description: 'The tasks associated with the contact',
      cursor: 'id',
      query: { orderBy: { createdAt: 'desc' } },
    }),
    conversations: t.relatedConnection('conversations', {
      description: 'The conversations associated with the contact',
      cursor: 'id',
      query: { orderBy: { createdAt: 'desc' } },
    }),
    ratings: t.relatedConnection('ratings', {
      description: 'The ratings associated with the contact',
      cursor: 'id',
      query: { orderBy: { createdAt: 'desc' } },
    }),
    memories: t.relatedConnection('memories', {
      description: 'The memories associated with the contact',
      cursor: 'id',
      query: { orderBy: { createdAt: 'desc' } },
    }),
    spaces: t.relatedConnection('spaces', {
      description: 'The spaces associated with the contact',
      cursor: 'id',
      query: { orderBy: { createdAt: 'desc' } },
    }),
  }),
})

const TaskExecution = builder.prismaObject('TaskExecution', {
  fields: (t) => ({
    // properties
    id: t.exposeID('id', {
      description: 'The unique identifier of the task execution',
      nullable: true,
    }),
    name: t.exposeString('name', {
      description: 'The name of the task execution',
      nullable: true,
    }),
    description: t.exposeString('description', {
      description: 'The description of the task execution',
      nullable: true,
    }),
    status: t.expose('status', {
      type: TaskStatus,
      description: 'The status of the task execution',
      nullable: true,
    }),
    outcome: t.expose('outcome', {
      type: TaskOutcome,
      description: 'The outcome of the task execution',
      nullable: true,
    }),
    summary: t.exposeString('summary', {
      description: 'The summary of the task execution',
      nullable: true,
    }),
    meta: t.expose('meta', {
      type: 'JsonObject',
      description: 'The metadata associated with the task execution',
      nullable: true,
    }),
    // analytics
    completedAt: t.expose('completedAt', {
      type: 'DateTime',
      description: 'The date and time when the task execution completed',
      nullable: true,
    }),
    createdAt: t.expose('createdAt', {
      type: 'DateTime',
      description: 'The date and time when the task execution was created',
      nullable: true,
    }),
    updatedAt: t.expose('updatedAt', {
      type: 'DateTime',
      description: 'The date and time when the task execution was last updated',
      nullable: true,
    }),
    // relations
    task: t.relation('task', {
      description: 'The task associated with this execution',
      nullable: true,
    }),
    conversation: t.relation('conversation', {
      description: 'The conversation associated with this execution',
      nullable: true,
    }),
  }),
})

const Task = builder.prismaObject('Task', {
  fields: (t) => ({
    // properties
    id: t.exposeID('id', {
      description: 'The unique identifier of the task',
      nullable: true,
    }),
    name: t.exposeString('name', {
      description: 'The name of the task',
      nullable: true,
    }),
    description: t.exposeString('description', {
      description: 'The description of the task',
      nullable: true,
    }),
    sessionDuration: t.exposeFloat('sessionDuration', {
      description: 'The session duration for the task',
      nullable: true,
    }),
    schedule: t.exposeString('schedule', {
      description: 'The schedule for the task',
      nullable: true,
    }),
    timezone: t.exposeString('timezone', {
      description: 'The IANA timezone the schedule is evaluated in',
      nullable: true,
    }),
    maxIterations: t.exposeInt('maxIterations', {
      description: 'The maximum reasoning iterations per execution',
      nullable: true,
    }),
    maxTime: t.exposeFloat('maxTime', {
      description: 'The maximum wall-clock time per execution in milliseconds',
      nullable: true,
    }),
    maxCalls: t.exposeInt('maxCalls', {
      description: 'The maximum tool calls across the whole task run',
      nullable: true,
    }),
    nextRunAt: t.expose('nextRunAt', {
      type: 'DateTime',
      description: 'The next scheduled run time for the task',
      nullable: true,
    }),
    lastRunAt: t.expose('lastRunAt', {
      type: 'DateTime',
      description: 'The last run time for the task',
      nullable: true,
    }),
    expiresAt: t.expose('expiresAt', {
      type: 'DateTime',
      description: 'The date and time when the task expires',
      nullable: true,
    }),
    blueprintId: t.exposeString('blueprintId', {
      description: 'The ID of the blueprint the task belongs to',
      nullable: true,
    }),
    botId: t.exposeString('botId', {
      description: 'The ID of the bot the task runs',
      nullable: true,
    }),
    contactId: t.exposeString('contactId', {
      description: 'The ID of the contact the task is scoped to',
      nullable: true,
    }),
    status: t.expose('status', {
      type: TaskStatus,
      description: 'The status of the task',
      nullable: true,
    }),
    outcome: t.expose('outcome', {
      type: TaskOutcome,
      description: 'The outcome of the task',
      nullable: true,
    }),
    meta: t.expose('meta', {
      type: 'JsonObject',
      description: 'The metadata associated with the task',
      nullable: true,
    }),
    // analytics
    createdAt: t.expose('createdAt', {
      type: 'DateTime',
      description: 'The date and time when the task was created',
      nullable: true,
    }),
    updatedAt: t.expose('updatedAt', {
      type: 'DateTime',
      description: 'The date and time when the task was last updated',
      nullable: true,
    }),
    // relations
    bot: t.relation('bot', {
      description: 'The bot associated with the task',
      nullable: true,
    }),
    contact: t.relation('contact', {
      description: 'The contact associated with the task',
      nullable: true,
    }),
    conversations: t.relatedConnection('conversations', {
      description: 'The conversations associated with the task',
      cursor: 'id',
      query: { orderBy: { createdAt: 'desc' } },
    }),
    executions: t.relatedConnection('taskExecutions', {
      description: 'The executions associated with the task',
      cursor: 'id',
      query: { orderBy: { createdAt: 'desc' } },
    }),
  }),
})

const Conversation = builder.prismaObject('Conversation', {
  fields: (t) => ({
    // properties
    id: t.exposeID('id', {
      description: 'The unique identifier of the conversation',
      nullable: true,
    }),
    name: t.exposeString('name', {
      description: 'The name of the conversation',
      nullable: true,
    }),
    description: t.exposeString('description', {
      description: 'The description of the conversation',
      nullable: true,
    }),
    expiresAt: t.expose('expiresAt', {
      type: 'DateTime',
      description: 'The date and time when the conversation expires',
      nullable: true,
    }),
    meta: t.expose('meta', {
      type: 'JsonObject',
      description: 'The metadata associated with the conversation',
      nullable: true,
    }),
    // analytics
    createdAt: t.expose('createdAt', {
      type: 'DateTime',
      description: 'The date and time when the conversation was created',
      nullable: true,
    }),
    updatedAt: t.expose('updatedAt', {
      type: 'DateTime',
      description: 'The date and time when the conversation was last updated',
      nullable: true,
    }),
    // relations
    contact: t.relation('contact', {
      description: 'The contact associated with the conversation',
      nullable: true,
    }),
    task: t.relation('task', {
      description: 'The task associated with the conversation',
      nullable: true,
    }),
    space: t.relation('space', {
      description: 'The space associated with the conversation',
      nullable: true,
    }),
    ratings: t.relatedConnection('ratings', {
      description: 'The ratings associated with the conversation',
      cursor: 'id',
      query: { orderBy: { createdAt: 'desc' } },
    }),
    messages: t.relatedConnection('messages', {
      description: 'The messages in the conversation',
      cursor: 'id',
      query: { orderBy: { createdAt: 'desc' } },
    }),
    bot: t.relation('bot', {
      description: 'The bot associated with the conversation',
      nullable: true,
    }),
  }),
})

const Rating = builder.prismaObject('Rating', {
  fields: (t) => ({
    // properties
    id: t.exposeID('id', {
      description: 'The unique identifier of the rating',
      nullable: true,
    }),
    name: t.exposeString('name', {
      description: 'The name of the rating',
      nullable: true,
    }),
    description: t.exposeString('description', {
      description: 'The description of the rating',
      nullable: true,
    }),
    value: t.exposeInt('value', {
      description: 'The rating value',
      nullable: true,
    }),
    reason: t.exposeString('reason', {
      description: 'The reason for the rating',
      nullable: true,
    }),
    meta: t.expose('meta', {
      type: 'JsonObject',
      description: 'The metadata associated with the rating',
      nullable: true,
    }),
    // analytics
    createdAt: t.expose('createdAt', {
      type: 'DateTime',
      description: 'The date and time when the rating was created',
      nullable: true,
    }),
    updatedAt: t.expose('updatedAt', {
      type: 'DateTime',
      description: 'The date and time when the rating was last updated',
      nullable: true,
    }),
    // relations
    contact: t.relation('contact', {
      description: 'The contact associated with the rating',
      nullable: true,
    }),
    conversation: t.relation('conversation', {
      description: 'The conversation associated with the rating',
      nullable: true,
    }),
    message: t.relation('message', {
      description: 'The message associated with the rating',
      nullable: true,
    }),
    bot: t.relation('bot', {
      description: 'The bot associated with the rating',
      nullable: true,
    }),
  }),
})

const Memory = builder.prismaObject('Memory', {
  fields: (t) => ({
    // properties
    id: t.exposeID('id', {
      description: 'The unique identifier of the memory',
      nullable: true,
    }),
    name: t.exposeString('name', {
      description: 'The name of the memory',
      nullable: true,
    }),
    description: t.exposeString('description', {
      description: 'The description of the memory',
      nullable: true,
    }),
    text: t.exposeString('text', {
      description: 'The text content of the memory',
      nullable: true,
    }),
    contactId: t.exposeString('contactId', {
      description: 'The ID of the contact the memory is scoped to',
      nullable: true,
    }),
    botId: t.exposeString('botId', {
      description: 'The ID of the bot the memory is scoped to',
      nullable: true,
    }),
    expiresAt: t.expose('expiresAt', {
      type: 'DateTime',
      description: 'The date and time when the memory expires',
      nullable: true,
    }),
    meta: t.expose('meta', {
      type: 'JsonObject',
      description: 'The metadata associated with the memory',
      nullable: true,
    }),
    // analytics
    createdAt: t.expose('createdAt', {
      type: 'DateTime',
      description: 'The date and time when the memory was created',
      nullable: true,
    }),
    updatedAt: t.expose('updatedAt', {
      type: 'DateTime',
      description: 'The date and time when the memory was last updated',
      nullable: true,
    }),
    // relations
    user: t.relation('user', {
      description: 'The user associated with the memory',
      nullable: true,
    }),
  }),
})

const Space = builder.prismaObject('Space', {
  fields: (t) => ({
    // properties
    id: t.exposeID('id', {
      description: 'The unique identifier of the space',
      nullable: true,
    }),
    alias: t.exposeString('alias', {
      description: 'The alias ID for the space',
      nullable: true,
    }),
    blueprintId: t.exposeString('blueprintId', {
      description: 'The ID of the blueprint associated with the space',
      nullable: true,
    }),
    contactId: t.exposeString('contactId', {
      description: 'The ID of the contact associated with the space',
      nullable: true,
    }),
    name: t.exposeString('name', {
      description: 'The name of the space',
      nullable: true,
    }),
    description: t.exposeString('description', {
      description: 'The description of the space',
      nullable: true,
    }),
    meta: t.expose('meta', {
      type: 'JsonObject',
      description: 'The metadata associated with the space',
      nullable: true,
    }),
    // analytics
    createdAt: t.expose('createdAt', {
      type: 'DateTime',
      description: 'The date and time when the space was created',
      nullable: true,
    }),
    updatedAt: t.expose('updatedAt', {
      type: 'DateTime',
      description: 'The date and time when the space was last updated',
      nullable: true,
    }),
    // relations
    user: t.relation('user', {
      description: 'The user associated with the space',
      nullable: true,
    }),
    blueprint: t.relation('blueprint', {
      description: 'The blueprint associated with the space',
      nullable: true,
    }),
    contact: t.relation('contact', {
      description: 'The contact associated with the space',
      nullable: true,
    }),
    conversations: t.relatedConnection('conversations', {
      description: 'The conversations associated with the space',
      cursor: 'id',
      query: { orderBy: { createdAt: 'desc' } },
    }),
    sites: t.relatedConnection('sites', {
      description: 'The sites associated with the space',
      cursor: 'id',
      query: { orderBy: { createdAt: 'desc' } },
    }),
  }),
})

const SpaceSite = builder.prismaObject('SpaceSite', {
  fields: (t) => ({
    // properties
    id: t.exposeID('id', {
      description: 'The unique identifier of the space site',
      nullable: true,
    }),
    alias: t.exposeString('alias', {
      description: 'The alias ID for the space site',
      nullable: true,
    }),
    name: t.exposeString('name', {
      description: 'The name of the space site',
      nullable: true,
    }),
    description: t.exposeString('description', {
      description: 'The description of the space site',
      nullable: true,
    }),
    slug: t.exposeString('slug', {
      description: 'The subdomain slug beneath the configured space apex',
      nullable: true,
    }),
    prefix: t.exposeString('prefix', {
      description: 'The optional folder prefix inside the space to serve from',
      nullable: true,
    }),
    index: t.exposeString('index', {
      description: 'The directory index filename',
      nullable: true,
    }),
    notFound: t.exposeString('notFound', {
      description: 'The not found filename',
      nullable: true,
    }),
    meta: t.expose('meta', {
      type: 'JsonObject',
      description: 'The metadata associated with the space site',
      nullable: true,
    }),
    // analytics
    createdAt: t.expose('createdAt', {
      type: 'DateTime',
      description: 'The date and time when the space site was created',
      nullable: true,
    }),
    updatedAt: t.expose('updatedAt', {
      type: 'DateTime',
      description: 'The date and time when the space site was last updated',
      nullable: true,
    }),
    // relations
    space: t.relation('space', {
      description: 'The space associated with the site',
      nullable: true,
    }),
  }),
})

const Message = builder.prismaObject('Message', {
  fields: (t) => ({
    // properties
    id: t.exposeID('id', {
      description: 'The unique identifier of the message',
      nullable: true,
    }),
    name: t.exposeString('name', {
      description: 'The name of the message',
      nullable: true,
    }),
    description: t.exposeString('description', {
      description: 'The description of the message',
      nullable: true,
    }),
    type: t.expose('type', {
      type: MessageType,
      description: 'The type of the message',
      nullable: true,
    }),
    text: t.exposeString('text', {
      description: 'The text content of the message',
      nullable: true,
    }),
    meta: t.expose('meta', {
      type: 'JsonObject',
      description: 'The metadata associated with the message',
      nullable: true,
    }),
    // analytics
    createdAt: t.expose('createdAt', {
      type: 'DateTime',
      description: 'The date and time when the message was created',
      nullable: true,
    }),
    updatedAt: t.expose('updatedAt', {
      type: 'DateTime',
      description: 'The date and time when the message was last updated',
      nullable: true,
    }),
    // relations
    conversation: t.relation('conversation', {
      description: 'The conversation this message belongs to',
      nullable: false,
    }),
    ratings: t.relatedConnection('ratings', {
      description: 'The ratings associated with the message',
      cursor: 'id',
      query: { orderBy: { createdAt: 'desc' } },
    }),
  }),
})

const Blueprint = builder.prismaObject('Blueprint', {
  fields: (t) => ({
    // properties
    id: t.exposeID('id', {
      description: 'The unique identifier of the blueprint',
      nullable: true,
    }),
    name: t.exposeString('name', {
      description: 'The name of the blueprint',
      nullable: true,
    }),
    description: t.exposeString('description', {
      description: 'The description of the blueprint',
      nullable: true,
    }),
    visibility: t.expose('visibility', {
      type: BlueprintVisibility,
      description: 'The visibility setting of the blueprint',
      nullable: true,
    }),
    meta: t.expose('meta', {
      type: 'JsonObject',
      description: 'The metadata associated with the blueprint',
      nullable: true,
    }),
    // analytics
    createdAt: t.expose('createdAt', {
      type: 'DateTime',
      description: 'The date and time when the blueprint was created',
      nullable: true,
    }),
    updatedAt: t.expose('updatedAt', {
      type: 'DateTime',
      description: 'The date and time when the blueprint was last updated',
      nullable: true,
    }),
    // relations
    bots: t.relatedConnection('bots', {
      description: 'The bots associated with the blueprint',
      cursor: 'id',
      query: { orderBy: { createdAt: 'desc' } },
    }),
    datasets: t.relatedConnection('datasets', {
      description: 'The datasets associated with the blueprint',
      cursor: 'id',
      query: { orderBy: { createdAt: 'desc' } },
    }),
    skillsets: t.relatedConnection('skillsets', {
      description: 'The skillsets associated with the blueprint',
      cursor: 'id',
      query: { orderBy: { createdAt: 'desc' } },
    }),
    abilities: t.relatedConnection('abilities', {
      description: 'The abilities associated with the blueprint',
      cursor: 'id',
      query: { orderBy: { createdAt: 'desc' } },
    }),
    secrets: t.relatedConnection('secrets', {
      description: 'The secrets associated with the blueprint',
      cursor: 'id',
      query: { orderBy: { createdAt: 'desc' } },
    }),
    files: t.relatedConnection('files', {
      description: 'The files associated with the blueprint',
      cursor: 'id',
      query: { orderBy: { createdAt: 'desc' } },
    }),
    portals: t.relatedConnection('portals', {
      description: 'The portals associated with the blueprint',
      cursor: 'id',
      query: { orderBy: { createdAt: 'desc' } },
    }),
    spaces: t.relatedConnection('spaces', {
      description: 'The spaces associated with the blueprint',
      cursor: 'id',
      query: { orderBy: { createdAt: 'desc' } },
    }),
    tasks: t.relatedConnection('tasks', {
      description: 'The tasks associated with the blueprint',
      cursor: 'id',
      query: { orderBy: { createdAt: 'desc' } },
    }),
  }),
})

const Bot = builder.prismaObject('Bot', {
  fields: (t) => ({
    // properties
    id: t.exposeID('id', {
      description: 'The unique identifier of the bot',
      nullable: true,
    }),
    name: t.exposeString('name', {
      description: 'The name of the bot',
      nullable: true,
    }),
    description: t.exposeString('description', {
      description: 'The description of the bot',
      nullable: true,
    }),
    backstory: t.exposeString('backstory', {
      description: 'The backstory of the bot',
      nullable: true,
    }),
    model: t.exposeString('model', {
      description: 'The model used by the bot',
      nullable: true,
    }),
    privacy: t.exposeBoolean('privacy', {
      description: 'The privacy setting of the bot',
      nullable: true,
    }),
    moderation: t.exposeBoolean('moderation', {
      description: 'The moderation setting of the bot',
      nullable: true,
    }),
    blueprintId: t.exposeString('blueprintId', {
      description: 'The ID of the blueprint associated with the bot',
      nullable: true,
    }),
    datasetId: t.exposeString('datasetId', {
      description: 'The ID of the dataset associated with the bot',
      nullable: true,
    }),
    skillsetId: t.exposeString('skillsetId', {
      description: 'The ID of the skillset associated with the bot',
      nullable: true,
    }),
    meta: t.expose('meta', {
      type: 'JsonObject',
      description: 'The metadata associated with the bot',
      nullable: true,
    }),
    // analytics
    createdAt: t.expose('createdAt', {
      type: 'DateTime',
      description: 'The date and time when the bot was created',
      nullable: true,
    }),
    updatedAt: t.expose('updatedAt', {
      type: 'DateTime',
      description: 'The date and time when the bot was last updated',
      nullable: true,
    }),
    // relations
    task: t.relatedConnection('tasks', {
      description: 'The tasks associated with the bot',
      cursor: 'id',
      query: { orderBy: { createdAt: 'desc' } },
    }),
    conversations: t.relatedConnection('conversations', {
      description: 'The conversations associated with the bot',
      cursor: 'id',
      query: { orderBy: { createdAt: 'desc' } },
    }),
    ratings: t.relatedConnection('ratings', {
      description: 'The ratings associated with the bot',
      cursor: 'id',
      query: { orderBy: { createdAt: 'desc' } },
    }),
    memories: t.relatedConnection('memories', {
      description: 'The memories associated with the bot',
      cursor: 'id',
      query: { orderBy: { createdAt: 'desc' } },
    }),
    blueprint: t.relation('blueprint', {
      description: 'The blueprint associated with the bot',
      nullable: true,
    }),
    dataset: t.relation('dataset', {
      description: 'The dataset associated with the bot',
      nullable: true,
    }),
    skillset: t.relation('skillset', {
      description: 'The skillset associated with the bot',
      nullable: true,
    }),
  }),
})

// @note record type removed - records are now stored in the vector service
// @todo add as a separate type
const Record = null

const Dataset = builder.prismaObject('Dataset', {
  fields: (t) => ({
    // properties
    id: t.exposeID('id', {
      description: 'The unique identifier of the dataset',
      nullable: true,
    }),
    name: t.exposeString('name', {
      description: 'The name of the dataset',
      nullable: true,
    }),
    description: t.exposeString('description', {
      description: 'The description of the dataset',
      nullable: true,
    }),
    blueprintId: t.exposeString('blueprintId', {
      description: 'The ID of the blueprint associated with the dataset',
      nullable: true,
    }),
    meta: t.expose('meta', {
      type: 'JsonObject',
      description: 'The metadata associated with the dataset',
      nullable: true,
    }),
    // analytics
    createdAt: t.expose('createdAt', {
      type: 'DateTime',
      description: 'The date and time when the dataset was created',
      nullable: true,
    }),
    updatedAt: t.expose('updatedAt', {
      type: 'DateTime',
      description: 'The date and time when the dataset was last updated',
      nullable: true,
    }),
    // relations
    blueprint: t.relation('blueprint', {
      description: 'The blueprint associated with the dataset',
      nullable: true,
    }),
    bots: t.relatedConnection('bots', {
      description: 'The bots associated with the dataset',
      cursor: 'id',
      query: { orderBy: { createdAt: 'desc' } },
    }),
    // @note records relation removed - records are now stored in the vector service
  }),
})

const Ability = builder.prismaObject('Ability', {
  fields: (t) => ({
    // properties
    id: t.exposeID('id', {
      description: 'The unique identifier of the ability',
      nullable: true,
    }),
    name: t.exposeString('name', {
      description: 'The name of the ability',
      nullable: true,
    }),
    description: t.exposeString('description', {
      description: 'The description of the ability',
      nullable: true,
    }),
    instruction: t.exposeString('instruction', {
      description: 'The instruction for the ability',
      nullable: true,
    }),
    state: t.expose('state', {
      type: ResourceState,
      description: 'The lifecycle state of the ability (enabled/disabled)',
      nullable: true,
    }),
    meta: t.expose('meta', {
      type: 'JsonObject',
      description: 'The metadata associated with the ability',
      nullable: true,
    }),
    // analytics
    createdAt: t.expose('createdAt', {
      type: 'DateTime',
      description: 'The date and time when the ability was created',
      nullable: true,
    }),
    updatedAt: t.expose('updatedAt', {
      type: 'DateTime',
      description: 'The date and time when the ability was last updated',
      nullable: true,
    }),
    // relations
    blueprint: t.relation('blueprint', {
      description: 'The blueprint associated with the ability',
      nullable: true,
    }),
    skillset: t.relation('skillset', {
      description: 'The skillset associated with the ability',
      nullable: true,
    }),
    linkedSecret: t.relation('linkedSecret', {
      description:
        'The secret the ability is linked to (the secret it acts with)',
      nullable: true,
    }),
    linkedFile: t.relation('linkedFile', {
      description: 'The file the ability is linked to (the file it acts on)',
      nullable: true,
    }),
    linkedBot: t.relation('linkedBot', {
      description: 'The bot the ability is linked to (the bot it acts on)',
      nullable: true,
    }),
    linkedSpace: t.relation('linkedSpace', {
      description: 'The space the ability is linked to (the space it acts on)',
      nullable: true,
    }),
  }),
})

const Skillset = builder.prismaObject('Skillset', {
  fields: (t) => ({
    // properties
    id: t.exposeID('id', {
      description: 'The unique identifier of the skillset',
      nullable: true,
    }),
    name: t.exposeString('name', {
      description: 'The name of the skillset',
      nullable: true,
    }),
    description: t.exposeString('description', {
      description: 'The description of the skillset',
      nullable: true,
    }),
    state: t.expose('state', {
      type: ResourceState,
      description: 'The lifecycle state of the skillset (enabled/disabled)',
      nullable: true,
    }),
    blueprintId: t.exposeString('blueprintId', {
      description: 'The ID of the blueprint associated with the skillset',
      nullable: true,
    }),
    meta: t.expose('meta', {
      type: 'JsonObject',
      description: 'The metadata associated with the skillset',
      nullable: true,
    }),
    // analytics
    createdAt: t.expose('createdAt', {
      type: 'DateTime',
      description: 'The date and time when the skillset was created',
      nullable: true,
    }),
    updatedAt: t.expose('updatedAt', {
      type: 'DateTime',
      description: 'The date and time when the skillset was last updated',
      nullable: true,
    }),
    // relations
    blueprint: t.relation('blueprint', {
      description: 'The blueprint associated with the skillset',
      nullable: true,
    }),
    bots: t.relatedConnection('bots', {
      description: 'The bots associated with the skillset',
      cursor: 'id',
      query: { orderBy: { createdAt: 'desc' } },
    }),
    abilities: t.relatedConnection('abilities', {
      description: 'The abilities associated with the skillset',
      cursor: 'id',
      query: { orderBy: { createdAt: 'desc' } },
    }),
  }),
})

const SecretContactVerificationStatus = builder.enumType(
  'SecretContactVerificationStatus',
  {
    values: ['unauthenticated', 'authenticated'],
    description: 'The status of the contact verification for the secret',
  }
)

const SecretContactVerificationActionType = builder.enumType(
  'SecretContactVerificationActionType',
  {
    values: ['authenticate'],
    description:
      'The type of action that can be performed for contact verification',
  }
)

const SecretContactVerificationAction = builder.simpleObject(
  'SecretContactVerificationAction',
  {
    fields: (t) => ({
      type: t.field({
        type: SecretContactVerificationActionType,
        description:
          'The type of action that can be performed for contact verification',
        nullable: false,
      }),
      url: t.field({
        type: 'String',
        description: 'The URL to perform the action for contact verification',
        nullable: true,
      }),
    }),
  }
)

const SecretContactVerification = builder.simpleObject(
  'SecretContactVerification',
  {
    fields: (t) => ({
      status: t.field({
        type: SecretContactVerificationStatus,
        description: 'The verification status of the contact for the secret',
        nullable: false,
      }),
      action: t.field({
        type: SecretContactVerificationAction,
        description: 'The actions available for the contact verification',
        nullable: true,
      }),
    }),
  }
)

const SecretContact = builder.simpleObject(
  'SecretContact',
  {
    fields: (t) => ({
      // properties
      id: t.string({
        description: 'The unique identifier of the contact',
        nullable: false,
      }),
      name: t.string({
        description: 'The name of the contact',
        nullable: true,
      }),
      email: t.string({
        description: 'The email of the contact',
        nullable: true,
      }),
      phone: t.string({
        description: 'The phone number of the contact',
        nullable: true,
      }),
      nick: t.string({
        description: 'The nickname of the contact',
        nullable: true,
      }),
      // custom
      secretId: t.field({
        type: 'ID',
        description:
          'The unique identifier of the secret associated with the contact',
        nullable: false,
      }),
    }),
  },
  (t) => ({
    // custom
    verification: t.field({
      type: SecretContactVerification,
      description: 'The verification status of the contact for the secret',
      nullable: false,
      resolve: async (root, _args, context) => {
        const userClient = await getSessionClient(context.session)

        const verification = await userClient.contact.secret.verify(
          root.id,
          String(root.secretId)
        )

        return verification
      },
    }),
  })
)

const SecretVerificationStatus = builder.enumType('SecretVerificationStatus', {
  values: ['unauthenticated', 'authenticated'],
  description: 'The status of the verification for the secret',
})

const SecretVerificationActionType = builder.enumType(
  'SecretVerificationActionType',
  {
    values: ['authenticate'],
    description: 'The type of action that can be performed for verification',
  }
)

const SecretVerificationAction = builder.simpleObject(
  'SecretVerificationAction',
  {
    fields: (t) => ({
      type: t.field({
        type: SecretVerificationActionType,
        description:
          'The type of action that can be performed for verification',
        nullable: false,
      }),
      url: t.field({
        type: 'String',
        description: 'The URL to perform the action for verification',
        nullable: true,
      }),
    }),
  }
)

const SecretVerification = builder.simpleObject('SecretVerification', {
  fields: (t) => ({
    status: t.field({
      type: SecretVerificationStatus,
      description: 'The verification status of the secret',
      nullable: false,
    }),
    action: t.field({
      type: SecretVerificationAction,
      description: 'The actions available for the verification',
      nullable: true,
    }),
  }),
})

// An integration verifies the same way a secret does. A cloned project carries
// neither secret values nor integration tokens - `blueprint.fields` strips both
// - so "does this need authenticating, and how do I authenticate it" is one
// question with one answer, and it gets one shape on the graph. The types below
// are the integration half of it, deliberately mirroring the secret half above.

const IntegrationVerificationStatus = builder.enumType(
  'IntegrationVerificationStatus',
  {
    values: ['unconfigured', 'configured'],
    description: 'The status of the verification for the integration',
  }
)

const IntegrationVerificationActionType = builder.enumType(
  'IntegrationVerificationActionType',
  {
    values: ['install'],
    description:
      'The type of action that can be performed for verification of the integration',
  }
)

const IntegrationVerificationAction = builder.simpleObject(
  'IntegrationVerificationAction',
  {
    fields: (t) => ({
      type: t.field({
        type: IntegrationVerificationActionType,
        description:
          'The type of action that can be performed for verification',
        nullable: false,
      }),
      url: t.field({
        type: 'String',
        description: 'The URL to perform the action for verification',
        nullable: true,
      }),
    }),
  }
)

const IntegrationVerification = builder.simpleObject(
  'IntegrationVerification',
  {
    fields: (t) => ({
      status: t.field({
        type: IntegrationVerificationStatus,
        description: 'The verification status of the integration',
        nullable: false,
      }),
      action: t.field({
        type: IntegrationVerificationAction,
        description: 'The actions available for the verification',
        nullable: true,
      }),
    }),
  }
)

/**
 * The `verification` field, defined once and spread onto every integration
 * that can carry traffic.
 *
 * A new integration gets this by adding its required credentials to
 * `INTEGRATION_CREDENTIALS` and calling this here - and if it registers the
 * credentials but forgets the field (or the reverse), `integration.verification.utest`
 * fails. The credentials themselves are read only to derive the status; they
 * never reach the graph.
 */
function integrationVerificationField<
  TField extends (...args: never[]) => unknown
>(t: { field: TField }, type: string): ReturnType<TField> {
  return t.field({
    type: IntegrationVerification,
    description:
      'Whether the integration holds every credential it needs to carry traffic, and how to install it if not',
    nullable: false,
    select: getIntegrationCredentialSelection(type),
    resolve: (integration: Record<string, unknown>) =>
      getIntegrationVerification(type, integration),
  } as never) as ReturnType<TField>
}

const Secret = builder.prismaObject('Secret', {
  fields: (t) => ({
    // properties
    id: t.exposeID('id', {
      description: 'The unique identifier of the secret',
      nullable: true,
    }),
    name: t.exposeString('name', {
      description: 'The name of the secret',
      nullable: true,
    }),
    description: t.exposeString('description', {
      description: 'The description of the secret',
      nullable: true,
    }),
    type: t.expose('type', {
      type: SecretType,
      description: 'The type of the secret',
      nullable: true,
    }),
    kind: t.expose('kind', {
      type: SecretKind,
      description: 'The kind of the secret',
      nullable: true,
    }),
    blueprintId: t.exposeString('blueprintId', {
      description: 'The ID of the blueprint associated with the secret',
      nullable: true,
    }),
    config: t.field({
      type: 'JsonObject',
      description:
        "The configuration of the secret (config.clientSecret is returned as '********' if configured, null otherwise)",
      nullable: true,
      select: {
        config: true,
      },
      // @note the same masking the REST fetch/list apply - see
      // lib/credential.policy.ts
      resolve: (secret) =>
        maskSecretConfig(secret.config as Record<string, unknown> | null),
    }),
    meta: t.expose('meta', {
      type: 'JsonObject',
      description: 'The metadata associated with the secret',
      nullable: true,
    }),
    // analytics
    createdAt: t.expose('createdAt', {
      type: 'DateTime',
      description: 'The date and time when the secret was created',
      nullable: true,
    }),
    updatedAt: t.expose('updatedAt', {
      type: 'DateTime',
      description: 'The date and time when the secret was last updated',
      nullable: true,
    }),
    // relations
    blueprint: t.relation('blueprint', {
      description: 'The blueprint associated with the secret',
      nullable: true,
    }),
    abilities: t.relatedConnection('abilities', {
      description: 'The abilities associated with the secret',
      cursor: 'id',
      query: { orderBy: { createdAt: 'desc' } },
    }),
    // custom
    contacts: t.field({
      type: [SecretContact],
      args: {
        contactIds: t.arg({
          type: ['ID'],
          required: false,
          description: 'Filter contacts by their unique identifiers',
        }),
      },
      description: 'The contacts associated with the secret',
      nullable: true,
      resolve: async (_root, args, context) => {
        const contacts = await prisma.contact.findMany({
          // @note no need to order by

          where: {
            ...(Array.isArray(args.contactIds)
              ? { id: { in: args.contactIds } }
              : {}),

            userId: context.session.user.id,
          },
        })

        return contacts.map((contact) => ({ ...contact, secretId: _root.id }))
      },
    }),
    verification: t.field({
      type: SecretVerification,
      description: 'The verification status of the secret',
      nullable: false,
      resolve: async (root, _args, context) => {
        const userClient = await getSessionClient(context.session)

        const verification = await userClient.secret.verify(root.id)

        return verification
      },
    }),
  }),
})

const File = builder.prismaObject('File', {
  fields: (t) => ({
    // properties
    id: t.exposeID('id', {
      description: 'The unique identifier of the file',
      nullable: true,
    }),
    name: t.exposeString('name', {
      description: 'The name of the file',
      nullable: true,
    }),
    description: t.exposeString('description', {
      description: 'The description of the file',
      nullable: true,
    }),
    blueprintId: t.exposeString('blueprintId', {
      description: 'The ID of the blueprint associated with the file',
      nullable: true,
    }),
    meta: t.expose('meta', {
      type: 'JsonObject',
      description: 'The metadata associated with the file',
      nullable: true,
    }),
    // analytics
    createdAt: t.expose('createdAt', {
      type: 'DateTime',
      description: 'The date and time when the file was created',
      nullable: true,
    }),
    updatedAt: t.expose('updatedAt', {
      type: 'DateTime',
      description: 'The date and time when the file was last updated',
      nullable: true,
    }),
    // relations
    blueprint: t.relation('blueprint', {
      description: 'The blueprint associated with the file',
      nullable: true,
    }),
  }),
})

const Portal = builder.prismaObject('Portal', {
  fields: (t) => ({
    // properties
    id: t.exposeID('id', {
      description: 'The unique identifier of the portal',
      nullable: true,
    }),
    name: t.exposeString('name', {
      description: 'The name of the portal',
      nullable: true,
    }),
    description: t.exposeString('description', {
      description: 'The description of the portal',
      nullable: true,
    }),
    slug: t.exposeString('slug', {
      description: 'The slug of the portal, used for URL routing',
      nullable: true,
    }),
    url: t.field({
      type: 'String',
      description:
        'The URL the portal is served at on this deployment, derived from its slug and the deployment portal topology',
      nullable: true,
      // @note not a stored property: where a portal is reachable is a fact
      // about the deployment (its portal apex or a configured custom
      // domain), so it is resolved here rather than persisted or guessed by
      // clients
      resolve: async (portal) =>
        portal.slug ? `https://${await getPortalFrontendHost(portal)}` : null,
    }),
    blueprintId: t.exposeString('blueprintId', {
      description: 'The ID of the blueprint associated with the portal',
      nullable: true,
    }),
    config: t.expose('config', {
      type: 'JsonObject',
      description: 'The configuration of the portal',
      nullable: true,
    }),
    meta: t.expose('meta', {
      type: 'JsonObject',
      description: 'The metadata associated with the portal',
      nullable: true,
    }),
    // analytics
    createdAt: t.expose('createdAt', {
      type: 'DateTime',
      description: 'The date and time when the portal was created',
      nullable: true,
    }),
    updatedAt: t.expose('updatedAt', {
      type: 'DateTime',
      description: 'The date and time when the portal was last updated',
      nullable: true,
    }),
    // relations
    blueprint: t.relation('blueprint', {
      description: 'The blueprint associated with the portal',
      nullable: true,
    }),
  }),
})

const EventLog = builder.prismaObject('EventLog', {
  fields: (t) => ({
    // properties
    id: t.exposeID('id', {
      description: 'The unique identifier of the event log',
      nullable: true,
    }),
    name: t.exposeString('name', {
      description: 'The name of the event log',
      nullable: true,
    }),
    description: t.exposeString('description', {
      description: 'The description of the event log',
      nullable: true,
    }),
    type: t.exposeString('type', {
      description: 'The type of the event',
      nullable: true,
    }),
    // relationships (shallow)
    conversationId: t.exposeString('conversationId', {
      description: 'The ID of the conversation associated with this event',
      nullable: true,
    }),
    taskId: t.exposeString('taskId', {
      description: 'The ID of the task associated with this event',
      nullable: true,
    }),
    contactId: t.exposeString('contactId', {
      description: 'The ID of the contact associated with this event',
      nullable: true,
    }),
    spaceId: t.exposeString('spaceId', {
      description: 'The ID of the space associated with this event',
      nullable: true,
    }),
    blueprintId: t.exposeString('blueprintId', {
      description: 'The ID of the blueprint associated with this event',
      nullable: true,
    }),
    botId: t.exposeString('botId', {
      description: 'The ID of the bot associated with this event',
      nullable: true,
    }),
    datasetId: t.exposeString('datasetId', {
      description: 'The ID of the dataset associated with this event',
      nullable: true,
    }),
    recordId: t.exposeString('recordId', {
      description: 'The ID of the record associated with this event',
      nullable: true,
    }),
    skillsetId: t.exposeString('skillsetId', {
      description: 'The ID of the skillset associated with this event',
      nullable: true,
    }),
    abilityId: t.exposeString('abilityId', {
      description: 'The ID of the ability associated with this event',
      nullable: true,
    }),
    fileId: t.exposeString('fileId', {
      description: 'The ID of the file associated with this event',
      nullable: true,
    }),
    secretId: t.exposeString('secretId', {
      description: 'The ID of the secret associated with this event',
      nullable: true,
    }),
    meta: t.expose('meta', {
      type: 'JsonObject',
      description: 'The metadata associated with the event log',
      nullable: true,
    }),
    // timestamps
    createdAt: t.expose('createdAt', {
      type: 'DateTime',
      description: 'The date and time when the event log was created',
      nullable: true,
    }),
    updatedAt: t.expose('updatedAt', {
      type: 'DateTime',
      description: 'The date and time when the event log was last updated',
      nullable: true,
    }),
  }),
})

const AuditLog = builder.prismaObject('AuditLog', {
  fields: (t) => ({
    // properties
    id: t.exposeID('id', {
      description: 'The unique identifier of the audit log',
      nullable: true,
    }),
    name: t.exposeString('name', {
      description: 'The name of the audit log',
      nullable: true,
    }),
    description: t.exposeString('description', {
      description: 'The description of the audit log',
      nullable: true,
    }),
    action: t.exposeString('action', {
      description: 'The action that was performed',
      nullable: true,
    }),
    // relationships (shallow)
    conversationId: t.exposeString('conversationId', {
      description: 'The ID of the conversation associated with this audit',
      nullable: true,
    }),
    taskId: t.exposeString('taskId', {
      description: 'The ID of the task associated with this audit',
      nullable: true,
    }),
    contactId: t.exposeString('contactId', {
      description: 'The ID of the contact associated with this audit',
      nullable: true,
    }),
    spaceId: t.exposeString('spaceId', {
      description: 'The ID of the space associated with this audit',
      nullable: true,
    }),
    blueprintId: t.exposeString('blueprintId', {
      description: 'The ID of the blueprint associated with this audit',
      nullable: true,
    }),
    botId: t.exposeString('botId', {
      description: 'The ID of the bot associated with this audit',
      nullable: true,
    }),
    datasetId: t.exposeString('datasetId', {
      description: 'The ID of the dataset associated with this audit',
      nullable: true,
    }),
    recordId: t.exposeString('recordId', {
      description: 'The ID of the record associated with this audit',
      nullable: true,
    }),
    skillsetId: t.exposeString('skillsetId', {
      description: 'The ID of the skillset associated with this audit',
      nullable: true,
    }),
    abilityId: t.exposeString('abilityId', {
      description: 'The ID of the ability associated with this audit',
      nullable: true,
    }),
    fileId: t.exposeString('fileId', {
      description: 'The ID of the file associated with this audit',
      nullable: true,
    }),
    secretId: t.exposeString('secretId', {
      description: 'The ID of the secret associated with this audit',
      nullable: true,
    }),
    portalId: t.exposeString('portalId', {
      description: 'The ID of the portal associated with this audit',
      nullable: true,
    }),
    policyId: t.exposeString('policyId', {
      description: 'The ID of the policy associated with this audit',
      nullable: true,
    }),
    webhookId: t.exposeString('webhookId', {
      description: 'The ID of the webhook associated with this audit',
      nullable: true,
    }),
    sessionId: t.exposeString('sessionId', {
      description: 'The ID of the session associated with this audit',
      nullable: true,
    }),
    oldValues: t.expose('oldValues', {
      type: 'JsonObject',
      description: 'The previous values before the action',
      nullable: true,
    }),
    newValues: t.expose('newValues', {
      type: 'JsonObject',
      description: 'The new values after the action',
      nullable: true,
    }),
    ipAddress: t.exposeString('ipAddress', {
      description: 'The IP address of the request',
      nullable: true,
    }),
    userAgent: t.exposeString('userAgent', {
      description: 'The user agent of the request',
      nullable: true,
    }),
    meta: t.expose('meta', {
      type: 'JsonObject',
      description: 'The metadata associated with the audit log',
      nullable: true,
    }),
    // timestamps
    createdAt: t.expose('createdAt', {
      type: 'DateTime',
      description: 'The date and time when the audit log was created',
      nullable: true,
    }),
    updatedAt: t.expose('updatedAt', {
      type: 'DateTime',
      description: 'The date and time when the audit log was last updated',
      nullable: true,
    }),
  }),
})

const ContextSecretType = builder.enumType('ContextSecretType', {
  values: Object.values(_SecretType),
  description: 'Types of secrets in the context of a user',
})

const ContextSecretKind = builder.enumType('ContextSecretKind', {
  values: [_SecretKind.personal] as const,
  description: 'Kinds of secrets in the context of a user',
})

const ContextBotVisibility = builder.enumType('ContextBotVisibility', {
  values: [_BotVisibility.public, _BotVisibility.protected] as const,
  description: 'Visibility options for bots in the context of a user',
})

const ContextDatasetVisibility = builder.enumType('ContextDatasetVisibility', {
  values: [_DatasetVisibility.public, _DatasetVisibility.protected] as const,
  description: 'Visibility options for datasets in the context of a user',
})

const ContextSkillsetVisibility = builder.enumType(
  'ContextSkillsetVisibility',
  {
    values: [
      _SkillsetVisibility.public,
      _SkillsetVisibility.protected,
    ] as const,
    description: 'Visibility options for skillsets in the context of a user',
  }
)

const ContextFileVisibility = builder.enumType('ContextFileVisibility', {
  values: [_FileVisibility.public, _FileVisibility.protected] as const,
  description: 'Visibility options for files in the context of a user',
})

const ContextSecretVisibility = builder.enumType('ContextSecretVisibility', {
  values: [_SecretVisibility.public, _SecretVisibility.protected] as const,
  description: 'Visibility options for secrets in the context of a user',
})

const ContextBlueprintVisibility = builder.enumType(
  'ContextBlueprintVisibility',
  {
    values: [
      _BlueprintVisibility.public,
      _BlueprintVisibility.protected,
    ] as const,
    description: 'Visibility options for blueprints in the context of a user',
  }
)

const ContextUser = builder.prismaObject('User', {
  variant: 'ContextUser',
  fields: (t) => ({
    // properties
    id: t.exposeID('id', {
      description: 'The unique identifier of the user',
      nullable: true,
    }),
    name: t.exposeString('name', {
      description: 'The name of the user',
      nullable: true,
    }),
    description: t.exposeString('description', {
      description: 'The description of the user',
      nullable: true,
    }),
  }),
})

const ContextBot = builder.prismaObject('Bot', {
  variant: 'ContextBot',
  fields: (t) => ({
    // properties
    id: t.exposeID('id', {
      description: 'The unique identifier of the bot',
      nullable: true,
    }),
    name: t.exposeString('name', {
      description: 'The name of the bot',
      nullable: true,
    }),
    description: t.exposeString('description', {
      description: 'The description of the bot',
      nullable: true,
    }),
  }),
})

const ContextDataset = builder.prismaObject('Dataset', {
  variant: 'ContextDataset',
  fields: (t) => ({
    // properties
    id: t.exposeID('id', {
      description: 'The unique identifier of the dataset',
      nullable: true,
    }),
    name: t.exposeString('name', {
      description: 'The name of the dataset',
      nullable: true,
    }),
    description: t.exposeString('description', {
      description: 'The description of the dataset',
      nullable: true,
    }),
  }),
})

const ContextSkillset = builder.prismaObject('Skillset', {
  variant: 'ContextSkillset',
  fields: (t) => ({
    // properties
    id: t.exposeID('id', {
      description: 'The unique identifier of the skillset',
      nullable: true,
    }),
    name: t.exposeString('name', {
      description: 'The name of the skillset',
      nullable: true,
    }),
    description: t.exposeString('description', {
      description: 'The description of the skillset',
      nullable: true,
    }),
  }),
})

const ContextFile = builder.prismaObject('File', {
  variant: 'ContextFile',
  fields: (t) => ({
    // properties
    id: t.exposeID('id', {
      description: 'The unique identifier of the file',
      nullable: true,
    }),
    name: t.exposeString('name', {
      description: 'The name of the file',
      nullable: true,
    }),
    description: t.exposeString('description', {
      description: 'The description of the file',
      nullable: true,
    }),
  }),
})

const ContextSecret = builder.prismaObject('Secret', {
  variant: 'ContextSecret',
  fields: (t) => ({
    // properties
    id: t.exposeID('id', {
      description: 'The unique identifier of the secret',
      nullable: true,
    }),
    name: t.exposeString('name', {
      description: 'The name of the secret',
      nullable: true,
    }),
    description: t.exposeString('description', {
      description: 'The description of the secret',
      nullable: true,
    }),
    // custom
    contacts: t.field({
      type: [SecretContact],
      args: {
        contactIds: t.arg({
          type: ['ID'],
          required: false,
          description: 'Filter contacts by their unique identifiers',
        }),
      },
      description: 'The contacts associated with the secret',
      nullable: true,
      resolve: async (_root, args, context) => {
        const contacts = await prisma.contact.findMany({
          // @note no need to order by

          where: {
            ...(Array.isArray(args.contactIds)
              ? { id: { in: args.contactIds } }
              : {}),

            userId: context.session.user.id,
          },
        })

        return contacts.map((contact) => ({ ...contact, secretId: _root.id }))
      },
    }),
  }),
})

const ContextPortal = builder.prismaObject('Portal', {
  variant: 'ContextPortal',
  fields: (t) => ({
    // properties
    id: t.exposeID('id', {
      description: 'The unique identifier of the portal',
      nullable: true,
    }),
    name: t.exposeString('name', {
      description: 'The name of the portal',
      nullable: true,
    }),
    description: t.exposeString('description', {
      description: 'The description of the portal',
      nullable: true,
    }),
    slug: t.exposeString('slug', {
      description: 'The slug of the portal, used for URL routing',
      nullable: true,
    }),
  }),
})

const ContextBlueprint = builder.prismaObject('Blueprint', {
  variant: 'ContextBlueprint',
  fields: (t) => ({
    // properties
    id: t.exposeID('id', {
      description: 'The unique identifier of the blueprint',
      nullable: true,
    }),
    name: t.exposeString('name', {
      description: 'The name of the blueprint',
      nullable: true,
    }),
    description: t.exposeString('description', {
      description: 'The description of the blueprint',
      nullable: true,
    }),
  }),
})

const WidgetIntegration = builder.prismaObject('WidgetIntegration', {
  fields: (t) => ({
    alias: t.exposeString('alias', {
      description: 'The alias ID',
      nullable: true,
    }),
    blueprintId: t.exposeString('blueprintId', {
      description: 'The ID of the blueprint to use',
      nullable: true,
    }),
    botId: t.exposeString('botId', {
      description: 'The ID of the bot to connect',
      nullable: true,
    }),
    theme: t.exposeString('theme', {
      description: 'The widget theme',
      nullable: true,
    }),
    layout: t.exposeString('layout', {
      description: 'The widget layout',
      nullable: true,
    }),
    title: t.exposeString('title', {
      description: 'The widget title',
      nullable: true,
    }),
    intro: t.exposeString('intro', {
      description: 'The widget intro message',
      nullable: true,
    }),
    initial: t.exposeString('initial', {
      description: 'The initial message',
      nullable: true,
    }),
    placeholder: t.exposeString('placeholder', {
      description: 'The input placeholder text',
      nullable: true,
    }),
    origin: t.exposeString('origin', {
      description: 'The allowed origin',
      nullable: true,
    }),
    language: t.exposeString('language', {
      description: 'The widget language',
      nullable: true,
    }),
    plugins: t.exposeString('plugins', {
      description: 'The enabled plugins',
      nullable: true,
    }),
    stream: t.exposeBoolean('stream', {
      description: 'Whether to stream responses',
      nullable: true,
    }),
    verbose: t.exposeBoolean('verbose', {
      description: 'Whether verbose mode is enabled',
      nullable: true,
    }),
    tools: t.exposeBoolean('tools', {
      description: 'Whether tools are enabled',
      nullable: true,
    }),
    unfurl: t.exposeBoolean('unfurl', {
      description: 'Whether link unfurling is enabled',
      nullable: true,
    }),
    math: t.exposeBoolean('math', {
      description: 'Whether math rendering is enabled',
      nullable: true,
    }),
    carousel: t.exposeBoolean('carousel', {
      description: 'Whether the carousel is enabled',
      nullable: true,
    }),
    form: t.exposeBoolean('form', {
      description: 'Whether forms are enabled',
      nullable: true,
    }),
    autoScroll: t.exposeBoolean('autoScroll', {
      description: 'Whether auto-scroll is enabled',
      nullable: true,
    }),
    startFirst: t.exposeBoolean('startFirst', {
      description: 'Whether to start first',
      nullable: true,
    }),
    exportConversation: t.exposeBoolean('exportConversation', {
      description: 'Whether conversation export is enabled',
      nullable: true,
    }),
    restartConversation: t.exposeBoolean('restartConversation', {
      description: 'Whether conversation restart is enabled',
      nullable: true,
    }),
    maximize: t.exposeBoolean('maximize', {
      description: 'Whether the widget can be maximized',
      nullable: true,
    }),
    messagePeek: t.exposeBoolean('messagePeek', {
      description: 'Whether message peek is enabled',
      nullable: true,
    }),
    voiceIn: t.exposeBoolean('voiceIn', {
      description: 'Whether voice input is enabled',
      nullable: true,
    }),
    voiceOut: t.exposeBoolean('voiceOut', {
      description: 'Whether voice output is enabled',
      nullable: true,
    }),
    poweredBy: t.exposeBoolean('poweredBy', {
      description: 'Whether the powered-by label is shown',
      nullable: true,
    }),
    // properties
    id: t.exposeID('id', {
      description: 'The unique identifier of the widget integration',
      nullable: true,
    }),
    name: t.exposeString('name', {
      description: 'The name of the widget integration',
      nullable: true,
    }),
    description: t.exposeString('description', {
      description: 'The description of the widget integration',
      nullable: true,
    }),
    contactCollection: t.exposeBoolean('contactCollection', {
      description: 'Whether contact collection is enabled',
      nullable: true,
    }),
    sessionDuration: t.exposeFloat('sessionDuration', {
      description: 'The session duration for the widget integration',
      nullable: true,
    }),
    attachments: t.exposeBoolean('attachments', {
      description: 'Whether attachments are enabled',
      nullable: true,
    }),
    meta: t.expose('meta', {
      type: 'JsonObject',
      description: 'The metadata associated with the widget integration',
      nullable: true,
    }),
    // analytics
    createdAt: t.expose('createdAt', {
      type: 'DateTime',
      description: 'The date and time when the widget integration was created',
      nullable: true,
    }),
    updatedAt: t.expose('updatedAt', {
      type: 'DateTime',
      description:
        'The date and time when the widget integration was last updated',
      nullable: true,
    }),
    // verification
    verification: integrationVerificationField(t, 'widget'),
    // relations
    blueprint: t.relation('blueprint', {
      description: 'The blueprint associated with the widget integration',
      nullable: true,
    }),
    bot: t.relation('bot', {
      description: 'The bot associated with the widget integration',
      nullable: true,
    }),
  }),
})

const SlackIntegration = builder.prismaObject('SlackIntegration', {
  fields: (t) => ({
    // properties
    id: t.exposeID('id', {
      description: 'The unique identifier of the slack integration',
      nullable: true,
    }),
    name: t.exposeString('name', {
      description: 'The name of the slack integration',
      nullable: true,
    }),
    description: t.exposeString('description', {
      description: 'The description of the slack integration',
      nullable: true,
    }),
    contactCollection: t.exposeBoolean('contactCollection', {
      description: 'Whether contact collection is enabled',
      nullable: true,
    }),
    sessionDuration: t.exposeFloat('sessionDuration', {
      description: 'The session duration for the slack integration',
      nullable: true,
    }),
    attachments: t.exposeBoolean('attachments', {
      description: 'Whether attachments are enabled',
      nullable: true,
    }),
    references: t.exposeBoolean('references', {
      description: 'Whether references are enabled',
      nullable: true,
    }),
    ratings: t.exposeBoolean('ratings', {
      description: 'Whether ratings are enabled',
      nullable: true,
    }),
    visibleMessages: t.exposeInt('visibleMessages', {
      description: 'The number of visible messages outside of the new thread',
      nullable: true,
    }),
    autoRespond: t.exposeString('autoRespond', {
      description: 'The auto respond configuration',
      nullable: true,
    }),
    allowFrom: t.exposeString('allowFrom', {
      description: 'The allowed senders for the slack integration',
      nullable: true,
    }),
    meta: t.expose('meta', {
      type: 'JsonObject',
      description: 'The metadata associated with the slack integration',
      nullable: true,
    }),
    // analytics
    createdAt: t.expose('createdAt', {
      type: 'DateTime',
      description: 'The date and time when the slack integration was created',
      nullable: true,
    }),
    updatedAt: t.expose('updatedAt', {
      type: 'DateTime',
      description:
        'The date and time when the slack integration was last updated',
      nullable: true,
    }),
    // verification
    verification: integrationVerificationField(t, 'slack'),
    // relations
    blueprint: t.relation('blueprint', {
      description: 'The blueprint associated with the slack integration',
      nullable: true,
    }),
    bot: t.relation('bot', {
      description: 'The bot associated with the slack integration',
      nullable: true,
    }),
  }),
})

const DiscordIntegration = builder.prismaObject('DiscordIntegration', {
  fields: (t) => ({
    // properties
    id: t.exposeID('id', {
      description: 'The unique identifier of the discord integration',
      nullable: true,
    }),
    name: t.exposeString('name', {
      description: 'The name of the discord integration',
      nullable: true,
    }),
    description: t.exposeString('description', {
      description: 'The description of the discord integration',
      nullable: true,
    }),
    contactCollection: t.exposeBoolean('contactCollection', {
      description: 'Whether contact collection is enabled',
      nullable: true,
    }),
    sessionDuration: t.exposeFloat('sessionDuration', {
      description: 'The session duration for the discord integration',
      nullable: true,
    }),
    attachments: t.exposeBoolean('attachments', {
      description: 'Whether attachments are enabled',
      nullable: true,
    }),
    allowFrom: t.exposeString('allowFrom', {
      description: 'The allowed senders for the discord integration',
      nullable: true,
    }),
    meta: t.expose('meta', {
      type: 'JsonObject',
      description: 'The metadata associated with the discord integration',
      nullable: true,
    }),
    // analytics
    createdAt: t.expose('createdAt', {
      type: 'DateTime',
      description: 'The date and time when the discord integration was created',
      nullable: true,
    }),
    updatedAt: t.expose('updatedAt', {
      type: 'DateTime',
      description:
        'The date and time when the discord integration was last updated',
      nullable: true,
    }),
    // verification
    verification: integrationVerificationField(t, 'discord'),
    // relations
    blueprint: t.relation('blueprint', {
      description: 'The blueprint associated with the discord integration',
      nullable: true,
    }),
    bot: t.relation('bot', {
      description: 'The bot associated with the discord integration',
      nullable: true,
    }),
  }),
})

const WhatsappIntegration = builder.prismaObject('WhatsappIntegration', {
  fields: (t) => ({
    // properties
    id: t.exposeID('id', {
      description: 'The unique identifier of the whatsapp integration',
      nullable: true,
    }),
    name: t.exposeString('name', {
      description: 'The name of the whatsapp integration',
      nullable: true,
    }),
    description: t.exposeString('description', {
      description: 'The description of the whatsapp integration',
      nullable: true,
    }),
    contactCollection: t.exposeBoolean('contactCollection', {
      description: 'Whether contact collection is enabled',
      nullable: true,
    }),
    sessionDuration: t.exposeFloat('sessionDuration', {
      description: 'The session duration for the whatsapp integration',
      nullable: true,
    }),
    attachments: t.exposeBoolean('attachments', {
      description: 'Whether attachments are enabled',
      nullable: true,
    }),
    allowFrom: t.exposeString('allowFrom', {
      description: 'The allowed senders for the whatsapp integration',
      nullable: true,
    }),
    meta: t.expose('meta', {
      type: 'JsonObject',
      description: 'The metadata associated with the whatsapp integration',
      nullable: true,
    }),
    // analytics
    createdAt: t.expose('createdAt', {
      type: 'DateTime',
      description:
        'The date and time when the whatsapp integration was created',
      nullable: true,
    }),
    updatedAt: t.expose('updatedAt', {
      type: 'DateTime',
      description:
        'The date and time when the whatsapp integration was last updated',
      nullable: true,
    }),
    // verification
    verification: integrationVerificationField(t, 'whatsapp'),
    // relations
    blueprint: t.relation('blueprint', {
      description: 'The blueprint associated with the whatsapp integration',
      nullable: true,
    }),
    bot: t.relation('bot', {
      description: 'The bot associated with the whatsapp integration',
      nullable: true,
    }),
  }),
})

const MessengerIntegration = builder.prismaObject('MessengerIntegration', {
  fields: (t) => ({
    // properties
    id: t.exposeID('id', {
      description: 'The unique identifier of the messenger integration',
      nullable: true,
    }),
    name: t.exposeString('name', {
      description: 'The name of the messenger integration',
      nullable: true,
    }),
    description: t.exposeString('description', {
      description: 'The description of the messenger integration',
      nullable: true,
    }),
    contactCollection: t.exposeBoolean('contactCollection', {
      description: 'Whether contact collection is enabled',
      nullable: true,
    }),
    sessionDuration: t.exposeFloat('sessionDuration', {
      description: 'The session duration for the messenger integration',
      nullable: true,
    }),
    attachments: t.exposeBoolean('attachments', {
      description: 'Whether attachments are enabled',
      nullable: true,
    }),
    meta: t.expose('meta', {
      type: 'JsonObject',
      description: 'The metadata associated with the messenger integration',
      nullable: true,
    }),
    // analytics
    createdAt: t.expose('createdAt', {
      type: 'DateTime',
      description:
        'The date and time when the messenger integration was created',
      nullable: true,
    }),
    updatedAt: t.expose('updatedAt', {
      type: 'DateTime',
      description:
        'The date and time when the messenger integration was last updated',
      nullable: true,
    }),
    // verification
    verification: integrationVerificationField(t, 'messenger'),
    // relations
    blueprint: t.relation('blueprint', {
      description: 'The blueprint associated with the messenger integration',
      nullable: true,
    }),
    bot: t.relation('bot', {
      description: 'The bot associated with the messenger integration',
      nullable: true,
    }),
  }),
})

const InstagramIntegration = builder.prismaObject('InstagramIntegration', {
  fields: (t) => ({
    // properties
    id: t.exposeID('id', {
      description: 'The unique identifier of the instagram integration',
      nullable: true,
    }),
    name: t.exposeString('name', {
      description: 'The name of the instagram integration',
      nullable: true,
    }),
    description: t.exposeString('description', {
      description: 'The description of the instagram integration',
      nullable: true,
    }),
    contactCollection: t.exposeBoolean('contactCollection', {
      description: 'Whether contact collection is enabled',
      nullable: true,
    }),
    sessionDuration: t.exposeFloat('sessionDuration', {
      description: 'The session duration for the instagram integration',
      nullable: true,
    }),
    attachments: t.exposeBoolean('attachments', {
      description: 'Whether attachments are enabled',
      nullable: true,
    }),
    meta: t.expose('meta', {
      type: 'JsonObject',
      description: 'The metadata associated with the instagram integration',
      nullable: true,
    }),
    // analytics
    createdAt: t.expose('createdAt', {
      type: 'DateTime',
      description:
        'The date and time when the instagram integration was created',
      nullable: true,
    }),
    updatedAt: t.expose('updatedAt', {
      type: 'DateTime',
      description:
        'The date and time when the instagram integration was last updated',
      nullable: true,
    }),
    // verification
    verification: integrationVerificationField(t, 'instagram'),
    // relations
    blueprint: t.relation('blueprint', {
      description: 'The blueprint associated with the instagram integration',
      nullable: true,
    }),
    bot: t.relation('bot', {
      description: 'The bot associated with the instagram integration',
      nullable: true,
    }),
  }),
})

const TelegramIntegration = builder.prismaObject('TelegramIntegration', {
  fields: (t) => ({
    // properties
    id: t.exposeID('id', {
      description: 'The unique identifier of the telegram integration',
      nullable: true,
    }),
    name: t.exposeString('name', {
      description: 'The name of the telegram integration',
      nullable: true,
    }),
    description: t.exposeString('description', {
      description: 'The description of the telegram integration',
      nullable: true,
    }),
    contactCollection: t.exposeBoolean('contactCollection', {
      description: 'Whether contact collection is enabled',
      nullable: true,
    }),
    sessionDuration: t.exposeFloat('sessionDuration', {
      description: 'The session duration for the telegram integration',
      nullable: true,
    }),
    attachments: t.exposeBoolean('attachments', {
      description: 'Whether attachments are enabled',
      nullable: true,
    }),
    allowFrom: t.exposeString('allowFrom', {
      description: 'The allowed senders for the telegram integration',
      nullable: true,
    }),
    meta: t.expose('meta', {
      type: 'JsonObject',
      description: 'The metadata associated with the telegram integration',
      nullable: true,
    }),
    // analytics
    createdAt: t.expose('createdAt', {
      type: 'DateTime',
      description:
        'The date and time when the telegram integration was created',
      nullable: true,
    }),
    updatedAt: t.expose('updatedAt', {
      type: 'DateTime',
      description:
        'The date and time when the telegram integration was last updated',
      nullable: true,
    }),
    // verification
    verification: integrationVerificationField(t, 'telegram'),
    // relations
    blueprint: t.relation('blueprint', {
      description: 'The blueprint associated with the telegram integration',
      nullable: true,
    }),
    bot: t.relation('bot', {
      description: 'The bot associated with the telegram integration',
      nullable: true,
    }),
  }),
})

const TwilioIntegration = builder.prismaObject('TwilioIntegration', {
  fields: (t) => ({
    // properties
    id: t.exposeID('id', {
      description: 'The unique identifier of the twilio integration',
      nullable: true,
    }),
    name: t.exposeString('name', {
      description: 'The name of the twilio integration',
      nullable: true,
    }),
    description: t.exposeString('description', {
      description: 'The description of the twilio integration',
      nullable: true,
    }),
    contactCollection: t.exposeBoolean('contactCollection', {
      description: 'Whether contact collection is enabled',
      nullable: true,
    }),
    sessionDuration: t.exposeFloat('sessionDuration', {
      description: 'The session duration for the twilio integration',
      nullable: true,
    }),
    meta: t.expose('meta', {
      type: 'JsonObject',
      description: 'The metadata associated with the twilio integration',
      nullable: true,
    }),
    // analytics
    createdAt: t.expose('createdAt', {
      type: 'DateTime',
      description: 'The date and time when the twilio integration was created',
      nullable: true,
    }),
    updatedAt: t.expose('updatedAt', {
      type: 'DateTime',
      description:
        'The date and time when the twilio integration was last updated',
      nullable: true,
    }),
    // verification
    verification: integrationVerificationField(t, 'twilio'),
    // relations
    blueprint: t.relation('blueprint', {
      description: 'The blueprint associated with the twilio integration',
      nullable: true,
    }),
    bot: t.relation('bot', {
      description: 'The bot associated with the twilio integration',
      nullable: true,
    }),
  }),
})

const MicrosoftteamsIntegration = builder.prismaObject(
  'MicrosoftteamsIntegration',
  {
    fields: (t) => ({
      // properties
      id: t.exposeID('id', {
        description: 'The unique identifier of the Microsoft Teams integration',
        nullable: true,
      }),
      name: t.exposeString('name', {
        description: 'The name of the Microsoft Teams integration',
        nullable: true,
      }),
      description: t.exposeString('description', {
        description: 'The description of the Microsoft Teams integration',
        nullable: true,
      }),
      contactCollection: t.exposeBoolean('contactCollection', {
        description: 'Whether contact collection is enabled',
        nullable: true,
      }),
      sessionDuration: t.exposeFloat('sessionDuration', {
        description: 'The session duration for the Microsoft Teams integration',
        nullable: true,
      }),
      attachments: t.exposeBoolean('attachments', {
        description: 'Whether attachments are enabled',
        nullable: true,
      }),
      allowFrom: t.exposeString('allowFrom', {
        description: 'The allowed senders for the Microsoft Teams integration',
        nullable: true,
      }),
      meta: t.expose('meta', {
        type: 'JsonObject',
        description:
          'The metadata associated with the Microsoft Teams integration',
        nullable: true,
      }),
      // analytics
      createdAt: t.expose('createdAt', {
        type: 'DateTime',
        description:
          'The date and time when the Microsoft Teams integration was created',
        nullable: true,
      }),
      updatedAt: t.expose('updatedAt', {
        type: 'DateTime',
        description:
          'The date and time when the Microsoft Teams integration was last updated',
        nullable: true,
      }),
      // verification
      verification: integrationVerificationField(t, 'microsoftteams'),
      // relations
      blueprint: t.relation('blueprint', {
        description:
          'The blueprint associated with the Microsoft Teams integration',
        nullable: true,
      }),
      bot: t.relation('bot', {
        description: 'The bot associated with the Microsoft Teams integration',
        nullable: true,
      }),
    }),
  }
)

const GooglechatIntegration = builder.prismaObject('GooglechatIntegration', {
  fields: (t) => ({
    // properties
    id: t.exposeID('id', {
      description: 'The unique identifier of the Google Chat integration',
      nullable: true,
    }),
    name: t.exposeString('name', {
      description: 'The name of the Google Chat integration',
      nullable: true,
    }),
    description: t.exposeString('description', {
      description: 'The description of the Google Chat integration',
      nullable: true,
    }),
    contactCollection: t.exposeBoolean('contactCollection', {
      description: 'Whether contact collection is enabled',
      nullable: true,
    }),
    sessionDuration: t.exposeFloat('sessionDuration', {
      description: 'The session duration for the Google Chat integration',
      nullable: true,
    }),
    autoRespond: t.exposeString('autoRespond', {
      description:
        'The auto-respond configuration for the Google Chat integration',
      nullable: true,
    }),
    allowFrom: t.exposeString('allowFrom', {
      description: 'The allowed senders for the Google Chat integration',
      nullable: true,
    }),
    meta: t.expose('meta', {
      type: 'JsonObject',
      description: 'The metadata associated with the Google Chat integration',
      nullable: true,
    }),
    // analytics
    createdAt: t.expose('createdAt', {
      type: 'DateTime',
      description:
        'The date and time when the Google Chat integration was created',
      nullable: true,
    }),
    updatedAt: t.expose('updatedAt', {
      type: 'DateTime',
      description:
        'The date and time when the Google Chat integration was last updated',
      nullable: true,
    }),
    // verification
    verification: integrationVerificationField(t, 'googlechat'),
    // relations
    blueprint: t.relation('blueprint', {
      description: 'The blueprint associated with the Google Chat integration',
      nullable: true,
    }),
    bot: t.relation('bot', {
      description: 'The bot associated with the Google Chat integration',
      nullable: true,
    }),
  }),
})

const EmailIntegration = builder.prismaObject('EmailIntegration', {
  fields: (t) => ({
    // properties
    id: t.exposeID('id', {
      description: 'The unique identifier of the email integration',
      nullable: true,
    }),
    name: t.exposeString('name', {
      description: 'The name of the email integration',
      nullable: true,
    }),
    description: t.exposeString('description', {
      description: 'The description of the email integration',
      nullable: true,
    }),
    contactCollection: t.exposeBoolean('contactCollection', {
      description: 'Whether contact collection is enabled',
      nullable: true,
    }),
    sessionDuration: t.exposeFloat('sessionDuration', {
      description: 'The session duration for the email integration',
      nullable: true,
    }),
    attachments: t.exposeBoolean('attachments', {
      description: 'Whether attachments are enabled',
      nullable: true,
    }),
    allowFrom: t.exposeString('allowFrom', {
      description: 'The allowed sender emails for the email integration',
      nullable: true,
    }),
    meta: t.expose('meta', {
      type: 'JsonObject',
      description: 'The metadata associated with the email integration',
      nullable: true,
    }),
    // analytics
    createdAt: t.expose('createdAt', {
      type: 'DateTime',
      description: 'The date and time when the email integration was created',
      nullable: true,
    }),
    updatedAt: t.expose('updatedAt', {
      type: 'DateTime',
      description:
        'The date and time when the email integration was last updated',
      nullable: true,
    }),
    // verification
    verification: integrationVerificationField(t, 'email'),
    // relations
    blueprint: t.relation('blueprint', {
      description: 'The blueprint associated with the email integration',
      nullable: true,
    }),
    bot: t.relation('bot', {
      description: 'The bot associated with the email integration',
      nullable: true,
    }),
  }),
})

const TriggerIntegration = builder.prismaObject('TriggerIntegration', {
  fields: (t) => ({
    // properties
    id: t.exposeID('id', {
      description: 'The unique identifier of the trigger integration',
      nullable: true,
    }),
    name: t.exposeString('name', {
      description: 'The name of the trigger integration',
      nullable: true,
    }),
    description: t.exposeString('description', {
      description: 'The description of the trigger integration',
      nullable: true,
    }),
    schedule: t.exposeString('schedule', {
      description: 'The schedule for the trigger integration',
      nullable: true,
    }),
    sessionDuration: t.exposeFloat('sessionDuration', {
      description: 'The session duration for the trigger integration',
      nullable: true,
    }),
    authenticate: t.exposeBoolean('authenticate', {
      description: 'Whether authentication is required',
      nullable: true,
    }),
    meta: t.expose('meta', {
      type: 'JsonObject',
      description: 'The metadata associated with the trigger integration',
      nullable: true,
    }),
    // analytics
    lastTriggerAt: t.expose('lastTriggerAt', {
      type: 'DateTime',
      description:
        'The date and time when the trigger integration was last triggered',
      nullable: true,
    }),
    // analytics
    createdAt: t.expose('createdAt', {
      type: 'DateTime',
      description: 'The date and time when the trigger integration was created',
      nullable: true,
    }),
    updatedAt: t.expose('updatedAt', {
      type: 'DateTime',
      description:
        'The date and time when the trigger integration was last updated',
      nullable: true,
    }),
    // relations
    blueprint: t.relation('blueprint', {
      description: 'The blueprint associated with the trigger integration',
      nullable: true,
    }),
    bot: t.relation('bot', {
      description: 'The bot associated with the trigger integration',
      nullable: true,
    }),
  }),
})

const SitemapIntegration = builder.prismaObject('SitemapIntegration', {
  fields: (t) => ({
    // properties
    id: t.exposeID('id', {
      description: 'The unique identifier of the sitemap integration',
      nullable: true,
    }),
    name: t.exposeString('name', {
      description: 'The name of the sitemap integration',
      nullable: true,
    }),
    description: t.exposeString('description', {
      description: 'The description of the sitemap integration',
      nullable: true,
    }),
    syncStatus: t.exposeString('syncStatus', {
      description: 'The sync status of the sitemap integration',
      nullable: true,
    }),
    syncSchedule: t.expose('syncSchedule', {
      type: Schedule,
      description: 'The sync schedule of the sitemap integration',
      nullable: true,
    }),
    lastSyncedAt: t.expose('lastSyncedAt', {
      type: 'DateTime',
      description:
        'The date and time when the sitemap integration was last synced',
      nullable: true,
    }),
    meta: t.expose('meta', {
      type: 'JsonObject',
      description: 'The metadata associated with the sitemap integration',
      nullable: true,
    }),
    // analytics
    createdAt: t.expose('createdAt', {
      type: 'DateTime',
      description: 'The date and time when the sitemap integration was created',
      nullable: true,
    }),
    updatedAt: t.expose('updatedAt', {
      type: 'DateTime',
      description:
        'The date and time when the sitemap integration was last updated',
      nullable: true,
    }),
    // relations
    blueprint: t.relation('blueprint', {
      description: 'The blueprint associated with the sitemap integration',
      nullable: true,
    }),
    dataset: t.relation('dataset', {
      description: 'The dataset associated with the sitemap integration',
      nullable: true,
    }),
  }),
})

const NotionIntegration = builder.prismaObject('NotionIntegration', {
  fields: (t) => ({
    // properties
    id: t.exposeID('id', {
      description: 'The unique identifier of the notion integration',
      nullable: true,
    }),
    name: t.exposeString('name', {
      description: 'The name of the notion integration',
      nullable: true,
    }),
    description: t.exposeString('description', {
      description: 'The description of the notion integration',
      nullable: true,
    }),
    syncStatus: t.exposeString('syncStatus', {
      description: 'The sync status of the notion integration',
      nullable: true,
    }),
    syncSchedule: t.expose('syncSchedule', {
      type: Schedule,
      description: 'The sync schedule of the notion integration',
      nullable: true,
    }),
    lastSyncedAt: t.expose('lastSyncedAt', {
      type: 'DateTime',
      description:
        'The date and time when the notion integration was last synced',
      nullable: true,
    }),
    meta: t.expose('meta', {
      type: 'JsonObject',
      description: 'The metadata associated with the notion integration',
      nullable: true,
    }),
    // analytics
    createdAt: t.expose('createdAt', {
      type: 'DateTime',
      description: 'The date and time when the notion integration was created',
      nullable: true,
    }),
    updatedAt: t.expose('updatedAt', {
      type: 'DateTime',
      description:
        'The date and time when the notion integration was last updated',
      nullable: true,
    }),
    // relations
    blueprint: t.relation('blueprint', {
      description: 'The blueprint associated with the notion integration',
      nullable: true,
    }),
    dataset: t.relation('dataset', {
      description: 'The dataset associated with the notion integration',
      nullable: true,
    }),
  }),
})

const SupportIntegration = builder.prismaObject('SupportIntegration', {
  fields: (t) => ({
    alias: t.exposeString('alias', {
      description: 'The alias ID',
      nullable: true,
    }),
    blueprintId: t.exposeString('blueprintId', {
      description: 'The ID of the blueprint to use',
      nullable: true,
    }),
    botId: t.exposeString('botId', {
      description: 'The ID of the bot to connect',
      nullable: true,
    }),
    email: t.exposeString('email', {
      description: 'The support email address',
      nullable: true,
    }),
    // properties
    id: t.exposeID('id', {
      description: 'The unique identifier of the support integration',
      nullable: true,
    }),
    name: t.exposeString('name', {
      description: 'The name of the support integration',
      nullable: true,
    }),
    description: t.exposeString('description', {
      description: 'The description of the support integration',
      nullable: true,
    }),
    meta: t.expose('meta', {
      type: 'JsonObject',
      description: 'The metadata associated with the support integration',
      nullable: true,
    }),
    // analytics
    createdAt: t.expose('createdAt', {
      type: 'DateTime',
      description: 'The date and time when the support integration was created',
      nullable: true,
    }),
    updatedAt: t.expose('updatedAt', {
      type: 'DateTime',
      description:
        'The date and time when the support integration was last updated',
      nullable: true,
    }),
    // relations
    blueprint: t.relation('blueprint', {
      description: 'The blueprint associated with the support integration',
      nullable: true,
    }),
    bot: t.relation('bot', {
      description: 'The bot associated with the support integration',
      nullable: true,
    }),
  }),
})

const ExtractIntegration = builder.prismaObject('ExtractIntegration', {
  fields: (t) => ({
    // properties
    id: t.exposeID('id', {
      description: 'The unique identifier of the extract integration',
      nullable: true,
    }),
    name: t.exposeString('name', {
      description: 'The name of the extract integration',
      nullable: true,
    }),
    description: t.exposeString('description', {
      description: 'The description of the extract integration',
      nullable: true,
    }),
    model: t.exposeString('model', {
      description: 'The LLM model to use for the extract integration',
      nullable: true,
    }),
    meta: t.expose('meta', {
      type: 'JsonObject',
      description: 'The metadata associated with the extract integration',
      nullable: true,
    }),
    // analytics
    createdAt: t.expose('createdAt', {
      type: 'DateTime',
      description: 'The date and time when the extract integration was created',
      nullable: true,
    }),
    updatedAt: t.expose('updatedAt', {
      type: 'DateTime',
      description:
        'The date and time when the extract integration was last updated',
      nullable: true,
    }),
    // relations
    blueprint: t.relation('blueprint', {
      description: 'The blueprint associated with the extract integration',
      nullable: true,
    }),
    bot: t.relation('bot', {
      description: 'The bot associated with the extract integration',
      nullable: true,
    }),
  }),
})

const McpserverIntegration = builder.prismaObject('McpserverIntegration', {
  fields: (t) => ({
    // properties
    id: t.exposeID('id', {
      description: 'The unique identifier of the MCP server integration',
      nullable: true,
    }),
    name: t.exposeString('name', {
      description: 'The name of the MCP server integration',
      nullable: true,
    }),
    description: t.exposeString('description', {
      description: 'The description of the MCP server integration',
      nullable: true,
    }),
    meta: t.expose('meta', {
      type: 'JsonObject',
      description: 'The metadata associated with the MCP server integration',
      nullable: true,
    }),
    // analytics
    createdAt: t.expose('createdAt', {
      type: 'DateTime',
      description:
        'The date and time when the MCP server integration was created',
      nullable: true,
    }),
    updatedAt: t.expose('updatedAt', {
      type: 'DateTime',
      description:
        'The date and time when the MCP server integration was last updated',
      nullable: true,
    }),
    // relations
    blueprint: t.relation('blueprint', {
      description: 'The blueprint associated with the MCP server integration',
      nullable: true,
    }),
    skillset: t.relation('skillset', {
      description: 'The skillset associated with the MCP server integration',
      nullable: true,
    }),
  }),
})

const SkillserverIntegration = builder.prismaObject('SkillserverIntegration', {
  fields: (t) => ({
    // properties
    id: t.exposeID('id', {
      description: 'The unique identifier of the skill server integration',
      nullable: true,
    }),
    name: t.exposeString('name', {
      description: 'The name of the skill server integration',
      nullable: true,
    }),
    description: t.exposeString('description', {
      description: 'The description of the skill server integration',
      nullable: true,
    }),
    meta: t.expose('meta', {
      type: 'JsonObject',
      description: 'The metadata associated with the skill server integration',
      nullable: true,
    }),
    // analytics
    createdAt: t.expose('createdAt', {
      type: 'DateTime',
      description:
        'The date and time when the skill server integration was created',
      nullable: true,
    }),
    updatedAt: t.expose('updatedAt', {
      type: 'DateTime',
      description:
        'The date and time when the skill server integration was last updated',
      nullable: true,
    }),
    // relations
    blueprint: t.relation('blueprint', {
      description: 'The blueprint associated with the skill server integration',
      nullable: true,
    }),
    skillset: t.relation('skillset', {
      description: 'The skillset associated with the skill server integration',
      nullable: true,
    }),
  }),
})

const GithubIntegration = builder.prismaObject('GithubIntegration', {
  fields: (t) => ({
    // properties
    id: t.exposeID('id', {
      description: 'The unique identifier of the github integration',
      nullable: true,
    }),
    name: t.exposeString('name', {
      description: 'The name of the github integration',
      nullable: true,
    }),
    description: t.exposeString('description', {
      description: 'The description of the github integration',
      nullable: true,
    }),
    meta: t.expose('meta', {
      type: 'JsonObject',
      description: 'The metadata associated with the github integration',
      nullable: true,
    }),
    // analytics
    createdAt: t.expose('createdAt', {
      type: 'DateTime',
      description: 'The date and time when the github integration was created',
      nullable: true,
    }),
    updatedAt: t.expose('updatedAt', {
      type: 'DateTime',
      description:
        'The date and time when the github integration was last updated',
      nullable: true,
    }),
    // relations
    blueprint: t.relation('blueprint', {
      description: 'The blueprint associated with the github integration',
      nullable: true,
    }),
    bot: t.relation('bot', {
      description: 'The bot associated with the github integration',
      nullable: true,
    }),
  }),
})

const AnamIntegration = builder.prismaObject('AnamIntegration', {
  fields: (t) => ({
    // properties
    id: t.exposeID('id', {
      description: 'The unique identifier of the anam integration',
      nullable: true,
    }),
    name: t.exposeString('name', {
      description: 'The name of the anam integration',
      nullable: true,
    }),
    description: t.exposeString('description', {
      description: 'The description of the anam integration',
      nullable: true,
    }),
    meta: t.expose('meta', {
      type: 'JsonObject',
      description: 'The metadata associated with the anam integration',
      nullable: true,
    }),
    // analytics
    createdAt: t.expose('createdAt', {
      type: 'DateTime',
      description: 'The date and time when the anam integration was created',
      nullable: true,
    }),
    updatedAt: t.expose('updatedAt', {
      type: 'DateTime',
      description:
        'The date and time when the anam integration was last updated',
      nullable: true,
    }),
    // relations
    blueprint: t.relation('blueprint', {
      description: 'The blueprint associated with the anam integration',
      nullable: true,
    }),
    bot: t.relation('bot', {
      description: 'The bot associated with the anam integration',
      nullable: true,
    }),
  }),
})

const AvatarIntegration = builder.prismaObject('AvatarIntegration', {
  fields: (t) => ({
    // properties
    id: t.exposeID('id', {
      description: 'The unique identifier of the avatar integration',
      nullable: true,
    }),
    name: t.exposeString('name', {
      description: 'The name of the avatar integration',
      nullable: true,
    }),
    description: t.exposeString('description', {
      description: 'The description of the avatar integration',
      nullable: true,
    }),
    meta: t.expose('meta', {
      type: 'JsonObject',
      description: 'The metadata associated with the avatar integration',
      nullable: true,
    }),
    // analytics
    createdAt: t.expose('createdAt', {
      type: 'DateTime',
      description: 'The date and time when the avatar integration was created',
      nullable: true,
    }),
    updatedAt: t.expose('updatedAt', {
      type: 'DateTime',
      description:
        'The date and time when the avatar integration was last updated',
      nullable: true,
    }),
    // relations
    blueprint: t.relation('blueprint', {
      description: 'The blueprint associated with the avatar integration',
      nullable: true,
    }),
    bot: t.relation('bot', {
      description: 'The bot associated with the avatar integration',
      nullable: true,
    }),
  }),
})

const RecallIntegration = builder.prismaObject('RecallIntegration', {
  fields: (t) => ({
    // properties
    id: t.exposeID('id', {
      description: 'The unique identifier of the recall integration',
      nullable: true,
    }),
    name: t.exposeString('name', {
      description: 'The name of the recall integration',
      nullable: true,
    }),
    description: t.exposeString('description', {
      description: 'The description of the recall integration',
      nullable: true,
    }),
    meta: t.expose('meta', {
      type: 'JsonObject',
      description: 'The metadata associated with the recall integration',
      nullable: true,
    }),
    // analytics
    createdAt: t.expose('createdAt', {
      type: 'DateTime',
      description: 'The date and time when the recall integration was created',
      nullable: true,
    }),
    updatedAt: t.expose('updatedAt', {
      type: 'DateTime',
      description:
        'The date and time when the recall integration was last updated',
      nullable: true,
    }),
    // relations
    blueprint: t.relation('blueprint', {
      description: 'The blueprint associated with the recall integration',
      nullable: true,
    }),
    bot: t.relation('bot', {
      description: 'The bot associated with the recall integration',
      nullable: true,
    }),
  }),
})

const PlatformModel = builder.simpleObject('PlatformModel', {
  fields: (t) =>
    ({
      id: t.id({
        description: 'The unique identifier of the platform model',
      }),
      name: t.string({
        description: 'The name of the platform model',
        nullable: true,
      }),
      description: t.string({
        description: 'The description of the platform model',
        nullable: true,
      }),
      type: t.string({
        description: 'The type of the platform model',
      }),
      default: t.boolean({
        description:
          "Whether this model is the deployment's default for its type",
        nullable: true,
      }),
      provider: t.string({
        description: 'The provider of the platform model',
        nullable: true,
      }),
      family: t.string({
        description: 'The family of the platform model',
        nullable: true,
      }),
      maxTokens: t.int({
        description: 'The maximum number of tokens for the platform model',
        nullable: true,
      }),
      maxInputTokens: t.int({
        description:
          'The maximum number of input tokens for the platform model',
        nullable: true,
      }),
      maxOutputTokens: t.int({
        description:
          'The maximum number of output tokens for the platform model',
        nullable: true,
      }),
      meta: t.field({
        type: 'JsonObject',
        description: 'The metadata associated with the platform model',
        nullable: true,
      }),
      createdAt: t.field({
        type: 'DateTime',
        description: 'The date and time when the platform model was created',
        nullable: true,
      }),
      updatedAt: t.field({
        type: 'DateTime',
        description:
          'The date and time when the platform model was last updated',
        nullable: true,
      }),
    } satisfies Record<keyof _PlatformModelListItem, unknown>),
})

const PlatformAction = builder.simpleObject('PlatformAction', {
  fields: (t) =>
    ({
      id: t.id({
        description: 'The unique identifier of the platform action',
      }),
      name: t.string({
        description: 'The name of the platform action',
        nullable: true,
      }),
      description: t.string({
        description: 'The description of the platform action',
        nullable: true,
      }),
      examples: t.field({
        type: ['String'],
        description: 'Example instructions demonstrating the action usage',
        nullable: true,
      }),
      meta: t.field({
        type: 'JsonObject',
        description: 'The metadata associated with the platform action',
        nullable: true,
      }),
      createdAt: t.field({
        type: 'DateTime',
        description: 'The date and time when the platform action was created',
        nullable: true,
      }),
      updatedAt: t.field({
        type: 'DateTime',
        description:
          'The date and time when the platform action was last updated',
        nullable: true,
      }),
    } satisfies Record<keyof _PlatformActionListItem, unknown>),
})

const PlatformAbility = builder.simpleObject('PlatformAbility', {
  fields: (t) =>
    ({
      id: t.id({
        description: 'The unique identifier of the platform ability',
      }),
      template: t.string({
        description:
          'The original template identifier for the platform ability',
        nullable: true,
      }),
      name: t.string({
        description: 'The name of the platform ability',
        nullable: true,
      }),
      description: t.string({
        description: 'The description of the platform ability',
        nullable: true,
      }),
      instruction: t.string({
        description: 'The instruction for the platform ability',
        nullable: true,
      }),
      schema: t.field({
        type: 'JsonObject',
        description: 'The parameters associated with the platform ability',
        nullable: true,
      }),
      bot: t.string({
        description: 'The bot configuration for the platform ability',
        nullable: true,
      }),
      file: t.string({
        description: 'The file configuration for the platform ability',
        nullable: true,
      }),
      secret: t.string({
        description: 'The secret configuration for the platform ability',
        nullable: true,
      }),
      space: t.string({
        description: 'The space configuration for the platform ability',
        nullable: true,
      }),
      provider: t.string({
        description: 'The provider of the platform ability',
        nullable: true,
      }),
      icon: t.string({
        description: 'The icon representing the platform ability',
        nullable: true,
      }),
      tags: t.field({
        type: ['String'],
        description: 'The tags associated with the platform ability',
        nullable: true,
      }),
      setup: t.string({
        description: 'The setup configuration for the platform ability',
        nullable: true,
      }),
      commentary: t.string({
        description: 'Additional commentary about the platform ability',
        nullable: true,
      }),
      score: t.float({
        description:
          'The similarity score of the platform ability search result',
        nullable: true,
      }),
      excerpt: t.string({
        description:
          'An excerpt from the most relevant part of the platform ability',
        nullable: true,
      }),
      link: t.string({
        description: 'The URL to the official platform ability page',
        nullable: true,
      }),
      meta: t.field({
        type: 'JsonObject',
        description: 'The metadata associated with the platform ability',
        nullable: true,
      }),
      createdAt: t.field({
        type: 'DateTime',
        description: 'The date and time when the platform ability was created',
        nullable: true,
      }),
      updatedAt: t.field({
        type: 'DateTime',
        description:
          'The date and time when the platform ability was last updated',
        nullable: true,
      }),
    } satisfies Record<
      | keyof _PlatformAbilityListItem
      | keyof _PlatformAbilitySearchResponse['items'][number],
      unknown
    >),
})

const PlatformSecret = builder.simpleObject('PlatformSecret', {
  fields: (t) =>
    ({
      id: t.id({
        description: 'The unique identifier of the platform secret',
      }),
      template: t.string({
        description: 'The original template identifier for the platform secret',
        nullable: true,
      }),
      name: t.string({
        description: 'The name of the platform secret',
        nullable: true,
      }),
      description: t.string({
        description: 'The description of the platform secret',
        nullable: true,
      }),
      type: t.string({
        description: 'The type of the platform secret',
        nullable: true,
      }),
      kind: t.string({
        description: 'The kind of the platform secret',
        nullable: true,
      }),
      config: t.field({
        type: 'JsonObject',
        description: 'The configuration of the platform secret',
        nullable: true,
      }),
      icon: t.string({
        description: 'The icon representing the platform secret',
        nullable: true,
      }),
      tags: t.field({
        type: ['String'],
        description: 'The tags associated with the platform secret',
        nullable: true,
      }),
      setup: t.string({
        description: 'The setup instructions for the platform secret',
        nullable: true,
      }),
      commentary: t.string({
        description: 'Additional commentary about the platform secret',
        nullable: true,
      }),
      score: t.float({
        description:
          'The similarity score of the platform secret search result',
        nullable: true,
      }),
      excerpt: t.string({
        description:
          'An excerpt from the most relevant part of the platform secret',
        nullable: true,
      }),
      link: t.string({
        description: 'The URL to the official platform secret page',
        nullable: true,
      }),
      meta: t.field({
        type: 'JsonObject',
        description: 'The metadata associated with the platform secret',
        nullable: true,
      }),
      createdAt: t.field({
        type: 'DateTime',
        description: 'The date and time when the platform secret was created',
        nullable: true,
      }),
      updatedAt: t.field({
        type: 'DateTime',
        description:
          'The date and time when the platform secret was last updated',
        nullable: true,
      }),
    } satisfies Record<
      | keyof _PlatformSecretListItem
      | keyof _PlatformSecretSearchResponse['items'][number],
      unknown
    >),
})

const PlatformExample = builder
  .objectRef<
    _PlatformExampleListItem & {
      config?: unknown
    }
  >('PlatformExample')
  .implement({
    fields: (t) => ({
      id: t.exposeID('id', {
        description: 'The unique identifier of the platform example',
      }),
      name: t.exposeString('name', {
        description: 'The name of the platform example',
        nullable: true,
      }),
      description: t.exposeString('description', {
        description: 'The description of the platform example',
        nullable: true,
      }),
      type: t.exposeString('type', {
        description: 'The type of the platform example',
        nullable: true,
      }),
      tags: t.expose('tags', {
        type: ['String'],
        description: 'The tags associated with the platform example',
        nullable: true,
      }),
      config: t.field({
        type: 'JsonObject',
        description:
          'The configuration of the platform example. Fetches full config from API when requested.',
        nullable: true,
        resolve: async (parent, _args, context) => {
          try {
            const userClient = await getSessionClient(context.session)

            const example = await userClient.platform.example.fetch(parent.id)

            return example.config
          } catch (e) {
            await captureException(e)

            return null
          }
        },
      }),
      meta: t.expose('meta', {
        type: 'JsonObject',
        description: 'The metadata associated with the platform example',
        nullable: true,
      }),
      createdAt: t.field({
        type: 'DateTime',
        description: 'The date and time when the platform example was created',
        nullable: true,
        resolve: (parent) =>
          parent.createdAt ? new Date(parent.createdAt) : null,
      }),
      updatedAt: t.field({
        type: 'DateTime',
        description:
          'The date and time when the platform example was last updated',
        nullable: true,
        resolve: (parent) =>
          parent.updatedAt ? new Date(parent.updatedAt) : null,
      }),
      link: t.exposeString('link', {
        description: 'The URL of the platform example',
        nullable: true,
      }),
    }),
  })

const PlatformReport = builder
  .objectRef<
    _PlatformReportListItem & {
      report?: unknown
    }
  >('PlatformReport')
  .implement({
    fields: (t) => ({
      id: t.exposeID('id', {
        description: 'The unique identifier of the platform report',
      }),
      name: t.exposeString('name', {
        description: 'The name of the platform report',
        nullable: true,
      }),
      description: t.exposeString('description', {
        description: 'The description of the platform report',
        nullable: true,
      }),
      report: t.field({
        type: 'JsonObject',
        description:
          'The report data. Fetches full report from API when requested.',
        nullable: true,
        args: {
          input: t.arg({
            type: 'JsonObject',
            required: false,
            description: 'Input parameters for the report',
          }),
        },
        resolve: async (parent, args, context) => {
          try {
            const userClient = await getSessionClient(context.session)

            const result = await userClient.platform.report.generate(
              parent.id,
              args.input as Record<string, unknown>
            )

            return result as Record<string, unknown>
          } catch (error) {
            await captureException(error)

            return null
          }
        },
      }),
      meta: t.expose('meta', {
        type: 'JsonObject',
        description: 'The metadata associated with the platform report',
        nullable: true,
      }),
      createdAt: t.field({
        type: 'DateTime',
        description: 'The date and time when the platform report was created',
        nullable: true,
        resolve: (parent) =>
          parent.createdAt ? new Date(parent.createdAt) : null,
      }),
      updatedAt: t.field({
        type: 'DateTime',
        description:
          'The date and time when the platform report was last updated',
        nullable: true,
        resolve: (parent) =>
          parent.updatedAt ? new Date(parent.updatedAt) : null,
      }),
    }),
  })

// ---
// Policy
// ---

const PolicyType = builder.enumType('PolicyType', {
  values: Object.values(_PolicyType),
  description: 'Types of policies that can be used in the system',
})

const Policy = builder.prismaObject('Policy', {
  fields: (t) => ({
    id: t.exposeID('id', {
      description: 'The unique identifier of the policy',
      nullable: true,
    }),
    alias: t.exposeString('alias', {
      description: 'The alias ID for the policy',
      nullable: true,
    }),
    name: t.exposeString('name', {
      description: 'The name of the policy',
      nullable: true,
    }),
    description: t.exposeString('description', {
      description: 'The description of the policy',
      nullable: true,
    }),
    type: t.expose('type', {
      type: PolicyType,
      description: 'The type of the policy',
      nullable: true,
    }),
    state: t.expose('state', {
      type: ResourceState,
      description: 'The lifecycle state of the policy (enabled/disabled)',
      nullable: true,
    }),
    config: t.expose('config', {
      type: 'JsonObject',
      description: 'The configuration of the policy',
      nullable: true,
    }),
    meta: t.expose('meta', {
      type: 'JsonObject',
      description: 'The metadata associated with the policy',
      nullable: true,
    }),
    blueprintId: t.exposeString('blueprintId', {
      description: 'The ID of the blueprint associated with the policy',
      nullable: true,
    }),
    botId: t.exposeString('botId', {
      description: 'The ID of the bot associated with the policy',
      nullable: true,
    }),
    createdAt: t.expose('createdAt', {
      type: 'DateTime',
      description: 'The date and time when the policy was created',
      nullable: true,
    }),
    updatedAt: t.expose('updatedAt', {
      type: 'DateTime',
      description: 'The date and time when the policy was last updated',
      nullable: true,
    }),
  }),
})

const Team = builder.prismaObject('Team', {
  fields: (t) => ({
    id: t.exposeID('id', {
      description: 'The unique identifier of the team',
      nullable: true,
    }),
    name: t.exposeString('name', {
      description: 'The name of the team',
      nullable: true,
    }),
    description: t.exposeString('description', {
      description: 'The description of the team',
      nullable: true,
    }),
    meta: t.expose('meta', {
      type: 'JsonObject',
      description: 'The metadata associated with the team',
      nullable: true,
    }),
    createdAt: t.expose('createdAt', {
      type: 'DateTime',
      description: 'The date and time when the team was created',
      nullable: true,
    }),
    updatedAt: t.expose('updatedAt', {
      type: 'DateTime',
      description: 'The date and time when the team was last updated',
      nullable: true,
    }),
  }),
})

const PolicyCreateResponse = builder
  .objectRef<_PolicyCreateResponse>('PolicyCreateResponse')
  .implement({
    description: 'Response containing the ID of a newly created policy',
    fields: (t) =>
      ({
        id: t.exposeID('id', {
          description: 'The unique identifier of the created policy',
        }),
      } satisfies Record<keyof _PolicyCreateResponse, unknown>),
  })

const PolicyCreateRequest = builder
  .inputRef<_PolicyCreateRequest>('PolicyCreateRequest')
  .implement({
    description: 'Input parameters for creating a new policy',
    fields: (t) =>
      ({
        alias: t.id({
          required: false,
          description: 'The alias ID for the policy',
        }),
        name: t.string({
          required: false,
          description: 'The name of the policy',
        }),
        description: t.string({
          required: false,
          description: 'The description of the policy',
        }),
        meta: t.field({
          type: Meta,
          required: false,
          description: 'Additional metadata for the policy',
        }),
        blueprintId: t.id({
          required: false,
          description: 'The ID of the blueprint to use',
        }),
        botId: t.id({
          required: false,
          description: 'The ID of the bot to associate',
        }),
        type: t.field({
          type: PolicyType,
          required: true,
          description: 'The type of the policy',
        }),
        state: t.field({
          type: ResourceState,
          required: false,
          description: 'The lifecycle state of the policy (enabled/disabled)',
        }),
        config: t.field({
          type: 'JsonObject',
          required: false,
          description: 'The policy configuration as JSON',
        }),
      } satisfies Record<keyof _PolicyCreateRequest, unknown>),
  })

const PolicyUpdateResponse = builder
  .objectRef<_PolicyUpdateResponse>('PolicyUpdateResponse')
  .implement({
    description: 'Response containing the ID of an updated policy',
    fields: (t) =>
      ({
        id: t.exposeID('id', {
          description: 'The unique identifier of the updated policy',
        }),
      } satisfies Record<keyof _PolicyUpdateResponse, unknown>),
  })

const PolicyUpdateRequest = builder
  .inputRef<_PolicyUpdateRequest>('PolicyUpdateRequest')
  .implement({
    description: 'Input parameters for updating an existing policy',
    fields: (t) =>
      ({
        alias: t.id({
          required: false,
          description: 'The alias ID for the policy',
        }),
        name: t.string({
          required: false,
          description: 'The name of the policy',
        }),
        description: t.string({
          required: false,
          description: 'The description of the policy',
        }),
        meta: t.field({
          type: Meta,
          required: false,
          description: 'Additional metadata for the policy',
        }),
        blueprintId: t.id({
          required: false,
          description: 'The ID of the blueprint to use',
        }),
        botId: t.id({
          required: false,
          description: 'The ID of the bot to associate',
        }),
        type: t.field({
          type: PolicyType,
          required: false,
          description: 'The type of the policy',
        }),
        state: t.field({
          type: ResourceState,
          required: false,
          description: 'The lifecycle state of the policy (enabled/disabled)',
        }),
        config: t.field({
          type: 'JsonObject',
          required: false,
          description: 'The policy configuration as JSON',
        }),
      } satisfies Record<keyof _PolicyUpdateRequest, unknown>),
  })

const PolicyDeleteResponse = builder
  .objectRef<_PolicyDeleteResponse>('PolicyDeleteResponse')
  .implement({
    description: 'Response containing the ID of a deleted policy',
    fields: (t) =>
      ({
        id: t.exposeID('id', {
          description: 'The unique identifier of the deleted policy',
        }),
      } satisfies Record<keyof _PolicyDeleteResponse, unknown>),
  })

// ---
// Context
// ---

const Context = builder.prismaObject('Context', {
  fields: (t) => ({
    id: t.exposeID('id', {
      description: 'The unique identifier of the context',
      nullable: true,
    }),
    name: t.exposeString('name', {
      description: 'The name of the context',
      nullable: true,
    }),
    description: t.exposeString('description', {
      description: 'The description of the context',
      nullable: true,
    }),
    blueprintId: t.exposeString('blueprintId', {
      description: 'The ID of the blueprint linked to the context',
      nullable: true,
    }),
    botId: t.exposeString('botId', {
      description: 'The ID of the bot linked to the context',
      nullable: true,
    }),
    datasetId: t.exposeString('datasetId', {
      description: 'The ID of the dataset linked to the context',
      nullable: true,
    }),
    skillsetId: t.exposeString('skillsetId', {
      description: 'The ID of the skillset linked to the context',
      nullable: true,
    }),
    contactId: t.exposeString('contactId', {
      description: 'The ID of the contact linked to the context',
      nullable: true,
    }),
    payload: t.expose('payload', {
      type: 'JsonObject',
      description: 'The context payload',
      nullable: true,
    }),
    meta: t.expose('meta', {
      type: 'JsonObject',
      description: 'The metadata associated with the context',
      nullable: true,
    }),
    createdAt: t.expose('createdAt', {
      type: 'DateTime',
      description: 'The date and time when the context was created',
      nullable: true,
    }),
    updatedAt: t.expose('updatedAt', {
      type: 'DateTime',
      description: 'The date and time when the context was last updated',
      nullable: true,
    }),
  }),
})

interface ContextInput {
  name?: string | null
  description?: string | null
  blueprintId?: string | null
  botId?: string | null
  datasetId?: string | null
  skillsetId?: string | null
  contactId?: string | null
  payload?: unknown
  meta?: unknown
}

const ContextCreateResponse = builder
  .objectRef<{ id: string }>('ContextCreateResponse')
  .implement({
    description: 'Response containing the ID of a newly created context',
    fields: (t) => ({
      id: t.exposeID('id', {
        description: 'The unique identifier of the created context',
      }),
    }),
  })

const ContextCreateRequest = builder
  .inputRef<ContextInput>('ContextCreateRequest')
  .implement({
    description: 'Input parameters for creating a new context',
    fields: (t) => ({
      name: t.string({
        required: false,
        description: 'The name of the context',
      }),
      description: t.string({
        required: false,
        description: 'The description of the context',
      }),
      blueprintId: t.id({
        required: false,
        description: 'The ID of the blueprint to link',
      }),
      botId: t.id({
        required: false,
        description: 'The ID of the bot to link',
      }),
      datasetId: t.id({
        required: false,
        description: 'The ID of the dataset to link',
      }),
      skillsetId: t.id({
        required: false,
        description: 'The ID of the skillset to link',
      }),
      contactId: t.id({
        required: false,
        description: 'The ID of the contact to link',
      }),
      payload: t.field({
        type: 'JsonObject',
        required: false,
        description: 'Optional JSON payload to attach to the context',
      }),
      meta: t.field({
        type: Meta,
        required: false,
        description: 'Additional metadata for the context',
      }),
    }),
  })

const ContextUpdateResponse = builder
  .objectRef<{ id: string }>('ContextUpdateResponse')
  .implement({
    description: 'Response containing the ID of an updated context',
    fields: (t) => ({
      id: t.exposeID('id', {
        description: 'The unique identifier of the updated context',
      }),
    }),
  })

const ContextUpdateRequest = builder
  .inputRef<ContextInput>('ContextUpdateRequest')
  .implement({
    description: 'Input parameters for updating an existing context',
    fields: (t) => ({
      name: t.string({
        required: false,
        description: 'The name of the context',
      }),
      description: t.string({
        required: false,
        description: 'The description of the context',
      }),
      blueprintId: t.id({
        required: false,
        description: 'The ID of the blueprint to link',
      }),
      botId: t.id({
        required: false,
        description: 'The ID of the bot to link',
      }),
      datasetId: t.id({
        required: false,
        description: 'The ID of the dataset to link',
      }),
      skillsetId: t.id({
        required: false,
        description: 'The ID of the skillset to link',
      }),
      contactId: t.id({
        required: false,
        description: 'The ID of the contact to link',
      }),
      payload: t.field({
        type: 'JsonObject',
        required: false,
        description: 'Optional JSON payload to attach to the context',
      }),
      meta: t.field({
        type: Meta,
        required: false,
        description: 'Additional metadata for the context',
      }),
    }),
  })

const ContextDeleteResponse = builder
  .objectRef<{ id: string }>('ContextDeleteResponse')
  .implement({
    description: 'Response containing the ID of a deleted context',
    fields: (t) => ({
      id: t.exposeID('id', {
        description: 'The unique identifier of the deleted context',
      }),
    }),
  })

// ---
// Task
// ---

const TaskCreateResponse = builder
  .objectRef<_TaskCreateResponse>('TaskCreateResponse')
  .implement({
    description: 'Response containing the ID of a newly created task',
    fields: (t) =>
      ({
        id: t.exposeID('id', {
          description: 'The unique identifier of the created task',
        }),
      } satisfies Record<keyof _TaskCreateResponse, unknown>),
  })

const TaskCreateRequest = builder
  .inputRef<_TaskCreateRequest>('TaskCreateRequest')
  .implement({
    description: 'Input parameters for creating a new task',
    fields: (t) =>
      ({
        name: t.string({
          required: false,
          description: 'The name of the task',
        }),
        description: t.string({
          required: false,
          description: 'The description of the task',
        }),
        blueprintId: t.id({
          required: false,
          description: 'The ID of the blueprint to assign the task to',
        }),
        botId: t.id({
          required: false,
          description: 'The ID of the bot the task runs',
        }),
        contactId: t.id({
          required: false,
          description: 'The ID of the contact to scope the task to',
        }),
        schedule: t.string({
          required: false,
          description:
            'The schedule: now, a cron expression, a date-time, or an interval keyword such as daily',
        }),
        timezone: t.string({
          required: false,
          description: 'The IANA timezone the schedule is evaluated in',
        }),
        sessionDuration: t.float({
          required: false,
          description:
            'Session duration in milliseconds controlling conversation reuse across runs',
        }),
        maxIterations: t.int({
          required: false,
          description: 'Maximum reasoning iterations per execution',
        }),
        maxTime: t.float({
          required: false,
          description: 'Maximum wall-clock time per execution in milliseconds',
        }),
        maxCalls: t.int({
          required: false,
          description:
            'Maximum tool calls across the whole task run (0 or null for unbounded)',
        }),
        expiresAt: t.float({
          required: false,
          description:
            'The timestamp (ms) at which the task expires and is automatically deleted',
        }),
        meta: t.field({
          type: Meta,
          required: false,
          description: 'Additional metadata for the task',
        }),
      } satisfies Record<keyof _TaskCreateRequest, unknown>),
  })

const TaskUpdateResponse = builder
  .objectRef<_TaskUpdateResponse>('TaskUpdateResponse')
  .implement({
    description: 'Response containing the ID of an updated task',
    fields: (t) =>
      ({
        id: t.exposeID('id', {
          description: 'The unique identifier of the updated task',
        }),
      } satisfies Record<keyof _TaskUpdateResponse, unknown>),
  })

const TaskUpdateRequest = builder
  .inputRef<_TaskUpdateRequest>('TaskUpdateRequest')
  .implement({
    description: 'Input parameters for updating an existing task',
    fields: (t) =>
      ({
        name: t.string({
          required: false,
          description: 'The name of the task',
        }),
        description: t.string({
          required: false,
          description: 'The description of the task',
        }),
        blueprintId: t.id({
          required: false,
          description: 'The ID of the blueprint to assign the task to',
        }),
        botId: t.id({
          required: false,
          description: 'The ID of the bot the task runs',
        }),
        contactId: t.id({
          required: false,
          description: 'The ID of the contact to scope the task to',
        }),
        schedule: t.string({
          required: false,
          description: 'The schedule for the task',
        }),
        timezone: t.string({
          required: false,
          description: 'The IANA timezone the schedule is evaluated in',
        }),
        sessionDuration: t.float({
          required: false,
          description: 'Session duration in milliseconds',
        }),
        maxIterations: t.int({
          required: false,
          description: 'Maximum reasoning iterations per execution',
        }),
        maxTime: t.float({
          required: false,
          description: 'Maximum wall-clock time per execution in milliseconds',
        }),
        maxCalls: t.int({
          required: false,
          description:
            'Maximum tool calls across the whole task run (0 or null for unbounded)',
        }),
        expiresAt: t.float({
          required: false,
          description:
            'The timestamp (ms) at which the task expires and is automatically deleted; null clears any expiry',
        }),
        meta: t.field({
          type: Meta,
          required: false,
          description: 'Additional metadata for the task',
        }),
      } satisfies Record<keyof _TaskUpdateRequest, unknown>),
  })

const TaskDeleteResponse = builder
  .objectRef<_TaskDeleteResponse>('TaskDeleteResponse')
  .implement({
    description: 'Response containing the ID of a deleted task',
    fields: (t) =>
      ({
        id: t.exposeID('id', {
          description: 'The unique identifier of the deleted task',
        }),
      } satisfies Record<keyof _TaskDeleteResponse, unknown>),
  })

// ---
// Space
// ---

const SpaceCreateResponse = builder
  .objectRef<_SpaceCreateResponse>('SpaceCreateResponse')
  .implement({
    description: 'Response containing the ID of a newly created space',
    fields: (t) =>
      ({
        id: t.exposeID('id', {
          description: 'The unique identifier of the created space',
        }),
      } satisfies Record<keyof _SpaceCreateResponse, unknown>),
  })

const SpaceCreateRequest = builder
  .inputRef<_SpaceCreateRequest>('SpaceCreateRequest')
  .implement({
    description: 'Input parameters for creating a new space',
    fields: (t) =>
      ({
        alias: t.id({
          required: false,
          description: 'The alias ID for the space',
        }),
        name: t.string({
          required: false,
          description: 'The name of the space',
        }),
        description: t.string({
          required: false,
          description: 'The description of the space',
        }),
        meta: t.field({
          type: Meta,
          required: false,
          description: 'Additional metadata for the space',
        }),
        blueprintId: t.id({
          required: false,
          description: 'The ID of the blueprint to use',
        }),
        contactId: t.id({
          required: false,
          description: 'The ID of the contact to associate',
        }),
      } satisfies Record<keyof _SpaceCreateRequest, unknown>),
  })

const SpaceUpdateResponse = builder
  .objectRef<_SpaceUpdateResponse>('SpaceUpdateResponse')
  .implement({
    description: 'Response containing the ID of an updated space',
    fields: (t) =>
      ({
        id: t.exposeID('id', {
          description: 'The unique identifier of the updated space',
        }),
      } satisfies Record<keyof _SpaceUpdateResponse, unknown>),
  })

const SpaceUpdateRequest = builder
  .inputRef<_SpaceUpdateRequest>('SpaceUpdateRequest')
  .implement({
    description: 'Input parameters for updating an existing space',
    fields: (t) =>
      ({
        alias: t.id({
          required: false,
          description: 'The alias ID for the space',
        }),
        name: t.string({
          required: false,
          description: 'The name of the space',
        }),
        description: t.string({
          required: false,
          description: 'The description of the space',
        }),
        meta: t.field({
          type: Meta,
          required: false,
          description: 'Additional metadata for the space',
        }),
        blueprintId: t.id({
          required: false,
          description: 'The ID of the blueprint to use',
        }),
        contactId: t.id({
          required: false,
          description: 'The ID of the contact to associate',
        }),
      } satisfies Record<keyof _SpaceUpdateRequest, unknown>),
  })

const SpaceDeleteResponse = builder
  .objectRef<_SpaceDeleteResponse>('SpaceDeleteResponse')
  .implement({
    description: 'Response containing the ID of a deleted space',
    fields: (t) =>
      ({
        id: t.exposeID('id', {
          description: 'The unique identifier of the deleted space',
        }),
      } satisfies Record<keyof _SpaceDeleteResponse, unknown>),
  })

const SpaceSiteCreateResponse = builder
  .objectRef<_SpaceSiteCreateResponse>('SpaceSiteCreateResponse')
  .implement({
    description: 'Response containing the ID of a newly created space site',
    fields: (t) =>
      ({
        id: t.exposeID('id', {
          description: 'The unique identifier of the created space site',
        }),
      } satisfies Record<keyof _SpaceSiteCreateResponse, unknown>),
  })

const SpaceSiteCreateRequest = builder
  .inputRef<_SpaceSiteCreateRequest>('SpaceSiteCreateRequest')
  .implement({
    description: 'Input parameters for creating a new space site',
    fields: (t) =>
      ({
        alias: t.id({
          required: false,
          description: 'The alias ID for the space site',
        }),
        name: t.string({
          required: false,
          description: 'The name of the space site',
        }),
        description: t.string({
          required: false,
          description: 'The description of the space site',
        }),
        meta: t.field({
          type: Meta,
          required: false,
          description: 'Additional metadata for the space site',
        }),
        slug: t.string({
          required: true,
          description: 'The subdomain slug beneath the configured space apex',
        }),
        prefix: t.string({
          required: false,
          description:
            'The optional folder prefix inside the space to serve from',
        }),
        index: t.string({
          required: false,
          description: 'The directory index filename',
        }),
        notFound: t.string({
          required: false,
          description: 'The not found filename',
        }),
      } satisfies Record<keyof _SpaceSiteCreateRequest, unknown>),
  })

const SpaceSiteUpdateResponse = builder
  .objectRef<_SpaceSiteUpdateResponse>('SpaceSiteUpdateResponse')
  .implement({
    description: 'Response containing the ID of an updated space site',
    fields: (t) =>
      ({
        id: t.exposeID('id', {
          description: 'The unique identifier of the updated space site',
        }),
      } satisfies Record<keyof _SpaceSiteUpdateResponse, unknown>),
  })

const SpaceSiteUpdateRequest = builder
  .inputRef<_SpaceSiteUpdateRequest>('SpaceSiteUpdateRequest')
  .implement({
    description: 'Input parameters for updating an existing space site',
    fields: (t) =>
      ({
        alias: t.id({
          required: false,
          description: 'The alias ID for the space site',
        }),
        name: t.string({
          required: false,
          description: 'The name of the space site',
        }),
        description: t.string({
          required: false,
          description: 'The description of the space site',
        }),
        meta: t.field({
          type: Meta,
          required: false,
          description: 'Additional metadata for the space site',
        }),
        slug: t.string({
          required: false,
          description: 'The subdomain slug beneath the configured space apex',
        }),
        prefix: t.string({
          required: false,
          description:
            'The optional folder prefix inside the space to serve from',
        }),
        index: t.string({
          required: false,
          description: 'The directory index filename',
        }),
        notFound: t.string({
          required: false,
          description: 'The not found filename',
        }),
      } satisfies Record<keyof _SpaceSiteUpdateRequest, unknown>),
  })

const SpaceSiteDeleteResponse = builder
  .objectRef<_SpaceSiteDeleteResponse>('SpaceSiteDeleteResponse')
  .implement({
    description: 'Response containing the ID of a deleted space site',
    fields: (t) =>
      ({
        id: t.exposeID('id', {
          description: 'The unique identifier of the deleted space site',
        }),
      } satisfies Record<keyof _SpaceSiteDeleteResponse, unknown>),
  })

// ---
// WidgetIntegration
// ---

const WidgetIntegrationCreateResponse = builder
  .objectRef<_WidgetIntegrationCreateResponse>(
    'WidgetIntegrationCreateResponse'
  )
  .implement({
    description:
      'Response containing the ID of a newly created Widget integration',
    fields: (t) =>
      ({
        id: t.exposeID('id', {}),
      } satisfies Record<keyof _WidgetIntegrationCreateResponse, unknown>),
  })

const WidgetIntegrationCreateRequest = builder
  .inputRef<_WidgetIntegrationCreateRequest>('WidgetIntegrationCreateRequest')
  .implement({
    description: 'Input parameters for creating a new Widget integration',
    fields: (t) =>
      ({
        alias: t.id({
          required: false,
          description: 'The alias ID',
        }),
        name: t.string({
          required: false,
          description: 'The name',
        }),
        description: t.string({
          required: false,
          description: 'The description',
        }),
        meta: t.field({
          type: Meta,
          required: false,
          description: 'Additional metadata for the integration',
        }),
        blueprintId: t.id({
          required: false,
          description: 'The ID of the blueprint to use',
        }),
        botId: t.id({
          required: false,
          description: 'The ID of the bot to connect',
        }),
        theme: t.string({
          required: false,
          description: 'The widget theme',
        }),
        layout: t.string({
          required: false,
          description: 'The widget layout',
        }),
        title: t.string({
          required: false,
          description: 'The widget title',
        }),
        intro: t.string({
          required: false,
          description: 'The widget intro message',
        }),
        initial: t.string({
          required: false,
          description: 'The initial message',
        }),
        placeholder: t.string({
          required: false,
          description: 'The input placeholder text',
        }),
        origin: t.string({
          required: false,
          description: 'The allowed origin',
        }),
        sessionDuration: t.int({
          required: false,
          description: 'The duration of the session in milliseconds',
        }),
        language: t.string({
          required: false,
          description: 'The widget language',
        }),
        plugins: t.string({
          required: false,
          description: 'The enabled plugins',
        }),
        stream: t.boolean({
          required: false,
          description: 'Whether to stream responses',
        }),
        verbose: t.boolean({
          required: false,
          description: 'Whether verbose mode is enabled',
        }),
        tools: t.boolean({
          required: false,
          description: 'Whether tools are enabled',
        }),
        unfurl: t.boolean({
          required: false,
          description: 'Whether link unfurling is enabled',
        }),
        math: t.boolean({
          required: false,
          description: 'Whether math rendering is enabled',
        }),
        carousel: t.boolean({
          required: false,
          description: 'Whether the carousel is enabled',
        }),
        form: t.boolean({
          required: false,
          description: 'Whether forms are enabled',
        }),
        attachments: t.boolean({
          required: false,
          description: 'Whether attachments are enabled',
        }),
        autoScroll: t.boolean({
          required: false,
          description: 'Whether auto-scroll is enabled',
        }),
        startFirst: t.boolean({
          required: false,
          description: 'Whether to start first',
        }),
        contactCollection: t.boolean({
          required: false,
          description: 'Whether to collect contact information',
        }),
        exportConversation: t.boolean({
          required: false,
          description: 'Whether conversation export is enabled',
        }),
        restartConversation: t.boolean({
          required: false,
          description: 'Whether conversation restart is enabled',
        }),
        maximize: t.boolean({
          required: false,
          description: 'Whether the widget can be maximized',
        }),
        messagePeek: t.boolean({
          required: false,
          description: 'Whether message peek is enabled',
        }),
        voiceIn: t.boolean({
          required: false,
          description: 'Whether voice input is enabled',
        }),
        voiceOut: t.boolean({
          required: false,
          description: 'Whether voice output is enabled',
        }),
        poweredBy: t.boolean({
          required: false,
          description: 'Whether the powered-by label is shown',
        }),
      } satisfies Record<keyof _WidgetIntegrationCreateRequest, unknown>),
  })

const WidgetIntegrationUpdateResponse = builder
  .objectRef<_WidgetIntegrationUpdateResponse>(
    'WidgetIntegrationUpdateResponse'
  )
  .implement({
    description: 'Response containing the ID of a updated Widget integration',
    fields: (t) =>
      ({
        id: t.exposeID('id', {}),
      } satisfies Record<keyof _WidgetIntegrationUpdateResponse, unknown>),
  })

const WidgetIntegrationUpdateRequest = builder
  .inputRef<_WidgetIntegrationUpdateRequest>('WidgetIntegrationUpdateRequest')
  .implement({
    description: 'Input parameters for updating an existing Widget integration',
    fields: (t) =>
      ({
        alias: t.id({
          required: false,
          description: 'The alias ID',
        }),
        name: t.string({
          required: false,
          description: 'The name',
        }),
        description: t.string({
          required: false,
          description: 'The description',
        }),
        meta: t.field({
          type: Meta,
          required: false,
          description: 'Additional metadata for the integration',
        }),
        blueprintId: t.id({
          required: false,
          description: 'The ID of the blueprint to use',
        }),
        botId: t.id({
          required: false,
          description: 'The ID of the bot to connect',
        }),
        theme: t.string({
          required: false,
          description: 'The widget theme',
        }),
        layout: t.string({
          required: false,
          description: 'The widget layout',
        }),
        title: t.string({
          required: false,
          description: 'The widget title',
        }),
        intro: t.string({
          required: false,
          description: 'The widget intro message',
        }),
        initial: t.string({
          required: false,
          description: 'The initial message',
        }),
        placeholder: t.string({
          required: false,
          description: 'The input placeholder text',
        }),
        origin: t.string({
          required: false,
          description: 'The allowed origin',
        }),
        sessionDuration: t.int({
          required: false,
          description: 'The duration of the session in milliseconds',
        }),
        language: t.string({
          required: false,
          description: 'The widget language',
        }),
        plugins: t.string({
          required: false,
          description: 'The enabled plugins',
        }),
        stream: t.boolean({
          required: false,
          description: 'Whether to stream responses',
        }),
        verbose: t.boolean({
          required: false,
          description: 'Whether verbose mode is enabled',
        }),
        tools: t.boolean({
          required: false,
          description: 'Whether tools are enabled',
        }),
        unfurl: t.boolean({
          required: false,
          description: 'Whether link unfurling is enabled',
        }),
        math: t.boolean({
          required: false,
          description: 'Whether math rendering is enabled',
        }),
        carousel: t.boolean({
          required: false,
          description: 'Whether the carousel is enabled',
        }),
        form: t.boolean({
          required: false,
          description: 'Whether forms are enabled',
        }),
        attachments: t.boolean({
          required: false,
          description: 'Whether attachments are enabled',
        }),
        autoScroll: t.boolean({
          required: false,
          description: 'Whether auto-scroll is enabled',
        }),
        startFirst: t.boolean({
          required: false,
          description: 'Whether to start first',
        }),
        contactCollection: t.boolean({
          required: false,
          description: 'Whether to collect contact information',
        }),
        exportConversation: t.boolean({
          required: false,
          description: 'Whether conversation export is enabled',
        }),
        restartConversation: t.boolean({
          required: false,
          description: 'Whether conversation restart is enabled',
        }),
        maximize: t.boolean({
          required: false,
          description: 'Whether the widget can be maximized',
        }),
        messagePeek: t.boolean({
          required: false,
          description: 'Whether message peek is enabled',
        }),
        voiceIn: t.boolean({
          required: false,
          description: 'Whether voice input is enabled',
        }),
        voiceOut: t.boolean({
          required: false,
          description: 'Whether voice output is enabled',
        }),
        poweredBy: t.boolean({
          required: false,
          description: 'Whether the powered-by label is shown',
        }),
      } satisfies Record<keyof _WidgetIntegrationUpdateRequest, unknown>),
  })

const WidgetIntegrationDeleteResponse = builder
  .objectRef<_WidgetIntegrationDeleteResponse>(
    'WidgetIntegrationDeleteResponse'
  )
  .implement({
    description: 'Response containing the ID of a deleted Widget integration',
    fields: (t) =>
      ({
        id: t.exposeID('id', {}),
      } satisfies Record<keyof _WidgetIntegrationDeleteResponse, unknown>),
  })

// ---
// SupportIntegration
// ---

const SupportIntegrationCreateResponse = builder
  .objectRef<_SupportIntegrationCreateResponse>(
    'SupportIntegrationCreateResponse'
  )
  .implement({
    description:
      'Response containing the ID of a newly created Support integration',
    fields: (t) =>
      ({
        id: t.exposeID('id', {}),
      } satisfies Record<keyof _SupportIntegrationCreateResponse, unknown>),
  })

const SupportIntegrationCreateRequest = builder
  .inputRef<_SupportIntegrationCreateRequest>('SupportIntegrationCreateRequest')
  .implement({
    description: 'Input parameters for creating a new Support integration',
    fields: (t) =>
      ({
        alias: t.id({
          required: false,
          description: 'The alias ID',
        }),
        name: t.string({
          required: false,
          description: 'The name',
        }),
        description: t.string({
          required: false,
          description: 'The description',
        }),
        meta: t.field({
          type: Meta,
          required: false,
          description: 'Additional metadata for the integration',
        }),
        blueprintId: t.id({
          required: false,
          description: 'The ID of the blueprint to use',
        }),
        botId: t.id({
          required: false,
          description: 'The ID of the bot to connect',
        }),
        email: t.string({
          required: false,
          description: 'The support email address',
        }),
      } satisfies Record<keyof _SupportIntegrationCreateRequest, unknown>),
  })

const SupportIntegrationUpdateResponse = builder
  .objectRef<_SupportIntegrationUpdateResponse>(
    'SupportIntegrationUpdateResponse'
  )
  .implement({
    description: 'Response containing the ID of a updated Support integration',
    fields: (t) =>
      ({
        id: t.exposeID('id', {}),
      } satisfies Record<keyof _SupportIntegrationUpdateResponse, unknown>),
  })

const SupportIntegrationUpdateRequest = builder
  .inputRef<_SupportIntegrationUpdateRequest>('SupportIntegrationUpdateRequest')
  .implement({
    description:
      'Input parameters for updating an existing Support integration',
    fields: (t) =>
      ({
        alias: t.id({
          required: false,
          description: 'The alias ID',
        }),
        name: t.string({
          required: false,
          description: 'The name',
        }),
        description: t.string({
          required: false,
          description: 'The description',
        }),
        meta: t.field({
          type: Meta,
          required: false,
          description: 'Additional metadata for the integration',
        }),
        blueprintId: t.id({
          required: false,
          description: 'The ID of the blueprint to use',
        }),
        botId: t.id({
          required: false,
          description: 'The ID of the bot to connect',
        }),
        email: t.string({
          required: false,
          description: 'The support email address',
        }),
      } satisfies Record<keyof _SupportIntegrationUpdateRequest, unknown>),
  })

const SupportIntegrationDeleteResponse = builder
  .objectRef<_SupportIntegrationDeleteResponse>(
    'SupportIntegrationDeleteResponse'
  )
  .implement({
    description: 'Response containing the ID of a deleted Support integration',
    fields: (t) =>
      ({
        id: t.exposeID('id', {}),
      } satisfies Record<keyof _SupportIntegrationDeleteResponse, unknown>),
  })

/**
 * Query
 */
builder.queryType({
  fields: (t) => ({
    // special

    me: t.prismaField({
      type: User,
      description: 'Fetch the current user',
      resolve: async (query, _root, _args, context) => {
        // @note derive the argument from the installed, extended client. The
        // base Prisma type is not assignable once cache and retry arguments are
        // added, and comparing the two recursively exceeds TypeScript's stack.

        const op: Prisma.Args<typeof prisma.user, 'findUnique'> = {
          select: query.select,
          include: query.include,

          where: {
            id: context.session.user.id,
          },
        }

        return await prisma.user.findUnique(op)
      },
    }),

    // objects

    contacts: t.prismaConnection({
      type: Contact,
      cursor: 'id',
      args: {
        order: t.arg({
          type: ListOrder,
          required: false,
          defaultValue: 'desc',
          description: 'Order contacts by creation time',
        }),
        meta: t.arg({
          type: 'JsonObject',
          required: false,
          description: 'Filter contacts by metadata',
        }),
        contactIds: t.arg({
          type: ['ID'],
          required: false,
          description: 'Filter contacts by their unique identifiers',
        }),
        fingerprints: t.arg({
          type: ['String'],
          required: false,
          description: 'Filter contacts by their fingerprints',
        }),
        emails: t.arg({
          type: ['String'],
          required: false,
          description: 'Filter contacts by their email addresses',
        }),
      },
      resolve: async (query, _root, args, context) => {
        return await prisma.contact.findMany({
          ...query,

          orderBy: orderByCreation(args.order),

          where: {
            ...(Array.isArray(args.contactIds)
              ? { id: { in: args.contactIds } }
              : {}),

            ...(Array.isArray(args.fingerprints)
              ? { fingerprint: { in: args.fingerprints } }
              : {}),

            ...(Array.isArray(args.emails)
              ? { email: { in: args.emails } }
              : {}),

            ...(Object.keys(args.meta || {}).length > 0
              ? {
                  AND: buildMetaQueryFilter(args.meta as Prisma.JsonObject),
                }
              : {}),

            // @note placed here to ensure that the userId is always checked

            userId: context.session.user.id,
          },
        })
      },
    }),

    tasks: t.prismaConnection({
      type: Task,
      cursor: 'id',
      args: {
        order: t.arg({
          type: ListOrder,
          required: false,
          defaultValue: 'desc',
          description: 'Order tasks by creation time',
        }),
        meta: t.arg({
          type: 'JsonObject',
          required: false,
          description: 'Filter tasks by metadata',
        }),
        taskIds: t.arg({
          type: ['ID'],
          required: false,
          description: 'Filter tasks by their unique identifiers',
        }),
        contactIds: t.arg({
          type: ['ID'],
          required: false,
          description: 'Filter tasks by contact identifiers',
        }),
        botIds: t.arg({
          type: ['ID'],
          required: false,
          description: 'Filter tasks by bot identifiers',
        }),
        blueprintIds: t.arg({
          type: ['ID'],
          required: false,
          description:
            'Filter tasks by blueprint identifiers. Matches tasks associated with the blueprint directly as well as tasks associated with a bot that belongs to the blueprint.',
        }),
        schedule: t.arg({
          type: 'String',
          required: false,
          description: 'Filter tasks by schedule',
        }),
      },
      resolve: async (query, _root, args, context) => {
        return await prisma.task.findMany({
          ...query,

          orderBy: orderByCreation(args.order),

          where: {
            ...(Object.keys(args.meta || {}).length > 0
              ? {
                  AND: buildMetaQueryFilter(args.meta as Prisma.JsonObject),
                }
              : {}),

            ...(Array.isArray(args.taskIds)
              ? { id: { in: args.taskIds } }
              : {}),

            ...(Array.isArray(args.contactIds)
              ? { contactId: { in: args.contactIds } }
              : {}),

            ...(Array.isArray(args.botIds)
              ? { botId: { in: args.botIds } }
              : {}),

            ...(Array.isArray(args.blueprintIds)
              ? { blueprintId: { in: args.blueprintIds } }
              : {}),

            ...(args.schedule ? { schedule: args.schedule } : {}),

            // @note placed here to ensure that the userId is always checked

            userId: context.session.user.id,
          },
        })
      },
    }),

    conversations: t.prismaConnection({
      type: Conversation,
      cursor: 'id',
      args: {
        order: t.arg({
          type: ListOrder,
          required: false,
          defaultValue: 'desc',
          description: 'Order conversations by creation time',
        }),
        meta: t.arg({
          type: 'JsonObject',
          required: false,
          description: 'Filter conversations by metadata',
        }),
        conversationIds: t.arg({
          type: ['ID'],
          required: false,
          description: 'Filter conversations by their unique identifiers',
        }),
        contactIds: t.arg({
          type: ['ID'],
          required: false,
          description: 'Filter conversations by contact identifiers',
        }),
        botIds: t.arg({
          type: ['ID'],
          required: false,
          description: 'Filter conversations by bot identifiers',
        }),
        taskIds: t.arg({
          type: ['ID'],
          required: false,
          description: 'Filter conversations by task identifiers',
        }),
      },
      resolve: async (query, _root, args, context) => {
        return await prisma.conversation.findMany({
          ...query,

          orderBy: orderByCreation(args.order),

          where: {
            ...(Object.keys(args.meta || {}).length > 0
              ? {
                  AND: buildMetaQueryFilter(args.meta as Prisma.JsonObject),
                }
              : {}),

            ...(Array.isArray(args.conversationIds)
              ? { id: { in: args.conversationIds } }
              : {}),

            ...(Array.isArray(args.contactIds)
              ? { contactId: { in: args.contactIds } }
              : {}),

            ...(Array.isArray(args.botIds)
              ? { botId: { in: args.botIds } }
              : {}),

            ...(Array.isArray(args.taskIds)
              ? { taskId: { in: args.taskIds } }
              : {}),

            // @note placed here to ensure that the userId is always checked

            userId: context.session.user.id,
          },
        })
      },
    }),

    ratings: t.prismaConnection({
      type: Rating,
      cursor: 'id',
      args: {
        order: t.arg({
          type: ListOrder,
          required: false,
          defaultValue: 'desc',
          description: 'Order ratings by creation time',
        }),
        meta: t.arg({
          type: 'JsonObject',
          required: false,
          description: 'Filter ratings by metadata',
        }),
        ratingIds: t.arg({
          type: ['ID'],
          required: false,
          description: 'Filter ratings by their unique identifiers',
        }),
        contactIds: t.arg({
          type: ['ID'],
          required: false,
          description: 'Filter ratings by contact identifiers',
        }),
        conversationIds: t.arg({
          type: ['ID'],
          required: false,
          description: 'Filter ratings by conversation identifiers',
        }),
        messageIds: t.arg({
          type: ['ID'],
          required: false,
          description: 'Filter ratings by message identifiers',
        }),
        botIds: t.arg({
          type: ['ID'],
          required: false,
          description: 'Filter ratings by bot identifiers',
        }),
        sentiment: t.arg({
          type: RatingSentiment,
          required: false,
          description: 'Filter ratings by sentiment',
        }),
        value: t.arg({
          type: 'String',
          required: false,
          description:
            'Filter ratings by a numeric value comparison, such as >=10 or <0 (upvote and downvote are accepted as legacy aliases for sentiment)',
        }),
      },
      resolve: async (query, _root, args, context) => {
        const [valueFilter] = buildValueQueryFilter(
          args.sentiment || args.value
        )

        return await prisma.rating.findMany({
          ...query,

          orderBy: orderByCreation(args.order),

          where: {
            ...(Object.keys(args.meta || {}).length > 0
              ? {
                  AND: buildMetaQueryFilter(args.meta as Prisma.JsonObject),
                }
              : {}),

            ...(Array.isArray(args.ratingIds)
              ? { id: { in: args.ratingIds } }
              : {}),

            ...(Array.isArray(args.contactIds)
              ? { contactId: { in: args.contactIds } }
              : {}),

            ...(Array.isArray(args.conversationIds)
              ? { conversationId: { in: args.conversationIds } }
              : {}),

            ...(Array.isArray(args.messageIds)
              ? { messageId: { in: args.messageIds } }
              : {}),

            ...(Array.isArray(args.botIds)
              ? { botId: { in: args.botIds } }
              : {}),

            ...(valueFilter || {}),

            // @note ensure that the rating belongs to the user

            userId: context.session.user.id,
          },
        })
      },
    }),

    memories: t.prismaConnection({
      type: Memory,
      cursor: 'id',
      args: {
        order: t.arg({
          type: ListOrder,
          required: false,
          defaultValue: 'desc',
          description: 'Order memories by creation time',
        }),
        meta: t.arg({
          type: 'JsonObject',
          required: false,
          description: 'Filter memories by metadata',
        }),
        memoryIds: t.arg({
          type: ['ID'],
          required: false,
          description: 'Filter memories by their unique identifiers',
        }),
        contactIds: t.arg({
          type: ['ID'],
          required: false,
          description: 'Filter memories by contact identifiers',
        }),
        botIds: t.arg({
          type: ['ID'],
          required: false,
          description: 'Filter memories by bot identifiers',
        }),
      },
      resolve: async (query, _root, args, context) => {
        return await prisma.memory.findMany({
          ...query,

          orderBy: orderByCreation(args.order),

          where: {
            ...(Object.keys(args.meta || {}).length > 0
              ? {
                  AND: buildMetaQueryFilter(args.meta as Prisma.JsonObject),
                }
              : {}),

            ...(Array.isArray(args.memoryIds)
              ? { id: { in: args.memoryIds } }
              : {}),

            ...(Array.isArray(args.contactIds)
              ? { contactId: { in: args.contactIds } }
              : {}),

            ...(Array.isArray(args.botIds)
              ? { botId: { in: args.botIds } }
              : {}),

            // @note ensure that the memory belongs to the user

            userId: context.session.user.id,
          },
        })
      },
    }),

    spaces: t.prismaConnection({
      type: Space,
      cursor: 'id',
      args: {
        order: t.arg({
          type: ListOrder,
          required: false,
          defaultValue: 'desc',
          description: 'Order spaces by creation time',
        }),
        meta: t.arg({
          type: 'JsonObject',
          required: false,
          description: 'Filter spaces by metadata',
        }),
        spaceIds: t.arg({
          type: ['ID'],
          required: false,
          description: 'Filter spaces by their unique identifiers',
        }),
        contactIds: t.arg({
          type: ['ID'],
          required: false,
          description: 'Filter spaces by contact identifiers',
        }),
        blueprintIds: t.arg({
          type: ['ID'],
          required: false,
          description: 'Filter spaces by blueprint identifiers',
        }),
      },
      resolve: async (query, _root, args, context) => {
        return await prisma.space.findMany({
          ...query,

          orderBy: orderByCreation(args.order),

          where: {
            ...(Object.keys(args.meta || {}).length > 0
              ? {
                  AND: buildMetaQueryFilter(args.meta as Prisma.JsonObject),
                }
              : {}),

            ...(Array.isArray(args.spaceIds)
              ? { id: { in: args.spaceIds } }
              : {}),

            ...(Array.isArray(args.contactIds)
              ? { contactId: { in: args.contactIds } }
              : {}),

            ...(Array.isArray(args.blueprintIds)
              ? { blueprintId: { in: args.blueprintIds } }
              : {}),

            // @note ensure that the space belongs to the user

            userId: context.session.user.id,
          },
        })
      },
    }),

    messages: t.prismaConnection({
      type: Message,
      cursor: 'id',
      args: {
        meta: t.arg({
          type: 'JsonObject',
          required: false,
          description: 'Filter messages by metadata',
        }),
        messageIds: t.arg({
          type: ['ID'],
          required: false,
          description: 'Filter messages by their unique identifiers',
        }),
        conversationIds: t.arg({
          type: ['ID'],
          required: false,
          description: 'Filter messages by conversation identifiers',
        }),
        type: t.arg({
          type: MessageType,
          required: false,
          description: 'Filter messages by type',
        }),
      },
      resolve: async (query, _root, args, context) => {
        // @note we need to split the query in two separate queries because we
        // can run out of memory

        return await prisma.message.findMyriad({
          ...query,

          // @note no need to order by

          where: {
            ...(Object.keys(args.meta || {}).length > 0
              ? {
                  AND: buildMetaQueryFilter(args.meta as Prisma.JsonObject),
                }
              : {}),

            ...(Array.isArray(args.messageIds)
              ? { id: { in: args.messageIds } }
              : {}),

            ...(Array.isArray(args.conversationIds)
              ? { conversationId: { in: args.conversationIds } }
              : {}),

            ...(args.type ? { type: args.type } : {}),

            // @note ensure that the conversation belongs to the user

            conversation: {
              userId: context.session.user.id,
            },
          },
        })
      },
    }),

    // projects

    blueprints: t.prismaConnection({
      type: Blueprint,
      cursor: 'id',
      args: {
        order: t.arg({
          type: ListOrder,
          required: false,
          defaultValue: 'desc',
          description: 'Order blueprints by creation time',
        }),
        // @note not yet supported
        visibility: t.arg({
          type: [BlueprintVisibility],
          required: false,
          description: 'Filter blueprints by their visibility',
        }),
        meta: t.arg({
          type: 'JsonObject',
          required: false,
          description: 'Filter blueprints by metadata',
        }),
        blueprintIds: t.arg({
          type: ['ID'],
          required: false,
          description: 'Filter blueprints by their unique identifiers',
        }),
      },
      resolve: async (query, _root, args, context) => {
        return await prisma.blueprint.findMany({
          ...query,

          orderBy: orderByCreation(args.order),

          where: {
            // @note not yet supported
            ...(Array.isArray(args.visibility)
              ? {
                  visibility: {
                    in: args.visibility as _BlueprintVisibility[],
                  },
                }
              : {}),

            ...(Object.keys(args.meta || {}).length > 0
              ? {
                  AND: buildMetaQueryFilter(args.meta as Prisma.JsonObject),
                }
              : {}),

            ...(Array.isArray(args.blueprintIds)
              ? { id: { in: args.blueprintIds } }
              : {}),

            // @note placed here to ensure that the userId is always checked

            userId: context.session.user.id,
          },
        })
      },
    }),

    // collaboration

    teams: t.prismaConnection({
      type: Team,
      cursor: 'id',
      args: {
        order: t.arg({
          type: ListOrder,
          required: false,
          defaultValue: 'desc',
          description: 'Order teams by creation time',
        }),
        meta: t.arg({
          type: 'JsonObject',
          required: false,
          description: 'Filter teams by metadata',
        }),
      },
      resolve: async (query, _root, args, context) => {
        return await prisma.team.findMany({
          ...query,

          orderBy: orderByCreation(args.order),

          where: {
            ...(Object.keys(args.meta || {}).length > 0
              ? {
                  AND: buildMetaQueryFilter(args.meta as Prisma.JsonObject),
                }
              : {}),

            // @note placed here to ensure that the userId is always checked

            userId: context.session.user.id,
          },
        })
      },
    }),

    users: t.prismaConnection({
      type: User,
      cursor: 'id',
      args: {
        order: t.arg({
          type: ListOrder,
          required: false,
          defaultValue: 'desc',
          description: 'Order users by creation time',
        }),
        meta: t.arg({
          type: 'JsonObject',
          required: false,
          description: 'Filter users by metadata',
        }),
      },
      resolve: async (query, _root, args, context) => {
        return await prisma.user.findMany({
          ...query,

          orderBy: orderByCreation(args.order),

          where: {
            ...(Object.keys(args.meta || {}).length > 0
              ? {
                  AND: buildMetaQueryFilter(args.meta as Prisma.JsonObject),
                }
              : {}),

            // @note placed here to ensure that the parent is always checked

            parentId: context.session.user.id,
          },
        })
      },
    }),

    // logs

    eventLogs: t.prismaConnection({
      type: EventLog,
      cursor: 'id',
      description: 'Fetch event logs for the current user',
      args: {
        meta: t.arg({
          type: 'JsonObject',
          required: false,
          description: 'Filter event logs by metadata',
        }),
        eventLogIds: t.arg({
          type: ['ID'],
          required: false,
          description: 'Filter event logs by their unique identifiers',
        }),
        types: t.arg({
          type: ['String'],
          required: false,
          description: 'Filter event logs by their types',
        }),
        conversationIds: t.arg({
          type: ['ID'],
          required: false,
          description: 'Filter event logs by conversation identifiers',
        }),
        taskIds: t.arg({
          type: ['ID'],
          required: false,
          description: 'Filter event logs by task identifiers',
        }),
        botIds: t.arg({
          type: ['ID'],
          required: false,
          description: 'Filter event logs by bot identifiers',
        }),
      },
      resolve: async (query, _root, args, context) => {
        return await prisma.eventLog.findMany({
          ...query,

          // @note prisma connection uses negative take value to paginate backwards
          // orderBy: { createdAt: 'desc' },

          where: {
            ...(Object.keys(args.meta || {}).length > 0
              ? {
                  AND: buildMetaQueryFilter(args.meta as Prisma.JsonObject),
                }
              : {}),

            ...(Array.isArray(args.eventLogIds)
              ? { id: { in: args.eventLogIds } }
              : {}),

            ...(Array.isArray(args.types) ? { type: { in: args.types } } : {}),

            ...(Array.isArray(args.conversationIds)
              ? { conversationId: { in: args.conversationIds } }
              : {}),

            ...(Array.isArray(args.taskIds)
              ? { taskId: { in: args.taskIds } }
              : {}),

            ...(Array.isArray(args.botIds)
              ? { botId: { in: args.botIds } }
              : {}),

            // @note placed here to ensure that the userId is always checked

            userId: context.session.user.id,
          },
        })
      },
    }),

    auditLogs: t.prismaConnection({
      type: AuditLog,
      cursor: 'id',
      description: 'Fetch audit logs for the current user',
      args: {
        meta: t.arg({
          type: 'JsonObject',
          required: false,
          description: 'Filter audit logs by metadata',
        }),
        auditLogIds: t.arg({
          type: ['ID'],
          required: false,
          description: 'Filter audit logs by their unique identifiers',
        }),
        actions: t.arg({
          type: ['String'],
          required: false,
          description: 'Filter audit logs by their actions',
        }),
        conversationIds: t.arg({
          type: ['ID'],
          required: false,
          description: 'Filter audit logs by conversation identifiers',
        }),
        taskIds: t.arg({
          type: ['ID'],
          required: false,
          description: 'Filter audit logs by task identifiers',
        }),
        botIds: t.arg({
          type: ['ID'],
          required: false,
          description: 'Filter audit logs by bot identifiers',
        }),
      },
      resolve: async (query, _root, args, context) => {
        return await prisma.auditLog.findMany({
          ...query,

          // @note prisma connection uses negative take value to paginate backwards
          // orderBy: { createdAt: 'desc' },

          where: {
            ...(Object.keys(args.meta || {}).length > 0
              ? {
                  AND: buildMetaQueryFilter(args.meta as Prisma.JsonObject),
                }
              : {}),

            ...(Array.isArray(args.auditLogIds)
              ? { id: { in: args.auditLogIds } }
              : {}),

            ...(Array.isArray(args.actions)
              ? { action: { in: args.actions } }
              : {}),

            ...(Array.isArray(args.conversationIds)
              ? { conversationId: { in: args.conversationIds } }
              : {}),

            ...(Array.isArray(args.taskIds)
              ? { taskId: { in: args.taskIds } }
              : {}),

            ...(Array.isArray(args.botIds)
              ? { botId: { in: args.botIds } }
              : {}),

            // @note placed here to ensure that the userId is always checked

            userId: context.session.user.id,
          },
        })
      },
    }),

    // resources

    bots: t.prismaConnection({
      type: Bot,
      cursor: 'id',
      args: {
        order: t.arg({
          type: ListOrder,
          required: false,
          defaultValue: 'desc',
          description: 'Order bots by creation time',
        }),
        visibility: t.arg({
          type: [BotVisibility],
          required: false,
          description: 'Filter bots by their visibility',
        }),
        meta: t.arg({
          type: 'JsonObject',
          required: false,
          description: 'Filter bots by metadata',
        }),
        botIds: t.arg({
          type: ['ID'],
          required: false,
          description: 'Filter bots by their unique identifiers',
        }),
        datasetIds: t.arg({
          type: ['ID'],
          required: false,
          description: 'Filter bots by dataset identifiers',
        }),
        skillsetIds: t.arg({
          type: ['ID'],
          required: false,
          description: 'Filter bots by skillset identifiers',
        }),
        blueprintIds: t.arg({
          type: ['ID'],
          required: false,
          description: 'Filter bots by blueprint identifiers',
        }),
      },
      resolve: async (query, _root, args, context) => {
        return await prisma.bot.findMany({
          ...query,

          orderBy: orderByCreation(args.order),

          where: {
            ...(Array.isArray(args.visibility)
              ? {
                  visibility: {
                    in: args.visibility as _BotVisibility[],
                  },
                }
              : {}),

            ...(Object.keys(args.meta || {}).length > 0
              ? {
                  AND: buildMetaQueryFilter(args.meta as Prisma.JsonObject),
                }
              : {}),

            ...(Array.isArray(args.botIds) ? { id: { in: args.botIds } } : {}),

            ...(Array.isArray(args.datasetIds)
              ? {
                  datasetId: { in: args.datasetIds },
                }
              : {}),

            ...(Array.isArray(args.skillsetIds)
              ? {
                  skillsetId: { in: args.skillsetIds },
                }
              : {}),

            ...(Array.isArray(args.blueprintIds)
              ? {
                  blueprintId: { in: args.blueprintIds },
                }
              : {}),

            // @note placed here to ensure that the userId is always checked

            userId: context.session.user.id,
          },
        })
      },
    }),

    datasets: t.prismaConnection({
      type: Dataset,
      cursor: 'id',
      args: {
        order: t.arg({
          type: ListOrder,
          required: false,
          defaultValue: 'desc',
          description: 'Order datasets by creation time',
        }),
        visibility: t.arg({
          type: [DatasetVisibility],
          required: false,
          description: 'Filter datasets by their visibility',
        }),
        meta: t.arg({
          type: 'JsonObject',
          required: false,
          description: 'Filter datasets by metadata',
        }),
        datasetIds: t.arg({
          type: ['ID'],
          required: false,
          description: 'Filter datasets by their unique identifiers',
        }),
        botIds: t.arg({
          type: ['ID'],
          required: false,
          description: 'Filter datasets by bot identifiers',
        }),
        blueprintIds: t.arg({
          type: ['ID'],
          required: false,
          description: 'Filter datasets by blueprint identifiers',
        }),
      },
      resolve: async (query, _root, args, context) => {
        return await prisma.dataset.findMany({
          ...query,

          orderBy: orderByCreation(args.order),

          where: {
            ...(Array.isArray(args.visibility)
              ? {
                  visibility: {
                    in: args.visibility as _DatasetVisibility[],
                  },
                }
              : {}),

            ...(Object.keys(args.meta || {}).length > 0
              ? {
                  AND: buildMetaQueryFilter(args.meta as Prisma.JsonObject),
                }
              : {}),

            ...(Array.isArray(args.datasetIds)
              ? { id: { in: args.datasetIds } }
              : {}),

            ...(Array.isArray(args.botIds)
              ? {
                  bots: {
                    some: {
                      id: { in: args.botIds },
                    },
                  },
                }
              : {}),

            ...(Array.isArray(args.blueprintIds)
              ? {
                  blueprintId: { in: args.blueprintIds },
                }
              : {}),

            // @note placed here to ensure that the userId is always checked

            userId: context.session.user.id,
          },
        })
      },
    }),

    skillsets: t.prismaConnection({
      type: Skillset,
      cursor: 'id',
      args: {
        order: t.arg({
          type: ListOrder,
          required: false,
          defaultValue: 'desc',
          description: 'Order skillsets by creation time',
        }),
        visibility: t.arg({
          type: [SkillsetVisibility],
          required: false,
          description: 'Filter skillsets by their visibility',
        }),
        meta: t.arg({
          type: 'JsonObject',
          required: false,
          description: 'Filter skillsets by metadata',
        }),
        skillsetIds: t.arg({
          type: ['ID'],
          required: false,
          description: 'Filter skillsets by their unique identifiers',
        }),
        botIds: t.arg({
          type: ['ID'],
          required: false,
          description: 'Filter skillsets by bot identifiers',
        }),
        blueprintIds: t.arg({
          type: ['ID'],
          required: false,
          description: 'Filter skillsets by blueprint identifiers',
        }),
      },
      resolve: async (query, _root, args, context) => {
        return await prisma.skillset.findMany({
          ...query,

          orderBy: orderByCreation(args.order),

          where: {
            ...(Array.isArray(args.visibility)
              ? {
                  visibility: {
                    in: args.visibility as _SkillsetVisibility[],
                  },
                }
              : {}),

            ...(Object.keys(args.meta || {}).length > 0
              ? {
                  AND: buildMetaQueryFilter(args.meta as Prisma.JsonObject),
                }
              : {}),

            ...(Array.isArray(args.skillsetIds)
              ? { id: { in: args.skillsetIds } }
              : {}),

            ...(Array.isArray(args.botIds)
              ? {
                  bots: {
                    some: {
                      id: { in: args.botIds },
                    },
                  },
                }
              : {}),

            ...(Array.isArray(args.blueprintIds)
              ? {
                  blueprintId: { in: args.blueprintIds },
                }
              : {}),

            // @note placed here to ensure that the userId is always checked

            userId: context.session.user.id,
          },
        })
      },
    }),

    secrets: t.prismaConnection({
      type: Secret,
      cursor: 'id',
      args: {
        order: t.arg({
          type: ListOrder,
          required: false,
          defaultValue: 'desc',
          description: 'Order secrets by creation time',
        }),
        type: t.arg({
          type: [SecretType],
          required: false,
          description: 'Filter secrets by type',
        }),
        kind: t.arg({
          type: [SecretKind],
          required: false,
          description: 'Filter secrets by kind',
        }),
        visibility: t.arg({
          type: [SecretVisibility],
          required: false,
          description: 'Filter secrets by their visibility',
        }),
        meta: t.arg({
          type: 'JsonObject',
          required: false,
          description: 'Filter secrets by metadata',
        }),
        secretIds: t.arg({
          type: ['ID'],
          required: false,
          description: 'Filter secrets by their unique identifiers',
        }),
        blueprintIds: t.arg({
          type: ['ID'],
          required: false,
          description: 'Filter secrets by blueprint identifiers',
        }),
        botIds: t.arg({
          type: ['ID'],
          required: false,
          description: 'Filter secrets by bot identifiers',
        }),
        skillsetIds: t.arg({
          type: ['ID'],
          required: false,
          description: 'Filter secrets by skillset identifiers',
        }),
        abilityIds: t.arg({
          type: ['ID'],
          required: false,
          description: 'Filter secrets by ability identifiers',
        }),
      },
      resolve: async (query, _root, args, context) => {
        return await prisma.secret.findMany({
          ...query,

          orderBy: orderByCreation(args.order),

          where: {
            ...(Array.isArray(args.type) ? { type: { in: args.type } } : {}),

            ...(Array.isArray(args.kind) ? { kind: { in: args.kind } } : {}),

            ...(Array.isArray(args.visibility)
              ? {
                  visibility: {
                    in: args.visibility as _SecretVisibility[],
                  },
                }
              : {}),

            ...(Object.keys(args.meta || {}).length > 0
              ? {
                  AND: buildMetaQueryFilter(args.meta as Prisma.JsonObject),
                }
              : {}),

            ...(Array.isArray(args.secretIds)
              ? { id: { in: args.secretIds } }
              : {}),

            ...(Array.isArray(args.blueprintIds)
              ? { blueprintId: { in: args.blueprintIds } }
              : {}),

            ...(Array.isArray(args.botIds)
              ? {
                  abilities: {
                    some: {
                      skillset: {
                        bots: {
                          some: {
                            id: { in: args.botIds },
                          },
                        },
                      },
                    },
                  },
                }
              : {}),

            ...(Array.isArray(args.skillsetIds)
              ? {
                  abilities: {
                    some: {
                      skillsetId: { in: args.skillsetIds },
                    },
                  },
                }
              : {}),

            ...(Array.isArray(args.abilityIds)
              ? {
                  abilities: {
                    some: {
                      id: { in: args.abilityIds },
                    },
                  },
                }
              : {}),

            // @note placed here to ensure that the userId is always checked

            userId: context.session.user.id,
          },
        })
      },
    }),

    policies: t.prismaConnection({
      type: Policy,
      cursor: 'id',
      args: {
        order: t.arg({
          type: ListOrder,
          required: false,
          defaultValue: 'desc',
          description: 'Order policies by creation time',
        }),
        type: t.arg({
          type: [PolicyType],
          required: false,
          description: 'Filter policies by type',
        }),
        meta: t.arg({
          type: 'JsonObject',
          required: false,
          description: 'Filter policies by metadata',
        }),
        policyIds: t.arg({
          type: ['ID'],
          required: false,
          description: 'Filter policies by their unique identifiers',
        }),
        botIds: t.arg({
          type: ['ID'],
          required: false,
          description: 'Filter policies by bot identifiers',
        }),
        blueprintIds: t.arg({
          type: ['ID'],
          required: false,
          description: 'Filter policies by blueprint identifiers',
        }),
      },
      resolve: async (query, _root, args, context) => {
        return await prisma.policy.findMany({
          ...query,

          orderBy: orderByCreation(args.order),

          where: {
            ...(Array.isArray(args.type) ? { type: { in: args.type } } : {}),

            ...(Object.keys(args.meta || {}).length > 0
              ? {
                  AND: buildMetaQueryFilter(args.meta as Prisma.JsonObject),
                }
              : {}),

            ...(Array.isArray(args.policyIds)
              ? { id: { in: args.policyIds } }
              : {}),

            ...(Array.isArray(args.botIds)
              ? { botId: { in: args.botIds } }
              : {}),

            ...(Array.isArray(args.blueprintIds)
              ? { blueprintId: { in: args.blueprintIds } }
              : {}),

            // @note placed here to ensure that the userId is always checked

            userId: context.session.user.id,
          },
        })
      },
    }),

    contexts: t.prismaConnection({
      type: Context,
      cursor: 'id',
      args: {
        meta: t.arg({
          type: 'JsonObject',
          required: false,
          description: 'Filter contexts by metadata',
        }),
        contextIds: t.arg({
          type: ['ID'],
          required: false,
          description: 'Filter contexts by their unique identifiers',
        }),
        blueprintIds: t.arg({
          type: ['ID'],
          required: false,
          description: 'Filter contexts by blueprint identifiers',
        }),
        botIds: t.arg({
          type: ['ID'],
          required: false,
          description: 'Filter contexts by bot identifiers',
        }),
        datasetIds: t.arg({
          type: ['ID'],
          required: false,
          description: 'Filter contexts by dataset identifiers',
        }),
        skillsetIds: t.arg({
          type: ['ID'],
          required: false,
          description: 'Filter contexts by skillset identifiers',
        }),
      },
      resolve: async (query, _root, args, context) => {
        return await prisma.context.findMany({
          ...query,

          where: {
            ...(Object.keys(args.meta || {}).length > 0
              ? {
                  AND: buildMetaQueryFilter(args.meta as Prisma.JsonObject),
                }
              : {}),

            ...(Array.isArray(args.contextIds)
              ? { id: { in: args.contextIds } }
              : {}),

            ...(Array.isArray(args.blueprintIds)
              ? { blueprintId: { in: args.blueprintIds } }
              : {}),

            ...(Array.isArray(args.botIds)
              ? { botId: { in: args.botIds } }
              : {}),

            ...(Array.isArray(args.datasetIds)
              ? { datasetId: { in: args.datasetIds } }
              : {}),

            ...(Array.isArray(args.skillsetIds)
              ? { skillsetId: { in: args.skillsetIds } }
              : {}),

            // @note placed here to ensure that the userId is always checked

            userId: context.session.user.id,
          },
        })
      },
    }),

    files: t.prismaConnection({
      type: File,
      cursor: 'id',
      args: {
        order: t.arg({
          type: ListOrder,
          required: false,
          defaultValue: 'desc',
          description: 'Order files by creation time',
        }),
        visibility: t.arg({
          type: [FileVisibility],
          required: false,
          description: 'Filter files by their visibility',
        }),
        meta: t.arg({
          type: 'JsonObject',
          required: false,
          description: 'Filter files by metadata',
        }),
        fileIds: t.arg({
          type: ['ID'],
          required: false,
          description: 'Filter files by their unique identifiers',
        }),
        blueprintIds: t.arg({
          type: ['ID'],
          required: false,
          description: 'Filter files by blueprint identifiers',
        }),
      },
      resolve: async (query, _root, args, context) => {
        return await prisma.file.findMany({
          ...query,

          orderBy: orderByCreation(args.order),

          where: {
            ...(Array.isArray(args.visibility)
              ? {
                  visibility: {
                    in: args.visibility as _FileVisibility[],
                  },
                }
              : {}),

            ...(Object.keys(args.meta || {}).length > 0
              ? {
                  AND: buildMetaQueryFilter(args.meta as Prisma.JsonObject),
                }
              : {}),

            ...(Array.isArray(args.fileIds)
              ? { id: { in: args.fileIds } }
              : {}),

            ...(Array.isArray(args.blueprintIds)
              ? { blueprintId: { in: args.blueprintIds } }
              : {}),

            // @note placed here to ensure that the userId is always checked

            userId: context.session.user.id,
          },
        })
      },
    }),

    portals: t.prismaConnection({
      type: Portal,
      cursor: 'id',
      args: {
        order: t.arg({
          type: ListOrder,
          required: false,
          defaultValue: 'desc',
          description: 'Order portals by creation time',
        }),
        // @note not yet supported
        // visibility: t.arg({
        //   type: [PortalVisibility],
        //   required: false,
        //   description: 'Filter portals by their visibility',
        // }),
        meta: t.arg({
          type: 'JsonObject',
          required: false,
          description: 'Filter portals by metadata',
        }),
        portalIds: t.arg({
          type: ['ID'],
          required: false,
          description: 'Filter portals by their unique identifiers',
        }),
        blueprintIds: t.arg({
          type: ['ID'],
          required: false,
          description: 'Filter portals by blueprint identifiers',
        }),
      },
      resolve: async (query, _root, args, context) => {
        return await prisma.portal.findMany({
          ...query,

          orderBy: orderByCreation(args.order),

          where: {
            // @note not yet supported
            // ...(Array.isArray(args.visibility)
            //   ? {
            //       visibility: {
            //         in: args.visibility as _PortalVisibility[],
            //       },
            //     }
            //   : {}),

            ...(Object.keys(args.meta || {}).length > 0
              ? {
                  AND: buildMetaQueryFilter(args.meta as Prisma.JsonObject),
                }
              : {}),

            ...(Array.isArray(args.portalIds)
              ? { id: { in: args.portalIds } }
              : {}),

            ...(Array.isArray(args.blueprintIds)
              ? { blueprintId: { in: args.blueprintIds } }
              : {}),

            // @note placed here to ensure that the userId is always checked

            userId: context.session.user.id,
          },
        })
      },
    }),

    // projects: related

    relatedBlueprints: t.prismaConnection({
      type: ContextBlueprint,
      cursor: 'id',
      description: 'Fetch the blueprints visible to the user in the context',
      args: {
        visibility: t.arg({
          type: [ContextBlueprintVisibility],
          required: false,
          description:
            'Filter blueprints by their visibility in the context of the user',
          defaultValue: [_BlueprintVisibility.protected],
        }),
        meta: t.arg({
          type: 'JsonObject',
          required: false,
          description: 'Filter blueprints by metadata',
        }),
        blueprintIds: t.arg({
          type: ['ID'],
          required: false,
          description: 'Filter blueprints by their unique identifiers',
        }),
        includeOwn: t.arg({
          type: builder.inputType('IncludeOwnBlueprintsInput', {
            fields: (t) => ({
              visibility: t.field({
                type: [BlueprintVisibility],
                required: false,
                description: 'Visibility of the own blueprints to include',
                defaultValue: [_BlueprintVisibility.protected],
              }),
              meta: t.field({
                type: 'JsonObject',
                required: false,
                description: 'Filter own blueprints by metadata',
              }),
            }),
          }),
        }),
      },
      resolve: async (query, _root, args, context) => {
        const relatedUsers = await getRelatedUsers(context.session.user)

        const whereClauses: Prisma.BlueprintWhereInput[] = []

        if (relatedUsers.length > 0) {
          whereClauses.push({
            visibility: {
              in: (args.visibility || [
                _BlueprintVisibility.protected,
              ]) as _BlueprintVisibility[],
            },

            ...(Object.keys(args.meta || {}).length > 0
              ? {
                  AND: buildMetaQueryFilter(args.meta as Prisma.JsonObject),
                }
              : {}),

            ...(Array.isArray(args.blueprintIds)
              ? { id: { in: args.blueprintIds } }
              : {}),

            // @note placed here to ensure that the userId is always checked

            userId: { in: relatedUsers.map((user) => user.id) },
          })
        }

        if (args.includeOwn) {
          whereClauses.push({
            visibility: {
              in: (args.includeOwn.visibility || [
                _BlueprintVisibility.protected,
              ]) as _BlueprintVisibility[],
            },

            ...(Object.keys(args.includeOwn.meta || args.meta || {}).length > 0
              ? {
                  AND: buildMetaQueryFilter(
                    (args.includeOwn.meta || args.meta) as Prisma.JsonObject
                  ),
                }
              : {}),

            ...(Array.isArray(args.blueprintIds)
              ? { id: { in: args.blueprintIds } }
              : {}),

            // @note placed here to ensure that the userId is always checked

            userId: context.session.user.id,
          })
        }

        if (whereClauses.length === 0) {
          return []
        }

        return await prisma.blueprint.findMany({
          ...query,

          // @note prisma connection uses negative take value to paginate backwards
          // orderBy: { createdAt: 'desc' },

          where: {
            OR: whereClauses,
          },
        })
      },
    }),

    // resources: related

    relatedBots: t.prismaConnection({
      type: ContextBot,
      cursor: 'id',
      description: 'Fetch the bots visible to the user in the context',
      args: {
        visibility: t.arg({
          type: [ContextBotVisibility],
          required: false,
          description:
            'Filter bots by their visibility in the context of the user',
          defaultValue: [_BotVisibility.protected],
        }),
        meta: t.arg({
          type: 'JsonObject',
          required: false,
          description: 'Filter bots by metadata',
        }),
        botIds: t.arg({
          type: ['ID'],
          required: false,
          description: 'Filter bots by their unique identifiers',
        }),
        datasetIds: t.arg({
          type: ['ID'],
          required: false,
          description: 'Filter bots by dataset identifiers',
        }),
        skillsetIds: t.arg({
          type: ['ID'],
          required: false,
          description: 'Filter bots by skillset identifiers',
        }),
        includeOwn: t.arg({
          type: builder.inputType('IncludeOwnBotsInput', {
            fields: (t) => ({
              visibility: t.field({
                type: [BotVisibility],
                required: false,
                description: 'Visibility of the own bots to include',
                defaultValue: [_BotVisibility.protected],
              }),
              meta: t.field({
                type: 'JsonObject',
                required: false,
                description: 'Filter own bots by metadata',
              }),
            }),
          }),
        }),
      },
      resolve: async (query, _root, args, context) => {
        const relatedUsers = await getRelatedUsers(context.session.user)

        const whereClauses: Prisma.BotWhereInput[] = []

        if (relatedUsers.length > 0) {
          whereClauses.push({
            visibility: {
              in: (args.visibility || [
                _BotVisibility.protected,
              ]) as _BotVisibility[],
            },

            ...(Object.keys(args.meta || {}).length > 0
              ? {
                  AND: buildMetaQueryFilter(args.meta as Prisma.JsonObject),
                }
              : {}),

            ...(Array.isArray(args.botIds) ? { id: { in: args.botIds } } : {}),

            // @note placed here to ensure that the userId is always checked

            userId: { in: relatedUsers.map((user) => user.id) },
          })
        }

        if (args.includeOwn) {
          whereClauses.push({
            visibility: {
              in: (args.includeOwn.visibility || [
                _BotVisibility.protected,
              ]) as _BotVisibility[],
            },

            ...(Object.keys(args.includeOwn.meta || args.meta || {}).length > 0
              ? {
                  AND: buildMetaQueryFilter(
                    (args.includeOwn.meta || args.meta) as Prisma.JsonObject
                  ),
                }
              : {}),

            ...(Array.isArray(args.botIds) ? { id: { in: args.botIds } } : {}),

            // @note placed here to ensure that the userId is always checked

            userId: context.session.user.id,
          })
        }

        if (whereClauses.length === 0) {
          return []
        }

        return await prisma.bot.findMany({
          ...query,

          // @note prisma connection uses negative take value to paginate backwards
          // orderBy: { createdAt: 'desc' },

          where: {
            OR: whereClauses,

            ...(Array.isArray(args.datasetIds)
              ? {
                  datasetId: { in: args.datasetIds },
                }
              : {}),

            ...(Array.isArray(args.skillsetIds)
              ? {
                  skillsetId: { in: args.skillsetIds },
                }
              : {}),
          },
        })
      },
    }),

    relatedDatasets: t.prismaConnection({
      type: ContextDataset,
      cursor: 'id',
      description: 'Fetch the datasets visible to the user in the context',
      args: {
        visibility: t.arg({
          type: [ContextDatasetVisibility],
          required: false,
          description:
            'Filter datasets by their visibility in the context of the user',
          defaultValue: [_DatasetVisibility.protected],
        }),
        meta: t.arg({
          type: 'JsonObject',
          required: false,
          description: 'Filter datasets by metadata',
        }),
        datasetIds: t.arg({
          type: ['ID'],
          required: false,
          description: 'Filter datasets by their unique identifiers',
        }),
        botIds: t.arg({
          type: ['ID'],
          required: false,
          description: 'Filter datasets by bot identifiers',
        }),
        includeOwn: t.arg({
          type: builder.inputType('IncludeOwnDatasetsInput', {
            fields: (t) => ({
              visibility: t.field({
                type: [DatasetVisibility],
                required: false,
                description: 'Visibility of the own datasets to include',
                defaultValue: [_DatasetVisibility.protected],
              }),
              meta: t.field({
                type: 'JsonObject',
                required: false,
                description: 'Filter own datasets by metadata',
              }),
            }),
          }),
        }),
      },
      resolve: async (query, _root, args, context) => {
        const relatedUsers = await getRelatedUsers(context.session.user)

        const whereClauses: Prisma.DatasetWhereInput[] = []

        if (relatedUsers.length > 0) {
          whereClauses.push({
            visibility: {
              in: (args.visibility || [
                _DatasetVisibility.protected,
              ]) as _DatasetVisibility[],
            },

            ...(Object.keys(args.meta || {}).length > 0
              ? {
                  AND: buildMetaQueryFilter(args.meta as Prisma.JsonObject),
                }
              : {}),

            ...(Array.isArray(args.datasetIds)
              ? { id: { in: args.datasetIds } }
              : {}),

            ...(Array.isArray(args.botIds)
              ? {
                  bots: {
                    some: {
                      id: { in: args.botIds },
                    },
                  },
                }
              : {}),

            // @note placed here to ensure that the userId is always checked

            userId: { in: relatedUsers.map((user) => user.id) },
          })
        }

        if (args.includeOwn) {
          whereClauses.push({
            visibility: {
              in: (args.includeOwn.visibility || [
                _DatasetVisibility.protected,
              ]) as _DatasetVisibility[],
            },

            ...(Object.keys(args.includeOwn.meta || args.meta || {}).length > 0
              ? {
                  AND: buildMetaQueryFilter(
                    (args.includeOwn.meta || args.meta) as Prisma.JsonObject
                  ),
                }
              : {}),

            ...(Array.isArray(args.datasetIds)
              ? { id: { in: args.datasetIds } }
              : {}),

            // @note placed here to ensure that the userId is always checked

            userId: context.session.user.id,
          })
        }

        if (whereClauses.length === 0) {
          return []
        }

        return await prisma.dataset.findMany({
          ...query,

          // @note prisma connection uses negative take value to paginate backwards
          // orderBy: { createdAt: 'desc' },

          where: {
            OR: whereClauses,

            ...(Array.isArray(args.botIds)
              ? {
                  bots: {
                    some: {
                      id: { in: args.botIds },
                    },
                  },
                }
              : {}),
          },
        })
      },
    }),

    relatedSkillsets: t.prismaConnection({
      type: ContextSkillset,
      cursor: 'id',
      description: 'Fetch the skillsets visible to the user in the context',
      args: {
        visibility: t.arg({
          type: [ContextSkillsetVisibility],
          required: false,
          description:
            'Filter skillsets by their visibility in the context of the user',
          defaultValue: [_SkillsetVisibility.protected],
        }),
        meta: t.arg({
          type: 'JsonObject',
          required: false,
          description: 'Filter skillsets by metadata',
        }),
        skillsetIds: t.arg({
          type: ['ID'],
          required: false,
          description: 'Filter skillsets by their unique identifiers',
        }),
        botIds: t.arg({
          type: ['ID'],
          required: false,
          description: 'Filter skillsets by bot identifiers',
        }),
        includeOwn: t.arg({
          type: builder.inputType('IncludeOwnSkillsetsInput', {
            fields: (t) => ({
              visibility: t.field({
                type: [SkillsetVisibility],
                required: false,
                description: 'Visibility of the own skillsets to include',
                defaultValue: [_SkillsetVisibility.protected],
              }),
              meta: t.field({
                type: 'JsonObject',
                required: false,
                description: 'Filter own skillsets by metadata',
              }),
            }),
          }),
        }),
      },
      resolve: async (query, _root, args, context) => {
        const relatedUsers = await getRelatedUsers(context.session.user)

        const whereClauses: Prisma.SkillsetWhereInput[] = []

        if (relatedUsers.length > 0) {
          whereClauses.push({
            visibility: {
              in: (args.visibility || [
                _SkillsetVisibility.protected,
              ]) as _SkillsetVisibility[],
            },

            ...(Object.keys(args.meta || {}).length > 0
              ? {
                  AND: buildMetaQueryFilter(args.meta as Prisma.JsonObject),
                }
              : {}),

            ...(Array.isArray(args.skillsetIds)
              ? { id: { in: args.skillsetIds } }
              : {}),

            // @note placed here to ensure that the userId is always checked

            userId: { in: relatedUsers.map((user) => user.id) },
          })
        }

        if (args.includeOwn) {
          whereClauses.push({
            visibility: {
              in: (args.includeOwn.visibility || [
                _SkillsetVisibility.protected,
              ]) as _SkillsetVisibility[],
            },

            ...(Object.keys(args.includeOwn.meta || args.meta || {}).length > 0
              ? {
                  AND: buildMetaQueryFilter(
                    (args.includeOwn.meta || args.meta) as Prisma.JsonObject
                  ),
                }
              : {}),

            ...(Array.isArray(args.skillsetIds)
              ? { id: { in: args.skillsetIds } }
              : {}),

            // @note placed here to ensure that the userId is always checked

            userId: context.session.user.id,
          })
        }

        if (whereClauses.length === 0) {
          return []
        }

        return await prisma.skillset.findMany({
          ...query,

          // @note prisma connection uses negative take value to paginate backwards
          // orderBy: { createdAt: 'desc' },

          where: {
            OR: whereClauses,

            ...(Array.isArray(args.botIds)
              ? {
                  bots: {
                    some: {
                      id: { in: args.botIds },
                    },
                  },
                }
              : {}),
          },
        })
      },
    }),

    relatedFiles: t.prismaConnection({
      type: ContextFile,
      cursor: 'id',
      description: 'Fetch the files visible to the user in the context',
      args: {
        visibility: t.arg({
          type: [ContextFileVisibility],
          required: false,
          description:
            'Filter files by their visibility in the context of the user',
          defaultValue: [_FileVisibility.protected],
        }),
        meta: t.arg({
          type: 'JsonObject',
          required: false,
          description: 'Filter files by metadata',
        }),
        fileIds: t.arg({
          type: ['ID'],
          required: false,
          description: 'Filter files by their unique identifiers',
        }),
        includeOwn: t.arg({
          type: builder.inputType('IncludeOwnFilesInput', {
            fields: (t) => ({
              visibility: t.field({
                type: [FileVisibility],
                required: false,
                description: 'Visibility of the own files to include',
                defaultValue: [_FileVisibility.protected],
              }),
              meta: t.field({
                type: 'JsonObject',
                required: false,
                description: 'Filter own files by metadata',
              }),
            }),
          }),
        }),
      },
      resolve: async (query, _root, args, context) => {
        const relatedUsers = await getRelatedUsers(context.session.user)

        const whereClauses: Prisma.FileWhereInput[] = []

        if (relatedUsers.length > 0) {
          whereClauses.push({
            visibility: {
              in: (args.visibility || [
                _FileVisibility.protected,
              ]) as _FileVisibility[],
            },

            ...(Object.keys(args.meta || {}).length > 0
              ? {
                  AND: buildMetaQueryFilter(args.meta as Prisma.JsonObject),
                }
              : {}),

            ...(Array.isArray(args.fileIds)
              ? { id: { in: args.fileIds } }
              : {}),

            // @note placed here to ensure that the userId is always checked

            userId: { in: relatedUsers.map((user) => user.id) },
          })
        }

        if (args.includeOwn) {
          whereClauses.push({
            visibility: {
              in: (args.includeOwn.visibility || [
                _FileVisibility.protected,
              ]) as _FileVisibility[],
            },

            ...(Object.keys(args.includeOwn.meta || args.meta || {}).length > 0
              ? {
                  AND: buildMetaQueryFilter(
                    (args.includeOwn.meta || args.meta) as Prisma.JsonObject
                  ),
                }
              : {}),

            ...(Array.isArray(args.fileIds)
              ? { id: { in: args.fileIds } }
              : {}),

            // @note placed here to ensure that the userId is always checked

            userId: context.session.user.id,
          })
        }

        if (whereClauses.length === 0) {
          return []
        }

        return await prisma.file.findMany({
          ...query,

          // @note prisma connection uses negative take value to paginate backwards
          // orderBy: { createdAt: 'desc' },

          where: {
            OR: whereClauses,
          },
        })
      },
    }),

    relatedSecrets: t.prismaConnection({
      type: ContextSecret,
      cursor: 'id',
      description: 'Fetch the secrets visible to the user in the context',
      args: {
        type: t.arg({
          type: [ContextSecretType],
          required: false,
          description: 'Filter secrets by type',
        }),
        kind: t.arg({
          type: [ContextSecretKind],
          required: false,
          description: 'Filter secrets by kind',
        }),
        visibility: t.arg({
          type: [ContextSecretVisibility],
          required: false,
          description:
            'Filter secrets by their visibility in the context of the user',
          defaultValue: [_SecretVisibility.protected],
        }),
        meta: t.arg({
          type: 'JsonObject',
          required: false,
          description: 'Filter secrets by metadata',
        }),
        secretIds: t.arg({
          type: ['ID'],
          required: false,
          description: 'Filter secrets by their unique identifiers',
        }),
        botIds: t.arg({
          type: ['ID'],
          required: false,
          description: 'Filter secrets by bot identifiers',
        }),
        skillsetIds: t.arg({
          type: ['ID'],
          required: false,
          description: 'Filter secrets by skillset identifiers',
        }),
        abilityIds: t.arg({
          type: ['ID'],
          required: false,
          description: 'Filter secrets by ability identifiers',
        }),
        includeOwn: t.arg({
          type: builder.inputType('IncludeOwnSecretsInput', {
            fields: (t) => ({
              type: t.field({
                type: [SecretType],
                required: false,
                description: 'Filter own secrets by type',
              }),
              kind: t.field({
                type: [SecretKind],
                required: false,
                description: 'Filter secrets by kind',
              }),
              visibility: t.field({
                type: [SecretVisibility],
                required: false,
                description: 'Visibility of the own secrets to include',
                defaultValue: [_SecretVisibility.protected],
              }),
              meta: t.field({
                type: 'JsonObject',
                required: false,
                description: 'Filter own secrets by metadata',
              }),
            }),
          }),
        }),
      },
      resolve: async (query, _root, args, context) => {
        const relatedUsers = await getRelatedUsers(context.session.user)

        const whereClauses: Prisma.SecretWhereInput[] = []

        if (relatedUsers.length > 0) {
          whereClauses.push({
            ...(args.type ? { type: { in: args.type } } : {}),

            kind: {
              in: (args.kind || [_SecretKind.personal]) as _SecretKind[],
            },

            visibility: {
              in: (args.visibility || [
                _SecretVisibility.protected,
              ]) as _SecretVisibility[],
            },

            ...(Object.keys(args.meta || {}).length > 0
              ? {
                  AND: buildMetaQueryFilter(args.meta as Prisma.JsonObject),
                }
              : {}),

            ...(Array.isArray(args.secretIds)
              ? { id: { in: args.secretIds } }
              : {}),

            // @note placed here to ensure that the userId is always checked

            userId: { in: relatedUsers.map((user) => user.id) },
          })
        }

        if (args.includeOwn) {
          whereClauses.push({
            ...(args.includeOwn.type
              ? { type: { in: args.includeOwn.type } }
              : {}),

            kind: {
              in: (args.includeOwn.kind || [
                _SecretKind.personal,
              ]) as _SecretKind[],
            },

            visibility: {
              in: (args.includeOwn.visibility || [
                _SecretVisibility.protected,
              ]) as _SecretVisibility[],
            },

            ...(Object.keys(args.includeOwn.meta || args.meta || {}).length > 0
              ? {
                  AND: buildMetaQueryFilter(
                    (args.includeOwn.meta || args.meta) as Prisma.JsonObject
                  ),
                }
              : {}),

            ...(Array.isArray(args.secretIds)
              ? { id: { in: args.secretIds } }
              : {}),

            // @note placed here to ensure that the userId is always checked

            userId: context.session.user.id,
          })
        }

        if (whereClauses.length === 0) {
          return []
        }

        return await prisma.secret.findMany({
          ...query,

          // @note prisma connection uses negative take value to paginate backwards
          // orderBy: { createdAt: 'desc' },

          where: {
            OR: whereClauses,

            ...(Array.isArray(args.botIds)
              ? {
                  abilities: {
                    some: {
                      skillset: {
                        bots: {
                          some: {
                            id: { in: args.botIds },
                          },
                        },
                      },
                    },
                  },
                }
              : {}),

            ...(Array.isArray(args.skillsetIds)
              ? {
                  abilities: {
                    some: {
                      skillsetId: { in: args.skillsetIds },
                    },
                  },
                }
              : {}),

            ...(Array.isArray(args.abilityIds)
              ? {
                  abilities: {
                    some: {
                      id: { in: args.abilityIds },
                    },
                  },
                }
              : {}),
          },
        })
      },
    }),

    // @todo add portals when it supports the visibility property

    // integrations

    widgetIntegrations: t.prismaConnection({
      type: WidgetIntegration,
      cursor: 'id',
      args: {
        order: t.arg({
          type: ListOrder,
          required: false,
          defaultValue: 'desc',
          description: 'Order widget integrations by creation time',
        }),
        blueprintIds: t.arg({
          type: ['ID'],
          required: false,
          description: 'Filter widget integrations by blueprint identifiers',
        }),
        meta: t.arg({
          type: 'JsonObject',
          required: false,
          description: 'Filter widget integrations by metadata',
        }),
      },
      resolve: async (query, _root, args, context) => {
        return await prisma.widgetIntegration.findMany({
          ...query,

          orderBy: orderByCreation(args.order),

          where: {
            ...(Array.isArray(args.blueprintIds)
              ? { blueprintId: { in: args.blueprintIds } }
              : {}),

            ...(Object.keys(args.meta || {}).length > 0
              ? {
                  AND: buildMetaQueryFilter(args.meta as Prisma.JsonObject),
                }
              : {}),

            // @note placed here to ensure that the userId is always checked

            userId: context.session.user.id,
          },
        })
      },
    }),

    slackIntegrations: t.prismaConnection({
      type: SlackIntegration,
      cursor: 'id',
      args: {
        order: t.arg({
          type: ListOrder,
          required: false,
          defaultValue: 'desc',
          description: 'Order slack integrations by creation time',
        }),
        blueprintIds: t.arg({
          type: ['ID'],
          required: false,
          description: 'Filter slack integrations by blueprint identifiers',
        }),
        meta: t.arg({
          type: 'JsonObject',
          required: false,
          description: 'Filter slack integrations by metadata',
        }),
      },
      resolve: async (query, _root, args, context) => {
        return await prisma.slackIntegration.findMany({
          ...query,

          orderBy: orderByCreation(args.order),

          where: {
            ...(Array.isArray(args.blueprintIds)
              ? { blueprintId: { in: args.blueprintIds } }
              : {}),

            ...(Object.keys(args.meta || {}).length > 0
              ? {
                  AND: buildMetaQueryFilter(args.meta as Prisma.JsonObject),
                }
              : {}),

            // @note placed here to ensure that the userId is always checked

            userId: context.session.user.id,
          },
        })
      },
    }),

    discordIntegrations: t.prismaConnection({
      type: DiscordIntegration,
      cursor: 'id',
      args: {
        order: t.arg({
          type: ListOrder,
          required: false,
          defaultValue: 'desc',
          description: 'Order discord integrations by creation time',
        }),
        blueprintIds: t.arg({
          type: ['ID'],
          required: false,
          description: 'Filter discord integrations by blueprint identifiers',
        }),
        meta: t.arg({
          type: 'JsonObject',
          required: false,
          description: 'Filter discord integrations by metadata',
        }),
      },
      resolve: async (query, _root, args, context) => {
        return await prisma.discordIntegration.findMany({
          ...query,

          orderBy: orderByCreation(args.order),

          where: {
            ...(Array.isArray(args.blueprintIds)
              ? { blueprintId: { in: args.blueprintIds } }
              : {}),

            ...(Object.keys(args.meta || {}).length > 0
              ? {
                  AND: buildMetaQueryFilter(args.meta as Prisma.JsonObject),
                }
              : {}),

            // @note placed here to ensure that the userId is always checked

            userId: context.session.user.id,
          },
        })
      },
    }),

    whatsappIntegrations: t.prismaConnection({
      type: WhatsappIntegration,
      cursor: 'id',
      args: {
        order: t.arg({
          type: ListOrder,
          required: false,
          defaultValue: 'desc',
          description: 'Order whatsapp integrations by creation time',
        }),
        blueprintIds: t.arg({
          type: ['ID'],
          required: false,
          description: 'Filter whatsapp integrations by blueprint identifiers',
        }),
        meta: t.arg({
          type: 'JsonObject',
          required: false,
          description: 'Filter whatsapp integrations by metadata',
        }),
      },
      resolve: async (query, _root, args, context) => {
        return await prisma.whatsappIntegration.findMany({
          ...query,

          orderBy: orderByCreation(args.order),

          where: {
            ...(Array.isArray(args.blueprintIds)
              ? { blueprintId: { in: args.blueprintIds } }
              : {}),

            ...(Object.keys(args.meta || {}).length > 0
              ? {
                  AND: buildMetaQueryFilter(args.meta as Prisma.JsonObject),
                }
              : {}),

            // @note placed here to ensure that the userId is always checked

            userId: context.session.user.id,
          },
        })
      },
    }),

    messengerIntegrations: t.prismaConnection({
      type: MessengerIntegration,
      cursor: 'id',
      args: {
        order: t.arg({
          type: ListOrder,
          required: false,
          defaultValue: 'desc',
          description: 'Order messenger integrations by creation time',
        }),
        blueprintIds: t.arg({
          type: ['ID'],
          required: false,
          description: 'Filter messenger integrations by blueprint identifiers',
        }),
        meta: t.arg({
          type: 'JsonObject',
          required: false,
          description: 'Filter messenger integrations by metadata',
        }),
      },
      resolve: async (query, _root, args, context) => {
        return await prisma.messengerIntegration.findMany({
          ...query,

          orderBy: orderByCreation(args.order),

          where: {
            ...(Array.isArray(args.blueprintIds)
              ? { blueprintId: { in: args.blueprintIds } }
              : {}),

            ...(Object.keys(args.meta || {}).length > 0
              ? {
                  AND: buildMetaQueryFilter(args.meta as Prisma.JsonObject),
                }
              : {}),

            // @note placed here to ensure that the userId is always checked

            userId: context.session.user.id,
          },
        })
      },
    }),

    instagramIntegrations: t.prismaConnection({
      type: InstagramIntegration,
      cursor: 'id',
      args: {
        order: t.arg({
          type: ListOrder,
          required: false,
          defaultValue: 'desc',
          description: 'Order instagram integrations by creation time',
        }),
        blueprintIds: t.arg({
          type: ['ID'],
          required: false,
          description: 'Filter instagram integrations by blueprint identifiers',
        }),
        meta: t.arg({
          type: 'JsonObject',
          required: false,
          description: 'Filter instagram integrations by metadata',
        }),
      },
      resolve: async (query, _root, args, context) => {
        return await prisma.instagramIntegration.findMany({
          ...query,

          orderBy: orderByCreation(args.order),

          where: {
            ...(Array.isArray(args.blueprintIds)
              ? { blueprintId: { in: args.blueprintIds } }
              : {}),

            ...(Object.keys(args.meta || {}).length > 0
              ? {
                  AND: buildMetaQueryFilter(args.meta as Prisma.JsonObject),
                }
              : {}),

            // @note placed here to ensure that the userId is always checked

            userId: context.session.user.id,
          },
        })
      },
    }),

    telegramIntegrations: t.prismaConnection({
      type: TelegramIntegration,
      cursor: 'id',
      args: {
        order: t.arg({
          type: ListOrder,
          required: false,
          defaultValue: 'desc',
          description: 'Order telegram integrations by creation time',
        }),
        blueprintIds: t.arg({
          type: ['ID'],
          required: false,
          description: 'Filter telegram integrations by blueprint identifiers',
        }),
        meta: t.arg({
          type: 'JsonObject',
          required: false,
          description: 'Filter telegram integrations by metadata',
        }),
      },
      resolve: async (query, _root, args, context) => {
        return await prisma.telegramIntegration.findMany({
          ...query,

          orderBy: orderByCreation(args.order),

          where: {
            ...(Array.isArray(args.blueprintIds)
              ? { blueprintId: { in: args.blueprintIds } }
              : {}),

            ...(Object.keys(args.meta || {}).length > 0
              ? {
                  AND: buildMetaQueryFilter(args.meta as Prisma.JsonObject),
                }
              : {}),

            // @note placed here to ensure that the userId is always checked

            userId: context.session.user.id,
          },
        })
      },
    }),

    twilioIntegrations: t.prismaConnection({
      type: TwilioIntegration,
      cursor: 'id',
      args: {
        order: t.arg({
          type: ListOrder,
          required: false,
          defaultValue: 'desc',
          description: 'Order telegram integrations by creation time',
        }),
        blueprintIds: t.arg({
          type: ['ID'],
          required: false,
          description: 'Filter telegram integrations by blueprint identifiers',
        }),
        meta: t.arg({
          type: 'JsonObject',
          required: false,
          description: 'Filter telegram integrations by metadata',
        }),
      },
      resolve: async (query, _root, args, context) => {
        return await prisma.twilioIntegration.findMany({
          ...query,

          orderBy: orderByCreation(args.order),

          where: {
            ...(Array.isArray(args.blueprintIds)
              ? { blueprintId: { in: args.blueprintIds } }
              : {}),

            ...(Object.keys(args.meta || {}).length > 0
              ? {
                  AND: buildMetaQueryFilter(args.meta as Prisma.JsonObject),
                }
              : {}),

            // @note placed here to ensure that the userId is always checked

            userId: context.session.user.id,
          },
        })
      },
    }),

    microsoftteamsIntegrations: t.prismaConnection({
      type: MicrosoftteamsIntegration,
      cursor: 'id',
      args: {
        order: t.arg({
          type: ListOrder,
          required: false,
          defaultValue: 'desc',
          description: 'Order Microsoft Teams integrations by creation time',
        }),
        blueprintIds: t.arg({
          type: ['ID'],
          required: false,
          description:
            'Filter Microsoft Teams integrations by blueprint identifiers',
        }),
        meta: t.arg({
          type: 'JsonObject',
          required: false,
          description: 'Filter Microsoft Teams integrations by metadata',
        }),
      },
      resolve: async (query, _root, args, context) => {
        return await prisma.microsoftteamsIntegration.findMany({
          ...query,

          orderBy: orderByCreation(args.order),

          where: {
            ...(Array.isArray(args.blueprintIds)
              ? { blueprintId: { in: args.blueprintIds } }
              : {}),

            ...(Object.keys(args.meta || {}).length > 0
              ? {
                  AND: buildMetaQueryFilter(args.meta as Prisma.JsonObject),
                }
              : {}),

            // @note placed here to ensure that the userId is always checked

            userId: context.session.user.id,
          },
        })
      },
    }),

    googlechatIntegrations: t.prismaConnection({
      type: GooglechatIntegration,
      cursor: 'id',
      args: {
        order: t.arg({
          type: ListOrder,
          required: false,
          defaultValue: 'desc',
          description: 'Order Google Chat integrations by creation time',
        }),
        blueprintIds: t.arg({
          type: ['ID'],
          required: false,
          description:
            'Filter Google Chat integrations by blueprint identifiers',
        }),
        meta: t.arg({
          type: 'JsonObject',
          required: false,
          description: 'Filter Google Chat integrations by metadata',
        }),
      },
      resolve: async (query, _root, args, context) => {
        return await prisma.googlechatIntegration.findMany({
          ...query,

          orderBy: orderByCreation(args.order),

          where: {
            ...(Array.isArray(args.blueprintIds)
              ? { blueprintId: { in: args.blueprintIds } }
              : {}),

            ...(Object.keys(args.meta || {}).length > 0
              ? {
                  AND: buildMetaQueryFilter(args.meta as Prisma.JsonObject),
                }
              : {}),

            // @note placed here to ensure that the userId is always checked

            userId: context.session.user.id,
          },
        })
      },
    }),

    emailIntegrations: t.prismaConnection({
      type: EmailIntegration,
      cursor: 'id',
      args: {
        order: t.arg({
          type: ListOrder,
          required: false,
          defaultValue: 'desc',
          description: 'Order email integrations by creation time',
        }),
        blueprintIds: t.arg({
          type: ['ID'],
          required: false,
          description: 'Filter email integrations by blueprint identifiers',
        }),
        meta: t.arg({
          type: 'JsonObject',
          required: false,
          description: 'Filter email integrations by metadata',
        }),
      },
      resolve: async (query, _root, args, context) => {
        return await prisma.emailIntegration.findMany({
          ...query,

          orderBy: orderByCreation(args.order),

          where: {
            ...(Array.isArray(args.blueprintIds)
              ? { blueprintId: { in: args.blueprintIds } }
              : {}),

            ...(Object.keys(args.meta || {}).length > 0
              ? {
                  AND: buildMetaQueryFilter(args.meta as Prisma.JsonObject),
                }
              : {}),

            // @note placed here to ensure that the userId is always checked

            userId: context.session.user.id,
          },
        })
      },
    }),

    triggerIntegrations: t.prismaConnection({
      type: TriggerIntegration,
      cursor: 'id',
      args: {
        order: t.arg({
          type: ListOrder,
          required: false,
          defaultValue: 'desc',
          description: 'Order trigger integrations by creation time',
        }),
        blueprintIds: t.arg({
          type: ['ID'],
          required: false,
          description: 'Filter trigger integrations by blueprint identifiers',
        }),
        meta: t.arg({
          type: 'JsonObject',
          required: false,
          description: 'Filter trigger integrations by metadata',
        }),
      },
      resolve: async (query, _root, args, context) => {
        return await prisma.triggerIntegration.findMany({
          ...query,

          orderBy: orderByCreation(args.order),

          where: {
            ...(Array.isArray(args.blueprintIds)
              ? { blueprintId: { in: args.blueprintIds } }
              : {}),

            ...(Object.keys(args.meta || {}).length > 0
              ? {
                  AND: buildMetaQueryFilter(args.meta as Prisma.JsonObject),
                }
              : {}),

            // @note placed here to ensure that the userId is always checked

            userId: context.session.user.id,
          },
        })
      },
    }),

    sitemapIntegrations: t.prismaConnection({
      type: SitemapIntegration,
      cursor: 'id',
      args: {
        order: t.arg({
          type: ListOrder,
          required: false,
          defaultValue: 'desc',
          description: 'Order sitemap integrations by creation time',
        }),
        blueprintIds: t.arg({
          type: ['ID'],
          required: false,
          description: 'Filter sitemap integrations by blueprint identifiers',
        }),
        meta: t.arg({
          type: 'JsonObject',
          required: false,
          description: 'Filter sitemap integrations by metadata',
        }),
      },
      resolve: async (query, _root, args, context) => {
        return await prisma.sitemapIntegration.findMany({
          ...query,

          orderBy: orderByCreation(args.order),

          where: {
            ...(Array.isArray(args.blueprintIds)
              ? { blueprintId: { in: args.blueprintIds } }
              : {}),

            ...(Object.keys(args.meta || {}).length > 0
              ? {
                  AND: buildMetaQueryFilter(args.meta as Prisma.JsonObject),
                }
              : {}),

            // @note placed here to ensure that the userId is always checked

            userId: context.session.user.id,
          },
        })
      },
    }),

    notionIntegrations: t.prismaConnection({
      type: NotionIntegration,
      cursor: 'id',
      args: {
        order: t.arg({
          type: ListOrder,
          required: false,
          defaultValue: 'desc',
          description: 'Order notion integrations by creation time',
        }),
        blueprintIds: t.arg({
          type: ['ID'],
          required: false,
          description: 'Filter notion integrations by blueprint identifiers',
        }),
        meta: t.arg({
          type: 'JsonObject',
          required: false,
          description: 'Filter notion integrations by metadata',
        }),
      },
      resolve: async (query, _root, args, context) => {
        return await prisma.notionIntegration.findMany({
          ...query,

          orderBy: orderByCreation(args.order),

          where: {
            ...(Array.isArray(args.blueprintIds)
              ? { blueprintId: { in: args.blueprintIds } }
              : {}),

            ...(Object.keys(args.meta || {}).length > 0
              ? {
                  AND: buildMetaQueryFilter(args.meta as Prisma.JsonObject),
                }
              : {}),

            // @note placed here to ensure that the userId is always checked

            userId: context.session.user.id,
          },
        })
      },
    }),

    supportIntegrations: t.prismaConnection({
      type: SupportIntegration,
      cursor: 'id',
      args: {
        order: t.arg({
          type: ListOrder,
          required: false,
          defaultValue: 'desc',
          description: 'Order support integrations by creation time',
        }),
        blueprintIds: t.arg({
          type: ['ID'],
          required: false,
          description: 'Filter support integrations by blueprint identifiers',
        }),
        meta: t.arg({
          type: 'JsonObject',
          required: false,
          description: 'Filter support integrations by metadata',
        }),
      },
      resolve: async (query, _root, args, context) => {
        return await prisma.supportIntegration.findMany({
          ...query,

          orderBy: orderByCreation(args.order),

          where: {
            ...(Array.isArray(args.blueprintIds)
              ? { blueprintId: { in: args.blueprintIds } }
              : {}),

            ...(Object.keys(args.meta || {}).length > 0
              ? {
                  AND: buildMetaQueryFilter(args.meta as Prisma.JsonObject),
                }
              : {}),

            // @note placed here to ensure that the userId is always checked

            userId: context.session.user.id,
          },
        })
      },
    }),

    extractIntegrations: t.prismaConnection({
      type: ExtractIntegration,
      cursor: 'id',
      args: {
        order: t.arg({
          type: ListOrder,
          required: false,
          defaultValue: 'desc',
          description: 'Order extract integrations by creation time',
        }),
        blueprintIds: t.arg({
          type: ['ID'],
          required: false,
          description: 'Filter extract integrations by blueprint identifiers',
        }),
        meta: t.arg({
          type: 'JsonObject',
          required: false,
          description: 'Filter extract integrations by metadata',
        }),
      },
      resolve: async (query, _root, args, context) => {
        return await prisma.extractIntegration.findMany({
          ...query,

          orderBy: orderByCreation(args.order),

          where: {
            ...(Array.isArray(args.blueprintIds)
              ? { blueprintId: { in: args.blueprintIds } }
              : {}),

            ...(Object.keys(args.meta || {}).length > 0
              ? {
                  AND: buildMetaQueryFilter(args.meta as Prisma.JsonObject),
                }
              : {}),

            // @note placed here to ensure that the userId is always checked

            userId: context.session.user.id,
          },
        })
      },
    }),

    mcpserverIntegrations: t.prismaConnection({
      type: McpserverIntegration,
      cursor: 'id',
      args: {
        order: t.arg({
          type: ListOrder,
          required: false,
          defaultValue: 'desc',
          description: 'Order MCP server integrations by creation time',
        }),
        blueprintIds: t.arg({
          type: ['ID'],
          required: false,
          description:
            'Filter MCP server integrations by blueprint identifiers',
        }),
        meta: t.arg({
          type: 'JsonObject',
          required: false,
          description: 'Filter MCP server integrations by metadata',
        }),
      },
      resolve: async (query, _root, args, context) => {
        return await prisma.mcpserverIntegration.findMany({
          ...query,

          orderBy: orderByCreation(args.order),

          where: {
            ...(Array.isArray(args.blueprintIds)
              ? { blueprintId: { in: args.blueprintIds } }
              : {}),

            ...(Object.keys(args.meta || {}).length > 0
              ? {
                  AND: buildMetaQueryFilter(args.meta as Prisma.JsonObject),
                }
              : {}),

            // @note placed here to ensure that the userId is always checked

            userId: context.session.user.id,
          },
        })
      },
    }),

    skillserverIntegrations: t.prismaConnection({
      type: SkillserverIntegration,
      cursor: 'id',
      args: {
        order: t.arg({
          type: ListOrder,
          required: false,
          defaultValue: 'desc',
          description: 'Order skill server integrations by creation time',
        }),
        blueprintIds: t.arg({
          type: ['ID'],
          required: false,
          description:
            'Filter skill server integrations by blueprint identifiers',
        }),
        meta: t.arg({
          type: 'JsonObject',
          required: false,
          description: 'Filter skill server integrations by metadata',
        }),
      },
      resolve: async (query, _root, args, context) => {
        return await prisma.skillserverIntegration.findMany({
          ...query,

          orderBy: orderByCreation(args.order),

          where: {
            ...(Array.isArray(args.blueprintIds)
              ? { blueprintId: { in: args.blueprintIds } }
              : {}),

            ...(Object.keys(args.meta || {}).length > 0
              ? {
                  AND: buildMetaQueryFilter(args.meta as Prisma.JsonObject),
                }
              : {}),

            // @note placed here to ensure that the userId is always checked

            userId: context.session.user.id,
          },
        })
      },
    }),

    githubIntegrations: t.prismaConnection({
      type: GithubIntegration,
      cursor: 'id',
      args: {
        order: t.arg({
          type: ListOrder,
          required: false,
          defaultValue: 'desc',
          description: 'Order github integrations by creation time',
        }),
        blueprintIds: t.arg({
          type: ['ID'],
          required: false,
          description: 'Filter github integrations by blueprint identifiers',
        }),
        meta: t.arg({
          type: 'JsonObject',
          required: false,
          description: 'Filter github integrations by metadata',
        }),
      },
      resolve: async (query, _root, args, context) => {
        return await prisma.githubIntegration.findMany({
          ...query,

          orderBy: orderByCreation(args.order),

          where: {
            ...(Array.isArray(args.blueprintIds)
              ? { blueprintId: { in: args.blueprintIds } }
              : {}),

            ...(Object.keys(args.meta || {}).length > 0
              ? {
                  AND: buildMetaQueryFilter(args.meta as Prisma.JsonObject),
                }
              : {}),

            // @note placed here to ensure that the userId is always checked

            userId: context.session.user.id,
          },
        })
      },
    }),

    anamIntegrations: t.prismaConnection({
      type: AnamIntegration,
      cursor: 'id',
      args: {
        order: t.arg({
          type: ListOrder,
          required: false,
          defaultValue: 'desc',
          description: 'Order anam integrations by creation time',
        }),
        blueprintIds: t.arg({
          type: ['ID'],
          required: false,
          description: 'Filter anam integrations by blueprint identifiers',
        }),
        meta: t.arg({
          type: 'JsonObject',
          required: false,
          description: 'Filter anam integrations by metadata',
        }),
      },
      resolve: async (query, _root, args, context) => {
        return await prisma.anamIntegration.findMany({
          ...query,

          orderBy: orderByCreation(args.order),

          where: {
            ...(Array.isArray(args.blueprintIds)
              ? { blueprintId: { in: args.blueprintIds } }
              : {}),

            ...(Object.keys(args.meta || {}).length > 0
              ? {
                  AND: buildMetaQueryFilter(args.meta as Prisma.JsonObject),
                }
              : {}),

            // @note placed here to ensure that the userId is always checked

            userId: context.session.user.id,
          },
        })
      },
    }),

    avatarIntegrations: t.prismaConnection({
      type: AvatarIntegration,
      cursor: 'id',
      args: {
        order: t.arg({
          type: ListOrder,
          required: false,
          defaultValue: 'desc',
          description: 'Order avatar integrations by creation time',
        }),
        blueprintIds: t.arg({
          type: ['ID'],
          required: false,
          description: 'Filter avatar integrations by blueprint identifiers',
        }),
        meta: t.arg({
          type: 'JsonObject',
          required: false,
          description: 'Filter avatar integrations by metadata',
        }),
      },
      resolve: async (query, _root, args, context) => {
        return await prisma.avatarIntegration.findMany({
          ...query,

          orderBy: orderByCreation(args.order),

          where: {
            ...(Array.isArray(args.blueprintIds)
              ? { blueprintId: { in: args.blueprintIds } }
              : {}),

            ...(Object.keys(args.meta || {}).length > 0
              ? {
                  AND: buildMetaQueryFilter(args.meta as Prisma.JsonObject),
                }
              : {}),

            // @note placed here to ensure that the userId is always checked

            userId: context.session.user.id,
          },
        })
      },
    }),

    recallIntegrations: t.prismaConnection({
      type: RecallIntegration,
      cursor: 'id',
      args: {
        order: t.arg({
          type: ListOrder,
          required: false,
          defaultValue: 'desc',
          description: 'Order recall integrations by creation time',
        }),
        blueprintIds: t.arg({
          type: ['ID'],
          required: false,
          description: 'Filter recall integrations by blueprint identifiers',
        }),
        meta: t.arg({
          type: 'JsonObject',
          required: false,
          description: 'Filter recall integrations by metadata',
        }),
      },
      resolve: async (query, _root, args, context) => {
        return await prisma.recallIntegration.findMany({
          ...query,

          orderBy: orderByCreation(args.order),

          where: {
            ...(Array.isArray(args.blueprintIds)
              ? { blueprintId: { in: args.blueprintIds } }
              : {}),

            ...(Object.keys(args.meta || {}).length > 0
              ? {
                  AND: buildMetaQueryFilter(args.meta as Prisma.JsonObject),
                }
              : {}),

            // @note placed here to ensure that the userId is always checked

            userId: context.session.user.id,
          },
        })
      },
    }),

    // platform

    platformModels: t.connection({
      type: PlatformModel,
      description: 'List all available platform models',
      args: {
        platformModelIds: t.arg({
          type: ['ID'],
          required: false,
          description: 'Filter models by their unique identifiers',
        }),
      },
      resolve: async (_root, args, context) => {
        const userClient = await getSessionClient(context.session)

        const { items } = await userClient.platform.model.list({
          // @note pass additional parameters
        })

        const filteredItems =
          Array.isArray(args.platformModelIds) &&
          args.platformModelIds.length > 0
            ? items.filter((item) => args.platformModelIds!.includes(item.id))
            : items

        const mappedItems = filteredItems.map((item) => ({
          id: item.id,
          name: item.name || null,
          description: item.description || null,
          provider: item.provider || null,
          family: item.family || null,
          maxTokens: item.maxTokens || null,
          maxInputTokens: item.maxInputTokens || null,
          maxOutputTokens: item.maxOutputTokens || null,
          meta: item.meta || null,
          createdAt: item.createdAt ? new Date(item.createdAt) : null,
          updatedAt: item.updatedAt ? new Date(item.updatedAt) : null,
        }))

        return resolveArrayConnection(
          { args, maxSize: mappedItems.length },
          mappedItems
        )
      },
    }),

    platformActions: t.connection({
      type: PlatformAction,
      description: 'List all available platform actions',
      args: {
        platformActionIds: t.arg({
          type: ['ID'],
          required: false,
          description: 'Filter actions by their unique identifiers',
        }),
      },
      resolve: async (_root, args, context) => {
        const userClient = await getSessionClient(context.session)

        const { items } = await userClient.platform.action.list({
          // @note pass additional parameters
        })

        const filteredItems = Array.isArray(args.platformActionIds)
          ? items.filter((item) => args.platformActionIds!.includes(item.id))
          : items

        const mappedItems = filteredItems.map((item) => ({
          id: item.id,
          name: item.name || null,
          description: item.description || null,
          examples: item.examples || null,
          meta: item.meta || null,
          createdAt: item.createdAt ? new Date(item.createdAt) : null,
          updatedAt: item.updatedAt ? new Date(item.updatedAt) : null,
        }))

        return resolveArrayConnection(
          { args, maxSize: mappedItems.length },
          mappedItems
        )
      },
    }),

    platformAbilities: t.connection({
      type: PlatformAbility,
      description: 'List all available platform abilities',
      args: {
        platformAbilityIds: t.arg({
          type: ['ID'],
          required: false,
          description: 'Filter abilities by their unique identifiers',
        }),
        search: t.arg({
          type: 'String',
          required: false,
          description: 'Search platform abilities using semantic similarity',
        }),
        take: t.arg({
          type: 'Int',
          required: false,
          description: 'Number of platform abilities to retrieve',
          defaultValue: 10,
        }),
      },
      resolve: async (_root, args, context) => {
        const userClient = await getSessionClient(context.session)

        const { items } = args.search
          ? await userClient.platform.ability.search({
              search: args.search,
              take: args.take || 10,
            })
          : await userClient.platform.ability.list({
              take: args.take || 10,
            })

        const filteredItems = Array.isArray(args.platformAbilityIds)
          ? items.filter((item) => args.platformAbilityIds!.includes(item.id))
          : items

        const mappedItems = filteredItems.map((item) => ({
          id: item.id,
          template: item.template,
          name: item.name || null,
          description: item.description || null,
          schema: (item.schema as unknown as JsonValue) || null,
          instruction: item.instruction || null,
          provider: item.provider || null,
          icon: item.icon || null,
          tags: item.tags || null,
          setup: item.setup || null,
          commentary: item.commentary || null,
          score:
            'score' in item && typeof item.score === 'number'
              ? item.score
              : null,
          excerpt:
            'excerpt' in item && typeof item.excerpt === 'string'
              ? item.excerpt
              : null,
          link:
            'link' in item && typeof item.link === 'string' ? item.link : null,
          bot: item.bot || null,
          file: item.file || null,
          secret: item.secret || null,
          space: item.space || null,
          meta: item.meta || null,
          createdAt: item.createdAt ? new Date(item.createdAt) : null,
          updatedAt: item.updatedAt ? new Date(item.updatedAt) : null,
        }))

        return resolveArrayConnection(
          { args, maxSize: mappedItems.length },
          mappedItems
        )
      },
    }),

    platformSecrets: t.connection({
      type: PlatformSecret,
      description: 'List all available platform secrets',
      args: {
        platformSecretIds: t.arg({
          type: ['ID'],
          required: false,
          description: 'Filter secrets by their unique identifiers',
        }),
        search: t.arg({
          type: 'String',
          required: false,
          description: 'Search platform secrets using semantic similarity',
        }),
        take: t.arg({
          type: 'Int',
          required: false,
          description: 'Number of platform secrets to retrieve',
          defaultValue: 10,
        }),
      },
      resolve: async (_root, args, context) => {
        const userClient = await getSessionClient(context.session)

        const { items } = args.search
          ? await userClient.platform.secret.search({
              search: args.search,
              take: args.take || 10,
            })
          : await userClient.platform.secret.list({
              take: args.take || 10,
            })

        const filteredItems = Array.isArray(args.platformSecretIds)
          ? items.filter((item) => args.platformSecretIds!.includes(item.id))
          : items

        const mappedItems = filteredItems.map((item) => ({
          id: item.id,
          template: item.template,
          name: item.name || null,
          description: item.description || null,
          type: item.type || null,
          kind: item.kind || null,
          config: item.config || null,
          tags: item.tags || null,
          icon: item.icon || null,
          setup: item.setup || null,
          commentary: item.commentary || null,
          score:
            'score' in item && typeof item.score === 'number'
              ? item.score
              : null,
          excerpt:
            'excerpt' in item && typeof item.excerpt === 'string'
              ? item.excerpt
              : null,
          link:
            'link' in item && typeof item.link === 'string' ? item.link : null,
          meta: item.meta || null,
          createdAt: item.createdAt ? new Date(item.createdAt) : null,
          updatedAt: item.updatedAt ? new Date(item.updatedAt) : null,
        }))

        return resolveArrayConnection(
          { args, maxSize: mappedItems.length },
          mappedItems
        )
      },
    }),

    platformExamples: t.connection({
      type: PlatformExample,
      description: 'List all available platform examples',
      args: {
        platformExampleIds: t.arg({
          type: ['ID'],
          required: false,
          description: 'Filter examples by their unique identifiers',
        }),
        search: t.arg({
          type: 'String',
          required: false,
          description: 'Search platform examples using semantic similarity',
        }),
      },
      resolve: async (_root, args, context) => {
        const userClient = await getSessionClient(context.session)

        // @note use search method when search argument is provided

        const { items } = args.search
          ? await userClient.platform.example.search({
              search: args.search,
            })
          : await userClient.platform.example.list({
              // @note pass additional parameters
            })

        const filteredItems = Array.isArray(args.platformExampleIds)
          ? items.filter((item) => args.platformExampleIds!.includes(item.id))
          : items

        const mappedItems = filteredItems.map((item) => ({
          id: item.id,

          name: item.name,
          description: item.description,

          type: item.type,
          tags: item.tags,

          meta: item.meta || undefined,
          createdAt: item.createdAt,
          updatedAt: item.updatedAt,

          link: item.link,
        }))

        return resolveArrayConnection(
          { args, maxSize: mappedItems.length },
          mappedItems
        )
      },
    }),

    platformReports: t.connection({
      type: PlatformReport,
      description: 'List all available platform reports',
      args: {
        platformReportIds: t.arg({
          type: ['ID'],
          required: false,
          description: 'Filter reports by their unique identifiers',
        }),
      },
      resolve: async (_root, args, context) => {
        const userClient = await getSessionClient(context.session)

        const { items } = await userClient.platform.report.list({
          // @note pass additional parameters
        })

        const filteredItems = Array.isArray(args.platformReportIds)
          ? items.filter((item) => args.platformReportIds!.includes(item.id))
          : items

        const mappedItems = filteredItems.map((item) => ({
          id: item.id,
          name: item.name,
          description: item.description,
          meta: item.meta || undefined,
          createdAt: item.createdAt,
          updatedAt: item.updatedAt,
        }))

        return resolveArrayConnection(
          { args, maxSize: mappedItems.length },
          mappedItems
        )
      },
    }),
  }),
})

// ---
// ---
// ---

const BotCreateResponse = builder
  .objectRef<_BotCreateResponse>('BotCreateResponse')
  .implement({
    description: 'Response containing the ID of a newly created bot',
    fields: (t) =>
      ({
        id: t.exposeID('id', {
          description: 'The unique identifier of the created bot',
        }),
      } satisfies Record<keyof _BotCreateResponse, unknown>),
  })

const BotCreateRequest = builder
  .inputRef<_BotCreateRequestBody>('BotCreateRequest')
  .implement({
    description: 'Input parameters for creating a new bot',
    fields: (t) =>
      ({
        alias: t.id({
          required: false,
          description: 'The alias ID for the bot',
        }),
        blueprintId: t.id({
          required: false,
          description: 'The ID of the blueprint to use',
        }),
        name: t.string({ required: false, description: 'The name of the bot' }),
        description: t.string({
          required: false,
          description: 'The description of the bot',
        }),
        backstory: t.string({
          required: false,
          description: 'The backstory for the bot',
        }),
        model: t.string({
          required: false,
          description: 'The AI model to use for the bot',
        }), // @note using BotCreateRequestBody instead of BotCreateRequest due to model field
        datasetId: t.id({
          required: false,
          description: 'The ID of the dataset to use',
        }),
        skillsetId: t.id({
          required: false,
          description: 'The ID of the skillset to use',
        }),
        privacy: t.boolean({
          required: false,
          description: 'Whether privacy mode is enabled',
        }),
        moderation: t.boolean({
          required: false,
          description: 'Whether moderation is enabled',
        }),
        visibility: t.field({
          type: BotVisibility,
          required: false,
          defaultValue: _BotVisibility.private,
          description: 'The visibility level of the bot',
        }),
        meta: t.field({
          type: Meta,
          required: false,
          description: 'Additional metadata for the bot',
        }),
      } satisfies Record<keyof _BotCreateRequestBody, unknown>),
  })

const BotUpdateResponse = builder
  .objectRef<_BotUpdateResponse>('BotUpdateResponse')
  .implement({
    description: 'Response containing the ID of an updated bot',
    fields: (t) =>
      ({
        id: t.exposeID('id', {
          description: 'The unique identifier of the updated bot',
        }),
      } satisfies Record<keyof _BotUpdateResponse, unknown>),
  })

const BotUpdateRequest = builder
  .inputRef<_BotUpdateRequestBody>('BotUpdateRequest')
  .implement({
    description: 'Input parameters for updating an existing bot',
    fields: (t) =>
      ({
        alias: t.id({
          required: false,
          description: 'The alias ID for the bot',
        }),
        blueprintId: t.id({
          required: false,
          description: 'The ID of the blueprint to use',
        }),
        name: t.string({ required: false, description: 'The name of the bot' }),
        description: t.string({
          required: false,
          description: 'The description of the bot',
        }),
        backstory: t.string({
          required: false,
          description: 'The backstory for the bot',
        }),
        model: t.string({
          required: false,
          description: 'The AI model to use for the bot',
        }), // @note using BotUpdateRequestBody instead of BotUpdateRequest due to model field
        datasetId: t.id({
          required: false,
          description: 'The ID of the dataset to use',
        }),
        skillsetId: t.id({
          required: false,
          description: 'The ID of the skillset to use',
        }),
        privacy: t.boolean({
          required: false,
          description: 'Whether privacy mode is enabled',
        }),
        moderation: t.boolean({
          required: false,
          description: 'Whether moderation is enabled',
        }),
        visibility: t.field({
          type: BotVisibility,
          required: false,
          description: 'The visibility level of the bot',
        }),
        meta: t.field({
          type: Meta,
          description: 'Additional metadata for the bot',
          required: false,
        }),
      } satisfies Record<keyof _BotUpdateRequestBody, unknown>),
  })

const BotDeleteResponse = builder
  .objectRef<_BotDeleteResponse>('BotDeleteResponse')
  .implement({
    description: 'Response containing the ID of a deleted bot',
    fields: (t) =>
      ({
        id: t.exposeID('id', {
          description: 'The unique identifier of the deleted bot',
        }),
      } satisfies Record<keyof _BotDeleteResponse, unknown>),
  })

const DatasetCreateResponse = builder
  .objectRef<_DatasetCreateResponse>('DatasetCreateResponse')
  .implement({
    description: 'Response containing the ID of a newly created dataset',
    fields: (t) =>
      ({
        id: t.exposeID('id', {
          description: 'The unique identifier of the created dataset',
        }),
      } satisfies Record<keyof _DatasetCreateResponse, unknown>),
  })

const DatasetCreateRequest = builder
  .inputRef<_DatasetCreateRequest>('DatasetCreateRequest')
  .implement({
    description: 'Input parameters for creating a new dataset',
    fields: (t) =>
      ({
        alias: t.id({
          required: false,
          description: 'The alias ID for the dataset',
        }),
        blueprintId: t.id({
          required: false,
          description: 'The ID of the blueprint to use',
        }),
        name: t.string({
          required: false,
          description: 'The name of the dataset',
        }),
        description: t.string({
          required: false,
          description: 'The description of the dataset',
        }),
        reranker: t.string({
          required: false,
          description: 'The reranking model to use',
        }),
        separators: t.string({
          required: false,
          description: 'The separators for chunking text',
        }),
        recordMaxTokens: t.int({
          required: false,
          description: 'Maximum tokens per record',
        }),
        searchMinScore: t.float({
          required: false,
          description: 'Minimum score for search results',
        }),
        searchMaxRecords: t.int({
          required: false,
          description: 'Maximum number of search results',
        }),
        searchMaxTokens: t.int({
          required: false,
          description: 'Maximum tokens in search results',
        }),
        matchInstruction: t.string({
          required: false,
          description: 'Instruction when matches are found',
        }),
        mismatchInstruction: t.string({
          required: false,
          description: 'Instruction when no matches are found',
        }),
        visibility: t.field({
          type: DatasetVisibility,
          required: false,
          defaultValue: _DatasetVisibility.private,
          description: 'The visibility level of the dataset',
        }),
        meta: t.field({
          type: Meta,
          required: false,
          description: 'Additional metadata for the dataset',
        }),
      } satisfies Record<keyof _DatasetCreateRequest, unknown>),
  })

const DatasetUpdateResponse = builder
  .objectRef<_DatasetUpdateResponse>('DatasetUpdateResponse')
  .implement({
    description: 'Response containing the ID of an updated dataset',
    fields: (t) =>
      ({
        id: t.exposeID('id', {
          description: 'The unique identifier of the updated dataset',
        }),
      } satisfies Record<keyof _DatasetUpdateResponse, unknown>),
  })

const DatasetUpdateRequest = builder
  .inputRef<_DatasetUpdateRequest>('DatasetUpdateRequest')
  .implement({
    description: 'Input parameters for updating an existing dataset',
    fields: (t) =>
      ({
        alias: t.id({
          required: false,
          description: 'The alias ID for the dataset',
        }),
        blueprintId: t.id({
          required: false,
          description: 'The ID of the blueprint to use',
        }),
        name: t.string({
          required: false,
          description: 'The name of the dataset',
        }),
        description: t.string({
          required: false,
          description: 'The description of the dataset',
        }),
        reranker: t.string({
          required: false,
          description: 'The reranking model to use',
        }),
        separators: t.string({
          required: false,
          description: 'The separators for chunking text',
        }),
        recordMaxTokens: t.int({
          required: false,
          description: 'Maximum tokens per record',
        }),
        searchMinScore: t.float({
          required: false,
          description: 'Minimum score for search results',
        }),
        searchMaxRecords: t.int({
          required: false,
          description: 'Maximum number of search results',
        }),
        searchMaxTokens: t.int({
          required: false,
          description: 'Maximum tokens in search results',
        }),
        matchInstruction: t.string({
          required: false,
          description: 'Instruction when matches are found',
        }),
        mismatchInstruction: t.string({
          required: false,
          description: 'Instruction when no matches are found',
        }),
        visibility: t.field({
          type: DatasetVisibility,
          required: false,
          defaultValue: _DatasetVisibility.private,
          description: 'The visibility level of the dataset',
        }),
        meta: t.field({
          type: Meta,
          required: false,
          description: 'Additional metadata for the dataset',
        }),
      } satisfies Record<keyof _DatasetUpdateRequest, unknown>),
  })

const DatasetDeleteResponse = builder
  .objectRef<_DatasetDeleteResponse>('DatasetDeleteResponse')
  .implement({
    description: 'Response containing the ID of a deleted dataset',
    fields: (t) =>
      ({
        id: t.exposeID('id', {
          description: 'The unique identifier of the deleted dataset',
        }),
      } satisfies Record<keyof _DatasetDeleteResponse, unknown>),
  })

const SkillsetCreateResponse = builder
  .objectRef<_SkillsetCreateResponse>('SkillsetCreateResponse')
  .implement({
    description: 'Response containing the ID of a newly created skillset',
    fields: (t) =>
      ({
        id: t.exposeID('id', {
          description: 'The unique identifier of the created skillset',
        }),
      } satisfies Record<keyof _SkillsetCreateResponse, unknown>),
  })

const SkillsetCreateRequest = builder
  .inputRef<_SkillsetCreateRequest>('SkillsetCreateRequest')
  .implement({
    description: 'Input parameters for creating a new skillset',
    fields: (t) =>
      ({
        alias: t.id({
          required: false,
          description: 'The alias ID for the skillset',
        }),
        blueprintId: t.id({
          required: false,
          description: 'The ID of the blueprint to use',
        }),
        name: t.string({
          required: false,
          description: 'The name of the skillset',
        }),
        description: t.string({
          required: false,
          description: 'The description of the skillset',
        }),
        visibility: t.field({
          type: SkillsetVisibility,
          required: false,
          defaultValue: _SkillsetVisibility.private,
          description: 'The visibility level of the skillset',
        }),
        state: t.field({
          type: ResourceState,
          required: false,
          description: 'The lifecycle state of the skillset (enabled/disabled)',
        }),
        meta: t.field({
          type: Meta,
          description: 'Additional metadata for the skillset',
          required: false,
        }),
      } satisfies Record<keyof _SkillsetCreateRequest, unknown>),
  })

const SkillsetUpdateResponse = builder
  .objectRef<_SkillsetUpdateResponse>('SkillsetUpdateResponse')
  .implement({
    description: 'Response containing the ID of an updated skillset',
    fields: (t) =>
      ({
        id: t.exposeID('id', {
          description: 'The unique identifier of the updated skillset',
        }),
      } satisfies Record<keyof _SkillsetUpdateResponse, unknown>),
  })

const SkillsetUpdateRequest = builder
  .inputRef<_SkillsetUpdateRequest>('SkillsetUpdateRequest')
  .implement({
    description: 'Input parameters for updating an existing skillset',
    fields: (t) =>
      ({
        alias: t.id({
          required: false,
          description: 'The alias ID for the skillset',
        }),
        blueprintId: t.id({
          required: false,
          description: 'The ID of the blueprint to use',
        }),
        name: t.string({
          required: false,
          description: 'The name of the skillset',
        }),
        description: t.string({
          required: false,
          description: 'The description of the skillset',
        }),
        visibility: t.field({
          type: SkillsetVisibility,
          required: false,
          description: 'The visibility level of the skillset',
        }),
        state: t.field({
          type: ResourceState,
          required: false,
          description: 'The lifecycle state of the skillset (enabled/disabled)',
        }),
        meta: t.field({
          type: Meta,
          required: false,
          description: 'Additional metadata for the skillset',
        }),
      } satisfies Record<keyof _SkillsetUpdateRequest, unknown>),
  })

const SkillsetDeleteResponse = builder
  .objectRef<_SkillsetDeleteResponse>('SkillsetDeleteResponse')
  .implement({
    description: 'Response containing the ID of a deleted skillset',
    fields: (t) =>
      ({
        id: t.exposeID('id', {
          description: 'The unique identifier of the deleted skillset',
        }),
      } satisfies Record<keyof _SkillsetDeleteResponse, unknown>),
  })

const SkillsetAbilityCreateResponse = builder
  .objectRef<_SkillsetAbilityCreateResponse>('SkillsetAbilityCreateResponse')
  .implement({
    description:
      'Response containing the ID of a newly created skillset ability',
    fields: (t) =>
      ({
        id: t.exposeID('id', {
          description: 'The unique identifier of the created skillset ability',
        }),
      } satisfies Record<keyof _SkillsetAbilityCreateResponse, unknown>),
  })

const SkillsetAbilityCreateRequest = builder
  .inputRef<_SkillsetAbilityCreateRequest>('SkillsetAbilityCreateRequest')
  .implement({
    description: 'Input parameters for creating a new skillset ability',
    fields: (t) =>
      ({
        alias: t.id({
          required: false,
          description: 'The alias ID for the ability',
        }),
        blueprintId: t.id({
          required: false,
          description: 'The ID of the blueprint to use',
        }),
        linkedSecretId: t.id({
          required: false,
          description: 'The ID of the secret the ability is linked to',
        }),
        linkedFileId: t.id({
          required: false,
          description: 'The ID of the file the ability is linked to',
        }),
        linkedBotId: t.id({
          required: false,
          description: 'The ID of the bot the ability is linked to',
        }),
        linkedSpaceId: t.id({
          required: false,
          description: 'The ID of the space the ability is linked to',
        }),
        name: t.string({
          required: false,
          description: 'The name of the ability',
        }),
        description: t.string({
          required: false,
          description: 'The description of the ability',
        }),
        instruction: t.string({
          required: false,
          description: 'The instruction for the ability',
        }),
        state: t.field({
          type: ResourceState,
          required: false,
          description: 'The lifecycle state of the ability (enabled/disabled)',
        }),
        meta: t.field({
          type: Meta,
          required: false,
          description: 'Additional metadata for the ability',
        }),
      } satisfies Record<keyof _SkillsetAbilityCreateRequest, unknown>),
  })

const SkillsetAbilityUpdateResponse = builder
  .objectRef<_SkillsetAbilityUpdateResponse>('SkillsetAbilityUpdateResponse')
  .implement({
    description: 'Response containing the ID of an updated skillset ability',
    fields: (t) =>
      ({
        id: t.exposeID('id', {
          description: 'The unique identifier of the updated skillset ability',
        }),
      } satisfies Record<keyof _SkillsetAbilityUpdateResponse, unknown>),
  })

const SkillsetAbilityUpdateRequest = builder
  .inputRef<_SkillsetAbilityUpdateRequest>('SkillsetAbilityUpdateRequest')
  .implement({
    description: 'Input parameters for updating an existing skillset ability',
    fields: (t) =>
      ({
        alias: t.id({
          required: false,
          description: 'The alias ID for the ability',
        }),
        blueprintId: t.id({
          required: false,
          description: 'The ID of the blueprint to use',
        }),
        linkedSecretId: t.id({
          required: false,
          description: 'The ID of the secret the ability is linked to',
        }),
        linkedFileId: t.id({
          required: false,
          description: 'The ID of the file the ability is linked to',
        }),
        linkedBotId: t.id({
          required: false,
          description: 'The ID of the bot the ability is linked to',
        }),
        linkedSpaceId: t.id({
          required: false,
          description: 'The ID of the space the ability is linked to',
        }),
        name: t.string({
          required: false,
          description: 'The name of the ability',
        }),
        description: t.string({
          required: false,
          description: 'The description of the ability',
        }),
        instruction: t.string({
          required: false,
          description: 'The instruction for the ability',
        }),
        state: t.field({
          type: ResourceState,
          required: false,
          description: 'The lifecycle state of the ability (enabled/disabled)',
        }),
        meta: t.field({
          type: Meta,
          required: false,
          description: 'Additional metadata for the ability',
        }),
      } satisfies Record<keyof _SkillsetAbilityUpdateRequest, unknown>),
  })

const SkillsetAbilityDeleteResponse = builder
  .objectRef<_SkillsetAbilityDeleteResponse>('SkillsetAbilityDeleteResponse')
  .implement({
    description: 'Response containing the ID of a deleted skillset ability',
    fields: (t) =>
      ({
        id: t.exposeID('id', {
          description: 'The unique identifier of the deleted skillset ability',
        }),
      } satisfies Record<keyof _SkillsetAbilityDeleteResponse, unknown>),
  })

const FileCreateResponse = builder
  .objectRef<_FileCreateResponse>('FileCreateResponse')
  .implement({
    description: 'Response containing the ID of a newly created file',
    fields: (t) =>
      ({
        id: t.exposeID('id', {
          description: 'The unique identifier of the created file',
        }),
      } satisfies Record<keyof _FileCreateResponse, unknown>),
  })

const FileCreateRequest = builder
  .inputRef<_FileCreateRequest>('FileCreateRequest')
  .implement({
    description: 'Input parameters for creating a new file',
    fields: (t) =>
      ({
        alias: t.id({
          required: false,
          description: 'The alias ID for the file',
        }),
        blueprintId: t.id({
          required: false,
          description: 'The ID of the blueprint to use',
        }),
        name: t.string({
          required: false,
          description: 'The name of the file',
        }),
        description: t.string({
          required: false,
          description: 'The description of the file',
        }),
        visibility: t.field({
          type: FileVisibility,
          required: false,
          defaultValue: _FileVisibility.private,
          description: 'The visibility level of the file',
        }),
        meta: t.field({
          type: Meta,
          required: false,
          description: 'Additional metadata for the file',
        }),
      } satisfies Record<keyof _FileCreateRequest, unknown>),
  })

const FileUpdateResponse = builder
  .objectRef<_FileUpdateResponse>('FileUpdateResponse')
  .implement({
    description: 'Response containing the ID of an updated file',
    fields: (t) =>
      ({
        id: t.exposeID('id', {
          description: 'The unique identifier of the updated file',
        }),
      } satisfies Record<keyof _FileUpdateResponse, unknown>),
  })

const FileUpdateRequest = builder
  .inputRef<_FileUpdateRequest>('FileUpdateRequest')
  .implement({
    description: 'Input parameters for updating an existing file',
    fields: (t) =>
      ({
        alias: t.id({
          required: false,
          description: 'The alias ID for the file',
        }),
        blueprintId: t.id({
          required: false,
          description: 'The ID of the blueprint to use',
        }),
        name: t.string({
          required: false,
          description: 'The name of the file',
        }),
        description: t.string({
          required: false,
          description: 'The description of the file',
        }),
        visibility: t.field({
          type: FileVisibility,
          required: false,
          description: 'The visibility level of the file',
        }),
        meta: t.field({
          type: Meta,
          required: false,
          description: 'Additional metadata for the file',
        }),
      } satisfies Record<keyof _FileUpdateRequest, unknown>),
  })

const FileDeleteResponse = builder
  .objectRef<_FileDeleteResponse>('FileDeleteResponse')
  .implement({
    description: 'Response containing the ID of a deleted file',
    fields: (t) =>
      ({
        id: t.exposeID('id', {
          description: 'The unique identifier of the deleted file',
        }),
      } satisfies Record<keyof _FileDeleteResponse, unknown>),
  })

const SecretCreateResponse = builder
  .objectRef<_SecretCreateResponse>('SecretCreateResponse')
  .implement({
    description: 'Response containing the ID of a newly created secret',
    fields: (t) =>
      ({
        id: t.exposeID('id', {
          description: 'The unique identifier of the created secret',
        }),
      } satisfies Record<keyof _SecretCreateResponse, unknown>),
  })

const SecretCreateRequest = builder
  .inputRef<_SecretCreateRequest>('SecretCreateRequest')
  .implement({
    description: 'Input parameters for creating a new secret',
    fields: (t) =>
      ({
        alias: t.id({
          required: false,
          description: 'The alias ID for the secret',
        }),
        blueprintId: t.id({
          required: false,
          description: 'The ID of the blueprint to use',
        }),
        name: t.string({
          required: false,
          description: 'The name of the secret',
        }),
        description: t.string({
          required: false,
          description: 'The description of the secret',
        }),
        kind: t.field({
          type: SecretKind,
          required: false,
          description: 'The kind of secret (personal or organizational)',
        }),
        type: t.field({
          type: SecretType,
          required: false,
          description: 'The type of secret (token or other)',
        }),
        value: t.string({ required: false, description: 'The secret value' }),
        config: t.field({
          type: 'JsonObject',
          required: false,
          description: 'Additional configuration for the secret',
        }),
        visibility: t.field({
          type: SecretVisibility,
          required: false,
          defaultValue: _SecretVisibility.private,
          description: 'The visibility level of the secret',
        }),
        meta: t.field({
          type: Meta,
          required: false,
          description: 'Additional metadata for the secret',
        }),
      } satisfies Record<keyof _SecretCreateRequest, unknown>),
  })

const SecretUpdateResponse = builder
  .objectRef<_SecretUpdateResponse>('SecretUpdateResponse')
  .implement({
    description: 'Response containing the ID of an updated secret',
    fields: (t) =>
      ({
        id: t.exposeID('id', {
          description: 'The unique identifier of the updated secret',
        }),
      } satisfies Record<keyof _SecretUpdateResponse, unknown>),
  })

const SecretUpdateRequest = builder
  .inputRef<_SecretUpdateRequest>('SecretUpdateRequest')
  .implement({
    description: 'Input parameters for updating an existing secret',
    fields: (t) =>
      ({
        alias: t.id({
          required: false,
          description: 'The alias ID for the secret',
        }),
        blueprintId: t.id({
          required: false,
          description: 'The ID of the blueprint to use',
        }),
        name: t.string({
          required: false,
          description: 'The name of the secret',
        }),
        description: t.string({
          required: false,
          description: 'The description of the secret',
        }),
        kind: t.field({
          type: SecretKind,
          required: false,
          description: 'The kind of secret (personal or organizational)',
        }),
        type: t.field({
          type: SecretType,
          required: false,
          description: 'The type of secret (token or other)',
        }),
        value: t.string({ required: false, description: 'The secret value' }),
        config: t.field({
          type: 'JsonObject',
          required: false,
          description: 'Additional configuration for the secret',
        }),
        visibility: t.field({
          type: SecretVisibility,
          required: false,
          description: 'The visibility level of the secret',
        }),
        meta: t.field({
          type: Meta,
          required: false,
          description: 'Additional metadata for the secret',
        }),
      } satisfies Record<keyof _SecretUpdateRequest, unknown>),
  })

const SecretDeleteResponse = builder
  .objectRef<_SecretDeleteResponse>('SecretDeleteResponse')
  .implement({
    description: 'Response containing the ID of a deleted secret',
    fields: (t) =>
      ({
        id: t.exposeID('id', {
          description: 'The unique identifier of the deleted secret',
        }),
      } satisfies Record<keyof _SecretDeleteResponse, unknown>),
  })

const SecretRevokeResponse = builder
  .objectRef<_SecretRevokeResponse>('SecretRevokeResponse')
  .implement({
    description: 'Response containing the ID of a revoked secret',
    fields: (t) =>
      ({
        id: t.exposeID('id', {
          description: 'The unique identifier of the revoked secret',
        }),
      } satisfies Record<keyof _SecretRevokeResponse, unknown>),
  })

const PortalCreateRequest = builder
  .inputRef<_PortalCreateRequest>('PortalCreateRequest')
  .implement({
    description: 'Input parameters for creating a new portal',
    fields: (t) =>
      ({
        alias: t.id({
          required: false,
          description: 'The alias ID for the portal',
        }),
        blueprintId: t.id({
          required: false,
          description: 'The ID of the blueprint to use',
        }),
        name: t.string({
          required: false,
          description: 'The name of the portal',
        }),
        description: t.string({
          required: false,
          description: 'The description of the portal',
        }),
        slug: t.string({
          required: false,
          description: 'The custom slug for the portal URL',
        }),
        config: t.field({
          type: 'JsonObject',
          required: false,
          description: 'Configuration settings for the portal',
        }),
        meta: t.field({
          type: Meta,
          required: false,
          description: 'Additional metadata for the portal',
        }),
      } satisfies Record<keyof _PortalCreateRequest, unknown>),
  })

const PortalCreateResponse = builder
  .objectRef<_PortalCreateResponse>('PortalCreateResponse')
  .implement({
    description: 'Response containing the ID of a newly created portal',
    fields: (t) =>
      ({
        id: t.exposeID('id', {
          description: 'The unique identifier of the created portal',
        }),
      } satisfies Record<keyof _PortalCreateResponse, unknown>),
  })

const PortalUpdateRequest = builder
  .inputRef<_PortalUpdateRequest>('PortalUpdateRequest')
  .implement({
    description: 'Input parameters for updating an existing portal',
    fields: (t) =>
      ({
        alias: t.id({
          required: false,
          description: 'The alias ID for the portal',
        }),
        blueprintId: t.id({
          required: false,
          description: 'The ID of the blueprint to use',
        }),
        name: t.string({
          required: false,
          description: 'The name of the portal',
        }),
        description: t.string({
          required: false,
          description: 'The description of the portal',
        }),
        slug: t.string({
          required: false,
          description: 'The custom slug for the portal URL',
        }),
        config: t.field({
          type: 'JsonObject',
          required: false,
          description: 'Configuration settings for the portal',
        }),
        meta: t.field({
          type: Meta,
          required: false,
          description: 'Additional metadata for the portal',
        }),
      } satisfies Record<keyof _PortalUpdateRequest, unknown>),
  })

const PortalUpdateResponse = builder
  .objectRef<_PortalUpdateResponse>('PortalUpdateResponse')
  .implement({
    description: 'Response containing the ID of an updated portal',
    fields: (t) =>
      ({
        id: t.exposeID('id', {
          description: 'The unique identifier of the updated portal',
        }),
      } satisfies Record<keyof _PortalUpdateResponse, unknown>),
  })

const PortalDeleteResponse = builder
  .objectRef<_PortalDeleteResponse>('PortalDeleteResponse')
  .implement({
    description: 'Response containing the ID of a deleted portal',
    fields: (t) =>
      ({
        id: t.exposeID('id', {
          description: 'The unique identifier of the deleted portal',
        }),
      } satisfies Record<keyof _PortalDeleteResponse, unknown>),
  })

const BlueprintCreateRequest = builder
  .inputRef<_BlueprintCreateRequest>('BlueprintCreateRequest')
  .implement({
    description: 'Input parameters for creating a new blueprint',
    fields: (t) =>
      ({
        alias: t.id({
          required: false,
          description: 'The alias ID for the blueprint',
        }),
        name: t.string({
          required: false,
          description: 'The name of the blueprint',
        }),
        description: t.string({
          required: false,
          description: 'The description of the blueprint',
        }),
        visibility: t.field({
          type: BlueprintVisibility,
          required: false,
          defaultValue: _BlueprintVisibility.private,
          description: 'The visibility level of the blueprint',
        }),
        meta: t.field({
          type: Meta,
          required: false,
          description: 'Additional metadata for the blueprint',
        }),
      } satisfies Record<keyof _BlueprintCreateRequest, unknown>),
  })

const BlueprintCreateResponse = builder
  .objectRef<_BlueprintCreateResponse>('BlueprintCreateResponse')
  .implement({
    description: 'Response containing the ID of a newly created blueprint',
    fields: (t) =>
      ({
        id: t.exposeID('id', {
          description: 'The unique identifier of the created blueprint',
        }),
      } satisfies Record<keyof _BlueprintCreateResponse, unknown>),
  })

const BlueprintUpdateRequest = builder
  .inputRef<_BlueprintUpdateRequest>('BlueprintUpdateRequest')
  .implement({
    description: 'Input parameters for updating an existing blueprint',
    fields: (t) =>
      ({
        alias: t.id({
          required: false,
          description: 'The alias ID for the blueprint',
        }),
        name: t.string({
          required: false,
          description: 'The name of the blueprint',
        }),
        description: t.string({
          required: false,
          description: 'The description of the blueprint',
        }),
        visibility: t.field({
          type: BlueprintVisibility,
          required: false,
          description: 'The visibility level of the blueprint',
        }),
        meta: t.field({
          type: Meta,
          required: false,
          description: 'Additional metadata for the blueprint',
        }),
      } satisfies Record<keyof _BlueprintUpdateRequest, unknown>),
  })

const BlueprintUpdateResponse = builder
  .objectRef<_BlueprintUpdateResponse>('BlueprintUpdateResponse')
  .implement({
    description: 'Response containing the ID of an updated blueprint',
    fields: (t) =>
      ({
        id: t.exposeID('id', {
          description: 'The unique identifier of the updated blueprint',
        }),
      } satisfies Record<keyof _BlueprintUpdateResponse, unknown>),
  })

const BlueprintDeleteResponse = builder
  .objectRef<_BlueprintDeleteResponse>('BlueprintDeleteResponse')
  .implement({
    description: 'Response containing the ID of a deleted blueprint',
    fields: (t) =>
      ({
        id: t.exposeID('id', {
          description: 'The unique identifier of the deleted blueprint',
        }),
      } satisfies Record<keyof _BlueprintDeleteResponse, unknown>),
  })

const SlackIntegrationCreateResponse = builder
  .objectRef<_SlackIntegrationCreateResponse>('SlackIntegrationCreateResponse')
  .implement({
    description:
      'Response containing the ID of a newly created Slack integration',
    fields: (t) =>
      ({
        id: t.exposeID('id', {
          description: 'The unique identifier of the created Slack integration',
        }),
      } satisfies Record<keyof _SlackIntegrationCreateResponse, unknown>),
  })

const SlackIntegrationCreateRequest = builder
  .inputRef<_SlackIntegrationCreateRequest>('SlackIntegrationCreateRequest')
  .implement({
    description: 'Input parameters for creating a new Slack integration',
    fields: (t) =>
      ({
        alias: t.id({
          required: false,
          description: 'The alias ID for the integration',
        }),
        blueprintId: t.id({
          required: false,
          description: 'The ID of the blueprint to use',
        }),
        name: t.string({
          required: false,
          description: 'The name of the integration',
        }),
        description: t.string({
          required: false,
          description: 'The description of the integration',
        }),
        botId: t.id({
          required: false,
          description: 'The ID of the bot to connect',
        }),
        signingSecret: t.string({
          required: false,
          description: 'The Slack signing secret for request verification',
        }),
        botToken: t.string({
          required: false,
          description: 'The Slack bot token for API access',
        }),
        userToken: t.string({
          required: false,
          description: 'The Slack user token for additional permissions',
        }),
        visibleMessages: t.int({
          required: false,
          description: 'The number of visible messages in the conversation',
        }),
        contactCollection: t.boolean({
          required: false,
          description: 'Whether to collect contact information',
        }),
        sessionDuration: t.int({
          required: false,
          description: 'The duration of the session in milliseconds',
        }),
        ratings: t.boolean({
          required: false,
          description: 'Whether to enable message ratings',
        }),
        references: t.boolean({
          required: false,
          description: 'Whether to include message references',
        }),
        autoRespond: t.string({
          required: false,
          description: 'Auto-respond configuration for the integration',
        }),
        allowFrom: t.string({
          required: false,
          description:
            'Newline-or-comma-separated list of allowed senders. Use Slack user IDs (U…/W…), channel IDs (C…/G…/D…), @username, or #channel-name. Use * to allow all. Leave empty to deny all.',
        }),
        meta: t.field({
          type: Meta,
          required: false,
          description: 'Additional metadata for the integration',
        }),
      } satisfies Record<keyof _SlackIntegrationCreateRequest, unknown>),
  })

const SlackIntegrationUpdateResponse = builder
  .objectRef<_SlackIntegrationUpdateResponse>('SlackIntegrationUpdateResponse')
  .implement({
    description: 'Response containing the ID of an updated Slack integration',
    fields: (t) =>
      ({
        id: t.exposeID('id', {
          description: 'The unique identifier of the updated Slack integration',
        }),
      } satisfies Record<keyof _SlackIntegrationUpdateResponse, unknown>),
  })

const SlackIntegrationUpdateRequest = builder
  .inputRef<_SlackIntegrationUpdateRequest>('SlackIntegrationUpdateRequest')
  .implement({
    description: 'Input parameters for updating an existing Slack integration',
    fields: (t) =>
      ({
        alias: t.id({
          required: false,
          description: 'The alias ID for the integration',
        }),
        blueprintId: t.id({
          required: false,
          description: 'The ID of the blueprint to use',
        }),
        name: t.string({
          required: false,
          description: 'The name of the integration',
        }),
        description: t.string({
          required: false,
          description: 'The description of the integration',
        }),
        botId: t.id({
          required: false,
          description: 'The ID of the bot to connect',
        }),
        signingSecret: t.string({
          required: false,
          description: 'The Slack signing secret for request verification',
        }),
        botToken: t.string({
          required: false,
          description: 'The Slack bot token for API access',
        }),
        userToken: t.string({
          required: false,
          description: 'The Slack user token for additional permissions',
        }),
        visibleMessages: t.int({
          required: false,
          description: 'The number of visible messages in the conversation',
        }),
        contactCollection: t.boolean({
          required: false,
          description: 'Whether to collect contact information',
        }),
        sessionDuration: t.int({
          required: false,
          description: 'The duration of the session in milliseconds',
        }),
        ratings: t.boolean({
          required: false,
          description: 'Whether to enable message ratings',
        }),
        references: t.boolean({
          required: false,
          description: 'Whether to include message references',
        }),
        autoRespond: t.string({
          required: false,
          description: 'Auto-respond configuration for the integration',
        }),
        allowFrom: t.string({
          required: false,
          description:
            'Newline-or-comma-separated list of allowed senders. Use Slack user IDs (U…/W…), channel IDs (C…/G…/D…), @username, or #channel-name. Use * to allow all. Leave empty to deny all.',
        }),
        meta: t.field({
          type: Meta,
          required: false,
          description: 'Additional metadata for the integration',
        }),
      } satisfies Record<keyof _SlackIntegrationUpdateRequest, unknown>),
  })

const SlackIntegrationDeleteResponse = builder
  .objectRef<_SlackIntegrationDeleteResponse>('SlackIntegrationDeleteResponse')
  .implement({
    description: 'Response containing the ID of a deleted Slack integration',
    fields: (t) =>
      ({
        id: t.exposeID('id', {
          description: 'The unique identifier of the deleted Slack integration',
        }),
      } satisfies Record<keyof _SlackIntegrationDeleteResponse, unknown>),
  })

const DiscordIntegrationCreateResponse = builder
  .objectRef<_DiscordIntegrationCreateResponse>(
    'DiscordIntegrationCreateResponse'
  )
  .implement({
    description:
      'Response containing the ID of a newly created Discord integration',
    fields: (t) =>
      ({
        id: t.exposeID('id', {
          description:
            'The unique identifier of the created Discord integration',
        }),
      } satisfies Record<keyof _DiscordIntegrationCreateResponse, unknown>),
  })

const DiscordIntegrationCreateRequest = builder
  .inputRef<_DiscordIntegrationCreateRequest>('DiscordIntegrationCreateRequest')
  .implement({
    description: 'Input parameters for creating a new Discord integration',
    fields: (t) =>
      ({
        alias: t.id({
          required: false,
          description: 'The alias ID for the integration',
        }),
        blueprintId: t.id({
          required: false,
          description: 'The ID of the blueprint to use',
        }),
        name: t.string({
          required: false,
          description: 'The name of the integration',
        }),
        description: t.string({
          required: false,
          description: 'The description of the integration',
        }),
        botId: t.id({
          required: false,
          description: 'The ID of the bot to connect',
        }),
        appId: t.string({
          required: false,
          description: 'The Discord application ID',
        }),
        botToken: t.string({
          required: false,
          description: 'The Discord bot token for API access',
        }),
        publicKey: t.string({
          required: false,
          description: 'The Discord public key for request verification',
        }),
        handle: t.string({
          required: false,
          description: 'The bot handle or username',
        }),
        contactCollection: t.boolean({
          required: false,
          description: 'Whether to collect contact information',
        }),
        sessionDuration: t.int({
          required: false,
          description: 'The duration of the session in milliseconds',
        }),
        allowFrom: t.string({
          required: false,
          description: 'The allowed senders for the discord integration',
        }),
        meta: t.field({
          type: Meta,
          required: false,
          description: 'Additional metadata for the integration',
        }),
      } satisfies Record<keyof _DiscordIntegrationCreateRequest, unknown>),
  })

const DiscordIntegrationUpdateResponse = builder
  .objectRef<_DiscordIntegrationUpdateResponse>(
    'DiscordIntegrationUpdateResponse'
  )
  .implement({
    description: 'Response containing the ID of an updated Discord integration',
    fields: (t) =>
      ({
        id: t.exposeID('id', {
          description:
            'The unique identifier of the updated Discord integration',
        }),
      } satisfies Record<keyof _DiscordIntegrationUpdateResponse, unknown>),
  })

const DiscordIntegrationUpdateRequest = builder
  .inputRef<_DiscordIntegrationUpdateRequest>('DiscordIntegrationUpdateRequest')
  .implement({
    description:
      'Input parameters for updating an existing Discord integration',
    fields: (t) =>
      ({
        alias: t.id({
          required: false,
          description: 'The alias ID for the integration',
        }),
        blueprintId: t.id({
          required: false,
          description: 'The ID of the blueprint to use',
        }),
        name: t.string({
          required: false,
          description: 'The name of the integration',
        }),
        description: t.string({
          required: false,
          description: 'The description of the integration',
        }),
        botId: t.id({
          required: false,
          description: 'The ID of the bot to connect',
        }),
        appId: t.string({
          required: false,
          description: 'The Discord application ID',
        }),
        botToken: t.string({
          required: false,
          description: 'The Discord bot token for API access',
        }),
        publicKey: t.string({
          required: false,
          description: 'The Discord public key for request verification',
        }),
        handle: t.string({
          required: false,
          description: 'The bot handle or username',
        }),
        contactCollection: t.boolean({
          required: false,
          description: 'Whether to collect contact information',
        }),
        sessionDuration: t.int({
          required: false,
          description: 'The duration of the session in milliseconds',
        }),
        allowFrom: t.string({
          required: false,
          description: 'The allowed senders for the discord integration',
        }),
        meta: t.field({
          type: Meta,
          required: false,
          description: 'Additional metadata for the integration',
        }),
      } satisfies Record<keyof _DiscordIntegrationUpdateRequest, unknown>),
  })

const DiscordIntegrationDeleteResponse = builder
  .objectRef<_DiscordIntegrationDeleteResponse>(
    'DiscordIntegrationDeleteResponse'
  )
  .implement({
    description: 'Response containing the ID of a deleted Discord integration',
    fields: (t) =>
      ({
        id: t.exposeID('id', {
          description:
            'The unique identifier of the deleted Discord integration',
        }),
      } satisfies Record<keyof _DiscordIntegrationDeleteResponse, unknown>),
  })

const WhatsAppIntegrationCreateResponse = builder
  .objectRef<_WhatsAppIntegrationCreateResponse>(
    'WhatsAppIntegrationCreateResponse'
  )
  .implement({
    description:
      'Response containing the ID of a newly created WhatsApp integration',
    fields: (t) =>
      ({
        id: t.exposeID('id', {
          description:
            'The unique identifier of the created WhatsApp integration',
        }),
      } satisfies Record<keyof _WhatsAppIntegrationCreateResponse, unknown>),
  })

const WhatsAppIntegrationCreateRequest = builder
  .inputRef<_WhatsAppIntegrationCreateRequest>(
    'WhatsAppIntegrationCreateRequest'
  )
  .implement({
    description: 'Input parameters for creating a new WhatsApp integration',
    fields: (t) =>
      ({
        alias: t.id({
          required: false,
          description: 'The alias ID for the integration',
        }),
        blueprintId: t.id({
          required: false,
          description: 'The ID of the blueprint to use',
        }),
        name: t.string({
          required: false,
          description: 'The name of the integration',
        }),
        description: t.string({
          required: false,
          description: 'The description of the integration',
        }),
        botId: t.id({
          required: false,
          description: 'The ID of the bot to connect',
        }),
        phoneNumberId: t.string({
          required: false,
          description: 'The WhatsApp Business phone number ID',
        }),
        accessToken: t.string({
          required: false,
          description: 'The WhatsApp Business API access token',
        }),
        appSecret: t.string({
          required: false,
          description:
            'The Meta app secret used to validate webhook signatures',
        }),
        contactCollection: t.boolean({
          required: false,
          description: 'Whether to collect contact information',
        }),
        sessionDuration: t.int({
          required: false,
          description: 'The duration of the session in milliseconds',
        }),
        attachments: t.boolean({
          required: false,
          description: 'Whether to enable file attachments',
        }),
        allowFrom: t.string({
          required: false,
          description:
            'Newline-or-comma-separated list of allowed senders. Use phone numbers in E.164 format (digits only). Leave empty to block all. Use * to allow everyone.',
        }),
        meta: t.field({
          type: Meta,
          required: false,
          description: 'Additional metadata for the integration',
        }),
      } satisfies Record<keyof _WhatsAppIntegrationCreateRequest, unknown>),
  })

const WhatsAppIntegrationUpdateResponse = builder
  .objectRef<_WhatsAppIntegrationUpdateResponse>(
    'WhatsAppIntegrationUpdateResponse'
  )
  .implement({
    description:
      'Response containing the ID of an updated WhatsApp integration',
    fields: (t) =>
      ({
        id: t.exposeID('id', {
          description:
            'The unique identifier of the updated WhatsApp integration',
        }),
      } satisfies Record<keyof _WhatsAppIntegrationUpdateResponse, unknown>),
  })

const WhatsAppIntegrationUpdateRequest = builder
  .inputRef<_WhatsAppIntegrationUpdateRequest>(
    'WhatsAppIntegrationUpdateRequest'
  )
  .implement({
    description:
      'Input parameters for updating an existing WhatsApp integration',
    fields: (t) =>
      ({
        alias: t.id({
          required: false,
          description: 'The alias ID for the integration',
        }),
        blueprintId: t.id({
          required: false,
          description: 'The ID of the blueprint to use',
        }),
        name: t.string({
          required: false,
          description: 'The name of the integration',
        }),
        description: t.string({
          required: false,
          description: 'The description of the integration',
        }),
        botId: t.id({
          required: false,
          description: 'The ID of the bot to connect',
        }),
        phoneNumberId: t.string({
          required: false,
          description: 'The WhatsApp Business phone number ID',
        }),
        accessToken: t.string({
          required: false,
          description: 'The WhatsApp Business API access token',
        }),
        appSecret: t.string({
          required: false,
          description:
            'The Meta app secret used to validate webhook signatures',
        }),
        contactCollection: t.boolean({
          required: false,
          description: 'Whether to collect contact information',
        }),
        sessionDuration: t.int({
          required: false,
          description: 'The duration of the session in milliseconds',
        }),
        attachments: t.boolean({
          required: false,
          description: 'Whether to enable file attachments',
        }),
        allowFrom: t.string({
          required: false,
          description:
            'Newline-or-comma-separated list of allowed senders. Use phone numbers in E.164 format (digits only). Leave empty to block all. Use * to allow everyone.',
        }),
        meta: t.field({
          type: Meta,
          required: false,
          description: 'Additional metadata for the integration',
        }),
      } satisfies Record<keyof _WhatsAppIntegrationUpdateRequest, unknown>),
  })

const WhatsAppIntegrationDeleteResponse = builder
  .objectRef<_WhatsAppIntegrationDeleteResponse>(
    'WhatsAppIntegrationDeleteResponse'
  )
  .implement({
    description: 'Response containing the ID of a deleted WhatsApp integration',
    fields: (t) =>
      ({
        id: t.exposeID('id', {
          description:
            'The unique identifier of the deleted WhatsApp integration',
        }),
      } satisfies Record<keyof _WhatsAppIntegrationDeleteResponse, unknown>),
  })

const MessengerIntegrationCreateResponse = builder
  .objectRef<_MessengerIntegrationCreateResponse>(
    'MessengerIntegrationCreateResponse'
  )
  .implement({
    description:
      'Response containing the ID of a newly created Messenger integration',
    fields: (t) =>
      ({
        id: t.exposeID('id', {
          description:
            'The unique identifier of the created Messenger integration',
        }),
      } satisfies Record<keyof _MessengerIntegrationCreateResponse, unknown>),
  })

const MessengerIntegrationCreateRequest = builder
  .inputRef<_MessengerIntegrationCreateRequest>(
    'MessengerIntegrationCreateRequest'
  )
  .implement({
    description: 'Input parameters for creating a new Messenger integration',
    fields: (t) =>
      ({
        alias: t.id({
          required: false,
          description: 'The alias ID for the integration',
        }),
        blueprintId: t.id({
          required: false,
          description: 'The ID of the blueprint to use',
        }),
        name: t.string({
          required: false,
          description: 'The name of the integration',
        }),
        description: t.string({
          required: false,
          description: 'The description of the integration',
        }),
        botId: t.id({
          required: false,
          description: 'The ID of the bot to connect',
        }),
        accessToken: t.string({
          required: false,
          description: 'The Facebook Messenger page access token',
        }),
        appSecret: t.string({
          required: false,
          description:
            'The Meta app secret used to validate webhook signatures',
        }),
        contactCollection: t.boolean({
          required: false,
          description: 'Whether to enable contact collection',
        }),
        sessionDuration: t.int({
          required: false,
          description: 'The duration of the session in milliseconds',
        }),
        attachments: t.boolean({
          required: false,
          description: 'Whether to enable file attachments',
        }),
        meta: t.field({
          type: Meta,
          required: false,
          description: 'Additional metadata for the integration',
        }),
      } satisfies Record<keyof _MessengerIntegrationCreateRequest, unknown>),
  })

const MessengerIntegrationUpdateResponse = builder
  .objectRef<_MessengerIntegrationUpdateResponse>(
    'MessengerIntegrationUpdateResponse'
  )
  .implement({
    description:
      'Response containing the ID of an updated Messenger integration',
    fields: (t) =>
      ({
        id: t.exposeID('id', {
          description:
            'The unique identifier of the updated Messenger integration',
        }),
      } satisfies Record<keyof _MessengerIntegrationUpdateResponse, unknown>),
  })

const MessengerIntegrationUpdateRequest = builder
  .inputRef<_MessengerIntegrationUpdateRequest>(
    'MessengerIntegrationUpdateRequest'
  )
  .implement({
    description:
      'Input parameters for updating an existing Messenger integration',
    fields: (t) =>
      ({
        alias: t.id({
          required: false,
          description: 'The alias ID for the integration',
        }),
        blueprintId: t.id({
          required: false,
          description: 'The ID of the blueprint to use',
        }),
        name: t.string({
          required: false,
          description: 'The name of the integration',
        }),
        description: t.string({
          required: false,
          description: 'The description of the integration',
        }),
        botId: t.id({
          required: false,
          description: 'The ID of the bot to connect',
        }),
        accessToken: t.string({
          required: false,
          description: 'The Facebook Messenger page access token',
        }),
        appSecret: t.string({
          required: false,
          description:
            'The Meta app secret used to validate webhook signatures',
        }),
        contactCollection: t.boolean({
          required: false,
          description: 'Whether to enable contact collection',
        }),
        sessionDuration: t.int({
          required: false,
          description: 'The duration of the session in milliseconds',
        }),
        attachments: t.boolean({
          required: false,
          description: 'Whether to enable file attachments',
        }),
        meta: t.field({
          type: Meta,
          required: false,
          description: 'Additional metadata for the integration',
        }),
      } satisfies Record<keyof _MessengerIntegrationUpdateRequest, unknown>),
  })

const MessengerIntegrationDeleteResponse = builder
  .objectRef<_MessengerIntegrationDeleteResponse>(
    'MessengerIntegrationDeleteResponse'
  )
  .implement({
    description:
      'Response containing the ID of a deleted Messenger integration',
    fields: (t) =>
      ({
        id: t.exposeID('id', {
          description:
            'The unique identifier of the deleted Messenger integration',
        }),
      } satisfies Record<keyof _MessengerIntegrationDeleteResponse, unknown>),
  })

const InstagramIntegrationCreateResponse = builder
  .objectRef<_InstagramIntegrationCreateResponse>(
    'InstagramIntegrationCreateResponse'
  )
  .implement({
    description:
      'Response containing the ID of a newly created Instagram integration',
    fields: (t) =>
      ({
        id: t.exposeID('id', {
          description:
            'The unique identifier of the created Instagram integration',
        }),
      } satisfies Record<keyof _InstagramIntegrationCreateResponse, unknown>),
  })

const InstagramIntegrationCreateRequest = builder
  .inputRef<_InstagramIntegrationCreateRequest>(
    'InstagramIntegrationCreateRequest'
  )
  .implement({
    description: 'Input parameters for creating a new Instagram integration',
    fields: (t) =>
      ({
        alias: t.id({
          required: false,
          description: 'The alias ID for the integration',
        }),
        blueprintId: t.id({
          required: false,
          description: 'The ID of the blueprint to use',
        }),
        name: t.string({
          required: false,
          description: 'The name of the integration',
        }),
        description: t.string({
          required: false,
          description: 'The description of the integration',
        }),
        botId: t.id({
          required: false,
          description: 'The ID of the bot to connect',
        }),
        accessToken: t.string({
          required: false,
          description: 'The Instagram access token',
        }),
        appSecret: t.string({
          required: false,
          description:
            'The Meta app secret used to validate webhook signatures',
        }),
        contactCollection: t.boolean({
          required: false,
          description: 'Whether to collect contact information',
        }),
        sessionDuration: t.int({
          required: false,
          description: 'The duration of the session in milliseconds',
        }),
        attachments: t.boolean({
          required: false,
          description: 'Whether to enable file attachments',
        }),
        meta: t.field({
          type: Meta,
          required: false,
          description: 'Additional metadata for the integration',
        }),
      } satisfies Record<keyof _InstagramIntegrationCreateRequest, unknown>),
  })

const InstagramIntegrationUpdateResponse = builder
  .objectRef<_InstagramIntegrationUpdateResponse>(
    'InstagramIntegrationUpdateResponse'
  )
  .implement({
    description:
      'Response containing the ID of an updated Instagram integration',
    fields: (t) =>
      ({
        id: t.exposeID('id', {
          description:
            'The unique identifier of the updated Instagram integration',
        }),
      } satisfies Record<keyof _InstagramIntegrationUpdateResponse, unknown>),
  })

const InstagramIntegrationUpdateRequest = builder
  .inputRef<_InstagramIntegrationUpdateRequest>(
    'InstagramIntegrationUpdateRequest'
  )
  .implement({
    description:
      'Input parameters for updating an existing Instagram integration',
    fields: (t) =>
      ({
        alias: t.id({
          required: false,
          description: 'The alias ID for the integration',
        }),
        blueprintId: t.id({
          required: false,
          description: 'The ID of the blueprint to use',
        }),
        name: t.string({
          required: false,
          description: 'The name of the integration',
        }),
        description: t.string({
          required: false,
          description: 'The description of the integration',
        }),
        botId: t.id({
          required: false,
          description: 'The ID of the bot to connect',
        }),
        accessToken: t.string({
          required: false,
          description: 'The Instagram access token',
        }),
        appSecret: t.string({
          required: false,
          description:
            'The Meta app secret used to validate webhook signatures',
        }),
        contactCollection: t.boolean({
          required: false,
          description: 'Whether to collect contact information',
        }),
        sessionDuration: t.int({
          required: false,
          description: 'The duration of the session in milliseconds',
        }),
        attachments: t.boolean({
          required: false,
          description: 'Whether to enable file attachments',
        }),
        meta: t.field({
          type: Meta,
          required: false,
          description: 'Additional metadata for the integration',
        }),
      } satisfies Record<keyof _InstagramIntegrationUpdateRequest, unknown>),
  })

const InstagramIntegrationDeleteResponse = builder
  .objectRef<_InstagramIntegrationDeleteResponse>(
    'InstagramIntegrationDeleteResponse'
  )
  .implement({
    description:
      'Response containing the ID of a deleted Instagram integration',
    fields: (t) =>
      ({
        id: t.exposeID('id', {
          description:
            'The unique identifier of the deleted Instagram integration',
        }),
      } satisfies Record<keyof _InstagramIntegrationDeleteResponse, unknown>),
  })

const TelegramIntegrationCreateResponse = builder
  .objectRef<_TelegramIntegrationCreateResponse>(
    'TelegramIntegrationCreateResponse'
  )
  .implement({
    description:
      'Response containing the ID of a newly created Telegram integration',
    fields: (t) =>
      ({
        id: t.exposeID('id', {
          description:
            'The unique identifier of the created Telegram integration',
        }),
      } satisfies Record<keyof _TelegramIntegrationCreateResponse, unknown>),
  })

const TelegramIntegrationCreateRequest = builder
  .inputRef<_TelegramIntegrationCreateRequest>(
    'TelegramIntegrationCreateRequest'
  )
  .implement({
    description: 'Input parameters for creating a new Telegram integration',
    fields: (t) =>
      ({
        alias: t.id({
          required: false,
          description: 'The alias ID for the integration',
        }),
        blueprintId: t.id({
          required: false,
          description: 'The ID of the blueprint to use',
        }),
        name: t.string({
          required: false,
          description: 'The name of the integration',
        }),
        description: t.string({
          required: false,
          description: 'The description of the integration',
        }),
        botId: t.id({
          required: false,
          description: 'The ID of the bot to connect',
        }),
        botToken: t.string({
          required: false,
          description: 'The Telegram bot token for API access',
        }),
        contactCollection: t.boolean({
          required: false,
          description: 'Whether to collect contact information',
        }),
        sessionDuration: t.int({
          required: false,
          description: 'The duration of the session in milliseconds',
        }),
        attachments: t.boolean({
          required: false,
          description: 'Whether to enable file attachments',
        }),
        allowFrom: t.string({
          required: false,
          description:
            'Newline-or-comma-separated list of allowed senders. Use @username or @numericId for users, #chatId for groups. Leave empty to allow all.',
        }),
        meta: t.field({
          type: Meta,
          required: false,
          description: 'Additional metadata for the integration',
        }),
      } satisfies Record<keyof _TelegramIntegrationCreateRequest, unknown>),
  })

const TelegramIntegrationUpdateResponse = builder
  .objectRef<_TelegramIntegrationUpdateResponse>(
    'TelegramIntegrationUpdateResponse'
  )
  .implement({
    description:
      'Response containing the ID of an updated Telegram integration',
    fields: (t) =>
      ({
        id: t.exposeID('id', {
          description:
            'The unique identifier of the updated Telegram integration',
        }),
      } satisfies Record<keyof _TelegramIntegrationUpdateResponse, unknown>),
  })

const TelegramIntegrationUpdateRequest = builder
  .inputRef<_TelegramIntegrationUpdateRequest>(
    'TelegramIntegrationUpdateRequest'
  )
  .implement({
    description:
      'Input parameters for updating an existing Telegram integration',
    fields: (t) =>
      ({
        alias: t.id({
          required: false,
          description: 'The alias ID for the integration',
        }),
        blueprintId: t.id({
          required: false,
          description: 'The ID of the blueprint to use',
        }),
        name: t.string({
          required: false,
          description: 'The name of the integration',
        }),
        description: t.string({
          required: false,
          description: 'The description of the integration',
        }),
        botId: t.id({
          required: false,
          description: 'The ID of the bot to connect',
        }),
        botToken: t.string({
          required: false,
          description: 'The Telegram bot token for API access',
        }),
        contactCollection: t.boolean({
          required: false,
          description: 'Whether to collect contact information',
        }),
        sessionDuration: t.int({
          required: false,
          description: 'The duration of the session in milliseconds',
        }),
        attachments: t.boolean({
          required: false,
          description: 'Whether to enable file attachments',
        }),
        allowFrom: t.string({
          required: false,
          description:
            'Newline-or-comma-separated list of allowed senders. Use @username or @numericId for users, #chatId for groups. Leave empty to allow all.',
        }),
        meta: t.field({
          type: Meta,
          required: false,
          description: 'Additional metadata for the integration',
        }),
      } satisfies Record<keyof _TelegramIntegrationUpdateRequest, unknown>),
  })

const TelegramIntegrationDeleteResponse = builder
  .objectRef<_TelegramIntegrationDeleteResponse>(
    'TelegramIntegrationDeleteResponse'
  )
  .implement({
    description: 'Response containing the ID of a deleted Telegram integration',
    fields: (t) =>
      ({
        id: t.exposeID('id', {
          description:
            'The unique identifier of the deleted Telegram integration',
        }),
      } satisfies Record<keyof _TelegramIntegrationDeleteResponse, unknown>),
  })

const TwilioIntegrationCreateResponse = builder
  .objectRef<_TwilioIntegrationCreateResponse>(
    'TwilioIntegrationCreateResponse'
  )
  .implement({
    description:
      'Response containing the ID of a newly created Twilio integration',
    fields: (t) =>
      ({
        id: t.exposeID('id', {
          description:
            'The unique identifier of the created Twilio integration',
        }),
      } satisfies Record<keyof _TwilioIntegrationCreateResponse, unknown>),
  })

const TwilioIntegrationCreateRequest = builder
  .inputRef<_TwilioIntegrationCreateRequest>('TwilioIntegrationCreateRequest')
  .implement({
    description: 'Input parameters for creating a new Twilio integration',
    fields: (t) =>
      ({
        alias: t.id({
          required: false,
          description: 'The alias ID for the integration',
        }),
        blueprintId: t.id({
          required: false,
          description: 'The ID of the blueprint to use',
        }),
        name: t.string({
          required: false,
          description: 'The name of the integration',
        }),
        description: t.string({
          required: false,
          description: 'The description of the integration',
        }),
        botId: t.id({
          required: false,
          description: 'The ID of the bot to connect',
        }),
        accountSid: t.string({
          required: false,
          description: 'The Twilio Account SID',
        }),
        authToken: t.string({
          required: false,
          description: 'The Twilio auth token',
        }),
        voice: t.string({
          required: false,
          description: 'The Twilio voice configuration',
        }),
        contactCollection: t.boolean({
          required: false,
          description: 'Whether to collect contact information',
        }),
        sessionDuration: t.int({
          required: false,
          description: 'The duration of the session in milliseconds',
        }),
        allowFrom: t.string({
          required: false,
          description: 'The allowed senders for the integration',
        }),
        meta: t.field({
          type: Meta,
          required: false,
          description: 'Additional metadata for the integration',
        }),
      } satisfies Record<keyof _TwilioIntegrationCreateRequest, unknown>),
  })

const TwilioIntegrationUpdateResponse = builder
  .objectRef<_TwilioIntegrationUpdateResponse>(
    'TwilioIntegrationUpdateResponse'
  )
  .implement({
    description: 'Response containing the ID of an updated Twilio integration',
    fields: (t) =>
      ({
        id: t.exposeID('id', {
          description:
            'The unique identifier of the updated Twilio integration',
        }),
      } satisfies Record<keyof _TwilioIntegrationUpdateResponse, unknown>),
  })

const TwilioIntegrationUpdateRequest = builder
  .inputRef<_TwilioIntegrationUpdateRequest>('TwilioIntegrationUpdateRequest')
  .implement({
    description: 'Input parameters for updating an existing Twilio integration',
    fields: (t) =>
      ({
        alias: t.id({
          required: false,
          description: 'The alias ID for the integration',
        }),
        blueprintId: t.id({
          required: false,
          description: 'The ID of the blueprint to use',
        }),
        name: t.string({
          required: false,
          description: 'The name of the integration',
        }),
        description: t.string({
          required: false,
          description: 'The description of the integration',
        }),
        botId: t.id({
          required: false,
          description: 'The ID of the bot to connect',
        }),
        accountSid: t.string({
          required: false,
          description: 'The Twilio Account SID',
        }),
        authToken: t.string({
          required: false,
          description: 'The Twilio auth token',
        }),
        voice: t.string({
          required: false,
          description: 'The Twilio voice configuration',
        }),
        contactCollection: t.boolean({
          required: false,
          description: 'Whether to collect contact information',
        }),
        sessionDuration: t.int({
          required: false,
          description: 'The duration of the session in milliseconds',
        }),
        allowFrom: t.string({
          required: false,
          description: 'The allowed senders for the integration',
        }),
        meta: t.field({
          type: Meta,
          required: false,
          description: 'Additional metadata for the integration',
        }),
      } satisfies Record<keyof _TwilioIntegrationUpdateRequest, unknown>),
  })

const TwilioIntegrationDeleteResponse = builder
  .objectRef<_TwilioIntegrationDeleteResponse>(
    'TwilioIntegrationDeleteResponse'
  )
  .implement({
    description: 'Response containing the ID of a deleted Twilio integration',
    fields: (t) =>
      ({
        id: t.exposeID('id', {
          description:
            'The unique identifier of the deleted Twilio integration',
        }),
      } satisfies Record<keyof _TwilioIntegrationDeleteResponse, unknown>),
  })

const MicrosoftteamsIntegrationCreateResponse = builder
  .objectRef<_MicrosoftteamsIntegrationCreateResponse>(
    'MicrosoftteamsIntegrationCreateResponse'
  )
  .implement({
    description:
      'Response containing the ID of a newly created Microsoft Teams integration',
    fields: (t) =>
      ({
        id: t.exposeID('id', {
          description:
            'The unique identifier of the created Microsoft Teams integration',
        }),
      } satisfies Record<
        keyof _MicrosoftteamsIntegrationCreateResponse,
        unknown
      >),
  })

const MicrosoftteamsIntegrationCreateRequest = builder
  .inputRef<_MicrosoftteamsIntegrationCreateRequest>(
    'MicrosoftteamsIntegrationCreateRequest'
  )
  .implement({
    description:
      'Input parameters for creating a new Microsoft Teams integration',
    fields: (t) =>
      ({
        alias: t.id({
          required: false,
          description: 'The alias ID for the integration',
        }),
        blueprintId: t.id({
          required: false,
          description: 'The ID of the blueprint to use',
        }),
        name: t.string({
          required: false,
          description: 'The name of the integration',
        }),
        description: t.string({
          required: false,
          description: 'The description of the integration',
        }),
        botId: t.id({
          required: false,
          description: 'The ID of the bot to connect',
        }),
        botFrameworkAppId: t.string({
          required: false,
          description: 'The Microsoft Bot Framework application ID',
        }),
        botFrameworkAppSecret: t.string({
          required: false,
          description: 'The Microsoft Bot Framework application secret',
        }),
        tenantId: t.string({
          required: false,
          description: 'The Azure AD tenant ID',
        }),
        contactCollection: t.boolean({
          required: false,
          description: 'Whether to collect contact information',
        }),
        sessionDuration: t.int({
          required: false,
          description: 'The duration of the session in milliseconds',
        }),
        allowFrom: t.string({
          required: false,
          description: 'The allowed senders for this integration',
        }),
        meta: t.field({
          type: Meta,
          required: false,
          description: 'Additional metadata for the integration',
        }),
      } satisfies Record<
        keyof _MicrosoftteamsIntegrationCreateRequest,
        unknown
      >),
  })

const MicrosoftteamsIntegrationUpdateResponse = builder
  .objectRef<_MicrosoftteamsIntegrationUpdateResponse>(
    'MicrosoftteamsIntegrationUpdateResponse'
  )
  .implement({
    description:
      'Response containing the ID of an updated Microsoft Teams integration',
    fields: (t) =>
      ({
        id: t.exposeID('id', {
          description:
            'The unique identifier of the updated Microsoft Teams integration',
        }),
      } satisfies Record<
        keyof _MicrosoftteamsIntegrationUpdateResponse,
        unknown
      >),
  })

const MicrosoftteamsIntegrationUpdateRequest = builder
  .inputRef<_MicrosoftteamsIntegrationUpdateRequest>(
    'MicrosoftteamsIntegrationUpdateRequest'
  )
  .implement({
    description:
      'Input parameters for updating an existing Microsoft Teams integration',
    fields: (t) =>
      ({
        alias: t.id({
          required: false,
          description: 'The alias ID for the integration',
        }),
        blueprintId: t.id({
          required: false,
          description: 'The ID of the blueprint to use',
        }),
        name: t.string({
          required: false,
          description: 'The name of the integration',
        }),
        description: t.string({
          required: false,
          description: 'The description of the integration',
        }),
        botId: t.id({
          required: false,
          description: 'The ID of the bot to connect',
        }),
        botFrameworkAppId: t.string({
          required: false,
          description: 'The Microsoft Bot Framework application ID',
        }),
        botFrameworkAppSecret: t.string({
          required: false,
          description: 'The Microsoft Bot Framework application secret',
        }),
        tenantId: t.string({
          required: false,
          description: 'The Azure AD tenant ID',
        }),
        contactCollection: t.boolean({
          required: false,
          description: 'Whether to collect contact information',
        }),
        sessionDuration: t.int({
          required: false,
          description: 'The duration of the session in milliseconds',
        }),
        allowFrom: t.string({
          required: false,
          description: 'The allowed senders for this integration',
        }),
        meta: t.field({
          type: Meta,
          required: false,
          description: 'Additional metadata for the integration',
        }),
      } satisfies Record<
        keyof _MicrosoftteamsIntegrationUpdateRequest,
        unknown
      >),
  })

const MicrosoftteamsIntegrationDeleteResponse = builder
  .objectRef<_MicrosoftteamsIntegrationDeleteResponse>(
    'MicrosoftteamsIntegrationDeleteResponse'
  )
  .implement({
    description:
      'Response containing the ID of a deleted Microsoft Teams integration',
    fields: (t) =>
      ({
        id: t.exposeID('id', {
          description:
            'The unique identifier of the deleted Microsoft Teams integration',
        }),
      } satisfies Record<
        keyof _MicrosoftteamsIntegrationDeleteResponse,
        unknown
      >),
  })

const GooglechatIntegrationCreateResponse = builder
  .objectRef<_GooglechatIntegrationCreateResponse>(
    'GooglechatIntegrationCreateResponse'
  )
  .implement({
    description:
      'Response containing the ID of a newly created Google Chat integration',
    fields: (t) =>
      ({
        id: t.exposeID('id', {
          description:
            'The unique identifier of the created Google Chat integration',
        }),
      } satisfies Record<keyof _GooglechatIntegrationCreateResponse, unknown>),
  })

const GooglechatIntegrationCreateRequest = builder
  .inputRef<_GooglechatIntegrationCreateRequest>(
    'GooglechatIntegrationCreateRequest'
  )
  .implement({
    description: 'Input parameters for creating a new Google Chat integration',
    fields: (t) =>
      ({
        alias: t.id({
          required: false,
          description: 'The alias ID for the integration',
        }),
        blueprintId: t.id({
          required: false,
          description: 'The ID of the blueprint to use',
        }),
        name: t.string({
          required: false,
          description: 'The name of the integration',
        }),
        description: t.string({
          required: false,
          description: 'The description of the integration',
        }),
        botId: t.id({
          required: false,
          description: 'The ID of the bot to connect',
        }),
        serviceAccountKey: t.string({
          required: false,
          description:
            'The Google service account JSON key for sending messages via the Chat REST API',
        }),
        projectNumber: t.string({
          required: false,
          description:
            'The Google Cloud project number used to verify incoming event JWT audience claims',
        }),
        contactCollection: t.boolean({
          required: false,
          description: 'Whether to collect contact information',
        }),
        sessionDuration: t.int({
          required: false,
          description: 'The duration of the session in milliseconds',
        }),
        attachments: t.boolean({
          required: false,
          description: 'Whether to enable file attachments',
        }),
        autoRespond: t.string({
          required: false,
          description: 'Configure automatic response behavior',
        }),
        allowFrom: t.string({
          required: false,
          description: 'The allowed senders for this integration',
        }),
        meta: t.field({
          type: Meta,
          required: false,
          description: 'Additional metadata for the integration',
        }),
      } satisfies Record<keyof _GooglechatIntegrationCreateRequest, unknown>),
  })

const GooglechatIntegrationUpdateResponse = builder
  .objectRef<_GooglechatIntegrationUpdateResponse>(
    'GooglechatIntegrationUpdateResponse'
  )
  .implement({
    description:
      'Response containing the ID of an updated Google Chat integration',
    fields: (t) =>
      ({
        id: t.exposeID('id', {
          description:
            'The unique identifier of the updated Google Chat integration',
        }),
      } satisfies Record<keyof _GooglechatIntegrationUpdateResponse, unknown>),
  })

const GooglechatIntegrationUpdateRequest = builder
  .inputRef<_GooglechatIntegrationUpdateRequest>(
    'GooglechatIntegrationUpdateRequest'
  )
  .implement({
    description:
      'Input parameters for updating an existing Google Chat integration',
    fields: (t) =>
      ({
        alias: t.id({
          required: false,
          description: 'The alias ID for the integration',
        }),
        blueprintId: t.id({
          required: false,
          description: 'The ID of the blueprint to use',
        }),
        name: t.string({
          required: false,
          description: 'The name of the integration',
        }),
        description: t.string({
          required: false,
          description: 'The description of the integration',
        }),
        botId: t.id({
          required: false,
          description: 'The ID of the bot to connect',
        }),
        serviceAccountKey: t.string({
          required: false,
          description:
            'The Google service account JSON key for sending messages via the Chat REST API',
        }),
        projectNumber: t.string({
          required: false,
          description:
            'The Google Cloud project number used to verify incoming event JWT audience claims',
        }),
        contactCollection: t.boolean({
          required: false,
          description: 'Whether to collect contact information',
        }),
        sessionDuration: t.int({
          required: false,
          description: 'The duration of the session in milliseconds',
        }),
        attachments: t.boolean({
          required: false,
          description: 'Whether to enable file attachments',
        }),
        autoRespond: t.string({
          required: false,
          description: 'Configure automatic response behavior',
        }),
        allowFrom: t.string({
          required: false,
          description: 'The allowed senders for this integration',
        }),
        meta: t.field({
          type: Meta,
          required: false,
          description: 'Additional metadata for the integration',
        }),
      } satisfies Record<keyof _GooglechatIntegrationUpdateRequest, unknown>),
  })

const GooglechatIntegrationDeleteResponse = builder
  .objectRef<_GooglechatIntegrationDeleteResponse>(
    'GooglechatIntegrationDeleteResponse'
  )
  .implement({
    description:
      'Response containing the ID of a deleted Google Chat integration',
    fields: (t) =>
      ({
        id: t.exposeID('id', {
          description:
            'The unique identifier of the deleted Google Chat integration',
        }),
      } satisfies Record<keyof _GooglechatIntegrationDeleteResponse, unknown>),
  })

const EmailIntegrationCreateResponse = builder
  .objectRef<_EmailIntegrationCreateResponse>('EmailIntegrationCreateResponse')
  .implement({
    description:
      'Response containing the ID of a newly created Email integration',
    fields: (t) =>
      ({
        id: t.exposeID('id', {
          description: 'The unique identifier of the created Email integration',
        }),
      } satisfies Record<keyof _EmailIntegrationCreateResponse, unknown>),
  })

const EmailIntegrationCreateRequest = builder
  .inputRef<_EmailIntegrationCreateRequest>('EmailIntegrationCreateRequest')
  .implement({
    description: 'Input parameters for creating a new Email integration',
    fields: (t) =>
      ({
        alias: t.id({
          required: false,
          description: 'The alias ID for the integration',
        }),
        blueprintId: t.id({
          required: false,
          description: 'The ID of the blueprint to use',
        }),
        name: t.string({
          required: false,
          description: 'The name of the integration',
        }),
        description: t.string({
          required: false,
          description: 'The description of the integration',
        }),
        botId: t.id({
          required: false,
          description: 'The ID of the bot to connect',
        }),
        contactCollection: t.boolean({
          required: false,
          description: 'Whether to collect contact information',
        }),
        sessionDuration: t.int({
          required: false,
          description: 'The duration of the session in milliseconds',
        }),
        attachments: t.boolean({
          required: false,
          description: 'Whether to enable file attachments',
        }),
        allowFrom: t.string({
          required: false,
          description:
            'A line-separated list of allowed sender email addresses',
        }),
        meta: t.field({
          type: Meta,
          required: false,
          description: 'Additional metadata for the integration',
        }),
      } satisfies Record<keyof _EmailIntegrationCreateRequest, unknown>),
  })

const EmailIntegrationUpdateResponse = builder
  .objectRef<_EmailIntegrationUpdateResponse>('EmailIntegrationUpdateResponse')
  .implement({
    description: 'Response containing the ID of an updated Email integration',
    fields: (t) =>
      ({
        id: t.exposeID('id', {
          description: 'The unique identifier of the updated Email integration',
        }),
      } satisfies Record<keyof _EmailIntegrationUpdateResponse, unknown>),
  })

const EmailIntegrationUpdateRequest = builder
  .inputRef<_EmailIntegrationUpdateRequest>('EmailIntegrationUpdateRequest')
  .implement({
    description: 'Input parameters for updating an existing Email integration',
    fields: (t) =>
      ({
        alias: t.id({
          required: false,
          description: 'The alias ID for the integration',
        }),
        blueprintId: t.id({
          required: false,
          description: 'The ID of the blueprint to use',
        }),
        name: t.string({
          required: false,
          description: 'The name of the integration',
        }),
        description: t.string({
          required: false,
          description: 'The description of the integration',
        }),
        botId: t.id({
          required: false,
          description: 'The ID of the bot to connect',
        }),
        contactCollection: t.boolean({
          required: false,
          description: 'Whether to collect contact information',
        }),
        sessionDuration: t.int({
          required: false,
          description: 'The duration of the session in milliseconds',
        }),
        attachments: t.boolean({
          required: false,
          description: 'Whether to enable file attachments',
        }),
        allowFrom: t.string({
          required: false,
          description:
            'A line-separated list of allowed sender email addresses',
        }),
        meta: t.field({
          type: Meta,
          required: false,
          description: 'Additional metadata for the integration',
        }),
      } satisfies Record<keyof _EmailIntegrationUpdateRequest, unknown>),
  })

const EmailIntegrationDeleteResponse = builder
  .objectRef<_EmailIntegrationDeleteResponse>('EmailIntegrationDeleteResponse')
  .implement({
    description: 'Response containing the ID of a deleted Email integration',
    fields: (t) =>
      ({
        id: t.exposeID('id', {
          description: 'The unique identifier of the deleted Email integration',
        }),
      } satisfies Record<keyof _EmailIntegrationDeleteResponse, unknown>),
  })

const TriggerIntegrationCreateResponse = builder
  .objectRef<_TriggerIntegrationCreateResponse>(
    'TriggerIntegrationCreateResponse'
  )
  .implement({
    description:
      'Response containing the ID of a newly created Trigger integration',
    fields: (t) =>
      ({
        id: t.exposeID('id', {
          description:
            'The unique identifier of the created Trigger integration',
        }),
      } satisfies Record<keyof _TriggerIntegrationCreateResponse, unknown>),
  })

const TriggerIntegrationCreateRequest = builder
  .inputRef<_TriggerIntegrationCreateRequest>('TriggerIntegrationCreateRequest')
  .implement({
    description: 'Input parameters for creating a new Trigger integration',
    fields: (t) =>
      ({
        alias: t.id({
          required: false,
          description: 'The alias ID for the integration',
        }),
        blueprintId: t.id({
          required: false,
          description: 'The ID of the blueprint to use',
        }),
        name: t.string({
          required: false,
          description: 'The name of the integration',
        }),
        description: t.string({
          required: false,
          description: 'The description of the integration',
        }),
        botId: t.id({
          required: false,
          description: 'The ID of the bot to connect',
        }),
        authenticate: t.boolean({
          required: false,
          description: 'Whether to require authentication for the trigger',
        }),
        schedule: t.string({
          required: false,
          description: 'The schedule for automatic trigger execution',
        }),
        timezone: t.string({
          required: false,
          description:
            'The IANA timezone used to evaluate the trigger schedule',
        }),
        sessionDuration: t.int({
          required: false,
          description: 'The duration of the session in milliseconds',
        }),
        meta: t.field({
          type: Meta,
          required: false,
          description: 'Additional metadata for the integration',
        }),
      } satisfies Record<keyof _TriggerIntegrationCreateRequest, unknown>),
  })

const TriggerIntegrationUpdateResponse = builder
  .objectRef<_TriggerIntegrationUpdateResponse>(
    'TriggerIntegrationUpdateResponse'
  )
  .implement({
    description: 'Response containing the ID of an updated Trigger integration',
    fields: (t) =>
      ({
        id: t.exposeID('id', {
          description:
            'The unique identifier of the updated Trigger integration',
        }),
      } satisfies Record<keyof _TriggerIntegrationUpdateResponse, unknown>),
  })

const TriggerIntegrationUpdateRequest = builder
  .inputRef<_TriggerIntegrationUpdateRequest>('TriggerIntegrationUpdateRequest')
  .implement({
    description:
      'Input parameters for updating an existing Trigger integration',
    fields: (t) =>
      ({
        alias: t.id({
          required: false,
          description: 'The alias ID for the integration',
        }),
        blueprintId: t.id({
          required: false,
          description: 'The ID of the blueprint to use',
        }),
        name: t.string({
          required: false,
          description: 'The name of the integration',
        }),
        description: t.string({
          required: false,
          description: 'The description of the integration',
        }),
        botId: t.id({
          required: false,
          description: 'The ID of the bot to connect',
        }),
        authenticate: t.boolean({
          required: false,
          description: 'Whether to require authentication for the trigger',
        }),
        schedule: t.string({
          required: false,
          description: 'The schedule for automatic trigger execution',
        }),
        timezone: t.string({
          required: false,
          description:
            'The IANA timezone used to evaluate the trigger schedule',
        }),
        sessionDuration: t.int({
          required: false,
          description: 'The duration of the session in milliseconds',
        }),
        meta: t.field({
          type: Meta,
          required: false,
          description: 'Additional metadata for the integration',
        }),
      } satisfies Record<keyof _TriggerIntegrationUpdateRequest, unknown>),
  })

const TriggerIntegrationDeleteResponse = builder
  .objectRef<_TriggerIntegrationDeleteResponse>(
    'TriggerIntegrationDeleteResponse'
  )
  .implement({
    description: 'Response containing the ID of a deleted Trigger integration',
    fields: (t) =>
      ({
        id: t.exposeID('id', {
          description:
            'The unique identifier of the deleted Trigger integration',
        }),
      } satisfies Record<keyof _TriggerIntegrationDeleteResponse, unknown>),
  })

const SitemapIntegrationCreateResponse = builder
  .objectRef<_SitemapIntegrationCreateResponse>(
    'SitemapIntegrationCreateResponse'
  )
  .implement({
    description:
      'Response containing the ID of a newly created Sitemap integration',
    fields: (t) =>
      ({
        id: t.exposeID('id', {
          description:
            'The unique identifier of the created Sitemap integration',
        }),
      } satisfies Record<keyof _SitemapIntegrationCreateResponse, unknown>),
  })

const SitemapIntegrationCreateRequest = builder
  .inputRef<_SitemapIntegrationCreateRequest>('SitemapIntegrationCreateRequest')
  .implement({
    description: 'Input parameters for creating a new Sitemap integration',
    fields: (t) =>
      ({
        alias: t.id({
          required: false,
          description: 'The alias ID for the integration',
        }),
        blueprintId: t.id({
          required: false,
          description: 'The ID of the blueprint to use',
        }),
        name: t.string({
          required: false,
          description: 'The name of the integration',
        }),
        description: t.string({
          required: false,
          description: 'The description of the integration',
        }),
        datasetId: t.id({
          required: false,
          description: 'The ID of the dataset to sync to',
        }),
        url: t.string({
          required: false,
          description: 'The URL of the sitemap to crawl',
        }),
        glob: t.string({
          required: false,
          description: 'Glob pattern to filter URLs',
        }),
        selectors: t.string({
          required: false,
          description: 'CSS selectors to focus on specific parts of the pages',
        }),
        javascript: t.boolean({
          required: false,
          description: 'Whether to enable JavaScript rendering',
        }),
        syncSchedule: t.field({
          type: Schedule,
          required: false,
          description: 'The schedule for automatic synchronization',
        }),
        expiresIn: t.int({
          required: false,
          description: 'Time in milliseconds before the data expires',
        }),
        meta: t.field({
          type: Meta,
          required: false,
          description: 'Additional metadata for the integration',
        }),
      } satisfies Record<keyof _SitemapIntegrationCreateRequest, unknown>),
  })

const SitemapIntegrationUpdateResponse = builder
  .objectRef<_SitemapIntegrationUpdateResponse>(
    'SitemapIntegrationUpdateResponse'
  )
  .implement({
    description: 'Response containing the ID of an updated Sitemap integration',
    fields: (t) =>
      ({
        id: t.exposeID('id', {
          description:
            'The unique identifier of the updated Sitemap integration',
        }),
      } satisfies Record<keyof _SitemapIntegrationUpdateResponse, unknown>),
  })

const SitemapIntegrationUpdateRequest = builder
  .inputRef<_SitemapIntegrationUpdateRequest>('SitemapIntegrationUpdateRequest')
  .implement({
    description:
      'Input parameters for updating an existing Sitemap integration',
    fields: (t) =>
      ({
        alias: t.id({
          required: false,
          description: 'The alias ID for the integration',
        }),
        blueprintId: t.id({
          required: false,
          description: 'The ID of the blueprint to use',
        }),
        name: t.string({
          required: false,
          description: 'The name of the integration',
        }),
        description: t.string({
          required: false,
          description: 'The description of the integration',
        }),
        datasetId: t.id({
          required: false,
          description: 'The ID of the dataset to sync to',
        }),
        url: t.string({
          required: false,
          description: 'The URL of the sitemap to crawl',
        }),
        glob: t.string({
          required: false,
          description: 'Glob pattern to filter URLs',
        }),
        selectors: t.string({
          required: false,
          description: 'CSS selectors to extract content',
        }),
        javascript: t.boolean({
          required: false,
          description: 'Whether to enable JavaScript rendering',
        }),
        syncSchedule: t.field({
          type: Schedule,
          required: false,
          description: 'The schedule for automatic synchronization',
        }),
        expiresIn: t.int({
          required: false,
          description: 'Time in milliseconds before the data expires',
        }),
        meta: t.field({
          type: Meta,
          required: false,
          description: 'Additional metadata for the integration',
        }),
      } satisfies Record<keyof _SitemapIntegrationUpdateRequest, unknown>),
  })

const SitemapIntegrationDeleteResponse = builder
  .objectRef<_SitemapIntegrationDeleteResponse>(
    'SitemapIntegrationDeleteResponse'
  )
  .implement({
    description: 'Response containing the ID of a deleted Sitemap integration',
    fields: (t) =>
      ({
        id: t.exposeID('id', {
          description:
            'The unique identifier of the deleted Sitemap integration',
        }),
      } satisfies Record<keyof _SitemapIntegrationDeleteResponse, unknown>),
  })

const NotionIntegrationCreateResponse = builder
  .objectRef<_NotionIntegrationCreateResponse>(
    'NotionIntegrationCreateResponse'
  )
  .implement({
    description:
      'Response containing the ID of a newly created Notion integration',
    fields: (t) =>
      ({
        id: t.exposeID('id', {
          description:
            'The unique identifier of the created Notion integration',
        }),
      } satisfies Record<keyof _NotionIntegrationCreateResponse, unknown>),
  })

const NotionIntegrationCreateRequest = builder
  .inputRef<_NotionIntegrationCreateRequest>('NotionIntegrationCreateRequest')
  .implement({
    description: 'Input parameters for creating a new Notion integration',
    fields: (t) =>
      ({
        alias: t.id({
          required: false,
          description: 'The alias ID for the integration',
        }),
        blueprintId: t.id({
          required: false,
          description: 'The ID of the blueprint to use',
        }),
        name: t.string({
          required: false,
          description: 'The name of the integration',
        }),
        description: t.string({
          required: false,
          description: 'The description of the integration',
        }),
        datasetId: t.id({
          required: false,
          description: 'The ID of the dataset to sync to',
        }),
        token: t.string({
          required: false,
          description: 'The Notion integration token',
        }),
        syncSchedule: t.field({
          type: Schedule,
          required: false,
          description: 'The schedule for automatic synchronization',
        }),
        expiresIn: t.int({
          required: false,
          description: 'Time in milliseconds before the data expires',
        }),
        meta: t.field({
          type: Meta,
          required: false,
          description: 'Additional metadata for the integration',
        }),
      } satisfies Record<keyof _NotionIntegrationCreateRequest, unknown>),
  })

const NotionIntegrationUpdateResponse = builder
  .objectRef<_NotionIntegrationUpdateResponse>(
    'NotionIntegrationUpdateResponse'
  )
  .implement({
    description: 'Response containing the ID of an updated Notion integration',
    fields: (t) =>
      ({
        id: t.exposeID('id', {
          description:
            'The unique identifier of the updated Notion integration',
        }),
      } satisfies Record<keyof _NotionIntegrationUpdateResponse, unknown>),
  })

const NotionIntegrationUpdateRequest = builder
  .inputRef<_NotionIntegrationUpdateRequest>('NotionIntegrationUpdateRequest')
  .implement({
    description: 'Input parameters for updating an existing Notion integration',
    fields: (t) =>
      ({
        alias: t.id({
          required: false,
          description: 'The alias ID for the integration',
        }),
        blueprintId: t.id({
          required: false,
          description: 'The ID of the blueprint to use',
        }),
        name: t.string({
          required: false,
          description: 'The name of the integration',
        }),
        description: t.string({
          required: false,
          description: 'The description of the integration',
        }),
        datasetId: t.id({
          required: false,
          description: 'The ID of the dataset to sync to',
        }),
        token: t.string({
          required: false,
          description: 'The Notion integration token',
        }),
        syncSchedule: t.field({
          type: Schedule,
          required: false,
          description: 'The schedule for automatic synchronization',
        }),
        expiresIn: t.int({
          required: false,
          description: 'Time in milliseconds before the data expires',
        }),
        meta: t.field({
          type: Meta,
          required: false,
          description: 'Additional metadata for the integration',
        }),
      } satisfies Record<keyof _NotionIntegrationUpdateRequest, unknown>),
  })

const NotionIntegrationDeleteResponse = builder
  .objectRef<_NotionIntegrationDeleteResponse>(
    'NotionIntegrationDeleteResponse'
  )
  .implement({
    description: 'Response containing the ID of a deleted Notion integration',
    fields: (t) =>
      ({
        id: t.exposeID('id', {
          description:
            'The unique identifier of the deleted Notion integration',
        }),
      } satisfies Record<keyof _NotionIntegrationDeleteResponse, unknown>),
  })

const ExtractIntegrationCreateResponse = builder
  .objectRef<_ExtractIntegrationCreateResponse>(
    'ExtractIntegrationCreateResponse'
  )
  .implement({
    description:
      'Response containing the ID of a newly created Extract integration',
    fields: (t) =>
      ({
        id: t.exposeID('id', {
          description:
            'The unique identifier of the created Extract integration',
        }),
      } satisfies Record<keyof _ExtractIntegrationCreateResponse, unknown>),
  })

const ExtractIntegrationCreateRequest = builder
  .inputRef<_ExtractIntegrationCreateRequest>('ExtractIntegrationCreateRequest')
  .implement({
    description: 'Input parameters for creating a new Extract integration',
    fields: (t) =>
      ({
        alias: t.id({
          required: false,
          description: 'The alias ID for the integration',
        }),
        blueprintId: t.id({
          required: false,
          description: 'The ID of the blueprint to use',
        }),
        name: t.string({
          required: false,
          description: 'The name of the integration',
        }),
        description: t.string({
          required: false,
          description: 'The description of the integration',
        }),
        botId: t.id({
          required: false,
          description: 'The ID of the bot to connect',
        }),
        schema: t.field({
          type: 'JsonObject',
          required: false,
          description: 'The JSON schema defining the data structure to extract',
        }),
        request: t.string({
          required: false,
          description: 'The webhook URL to send extracted data to',
        }),
        model: t.string({
          required: false,
          description: 'The LLM model to use for the extract integration',
        }),
        meta: t.field({
          type: Meta,
          required: false,
          description: 'Additional metadata for the integration',
        }),
      } satisfies Record<keyof _ExtractIntegrationCreateRequest, unknown>),
  })

const ExtractIntegrationUpdateResponse = builder
  .objectRef<_ExtractIntegrationUpdateResponse>(
    'ExtractIntegrationUpdateResponse'
  )
  .implement({
    description: 'Response containing the ID of an updated Extract integration',
    fields: (t) =>
      ({
        id: t.exposeID('id', {
          description:
            'The unique identifier of the updated Extract integration',
        }),
      } satisfies Record<keyof _ExtractIntegrationUpdateResponse, unknown>),
  })

const ExtractIntegrationUpdateRequest = builder
  .inputRef<_ExtractIntegrationUpdateRequest>('ExtractIntegrationUpdateRequest')
  .implement({
    description:
      'Input parameters for updating an existing Extract integration',
    fields: (t) =>
      ({
        alias: t.id({
          required: false,
          description: 'The alias ID for the integration',
        }),
        blueprintId: t.id({
          required: false,
          description: 'The ID of the blueprint to use',
        }),
        name: t.string({
          required: false,
          description: 'The name of the integration',
        }),
        description: t.string({
          required: false,
          description: 'The description of the integration',
        }),
        botId: t.id({
          required: false,
          description: 'The ID of the bot to connect',
        }),
        schema: t.field({
          type: 'JsonObject',
          required: false,
          description: 'The JSON schema defining the data structure to extract',
        }),
        request: t.string({
          required: false,
          description: 'The webhook URL to send extracted data to',
        }),
        model: t.string({
          required: false,
          description: 'The LLM model to use for the extract integration',
        }),
        meta: t.field({
          type: Meta,
          required: false,
          description: 'Additional metadata for the integration',
        }),
      } satisfies Record<keyof _ExtractIntegrationUpdateRequest, unknown>),
  })

const ExtractIntegrationDeleteResponse = builder
  .objectRef<_ExtractIntegrationDeleteResponse>(
    'ExtractIntegrationDeleteResponse'
  )
  .implement({
    description: 'Response containing the ID of a deleted Extract integration',
    fields: (t) =>
      ({
        id: t.exposeID('id', {
          description:
            'The unique identifier of the deleted Extract integration',
        }),
      } satisfies Record<keyof _ExtractIntegrationDeleteResponse, unknown>),
  })

const McpserverIntegrationCreateResponse = builder
  .objectRef<_McpserverIntegrationCreateResponse>(
    'McpserverIntegrationCreateResponse'
  )
  .implement({
    description:
      'Response containing the ID of a newly created MCP Server integration',
    fields: (t) =>
      ({
        id: t.exposeID('id', {
          description:
            'The unique identifier of the created MCP Server integration',
        }),
      } satisfies Record<keyof _McpserverIntegrationCreateResponse, unknown>),
  })

const McpserverIntegrationCreateRequest = builder
  .inputRef<_McpserverIntegrationCreateRequest>(
    'McpserverIntegrationCreateRequest'
  )
  .implement({
    description: 'Input parameters for creating a new MCP Server integration',
    fields: (t) =>
      ({
        alias: t.id({
          required: false,
          description: 'The alias ID for the integration',
        }),
        blueprintId: t.id({
          required: false,
          description: 'The ID of the blueprint to use',
        }),
        name: t.string({
          required: false,
          description: 'The name of the integration',
        }),
        description: t.string({
          required: false,
          description: 'The description of the integration',
        }),
        skillsetId: t.id({
          required: false,
          description: 'The ID of the skillset to connect',
        }),
        oAuthConnectionId: t.id({
          required: false,
          description:
            'The ID of the OAuth connection for IdP-based authentication',
        }),
        meta: t.field({
          type: Meta,
          required: false,
          description: 'Additional metadata for the integration',
        }),
      } satisfies Record<keyof _McpserverIntegrationCreateRequest, unknown>),
  })

const McpserverIntegrationUpdateResponse = builder
  .objectRef<_McpserverIntegrationUpdateResponse>(
    'McpserverIntegrationUpdateResponse'
  )
  .implement({
    description:
      'Response containing the ID of an updated MCP Server integration',
    fields: (t) =>
      ({
        id: t.exposeID('id', {
          description:
            'The unique identifier of the updated MCP Server integration',
        }),
      } satisfies Record<keyof _McpserverIntegrationUpdateResponse, unknown>),
  })

const McpserverIntegrationUpdateRequest = builder
  .inputRef<_McpserverIntegrationUpdateRequest>(
    'McpserverIntegrationUpdateRequest'
  )
  .implement({
    description:
      'Input parameters for updating an existing MCP Server integration',
    fields: (t) =>
      ({
        alias: t.id({
          required: false,
          description: 'The alias ID for the integration',
        }),
        blueprintId: t.id({
          required: false,
          description: 'The ID of the blueprint to use',
        }),
        name: t.string({
          required: false,
          description: 'The name of the integration',
        }),
        description: t.string({
          required: false,
          description: 'The description of the integration',
        }),
        skillsetId: t.id({
          required: false,
          description: 'The ID of the skillset to connect',
        }),
        oAuthConnectionId: t.id({
          required: false,
          description:
            'The ID of the OAuth connection for IdP-based authentication',
        }),
        meta: t.field({
          type: Meta,
          required: false,
          description: 'Additional metadata for the integration',
        }),
      } satisfies Record<keyof _McpserverIntegrationUpdateRequest, unknown>),
  })

const McpserverIntegrationDeleteResponse = builder
  .objectRef<_McpserverIntegrationDeleteResponse>(
    'McpserverIntegrationDeleteResponse'
  )
  .implement({
    description:
      'Response containing the ID of a deleted MCP Server integration',
    fields: (t) =>
      ({
        id: t.exposeID('id', {
          description:
            'The unique identifier of the deleted MCP Server integration',
        }),
      } satisfies Record<keyof _McpserverIntegrationDeleteResponse, unknown>),
  })

const SkillserverIntegrationCreateResponse = builder
  .objectRef<_SkillserverIntegrationCreateResponse>(
    'SkillserverIntegrationCreateResponse'
  )
  .implement({
    description:
      'Response containing the ID of a newly created Skill Server integration',
    fields: (t) =>
      ({
        id: t.exposeID('id', {
          description:
            'The unique identifier of the created Skill Server integration',
        }),
      } satisfies Record<keyof _SkillserverIntegrationCreateResponse, unknown>),
  })

const SkillserverIntegrationCreateRequest = builder
  .inputRef<_SkillserverIntegrationCreateRequest>(
    'SkillserverIntegrationCreateRequest'
  )
  .implement({
    description: 'Input parameters for creating a new Skill Server integration',
    fields: (t) =>
      ({
        alias: t.id({
          required: false,
          description: 'The alias ID for the integration',
        }),
        blueprintId: t.id({
          required: false,
          description: 'The ID of the blueprint to use',
        }),
        name: t.string({
          required: false,
          description: 'The name of the integration',
        }),
        description: t.string({
          required: false,
          description: 'The description of the integration',
        }),
        skillsetId: t.id({
          required: false,
          description: 'The ID of the skillset to connect',
        }),
        meta: t.field({
          type: Meta,
          required: false,
          description: 'Additional metadata for the integration',
        }),
      } satisfies Record<keyof _SkillserverIntegrationCreateRequest, unknown>),
  })

const SkillserverIntegrationUpdateResponse = builder
  .objectRef<_SkillserverIntegrationUpdateResponse>(
    'SkillserverIntegrationUpdateResponse'
  )
  .implement({
    description:
      'Response containing the ID of an updated Skill Server integration',
    fields: (t) =>
      ({
        id: t.exposeID('id', {
          description:
            'The unique identifier of the updated Skill Server integration',
        }),
      } satisfies Record<keyof _SkillserverIntegrationUpdateResponse, unknown>),
  })

const SkillserverIntegrationUpdateRequest = builder
  .inputRef<_SkillserverIntegrationUpdateRequest>(
    'SkillserverIntegrationUpdateRequest'
  )
  .implement({
    description:
      'Input parameters for updating an existing Skill Server integration',
    fields: (t) =>
      ({
        alias: t.id({
          required: false,
          description: 'The alias ID for the integration',
        }),
        blueprintId: t.id({
          required: false,
          description: 'The ID of the blueprint to use',
        }),
        name: t.string({
          required: false,
          description: 'The name of the integration',
        }),
        description: t.string({
          required: false,
          description: 'The description of the integration',
        }),
        skillsetId: t.id({
          required: false,
          description: 'The ID of the skillset to connect',
        }),
        meta: t.field({
          type: Meta,
          required: false,
          description: 'Additional metadata for the integration',
        }),
      } satisfies Record<keyof _SkillserverIntegrationUpdateRequest, unknown>),
  })

const SkillserverIntegrationDeleteResponse = builder
  .objectRef<_SkillserverIntegrationDeleteResponse>(
    'SkillserverIntegrationDeleteResponse'
  )
  .implement({
    description:
      'Response containing the ID of a deleted Skill Server integration',
    fields: (t) =>
      ({
        id: t.exposeID('id', {
          description:
            'The unique identifier of the deleted Skill Server integration',
        }),
      } satisfies Record<keyof _SkillserverIntegrationDeleteResponse, unknown>),
  })

/**
 * Mutations
 */
builder.mutationType({
  fields: (t) => ({
    // resources

    createBot: t.field({
      type: BotCreateResponse,
      args: {
        input: t.arg({
          type: BotCreateRequest,
          required: true,
        }),
      },
      resolve: async (_query, args, context) => {
        const userClient = await getSessionClient(context.session)

        return await userClient.bot.create(omit(args.input, [OMIT_NULL]))
      },
    }),

    updateBot: t.field({
      type: BotUpdateResponse,
      args: {
        botId: t.arg.id({ required: true }),
        input: t.arg({
          type: BotUpdateRequest,
          required: true,
        }),
      },
      resolve: async (_query, args, context) => {
        const userClient = await getSessionClient(context.session)

        return await userClient.bot.update(
          args.botId,
          omit(args.input, [OMIT_NULL])
        )
      },
    }),

    deleteBot: t.field({
      type: BotDeleteResponse,
      args: {
        botId: t.arg.id({ required: true }),
      },
      resolve: async (_query, args, context) => {
        const userClient = await getSessionClient(context.session)

        return await userClient.bot.delete(args.botId)
      },
    }),

    createDataset: t.field({
      type: DatasetCreateResponse,
      args: {
        input: t.arg({
          type: DatasetCreateRequest,
          required: true,
        }),
      },
      resolve: async (_query, args, context) => {
        const userClient = await getSessionClient(context.session)

        return await userClient.dataset.create(omit(args.input, [OMIT_NULL]))
      },
    }),

    updateDataset: t.field({
      type: DatasetUpdateResponse,
      args: {
        datasetId: t.arg.id({ required: true }),
        input: t.arg({
          type: DatasetUpdateRequest,
          required: true,
        }),
      },
      resolve: async (_query, args, context) => {
        const userClient = await getSessionClient(context.session)

        return await userClient.dataset.update(
          args.datasetId,
          omit(args.input, [OMIT_NULL])
        )
      },
    }),

    deleteDataset: t.field({
      type: DatasetDeleteResponse,
      args: {
        datasetId: t.arg.id({ required: true }),
      },
      resolve: async (_query, args, context) => {
        const userClient = await getSessionClient(context.session)

        return await userClient.dataset.delete(args.datasetId)
      },
    }),

    createSkillset: t.field({
      type: SkillsetCreateResponse,
      args: {
        input: t.arg({
          type: SkillsetCreateRequest,
          required: true,
        }),
      },
      resolve: async (_query, args, context) => {
        const userClient = await getSessionClient(context.session)

        return await userClient.skillset.create(omit(args.input, [OMIT_NULL]))
      },
    }),

    updateSkillset: t.field({
      type: SkillsetUpdateResponse,
      args: {
        skillsetId: t.arg.id({ required: true }),
        input: t.arg({
          type: SkillsetUpdateRequest,
          required: true,
        }),
      },
      resolve: async (_query, args, context) => {
        const userClient = await getSessionClient(context.session)

        return await userClient.skillset.update(
          args.skillsetId,
          omit(args.input, [OMIT_NULL])
        )
      },
    }),

    deleteSkillset: t.field({
      type: SkillsetDeleteResponse,
      args: {
        skillsetId: t.arg.id({ required: true }),
      },
      resolve: async (_query, args, context) => {
        const userClient = await getSessionClient(context.session)

        return await userClient.skillset.delete(args.skillsetId)
      },
    }),

    createSkillsetAbility: t.field({
      type: SkillsetAbilityCreateResponse,
      args: {
        skillsetId: t.arg.id({ required: true }),
        input: t.arg({
          type: SkillsetAbilityCreateRequest,
          required: true,
        }),
      },
      resolve: async (_query, args, context) => {
        const userClient = await getSessionClient(context.session)

        return await userClient.skillset.ability.create(
          args.skillsetId,
          omit(args.input, [OMIT_NULL])
        )
      },
    }),

    updateSkillsetAbility: t.field({
      type: SkillsetAbilityUpdateResponse,
      args: {
        skillsetId: t.arg.id({ required: true }),
        abilityId: t.arg.id({ required: true }),
        input: t.arg({
          type: SkillsetAbilityUpdateRequest,
          required: true,
        }),
      },
      resolve: async (_query, args, context) => {
        const userClient = await getSessionClient(context.session)

        return await userClient.skillset.ability.update(
          args.skillsetId,
          args.abilityId,
          omitNullExcept(args.input, ABILITY_CLEARABLE_KEYS)
        )
      },
    }),

    deleteSkillsetAbility: t.field({
      type: SkillsetAbilityDeleteResponse,
      args: {
        skillsetId: t.arg.id({ required: true }),
        abilityId: t.arg.id({ required: true }),
      },
      resolve: async (_query, args, context) => {
        const userClient = await getSessionClient(context.session)

        return await userClient.skillset.ability.delete(
          args.skillsetId,
          args.abilityId
        )
      },
    }),

    createFile: t.field({
      type: FileCreateResponse,
      args: {
        input: t.arg({
          type: FileCreateRequest,
          required: true,
        }),
      },
      resolve: async (_query, args, context) => {
        const userClient = await getSessionClient(context.session)

        return await userClient.file.create(omit(args.input, [OMIT_NULL]))
      },
    }),

    updateFile: t.field({
      type: FileUpdateResponse,
      args: {
        fileId: t.arg.id({ required: true }),
        input: t.arg({
          type: FileUpdateRequest,
          required: true,
        }),
      },
      resolve: async (_query, args, context) => {
        const userClient = await getSessionClient(context.session)

        return await userClient.file.update(
          args.fileId,
          omit(args.input, [OMIT_NULL])
        )
      },
    }),

    deleteFile: t.field({
      type: FileDeleteResponse,
      args: {
        fileId: t.arg.id({ required: true }),
      },
      resolve: async (_query, args, context) => {
        const userClient = await getSessionClient(context.session)

        return await userClient.file.delete(args.fileId)
      },
    }),

    createSecret: t.field({
      type: SecretCreateResponse,
      args: {
        input: t.arg({
          type: SecretCreateRequest,
          required: true,
        }),
      },
      resolve: async (_query, args, context) => {
        const userClient = await getSessionClient(context.session)

        return await userClient.secret.create(omit(args.input, [OMIT_NULL]))
      },
    }),

    updateSecret: t.field({
      type: SecretUpdateResponse,
      args: {
        secretId: t.arg.id({ required: true }),
        input: t.arg({
          type: SecretUpdateRequest,
          required: true,
        }),
      },
      resolve: async (_query, args, context) => {
        const userClient = await getSessionClient(context.session)

        return await userClient.secret.update(
          args.secretId,
          omit(args.input, [OMIT_NULL])
        )
      },
    }),

    revokeSecret: t.field({
      type: SecretRevokeResponse,
      args: {
        secretId: t.arg.id({ required: true }),
      },
      resolve: async (_query, args, context) => {
        const userClient = await getSessionClient(context.session)

        return await userClient.secret.revoke(args.secretId)
      },
    }),

    deleteSecret: t.field({
      type: SecretDeleteResponse,
      args: {
        secretId: t.arg.id({ required: true }),
      },
      resolve: async (_query, args, context) => {
        const userClient = await getSessionClient(context.session)

        return await userClient.secret.delete(args.secretId)
      },
    }),

    createPolicy: t.field({
      type: PolicyCreateResponse,
      args: {
        input: t.arg({
          type: PolicyCreateRequest,
          required: true,
        }),
      },
      resolve: async (_query, args, context) => {
        const userClient = await getSessionClient(context.session)

        return await userClient.policy.create(omit(args.input, [OMIT_NULL]))
      },
    }),

    updatePolicy: t.field({
      type: PolicyUpdateResponse,
      args: {
        policyId: t.arg.id({ required: true }),
        input: t.arg({
          type: PolicyUpdateRequest,
          required: true,
        }),
      },
      resolve: async (_query, args, context) => {
        const userClient = await getSessionClient(context.session)

        return await userClient.policy.update(
          args.policyId,
          omit(args.input, [OMIT_NULL])
        )
      },
    }),

    deletePolicy: t.field({
      type: PolicyDeleteResponse,
      args: {
        policyId: t.arg.id({ required: true }),
      },
      resolve: async (_query, args, context) => {
        const userClient = await getSessionClient(context.session)

        return await userClient.policy.delete(args.policyId)
      },
    }),

    // @note context has no top-level SDK client (it is a user sub-resource),
    // so these resolvers use prisma directly, scoped to the session user - which,
    // under run_as (X-RunAs-UserId), is the targeted user. This mirrors the
    // REST handler at pages/api/v1/user/[userId]/context.
    createContext: t.field({
      type: ContextCreateResponse,
      args: {
        input: t.arg({
          type: ContextCreateRequest,
          required: true,
        }),
      },
      resolve: async (_query, args, context) => {
        const created = await prisma.context.create({
          data: {
            userId: context.session.user.id,

            name: args.input.name ?? '',
            description: args.input.description ?? '',

            blueprintId: args.input.blueprintId ?? undefined,
            botId: args.input.botId ?? undefined,
            datasetId: args.input.datasetId ?? undefined,
            skillsetId: args.input.skillsetId ?? undefined,
            contactId: args.input.contactId ?? undefined,

            payload:
              (args.input.payload as Prisma.InputJsonValue | undefined) ??
              undefined,
            meta:
              (args.input.meta as Prisma.InputJsonValue | undefined) ??
              undefined,
          },
          select: { id: true },
        })

        return { id: created.id }
      },
    }),

    updateContext: t.field({
      type: ContextUpdateResponse,
      args: {
        contextId: t.arg.id({ required: true }),
        input: t.arg({
          type: ContextUpdateRequest,
          required: true,
        }),
      },
      resolve: async (_query, args, context) => {
        const existing = await prisma.context.findFirst({
          where: { id: args.contextId, userId: context.session.user.id },
          select: { id: true },
        })

        if (!existing) {
          throw new Error('Context not found')
        }

        await prisma.context.update({
          where: { id: existing.id },
          data: {
            ...(args.input.name != null ? { name: args.input.name } : {}),
            ...(args.input.description != null
              ? { description: args.input.description }
              : {}),
            ...(args.input.blueprintId != null
              ? { blueprintId: args.input.blueprintId }
              : {}),
            ...(args.input.botId != null ? { botId: args.input.botId } : {}),
            ...(args.input.datasetId != null
              ? { datasetId: args.input.datasetId }
              : {}),
            ...(args.input.skillsetId != null
              ? { skillsetId: args.input.skillsetId }
              : {}),
            ...(args.input.contactId != null
              ? { contactId: args.input.contactId }
              : {}),
            ...(args.input.payload != null
              ? { payload: args.input.payload as Prisma.InputJsonValue }
              : {}),
            ...(args.input.meta != null
              ? { meta: args.input.meta as Prisma.InputJsonValue }
              : {}),
          },
        })

        return { id: existing.id }
      },
    }),

    deleteContext: t.field({
      type: ContextDeleteResponse,
      args: {
        contextId: t.arg.id({ required: true }),
      },
      resolve: async (_query, args, context) => {
        const existing = await prisma.context.findFirst({
          where: { id: args.contextId, userId: context.session.user.id },
          select: { id: true },
        })

        if (!existing) {
          throw new Error('Context not found')
        }

        await prisma.context.delete({ where: { id: existing.id } })

        return { id: existing.id }
      },
    }),

    createTask: t.field({
      type: TaskCreateResponse,
      args: {
        input: t.arg({
          type: TaskCreateRequest,
          required: true,
        }),
      },
      resolve: async (_query, args, context) => {
        const userClient = await getSessionClient(context.session)

        return await userClient.task.create(omit(args.input, [OMIT_NULL]))
      },
    }),

    updateTask: t.field({
      type: TaskUpdateResponse,
      args: {
        taskId: t.arg.id({ required: true }),
        input: t.arg({
          type: TaskUpdateRequest,
          required: true,
        }),
      },
      resolve: async (_query, args, context) => {
        const userClient = await getSessionClient(context.session)

        return await userClient.task.update(
          args.taskId,
          omit(args.input, [OMIT_NULL])
        )
      },
    }),

    deleteTask: t.field({
      type: TaskDeleteResponse,
      args: {
        taskId: t.arg.id({ required: true }),
      },
      resolve: async (_query, args, context) => {
        const userClient = await getSessionClient(context.session)

        return await userClient.task.delete(args.taskId)
      },
    }),

    createSpace: t.field({
      type: SpaceCreateResponse,
      args: {
        input: t.arg({
          type: SpaceCreateRequest,
          required: true,
        }),
      },
      resolve: async (_query, args, context) => {
        const userClient = await getSessionClient(context.session)

        return await userClient.space.create(omit(args.input, [OMIT_NULL]))
      },
    }),

    updateSpace: t.field({
      type: SpaceUpdateResponse,
      args: {
        spaceId: t.arg.id({ required: true }),
        input: t.arg({
          type: SpaceUpdateRequest,
          required: true,
        }),
      },
      resolve: async (_query, args, context) => {
        const userClient = await getSessionClient(context.session)

        return await userClient.space.update(
          args.spaceId,
          omit(args.input, [OMIT_NULL])
        )
      },
    }),

    deleteSpace: t.field({
      type: SpaceDeleteResponse,
      args: {
        spaceId: t.arg.id({ required: true }),
      },
      resolve: async (_query, args, context) => {
        const userClient = await getSessionClient(context.session)

        return await userClient.space.delete(args.spaceId)
      },
    }),

    createSpaceSite: t.field({
      type: SpaceSiteCreateResponse,
      args: {
        spaceId: t.arg.id({ required: true }),
        input: t.arg({
          type: SpaceSiteCreateRequest,
          required: true,
        }),
      },
      resolve: async (_query, args, context) => {
        const userClient = await getSessionClient(context.session)

        return await userClient.space.site.create(
          args.spaceId,
          omit(args.input, [OMIT_NULL])
        )
      },
    }),

    updateSpaceSite: t.field({
      type: SpaceSiteUpdateResponse,
      args: {
        spaceId: t.arg.id({ required: true }),
        siteId: t.arg.id({ required: true }),
        input: t.arg({
          type: SpaceSiteUpdateRequest,
          required: true,
        }),
      },
      resolve: async (_query, args, context) => {
        const userClient = await getSessionClient(context.session)

        return await userClient.space.site.update(
          args.spaceId,
          args.siteId,
          omit(args.input, [OMIT_NULL])
        )
      },
    }),

    deleteSpaceSite: t.field({
      type: SpaceSiteDeleteResponse,
      args: {
        spaceId: t.arg.id({ required: true }),
        siteId: t.arg.id({ required: true }),
      },
      resolve: async (_query, args, context) => {
        const userClient = await getSessionClient(context.session)

        return await userClient.space.site.delete(args.spaceId, args.siteId)
      },
    }),

    createWidgetIntegration: t.field({
      type: WidgetIntegrationCreateResponse,
      args: {
        input: t.arg({ type: WidgetIntegrationCreateRequest, required: true }),
      },
      resolve: async (_query, args, context) => {
        const userClient = await getSessionClient(context.session)

        return await userClient.integration.widget.create(
          omit(args.input, [OMIT_NULL])
        )
      },
    }),

    updateWidgetIntegration: t.field({
      type: WidgetIntegrationUpdateResponse,
      args: {
        widgetIntegrationId: t.arg.id({ required: true }),
        input: t.arg({ type: WidgetIntegrationUpdateRequest, required: true }),
      },
      resolve: async (_query, args, context) => {
        const userClient = await getSessionClient(context.session)

        return await userClient.integration.widget.update(
          args.widgetIntegrationId,
          omit(args.input, [OMIT_NULL])
        )
      },
    }),

    deleteWidgetIntegration: t.field({
      type: WidgetIntegrationDeleteResponse,
      args: {
        widgetIntegrationId: t.arg.id({ required: true }),
      },
      resolve: async (_query, args, context) => {
        const userClient = await getSessionClient(context.session)

        return await userClient.integration.widget.delete(
          args.widgetIntegrationId
        )
      },
    }),

    createSupportIntegration: t.field({
      type: SupportIntegrationCreateResponse,
      args: {
        input: t.arg({ type: SupportIntegrationCreateRequest, required: true }),
      },
      resolve: async (_query, args, context) => {
        const userClient = await getSessionClient(context.session)

        return await userClient.integration.support.create(
          omit(args.input, [OMIT_NULL])
        )
      },
    }),

    updateSupportIntegration: t.field({
      type: SupportIntegrationUpdateResponse,
      args: {
        supportIntegrationId: t.arg.id({ required: true }),
        input: t.arg({ type: SupportIntegrationUpdateRequest, required: true }),
      },
      resolve: async (_query, args, context) => {
        const userClient = await getSessionClient(context.session)

        return await userClient.integration.support.update(
          args.supportIntegrationId,
          omit(args.input, [OMIT_NULL])
        )
      },
    }),

    deleteSupportIntegration: t.field({
      type: SupportIntegrationDeleteResponse,
      args: {
        supportIntegrationId: t.arg.id({ required: true }),
      },
      resolve: async (_query, args, context) => {
        const userClient = await getSessionClient(context.session)

        return await userClient.integration.support.delete(
          args.supportIntegrationId
        )
      },
    }),

    createPortal: t.field({
      type: PortalCreateResponse,
      args: {
        input: t.arg({
          type: PortalCreateRequest,
          required: true,
        }),
      },
      resolve: async (_query, args, context) => {
        const userClient = await getSessionClient(context.session)

        return await userClient.portal.create(omit(args.input, [OMIT_NULL]))
      },
    }),

    updatePortal: t.field({
      type: PortalUpdateResponse,
      args: {
        portalId: t.arg.id({ required: true }),
        input: t.arg({
          type: PortalUpdateRequest,
          required: true,
        }),
      },
      resolve: async (_query, args, context) => {
        const userClient = await getSessionClient(context.session)

        return await userClient.portal.update(
          args.portalId,
          omit(args.input, [OMIT_NULL])
        )
      },
    }),

    deletePortal: t.field({
      type: PortalDeleteResponse,
      args: {
        portalId: t.arg.id({ required: true }),
      },
      resolve: async (_query, args, context) => {
        const userClient = await getSessionClient(context.session)

        return await userClient.portal.delete(args.portalId)
      },
    }),

    createBlueprint: t.field({
      type: BlueprintCreateResponse,
      args: {
        input: t.arg({
          type: BlueprintCreateRequest,
          required: true,
        }),
      },
      resolve: async (_query, args, context) => {
        const userClient = await getSessionClient(context.session)

        return await userClient.blueprint.create(omit(args.input, [OMIT_NULL]))
      },
    }),

    updateBlueprint: t.field({
      type: BlueprintUpdateResponse,
      args: {
        blueprintId: t.arg.id({ required: true }),
        input: t.arg({
          type: BlueprintUpdateRequest,
          required: true,
        }),
      },
      resolve: async (_query, args, context) => {
        const userClient = await getSessionClient(context.session)

        return await userClient.blueprint.update(
          args.blueprintId,
          omit(args.input, [OMIT_NULL])
        )
      },
    }),

    deleteBlueprint: t.field({
      type: BlueprintDeleteResponse,
      args: {
        blueprintId: t.arg.id({ required: true }),
        deleteResources: t.arg.boolean({
          required: false,
          description:
            'If true, also delete all resources associated with the blueprint (bots, datasets, integrations, etc.). Defaults to false, which only removes the blueprint container.',
        }),
      },
      resolve: async (_query, args, context) => {
        const userClient = await getSessionClient(context.session)

        return await userClient.blueprint.delete(args.blueprintId, {
          deleteResources: args.deleteResources ?? false,
        })
      },
    }),

    // integrations

    createSlackIntegration: t.field({
      type: SlackIntegrationCreateResponse,
      args: {
        input: t.arg({
          type: SlackIntegrationCreateRequest,
          required: true,
        }),
      },
      resolve: async (_query, args, context) => {
        const userClient = await getSessionClient(context.session)

        return await userClient.integration.slack.create(
          omit(args.input, [OMIT_NULL])
        )
      },
    }),

    updateSlackIntegration: t.field({
      type: SlackIntegrationUpdateResponse,
      args: {
        slackIntegrationId: t.arg.id({ required: true }),
        input: t.arg({
          type: SlackIntegrationUpdateRequest,
          required: true,
        }),
      },
      resolve: async (_query, args, context) => {
        const userClient = await getSessionClient(context.session)

        return await userClient.integration.slack.update(
          args.slackIntegrationId,
          omit(args.input, [OMIT_NULL])
        )
      },
    }),

    deleteSlackIntegration: t.field({
      type: SlackIntegrationDeleteResponse,
      args: {
        slackIntegrationId: t.arg.id({ required: true }),
      },
      resolve: async (_query, args, context) => {
        const userClient = await getSessionClient(context.session)

        return await userClient.integration.slack.delete(
          args.slackIntegrationId
        )
      },
    }),

    createDiscordIntegration: t.field({
      type: DiscordIntegrationCreateResponse,
      args: {
        input: t.arg({
          type: DiscordIntegrationCreateRequest,
          required: true,
        }),
      },
      resolve: async (_query, args, context) => {
        const userClient = await getSessionClient(context.session)

        return await userClient.integration.discord.create(
          omit(args.input, [OMIT_NULL])
        )
      },
    }),

    updateDiscordIntegration: t.field({
      type: DiscordIntegrationUpdateResponse,
      args: {
        discordIntegrationId: t.arg.id({ required: true }),
        input: t.arg({
          type: DiscordIntegrationUpdateRequest,
          required: true,
        }),
      },
      resolve: async (_query, args, context) => {
        const userClient = await getSessionClient(context.session)

        return await userClient.integration.discord.update(
          args.discordIntegrationId,
          omit(args.input, [OMIT_NULL])
        )
      },
    }),

    deleteDiscordIntegration: t.field({
      type: DiscordIntegrationDeleteResponse,
      args: {
        discordIntegrationId: t.arg.id({ required: true }),
      },
      resolve: async (_query, args, context) => {
        const userClient = await getSessionClient(context.session)

        return await userClient.integration.discord.delete(
          args.discordIntegrationId
        )
      },
    }),

    createWhatsAppIntegration: t.field({
      type: WhatsAppIntegrationCreateResponse,
      args: {
        input: t.arg({
          type: WhatsAppIntegrationCreateRequest,
          required: true,
        }),
      },
      resolve: async (_query, args, context) => {
        const userClient = await getSessionClient(context.session)

        return await userClient.integration.whatsapp.create(
          omit(args.input, [OMIT_NULL])
        )
      },
    }),

    updateWhatsAppIntegration: t.field({
      type: WhatsAppIntegrationUpdateResponse,
      args: {
        whatsappIntegrationId: t.arg.id({ required: true }),
        input: t.arg({
          type: WhatsAppIntegrationUpdateRequest,
          required: true,
        }),
      },
      resolve: async (_query, args, context) => {
        const userClient = await getSessionClient(context.session)

        return await userClient.integration.whatsapp.update(
          args.whatsappIntegrationId,
          omitNullExcept(args.input, META_INTEGRATION_CLEARABLE_KEYS)
        )
      },
    }),

    deleteWhatsAppIntegration: t.field({
      type: WhatsAppIntegrationDeleteResponse,
      args: {
        whatsappIntegrationId: t.arg.id({ required: true }),
      },
      resolve: async (_query, args, context) => {
        const userClient = await getSessionClient(context.session)

        return await userClient.integration.whatsapp.delete(
          args.whatsappIntegrationId
        )
      },
    }),

    createMessengerIntegration: t.field({
      type: MessengerIntegrationCreateResponse,
      args: {
        input: t.arg({
          type: MessengerIntegrationCreateRequest,
          required: true,
        }),
      },
      resolve: async (_query, args, context) => {
        const userClient = await getSessionClient(context.session)

        return await userClient.integration.messenger.create(
          omit(args.input, [OMIT_NULL])
        )
      },
    }),

    updateMessengerIntegration: t.field({
      type: MessengerIntegrationUpdateResponse,
      args: {
        messengerIntegrationId: t.arg.id({ required: true }),
        input: t.arg({
          type: MessengerIntegrationUpdateRequest,
          required: true,
        }),
      },
      resolve: async (_query, args, context) => {
        const userClient = await getSessionClient(context.session)

        return await userClient.integration.messenger.update(
          args.messengerIntegrationId,
          omitNullExcept(args.input, META_INTEGRATION_CLEARABLE_KEYS)
        )
      },
    }),

    deleteMessengerIntegration: t.field({
      type: MessengerIntegrationDeleteResponse,
      args: {
        messengerIntegrationId: t.arg.id({ required: true }),
      },
      resolve: async (_query, args, context) => {
        const userClient = await getSessionClient(context.session)

        return await userClient.integration.messenger.delete(
          args.messengerIntegrationId
        )
      },
    }),

    createInstagramIntegration: t.field({
      type: InstagramIntegrationCreateResponse,
      args: {
        input: t.arg({
          type: InstagramIntegrationCreateRequest,
          required: true,
        }),
      },
      resolve: async (_query, args, context) => {
        const userClient = await getSessionClient(context.session)

        return await userClient.integration.instagram.create(
          omit(args.input, [OMIT_NULL])
        )
      },
    }),

    updateInstagramIntegration: t.field({
      type: InstagramIntegrationUpdateResponse,
      args: {
        instagramIntegrationId: t.arg.id({ required: true }),
        input: t.arg({
          type: InstagramIntegrationUpdateRequest,
          required: true,
        }),
      },
      resolve: async (_query, args, context) => {
        const userClient = await getSessionClient(context.session)

        return await userClient.integration.instagram.update(
          args.instagramIntegrationId,
          omitNullExcept(args.input, META_INTEGRATION_CLEARABLE_KEYS)
        )
      },
    }),

    deleteInstagramIntegration: t.field({
      type: InstagramIntegrationDeleteResponse,
      args: {
        instagramIntegrationId: t.arg.id({ required: true }),
      },
      resolve: async (_query, args, context) => {
        const userClient = await getSessionClient(context.session)

        return await userClient.integration.instagram.delete(
          args.instagramIntegrationId
        )
      },
    }),

    createTelegramIntegration: t.field({
      type: TelegramIntegrationCreateResponse,
      args: {
        input: t.arg({
          type: TelegramIntegrationCreateRequest,
          required: true,
        }),
      },
      resolve: async (_query, args, context) => {
        const userClient = await getSessionClient(context.session)

        return await userClient.integration.telegram.create(
          omit(args.input, [OMIT_NULL])
        )
      },
    }),

    updateTelegramIntegration: t.field({
      type: TelegramIntegrationUpdateResponse,
      args: {
        telegramIntegrationId: t.arg.id({ required: true }),
        input: t.arg({
          type: TelegramIntegrationUpdateRequest,
          required: true,
        }),
      },
      resolve: async (_query, args, context) => {
        const userClient = await getSessionClient(context.session)

        return await userClient.integration.telegram.update(
          args.telegramIntegrationId,
          omit(args.input, [OMIT_NULL])
        )
      },
    }),

    deleteTelegramIntegration: t.field({
      type: TelegramIntegrationDeleteResponse,
      args: {
        telegramIntegrationId: t.arg.id({ required: true }),
      },
      resolve: async (_query, args, context) => {
        const userClient = await getSessionClient(context.session)

        return await userClient.integration.telegram.delete(
          args.telegramIntegrationId
        )
      },
    }),

    createTwilioIntegration: t.field({
      type: TwilioIntegrationCreateResponse,
      args: {
        input: t.arg({
          type: TwilioIntegrationCreateRequest,
          required: true,
        }),
      },
      resolve: async (_query, args, context) => {
        const userClient = await getSessionClient(context.session)

        return await userClient.integration.twilio.create(
          omit(args.input, [OMIT_NULL])
        )
      },
    }),

    updateTwilioIntegration: t.field({
      type: TwilioIntegrationUpdateResponse,
      args: {
        twilioIntegrationId: t.arg.id({ required: true }),
        input: t.arg({
          type: TwilioIntegrationUpdateRequest,
          required: true,
        }),
      },
      resolve: async (_query, args, context) => {
        const userClient = await getSessionClient(context.session)

        return await userClient.integration.twilio.update(
          args.twilioIntegrationId,
          omit(args.input, [OMIT_NULL])
        )
      },
    }),

    deleteTwilioIntegration: t.field({
      type: TwilioIntegrationDeleteResponse,
      args: {
        twilioIntegrationId: t.arg.id({ required: true }),
      },
      resolve: async (_query, args, context) => {
        const userClient = await getSessionClient(context.session)

        return await userClient.integration.twilio.delete(
          args.twilioIntegrationId
        )
      },
    }),

    createMicrosoftteamsIntegration: t.field({
      type: MicrosoftteamsIntegrationCreateResponse,
      args: {
        input: t.arg({
          type: MicrosoftteamsIntegrationCreateRequest,
          required: true,
        }),
      },
      resolve: async (_query, args, context) => {
        const userClient = await getSessionClient(context.session)

        return await userClient.integration.microsoftteams.create(
          omit(args.input, [OMIT_NULL])
        )
      },
    }),

    updateMicrosoftteamsIntegration: t.field({
      type: MicrosoftteamsIntegrationUpdateResponse,
      args: {
        microsoftteamsIntegrationId: t.arg.id({ required: true }),
        input: t.arg({
          type: MicrosoftteamsIntegrationUpdateRequest,
          required: true,
        }),
      },
      resolve: async (_query, args, context) => {
        const userClient = await getSessionClient(context.session)

        return await userClient.integration.microsoftteams.update(
          args.microsoftteamsIntegrationId,
          omit(args.input, [OMIT_NULL])
        )
      },
    }),

    deleteMicrosoftteamsIntegration: t.field({
      type: MicrosoftteamsIntegrationDeleteResponse,
      args: {
        microsoftteamsIntegrationId: t.arg.id({ required: true }),
      },
      resolve: async (_query, args, context) => {
        const userClient = await getSessionClient(context.session)

        return await userClient.integration.microsoftteams.delete(
          args.microsoftteamsIntegrationId
        )
      },
    }),

    createGooglechatIntegration: t.field({
      type: GooglechatIntegrationCreateResponse,
      args: {
        input: t.arg({
          type: GooglechatIntegrationCreateRequest,
          required: true,
        }),
      },
      resolve: async (_query, args, context) => {
        const userClient = await getSessionClient(context.session)

        return await userClient.integration.googlechat.create(
          omit(args.input, [OMIT_NULL])
        )
      },
    }),

    updateGooglechatIntegration: t.field({
      type: GooglechatIntegrationUpdateResponse,
      args: {
        googlechatIntegrationId: t.arg.id({ required: true }),
        input: t.arg({
          type: GooglechatIntegrationUpdateRequest,
          required: true,
        }),
      },
      resolve: async (_query, args, context) => {
        const userClient = await getSessionClient(context.session)

        return await userClient.integration.googlechat.update(
          args.googlechatIntegrationId,
          omit(args.input, [OMIT_NULL])
        )
      },
    }),

    deleteGooglechatIntegration: t.field({
      type: GooglechatIntegrationDeleteResponse,
      args: {
        googlechatIntegrationId: t.arg.id({ required: true }),
      },
      resolve: async (_query, args, context) => {
        const userClient = await getSessionClient(context.session)

        return await userClient.integration.googlechat.delete(
          args.googlechatIntegrationId
        )
      },
    }),

    createEmailIntegration: t.field({
      type: EmailIntegrationCreateResponse,
      args: {
        input: t.arg({
          type: EmailIntegrationCreateRequest,
          required: true,
        }),
      },
      resolve: async (_query, args, context) => {
        const userClient = await getSessionClient(context.session)

        return await userClient.integration.email.create(
          omit(args.input, [OMIT_NULL])
        )
      },
    }),

    updateEmailIntegration: t.field({
      type: EmailIntegrationUpdateResponse,
      args: {
        emailIntegrationId: t.arg.id({ required: true }),
        input: t.arg({
          type: EmailIntegrationUpdateRequest,
          required: true,
        }),
      },
      resolve: async (_query, args, context) => {
        const userClient = await getSessionClient(context.session)

        return await userClient.integration.email.update(
          args.emailIntegrationId,
          omit(args.input, [OMIT_NULL])
        )
      },
    }),

    deleteEmailIntegration: t.field({
      type: EmailIntegrationDeleteResponse,
      args: {
        emailIntegrationId: t.arg.id({ required: true }),
      },
      resolve: async (_query, args, context) => {
        const userClient = await getSessionClient(context.session)

        return await userClient.integration.email.delete(
          args.emailIntegrationId
        )
      },
    }),

    createTriggerIntegration: t.field({
      type: TriggerIntegrationCreateResponse,
      args: {
        input: t.arg({
          type: TriggerIntegrationCreateRequest,
          required: true,
        }),
      },
      resolve: async (_query, args, context) => {
        const userClient = await getSessionClient(context.session)

        return await userClient.integration.trigger.create(
          omit(args.input, [OMIT_NULL])
        )
      },
    }),

    updateTriggerIntegration: t.field({
      type: TriggerIntegrationUpdateResponse,
      args: {
        triggerIntegrationId: t.arg.id({ required: true }),
        input: t.arg({
          type: TriggerIntegrationUpdateRequest,
          required: true,
        }),
      },
      resolve: async (_query, args, context) => {
        const userClient = await getSessionClient(context.session)

        return await userClient.integration.trigger.update(
          args.triggerIntegrationId,
          omit(args.input, [OMIT_NULL])
        )
      },
    }),

    deleteTriggerIntegration: t.field({
      type: TriggerIntegrationDeleteResponse,
      args: {
        triggerIntegrationId: t.arg.id({ required: true }),
      },
      resolve: async (_query, args, context) => {
        const userClient = await getSessionClient(context.session)

        return await userClient.integration.trigger.delete(
          args.triggerIntegrationId
        )
      },
    }),

    createSitemapIntegration: t.field({
      type: SitemapIntegrationCreateResponse,
      args: {
        input: t.arg({
          type: SitemapIntegrationCreateRequest,
          required: true,
        }),
      },
      resolve: async (_query, args, context) => {
        const userClient = await getSessionClient(context.session)

        return await userClient.integration.sitemap.create(
          omit(args.input, [OMIT_NULL])
        )
      },
    }),

    updateSitemapIntegration: t.field({
      type: SitemapIntegrationUpdateResponse,
      args: {
        sitemapIntegrationId: t.arg.id({ required: true }),
        input: t.arg({
          type: SitemapIntegrationUpdateRequest,
          required: true,
        }),
      },
      resolve: async (_query, args, context) => {
        const userClient = await getSessionClient(context.session)

        return await userClient.integration.sitemap.update(
          args.sitemapIntegrationId,
          omit(args.input, [OMIT_NULL])
        )
      },
    }),

    deleteSitemapIntegration: t.field({
      type: SitemapIntegrationDeleteResponse,
      args: {
        sitemapIntegrationId: t.arg.id({ required: true }),
      },
      resolve: async (_query, args, context) => {
        const userClient = await getSessionClient(context.session)

        return await userClient.integration.sitemap.delete(
          args.sitemapIntegrationId
        )
      },
    }),

    createNotionIntegration: t.field({
      type: NotionIntegrationCreateResponse,
      args: {
        input: t.arg({
          type: NotionIntegrationCreateRequest,
          required: true,
        }),
      },
      resolve: async (_query, args, context) => {
        const userClient = await getSessionClient(context.session)

        return await userClient.integration.notion.create(
          omit(args.input, [OMIT_NULL])
        )
      },
    }),

    updateNotionIntegration: t.field({
      type: NotionIntegrationUpdateResponse,
      args: {
        notionIntegrationId: t.arg.id({ required: true }),
        input: t.arg({
          type: NotionIntegrationUpdateRequest,
          required: true,
        }),
      },
      resolve: async (_query, args, context) => {
        const userClient = await getSessionClient(context.session)

        return await userClient.integration.notion.update(
          args.notionIntegrationId,
          omit(args.input, [OMIT_NULL])
        )
      },
    }),

    deleteNotionIntegration: t.field({
      type: NotionIntegrationDeleteResponse,
      args: {
        notionIntegrationId: t.arg.id({ required: true }),
      },
      resolve: async (_query, args, context) => {
        const userClient = await getSessionClient(context.session)

        return await userClient.integration.notion.delete(
          args.notionIntegrationId
        )
      },
    }),

    createExtractIntegration: t.field({
      type: ExtractIntegrationCreateResponse,
      args: {
        input: t.arg({
          type: ExtractIntegrationCreateRequest,
          required: true,
        }),
      },
      resolve: async (_query, args, context) => {
        const userClient = await getSessionClient(context.session)

        return await userClient.integration.extract.create(
          omit(args.input, [OMIT_NULL])
        )
      },
    }),

    updateExtractIntegration: t.field({
      type: ExtractIntegrationUpdateResponse,
      args: {
        extractIntegrationId: t.arg.id({ required: true }),
        input: t.arg({
          type: ExtractIntegrationUpdateRequest,
          required: true,
        }),
      },
      resolve: async (_query, args, context) => {
        const userClient = await getSessionClient(context.session)

        return await userClient.integration.extract.update(
          args.extractIntegrationId,
          omit(args.input, [OMIT_NULL])
        )
      },
    }),

    deleteExtractIntegration: t.field({
      type: ExtractIntegrationDeleteResponse,
      args: {
        extractIntegrationId: t.arg.id({ required: true }),
      },
      resolve: async (_query, args, context) => {
        const userClient = await getSessionClient(context.session)

        return await userClient.integration.extract.delete(
          args.extractIntegrationId
        )
      },
    }),

    createMcpserverIntegration: t.field({
      type: McpserverIntegrationCreateResponse,
      args: {
        input: t.arg({
          type: McpserverIntegrationCreateRequest,
          required: true,
        }),
      },
      resolve: async (_query, args, context) => {
        const userClient = await getSessionClient(context.session)

        return await userClient.integration.mcpserver.create(
          omit(args.input, [OMIT_NULL])
        )
      },
    }),

    updateMcpserverIntegration: t.field({
      type: McpserverIntegrationUpdateResponse,
      args: {
        mcpserverIntegrationId: t.arg.id({ required: true }),
        input: t.arg({
          type: McpserverIntegrationUpdateRequest,
          required: true,
        }),
      },
      resolve: async (_query, args, context) => {
        const userClient = await getSessionClient(context.session)

        return await userClient.integration.mcpserver.update(
          args.mcpserverIntegrationId,
          omit(args.input, [OMIT_NULL])
        )
      },
    }),

    deleteMcpserverIntegration: t.field({
      type: McpserverIntegrationDeleteResponse,
      args: {
        mcpserverIntegrationId: t.arg.id({ required: true }),
      },
      resolve: async (_query, args, context) => {
        const userClient = await getSessionClient(context.session)

        return await userClient.integration.mcpserver.delete(
          args.mcpserverIntegrationId
        )
      },
    }),

    createSkillserverIntegration: t.field({
      type: SkillserverIntegrationCreateResponse,
      args: {
        input: t.arg({
          type: SkillserverIntegrationCreateRequest,
          required: true,
        }),
      },
      resolve: async (_query, args, context) => {
        const userClient = await getSessionClient(context.session)

        return await userClient.integration.skillserver.create(
          omit(args.input, [OMIT_NULL])
        )
      },
    }),

    updateSkillserverIntegration: t.field({
      type: SkillserverIntegrationUpdateResponse,
      args: {
        skillserverIntegrationId: t.arg.id({ required: true }),
        input: t.arg({
          type: SkillserverIntegrationUpdateRequest,
          required: true,
        }),
      },
      resolve: async (_query, args, context) => {
        const userClient = await getSessionClient(context.session)

        return await userClient.integration.skillserver.update(
          args.skillserverIntegrationId,
          omit(args.input, [OMIT_NULL])
        )
      },
    }),

    deleteSkillserverIntegration: t.field({
      type: SkillserverIntegrationDeleteResponse,
      args: {
        skillserverIntegrationId: t.arg.id({ required: true }),
      },
      resolve: async (_query, args, context) => {
        const userClient = await getSessionClient(context.session)

        return await userClient.integration.skillserver.delete(
          args.skillserverIntegrationId
        )
      },
    }),

    clonePlatformExample: t.field({
      type: builder.simpleObject('ClonePlatformExampleResult', {
        fields: (t) => ({
          resources: t.field({
            type: 'JsonObject',
            description:
              'A map of resource types to arrays of created resources',
          }),
        }),
      }),
      args: {
        input: t.arg({
          type: builder.inputType('ClonePlatformExampleInput', {
            fields: (t) => ({
              id: t.id({ required: true }),
            }),
          }),
          required: true,
        }),
      },
      resolve: async (_query, args, context) => {
        const userClient = await getSessionClient(context.session)

        const { resources } = await userClient.platform.example.clone(
          args.input.id
        )

        return {
          resources,
        }
      },
    }),
  }),
})

export const schema = builder.toSchema()
