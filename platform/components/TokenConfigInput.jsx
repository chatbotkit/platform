import { useMemo, useState } from 'react'

import { TokenConfig } from '@/prisma/zod'

import { getRandomId } from '@/lib/string'
import { parse, tryStringify } from '@/lib/yaml'

import DynamicIcon from '@/components/DynamicIcon'
import List from '@/components/List'
import ObjectInput from '@/components/ObjectInput'
import { useExtendWidgetFunctions } from '@/components/Widget'

import useControlledState from '@/hooks/useControlledState'
import useFuzzySearch from '@/hooks/useFuzzySearch'
import usePopup from '@/hooks/usePopup'

import { Square3Stack3DIcon } from '@heroicons/react/24/outline'

import clsx from 'clsx'

// @note token config templates for common use cases

const TOKEN_CONFIG_TEMPLATES = [
  {
    id: 'full-access',
    icon: '@heroicons/key',
    name: 'Full Access',
    description: 'Token with unrestricted access to all API endpoints',
    tags: ['full', 'admin', 'all'],
    config: {},
  },
  {
    id: 'read-only',
    icon: '@heroicons/eye',
    name: 'Read-Only Access',
    description: 'Token limited to read operations (list and fetch endpoints)',
    tags: ['read', 'list', 'fetch', 'safe'],
    config: {
      allowedRoutes: [
        '**/list',
        '**/fetch',
        '**/export',
        'platform/**',
        'event/log/**',
        'event/metric/**',
      ],
    },
  },
  {
    id: 'conversation-only',
    icon: '@heroicons/chat-bubble-left-right',
    name: 'Conversation Access',
    description: 'Token limited to conversation operations',
    tags: ['conversation', 'chat', 'messages'],
    config: {
      allowedRoutes: ['conversation/**'],
    },
  },
  {
    id: 'bot-management',
    icon: '@heroicons/cpu-chip',
    name: 'Bot Management',
    description: 'Token for managing bots and their configurations',
    tags: ['bot', 'management', 'create', 'update'],
    config: {
      allowedRoutes: ['bot/**'],
    },
  },
  {
    id: 'dataset-management',
    icon: '@heroicons/circle-stack',
    name: 'Dataset Management',
    description: 'Token for managing datasets and records',
    tags: ['dataset', 'records', 'data'],
    config: {
      allowedRoutes: ['dataset/**'],
    },
  },
  {
    id: 'skillset-management',
    icon: '@heroicons/wrench-screwdriver',
    name: 'Skillset Management',
    description: 'Token for managing skillsets and abilities',
    tags: ['skillset', 'ability', 'tools'],
    config: {
      allowedRoutes: ['skillset/**'],
    },
  },
  {
    id: 'integration-management',
    icon: '@heroicons/puzzle-piece',
    name: 'Integration Management',
    description: 'Token for managing integrations (Slack, Discord, etc.)',
    tags: ['integration', 'slack', 'discord', 'webhook'],
    config: {
      allowedRoutes: ['integration/**'],
    },
  },
  {
    id: 'file-management',
    icon: '@heroicons/document',
    name: 'File Management',
    description: 'Token for managing files and attachments',
    tags: ['file', 'upload', 'attachment'],
    config: {
      allowedRoutes: ['file/**'],
    },
  },
  {
    id: 'content-management',
    icon: '@heroicons/document-text',
    name: 'Content Management',
    description:
      'Token for managing datasets, files, and spaces (content-focused)',
    tags: ['content', 'dataset', 'file', 'space'],
    config: {
      allowedRoutes: ['dataset/**', 'file/**', 'space/**'],
    },
  },
  {
    id: 'analytics-only',
    icon: '@heroicons/chart-bar',
    name: 'Analytics Only',
    description: 'Token limited to event logs and usage metrics',
    tags: ['analytics', 'metrics', 'logs', 'usage'],
    config: {
      allowedRoutes: ['event/**', 'platform/report/**'],
    },
  },
  {
    id: 'all-bots-usage-monitoring',
    icon: '@heroicons/chart-bar-square',
    name: 'All Bots Usage Monitoring',
    description:
      'Token limited to fetching usage statistics for all your bots (ideal for Prometheus)',
    tags: ['usage', 'monitoring', 'prometheus', 'metrics', 'bot', 'grafana'],
    config: {
      allowedRoutes: ['bot/**/usage/fetch'],
    },
  },
  {
    id: 'bot-usage-monitoring',
    icon: '@heroicons/presentation-chart-line',
    name: 'Single Bot Usage Monitoring',
    description:
      'Token limited to fetching usage statistics for a specific bot (replace <botId>)',
    tags: ['usage', 'monitoring', 'prometheus', 'metrics', 'bot', 'grafana'],
    config: {
      allowedRoutes: ['bot/<botId>/usage/fetch'],
    },
  },
  {
    id: 'bot-session-create',
    icon: '@heroicons/play',
    name: 'Bot Session Create',
    description:
      'Token limited to creating sessions for a specific bot (replace <botId>)',
    tags: ['bot', 'session', 'create', 'restricted'],
    config: {
      allowedRoutes: ['bot/<botId>/session/create'],
    },
  },
]

function TokenConfigTemplateDialog({ templates = [] }) {
  const [selectedId, setSelectedId] = useState()
  const [selectedConfig, setSelectedConfig] = useState('')
  const [search, setSearch] = useState('')

  const filteredTemplates = useFuzzySearch(templates, search, {
    keys: useMemo(() => ['id', 'name', 'description', 'tags'], []),
    threshold: 0.4,
    debounce: 1000,
    disabled: !search,
  })

  return (
    <div>
      <input type="hidden" name="config" value={selectedConfig} />
      <div className="space-y-4 max-h-[500px] h-screen flex flex-col">
        <p className="text-sm">
          Select a token configuration template from the list below. Templates
          use glob patterns to restrict API access.
        </p>
        <input
          className="default-input w-full"
          type="search"
          placeholder="Search..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <div className="flex-1 h-full overflow-auto">
          <List>
            {filteredTemplates.map(
              ({ id, icon, name, description, config, tags }) => {
                return (
                  <List.Item
                    key={id}
                    selected={id === selectedId}
                    icon={
                      <DynamicIcon
                        className="w-12 h-12 text-[3rem] rounded-full object-cover bg-white p-2"
                        icon={icon || '@heroicons/cube-transparent'}
                      />
                    }
                    title={name}
                    body={description}
                    onClick={() => {
                      setSelectedId(id)
                      setSelectedConfig(tryStringify(config) || '')
                    }}
                  >
                    <div className="space-y-2 w-full">
                      {tags?.length > 0 ? (
                        <div className="space-x-1">
                          {tags.map((tag, index) => (
                            <span key={index} className="tag">
                              {tag}
                            </span>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  </List.Item>
                )
              }
            )}
          </List>
        </div>
      </div>
    </div>
  )
}

function useTokenConfigTemplateDialog() {
  const { popup, openPopup, closePopup } = usePopup()

  function open(options) {
    openPopup(
      <TokenConfigTemplateDialog templates={TOKEN_CONFIG_TEMPLATES} />,
      {
        title: 'Token Config Templates',
        actions: {
          Use: {
            default: true,

            async fn(props) {
              options.callback(props)

              closePopup()
            },
          },
        },
      }
    )
  }

  function close() {
    closePopup()
  }

  return [popup, open, close]
}

export default function TokenConfigInput({
  defaultConfig: _defaultConfig,
  config: _config,
  setConfig: _setConfig,

  className,

  templates = true,

  onTemplateSelect,

  ...props
}) {
  const [config, setConfig] = useControlledState(
    _defaultConfig,
    _config,
    _setConfig
  )

  const inputId = useMemo(() => getRandomId(), [])

  // @note register widget functions for AI assistant to get/set the token config

  useExtendWidgetFunctions(
    useMemo(
      () => ({
        [`token_config_input_get_${inputId}`]: {
          description:
            'Get the current token configuration object. Use this to read the token settings including allowed routes and access restrictions.',
          parameters: {
            type: 'object',
            properties: {},
          },
          handler: async () => {
            return {
              value: config || {},
            }
          },
        },
        [`token_config_input_set_${inputId}`]: {
          description:
            'Set the token configuration object. Use this to update token settings including allowed routes and access restrictions.',
          parameters: {
            type: 'object',
            properties: {
              value: {
                type: 'object',
                description:
                  'The new token configuration object with allowedRoutes and other settings',
              },
            },
            required: ['value'],
          },
          handler: async ({ value: newValue }) => {
            setConfig(newValue)

            return {
              success: true,
              value: newValue,
            }
          },
        },
      }),
      [inputId, config, setConfig]
    )
  )

  const [templateDialog, templateDialogOpen] = useTokenConfigTemplateDialog()

  async function handleTemplateClick(event) {
    /**
     * @note required because we do not want to submit forms
     */
    event.preventDefault()
    event.stopPropagation()

    templateDialogOpen({
      callback: (template) => {
        // @note the template dialog returns the config as a YAML string in the form data

        const configValue = template.config

        if (configValue) {
          const parsedConfig = parse(configValue)

          if (parsedConfig) {
            setConfig(parsedConfig)
          }
        }

        onTemplateSelect?.(template)
      },
    })
  }

  return (
    <>
      {templateDialog}
      <ObjectInput
        {...props}
        className={clsx('default-input w-full', className)}
        object={config}
        setObject={setConfig}
        zodSchema={TokenConfig}
      >
        {templates && TOKEN_CONFIG_TEMPLATES.length > 0 ? (
          <div className="relative group/tooltip flex">
            <button
              className="default-button tiny"
              type="button"
              onClick={handleTemplateClick}
              disabled={props.disabled}
            >
              <Square3Stack3DIcon className="w-5 h-5" />
            </button>
            <div className="tooltip below w-24">Templates</div>
          </div>
        ) : null}
      </ObjectInput>
    </>
  )
}
