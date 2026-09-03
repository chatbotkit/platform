import 'dotenv/config'

import prisma from '@/prisma/client'

import { assert, error } from '@/lib/debug'
import { batchAsync } from '@/lib/it'
import { confirm, log, runScript } from '@/lib/script'
import { getTemporaryUserToken } from '@/lib/session.temp'

import ChatBotKit from '@chatbotkit/sdk'

/**
 * Nuke all resources from an account (user). This is a destructive operation
 * that deletes ALL resources including bots, datasets, skillsets, files,
 * conversations, integrations, and more.
 *
 * Usage:
 * ```bash
 * pnpm script:nuke-account --email user@example.com            # Dry run (default)
 * pnpm script:nuke-account --email user@example.com --confirm  # Actually delete
 * pnpm script:nuke-account --userId usr123 --confirm           # Delete by userId
 * ```
 *
 * Warning: This is an extremely destructive operation that cannot be undone.
 * The user account itself is NOT deleted, only the resources.
 */
const RESOURCE_TYPES = [
  'conversations',
  'blueprints',
  'bots',
  'datasets',
  'skillsets',
  'files',
  'spaces',
  'integrations',
  'contacts',
  'secrets',
  'values',
  'portals',
  'tasks',
  'memories',
  'tokens',
  'webhooks',
  'policies',
  'oauthApplications',
  'ratings',
  'hubPages',
  'locks',
]

runScript({
  name: 'nuke-account',
  description: 'Delete all resources from an account',
  options: {
    email: {
      type: 'string',
      short: 'e',
      description: 'User email address',
      message: 'What is the email address for the user?',
    },
    userId: {
      type: 'string',
      short: 'u',
      description: 'User ID (alternative to email)',
      message: 'What is the userId? (leave empty if using email)',
    },
    confirm: {
      type: 'boolean',
      short: 'c',
      description: 'Actually delete resources (default is dry-run)',
      default: false,
    },
    skip: {
      type: 'string',
      short: 's',
      description: `Skip deletion of specific resource types (comma-separated). Valid types: ${RESOURCE_TYPES.join(', ')}`,
      message:
        'Enter resource types to skip (comma-separated, or leave empty):',
    },
  },
  handler: async ({ email, userId, confirm: shouldExecute, skip }) => {
    // Require either email or userId
    if (!email && !userId) {
      error('Either --email or --userId must be provided')

      return
    }

    // Parse and validate skip list
    const skipSet = new Set()

    if (skip) {
      const skipTypes = skip.split(',').map((s) => s.trim())

      for (const type of skipTypes) {
        if (!RESOURCE_TYPES.includes(type)) {
          error(
            `Invalid resource type "${type}". Valid types: ${RESOURCE_TYPES.join(', ')}`
          )

          return
        }

        skipSet.add(type)
      }

      if (skipSet.size > 0) {
        log(`skipping resource types: ${Array.from(skipSet).join(', ')}`)
      }
    }

    // Find the user
    log('locating user...')

    const user = await prisma.user.findUnique({
      where: email ? { email } : { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
      },
    })

    if (!user) {
      log('user not found')

      return
    }

    log(`found user: ${user.email} (${user.id})`)

    // Count all resources
    log('counting resources...')

    const counts = await countResources(user.id)

    log('resource counts:', counts)

    const totalResources = Object.values(counts).reduce((a, b) => a + b, 0)

    if (totalResources === 0) {
      log('no resources to delete')

      return
    }

    const dryRun = !shouldExecute

    if (dryRun) {
      log(
        'DRY RUN MODE - no resources will be deleted (use --confirm to actually delete)'
      )
      log(`would delete ${totalResources} resources`)
    } else {
      // Confirm deletion
      const confirmed = await confirm(
        `Do you really want to DELETE ALL ${totalResources} resources from account ${user.email}? This CANNOT be undone!`
      )

      if (!confirmed) {
        log('aborted')

        return
      }

      // Double confirm for safety
      const doubleConfirmed = await confirm(
        'Are you ABSOLUTELY SURE? Type "yes" to confirm this destructive operation.'
      )

      if (!doubleConfirmed) {
        log('aborted')

        return
      }
    }

    assert(user.id, 'user id is not empty')

    await nukeAccount(user.id, skipSet, dryRun)

    if (dryRun) {
      log(`dry run complete - no resources were actually deleted`)
    } else {
      log(`successfully nuked all resources from account ${user.email}`)
    }
  },
})

/**
 * Count all resources for a user
 */
async function countResources(userId) {
  const [
    bots,
    datasets,
    skillsets,
    files,
    blueprints,
    conversations,
    contacts,
    spaces,
    secrets,
    values,
    portals,
    tasks,
    memories,
    tokens,
    webhooks,
    policies,
    oauthApplications,
    // Integrations
    widgetIntegrations,
    slackIntegrations,
    discordIntegrations,
    microsoftteamsIntegrations,
    whatsappIntegrations,
    messengerIntegrations,
    instagramIntegrations,
    telegramIntegrations,
    twilioIntegrations,
    emailIntegrations,
    sitemapIntegrations,
    notionIntegrations,
    supportIntegrations,
    extractIntegrations,
    triggerIntegrations,
    mcpserverIntegrations,
  ] = await Promise.all([
    prisma.bot.count({ where: { userId } }),
    prisma.dataset.count({ where: { userId } }),
    prisma.skillset.count({ where: { userId } }),
    prisma.file.count({ where: { userId } }),
    prisma.blueprint.count({ where: { userId } }),
    prisma.conversation.count({ where: { userId } }),
    prisma.contact.count({ where: { userId } }),
    prisma.space.count({ where: { userId } }),
    prisma.secret.count({ where: { userId } }),
    prisma.secretValue.count({ where: { userId } }),
    prisma.portal.count({ where: { userId } }),
    prisma.task.count({ where: { userId } }),
    prisma.memory.count({ where: { userId } }),
    prisma.token.count({ where: { userId } }),
    prisma.webhook.count({ where: { userId } }),
    prisma.policy.count({ where: { userId } }),
    prisma.oAuthApplication.count({ where: { userId } }),
    // Integrations
    prisma.widgetIntegration.count({ where: { userId } }),
    prisma.slackIntegration.count({ where: { userId } }),
    prisma.discordIntegration.count({ where: { userId } }),
    prisma.microsoftteamsIntegration.count({ where: { userId } }),
    prisma.whatsappIntegration.count({ where: { userId } }),
    prisma.messengerIntegration.count({ where: { userId } }),
    prisma.instagramIntegration.count({ where: { userId } }),
    prisma.telegramIntegration.count({ where: { userId } }),
    prisma.twilioIntegration.count({ where: { userId } }),
    prisma.emailIntegration.count({ where: { userId } }),
    prisma.sitemapIntegration.count({ where: { userId } }),
    prisma.notionIntegration.count({ where: { userId } }),
    prisma.supportIntegration.count({ where: { userId } }),
    prisma.extractIntegration.count({ where: { userId } }),
    prisma.triggerIntegration.count({ where: { userId } }),
    prisma.mcpserverIntegration.count({ where: { userId } }),
  ])

  return {
    bots,
    datasets,
    skillsets,
    files,
    blueprints,
    conversations,
    contacts,
    spaces,
    secrets,
    values,
    portals,
    tasks,
    memories,
    tokens,
    webhooks,
    policies,
    oauthApplications,
    widgetIntegrations,
    slackIntegrations,
    discordIntegrations,
    microsoftteamsIntegrations,
    whatsappIntegrations,
    messengerIntegrations,
    instagramIntegrations,
    telegramIntegrations,
    twilioIntegrations,
    emailIntegrations,
    sitemapIntegrations,
    notionIntegrations,
    supportIntegrations,
    extractIntegrations,
    triggerIntegrations,
    mcpserverIntegrations,
  }
}

/**
 * Delete all resources for a user account
 * @param {string} userId - The user ID
 * @param {Set<string>} skipSet - Set of resource types to skip
 * @param {boolean} dryRun - If true, only log what would be deleted without actually deleting
 */
/**
 * Delete all resources from a user account using the ChatBotKit SDK/API
 *
 * @param {string} userId - User ID to nuke
 * @param {Set<string>} skipSet - Set of resource types to skip
 * @param {boolean} dryRun - If true, only count resources without deleting
 */
async function nukeAccount(userId, skipSet = new Set(), dryRun = true) {
  // Generate temporary token for API access
  log('generating temporary API token...')

  const token = await getTemporaryUserToken(userId, {
    durationInSeconds: 3600, // 1 hour should be enough for large accounts
  })

  // Initialize SDK client
  const client = new ChatBotKit({
    secret: token,
  })

  const mode = dryRun ? '[DRY RUN]' : '[DELETING]'

  // Track deletion statistics
  const stats = {
    failures: [],
    totalAttempted: 0,
    totalSucceeded: 0,
    totalFailed: 0,
  }

  // 1. Delete conversations first (they reference many things and have S3 cleanup)
  if (!skipSet.has('conversations')) {
    log(`${mode} deleting conversations...`)
    {
      let deleted = 0
      let batches = 0

      for await (const batch of batchAsync(
        client.conversation.list().stream(),
        100
      )) {
        if (dryRun) {
          // In dry run, just count what would be deleted
          const items = batch.filter((e) => e.type === 'item')

          deleted += items.length
          batches++
          log(
            `  would delete batch ${batches}: ${items.length} conversations (${deleted} total)`
          )
        } else {
          // Actually delete
          for (const event of batch) {
            if (event.type !== 'item') {
              continue
            }

            try {
              stats.totalAttempted++
              await client.conversation.delete(event.data.id)
              deleted++
              stats.totalSucceeded++

              if (deleted % 10 === 0) {
                log(`  progress: ${deleted} conversations deleted`)
              }
            } catch (e) {
              stats.totalFailed++
              stats.failures.push({
                type: 'conversation',
                id: event.data.id,
                error: e.message,
              })
              error(`  failed to delete conversation ${event.data.id}`, e)
            }
          }
        }
      }

      log(
        `${dryRun ? 'would delete' : 'deleted'} ${deleted} conversations total`
      )
    }
  } else {
    log('skipping conversations (--skip)')
  }

  // 2. Delete blueprints with all their scoped resources
  // @note SDK blueprint.delete handles cascade deletion of scoped resources
  if (!skipSet.has('blueprints')) {
    log(`${mode} deleting blueprints...`)
    {
      let deleted = 0
      let batches = 0

      for await (const batch of batchAsync(
        client.blueprint.list().stream(),
        100
      )) {
        if (dryRun) {
          // In dry run, just count what would be deleted
          const items = batch.filter((e) => e.type === 'item')

          deleted += items.length
          batches++
          log(
            `  would delete batch ${batches}: ${items.length} blueprints (${deleted} total)`
          )
        } else {
          // Actually delete
          for (const event of batch) {
            if (event.type !== 'item') {
              continue
            }

            try {
              stats.totalAttempted++
              await client.blueprint.delete(event.data.id)
              deleted++
              stats.totalSucceeded++

              if (deleted % 5 === 0) {
                log(`  progress: ${deleted} blueprints deleted`)
              }
            } catch (e) {
              stats.totalFailed++
              stats.failures.push({
                type: 'blueprint',
                id: event.data.id,
                error: e.message,
              })
              error(`  failed to delete blueprint ${event.data.id}`, e)
            }
          }
        }
      }

      log(`${dryRun ? 'would delete' : 'deleted'} ${deleted} blueprints total`)
    }
  } else {
    log('skipping blueprints (--skip)')
  }

  // 3. Delete remaining user-level bots NOT tied to blueprints
  if (!skipSet.has('bots')) {
    log(`${mode} deleting remaining bots...`)
    {
      let deleted = 0
      let batches = 0

      for await (const batch of batchAsync(
        client.bot.list().stream(),
        10 // Smaller batches to avoid API rate limits
      )) {
        if (dryRun) {
          const items = batch.filter((e) => e.type === 'item')

          deleted += items.length
          batches++
          log(
            `  would delete batch ${batches}: ${items.length} bots (${deleted} total)`
          )
        } else {
          // Delete individually
          let batchDeleted = 0

          for (const event of batch) {
            if (event.type !== 'item') {
              continue
            }

            try {
              stats.totalAttempted++
              await client.bot.delete(event.data.id)
              deleted++
              batchDeleted++
              stats.totalSucceeded++
            } catch (e) {
              stats.totalFailed++
              stats.failures.push({
                type: 'bot',
                id: event.data.id,
                error: e.message,
              })
              error(`  failed to delete bot ${event.data.id}`, e)
            }
          }

          log(`  deleted batch: ${batchDeleted} bots (${deleted} total)`)
        }
      }

      if (deleted > 0) {
        log(`${dryRun ? 'would delete' : 'deleted'} ${deleted} bots total`)
      } else {
        log('no user-level bots to delete')
      }
    }
  } else {
    log('skipping bots (--skip)')
  }

  // 4. Delete remaining user-level datasets NOT tied to blueprints
  if (!skipSet.has('datasets')) {
    log(`${mode} deleting remaining datasets...`)
    {
      let deleted = 0
      let batches = 0

      for await (const batch of batchAsync(
        client.dataset.list().stream(),
        10 // Smaller batches to avoid API rate limits
      )) {
        if (dryRun) {
          const items = batch.filter((e) => e.type === 'item')

          deleted += items.length
          batches++
          log(
            `  would delete batch ${batches}: ${items.length} datasets (${deleted} total)`
          )
        } else {
          // Delete individually
          let batchDeleted = 0

          for (const event of batch) {
            if (event.type !== 'item') {
              continue
            }

            try {
              stats.totalAttempted++
              await client.dataset.delete(event.data.id)
              deleted++
              batchDeleted++
              stats.totalSucceeded++
            } catch (e) {
              stats.totalFailed++
              stats.failures.push({
                type: 'dataset',
                id: event.data.id,
                error: e.message,
              })
              error(`  failed to delete dataset ${event.data.id}`, e)
            }
          }

          log(`  deleted batch: ${batchDeleted} datasets (${deleted} total)`)
        }
      }

      if (deleted > 0) {
        log(`${dryRun ? 'would delete' : 'deleted'} ${deleted} datasets total`)
      } else {
        log('no user-level datasets to delete')
      }
    }
  } else {
    log('skipping datasets (--skip)')
  }

  // 5. Delete remaining user-level skillsets NOT tied to blueprints
  if (!skipSet.has('skillsets')) {
    log(`${mode} deleting remaining skillsets...`)
    {
      let deleted = 0
      let batches = 0

      for await (const batch of batchAsync(
        client.skillset.list().stream(),
        10 // Smaller batches to avoid API rate limits
      )) {
        if (dryRun) {
          const items = batch.filter((e) => e.type === 'item')

          deleted += items.length
          batches++
          log(
            `  would delete batch ${batches}: ${items.length} skillsets (${deleted} total)`
          )
        } else {
          // Delete individually
          let batchDeleted = 0

          for (const event of batch) {
            if (event.type !== 'item') {
              continue
            }

            try {
              stats.totalAttempted++
              await client.skillset.delete(event.data.id)
              deleted++
              batchDeleted++
              stats.totalSucceeded++
            } catch (e) {
              stats.totalFailed++
              stats.failures.push({
                type: 'skillset',
                id: event.data.id,
                error: e.message,
              })
              error(`  failed to delete skillset ${event.data.id}`, e)
            }
          }

          log(`  deleted batch: ${batchDeleted} skillsets (${deleted} total)`)
        }
      }

      if (deleted > 0) {
        log(`${dryRun ? 'would delete' : 'deleted'} ${deleted} skillsets total`)
      } else {
        log('no user-level skillsets to delete')
      }
    }
  } else {
    log('skipping skillsets (--skip)')
  }

  // 6. Delete remaining user-level files NOT tied to blueprints
  if (!skipSet.has('files')) {
    log(`${mode} deleting remaining files...`)
    {
      let deleted = 0
      let batches = 0

      for await (const batch of batchAsync(client.file.list().stream(), 100)) {
        if (dryRun) {
          // In dry run, just count
          deleted += batch.length
          batches++
          log(
            `  would delete batch ${batches}: ${batch.length} files (${deleted} total)`
          )
        } else {
          // Actually delete
          for (const file of batch) {
            try {
              stats.totalAttempted++
              await client.file.delete(file.id)
              deleted++
              stats.totalSucceeded++

              if (deleted % 10 === 0) {
                log(`  progress: ${deleted} files deleted`)
              }
            } catch (e) {
              stats.totalFailed++
              stats.failures.push({
                type: 'file',
                id: file.id,
                error: e.message,
              })
              error(`  failed to delete file ${file.id}`, e)
            }
          }
        }
      }

      log(`${dryRun ? 'would delete' : 'deleted'} ${deleted} files total`)
    }
  } else {
    log('skipping files (--skip)')
  }

  // 7. Delete spaces
  if (!skipSet.has('spaces')) {
    log(`${mode} deleting spaces...`)
    {
      let deleted = 0
      let batches = 0

      for await (const batch of batchAsync(
        client.space.list().stream(),
        10 // Smaller batches to avoid API rate limits
      )) {
        if (dryRun) {
          const items = batch.filter((e) => e.type === 'item')

          deleted += items.length
          batches++
          log(
            `  would delete batch ${batches}: ${items.length} spaces (${deleted} total)`
          )
        } else {
          // Delete individually
          let batchDeleted = 0

          for (const event of batch) {
            if (event.type !== 'item') {
              continue
            }

            try {
              stats.totalAttempted++
              await client.space.delete(event.data.id)
              deleted++
              batchDeleted++
              stats.totalSucceeded++
            } catch (e) {
              stats.totalFailed++
              stats.failures.push({
                type: 'space',
                id: event.data.id,
                error: e.message,
              })
              error(`  failed to delete space ${event.data.id}`, e)
            }
          }

          log(`  deleted batch: ${batchDeleted} spaces (${deleted} total)`)
        }
      }

      if (deleted > 0) {
        log(`${dryRun ? 'would delete' : 'deleted'} ${deleted} spaces total`)
      } else {
        log('no spaces to delete')
      }
    }
  } else {
    log('skipping spaces (--skip)')
  }

  // 8-9. Delete remaining resources
  // @note using SDK where available, Prisma for integrations and other types without SDK support

  // Contacts
  if (!skipSet.has('contacts')) {
    log(`${mode} deleting contacts...`)

    let deleted = 0

    for await (const batch of batchAsync(client.contact.list().stream(), 100)) {
      if (dryRun) {
        deleted += batch.filter((e) => e.type === 'item').length
      } else {
        for (const event of batch) {
          if (event.type !== 'item') {
            continue
          }

          try {
            stats.totalAttempted++
            await client.contact.delete(event.data.id)
            deleted++
            stats.totalSucceeded++
          } catch (e) {
            stats.totalFailed++
            stats.failures.push({
              type: 'contact',
              id: event.data.id,
              error: e.message,
            })
            error(`  failed to delete contact ${event.data.id}`, e)
          }
        }
      }
    }

    log(`${dryRun ? 'would delete' : 'deleted'} ${deleted} contacts`)
  } else {
    log('skipping contacts (--skip)')
  }

  // Secrets
  if (!skipSet.has('secrets')) {
    log(`${mode} deleting secrets...`)

    let deleted = 0

    for await (const batch of batchAsync(client.secret.list().stream(), 100)) {
      if (dryRun) {
        deleted += batch.filter((e) => e.type === 'item').length
      } else {
        for (const event of batch) {
          if (event.type !== 'item') {
            continue
          }

          try {
            stats.totalAttempted++
            await client.secret.delete(event.data.id)
            deleted++
            stats.totalSucceeded++
          } catch (e) {
            stats.totalFailed++
            stats.failures.push({
              type: 'secret',
              id: event.data.id,
              error: e.message,
            })
            error(`  failed to delete secret ${event.data.id}`, e)
          }
        }
      }
    }

    log(`${dryRun ? 'would delete' : 'deleted'} ${deleted} secrets`)
  } else {
    log('skipping secrets (--skip)')
  }

  // Portals
  if (!skipSet.has('portals')) {
    log(`${mode} deleting portals...`)

    let deleted = 0

    for await (const batch of batchAsync(client.portal.list().stream(), 100)) {
      if (dryRun) {
        deleted += batch.filter((e) => e.type === 'item').length
      } else {
        for (const event of batch) {
          if (event.type !== 'item') {
            continue
          }

          try {
            stats.totalAttempted++
            await client.portal.delete(event.data.id)
            deleted++
            stats.totalSucceeded++
          } catch (e) {
            stats.totalFailed++
            stats.failures.push({
              type: 'portal',
              id: event.data.id,
              error: e.message,
            })
            error(`  failed to delete portal ${event.data.id}`, e)
          }
        }
      }
    }

    log(`${dryRun ? 'would delete' : 'deleted'} ${deleted} portals`)
  } else {
    log('skipping portals (--skip)')
  }

  // Tasks
  if (!skipSet.has('tasks')) {
    log(`${mode} deleting tasks...`)

    let deleted = 0

    for await (const batch of batchAsync(client.task.list().stream(), 100)) {
      if (dryRun) {
        deleted += batch.filter((e) => e.type === 'item').length
      } else {
        for (const event of batch) {
          if (event.type !== 'item') {
            continue
          }

          try {
            stats.totalAttempted++
            await client.task.delete(event.data.id)
            deleted++
            stats.totalSucceeded++
          } catch (e) {
            stats.totalFailed++
            stats.failures.push({
              type: 'task',
              id: event.data.id,
              error: e.message,
            })
            error(`  failed to delete task ${event.data.id}`, e)
          }
        }
      }
    }

    log(`${dryRun ? 'would delete' : 'deleted'} ${deleted} tasks`)
  } else {
    log('skipping tasks (--skip)')
  }

  // Memories
  if (!skipSet.has('memories')) {
    log(`${mode} deleting memories...`)

    let deleted = 0

    for await (const batch of batchAsync(client.memory.list().stream(), 100)) {
      if (dryRun) {
        deleted += batch.filter((e) => e.type === 'item').length
      } else {
        for (const event of batch) {
          if (event.type !== 'item') {
            continue
          }

          try {
            stats.totalAttempted++
            await client.memory.delete(event.data.id)
            deleted++
            stats.totalSucceeded++
          } catch (e) {
            stats.totalFailed++
            stats.failures.push({
              type: 'memory',
              id: event.data.id,
              error: e.message,
            })
            error(`  failed to delete memory ${event.data.id}`, e)
          }
        }
      }
    }

    log(`${dryRun ? 'would delete' : 'deleted'} ${deleted} memories`)
  } else {
    log('skipping memories (--skip)')
  }

  // Policies
  if (!skipSet.has('policies')) {
    log(`${mode} deleting policies...`)

    let deleted = 0

    for await (const batch of batchAsync(client.policy.list().stream(), 100)) {
      if (dryRun) {
        deleted += batch.filter((e) => e.type === 'item').length
      } else {
        for (const event of batch) {
          if (event.type !== 'item') {
            continue
          }

          try {
            stats.totalAttempted++
            await client.policy.delete(event.data.id)
            deleted++
            stats.totalSucceeded++
          } catch (e) {
            stats.totalFailed++
            stats.failures.push({
              type: 'policy',
              id: event.data.id,
              error: e.message,
            })
            error(`  failed to delete policy ${event.data.id}`, e)
          }
        }
      }
    }

    log(`${dryRun ? 'would delete' : 'deleted'} ${deleted} policies`)
  } else {
    log('skipping policies (--skip)')
  }

  // Remaining resources without SDK support - use Prisma directly
  // @note these resource types don't have public APIs yet, so we access the database directly
  log(`${mode} deleting remaining resources without SDK support...`)
  {
    // Integrations
    if (!skipSet.has('integrations')) {
      log('  processing integrations...')

      const [
        extract,
        notion,
        sitemap,
        support,
        email,
        trigger,
        widget,
        slack,
        discord,
        teams,
        telegram,
        whatsapp,
        messenger,
        instagram,
        twilio,
        mcpserver,
      ] = await Promise.all([
        dryRun
          ? prisma.extractIntegration.count({
              where: { userId, blueprintId: null },
            })
          : prisma.extractIntegration.deleteMany({
              where: { userId, blueprintId: null },
            }),
        dryRun
          ? prisma.notionIntegration.count({
              where: { userId, blueprintId: null },
            })
          : prisma.notionIntegration.deleteMany({
              where: { userId, blueprintId: null },
            }),
        dryRun
          ? prisma.sitemapIntegration.count({
              where: { userId, blueprintId: null },
            })
          : prisma.sitemapIntegration.deleteMany({
              where: { userId, blueprintId: null },
            }),
        dryRun
          ? prisma.supportIntegration.count({
              where: { userId, blueprintId: null },
            })
          : prisma.supportIntegration.deleteMany({
              where: { userId, blueprintId: null },
            }),
        dryRun
          ? prisma.emailIntegration.count({
              where: { userId, blueprintId: null },
            })
          : prisma.emailIntegration.deleteMany({
              where: { userId, blueprintId: null },
            }),
        dryRun
          ? prisma.triggerIntegration.count({
              where: { userId, blueprintId: null },
            })
          : prisma.triggerIntegration.deleteMany({
              where: { userId, blueprintId: null },
            }),
        dryRun
          ? prisma.widgetIntegration.count({
              where: { userId, blueprintId: null },
            })
          : prisma.widgetIntegration.deleteMany({
              where: { userId, blueprintId: null },
            }),
        dryRun
          ? prisma.slackIntegration.count({
              where: { userId, blueprintId: null },
            })
          : prisma.slackIntegration.deleteMany({
              where: { userId, blueprintId: null },
            }),
        dryRun
          ? prisma.discordIntegration.count({
              where: { userId, blueprintId: null },
            })
          : prisma.discordIntegration.deleteMany({
              where: { userId, blueprintId: null },
            }),
        dryRun
          ? prisma.microsoftteamsIntegration.count({
              where: { userId, blueprintId: null },
            })
          : prisma.microsoftteamsIntegration.deleteMany({
              where: { userId, blueprintId: null },
            }),
        dryRun
          ? prisma.telegramIntegration.count({
              where: { userId, blueprintId: null },
            })
          : prisma.telegramIntegration.deleteMany({
              where: { userId, blueprintId: null },
            }),
        dryRun
          ? prisma.whatsappIntegration.count({
              where: { userId, blueprintId: null },
            })
          : prisma.whatsappIntegration.deleteMany({
              where: { userId, blueprintId: null },
            }),
        dryRun
          ? prisma.messengerIntegration.count({
              where: { userId, blueprintId: null },
            })
          : prisma.messengerIntegration.deleteMany({
              where: { userId, blueprintId: null },
            }),
        dryRun
          ? prisma.instagramIntegration.count({
              where: { userId, blueprintId: null },
            })
          : prisma.instagramIntegration.deleteMany({
              where: { userId, blueprintId: null },
            }),
        dryRun
          ? prisma.twilioIntegration.count({
              where: { userId, blueprintId: null },
            })
          : prisma.twilioIntegration.deleteMany({
              where: { userId, blueprintId: null },
            }),
        dryRun
          ? prisma.mcpserverIntegration.count({
              where: { userId, blueprintId: null },
            })
          : prisma.mcpserverIntegration.deleteMany({
              where: { userId, blueprintId: null },
            }),
      ])

      const results = {
        extract: dryRun ? extract : extract.count,
        notion: dryRun ? notion : notion.count,
        sitemap: dryRun ? sitemap : sitemap.count,
        support: dryRun ? support : support.count,
        email: dryRun ? email : email.count,
        trigger: dryRun ? trigger : trigger.count,
        widget: dryRun ? widget : widget.count,
        slack: dryRun ? slack : slack.count,
        discord: dryRun ? discord : discord.count,
        teams: dryRun ? teams : teams.count,
        telegram: dryRun ? telegram : telegram.count,
        whatsapp: dryRun ? whatsapp : whatsapp.count,
        messenger: dryRun ? messenger : messenger.count,
        instagram: dryRun ? instagram : instagram.count,
        twilio: dryRun ? twilio : twilio.count,
        mcpserver: dryRun ? mcpserver : mcpserver.count,
      }

      const totalIntegrations = Object.values(results).reduce(
        (a, b) => a + b,
        0
      )

      log(
        `  ${dryRun ? 'would delete' : 'deleted'} ${totalIntegrations} integrations`
      )
    } else {
      log('  skipping integrations (--skip)')
    }

    // Other resources without SDK support
    const operations = []

    // Values
    if (!skipSet.has('values')) {
      operations.push(
        dryRun
          ? prisma.secretValue.count({ where: { userId } })
          : prisma.secretValue.deleteMany({ where: { userId } })
      )
    } else {
      operations.push(dryRun ? 0 : Promise.resolve({ count: 0 }))
    }

    // Tokens
    if (!skipSet.has('tokens')) {
      operations.push(
        dryRun
          ? prisma.token.count({ where: { userId } })
          : prisma.token.deleteMany({ where: { userId } })
      )
    } else {
      operations.push(dryRun ? 0 : Promise.resolve({ count: 0 }))
    }

    // Webhooks
    if (!skipSet.has('webhooks')) {
      operations.push(
        dryRun
          ? prisma.webhook.count({ where: { userId } })
          : prisma.webhook.deleteMany({ where: { userId } })
      )
    } else {
      operations.push(dryRun ? 0 : Promise.resolve({ count: 0 }))
    }

    // OAuth Applications
    if (!skipSet.has('oauthApplications')) {
      operations.push(
        dryRun
          ? prisma.oAuthApplication.count({ where: { userId } })
          : prisma.oAuthApplication.deleteMany({ where: { userId } })
      )
    } else {
      operations.push(dryRun ? 0 : Promise.resolve({ count: 0 }))
    }

    // Ratings
    if (!skipSet.has('ratings')) {
      operations.push(
        dryRun
          ? prisma.rating.count({ where: { userId } })
          : prisma.rating.deleteMany({ where: { userId } })
      )
    } else {
      operations.push(dryRun ? 0 : Promise.resolve({ count: 0 }))
    }

    // Hub Pages
    if (!skipSet.has('hubPages')) {
      operations.push(
        dryRun
          ? prisma.hubBotPage.count({ where: { userId } })
          : prisma.hubBotPage.deleteMany({ where: { userId } }),
        dryRun
          ? prisma.hubDatasetPage.count({ where: { userId } })
          : prisma.hubDatasetPage.deleteMany({ where: { userId } }),
        dryRun
          ? prisma.hubSkillsetPage.count({ where: { userId } })
          : prisma.hubSkillsetPage.deleteMany({ where: { userId } }),
        dryRun
          ? prisma.hubBlueprintPage.count({ where: { userId } })
          : prisma.hubBlueprintPage.deleteMany({ where: { userId } }),
        dryRun
          ? prisma.hubWidgetPage.count({ where: { userId } })
          : prisma.hubWidgetPage.deleteMany({ where: { userId } })
      )
    } else {
      operations.push(
        dryRun ? 0 : Promise.resolve({ count: 0 }),
        dryRun ? 0 : Promise.resolve({ count: 0 }),
        dryRun ? 0 : Promise.resolve({ count: 0 }),
        dryRun ? 0 : Promise.resolve({ count: 0 }),
        dryRun ? 0 : Promise.resolve({ count: 0 })
      )
    }

    // Locks
    if (!skipSet.has('locks')) {
      operations.push(
        dryRun
          ? prisma.lock.count({ where: { userId } })
          : prisma.lock.deleteMany({ where: { userId } })
      )
    } else {
      operations.push(dryRun ? 0 : Promise.resolve({ count: 0 }))
    }

    const [
      values,
      tokens,
      webhooks,
      oauthApps,
      ratings,
      hubBotPages,
      hubDatasetPages,
      hubSkillsetPages,
      hubBlueprintPages,
      hubWidgetPages,
      locks,
    ] = await Promise.all(operations)

    const results = {
      values: dryRun ? values : values.count,
      tokens: dryRun ? tokens : tokens.count,
      webhooks: dryRun ? webhooks : webhooks.count,
      oauthApps: dryRun ? oauthApps : oauthApps.count,
      ratings: dryRun ? ratings : ratings.count,
      hubBotPages: dryRun ? hubBotPages : hubBotPages.count,
      hubDatasetPages: dryRun ? hubDatasetPages : hubDatasetPages.count,
      hubSkillsetPages: dryRun ? hubSkillsetPages : hubSkillsetPages.count,
      hubBlueprintPages: dryRun ? hubBlueprintPages : hubBlueprintPages.count,
      hubWidgetPages: dryRun ? hubWidgetPages : hubWidgetPages.count,
      locks: dryRun ? locks : locks.count,
    }

    const totalRemaining = Object.values(results).reduce((a, b) => a + b, 0)

    if (totalRemaining > 0) {
      log(
        `  ${dryRun ? 'would delete' : 'deleted'} ${totalRemaining} other resources`
      )
    }
  }

  // Print deletion statistics summary
  if (!dryRun && stats.totalAttempted > 0) {
    log('---')
    log('Deletion Summary:')
    log(`  Total attempted: ${stats.totalAttempted}`)
    log(`  Successfully deleted: ${stats.totalSucceeded}`)
    log(`  Failed: ${stats.totalFailed}`)

    if (stats.failures.length > 0) {
      log('---')
      log('Failed Deletions:')

      for (const failure of stats.failures) {
        log(`  - ${failure.type} ${failure.id}: ${failure.error}`)
      }
    }

    if (stats.totalFailed > 0) {
      log('---')
      log(
        `⚠️  Warning: ${stats.totalFailed} resources failed to delete. Review the errors above.`
      )
    }
  }

  log(
    dryRun
      ? 'dry run complete - no resources were actually deleted'
      : 'account nuked successfully'
  )
}
