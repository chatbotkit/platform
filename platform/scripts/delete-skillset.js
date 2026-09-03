import 'dotenv/config'

import prisma from '@/prisma/client'

import { assert } from '@/lib/debug'
import { confirm, log, runScript } from '@/lib/script'
import { deleteSkillset } from '@/lib/skillset.delete'

/**
 * Delete a skillset by ID.
 *
 * Usage:
 * ```bash
 * pnpm script:delete-skillset                     # Interactive mode
 * pnpm script:delete-skillset --skillsetId ss123  # CLI mode (still prompts for confirmation)
 * ```
 *
 * Warning: This is a destructive operation that cannot be undone.
 */
runScript({
  name: 'delete-skillset',
  description: 'Delete a skillset by ID',
  options: {
    skillsetId: {
      type: 'string',
      short: 's',
      description: 'Skillset ID to delete',
      message: 'What is the skillsetId?',
      required: true,
    },
  },
  handler: async ({ skillsetId }) => {
    log(`locating skillset ${skillsetId}`)

    const skillset = await prisma.skillset.findUnique({
      where: {
        id: skillsetId,
      },

      include: {
        _count: {
          include: {
            conversations: true,
          },
        },
      },
    })

    if (skillset) {
      log(`skillset found`, { skillset })
    } else {
      log(`skillset not found`)

      return
    }

    const confirmed = await confirm(
      `Do you really want to delete skillset ${skillsetId}?`
    )

    if (!confirmed) {
      log(`aborted`)

      return
    }

    assert(skillset.id, 'skillset id is not empty')

    await deleteSkillset(skillset)
  },
})
