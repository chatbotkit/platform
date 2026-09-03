import prisma from '@/prisma/client'

import { authenticatedHandler } from '@/lib/auxiliary.handler'
import {
  setContextContact,
  setContextConversation,
  setContextNamespace,
} from '@/lib/context.store'
import debug from '@/lib/debug'
import { callMcpTool } from '@/lib/mcp.direct'
import { rethrowMcpError } from '@/lib/mcp.error'
import { throwNotAuthorized } from '@/lib/response'
import type { McpSerializableTool } from '@/lib/tool.environment'

import { z } from 'zod'

const schema = z.object({
  conversationId: z.string().optional(),
  contactId: z.string().optional(),
  namespace: z.string().optional(),

  tool: z.unknown(),
  args: z.unknown(),
})

export default authenticatedHandler(
  schema,
  async function (session, parameters, headers): Promise<unknown> {
    debug('call tool', {
      session,
      parameters,
      headers,
    }).log('auxiliary.skillset.ability.chatbotkit.mcp.tool.call.handler')

    const { conversationId, contactId, namespace, tool, args } = parameters

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

    try {
      const result = await callMcpTool(
        session.user,
        tool as McpSerializableTool,
        args
      )

      debug('tool call result', { result }).log(
        'auxiliary.skillset.ability.chatbotkit.mcp.tool.call.handler'
      )

      return result
    } catch (e) {
      rethrowMcpError(e)
    }
  }
)
