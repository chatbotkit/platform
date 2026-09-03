import {
  Fragment,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useSyncExternalStore,
} from 'react'

import { isProduction } from '@/lib/env'
import { toPascalCase } from '@/lib/string'

import Component from '@/components/Component'
import { useConfirm } from '@/components/Confirm'
import CopyButton from '@/components/CopyButton'
import FOC from '@/components/FOC'
import Portal from '@/components/Portal'

import useDashboardWidgetSend from '@/hooks/useDashboardWidgetSend'
import { usePortalApex } from '@/hooks/useHostname'
import useTeamSwitch from '@/hooks/useTeamSwitch'
import useUserSwitch from '@/hooks/useUserSwitch'

import clsx from 'clsx'

export const DEFAULT_LEVEL = Infinity

const thisSolutionSingleton = (() => {
  let ids = []

  const listeners = new Set()

  function emit() {
    for (const listener of listeners) {
      listener()
    }
  }

  return {
    getSnapshot() {
      return ids.join('|')
    },

    register(id) {
      if (!ids.includes(id)) {
        ids = [...ids, id]

        emit()
      }

      return () => {
        if (!ids.includes(id)) {
          return
        }

        ids = ids.filter((candidate) => candidate !== id)

        emit()
      }
    },

    subscribe(listener) {
      listeners.add(listener)

      return () => {
        listeners.delete(listener)
      }
    },
  }
})()

function useThisSolutionSingleton() {
  const id = useId()

  const snapshot = useSyncExternalStore(
    thisSolutionSingleton.subscribe,
    thisSolutionSingleton.getSnapshot,
    () => ''
  )

  useEffect(() => {
    return thisSolutionSingleton.register(id)
  }, [id])

  return snapshot.split('|')[0] === id
}

const typeToIconMap = {
  blueprint: 'heroicons/map',
  bot: 'heroicons/calculator',
  dataset: 'heroicons/circle-stack',
  skillset: 'heroicons/cube-transparent',
  default: 'heroicons/puzzle-piece',
}

const typeToIndexMap = {
  blueprint: 0,
  bot: 1,
  dataset: 2,
  skillset: 3,
  file: 5,
  secret: 6,

  widget: 10,
  slack: 11,
  discord: 12,
  microsoftteams: 13,
  googlechat: 14,
  whatsapp: 15,
  messenger: 16,
  instagram: 17,
  telegram: 18,
  twilio: 19,
  email: 20,
  trigger: 21,
  sitemap: 22,
  notion: 23,
  support: 24,
  extract: 25,
  mcpserver: 26,
  anam: 27,
  avatar: 28,
  recall: 29,
  skillserver: 30,

  default: 100,
}

export function expandSolutions(instance, level = DEFAULT_LEVEL) {
  return level === 0
    ? []
    : [
        ...(instance.bot ? expandBot(instance.bot, level - 1) : []),
        ...(instance.bots ? expandBots(instance.bots, level - 1) : []),

        ...(instance.dataset ? expandDataset(instance.dataset, level - 1) : []),
        ...(instance.datasets
          ? expandDatasets(instance.datasets, level - 1)
          : []),

        ...(instance.skillset
          ? expandSkillset(instance.skillset, level - 1)
          : []),
        ...(instance.skillsets
          ? expandSkillsets(instance.skillsets, level - 1)
          : []),

        ...(instance.blueprintId
          ? [
              {
                title: 'Blueprint',
                link: `/blueprints/${instance.blueprintId}/designer`,
                icon: typeToIconMap.blueprint,
                index: typeToIndexMap.blueprint,
              },
            ]
          : []),

        ...(instance.botId
          ? [
              {
                title: 'Bot',
                link: `/bots/${instance.botId}`,
                icon: typeToIconMap.bot,
                index: typeToIndexMap.bot,
              },
            ]
          : []),

        ...(instance.datasetId
          ? [
              {
                title: 'Dataset',
                link: `/datasets/${instance.datasetId}`,
                icon: typeToIconMap.dataset,
                index: typeToIndexMap.dataset,
              },
            ]
          : []),
        ...(instance.skillsetId
          ? [
              {
                title: 'Skillset',
                link: `/skillsets/${instance.skillsetId}`,
                icon: typeToIconMap.skillset,
                index: typeToIndexMap.skillset,
              },
            ]
          : []),

        ...expandIntegrations(instance, level - 1),
      ]
}

export function expandBot(instance, level = DEFAULT_LEVEL) {
  return level === 0
    ? []
    : [
        {
          title: 'Bot',
          link: `/bots/${instance.id}`,
          icon: typeToIconMap.bot,
          index: typeToIndexMap.bot,
        },

        ...expandSolutions(instance, level - 1),
      ]
}

export function expandBots(instance, level = DEFAULT_LEVEL) {
  return level === 0
    ? []
    : instance.flatMap((bot) => {
        return [
          {
            title: 'Bot',
            link: `/bots/${bot.id}`,
            icon: typeToIconMap.bot,
            index: typeToIndexMap.bot,
          },

          ...expandSolutions(bot, level - 1),
        ]
      })
}

export function expandDataset(instance, level = DEFAULT_LEVEL) {
  return level === 0 || !instance?.id
    ? []
    : [
        {
          title: 'Dataset',
          link: `/datasets/${instance.id}`,
          icon: typeToIconMap.dataset,
          index: typeToIndexMap.dataset,
        },

        ...expandSolutions(instance, level - 1),
      ]
}

export function expandDatasets(instance, level = DEFAULT_LEVEL) {
  return level === 0
    ? []
    : instance.flatMap((dataset) => {
        return [
          ...(instance.id
            ? [
                {
                  title: 'Dataset',
                  link: `/datasets/${dataset.id}`,
                  icon: typeToIconMap.dataset,
                  index: typeToIndexMap.dataset,
                },
              ]
            : []),

          ...expandSolutions(dataset, level - 1),
        ]
      })
}

export function expandSkillset(instance, level = DEFAULT_LEVEL) {
  return level === 0 || !instance?.id
    ? []
    : [
        {
          title: 'Skillset',
          link: `/skillsets/${instance.id}`,
          icon: typeToIconMap.skillset,
          index: typeToIndexMap.skillset,
        },

        // @todo expand the secrets

        ...expandSolutions(instance, level - 1),
      ]
}

export function expandSkillsets(instance, level = DEFAULT_LEVEL) {
  return level === 0
    ? []
    : instance.flatMap((skillset) => {
        return [
          ...(instance.id
            ? [
                {
                  title: 'Skillset',
                  link: `/skillsets/${skillset.id}`,
                  icon: typeToIconMap.skillset,
                  index: typeToIndexMap.skillset,
                },
              ]
            : []),

          ...expandSolutions(skillset, level - 1),
        ]
      })
}

export function expandIntegrations(instance, level = DEFAULT_LEVEL) {
  return level === 0 || !instance.id
    ? []
    : Object.keys(instance)
        .filter((k) => k.endsWith('Integrations'))
        .filter((k) => instance[k].length > 0)
        .flatMap((key) => {
          const type = key.replace(/Integrations$/, '')

          return instance[key].flatMap((integration) => {
            const name = toPascalCase(type)

            return [
              {
                title: name,
                link: `/integrations/${type}/${integration.id}`,
                icon: typeToIconMap[type] ?? typeToIconMap.default,
                index: typeToIndexMap[type] ?? typeToIndexMap.default,
              },

              ...expandSolutions(integration, level - 1),
            ]
          })
        })
}

export default function ThisSolution({
  type,

  instance,

  level = DEFAULT_LEVEL,

  updateKey,

  portal,

  className,

  children,

  ...props
}) {
  const portalApex = usePortalApex()

  const singleton = useThisSolutionSingleton()

  const href = function (href, search = {}) {
    const url = new URL(href, 'https://localhost')

    for (const key in search) {
      if (!search[key]) {
        continue
      }

      url.searchParams.set(key, search[key])
    }

    return url.pathname + url.search
  }

  const toName = useCallback((name) => {
    return (
      {
        // @todo add name mappings that cannot be derived from the type
      }[name] || name
    )
  }, [])

  const items = useMemo(() => {
    updateKey // we use updateKey to force a re-render when the key changes

    const seenItems = []

    const hasBlueprint = () => {
      return seenItems.some(
        (item) =>
          item.index === typeToIndexMap.blueprint ||
          item.link?.includes('/blueprints/')
      )
    }

    return [
      {
        title: 'This Solution',
        items: [
          ...(type
            ? [
                {
                  title: toName(
                    toPascalCase(type.replace(/^integrations\//, ''))
                  ),
                  link: instance.id
                    ? `/${type.includes('/') ? type : type + 's'}/${
                        instance.id
                      }`
                    : undefined,
                  icon: typeToIconMap[type] ?? typeToIconMap.default,
                  index: typeToIndexMap[type] ?? typeToIndexMap.default,
                },
              ]
            : []),

          // ---

          ...expandSolutions(instance, level),
        ]
          .filter((item, index, self) => {
            seenItems.push(item)

            return index === self.findIndex((i) => i.link === item.link)
          })
          .sort((a, b) => a.index - b.index),

        folder: true,
        expanded: true,
      },

      // ---

      ...(instance.id &&
      !['blueprint', 'conversation', 'contact', 'portal/user', 'task'].includes(
        type
      ) &&
      !hasBlueprint()
        ? [
            {
              icon: typeToIconMap.blueprint,
              title: 'Add to Blueprint',
              link: '/blueprints',
            },
          ]
        : []),

      // ---

      ...(![
        'file',
        'secret',
        'blueprint',
        'portal',
        'conversation',
        'contact',
        'portal/user',
      ].includes(type) &&
      !seenItems.some(
        (item) =>
          item.link?.includes('bots') || item.index === typeToIndexMap.bot
      )
        ? [
            {
              icon: typeToIconMap.bot,
              title: 'Add Bot',
              link: `/bots/new`,
            },
          ]
        : []),

      // ---

      ...((instance.id || instance.botId) &&
      ![
        'file',
        'secret',
        'blueprint',
        'portal',
        'conversation',
        'contact',
        'portal/user',
      ].includes(type) &&
      !seenItems.some(
        (item) =>
          item.link?.includes('datasets') ||
          item.index === typeToIndexMap.dataset
      )
        ? [
            {
              icon: typeToIconMap.dataset,
              title: 'Add Dataset',
              link: href(`/datasets/new`, {
                botId: type === 'bot' ? instance.id : instance.botId,
              }),
            },
          ]
        : []),

      // ---

      ...((instance.id || instance.botId) &&
      ![
        'file',
        'secret',
        'blueprint',
        'portal',
        'conversation',
        'contact',
        'portal/user',
      ].includes(type) &&
      !seenItems.some(
        (item) =>
          item.link?.includes('skillsets') ||
          item.index === typeToIndexMap.skillset
      )
        ? [
            {
              icon: typeToIconMap.skillset,
              title: 'Add Skillset',
              link: href(`/skillsets/new`, {
                botId: type === 'bot' ? instance.id : instance.botId,
              }),
            },
          ]
        : []),

      // ---

      ...(instance.id && type === 'contact'
        ? [
            {
              icon: 'heroicons/check-circle',
              title: 'Tasks',
              link: `/tasks?contactId=${instance.id}`,
            },
            {
              icon: 'heroicons/chat-bubble-left-ellipsis',
              title: 'Conversations',
              link: `/conversations?contactId=${instance.id}`,
            },
            {
              icon: 'heroicons/hand-thumb-up',
              title: 'Ratings',
              link: `/ratings?contactId=${instance.id}`,
            },
            {
              icon: 'heroicons/photo',
              title: 'Memories',
              link: `/memories?contactId=${instance.id}`,
            },
            ...(!isProduction
              ? [
                  {
                    icon: 'heroicons/users',
                    title: 'Spaces',
                    link: `/spaces?contactId=${instance.id}`,
                  },
                ]
              : []),
          ]
        : []),

      // ---

      ...(instance.id && type === 'bot'
        ? [
            ...(!seenItems.some((item) =>
              item.link?.includes('integrations/widget')
            )
              ? [
                  {
                    icon: typeToIconMap.default,
                    title: 'Add Widget',
                    link: href(`/integrations/widget/new`, {
                      botId: type === 'bot' ? instance.id : instance.botId,
                    }),
                  },
                ]
              : []),

            {
              icon: 'heroicons/chat-bubble-left-ellipsis',
              title: 'Conversations',
              link: `/conversations?botId=${instance.id}`,
            },
          ]
        : []),

      // ---

      ...(instance.id && type === 'task'
        ? [
            {
              icon: 'heroicons/chat-bubble-left-ellipsis',
              title: 'Conversations',
              link: `/conversations?taskId=${instance.id}`,
            },
            ...(instance.contactId
              ? [
                  {
                    icon: 'heroicons/user',
                    title: 'Contact',
                    link: `/contacts/${instance.contactId}`,
                  },
                ]
              : []),
          ]
        : []),

      // ---

      ...(instance.id && type === 'portal'
        ? [
            {
              icon: 'heroicons/link',
              title: 'Open Portal',
              link: `https://${instance.slug}.${portalApex}`,
              target: '_blank',
            },
          ]
        : []),

      // ---

      ...(instance.id && type === 'integrations/widget'
        ? [
            {
              icon: 'heroicons/chat-bubble-left-ellipsis',
              title: 'Conversations',
              link: `/conversations?widgetIntegrationId=${instance.id}`,
            },
          ]
        : []),

      ...(instance.id && type === 'integrations/slack'
        ? [
            {
              icon: 'heroicons/chat-bubble-left-ellipsis',
              title: 'Conversations',
              link: `/conversations?slackIntegrationId=${instance.id}`,
            },
          ]
        : []),

      ...(instance.id && type === 'integrations/discord'
        ? [
            {
              icon: 'heroicons/chat-bubble-left-ellipsis',
              title: 'Conversations',
              link: `/conversations?discordIntegrationId=${instance.id}`,
            },
          ]
        : []),

      ...(instance.id && type === 'integrations/microsoftteams'
        ? [
            {
              icon: 'heroicons/chat-bubble-left-ellipsis',
              title: 'Conversations',
              link: `/conversations?microsoftteamsIntegrationId=${instance.id}`,
            },
          ]
        : []),

      ...(instance.id && type === 'integrations/googlechat'
        ? [
            {
              icon: 'heroicons/chat-bubble-left-ellipsis',
              title: 'Conversations',
              link: `/conversations?googlechatIntegrationId=${instance.id}`,
            },
          ]
        : []),

      ...(instance.id && type === 'integrations/whatsapp'
        ? [
            {
              icon: 'heroicons/chat-bubble-left-ellipsis',
              title: 'Conversations',
              link: `/conversations?whatsappIntegrationId=${instance.id}`,
            },
          ]
        : []),

      ...(instance.id && type === 'integrations/messenger'
        ? [
            {
              icon: 'heroicons/chat-bubble-left-ellipsis',
              title: 'Conversations',
              link: `/conversations?messengerIntegrationId=${instance.id}`,
            },
          ]
        : []),

      ...(instance.id && type === 'integrations/telegram'
        ? [
            {
              icon: 'heroicons/chat-bubble-left-ellipsis',
              title: 'Conversations',
              link: `/conversations?telegramIntegrationId=${instance.id}`,
            },
          ]
        : []),

      ...(instance.id && type === 'integrations/instagram'
        ? [
            {
              icon: 'heroicons/chat-bubble-left-ellipsis',
              title: 'Conversations',
              link: `/conversations?instagramIntegrationId=${instance.id}`,
            },
          ]
        : []),

      ...(instance.id && type === 'integrations/twilio'
        ? [
            {
              icon: 'heroicons/chat-bubble-left-ellipsis',
              title: 'Conversations',
              link: `/conversations?twilioIntegrationId=${instance.id}`,
            },
          ]
        : []),

      ...(instance.id && type === 'integrations/email'
        ? [
            {
              icon: 'heroicons/chat-bubble-left-ellipsis',
              title: 'Conversations',
              link: `/conversations?emailIntegrationId=${instance.id}`,
            },
          ]
        : []),

      ...(instance.id && type === 'integrations/trigger'
        ? [
            {
              icon: 'heroicons/chat-bubble-left-ellipsis',
              title: 'Conversations',
              link: `/conversations?triggerIntegrationId=${instance.id}`,
            },
          ]
        : []),
    ]
  }, [updateKey, type, instance, level, toName, portalApex])

  const wrapper = useMemo(() => {
    return portal
      ? (props) => (
          <Portal
            {...props}
            query={typeof portal === 'string' ? portal : 'body'}
          />
        )
      : Fragment
  }, [portal])

  const { isSwitched: isTeamSwitched } = useTeamSwitch()
  const { isSwitched: isUserSwitched } = useUserSwitch()

  const confirm = useConfirm()
  const { send } = useDashboardWidgetSend()

  const handleTroubleshoot = useCallback(async () => {
    const confirmed = await confirm(
      'This will start a troubleshooting session with the AI assistant to help diagnose and resolve issues with this solution.',
      {
        title: 'Start Troubleshooting',
        actions: {
          'Start Troubleshooting': { result: true, default: true },
        },
        cancelButtonCaption: 'Cancel',
      }
    )

    if (confirmed) {
      send(
        `I need help troubleshooting this ${
          type || 'solution'
        }. The resource ID is ${
          instance.id
        }. Please help me diagnose any issues.`
      )
    }
  }, [confirm, send, type, instance?.id])

  // @note it would have been better if the top offset was handled by the layout
  // rather then adding it here like an ugly hack

  const isSwitched = isTeamSwitched || isUserSwitched

  return instance?.id && singleton ? (
    <Component as={wrapper}>
      <div
        {...props}
        className={clsx('this-solution', 'group', className, {
          hidden: items[0].items.length === 0,
        })}
      >
        <FOC
          autoPosition="right"
          top={isSwitched ? 116 : undefined}
          items={items}
          defaultIcon="heroicons/puzzle-piece"
        >
          {children}
          {instance.id ? (
            <CopyButton
              className="pt-2 text-xs text-gray-500 dark:text-gray-500 cursor-copy"
              text={instance.id}
              message={`${toPascalCase(type)} ID copied to your clipboard`}
            >
              &#x2116; <span>{instance.id}</span>
            </CopyButton>
          ) : null}
          <p className="pt-2 text-xs text-gray-500 dark:text-gray-500 opacity-0 group-hover:opacity-100 transition-all duration-500">
            ?&#x20DD; This solution is the combination of all connected
            resources, such as bots, datasets, skillsets, and integrations.
          </p>
          <button
            type="button"
            className="pt-2 text-xs text-gray-500 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 opacity-0 group-hover:opacity-100 transition-all duration-500 cursor-pointer"
            onClick={handleTroubleshoot}
          >
            !&#x20DD; Troubleshoot
          </button>
        </FOC>
      </div>
    </Component>
  ) : null
}
