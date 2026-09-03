// @ts-check
import prisma from '@/prisma/client'

import { getConversationAttachmentDownloadURL } from '@/lib/conversation.attachment'
import { withGet } from '@/lib/method'
import { requiredUrlParam } from '@/lib/query.get'
import { notAuthorized, notFound, redirect } from '@/lib/response'
import { withSession } from '@/lib/session.handler'

export default withGet(
  withSession(async function (req, session) {
    const conversation = await prisma.conversation.findUnique({
      where: {
        id: requiredUrlParam(req, 'conversationId'),
      },
    })

    if (!conversation) {
      return notFound()
    }

    if (conversation.userId !== session.user.id) {
      return notAuthorized()
    }

    // @todo check the file exists before generating the URL, or return 404
    // @todo support both name and id for the attachment

    const url = await getConversationAttachmentDownloadURL(
      conversation.id,
      requiredUrlParam(req, 'attachmentId'),
      false
    )

    return redirect(new URL(url))
  })
)
