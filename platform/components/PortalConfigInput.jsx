import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { apps as appManifests } from '@/config/apps'

import { PortalConfig } from '@/prisma/zod'

import { APP_CONFIG_JSON_SCHEMA_BY_SLUG } from '@/lib/app.config.schemas'
import { getRandomId } from '@/lib/string'
import { parse, tryStringify } from '@/lib/yaml'

import { ContextSchema } from '@/components/ContextInput'
import DynamicIcon from '@/components/DynamicIcon'
import List from '@/components/List'
import ObjectInput from '@/components/ObjectInput'
import SimpleTabs from '@/components/SimpleTabs'
import Toggle from '@/components/Toggle'
import { useExtendWidgetFunctions } from '@/components/Widget'

import useControlledState from '@/hooks/useControlledState'
import useFuzzySearch from '@/hooks/useFuzzySearch'
import usePopup from '@/hooks/usePopup'

import { Square3Stack3DIcon } from '@heroicons/react/24/outline'

import clsx from 'clsx'

// @note portal config templates for common use cases

const USERS_EDIT_DEBOUNCE_MS = 300

const PORTAL_CONFIG_TEMPLATES = [
  {
    id: 'chat-portal',
    icon: '@heroicons/chat-bubble-left-right',
    name: 'Chat Portal',
    description: 'Portal with AI chat application for user interactions',
    tags: ['chat', 'ai', 'conversation'],
    config: {
      apps: {
        chat: {},
      },
      users: {
        '*@company.com': {},
      },
    },
  },
  {
    id: 'customer-support',
    icon: '@heroicons/inbox-stack',
    name: 'Customer Support Portal',
    description: 'Portal for support teams to review customer conversations',
    tags: ['support', 'inbox', 'customer'],
    config: {
      apps: {
        inbox: {
          filters: {
            integration: true,
            safety: false,
            console: false,
          },
        },
      },
      users: {
        '*@support.company.com': {},
      },
      layout: {
        footer: {
          privacy: 'https://company.com/privacy',
          terms: 'https://company.com/terms',
          madeWith: false,
        },
      },
    },
  },
  {
    id: 'safety-review',
    icon: '@heroicons/shield-check',
    name: 'Safety Review Portal',
    description: 'Portal for safety teams to review moderated content',
    tags: ['safety', 'moderation', 'review'],
    config: {
      apps: {
        inbox: {
          filters: {
            integration: false,
            safety: true,
            console: false,
          },
        },
      },
      users: {
        '*@safety.company.com': {},
      },
    },
  },
  {
    id: 'developer-portal',
    icon: '@heroicons/code-bracket',
    name: 'Developer Portal',
    description: 'Portal for developers with full debugging access',
    tags: ['developer', 'debug', 'console'],
    config: {
      apps: {
        inbox: {
          filters: {
            integration: true,
            safety: true,
            console: true,
          },
        },
        usage: {},
      },
      users: {
        '*@dev.company.com': {},
      },
    },
  },
  {
    id: 'all-in-one',
    icon: '@heroicons/squares-2x2',
    name: 'All-in-One Portal',
    description: 'Complete portal with all applications available',
    tags: ['complete', 'all-apps', 'comprehensive'],
    config: {
      apps: {
        chat: {},
        inbox: {},
        usage: {},
        task: {},
      },
      users: {
        'admin@company.com': {},
        '*@company.com': {},
      },
      layout: {
        footer: {
          privacy: 'https://company.com/privacy',
          terms: 'https://company.com/terms',
          madeWith: false,
        },
      },
    },
  },
  {
    id: 'team-chat',
    icon: '@heroicons/user-group',
    name: 'Team Chat Portal',
    description: 'Chat portal with team of AI experts and bots',
    tags: ['team', 'chat', 'experts'],
    config: {
      apps: {
        chat: {
          bots: ['bot-id-1', 'bot-id-2', 'bot-id-3'],
          initialMessages: [
            'How can I help with sales?',
            'Tell me about our products',
            'Generate a marketing plan',
          ],
          title: 'Expert Team',
          description: 'Chat with our AI experts',
        },
      },
      users: {
        '*@sales.company.com': {},
        '*@marketing.company.com': {},
      },
    },
  },
]

const PUBLIC_PORTAL_APP_SLUGS = [
  'chat',
  'task',
  'connect',
  'inbox',
  'code',
  'usage',
]

function PortalConfigTemplateDialog({ templates = [] }) {
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
          Select a portal configuration template from the list below.
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

function usePortalConfigTemplateDialog() {
  const { popup, openPopup, closePopup } = usePopup()

  function open(options) {
    openPopup(
      <PortalConfigTemplateDialog templates={PORTAL_CONFIG_TEMPLATES} />,
      {
        title: 'Portal Config Templates',
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

/**
 * Renders the schema-driven (or object fallback) config editor for a single app.
 *
 * Extracted as its own memo component so that the `setValue` callback can be
 * wrapped in a stable `useCallback`. Inline arrow functions passed as props
 * inside a `.map()` are re-created on every parent render, which propagates
 * through `InputContextProvider → useControlledState → useCallback`, making
 * `setContext` unstable for all schema children and causing their `useEffect`
 * deps to fire on every render - creating an infinite update loop when an app
 * has optional boolean schema fields that aren't already in the config.
 */
const AppSchemaConfigInput = memo(function AppSchemaConfigInput({
  slug,
  appSchema,
  appConfig,
  setAppConfigValue,
  className,
  disabled,
  inputClassName,
}) {
  const handleSetValue = useCallback(
    (value) => setAppConfigValue(slug, value),
    // @note slug is a string constant per app; setAppConfigValue is a
    // useCallback([]) so this memoized handler is effectively stable
    [slug, setAppConfigValue]
  )

  if (!appSchema) {
    return (
      <ObjectInput
        className={clsx('default-input w-full text-sm', className)}
        object={appConfig}
        setObject={handleSetValue}
        disabled={disabled}
        zoom={false}
      />
    )
  }

  const hasOptions = !!(
    appSchema.properties && Object.keys(appSchema.properties).length > 0
  )

  if (!hasOptions) {
    return (
      <div className="input-description italic">No app-specific options.</div>
    )
  }

  return (
    <div className="p-3 rounded border border-gray-200 dark:border-gray-800">
      <ContextSchema.Memo
        className="text-sm"
        inputClassName={inputClassName || 'default-input tiny text-sm'}
        schema={appSchema}
        value={appConfig}
        setValue={handleSetValue}
        disabled={disabled}
      />
    </div>
  )
})

export default function PortalConfigInput({
  defaultConfig: _defaultConfig,
  config: _config,
  setConfig: _setConfig,

  className,
  wrapperClassName,
  tabsClassName,

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

  // @note register widget functions for AI assistant to get/set the portal config

  useExtendWidgetFunctions(
    useMemo(
      () => ({
        [`portal_config_input_get_${inputId}`]: {
          description:
            'Get the current portal configuration object. Use this to read the portal settings including apps, users, and layout.',
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
        [`portal_config_input_set_${inputId}`]: {
          description:
            'Set the portal configuration object. Use this to update portal settings including apps, users, and layout.',
          parameters: {
            type: 'object',
            properties: {
              value: {
                type: 'object',
                description:
                  'The new portal configuration object with apps, users, and layout settings',
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

  const [templateDialog, templateDialogOpen] = usePortalConfigTemplateDialog()

  const [newAppSlug, setNewAppSlug] = useState('')

  const normalizedConfig =
    config && typeof config === 'object' && !Array.isArray(config) ? config : {}

  const layout =
    normalizedConfig.layout &&
    typeof normalizedConfig.layout === 'object' &&
    !Array.isArray(normalizedConfig.layout)
      ? normalizedConfig.layout
      : {}

  const showHeader = layout.header !== false

  const showFooter = layout.footer !== false

  const footerConfig =
    layout.footer &&
    typeof layout.footer === 'object' &&
    !Array.isArray(layout.footer)
      ? layout.footer
      : {}

  const showMadeWith = footerConfig.madeWith ?? true

  const showSidebar = layout.sidebar !== false

  const sidebarConfig =
    layout.sidebar &&
    typeof layout.sidebar === 'object' &&
    !Array.isArray(layout.sidebar)
      ? layout.sidebar
      : {}

  const sidebarTitle = sidebarConfig.title || ''
  const sidebarLogo = sidebarConfig.logo || ''
  const sidebarIcon = sidebarConfig.icon || ''
  const sidebarLink = sidebarConfig.link || ''

  const users =
    normalizedConfig.users &&
    typeof normalizedConfig.users === 'object' &&
    !Array.isArray(normalizedConfig.users)
      ? normalizedConfig.users
      : {}

  const userMatchers = Object.keys(users)

  const usersTextValue = userMatchers.join('\n')

  const [usersTextDraft, setUsersTextDraft] = useState(usersTextValue)

  const usersInputFocusedRef = useRef(false)

  const portalAppManifests = useMemo(() => {
    return appManifests.filter(({ slug }) => {
      return !slug.startsWith(':')
    })
  }, [])

  const publicAppManifests = useMemo(() => {
    return PUBLIC_PORTAL_APP_SLUGS.map((slug) => {
      return portalAppManifests.find((app) => app.slug === slug)
    }).filter(Boolean)
  }, [portalAppManifests])

  const publicPortalAppSlugSet = useMemo(() => {
    return new Set(PUBLIC_PORTAL_APP_SLUGS)
  }, [])

  const nonPublicKnownAppSlugSet = useMemo(() => {
    return new Set(
      portalAppManifests
        .map(({ slug }) => slug)
        .filter((slug) => {
          return !publicPortalAppSlugSet.has(slug)
        })
    )
  }, [portalAppManifests, publicPortalAppSlugSet])

  const configuredApps =
    normalizedConfig.apps &&
    typeof normalizedConfig.apps === 'object' &&
    !Array.isArray(normalizedConfig.apps)
      ? normalizedConfig.apps
      : {}

  const configuredAppSlugs = Object.keys(configuredApps)

  const configuredNonPublicKnownAppSlugs = useMemo(() => {
    return configuredAppSlugs.filter((slug) => {
      return nonPublicKnownAppSlugSet.has(slug)
    })
  }, [configuredAppSlugs, nonPublicKnownAppSlugSet])

  const portalAppManifestMap = useMemo(() => {
    return Object.fromEntries(portalAppManifests.map((app) => [app.slug, app]))
  }, [portalAppManifests])

  const configuredUnknownAppSlugs = useMemo(() => {
    return configuredAppSlugs.filter((slug) => {
      return !portalAppManifestMap[slug]
    })
  }, [configuredAppSlugs, portalAppManifestMap])

  useEffect(() => {
    if (usersInputFocusedRef.current) {
      return
    }

    setUsersTextDraft(usersTextValue)
  }, [usersTextValue])

  function setLayout(value) {
    setConfig((prev) => {
      const safePrev =
        prev && typeof prev === 'object' && !Array.isArray(prev) ? prev : {}

      const prevLayout =
        safePrev.layout &&
        typeof safePrev.layout === 'object' &&
        !Array.isArray(safePrev.layout)
          ? safePrev.layout
          : {}

      const nextLayout = typeof value === 'function' ? value(prevLayout) : value

      const normalizedNextLayout =
        nextLayout &&
        typeof nextLayout === 'object' &&
        !Array.isArray(nextLayout)
          ? nextLayout
          : {}

      // @note avoid no-op layout writes to reduce render churn
      if (tryStringify(prevLayout) === tryStringify(normalizedNextLayout)) {
        return safePrev
      }

      return {
        ...safePrev,

        layout: normalizedNextLayout,
      }
    })
  }

  function setLayoutValue(key, value) {
    setLayout((prevLayout) => {
      return {
        ...prevLayout,
        [key]: value,
      }
    })
  }

  function setSidebarValue(key, value) {
    setLayout((prevLayout) => {
      const prevSidebar =
        prevLayout.sidebar &&
        typeof prevLayout.sidebar === 'object' &&
        !Array.isArray(prevLayout.sidebar)
          ? prevLayout.sidebar
          : {}

      const nextSidebar = {
        ...prevSidebar,
      }

      if (value) {
        nextSidebar[key] = value
      } else {
        delete nextSidebar[key]
      }

      return {
        ...prevLayout,
        sidebar: nextSidebar,
      }
    })
  }

  const setUsersFromMatchers = useCallback(
    (value) => {
      const lines = value
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)

      const dedupedMatchers = [...new Set(lines)]

      setConfig((prev) => {
        const safePrev =
          prev && typeof prev === 'object' && !Array.isArray(prev) ? prev : {}

        const prevUsers =
          safePrev.users &&
          typeof safePrev.users === 'object' &&
          !Array.isArray(safePrev.users)
            ? safePrev.users
            : {}

        const nextUsers = dedupedMatchers.reduce((acc, matcher) => {
          const existingValue = prevUsers[matcher]

          acc[matcher] =
            existingValue &&
            typeof existingValue === 'object' &&
            !Array.isArray(existingValue)
              ? existingValue
              : {}

          return acc
        }, {})

        // @note avoid no-op writes to keep updates stable while text is debounced
        if (tryStringify(prevUsers) === tryStringify(nextUsers)) {
          return safePrev
        }

        const nextConfig = {
          ...safePrev,
        }

        if (Object.keys(nextUsers).length > 0) {
          nextConfig.users = nextUsers
        } else {
          delete nextConfig.users
        }

        return nextConfig
      })
    },
    [setConfig]
  )

  useEffect(() => {
    // @note debounce to reduce high-frequency config writes during typing.
    // @note usersTextValue is intentionally NOT a dependency here - including it
    // would cause the timer to reset on every external config change that touches
    // the users section, preventing the user's typed input from ever committing.
    // setUsersFromMatchers has an internal no-op guard that makes this safe.
    const timeout = setTimeout(() => {
      setUsersFromMatchers(usersTextDraft)
    }, USERS_EDIT_DEBOUNCE_MS)

    return () => {
      clearTimeout(timeout)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usersTextDraft, setUsersFromMatchers])

  function setApps(value) {
    setConfig((prev) => {
      const safePrev =
        prev && typeof prev === 'object' && !Array.isArray(prev) ? prev : {}

      const prevApps =
        safePrev.apps &&
        typeof safePrev.apps === 'object' &&
        !Array.isArray(safePrev.apps)
          ? safePrev.apps
          : {}

      const nextApps = typeof value === 'function' ? value(prevApps) : value

      const normalizedNextApps =
        nextApps && typeof nextApps === 'object' && !Array.isArray(nextApps)
          ? nextApps
          : {}

      // @note avoid no-op app map writes to reduce unnecessary updates
      if (tryStringify(prevApps) === tryStringify(normalizedNextApps)) {
        return safePrev
      }

      const nextConfig = {
        ...safePrev,
      }

      if (Object.keys(normalizedNextApps).length > 0) {
        nextConfig.apps = normalizedNextApps
      } else {
        delete nextConfig.apps
      }

      return nextConfig
    })
  }

  function addApp(slug) {
    if (!slug) {
      return
    }

    const trimmedSlug = slug.trim()

    if (!trimmedSlug) {
      return
    }

    setApps((prevApps) => {
      return {
        ...prevApps,
        [trimmedSlug]: prevApps[trimmedSlug] || {},
      }
    })
    setNewAppSlug('')
  }

  function removeApp(slug) {
    if (!slug) {
      return
    }

    setApps((prevApps) => {
      const nextApps = {
        ...prevApps,
      }

      delete nextApps[slug]

      return nextApps
    })
  }

  function setAppEnabled(slug, enabled) {
    if (enabled) {
      addApp(slug)

      return
    }

    removeApp(slug)
  }

  // @note useCallback with empty deps because setConfig (from useState) is always
  // stable. This is critical: the app schema editor (AppSchemaConfigInput) passes
  // this as a prop and memoises its own setValue with useCallback([slug, fn]).
  // If this function were recreated on every render it would make the child's
  // cached setValue unstable, causing all ContextSchema field effects to re-fire
  // and produce an infinite update loop for apps with optional boolean schema.
  const setAppConfigValue = useCallback((slug, value) => {
    setConfig((prev) => {
      const safePrev =
        prev && typeof prev === 'object' && !Array.isArray(prev) ? prev : {}

      const prevApps =
        safePrev.apps &&
        typeof safePrev.apps === 'object' &&
        !Array.isArray(safePrev.apps)
          ? safePrev.apps
          : {}

      // @note guard: never re-add an app that was deliberately removed.
      // Without this guard, a stale ContextSchema effect that fires after
      // removeApp() has been committed would bypass the no-op check (because
      // hasOwnProperty fails) and silently re-insert the app with whatever
      // value the effect's closure held.
      if (!Object.prototype.hasOwnProperty.call(prevApps, slug)) {
        return safePrev
      }

      const prevAppConfig =
        prevApps[slug] &&
        typeof prevApps[slug] === 'object' &&
        !Array.isArray(prevApps[slug])
          ? prevApps[slug]
          : {}

      const nextValue =
        typeof value === 'function' ? value(prevAppConfig) : value

      const normalizedNextValue =
        nextValue && typeof nextValue === 'object' && !Array.isArray(nextValue)
          ? nextValue
          : {}

      // @note avoid no-op writes which can cause schema-driven inputs to loop
      if (tryStringify(prevAppConfig) === tryStringify(normalizedNextValue)) {
        return safePrev
      }

      return {
        ...safePrev,
        apps: {
          ...prevApps,
          [slug]: normalizedNextValue,
        },
      }
    })
  }, [])

  function hasSchemaOptions(schema) {
    return !!(schema?.properties && Object.keys(schema.properties).length > 0)
  }

  async function handleTemplateClick(event) {
    /**
     * @note required because we do not want to submit forms
     */
    event.preventDefault()
    event.stopPropagation()

    templateDialogOpen({
      callback: (template) => {
        // @note popup form data may already parse data-type="object" fields
        // into plain objects before this callback runs

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
    templates && PORTAL_CONFIG_TEMPLATES.length > 0 ? (
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
      {props.name ? (
        <input
          type="hidden"
          data-type="object"
          name={props.name}
          value={tryStringify(config) || ''}
        />
      ) : null}
      <SimpleTabs
        className={clsx('w-full', wrapperClassName, tabsClassName)}
        tabs={{
          Layout: {
            default: true,
            content: (
              <div
                className={clsx(
                  'default-input w-full p-4 space-y-6 text-sm',
                  className
                )}
              >
                <div className="flex flex-row justify-between items-center">
                  <div>
                    <h4 className="font-medium">Portal Layout</h4>
                    <p className="input-description mt-1">
                      Configure basic portal appearance options.
                    </p>
                  </div>
                  {templateButton}
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Show header</span>
                    <Toggle
                      checked={showHeader}
                      setChecked={(checked) => {
                        setLayoutValue('header', checked)
                      }}
                      disabled={props.disabled}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-sm">Show footer</span>
                    <Toggle
                      checked={showFooter}
                      setChecked={(checked) => {
                        setLayoutValue('footer', checked ? footerConfig : false)
                      }}
                      disabled={props.disabled}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-sm">Show “Made with” in footer</span>
                    <Toggle
                      checked={showMadeWith}
                      setChecked={(checked) => {
                        setLayoutValue('footer', {
                          ...footerConfig,
                          madeWith: checked,
                        })
                      }}
                      disabled={props.disabled || !showFooter}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-sm">Show sidebar</span>
                    <Toggle
                      checked={showSidebar}
                      setChecked={(checked) => {
                        setLayoutValue(
                          'sidebar',
                          checked ? sidebarConfig : false
                        )
                      }}
                      disabled={props.disabled}
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="default-label">Sidebar title</label>
                    <input
                      className="default-input w-full text-sm"
                      type="text"
                      value={sidebarTitle}
                      onChange={(event) => {
                        setSidebarValue('title', event.target.value)
                      }}
                      disabled={props.disabled || !showSidebar}
                    />
                  </div>

                  <div>
                    <label className="default-label">Sidebar logo</label>
                    <input
                      className="default-input w-full text-sm"
                      type="text"
                      value={sidebarLogo}
                      onChange={(event) => {
                        setSidebarValue('logo', event.target.value)
                      }}
                      placeholder="https://example.com/logo.svg"
                      disabled={props.disabled || !showSidebar}
                    />
                  </div>

                  <div>
                    <label className="default-label">Sidebar icon</label>
                    <input
                      className="default-input w-full text-sm"
                      type="text"
                      value={sidebarIcon}
                      onChange={(event) => {
                        setSidebarValue('icon', event.target.value)
                      }}
                      placeholder="https://example.com/icon.png"
                      disabled={props.disabled || !showSidebar}
                    />
                  </div>

                  <div>
                    <label className="default-label">Sidebar link</label>
                    <input
                      className="default-input w-full text-sm"
                      type="url"
                      value={sidebarLink}
                      onChange={(event) => {
                        setSidebarValue('link', event.target.value)
                      }}
                      placeholder="https://example.com"
                      disabled={props.disabled || !showSidebar}
                    />
                  </div>
                </div>
              </div>
            ),
          },
          Users: {
            content: (
              <div
                className={clsx(
                  'default-input w-full p-4 space-y-4 text-sm',
                  className
                )}
              >
                <div className="flex flex-row justify-between items-center">
                  <div>
                    <h4 className="font-medium">Users</h4>
                    <p className="input-description mt-1">
                      Define one matcher per line (for example: user@company.com
                      or *@company.com).
                    </p>
                  </div>
                  {templateButton}
                </div>

                <div>
                  <label className="default-label">User matchers</label>
                  <textarea
                    className="default-input w-full min-h-48 font-mono text-sm"
                    value={usersTextDraft}
                    onFocus={() => {
                      usersInputFocusedRef.current = true
                    }}
                    onChange={(event) => {
                      setUsersTextDraft(event.target.value)
                    }}
                    onBlur={() => {
                      usersInputFocusedRef.current = false

                      // @note pre-normalize the draft to its canonical form
                      // before committing so the sync effect doesn't trigger a
                      // second render that visibly snaps the textarea to the
                      // trimmed/deduped value
                      const lines = usersTextDraft
                        .split('\n')
                        .map((line) => line.trim())
                        .filter(Boolean)

                      const normalized = [...new Set(lines)].join('\n')

                      setUsersTextDraft(normalized)
                      setUsersFromMatchers(usersTextDraft)
                    }}
                    disabled={props.disabled}
                    spellCheck={false}
                    placeholder="*@company.com&#10;admin@company.com"
                  />
                </div>
              </div>
            ),
          },
          Apps: {
            content: (
              <div
                className={clsx(
                  'default-input w-full p-4 space-y-6 text-sm',
                  className
                )}
              >
                <div className="flex flex-row justify-between items-center">
                  <div>
                    <h4 className="font-medium">Apps</h4>
                    <p className="input-description mt-1">
                      Toggle public apps and manage additional app slugs.
                    </p>
                  </div>
                  {templateButton}
                </div>

                <div className="space-y-3">
                  {publicAppManifests.map(({ slug, name }) => {
                    // @note use hasOwnProperty so apps with falsy config values
                    // (e.g. null from external data) are still treated as
                    // enabled
                    const enabled = Object.prototype.hasOwnProperty.call(
                      configuredApps,
                      slug
                    )

                    const appSchema =
                      APP_CONFIG_JSON_SCHEMA_BY_SLUG[slug] || null

                    return (
                      <div key={slug} className="space-y-3">
                        <div className="flex items-center justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="font-medium truncate">
                              {name || slug}
                            </div>
                            <div className="text-xs text-gray-500 truncate">
                              {slug}
                            </div>
                          </div>
                          <Toggle
                            checked={enabled}
                            setChecked={(checked) => {
                              setAppEnabled(slug, checked)
                            }}
                            disabled={props.disabled}
                          />
                        </div>

                        {enabled ? (
                          <AppSchemaConfigInput
                            slug={slug}
                            appSchema={appSchema || null}
                            appConfig={configuredApps[slug] || {}}
                            setAppConfigValue={setAppConfigValue}
                            disabled={props.disabled}
                          />
                        ) : null}
                      </div>
                    )
                  })}
                </div>

                <div className="space-y-2">
                  <label className="default-label">Add app by slug</label>
                  <div className="flex gap-2 items-center">
                    <input
                      className="default-input flex-1 text-sm"
                      type="text"
                      list="portal-config-known-app-slugs"
                      value={newAppSlug}
                      onChange={(event) => {
                        setNewAppSlug(event.target.value)
                      }}
                      disabled={props.disabled}
                      placeholder="e.g. chat or 8ea0112f"
                    />
                    <button
                      className="default-button"
                      type="button"
                      onClick={() => {
                        addApp(newAppSlug)
                      }}
                      disabled={props.disabled || !newAppSlug.trim()}
                    >
                      Add
                    </button>
                  </div>
                  <datalist id="portal-config-known-app-slugs">
                    {publicAppManifests.map(({ slug }) => {
                      return <option key={slug} value={slug} />
                    })}
                  </datalist>
                </div>

                {configuredNonPublicKnownAppSlugs.length > 0 ? (
                  <div className="space-y-2">
                    <h5 className="font-medium">Configured non-public apps</h5>
                    <div className="space-y-2">
                      {configuredNonPublicKnownAppSlugs.map((slug) => {
                        const appSchema =
                          APP_CONFIG_JSON_SCHEMA_BY_SLUG[slug] || null

                        return (
                          <div key={slug} className="space-y-2">
                            <div className="flex items-center justify-between gap-2">
                              <div className="min-w-0">
                                <div className="truncate">{slug}</div>
                              </div>
                              <button
                                className="default-button tiny"
                                type="button"
                                onClick={() => {
                                  removeApp(slug)
                                }}
                                disabled={props.disabled}
                              >
                                Remove
                              </button>
                            </div>

                            <AppSchemaConfigInput
                              slug={slug}
                              appSchema={appSchema || null}
                              appConfig={configuredApps[slug] || {}}
                              setAppConfigValue={setAppConfigValue}
                              disabled={props.disabled}
                            />
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ) : null}

                {configuredUnknownAppSlugs.length > 0 ? (
                  <div className="space-y-2">
                    <h5 className="font-medium">Configured custom app slugs</h5>
                    <div className="space-y-2">
                      {configuredUnknownAppSlugs.map((slug) => {
                        return (
                          <div key={slug} className="space-y-2">
                            <div className="flex items-center justify-between gap-2">
                              <div className="min-w-0">
                                <div className="truncate">{slug}</div>
                              </div>
                              <button
                                className="default-button tiny"
                                type="button"
                                onClick={() => {
                                  removeApp(slug)
                                }}
                                disabled={props.disabled}
                              >
                                Remove
                              </button>
                            </div>

                            <ObjectInput
                              className="default-input w-full text-sm"
                              object={configuredApps[slug] || {}}
                              setObject={(value) => {
                                setAppConfigValue(slug, value)
                              }}
                              disabled={props.disabled}
                              zoom={false}
                            />
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ) : null}
              </div>
            ),
          },
          Advanced: {
            content: (
              <ObjectInput
                {...props}
                name={undefined}
                className={clsx('default-input w-full text-sm', className)}
                wrapperClassName="w-full"
                object={config}
                setObject={setConfig}
                zodSchema={PortalConfig}
              >
                {templateButton}
              </ObjectInput>
            ),
          },
        }}
      />
    </>
  )
}
