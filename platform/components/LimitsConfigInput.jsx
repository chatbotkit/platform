import { useMemo, useState } from 'react'

import { UserLimits } from '@/prisma/zod'

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

// @note user limits templates for common use cases

const LIMITS_CONFIG_TEMPLATES = [
  {
    id: 'starter',
    icon: '@heroicons/rocket-launch',
    name: 'Starter Plan',
    description: 'Basic limits for new users with limited resources',
    tags: ['starter', 'basic', 'free'],
    config: {
      tokens: 10000,
      conversations: 100,
      messages: 1000,
      database: {
        datasets: 5,
        records: 1000,
        skillsets: 3,
        abilities: 10,
        files: 50,
      },
      file: {
        maxFileSize: 5242880, // 5MB
      },
      attachment: {
        maxFileSize: 2097152, // 2MB
      },
    },
  },
  {
    id: 'professional',
    icon: '@heroicons/briefcase',
    name: 'Professional Plan',
    description: 'Enhanced limits for professional users and small teams',
    tags: ['professional', 'team', 'business'],
    config: {
      tokens: 100000,
      conversations: 1000,
      messages: 10000,
      database: {
        datasets: 25,
        records: 10000,
        skillsets: 15,
        abilities: 50,
        files: 500,
      },
      file: {
        maxFileSize: 26214400, // 25MB
      },
      attachment: {
        maxFileSize: 10485760, // 10MB
      },
    },
  },
  {
    id: 'enterprise',
    icon: '@heroicons/building-office-2',
    name: 'Enterprise Plan',
    description: 'High-volume limits for enterprise organizations',
    tags: ['enterprise', 'unlimited', 'high-volume'],
    config: {
      tokens: 1000000,
      conversations: 10000,
      messages: 100000,
      database: {
        datasets: 100,
        records: 100000,
        skillsets: 50,
        abilities: 200,
        files: 5000,
      },
      file: {
        maxFileSize: 104857600, // 100MB
      },
      attachment: {
        maxFileSize: 52428800, // 50MB
      },
    },
  },
  {
    id: 'api-focused',
    icon: '@heroicons/code-bracket',
    name: 'API-Focused',
    description: 'High token limits for API-heavy integrations',
    tags: ['api', 'tokens', 'developer'],
    config: {
      tokens: 500000,
      conversations: 500,
      messages: 5000,
      database: {
        datasets: 10,
        records: 5000,
        skillsets: 10,
        abilities: 30,
        files: 100,
      },
    },
  },
  {
    id: 'content-heavy',
    icon: '@heroicons/document-text',
    name: 'Content-Heavy',
    description: 'High database and file limits for content-rich applications',
    tags: ['content', 'files', 'datasets'],
    config: {
      tokens: 50000,
      conversations: 500,
      messages: 5000,
      database: {
        datasets: 50,
        records: 50000,
        skillsets: 20,
        abilities: 100,
        files: 2000,
      },
      file: {
        maxFileSize: 52428800, // 50MB
      },
      attachment: {
        maxFileSize: 26214400, // 25MB
      },
    },
  },
  {
    id: 'minimal',
    icon: '@heroicons/minus-circle',
    name: 'Minimal Access',
    description: 'Very limited access for restricted or trial accounts',
    tags: ['minimal', 'trial', 'restricted'],
    config: {
      tokens: 1000,
      conversations: 10,
      messages: 100,
      database: {
        datasets: 1,
        records: 100,
        skillsets: 1,
        abilities: 5,
        files: 10,
      },
      file: {
        maxFileSize: 1048576, // 1MB
      },
      attachment: {
        maxFileSize: 524288, // 512KB
      },
    },
  },
]

function LimitsConfigTemplateDialog({ templates = [] }) {
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
          Select a limits template from the list below. Templates define
          resource quotas for tokens, conversations, messages, and database
          limits.
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

function useLimitsConfigTemplateDialog() {
  const { popup, openPopup, closePopup } = usePopup()

  function open(options) {
    openPopup(
      <LimitsConfigTemplateDialog templates={LIMITS_CONFIG_TEMPLATES} />,
      {
        title: 'Limits Templates',
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

export default function LimitsConfigInput({
  defaultLimits: _defaultLimits,
  limits: _limits,
  setLimits: _setLimits,

  className,

  templates = true,

  onTemplateSelect,

  ...props
}) {
  const [limits, setLimits] = useControlledState(
    _defaultLimits,
    _limits,
    _setLimits
  )

  const inputId = useMemo(() => getRandomId(), [])

  // @note register widget functions for AI assistant to get/set the user limits

  useExtendWidgetFunctions(
    useMemo(
      () => ({
        [`limits_config_input_get_${inputId}`]: {
          description:
            'Get the current user limits object. Use this to read the limits settings including tokens, conversations, messages, and database limits.',
          parameters: {
            type: 'object',
            properties: {},
          },
          handler: async () => {
            return {
              value: limits || {},
            }
          },
        },
        [`limits_config_input_set_${inputId}`]: {
          description:
            'Set the user limits object. Use this to update limits settings including tokens, conversations, messages, and database limits.',
          parameters: {
            type: 'object',
            properties: {
              value: {
                type: 'object',
                description:
                  'The new user limits object with tokens, conversations, messages, and database settings',
              },
            },
            required: ['value'],
          },
          handler: async ({ value: newValue }) => {
            setLimits(newValue)

            return {
              success: true,
              value: newValue,
            }
          },
        },
      }),
      [inputId, limits, setLimits]
    )
  )

  const [templateDialog, templateDialogOpen] = useLimitsConfigTemplateDialog()

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
            setLimits(parsedConfig)
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
        object={limits}
        setObject={setLimits}
        zodSchema={UserLimits}
      >
        {templates && LIMITS_CONFIG_TEMPLATES.length > 0 ? (
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
