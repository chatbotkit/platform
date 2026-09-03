// @ts-check
import { assert } from '@/lib/debug'

const DEFAULT_MAX_DEPTH = 2

const commonFields = {
  id: true,

  name: true,
  description: true,
}

// @todo derive from prisma

const botIntegrations = [
  'widget',
  'slack',
  'discord',
  'microsoftteams',
  'googlechat',
  'whatsapp',
  'messenger',
  'instagram',
  'telegram',
  'twilio',
  'email',
  'github',
  'trigger',
  'support',
  'extract',
  'avatar',
  'anam',
  'recall',
]

// @todo derive from prisma

const datasetIntegrations = ['sitemap', 'notion']

// @todo derive from prisma

const skillsetIntegrations = ['mcpserver', 'skillserver']

const fileIntegrations = []

const secretIntegrations = []

export function withBotResources(userId, options) {
  const depth = options?.depth ?? 0
  const maxDepth = options?.maxDepth ?? DEFAULT_MAX_DEPTH

  if (depth === maxDepth) {
    return {}
  }

  assert(userId, 'userId is required')

  return {
    dataset: {
      select: {
        ...commonFields,

        ...withDatasetResources(userId, {
          ...options,
          depth: depth + 1,
          maxDepth,
          skipBots: true,
        }),
      },
    },

    skillset: {
      select: {
        ...commonFields,

        ...withSkillsetResources(userId, {
          ...options,
          depth: depth + 1,
          maxDepth,
          skipBots: true,
        }),
      },
    },

    ...(options?.skipIntegrations
      ? {}
      : Object.fromEntries(
          botIntegrations.map((key) => {
            return [
              `${key}Integrations`,
              {
                select: {
                  ...commonFields,

                  ...withIntegrationResources(userId, key, {
                    ...options,
                    depth: depth + 1,
                    maxDepth,
                    skipBots: true,
                  }),
                },

                where: {
                  userId,
                },
              },
            ]
          })
        )),
  }
}

export function withDatasetResources(userId, options) {
  const depth = options?.depth ?? 0
  const maxDepth = options?.maxDepth ?? DEFAULT_MAX_DEPTH

  if (depth === maxDepth) {
    return {}
  }

  assert(userId, 'userId is required')

  return {
    ...(options?.skipBots
      ? {}
      : {
          bots: {
            select: {
              ...commonFields,

              ...withBotResources(userId, {
                ...options,
                depth: depth + 1,
                maxDepth,
                skipDatasets: true,
              }),
            },

            where: {
              userId,
            },
          },
        }),

    ...(options?.skipIntegrations
      ? {}
      : Object.fromEntries(
          datasetIntegrations.map((key) => {
            return [
              `${key}Integrations`,
              {
                select: {
                  ...commonFields,

                  ...withIntegrationResources(userId, key, {
                    ...options,
                    depth: depth + 1,
                    maxDepth,
                    skipDatasets: true,
                  }),

                  ...(['sitemap', 'notion'].includes(key)
                    ? {
                        syncStatus: true,
                        syncSchedule: true,
                        lastSyncedAt: true,
                      }
                    : null),
                },

                where: {
                  userId,
                },
              },
            ]
          })
        )),
  }
}

export function withSkillsetResources(userId, options) {
  const depth = options?.depth ?? 0
  const maxDepth = options?.maxDepth ?? DEFAULT_MAX_DEPTH

  if (depth === maxDepth) {
    return {}
  }

  assert(userId, 'userId is required')

  return {
    ...(options?.skipBots
      ? {}
      : {
          bots: {
            select: {
              ...commonFields,

              ...withBotResources(userId, {
                ...options,
                depth: depth + 1,
                maxDepth,
                skipSkillsets: true,
              }),
            },

            where: {
              userId,
            },
          },
        }),

    ...(options?.skipIntegrations
      ? {}
      : Object.fromEntries(
          skillsetIntegrations.map((key) => {
            return [
              `${key}Integrations`,
              {
                select: {
                  ...commonFields,

                  ...withIntegrationResources(userId, key, {
                    ...options,
                    depth: depth + 1,
                    maxDepth,
                    skipSkillsets: true,
                  }),
                },

                where: {
                  userId,
                },
              },
            ]
          })
        )),
  }
}

export function withFileResources(userId, options) {
  const depth = options?.depth ?? 0
  const maxDepth = options?.maxDepth ?? DEFAULT_MAX_DEPTH

  if (depth === maxDepth) {
    return {}
  }

  assert(userId, 'userId is required')

  return {
    ...(options?.skipDatasets
      ? {}
      : {
          datasets: {
            select: {
              dataset: {
                select: {
                  ...commonFields,

                  ...withDatasetResources(userId, {
                    ...options,
                    depth: depth + 1,
                    maxDepth,
                    skipDatasets: true,
                  }),
                },
              },
            },
          },
        }),

    ...(options?.skipIntegrations
      ? {}
      : Object.fromEntries(
          fileIntegrations.map((key) => {
            return [
              `${key}Integrations`,
              {
                select: {
                  ...commonFields,

                  ...withIntegrationResources(userId, key, {
                    ...options,
                    depth: depth + 1,
                    maxDepth,
                    skipDatasets: true,
                  }),
                },

                where: {
                  userId,
                },
              },
            ]
          })
        )),
  }
}

export function withSecretResources(userId, options) {
  const depth = options?.depth ?? 0
  const maxDepth = options?.maxDepth ?? DEFAULT_MAX_DEPTH

  if (depth === maxDepth) {
    return {}
  }

  assert(userId, 'userId is required')

  return {
    ...(options?.skipIntegrations
      ? {}
      : Object.fromEntries(
          secretIntegrations.map((key) => {
            return [
              `${key}Integrations`,
              {
                select: {
                  ...commonFields,

                  ...withIntegrationResources(userId, key, {
                    ...options,
                    depth: depth + 1,
                    maxDepth,
                    skipDatasets: true,
                  }),
                },

                where: {
                  userId,
                },
              },
            ]
          })
        )),
  }
}

export function withIntegrationResources(userId, type, options) {
  const depth = options?.depth ?? 0
  const maxDepth = options?.maxDepth ?? DEFAULT_MAX_DEPTH

  if (depth === maxDepth) {
    return {}
  }

  if (options?.skipIntegrations) {
    return {}
  }

  assert(userId, 'userId is required')

  switch (type) {
    case 'widget': {
      return withWidgetIntegrationResources(userId, {
        ...options,
        depth: depth + 1,
        maxDepth,
        withIntegrations: true,
      })
    }

    case 'slack': {
      return withSlackIntegrationResources(userId, {
        ...options,
        depth: depth + 1,
        maxDepth,
        withIntegrations: true,
      })
    }

    case 'discord': {
      return withDiscordIntegrationResources(userId, {
        ...options,
        depth: depth + 1,
        maxDepth,
        withIntegrations: true,
      })
    }

    case 'microsoftteams': {
      return withMicrosoftteamsIntegrationResources(userId, {
        ...options,
        depth: depth + 1,
        maxDepth,
        withIntegrations: true,
      })
    }

    case 'googlechat': {
      return withGooglechatIntegrationResources(userId, {
        ...options,
        depth: depth + 1,
        maxDepth,
        withIntegrations: true,
      })
    }

    case 'whatsapp': {
      return withWhatsappIntegrationResources(userId, {
        ...options,
        depth: depth + 1,
        maxDepth,
        withIntegrations: true,
      })
    }

    case 'messenger': {
      return withMessengerIntegrationResources(userId, {
        ...options,
        depth: depth + 1,
        maxDepth,
        withIntegrations: true,
      })
    }

    case 'instagram': {
      return withInstagramIntegrationResources(userId, {
        ...options,
        depth: depth + 1,
        maxDepth,
        withIntegrations: true,
      })
    }

    case 'telegram': {
      return withTelegramIntegrationResources(userId, {
        ...options,
        depth: depth + 1,
        maxDepth,
        withIntegrations: true,
      })
    }

    case 'email': {
      return withEmailIntegrationResources(userId, {
        ...options,
        depth: depth + 1,
        maxDepth,
        withIntegrations: true,
      })
    }

    case 'trigger': {
      return withTriggerIntegrationResources(userId, {
        ...options,
        depth: depth + 1,
        maxDepth,
        withIntegrations: true,
      })
    }

    case 'support': {
      return withSupportIntegrationResources(userId, {
        ...options,
        depth: depth + 1,
        maxDepth,
        withIntegrations: true,
      })
    }

    case 'extract': {
      return withExtractIntegrationResources(userId, {
        ...options,
        depth: depth + 1,
        maxDepth,
        withIntegrations: true,
      })
    }

    case 'sitemap': {
      return withSitemapIntegrationResources(userId, {
        ...options,
        depth: depth + 1,
        maxDepth,
        withIntegrations: true,
      })
    }

    case 'notion': {
      return withNotionIntegrationResources(userId, {
        ...options,
        depth: depth + 1,
        maxDepth,
        withIntegrations: true,
      })
    }

    default: {
      return {}
    }
  }
}

export function withWidgetIntegrationResources(userId, options) {
  const depth = options?.depth ?? 0
  const maxDepth = options?.maxDepth ?? DEFAULT_MAX_DEPTH

  if (depth === maxDepth) {
    return {}
  }

  if (options?.skipWidgetIntegration) {
    return {}
  }

  assert(userId, 'userId is required')

  return {
    bot: {
      select: {
        ...commonFields,

        ...withBotResources(userId, {
          ...options,
          depth: depth + 1,
          maxDepth,
          skipWidgetIntegration: true,
        }),
      },

      // cannot use where on a single resource
    },
  }
}

export function withSlackIntegrationResources(userId, options) {
  const depth = options?.depth ?? 0
  const maxDepth = options?.maxDepth ?? DEFAULT_MAX_DEPTH

  if (depth === maxDepth) {
    return {}
  }

  if (options?.skipSlackIntegration) {
    return {}
  }

  assert(userId, 'userId is required')

  return {}
}

export function withDiscordIntegrationResources(userId, options) {
  const depth = options?.depth ?? 0
  const maxDepth = options?.maxDepth ?? DEFAULT_MAX_DEPTH

  if (depth === maxDepth) {
    return {}
  }

  if (options?.skipDiscordIntegration) {
    return {}
  }

  assert(userId, 'userId is required')

  return {}
}

export function withMicrosoftteamsIntegrationResources(userId, options) {
  const depth = options?.depth ?? 0
  const maxDepth = options?.maxDepth ?? DEFAULT_MAX_DEPTH

  if (depth === maxDepth) {
    return {}
  }

  if (options?.skipMicrosoftteamsIntegration) {
    return {}
  }

  assert(userId, 'userId is required')

  return {}
}

export function withGooglechatIntegrationResources(userId, options) {
  const depth = options?.depth ?? 0
  const maxDepth = options?.maxDepth ?? DEFAULT_MAX_DEPTH

  if (depth === maxDepth) {
    return {}
  }

  if (options?.skipGooglechatIntegration) {
    return {}
  }

  assert(userId, 'userId is required')

  return {}
}

export function withWhatsappIntegrationResources(userId, options) {
  const depth = options?.depth ?? 0
  const maxDepth = options?.maxDepth ?? DEFAULT_MAX_DEPTH

  if (depth === maxDepth) {
    return {}
  }

  if (options?.skipWhatsappIntegration) {
    return {}
  }

  assert(userId, 'userId is required')

  return {}
}

export function withMessengerIntegrationResources(userId, options) {
  const depth = options?.depth ?? 0
  const maxDepth = options?.maxDepth ?? DEFAULT_MAX_DEPTH

  if (depth === maxDepth) {
    return {}
  }

  if (options?.skipMessengerIntegration) {
    return {}
  }

  assert(userId, 'userId is required')

  return {}
}

export function withInstagramIntegrationResources(userId, options) {
  const depth = options?.depth ?? 0
  const maxDepth = options?.maxDepth ?? DEFAULT_MAX_DEPTH

  if (depth === maxDepth) {
    return {}
  }

  if (options?.skipInstagramIntegration) {
    return {}
  }

  assert(userId, 'userId is required')

  return {}
}

export function withTelegramIntegrationResources(userId, options) {
  const depth = options?.depth ?? 0
  const maxDepth = options?.maxDepth ?? DEFAULT_MAX_DEPTH

  if (depth === maxDepth) {
    return {}
  }

  if (options?.skipTelegramIntegration) {
    return {}
  }

  assert(userId, 'userId is required')

  return {}
}

export function withEmailIntegrationResources(userId, options) {
  const depth = options?.depth ?? 0
  const maxDepth = options?.maxDepth ?? DEFAULT_MAX_DEPTH

  if (depth === maxDepth) {
    return {}
  }

  if (options?.skipEmailIntegration) {
    return {}
  }

  assert(userId, 'userId is required')

  return {}
}

export function withTriggerIntegrationResources(userId, options) {
  const depth = options?.depth ?? 0
  const maxDepth = options?.maxDepth ?? DEFAULT_MAX_DEPTH

  if (depth === maxDepth) {
    return {}
  }

  if (options?.skipTriggerIntegration) {
    return {}
  }

  assert(userId, 'userId is required')

  return {}
}

export function withSupportIntegrationResources(userId, options) {
  const depth = options?.depth ?? 0
  const maxDepth = options?.maxDepth ?? DEFAULT_MAX_DEPTH

  if (depth === maxDepth) {
    return {}
  }

  if (options?.skipSupportIntegration) {
    return {}
  }

  assert(userId, 'userId is required')

  return {}
}

export function withExtractIntegrationResources(userId, options) {
  const depth = options?.depth ?? 0
  const maxDepth = options?.maxDepth ?? DEFAULT_MAX_DEPTH

  if (depth === maxDepth) {
    return {}
  }

  if (options?.skipExtractIntegration) {
    return {}
  }

  assert(userId, 'userId is required')

  return {}
}

export function withSitemapIntegrationResources(userId, options) {
  const depth = options?.depth ?? 0
  const maxDepth = options?.maxDepth ?? DEFAULT_MAX_DEPTH

  if (depth === maxDepth) {
    return {}
  }

  if (options?.skipSitemapIntegration) {
    return {}
  }

  assert(userId, 'userId is required')

  return {
    dataset: {
      select: {
        ...commonFields,

        ...withDatasetResources(userId, {
          ...options,
          depth: depth + 1,
          maxDepth,
          skipSitemapIntegration: true,
        }),
      },

      // cannot use where on a single resource
    },
  }
}

export function withNotionIntegrationResources(userId, options) {
  const depth = options?.depth ?? 0
  const maxDepth = options?.maxDepth ?? DEFAULT_MAX_DEPTH

  if (depth === maxDepth) {
    return {}
  }

  if (options?.skipNotionIntegration) {
    return {}
  }

  assert(userId, 'userId is required')

  return {
    dataset: {
      select: {
        ...commonFields,

        ...withDatasetResources(userId, {
          ...options,
          depth: depth + 1,
          maxDepth,
          skipNotionIntegration: true,
        }),
      },

      // cannot use where on a single resource
    },
  }
}

export function withBlueprintResources(userId, options) {
  const depth = options?.depth ?? 0
  const maxDepth = options?.maxDepth ?? DEFAULT_MAX_DEPTH

  if (depth === maxDepth) {
    return {}
  }

  if (options?.skipBlueprint) {
    return {}
  }

  assert(userId, 'userId is required')

  return {}
}
