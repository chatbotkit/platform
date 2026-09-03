'use server'

import prisma from '@/prisma/client'

import { appActionHandler } from '@/lib/app.action'
import type { StoreSession } from '@/lib/app.context'
import { getSessionClient } from '@/lib/cbk.sdk'
import { makeJsonSafe } from '@/lib/struct'
import { z } from '@/lib/zod.schema'

import ConfigSchema from './config'
import { APP_NAME } from './const'

type ResourceRoute = {
  type: string
  label: string
  pattern: RegExp
  params: string[]
  eventField?: string
  auditField?: string
  getDashboardPath: (params: Record<string, string>) => string
  getApiPath: (params: Record<string, string>) => string
}

type ResourceContext = {
  type: string
  label: string
  id: string
  params: Record<string, string>
  eventField?: string
  auditField?: string
  dashboardPath: string
  apiPath: string
}

type RelatedResource = {
  type: string
  label: string
  id: string
  path: string
  source?: string
}

type InspectorResult = {
  inspect: string
  pathname: string
  context: ResourceContext | null
  resource: Record<string, unknown> | null
  relatedResources: RelatedResource[]
  events: Record<string, unknown>[]
  auditLogs: Record<string, unknown>[]
}

const RESOURCE_ROUTES: ResourceRoute[] = [
  {
    type: 'record',
    label: 'Record',
    pattern: /^\/(?:hub\/)?datasets\/([^/]+)\/records\/([^/]+)$/,
    params: ['datasetId', 'recordId'],
    eventField: 'recordId',
    auditField: 'recordId',
    getDashboardPath: ({ datasetId, recordId }) =>
      `/datasets/${datasetId}/records/${recordId}`,
    getApiPath: ({ datasetId, recordId }) =>
      `/api/v1/dataset/${datasetId}/record/${recordId}/fetch`,
  },
  {
    type: 'message',
    label: 'Message',
    pattern: /^\/(?:hub\/)?conversations\/([^/]+)\/messages\/([^/]+)$/,
    params: ['conversationId', 'messageId'],
    eventField: 'conversationId',
    auditField: 'conversationId',
    getDashboardPath: ({ conversationId, messageId }) =>
      `/conversations/${conversationId}/messages/${messageId}`,
    getApiPath: ({ conversationId, messageId }) =>
      `/api/v1/conversation/${conversationId}/message/${messageId}/fetch`,
  },
  {
    type: 'ability',
    label: 'Ability',
    pattern: /^\/(?:hub\/)?skillsets\/([^/]+)\/abilities\/([^/]+)$/,
    params: ['skillsetId', 'abilityId'],
    eventField: 'abilityId',
    auditField: 'abilityId',
    getDashboardPath: ({ skillsetId, abilityId }) =>
      `/skillsets/${skillsetId}/abilities/${abilityId}`,
    getApiPath: ({ skillsetId, abilityId }) =>
      `/api/v1/skillset/${skillsetId}/ability/${abilityId}/fetch`,
  },
  {
    type: 'bot',
    label: 'Bot',
    pattern: /^\/(?:hub\/)?bots\/([^/]+)$/,
    params: ['botId'],
    eventField: 'botId',
    auditField: 'botId',
    getDashboardPath: ({ botId }) => `/bots/${botId}`,
    getApiPath: ({ botId }) => `/api/v1/bot/${botId}/fetch`,
  },
  {
    type: 'blueprint',
    label: 'Blueprint',
    pattern: /^\/(?:hub\/)?blueprints\/([^/]+)$/,
    params: ['blueprintId'],
    eventField: 'blueprintId',
    auditField: 'blueprintId',
    getDashboardPath: ({ blueprintId }) => `/blueprints/${blueprintId}`,
    getApiPath: ({ blueprintId }) => `/api/v1/blueprint/${blueprintId}/fetch`,
  },
  {
    type: 'conversation',
    label: 'Conversation',
    pattern: /^\/conversations\/([^/]+)$/,
    params: ['conversationId'],
    eventField: 'conversationId',
    auditField: 'conversationId',
    getDashboardPath: ({ conversationId }) =>
      `/conversations/${conversationId}`,
    getApiPath: ({ conversationId }) =>
      `/api/v1/conversation/${conversationId}/fetch`,
  },
  {
    type: 'contact',
    label: 'Contact',
    pattern: /^\/contacts\/([^/]+)$/,
    params: ['contactId'],
    eventField: 'contactId',
    auditField: 'contactId',
    getDashboardPath: ({ contactId }) => `/contacts/${contactId}`,
    getApiPath: ({ contactId }) => `/api/v1/contact/${contactId}/fetch`,
  },
  {
    type: 'dataset',
    label: 'Dataset',
    pattern: /^\/(?:hub\/)?datasets\/([^/]+)$/,
    params: ['datasetId'],
    eventField: 'datasetId',
    auditField: 'datasetId',
    getDashboardPath: ({ datasetId }) => `/datasets/${datasetId}`,
    getApiPath: ({ datasetId }) => `/api/v1/dataset/${datasetId}/fetch`,
  },
  {
    type: 'skillset',
    label: 'Skillset',
    pattern: /^\/(?:hub\/)?skillsets\/([^/]+)$/,
    params: ['skillsetId'],
    eventField: 'skillsetId',
    auditField: 'skillsetId',
    getDashboardPath: ({ skillsetId }) => `/skillsets/${skillsetId}`,
    getApiPath: ({ skillsetId }) => `/api/v1/skillset/${skillsetId}/fetch`,
  },
  {
    type: 'file',
    label: 'File',
    pattern: /^\/files\/([^/]+)$/,
    params: ['fileId'],
    eventField: 'fileId',
    auditField: 'fileId',
    getDashboardPath: ({ fileId }) => `/files/${fileId}`,
    getApiPath: ({ fileId }) => `/api/v1/file/${fileId}/fetch`,
  },
  {
    type: 'task',
    label: 'Task',
    pattern: /^\/tasks\/([^/]+)$/,
    params: ['taskId'],
    eventField: 'taskId',
    auditField: 'taskId',
    getDashboardPath: ({ taskId }) => `/tasks/${taskId}`,
    getApiPath: ({ taskId }) => `/api/v1/task/${taskId}/fetch`,
  },
  {
    type: 'space',
    label: 'Space',
    pattern: /^\/spaces\/([^/]+)$/,
    params: ['spaceId'],
    auditField: 'spaceId',
    getDashboardPath: ({ spaceId }) => `/spaces/${spaceId}`,
    getApiPath: ({ spaceId }) => `/api/v1/space/${spaceId}/fetch`,
  },
  {
    type: 'portal',
    label: 'Portal',
    pattern: /^\/portals\/([^/]+)$/,
    params: ['portalId'],
    eventField: 'portalId',
    auditField: 'portalId',
    getDashboardPath: ({ portalId }) => `/portals/${portalId}`,
    getApiPath: ({ portalId }) => `/api/v1/portal/${portalId}/fetch`,
  },
  {
    type: 'secret',
    label: 'Secret',
    pattern: /^\/secrets\/([^/]+)$/,
    params: ['secretId'],
    eventField: 'secretId',
    auditField: 'secretId',
    getDashboardPath: ({ secretId }) => `/secrets/${secretId}`,
    getApiPath: ({ secretId }) => `/api/v1/secret/${secretId}/fetch`,
  },
  {
    type: 'policy',
    label: 'Policy',
    pattern: /^\/policies\/([^/]+)$/,
    params: ['policyId'],
    auditField: 'policyId',
    getDashboardPath: ({ policyId }) => `/policies/${policyId}`,
    getApiPath: ({ policyId }) => `/api/v1/policy/${policyId}/fetch`,
  },
  {
    type: 'webhook',
    label: 'Webhook',
    pattern: /^\/webhooks\/([^/]+)$/,
    params: ['webhookId'],
    auditField: 'webhookId',
    getDashboardPath: ({ webhookId }) => `/webhooks/${webhookId}`,
    getApiPath: ({ webhookId }) => `/api/v1/webhook/${webhookId}/fetch`,
  },
  {
    type: 'team',
    label: 'Team',
    pattern: /^\/teams\/([^/]+)$/,
    params: ['teamId'],
    getDashboardPath: ({ teamId }) => `/teams/${teamId}`,
    getApiPath: ({ teamId }) => `/api/v1/team/${teamId}/fetch`,
  },
  {
    type: 'ability',
    label: 'Ability',
    pattern: /^\/abilities\/([^/]+)$/,
    params: ['abilityId'],
    eventField: 'abilityId',
    auditField: 'abilityId',
    getDashboardPath: ({ abilityId }) => `/abilities/${abilityId}`,
    getApiPath: ({ abilityId }) => `/api/v1/ability/${abilityId}/fetch`,
  },
  {
    type: 'widget',
    label: 'Widget Integration',
    pattern: /^\/integrations\/widget\/([^/]+)$/,
    params: ['widgetIntegrationId'],
    eventField: 'widgetIntegrationId',
    getDashboardPath: ({ widgetIntegrationId }) =>
      `/integrations/widget/${widgetIntegrationId}`,
    getApiPath: ({ widgetIntegrationId }) =>
      `/api/v1/integration/widget/${widgetIntegrationId}/fetch`,
  },
  {
    type: 'slack',
    label: 'Slack Integration',
    pattern: /^\/integrations\/slack\/([^/]+)$/,
    params: ['slackIntegrationId'],
    eventField: 'slackIntegrationId',
    getDashboardPath: ({ slackIntegrationId }) =>
      `/integrations/slack/${slackIntegrationId}`,
    getApiPath: ({ slackIntegrationId }) =>
      `/api/v1/integration/slack/${slackIntegrationId}/fetch`,
  },
  {
    type: 'discord',
    label: 'Discord Integration',
    pattern: /^\/integrations\/discord\/([^/]+)$/,
    params: ['discordIntegrationId'],
    eventField: 'discordIntegrationId',
    getDashboardPath: ({ discordIntegrationId }) =>
      `/integrations/discord/${discordIntegrationId}`,
    getApiPath: ({ discordIntegrationId }) =>
      `/api/v1/integration/discord/${discordIntegrationId}/fetch`,
  },
  {
    type: 'microsoftteams',
    label: 'Teams Integration',
    pattern: /^\/integrations\/teams\/([^/]+)$/,
    params: ['microsoftteamsIntegrationId'],
    eventField: 'microsoftteamsIntegrationId',
    getDashboardPath: ({ microsoftteamsIntegrationId }) =>
      `/integrations/microsoftteams/${microsoftteamsIntegrationId}`,
    getApiPath: ({ microsoftteamsIntegrationId }) =>
      `/api/v1/integration/microsoftteams/${microsoftteamsIntegrationId}/fetch`,
  },
  {
    type: 'googlechat',
    label: 'Google Chat Integration',
    pattern: /^\/integrations\/googlechat\/([^/]+)$/,
    params: ['googlechatIntegrationId'],
    eventField: 'googlechatIntegrationId',
    getDashboardPath: ({ googlechatIntegrationId }) =>
      `/integrations/googlechat/${googlechatIntegrationId}`,
    getApiPath: ({ googlechatIntegrationId }) =>
      `/api/v1/integration/googlechat/${googlechatIntegrationId}/fetch`,
  },
  {
    type: 'whatsapp',
    label: 'WhatsApp Integration',
    pattern: /^\/integrations\/whatsapp\/([^/]+)$/,
    params: ['whatsappIntegrationId'],
    eventField: 'whatsappIntegrationId',
    getDashboardPath: ({ whatsappIntegrationId }) =>
      `/integrations/whatsapp/${whatsappIntegrationId}`,
    getApiPath: ({ whatsappIntegrationId }) =>
      `/api/v1/integration/whatsapp/${whatsappIntegrationId}/fetch`,
  },
  {
    type: 'messenger',
    label: 'Messenger Integration',
    pattern: /^\/integrations\/messenger\/([^/]+)$/,
    params: ['messengerIntegrationId'],
    eventField: 'messengerIntegrationId',
    getDashboardPath: ({ messengerIntegrationId }) =>
      `/integrations/messenger/${messengerIntegrationId}`,
    getApiPath: ({ messengerIntegrationId }) =>
      `/api/v1/integration/messenger/${messengerIntegrationId}/fetch`,
  },
  {
    type: 'telegram',
    label: 'Telegram Integration',
    pattern: /^\/integrations\/telegram\/([^/]+)$/,
    params: ['telegramIntegrationId'],
    eventField: 'telegramIntegrationId',
    getDashboardPath: ({ telegramIntegrationId }) =>
      `/integrations/telegram/${telegramIntegrationId}`,
    getApiPath: ({ telegramIntegrationId }) =>
      `/api/v1/integration/telegram/${telegramIntegrationId}/fetch`,
  },
  {
    type: 'twilio',
    label: 'Twilio Integration',
    pattern: /^\/integrations\/twilio\/([^/]+)$/,
    params: ['twilioIntegrationId'],
    eventField: 'twilioIntegrationId',
    getDashboardPath: ({ twilioIntegrationId }) =>
      `/integrations/twilio/${twilioIntegrationId}`,
    getApiPath: ({ twilioIntegrationId }) =>
      `/api/v1/integration/twilio/${twilioIntegrationId}/fetch`,
  },
  {
    type: 'email',
    label: 'Email Integration',
    pattern: /^\/integrations\/email\/([^/]+)$/,
    params: ['emailIntegrationId'],
    eventField: 'emailIntegrationId',
    getDashboardPath: ({ emailIntegrationId }) =>
      `/integrations/email/${emailIntegrationId}`,
    getApiPath: ({ emailIntegrationId }) =>
      `/api/v1/integration/email/${emailIntegrationId}/fetch`,
  },
  {
    type: 'sitemap',
    label: 'Sitemap Integration',
    pattern: /^\/integrations\/sitemap\/([^/]+)$/,
    params: ['sitemapIntegrationId'],
    eventField: 'sitemapIntegrationId',
    getDashboardPath: ({ sitemapIntegrationId }) =>
      `/integrations/sitemap/${sitemapIntegrationId}`,
    getApiPath: ({ sitemapIntegrationId }) =>
      `/api/v1/integration/sitemap/${sitemapIntegrationId}/fetch`,
  },
  {
    type: 'notion',
    label: 'Notion Integration',
    pattern: /^\/integrations\/notion\/([^/]+)$/,
    params: ['notionIntegrationId'],
    eventField: 'notionIntegrationId',
    getDashboardPath: ({ notionIntegrationId }) =>
      `/integrations/notion/${notionIntegrationId}`,
    getApiPath: ({ notionIntegrationId }) =>
      `/api/v1/integration/notion/${notionIntegrationId}/fetch`,
  },
  {
    type: 'trigger',
    label: 'Trigger Integration',
    pattern: /^\/integrations\/trigger\/([^/]+)$/,
    params: ['triggerIntegrationId'],
    eventField: 'triggerIntegrationId',
    getDashboardPath: ({ triggerIntegrationId }) =>
      `/integrations/trigger/${triggerIntegrationId}`,
    getApiPath: ({ triggerIntegrationId }) =>
      `/api/v1/integration/trigger/${triggerIntegrationId}/fetch`,
  },
  {
    type: 'support',
    label: 'Support Integration',
    pattern: /^\/integrations\/support\/([^/]+)$/,
    params: ['supportIntegrationId'],
    eventField: 'supportIntegrationId',
    getDashboardPath: ({ supportIntegrationId }) =>
      `/integrations/support/${supportIntegrationId}`,
    getApiPath: ({ supportIntegrationId }) =>
      `/api/v1/integration/support/${supportIntegrationId}/fetch`,
  },
  {
    type: 'extract',
    label: 'Extract Integration',
    pattern: /^\/integrations\/extract\/([^/]+)$/,
    params: ['extractIntegrationId'],
    eventField: 'extractIntegrationId',
    getDashboardPath: ({ extractIntegrationId }) =>
      `/integrations/extract/${extractIntegrationId}`,
    getApiPath: ({ extractIntegrationId }) =>
      `/api/v1/integration/extract/${extractIntegrationId}/fetch`,
  },
  {
    type: 'mcpserver',
    label: 'MCP Server Integration',
    pattern: /^\/integrations\/mcpserver\/([^/]+)$/,
    params: ['mcpserverIntegrationId'],
    eventField: 'mcpserverIntegrationId',
    getDashboardPath: ({ mcpserverIntegrationId }) =>
      `/integrations/mcpserver/${mcpserverIntegrationId}`,
    getApiPath: ({ mcpserverIntegrationId }) =>
      `/api/v1/integration/mcpserver/${mcpserverIntegrationId}/fetch`,
  },
]

const RELATED_RESOURCE_DEFINITIONS = {
  conversationId: {
    type: 'conversation',
    label: 'Conversation',
    getPath: (value: string) => `/conversations/${value}`,
  },
  taskId: {
    type: 'task',
    label: 'Task',
    getPath: (value: string) => `/tasks/${value}`,
  },
  contactId: {
    type: 'contact',
    label: 'Contact',
    getPath: (value: string) => `/contacts/${value}`,
  },
  spaceId: {
    type: 'space',
    label: 'Space',
    getPath: (value: string) => `/spaces/${value}`,
  },
  blueprintId: {
    type: 'blueprint',
    label: 'Blueprint',
    getPath: (value: string) => `/blueprints/${value}`,
  },
  botId: {
    type: 'bot',
    label: 'Bot',
    getPath: (value: string) => `/bots/${value}`,
  },
  datasetId: {
    type: 'dataset',
    label: 'Dataset',
    getPath: (value: string) => `/datasets/${value}`,
  },
  recordId: {
    type: 'record',
    label: 'Record',
    getPath: (value: string, values: Record<string, string>) =>
      values.datasetId
        ? `/datasets/${values.datasetId}/records/${value}`
        : undefined,
  },
  skillsetId: {
    type: 'skillset',
    label: 'Skillset',
    getPath: (value: string) => `/skillsets/${value}`,
  },
  abilityId: {
    type: 'ability',
    label: 'Ability',
    getPath: (value: string, values: Record<string, string>) =>
      values.skillsetId
        ? `/skillsets/${values.skillsetId}/abilities/${value}`
        : `/abilities/${value}`,
  },
  fileId: {
    type: 'file',
    label: 'File',
    getPath: (value: string) => `/files/${value}`,
  },
  secretId: {
    type: 'secret',
    label: 'Secret',
    getPath: (value: string) => `/secrets/${value}`,
  },
  portalId: {
    type: 'portal',
    label: 'Portal',
    getPath: (value: string) => `/portals/${value}`,
  },
  policyId: {
    type: 'policy',
    label: 'Policy',
    getPath: (value: string) => `/policies/${value}`,
  },
  webhookId: {
    type: 'webhook',
    label: 'Webhook',
    getPath: (value: string) => `/webhooks/${value}`,
  },
  teamId: {
    type: 'team',
    label: 'Team',
    getPath: (value: string) => `/teams/${value}`,
  },
  widgetIntegrationId: {
    type: 'widget',
    label: 'Widget Integration',
    getPath: (value: string) => `/integrations/widget/${value}`,
  },
  slackIntegrationId: {
    type: 'slack',
    label: 'Slack Integration',
    getPath: (value: string) => `/integrations/slack/${value}`,
  },
  discordIntegrationId: {
    type: 'discord',
    label: 'Discord Integration',
    getPath: (value: string) => `/integrations/discord/${value}`,
  },
  microsoftteamsIntegrationId: {
    type: 'microsoftteams',
    label: 'Teams Integration',
    getPath: (value: string) => `/integrations/microsoftteams/${value}`,
  },
  googlechatIntegrationId: {
    type: 'googlechat',
    label: 'Google Chat Integration',
    getPath: (value: string) => `/integrations/googlechat/${value}`,
  },
  whatsappIntegrationId: {
    type: 'whatsapp',
    label: 'WhatsApp Integration',
    getPath: (value: string) => `/integrations/whatsapp/${value}`,
  },
  messengerIntegrationId: {
    type: 'messenger',
    label: 'Messenger Integration',
    getPath: (value: string) => `/integrations/messenger/${value}`,
  },
  telegramIntegrationId: {
    type: 'telegram',
    label: 'Telegram Integration',
    getPath: (value: string) => `/integrations/telegram/${value}`,
  },
  twilioIntegrationId: {
    type: 'twilio',
    label: 'Twilio Integration',
    getPath: (value: string) => `/integrations/twilio/${value}`,
  },
  emailIntegrationId: {
    type: 'email',
    label: 'Email Integration',
    getPath: (value: string) => `/integrations/email/${value}`,
  },
  sitemapIntegrationId: {
    type: 'sitemap',
    label: 'Sitemap Integration',
    getPath: (value: string) => `/integrations/sitemap/${value}`,
  },
  notionIntegrationId: {
    type: 'notion',
    label: 'Notion Integration',
    getPath: (value: string) => `/integrations/notion/${value}`,
  },
  triggerIntegrationId: {
    type: 'trigger',
    label: 'Trigger Integration',
    getPath: (value: string) => `/integrations/trigger/${value}`,
  },
  supportIntegrationId: {
    type: 'support',
    label: 'Support Integration',
    getPath: (value: string) => `/integrations/support/${value}`,
  },
  extractIntegrationId: {
    type: 'extract',
    label: 'Extract Integration',
    getPath: (value: string) => `/integrations/extract/${value}`,
  },
  mcpserverIntegrationId: {
    type: 'mcpserver',
    label: 'MCP Server Integration',
    getPath: (value: string) => `/integrations/mcpserver/${value}`,
  },
} as const

function normalizePathname(pathname = '/') {
  if (!pathname || pathname === '/') {
    return '/'
  }

  return pathname.replace(/\/+$/, '') || '/'
}

function parseInspectTarget(inspect?: string): {
  inspect: string
  pathname: string
  context: ResourceContext | null
} {
  const rawInspect = inspect || '/'
  const url = new URL(rawInspect, 'https://chatbotkit.app')
  const pathname = normalizePathname(url.pathname)

  for (const route of RESOURCE_ROUTES) {
    const match = pathname.match(route.pattern)

    if (!match) {
      continue
    }

    const params = Object.fromEntries(
      route.params.map((param, index) => [param, match[index + 1]])
    )

    const id = params[route.params[route.params.length - 1]]

    return {
      inspect: rawInspect,
      pathname,
      context: {
        type: route.type,
        label: route.label,
        id,
        params,
        eventField: route.eventField,
        auditField: route.auditField,
        dashboardPath: route.getDashboardPath(params),
        apiPath: route.getApiPath(params),
      },
    }
  }

  return {
    inspect: rawInspect,
    pathname,
    context: null,
  }
}

function addRelatedResource(
  map: Map<string, RelatedResource>,
  field: string,
  rawValue: unknown,
  values: Record<string, string>,
  source?: string
) {
  if (!rawValue || typeof rawValue !== 'string') {
    return
  }

  const definition =
    RELATED_RESOURCE_DEFINITIONS[
      field as keyof typeof RELATED_RESOURCE_DEFINITIONS
    ]

  if (!definition) {
    return
  }

  const path = definition.getPath(rawValue, values)

  if (!path) {
    return
  }

  const key = `${definition.type}:${rawValue}`

  if (!map.has(key)) {
    map.set(key, {
      type: definition.type,
      label: definition.label,
      id: rawValue,
      path,
      source,
    })
  }
}

function collectRelatedResources(
  resource: Record<string, unknown> | null,
  context: ResourceContext
): RelatedResource[] {
  const related = new Map<string, RelatedResource>()
  const values = {
    ...context.params,
    ...Object.fromEntries(
      Object.entries(resource || {}).filter(
        ([, value]) => typeof value === 'string'
      )
    ),
  } as Record<string, string>

  for (const [field, value] of Object.entries(context.params)) {
    addRelatedResource(related, field, value, values, 'route')
  }

  for (const [field, value] of Object.entries(resource || {})) {
    addRelatedResource(related, field, value, values, 'resource')
  }

  const currentKey = `${context.type}:${context.id}`

  return Array.from(related.values())
    .filter((item) => `${item.type}:${item.id}` !== currentKey)
    .sort((a, b) => {
      if (a.label !== b.label) {
        return a.label.localeCompare(b.label)
      }

      return a.id.localeCompare(b.id)
    })
}

async function fetchResource(session: StoreSession, apiPath: string) {
  const client = await getSessionClient(session)

  try {
    const resource = await client.clientFetch(apiPath)

    if (!resource || typeof resource !== 'object') {
      return null
    }

    return makeJsonSafe(resource) as Record<string, unknown>
  } catch {
    return null
  }
}

async function fetchEvents(session: StoreSession, context: ResourceContext) {
  if (!context.eventField) {
    return []
  }

  const client = await getSessionClient(session)

  try {
    const { items = [] } = await client.event.log.list({
      order: 'desc',
      take: 100,
    })

    return makeJsonSafe(
      items.filter((item) => item?.[context.eventField!] === context.id)
    ) as Record<string, unknown>[]
  } catch {
    return []
  }
}

async function fetchAuditLogs(userId: string, context: ResourceContext) {
  if (!context.auditField) {
    return []
  }

  const where = {
    userId,
    [context.auditField]: context.id,
  }

  return makeJsonSafe(
    await prisma.auditLog.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 100,
      select: {
        id: true,
        name: true,
        description: true,
        action: true,
        conversationId: true,
        taskId: true,
        contactId: true,
        spaceId: true,
        blueprintId: true,
        botId: true,
        datasetId: true,
        recordId: true,
        skillsetId: true,
        abilityId: true,
        fileId: true,
        secretId: true,
        portalId: true,
        policyId: true,
        webhookId: true,
        sessionId: true,
        oldValues: true,
        newValues: true,
        ipAddress: true,
        userAgent: true,
        meta: true,
        createdAt: true,
        updatedAt: true,
      },
    })
  ) as Record<string, unknown>[]
}

/**
 * @action
 */
export const getInspectorData = appActionHandler(
  APP_NAME,
  ConfigSchema,
  z.object({
    inspect: z.string().optional(),
  }),
  async (_config, session, { inspect }): Promise<InspectorResult> => {
    const parsed = parseInspectTarget(inspect)

    if (!parsed.context) {
      return {
        inspect: parsed.inspect,
        pathname: parsed.pathname,
        context: null,
        resource: null,
        relatedResources: [],
        events: [],
        auditLogs: [],
      }
    }

    const [resource, events, auditLogs] = await Promise.all([
      fetchResource(session, parsed.context.apiPath),
      fetchEvents(session, parsed.context),
      fetchAuditLogs(session.user.id, parsed.context),
    ])

    return {
      inspect: parsed.inspect,
      pathname: parsed.pathname,
      context: parsed.context,
      resource,
      relatedResources: collectRelatedResources(resource, parsed.context),
      events,
      auditLogs,
    }
  }
)
