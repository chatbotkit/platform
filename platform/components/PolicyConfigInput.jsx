import { useEffect, useMemo, useRef, useState } from 'react'

import { PolicyType } from '@/prisma/types'
import {
  PolicyConfig,
  RetentionPolicyConfig,
  UsagePolicyConfig,
} from '@/prisma/zod'

import { describePolicyConfig } from '@/lib/policy.text'
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

// @note policy config templates for common use cases

const POLICY_CONFIG_TEMPLATES = [
  {
    id: 'retention-30-days',
    type: PolicyType.retention,
    icon: '@heroicons/archive-box',
    name: '30 Day Retention',
    description: 'Expire conversations after 30 days.',
    tags: ['retention', '30-days'],
    config: {
      expiresInDays: 30,
    },
  },
  {
    id: 'retention-7-days',
    type: PolicyType.retention,
    icon: '@heroicons/clock',
    name: '7 Day Retention',
    description: 'Expire conversations after one week.',
    tags: ['retention', '7-days'],
    config: {
      expiresInDays: 7,
    },
  },
  {
    id: 'usage-token-block',
    type: PolicyType.usage,
    icon: '@heroicons/no-symbol',
    name: 'Token Limit Block',
    description: 'Temporarily block a bot after token usage crosses a limit.',
    tags: ['usage', 'tokens', 'block'],
    config: {
      metric: 'tokens',
      threshold: 100000,
      windowInSeconds: 86400,
      actions: {
        block: {
          durationInSeconds: 3600,
        },
      },
    },
  },
  {
    id: 'usage-message-email',
    type: PolicyType.usage,
    icon: '@heroicons/envelope',
    name: 'Message Limit Email',
    description: 'Send a notification when message usage crosses a limit.',
    tags: ['usage', 'messages', 'email'],
    config: {
      metric: 'messages',
      threshold: 500,
      windowInSeconds: 86400,
      actions: {
        email: {},
      },
    },
  },
  {
    id: 'usage-message-email-redirect',
    type: PolicyType.usage,
    icon: '@heroicons/at-symbol',
    name: 'Message Limit Email To Address',
    description:
      'Send the notification to a specific email address instead of the policy owner.',
    tags: ['usage', 'messages', 'email', 'redirect'],
    config: {
      metric: 'messages',
      threshold: 500,
      windowInSeconds: 86400,
      actions: {
        email: {
          to: 'alerts@example.com',
        },
      },
    },
  },
  {
    id: 'usage-conversation-block-email',
    type: PolicyType.usage,
    icon: '@heroicons/exclamation-triangle',
    name: 'Conversation Limit Block And Email',
    description:
      'Block a bot and send a notification when conversations cross a limit.',
    tags: ['usage', 'conversations', 'block', 'email'],
    config: {
      metric: 'conversations',
      threshold: 100,
      windowInSeconds: 86400,
      actions: {
        block: {
          durationInSeconds: 3600,
        },
        email: {},
      },
    },
  },
]

const POLICY_CONFIG_ZOD_SCHEMA_BY_TYPE = {
  [PolicyType.retention]: RetentionPolicyConfig,
  [PolicyType.usage]: UsagePolicyConfig,
}

// @note sensible starting points seeded when the policy type is switched, so the
// editor never shows config that is invalid for the freshly selected type. These
// mirror the most common templates above.

const POLICY_CONFIG_DEFAULTS_BY_TYPE = {
  [PolicyType.retention]: {
    expiresInDays: 30,
  },
  [PolicyType.usage]: {
    metric: 'tokens',
    threshold: 100000,
    windowInSeconds: 86400,
    actions: {
      block: {
        durationInSeconds: 3600,
      },
    },
  },
}

function isPlainObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value)
}

function normalizeObject(value) {
  return isPlainObject(value) ? value : {}
}

function PolicyConfigTemplateDialog({ templates = [] }) {
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
      <input
        type="hidden"
        data-type="object"
        name="config"
        value={selectedConfig}
      />
      <div className="space-y-4 max-h-[500px] h-screen flex flex-col">
        <p className="text-sm">
          Select a policy configuration template from the list below.
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

function usePolicyConfigTemplateDialog(templates) {
  const { popup, openPopup, closePopup } = usePopup()

  function open(options) {
    openPopup(<PolicyConfigTemplateDialog templates={templates} />, {
      title: 'Policy Config Templates',
      actions: {
        Use: {
          default: true,

          async fn(props) {
            options.callback(props)

            closePopup()
          },
        },
      },
    })
  }

  function close() {
    closePopup()
  }

  return [popup, open, close]
}

export default function PolicyConfigInput({
  type = PolicyType.retention,

  defaultConfig: _defaultConfig,
  config: _config,
  setConfig: _setConfig,

  className,
  wrapperClassName,
  tabsClassName,
  inputClassName,

  templates = true,

  onTemplateSelect,

  name,

  ...props
}) {
  const [config, setConfig] = useControlledState(
    _defaultConfig,
    _config,
    _setConfig
  )

  const inputId = useMemo(() => getRandomId(), [])

  useExtendWidgetFunctions(
    useMemo(
      () => ({
        [`policy_config_input_get_${inputId}`]: {
          description:
            'Get the current policy configuration object. Use this to read the policy settings including retention and usage limits.',
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
        [`policy_config_input_set_${inputId}`]: {
          description:
            'Set the policy configuration object. Use this to update retention and usage policy settings.',
          parameters: {
            type: 'object',
            properties: {
              value: {
                type: 'object',
                description:
                  'The new policy configuration object selected by the policy type',
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

  const availableTemplates = useMemo(() => {
    return POLICY_CONFIG_TEMPLATES.filter((template) => {
      return !template.type || template.type === type
    })
  }, [type])

  const [templateDialog, templateDialogOpen] =
    usePolicyConfigTemplateDialog(availableTemplates)

  const policyConfigZodSchema =
    POLICY_CONFIG_ZOD_SCHEMA_BY_TYPE[type] || PolicyConfig

  const normalizedConfig = normalizeObject(config)

  // @note when the user switches the policy type, the existing config no longer
  // matches the new type's schema, so seed that type's defaults. Only fires on a
  // real transition between two known types - never on initial mount or while the
  // type is still resolving (e.g. undefined -> retention) so existing configs are
  // left untouched.

  const previousTypeRef = useRef(type)

  useEffect(() => {
    const previousType = previousTypeRef.current

    if (previousType === type) {
      return
    }

    previousTypeRef.current = type

    if (previousType == null || type == null) {
      return
    }

    setConfig(POLICY_CONFIG_DEFAULTS_BY_TYPE[type] ?? {})
  }, [type, setConfig])

  async function handleTemplateClick(event) {
    event.preventDefault()
    event.stopPropagation()

    templateDialogOpen({
      callback: (template) => {
        const configValue = template.config

        if (
          configValue &&
          typeof configValue === 'object' &&
          !Array.isArray(configValue)
        ) {
          setConfig(configValue)
        } else if (configValue) {
          const parsedConfig = parse(configValue)

          if (
            parsedConfig &&
            typeof parsedConfig === 'object' &&
            !Array.isArray(parsedConfig)
          ) {
            setConfig(parsedConfig)
          }
        }

        onTemplateSelect?.(template)
      },
    })
  }

  const templateButton =
    templates && availableTemplates.length > 0 ? (
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
    ) : null

  return (
    <>
      {templateDialog}
      {name ? (
        <input
          type="hidden"
          data-type="object"
          name={name}
          value={tryStringify(normalizedConfig) || ''}
        />
      ) : null}
      <ObjectInput
        {...props}
        name={undefined}
        className={clsx(
          'default-input w-full text-sm',
          className,
          inputClassName
        )}
        wrapperClassName={clsx('w-full', wrapperClassName, tabsClassName)}
        object={normalizedConfig}
        setObject={setConfig}
        zodSchema={policyConfigZodSchema}
        describe={(object) => describePolicyConfig(type, object)}
      >
        {templateButton}
      </ObjectInput>
    </>
  )
}
