import { useEffect, useMemo, useSyncExternalStore } from 'react'

import { getExternalAPIHost } from '@/lib/host'
import { prompt } from 'react-prompt-kit/src'

import { isEmpty as isObjectEmpty } from '@/lib/object'
import { toKebabCase } from '@/lib/string'

import WidgetScript from '@/components/WidgetScript'

import useFetch from '@/hooks/useFetch'
import useIsTop from '@/hooks/useIsTop'
import useRouter from '@/hooks/useRouter'
import useSearchParam from '@/hooks/useSearchParam'
import useSession from '@/hooks/useSession'
import { registerTools } from '@/hooks/useWebMCP'

import useWidgetInstance from '@chatbotkit/react/hooks/useWidgetInstance'
import useWidgetInstanceFunctions from '@chatbotkit/react/hooks/useWidgetInstanceFunctions'
import useWidgetInstanceNotifications from '@chatbotkit/react/hooks/useWidgetInstanceNotifications'

const DASHBOARD_WIDGET_ID = '@dashboard-assistant'
const WEBSITE_WIDGET_ID = '@website-assistant'

const widgetFunctionExtensionListeners = new Set()
const widgetFunctionExtensionEntries = new Map()

let widgetFunctionExtensionsSnapshot = []

function refreshWidgetFunctionExtensionsSnapshot() {
  widgetFunctionExtensionsSnapshot = Array.from(
    widgetFunctionExtensionEntries.values()
  )

  for (const listener of widgetFunctionExtensionListeners) {
    listener()
  }
}

function subscribeWidgetFunctionExtensions(listener) {
  widgetFunctionExtensionListeners.add(listener)

  return () => {
    widgetFunctionExtensionListeners.delete(listener)
  }
}

function getWidgetFunctionExtensionsSnapshot() {
  return widgetFunctionExtensionsSnapshot
}

function registerWidgetFunctionExtensions(id, route, widgetFunctions) {
  widgetFunctionExtensionEntries.set(id, { route, widgetFunctions })
  refreshWidgetFunctionExtensionsSnapshot()
}

function unregisterWidgetFunctionExtensions(id) {
  widgetFunctionExtensionEntries.delete(id)
  refreshWidgetFunctionExtensionsSnapshot()
}

const SENSITIVE_FIELD_PATTERNS = [
  /password/i,
  /token/i,
  /key/i,
  /credential/i,
  /auth/i,
  /api[_-]?key/i,
  /private/i,
]

const SENSITIVE_INPUT_TYPES = ['password']

function isSensitiveField(name, type) {
  if (SENSITIVE_INPUT_TYPES.includes(type)) {
    return true
  }

  if (!name) {
    return false
  }

  return SENSITIVE_FIELD_PATTERNS.some((pattern) => pattern.test(name))
}

function getInputLabel(input) {
  if (input.id) {
    const label = document.querySelector(`label[for="${input.id}"]`)

    if (label?.textContent?.trim()) {
      return label.textContent.trim()
    }
  }

  const parentLabel = input.closest('label')

  if (parentLabel?.textContent?.trim()) {
    const labelText = parentLabel.textContent.trim()
    const inputText = input.value || ''

    return labelText.replace(inputText, '').trim() || null
  }

  if (input.getAttribute('aria-label')) {
    return input.getAttribute('aria-label')
  }

  const previousSibling = input.previousElementSibling

  if (
    previousSibling?.classList?.contains('default-label') ||
    previousSibling?.tagName === 'LABEL'
  ) {
    return previousSibling.textContent?.trim() || null
  }

  const parentPreviousSibling = input.parentElement?.previousElementSibling

  if (
    parentPreviousSibling?.classList?.contains('default-label') ||
    parentPreviousSibling?.tagName === 'LABEL'
  ) {
    return parentPreviousSibling.textContent?.trim() || null
  }

  return null
}

function safeString(value) {
  if (value === null || value === undefined) {
    return null
  }

  if (typeof value === 'string') {
    return value
  }

  try {
    return String(value)
  } catch {
    return null
  }
}

function getPageContext() {
  const context = {
    url: safeString(window.location.pathname) || '',
    title: safeString(document.title) || '',
    headings: [],
    forms: [],
  }

  try {
    const headings = document.querySelectorAll('h1, h2')

    for (let i = 0; i < headings.length; i++) {
      const heading = headings[i]
      const text = safeString(heading.textContent?.trim())

      if (text) {
        context.headings.push({
          level: heading.tagName.toLowerCase(),
          text,
        })
      }
    }
  } catch {
    // @note ignore heading extraction errors
  }

  try {
    const forms = document.querySelectorAll('form')

    for (let formIndex = 0; formIndex < forms.length; formIndex++) {
      const form = forms[formIndex]

      const formData = {
        id: safeString(form.id) || `form-${formIndex}`,
        name: safeString(form.name),
        action: safeString(form.action),
        inputs: [],
      }

      const inputs = form.querySelectorAll(
        'input, textarea, select, [contenteditable="true"]'
      )

      for (let j = 0; j < inputs.length; j++) {
        const input = inputs[j]
        const inputType = safeString(input.type) || ''

        if (
          inputType === 'hidden' ||
          inputType === 'submit' ||
          inputType === 'button'
        ) {
          continue
        }

        const name = safeString(input.name) || safeString(input.id)
        const type =
          inputType || safeString(input.tagName?.toLowerCase()) || 'unknown'
        const label = getInputLabel(input)
        const placeholder = safeString(input.placeholder)
        const required =
          input.required === true || input.hasAttribute('required')
        const disabled =
          input.disabled === true || input.hasAttribute('disabled')
        const sensitive = isSensitiveField(name, type)

        let value = null

        if (sensitive) {
          const inputValue = safeString(input.value)
          const textContent = safeString(input.textContent)
          const hasValue =
            (inputValue && inputValue.length > 0) ||
            (textContent && textContent.length > 0)

          value = hasValue ? '[MASKED - contains value]' : '[MASKED - empty]'
        } else if (input.tagName === 'SELECT') {
          try {
            const selectedIndex = input.selectedIndex

            if (
              selectedIndex >= 0 &&
              input.options &&
              input.options[selectedIndex]
            ) {
              value = safeString(input.options[selectedIndex].text)
            }
          } catch {
            value = null
          }
        } else if (input.getAttribute('contenteditable') === 'true') {
          value = safeString(input.textContent?.trim())
        } else {
          value = safeString(input.value)
        }

        formData.inputs.push({
          name,
          type,
          label,
          placeholder,
          value,
          required: Boolean(required),
          disabled: Boolean(disabled),
          sensitive: Boolean(sensitive),
        })
      }

      if (formData.inputs.length > 0) {
        context.forms.push(formData)
      }
    }
  } catch {
    // @note ignore form extraction errors
  }

  return context
}

function getPageContent() {
  return (
    window.pageContent ||
    'Markdown page-content is not available for this page. Use getPageContext for basic page information instead.'
  )
}

export function useWidgetFunctions(options) {
  return useWidgetInstanceFunctions({
    selector: 'chatbotkit-widget',

    ...options,
  })
}

function clearWidgetFunctionExtensionsExcept(route) {
  let changed = false

  for (const [id, entry] of widgetFunctionExtensionEntries.entries()) {
    if (entry.route !== route) {
      widgetFunctionExtensionEntries.delete(id)
      changed = true
    }
  }

  if (changed) {
    refreshWidgetFunctionExtensionsSnapshot()
  }
}

export function useExtendWidgetFunctions(widgetFunctions) {
  const router = useRouter()
  const extensionId = useMemo(() => Symbol('widget-function-extension'), [])

  useEffect(() => {
    if (widgetFunctions === undefined) {
      return
    }

    registerWidgetFunctionExtensions(
      extensionId,
      router.asPath,
      widgetFunctions
    )

    return () => {
      unregisterWidgetFunctionExtensions(extensionId)
    }
  }, [extensionId, router.asPath, widgetFunctions])
}

export function useWidgetNotifications(options) {
  return useWidgetInstanceNotifications({
    selector: 'chatbotkit-widget',

    ...options,
  })
}

/**
 * This is the main ChatBotKit site widget for both public and logged-in users.
 */
export default function Widget({
  widget = null,

  id: _id,

  notifications,

  functions,

  ...props
}) {
  const router = useRouter()

  const { status: sessionStatus, data: session } = useSession()
  const { fetch } = useFetch()

  const isLoading = sessionStatus === 'loading'
  const isAuthenticated = !!session?.user?.id

  const widgetId = useMemo(() => {
    if (isLoading) {
      return null
    }

    return widget || (isAuthenticated ? DASHBOARD_WIDGET_ID : WEBSITE_WIDGET_ID)
  }, [widget, isAuthenticated, isLoading])

  const widgetSrc = useMemo(() => {
    if (!widgetId) {
      return null
    }

    if (widgetId.startsWith('/')) {
      return widgetId
    }

    if (widgetId.startsWith('@')) {
      return `/auto/widget/frame?type=${encodeURIComponent(widgetId.slice(1))}`
    }

    return `/integrations/widget/${widgetId}/frame`
  }, [widgetId])

  const widgetPlugins = useMemo(() => {
    // @note per-widget plugin overrides keyed by widget id, e.g.
    return (
      {
        // [SOME_WIDGET_ID]: 'analytics-consent'
      }[widgetId] || ''
    )
  }, [widgetId])

  const elementId = useMemo(() => {
    return widgetId ? `chatbotkit-widget-${toKebabCase(widgetId)}` : null
  }, [widgetId])

  const instance = useWidgetInstance(elementId ? `#${elementId}` : null)

  const widgetFunctionExtensionSnapshot = useSyncExternalStore(
    subscribeWidgetFunctionExtensions,
    getWidgetFunctionExtensionsSnapshot,
    getWidgetFunctionExtensionsSnapshot
  )
  const widgetFunctionExtensions = useMemo(() => {
    const result = {}

    for (const entry of widgetFunctionExtensionSnapshot) {
      if (entry.route === router.asPath && entry.widgetFunctions) {
        Object.assign(result, entry.widgetFunctions)
      }
    }

    return result
  }, [router.asPath, widgetFunctionExtensionSnapshot])

  useEffect(() => {
    clearWidgetFunctionExtensionsExcept(router.asPath)
  }, [router.asPath])

  // notifications
  {
    useEffect(() => {
      if (!instance) {
        return
      }

      let thisNotifications = {}

      if (notifications) {
        thisNotifications = {
          ...thisNotifications,

          ...notifications,
        }
      }

      if (!isObjectEmpty(thisNotifications)) {
        instance.notifications = thisNotifications
      }
    }, [notifications, instance])
  }

  // functions
  {
    useEffect(() => {
      if (!instance) {
        return
      }

      let thisFunctions = {}

      if (widgetFunctionExtensions) {
        thisFunctions = {
          ...thisFunctions,

          ...widgetFunctionExtensions,
        }
      }

      if (functions) {
        thisFunctions = {
          ...thisFunctions,

          ...functions,
        }
      }

      if (widgetId === DASHBOARD_WIDGET_ID || widgetId === WEBSITE_WIDGET_ID) {
        thisFunctions = {
          ...thisFunctions,

          getPageContext: {
            description: prompt(
              <>
                <p>
                  Retrieve the current page context, title, headings (h1, h2),
                  and form inputs.
                </p>
                <p>
                  Sensitive fields like passwords, tokens, and secrets are
                  automatically masked for security.
                </p>
                <p>
                  Use this to understand what the user is currently viewing and
                  editing.
                </p>
              </>
            ),
            parameters: {
              type: 'object',
              properties: {
                justification: {
                  type: 'string',
                  description:
                    'A short justification for why this request is necessary',
                },
              },
            },
            handler: async () => {
              return getPageContext()
            },
          },

          getPageContent: {
            description: prompt(
              <>
                <p>Retrieve the main content of the current page.</p>
                <p>
                  Use this to understand the main content that the user is
                  viewing, without additional context like headings and form
                  inputs.
                </p>
              </>
            ),
            parameters: {
              type: 'object',
              properties: {
                justification: {
                  type: 'string',
                  description:
                    'A short justification for why this request is necessary',
                },
              },
            },
            handler: async () => {
              return getPageContent()
            },
          },

          reloadCurrentPath: {
            description: 'Reload the current page',
            parameters: {
              type: 'object',
              properties: {
                justification: {
                  type: 'string',
                  description:
                    'A short justification for why this request is necessary',
                },
              },
            },
            handler: async () => {
              router.reload()

              return { error: null, data: null }
            },
          },

          gotoPath: {
            description: 'Navigate to a different page in the dashboard',
            parameters: {
              type: 'object',
              properties: {
                justification: {
                  type: 'string',
                  description:
                    'A short justification for why this request is necessary',
                },
                path: {
                  type: 'string',
                  description: 'The path to navigate to',
                },
              },
              required: ['path'],
            },
            handler: async ({ path }) => {
              router.push(path)

              return { error: null, data: null }
            },
          },
        }
      }

      if (widgetId === DASHBOARD_WIDGET_ID) {
        thisFunctions = {
          ...thisFunctions,

          fetch: {
            description: 'Perform an HTTP request',
            parameters: {
              type: 'object',
              properties: {
                justification: {
                  type: 'string',
                  description:
                    'A short justification for why this request is necessary',
                },
                method: {
                  type: 'string',
                  description: 'The HTTP method to use',
                  enum: ['GET', 'POST'],
                },
                url: {
                  type: 'string',
                  description: 'The URL to fetch',
                },
                data: {
                  type: 'object',
                  description:
                    'The data to send in the request body (for POST requests)',
                },
              },
              required: ['url'],
            },
            handler: async ({ method, url, data }) => {
              const u = new URL(url, window.location.origin)

              if (u.hostname === getExternalAPIHost()) {
                const localOrigin = new URL(window.location.origin)

                u.protocol = localOrigin.protocol
                u.host = localOrigin.host
                u.pathname = u.pathname.startsWith('/api/')
                  ? u.pathname
                  : `/api${u.pathname}`
              }

              if (u.origin !== window.location.origin) {
                return {
                  error: 'Only same-origin URLs are allowed',
                }
              }

              const { error: fetchError, data: fetchData } = await fetch(
                u.href,
                {
                  method,
                  data,
                }
              )

              return { error: fetchError, data: fetchData }
            },
          },
        }
      }

      if (!isObjectEmpty(thisFunctions)) {
        instance.functions = thisFunctions
      }

      // @note `thisFunctions` is a keyed map of CBK widget functions
      // ({ [name]: { description, parameters, handler } }), but the Web Model
      // Context API expects an array of tools shaped { name, description,
      // inputSchema, execute }. Adapt before registering, otherwise the whole
      // map is passed as a single tool and `registerTool` throws on the missing
      // top-level `description`.
      const cleanup = registerTools(
        Object.entries(thisFunctions).map(([name, fn]) => ({
          name,
          description: fn.description,
          inputSchema: fn.parameters,
          execute: fn.handler,
        }))
      )

      return () => {
        if (typeof cleanup === 'function') {
          cleanup()
        }
      }
    }, [widgetId, functions, widgetFunctionExtensions, instance, router, fetch])
  }

  const isTop = useIsTop()

  const isOff = useSearchParam('_widget') === 'off'

  return (
    <>
      <WidgetScript />
      {isTop && !isOff && elementId && widgetSrc ? (
        <chatbotkit-widget
          id={elementId}
          widget={widgetSrc}
          plugins={widgetPlugins}
          layout="default"
          style={{
            zIndex: 2147483647,

            position: 'fixed',

            bottom: '0',
            right: '0',
          }}
          {...props}
        />
      ) : null}
    </>
  )
}
