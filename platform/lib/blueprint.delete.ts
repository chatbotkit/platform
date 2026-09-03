import prisma from '@/prisma/client'
import type { Blueprint } from '@/prisma/types'

import { deleteManyBots } from './bot.delete'
import { deleteManyDatasets } from './dataset.delete'
import { deleteManySkillsets } from './skillset.delete'
import { deleteManySpaces } from './space.delete'

// @note when `deleteResources` is true, every Prisma model that declares a
// `blueprint` relation must be removed. That happens one of four ways: an
// explicit `tx.<model>.deleteMany` call in the transaction below, a dedicated
// delete helper (bot/dataset/skillset/space, which clear nested relationships a
// bare deleteMany would strand), the database itself (`onDelete: Cascade`
// relations, e.g. hubBlueprintPage), or a deliberate orphan (`Context` is
// per-contact runtime memory, not a template resource, so its blueprintId is
// just nulled). There is intentionally NO hardcoded manifest of these models
// here: `blueprint.delete.coverage.utest.js` runs this function against a
// recording prisma mock and asserts every blueprint-related model in
// schema.prisma actually reaches a delete - so a newly-added integration can't
// silently leak on delete.
//
// @note the transaction spells out one `tx.<model>.deleteMany(...)` call per
// model rather than looping over a list, on purpose: the
// `require-safe-prisma-delete` lint rule only matches statically written calls,
// so a dynamic `tx[model]` dispatch would silently bypass it (that rule is
// exactly what catches models like `space`, which must go through a helper).

/**
 * Delete a blueprint and optionally all associated resources.
 */
export async function deleteBlueprint(
  blueprint: Pick<Blueprint, 'id' | 'userId'>,
  options: { deleteResources?: boolean } = {}
) {
  const { deleteResources = false } = options

  // `deleteResources` is additive: the blueprint itself is always deleted, and
  // when set we first delete everything it owns. Deleting the resources first
  // (blueprint last) keeps the blueprint row as an anchor if resource cleanup
  // fails partway - a retry can still find the resources by blueprintId, whereas
  // deleting the blueprint first would SetNull those references and strand them.

  if (deleteResources) {
    const blueprintId = blueprint.id
    const userId = blueprint.userId

    const where = { blueprintId, userId }

    // Fetch the helper-managed resources before the transaction; their helpers
    // run after it and need the id list.

    const bots = await prisma.bot.findMany({ where, select: { id: true } })

    const datasets = await prisma.dataset.findMany({
      where,
      select: { id: true },
    })

    const skillsets = await prisma.skillset.findMany({
      where,
      select: { id: true },
    })

    const spaces = await prisma.space.findMany({ where, select: { id: true } })

    // @note order matters here - we delete integrations before the
    // helper-managed resources (below) to avoid foreign key issues. Keep these
    // calls spelled out (see the file-level note) so the
    // require-safe-prisma-delete lint rule can analyse each one.

    await prisma.$transaction(async (tx) => {
      // integrations
      await tx.extractIntegration.deleteMany({ where })
      await tx.notionIntegration.deleteMany({ where })
      await tx.sitemapIntegration.deleteMany({ where })
      await tx.supportIntegration.deleteMany({ where })
      await tx.emailIntegration.deleteMany({ where })
      await tx.triggerIntegration.deleteMany({ where })
      await tx.widgetIntegration.deleteMany({ where })
      await tx.slackIntegration.deleteMany({ where })
      await tx.githubIntegration.deleteMany({ where })
      await tx.discordIntegration.deleteMany({ where })
      await tx.microsoftteamsIntegration.deleteMany({ where })
      await tx.googlechatIntegration.deleteMany({ where })
      await tx.telegramIntegration.deleteMany({ where })
      await tx.whatsappIntegration.deleteMany({ where })
      await tx.messengerIntegration.deleteMany({ where })
      await tx.instagramIntegration.deleteMany({ where })
      await tx.twilioIntegration.deleteMany({ where })
      await tx.avatarIntegration.deleteMany({ where })
      await tx.anamIntegration.deleteMany({ where })
      await tx.recallIntegration.deleteMany({ where })
      await tx.mcpserverIntegration.deleteMany({ where })
      await tx.skillserverIntegration.deleteMany({ where })

      // oauth
      await tx.oAuthConnection.deleteMany({ where })

      // objects
      await tx.task.deleteMany({ where })

      // compliance
      await tx.policy.deleteMany({ where })

      // portal + primitives
      await tx.portal.deleteMany({ where })
      await tx.ability.deleteMany({ where })
      await tx.secret.deleteMany({ where })
      await tx.file.deleteMany({ where })
    })

    // @note these run after the transaction because they have their own
    // transaction logic for handling relationships.

    await deleteManyBots(bots)
    await deleteManyDatasets(datasets)
    await deleteManySkillsets(skillsets)
    await deleteManySpaces(spaces)
  }

  // Always delete the blueprint itself, last.
  // eslint-disable-next-line custom-eslint-rules/require-safe-prisma-delete
  await prisma.blueprint.delete({
    where: { id: blueprint.id },
  })
}

export async function deleteManyBlueprints(
  blueprints: Pick<Blueprint, 'id' | 'userId'>[],
  options: { deleteResources?: boolean } = {}
) {
  await Promise.all(
    blueprints.map(async (blueprint) => {
      await deleteBlueprint(blueprint, options)
    })
  )
}
