import 'dotenv/config'

import prisma from '@/prisma/client'

import { log, runScript } from '@/lib/script'

/**
 * Get a contact's secret information.
 *
 * Usage:
 * ```bash
 * pnpm script:get-contact-secret                # Interactive mode
 * pnpm script:get-contact-secret --contactId c123  # CLI mode
 * ```
 */
runScript({
  name: 'get-contact-secret',
  description: "Get a contact's secret information",
  options: {
    contactId: {
      type: 'string',
      short: 'c',
      description: 'Contact ID',
      message: 'What is the contact ID?',
      required: true,
    },
  },
  handler: async ({ contactId }) => {
    const contact = await prisma.contact.findUnique({
      where: {
        id: contactId,
      },

      include: {
        secretValues: {
          include: {
            secret: true,
          },
        },
      },
    })

    if (contact) {
      log(`found`, contact)
    } else {
      log(`contact not found with ID: ${contactId}`)

      return
    }
  },
})
