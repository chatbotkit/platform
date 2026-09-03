import prisma from '@/prisma/client'

import { blueprintSchema as CloneableAbilityType } from '@/schemas/api/v1/ability'
import { blueprintSchema as CloneableAnamIntegrationType } from '@/schemas/api/v1/anamIntegration'
import { blueprintSchema as CloneableAvatarIntegrationType } from '@/schemas/api/v1/avatarIntegration'
import { blueprintSchema as CloneableBotType } from '@/schemas/api/v1/bot'
import { blueprintSchema as CloneableDatasetType } from '@/schemas/api/v1/dataset'
import { blueprintSchema as CloneableDiscordIntegrationType } from '@/schemas/api/v1/discordIntegration'
import { blueprintSchema as CloneableEmailIntegrationType } from '@/schemas/api/v1/emailIntegration'
import { blueprintSchema as CloneableExtractIntegrationType } from '@/schemas/api/v1/extractIntegration'
import { blueprintSchema as CloneableFileType } from '@/schemas/api/v1/file'
import { blueprintSchema as CloneableGithubIntegrationType } from '@/schemas/api/v1/githubIntegration'
import { blueprintSchema as CloneableGooglechatIntegrationType } from '@/schemas/api/v1/googlechatIntegration'
import { blueprintSchema as CloneableInstagramIntegrationType } from '@/schemas/api/v1/instagramIntegration'
import { blueprintSchema as CloneableMcpserverIntegrationType } from '@/schemas/api/v1/mcpserverIntegration'
import { blueprintSchema as CloneableMessengerIntegrationType } from '@/schemas/api/v1/messengerIntegration'
import { blueprintSchema as CloneableMicrosoftteamsIntegrationType } from '@/schemas/api/v1/microsoftteamsIntegration'
import { blueprintSchema as CloneableNotionIntegrationType } from '@/schemas/api/v1/notionIntegration'
import { blueprintSchema as CloneableOAuthConnectionType } from '@/schemas/api/v1/oAuthConnection'
import { blueprintSchema as CloneablePolicyType } from '@/schemas/api/v1/policy'
import { blueprintSchema as CloneablePortalType } from '@/schemas/api/v1/portal'
import { blueprintSchema as CloneableRecallIntegrationType } from '@/schemas/api/v1/recallIntegration'
import { blueprintSchema as CloneableSecretType } from '@/schemas/api/v1/secret'
import { blueprintSchema as CloneableSitemapIntegrationType } from '@/schemas/api/v1/sitemapIntegration'
import { blueprintSchema as CloneableSkillserverIntegrationType } from '@/schemas/api/v1/skillserverIntegration'
import { blueprintSchema as CloneableSkillsetType } from '@/schemas/api/v1/skillset'
import { blueprintSchema as CloneableSlackIntegrationType } from '@/schemas/api/v1/slackIntegration'
import { blueprintSchema as CloneableSpaceType } from '@/schemas/api/v1/space'
import { blueprintSchema as CloneableSupportIntegrationType } from '@/schemas/api/v1/supportIntegration'
import { blueprintSchema as CloneableTaskType } from '@/schemas/api/v1/task'
import { blueprintSchema as CloneableTelegramIntegrationType } from '@/schemas/api/v1/telegramIntegration'
import { blueprintSchema as CloneableTriggerIntegrationType } from '@/schemas/api/v1/triggerIntegration'
import { blueprintSchema as CloneableTwilioIntegrationType } from '@/schemas/api/v1/twilioIntegration'
import { blueprintSchema as CloneableWhatsappIntegrationType } from '@/schemas/api/v1/whatsappIntegration'
import { cloneableBlueprintSchema as CloneableWidgetIntegrationType } from '@/schemas/api/v1/widgetIntegration'

import { z } from 'zod'

type ZodObjectShape = Record<string, z.ZodTypeAny>

interface SelectObject<T extends ZodObjectShape> {
  select: {
    [K in keyof T]: true
  }
}

// @note each resource selects its `blueprintSchema` - the upsert field set minus
// `blueprintId` and any field that must NOT round-trip into a clone: runtime
// state (notion/sitemap `syncStatus`/`lastSyncedAt`), the mcpserver `accessToken`
// credential, and dataset tuning params. Widget is the deliberate exception: its
// presentation/UI config should survive a clone, so it exposes a dedicated
// `cloneableBlueprintSchema` that keeps those fields. A blanket "upsert variant"
// select would wrongly clone runtime/credential state, so each schema owns what
// it exposes here.

/**
 * Creates a Prisma select object from a Zod schema.
 */
export function getSelectForType<T extends z.ZodObject<ZodObjectShape>>(
  type: T
): SelectObject<T['shape']> {
  return {
    select: Object.fromEntries(
      Object.keys(type.shape).map((key) => [key, true])
    ) as { [K in keyof T['shape']]: true },
  }
}

/**
 * Builds the cloneable-resource select for one relation: the resource's
 * cloneable field set plus its `id` (which the cloneable schemas omit). Keeps
 * the per-relation `include` entries below to a single typed call each while
 * preserving Prisma's precise return-type inference.
 */
function cloneableSelect<T extends ZodObjectShape>(type: z.ZodObject<T>) {
  return getSelectForType(type.extend({ id: z.string() }))
}

/**
 * Fetches a blueprint and all its cloneable resources.
 */
export async function getBlueprintAndCloneableResources(blueprintId: string) {
  const blueprint = await prisma.blueprint.findUnique({
    where: {
      id: blueprintId,
    },

    include: {
      hubBlueprintPage: true,

      // resources
      bots: cloneableSelect(CloneableBotType),
      datasets: cloneableSelect(CloneableDatasetType),
      skillsets: cloneableSelect(CloneableSkillsetType),
      abilities: cloneableSelect(CloneableAbilityType),
      secrets: cloneableSelect(CloneableSecretType),
      files: cloneableSelect(CloneableFileType),
      portals: cloneableSelect(CloneablePortalType),

      // objects
      spaces: cloneableSelect(CloneableSpaceType),
      tasks: cloneableSelect(CloneableTaskType),

      // compliance
      policies: cloneableSelect(CloneablePolicyType),

      // oauth
      oAuthConnections: cloneableSelect(CloneableOAuthConnectionType),

      // integrations
      extractIntegrations: cloneableSelect(CloneableExtractIntegrationType),
      notionIntegrations: cloneableSelect(CloneableNotionIntegrationType),
      sitemapIntegrations: cloneableSelect(CloneableSitemapIntegrationType),
      supportIntegrations: cloneableSelect(CloneableSupportIntegrationType),
      emailIntegrations: cloneableSelect(CloneableEmailIntegrationType),
      triggerIntegrations: cloneableSelect(CloneableTriggerIntegrationType),
      widgetIntegrations: cloneableSelect(CloneableWidgetIntegrationType),
      slackIntegrations: cloneableSelect(CloneableSlackIntegrationType),
      githubIntegrations: cloneableSelect(CloneableGithubIntegrationType),
      discordIntegrations: cloneableSelect(CloneableDiscordIntegrationType),
      microsoftteamsIntegrations: cloneableSelect(
        CloneableMicrosoftteamsIntegrationType
      ),
      googlechatIntegrations: cloneableSelect(
        CloneableGooglechatIntegrationType
      ),
      telegramIntegrations: cloneableSelect(CloneableTelegramIntegrationType),
      whatsappIntegrations: cloneableSelect(CloneableWhatsappIntegrationType),
      messengerIntegrations: cloneableSelect(CloneableMessengerIntegrationType),
      instagramIntegrations: cloneableSelect(CloneableInstagramIntegrationType),
      twilioIntegrations: cloneableSelect(CloneableTwilioIntegrationType),
      avatarIntegrations: cloneableSelect(CloneableAvatarIntegrationType),
      anamIntegrations: cloneableSelect(CloneableAnamIntegrationType),
      recallIntegrations: cloneableSelect(CloneableRecallIntegrationType),
      mcpserverIntegrations: cloneableSelect(CloneableMcpserverIntegrationType),
      skillserverIntegrations: cloneableSelect(
        CloneableSkillserverIntegrationType
      ),
    },
  })

  if (!blueprint) {
    return null
  }

  const resources = {
    bot: blueprint.bots,
    dataset: blueprint.datasets,
    skillset: blueprint.skillsets,
    ability: blueprint.abilities,
    secret: blueprint.secrets,
    file: blueprint.files,
    portals: blueprint.portals,
  }

  const objects = {
    space: blueprint.spaces,
    task: blueprint.tasks,
  }

  const compliance = {
    policy: blueprint.policies,
  }

  const oauth = {
    oAuthConnection: blueprint.oAuthConnections,
  }

  const integrations = {
    extract: blueprint.extractIntegrations,
    notion: blueprint.notionIntegrations,
    sitemap: blueprint.sitemapIntegrations,
    support: blueprint.supportIntegrations,
    email: blueprint.emailIntegrations,
    trigger: blueprint.triggerIntegrations,
    widget: blueprint.widgetIntegrations,
    slack: blueprint.slackIntegrations,
    github: blueprint.githubIntegrations,
    discord: blueprint.discordIntegrations,
    microsoftteams: blueprint.microsoftteamsIntegrations,
    googlechat: blueprint.googlechatIntegrations,
    telegram: blueprint.telegramIntegrations,
    whatsapp: blueprint.whatsappIntegrations,
    messenger: blueprint.messengerIntegrations,
    instagram: blueprint.instagramIntegrations,
    twilio: blueprint.twilioIntegrations,
    avatar: blueprint.avatarIntegrations,
    anam: blueprint.anamIntegrations,
    recall: blueprint.recallIntegrations,
    mcpserver: blueprint.mcpserverIntegrations,
    skillserver: blueprint.skillserverIntegrations,
  }

  return {
    blueprint,
    resources: {
      basic: resources,
      object: objects,
      compliance: compliance,
      oauth: oauth,
      integration: integrations,
    },
  }
}
