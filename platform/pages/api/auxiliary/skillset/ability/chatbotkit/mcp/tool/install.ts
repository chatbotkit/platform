import prisma from '@/prisma/client'

import { authenticatedHandler } from '@/lib/auxiliary.handler'
import {
  setContextContact,
  setContextConversation,
  setContextNamespace,
} from '@/lib/context.store'
import debug from '@/lib/debug'
import { installMcpTools } from '@/lib/mcp.direct'
import { throwNotAuthorized } from '@/lib/response'
import type { ZodSchemaFor } from '@/lib/zod.schema'
import z from '@/lib/zod.schema'

const schema = z.object({
  conversationId: z.string().optional(),
  contactId: z.string().optional(),
  namespace: z.string().optional(),

  sessionId: z.string(),

  url: z.string(),
  headers: z.record(z.string()).optional(),

  headerSource: z
    .object({
      headerTemplate: z.record(z.string()),
      abilityId: z.string().optional(),
      secretId: z.string().optional(),
      inlineSecrets: z.record(z.object({ value: z.string() })).optional(),
    })
    .optional(),

  tools: z.array(z.string()).optional(),

  prefix: z.string().optional(),
} satisfies ZodSchemaFor<
  Parameters<typeof installMcpTools>[1] & {
    conversationId?: string
    contactId?: string
    namespace?: string
  }
>)

export default authenticatedHandler(
  schema,
  async function (session, parameters, headers): Promise<{ success: boolean }> {
    debug('install tools', {
      session,
      parameters,
      headers,
    }).log('auxiliary.skillset.ability.chatbotkit.mcp.tool.install.handler')

    const {
      conversationId,
      contactId,
      namespace,

      sessionId,

      url: mcpUrl,
      headers: mcpHeaders,

      headerSource,

      tools,

      prefix,
    } = parameters

    if (conversationId) {
      const conversation = await prisma.conversation.findUnique({
        where: {
          id: conversationId,
        },
      })

      if (conversation) {
        if (conversation.userId !== session.user.id) {
          return throwNotAuthorized(`Not authorized to access conversation`)
        }

        setContextConversation(conversation)
      }
    }

    if (contactId) {
      const contact = await prisma.contact.findUnique({
        where: {
          id: contactId,
        },
      })

      if (contact) {
        if (contact.userId !== session.user.id) {
          return throwNotAuthorized(`Not authorized to access contact`)
        }

        setContextContact(contact)
      }
    }

    if (namespace) {
      setContextNamespace(namespace)
    }

    const result = await installMcpTools(session.user, {
      sessionId,

      url: mcpUrl,
      headers: mcpHeaders,

      headerSource,

      tools,

      prefix,
    })

    debug('installed tools', { result }).log(
      'auxiliary.skillset.ability.chatbotkit.mcp.tool.install.handler'
    )

    return result
  }
)
