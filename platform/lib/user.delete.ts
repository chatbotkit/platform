import prisma from '@/prisma/client'

import { deleteCustomer } from '@/lib/billing.provider'
import { deleteBlueprint } from '@/lib/blueprint.delete'
import { deleteManyBots } from '@/lib/bot.delete'
import { deleteConversation } from '@/lib/conversation.delete'
import { deleteDataset } from '@/lib/dataset.delete'
import { captureError } from '@/lib/error'
import { deleteFile } from '@/lib/file.delete'
import { runTasks, runTasksBatch, runTasksEach } from '@/lib/job'
import { notifyUserDeleted } from '@/lib/notify'
import { throwNotFound } from '@/lib/response'
import { deleteManySkillsets } from '@/lib/skillset.delete'
import { deleteManySpaces } from '@/lib/space.delete'

type DeleteUserOptions = {
  deleteBillingCustomer?: boolean
  sendDeletionEmail?: boolean
}

export async function deleteUser(
  userId: string,
  {
    deleteBillingCustomer = false,
    sendDeletionEmail = true,
  }: DeleteUserOptions = {}
): Promise<void> {
  const user = await prisma.user.findUnique({
    where: {
      id: userId,
    },

    select: {
      id: true,

      email: true,

      billingCustomerId: true,
    },
  })

  if (!user) {
    return throwNotFound()
  }

  // @todo add more defensive coding

  // delete resources in parallel across types; each type uses parallel workers internally
  // @note blueprints are deleted last as they act as containers for other resources
  await runTasks([
    // bots (nullifies botId on conversations before deleting)
    () =>
      runTasksBatch(
        3,
        prisma.bot.paginate({
          where: { userId: user.id },
          select: { id: true },
        }),
        deleteManyBots
      ),

    // datasets (handles store cleanup per dataset)
    () =>
      runTasksEach(
        3,
        prisma.dataset.paginate({
          where: { userId: user.id },
          select: { id: true },
        }),
        deleteDataset
      ),

    // skillsets (nullifies skillsetId on conversations before deleting)
    () =>
      runTasksBatch(
        3,
        prisma.skillset.paginate({
          where: { userId: user.id },
          select: { id: true },
        }),
        deleteManySkillsets
      ),

    // files (handles S3 cleanup per file)
    () =>
      runTasksEach(
        3,
        prisma.file.paginate({
          where: { userId: user.id },
          select: { id: true },
        }),
        deleteFile
      ),

    // spaces (nullifies spaceId on conversations before deleting)
    () =>
      runTasksBatch(
        3,
        prisma.space.paginate({
          where: { userId: user.id },
          select: { id: true },
        }),
        deleteManySpaces
      ),

    // space sites (also cascade-deleted with their space; deleted explicitly so
    // user deletion has direct coverage and does not rely on the cascade)
    () => prisma.spaceSite.deleteMany({ where: { userId: user.id } }),

    // conversations (handles S3 cleanup per conversation)
    () =>
      runTasksEach(
        3,
        prisma.conversation.paginate({
          where: { userId: user.id },
          select: { id: true },
        }),
        (conversation) => deleteConversation(conversation.id)
      ),

    // context
    () => prisma.context.deleteMany({ where: { userId: user.id } }),

    // logs
    () => prisma.eventLog.deleteMany({ where: { userId: user.id } }),
    () => prisma.eventMetric.deleteMany({ where: { userId: user.id } }),
    () => prisma.auditLog.deleteMany({ where: { userId: user.id } }),

    // integrations not tied to a blueprint (blueprint-scoped ones are handled by deleteBlueprint)
    // @note order matters: item records first, then the parent integrations
    () =>
      prisma.extractIntegrationItem.deleteMany({
        where: { extractIntegration: { userId: user.id } },
      }),
    () =>
      prisma.$transaction([
        prisma.triggerIntegration.deleteMany({ where: { userId: user.id } }),
        prisma.extractIntegration.deleteMany({ where: { userId: user.id } }),
        prisma.widgetIntegration.deleteMany({ where: { userId: user.id } }),
        prisma.slackIntegration.deleteMany({ where: { userId: user.id } }),
        prisma.githubIntegration.deleteMany({ where: { userId: user.id } }),
        prisma.discordIntegration.deleteMany({ where: { userId: user.id } }),
        prisma.microsoftteamsIntegration.deleteMany({
          where: { userId: user.id },
        }),
        prisma.googlechatIntegration.deleteMany({ where: { userId: user.id } }),
        prisma.whatsappIntegration.deleteMany({ where: { userId: user.id } }),
        prisma.messengerIntegration.deleteMany({ where: { userId: user.id } }),
        prisma.instagramIntegration.deleteMany({ where: { userId: user.id } }),
        prisma.telegramIntegration.deleteMany({ where: { userId: user.id } }),
        prisma.twilioIntegration.deleteMany({ where: { userId: user.id } }),
        prisma.anamIntegration.deleteMany({ where: { userId: user.id } }),
        prisma.avatarIntegration.deleteMany({ where: { userId: user.id } }),
        prisma.recallIntegration.deleteMany({ where: { userId: user.id } }),
        prisma.emailIntegration.deleteMany({ where: { userId: user.id } }),
        prisma.sitemapIntegration.deleteMany({ where: { userId: user.id } }),
        prisma.notionIntegration.deleteMany({ where: { userId: user.id } }),
        prisma.supportIntegration.deleteMany({ where: { userId: user.id } }),
        prisma.mcpserverIntegration.deleteMany({ where: { userId: user.id } }),
        prisma.skillserverIntegration.deleteMany({
          where: { userId: user.id },
        }),
      ]),
  ])

  // delete task executions, tasks, and contacts after conversations have been fully cleared
  // @note tasks must be pre-deleted before contacts to avoid a large cascade from contact.deleteMany
  await prisma.taskExecution.deleteMany({ where: { userId: user.id } })
  await prisma.task.deleteMany({ where: { userId: user.id } })
  await prisma.contact.deleteMany({ where: { userId: user.id } })

  // delete blueprints last (after all their scoped resources have been removed)
  await runTasksEach(
    3,
    prisma.blueprint.paginate({
      where: { userId: user.id },
      select: { id: true, userId: true },
    }),
    (blueprint) => deleteBlueprint(blueprint, { deleteResources: true })
  )

  // @note these user-owned tables are not covered by the resource-specific
  // delete helpers above, so we remove them explicitly before deleting the
  // user row to avoid a large Prisma-emulated cascade transaction
  await runTasks([
    () => prisma.account.deleteMany({ where: { userId: user.id } }),
    () => prisma.session.deleteMany({ where: { userId: user.id } }),
    () => prisma.team.deleteMany({ where: { userId: user.id } }),
    () =>
      prisma.oAuthApplicationToken.deleteMany({ where: { userId: user.id } }),
    () => prisma.oAuthApplication.deleteMany({ where: { userId: user.id } }),
    () => prisma.oAuthConnection.deleteMany({ where: { userId: user.id } }),
    () => prisma.lock.deleteMany({ where: { userId: user.id } }),
    () => prisma.ability.deleteMany({ where: { userId: user.id } }),
    () => prisma.secret.deleteMany({ where: { userId: user.id } }),
    () => prisma.secretValue.deleteMany({ where: { userId: user.id } }),
    () => prisma.portal.deleteMany({ where: { userId: user.id } }),
    () => prisma.policy.deleteMany({ where: { userId: user.id } }),
    () => prisma.hubBotPage.deleteMany({ where: { userId: user.id } }),
    () => prisma.hubDatasetPage.deleteMany({ where: { userId: user.id } }),
    () => prisma.hubSkillsetPage.deleteMany({ where: { userId: user.id } }),
    () => prisma.hubBlueprintPage.deleteMany({ where: { userId: user.id } }),
    () => prisma.hubWidgetPage.deleteMany({ where: { userId: user.id } }),
    () => prisma.rating.deleteMany({ where: { userId: user.id } }),
    () => prisma.memory.deleteMany({ where: { userId: user.id } }),
    () => prisma.token.deleteMany({ where: { userId: user.id } }),
    () => prisma.webhook.deleteMany({ where: { userId: user.id } }),
  ])

  // delete billing customer
  // @note we do not capture errors here because we don't want to delete the
  // user if we cannot perform successfully this operation
  {
    if (deleteBillingCustomer) {
      await deleteCustomer(user)
    }
  }

  // delete user
  // @note we do not capture errors here because we don't want to delete the
  // user if we cannot perform successfully this operation
  // @note NOT a TypedSQL target (which is read-only): this is a write, and it
  // deliberately deletes only the User row without triggering Prisma's
  // relationMode="prisma" cascade emulation - all children are removed above.
  {
    await prisma.$executeRaw`
      DELETE FROM \`User\`
      WHERE id = ${user.id}
    `
  }

  // notify user
  {
    if (sendDeletionEmail) {
      try {
        await notifyUserDeleted(user)
      } catch (error) {
        await captureError(error)
      }
    }
  }
}
