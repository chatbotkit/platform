// @ts-check
import debug from '@/lib/debug'
import { setTag } from '@/lib/error'

import { AsyncLocalStorage } from 'async_hooks'

/**
 * @typedef {any} ContextUser
 *
 * @typedef {string} ContextNamespace
 *
 * @typedef {import('@/prisma/types').Contact} ContextContact
 *
 * @typedef {import('@/prisma/types').Conversation} ContextConversation
 *
 * @typedef {import('@/prisma/types').Bot} ContextBot
 *
 * @typedef {{
 *   startTime?: number?,
 *   nextApiRequest?: import('next').NextApiRequest?,
 *   nextApiResponse?: import('next').NextApiResponse?,
 *   request?: (Request|import('next').NextApiRequest)?,
 *   requestHost?: string?,
 *   requestProtocol?: string?,
 *   requestIpAddress?: string?,
 *   requestUserAgent?: string?,
 *   requestQuery?: Record<string, string|string[]>?,
 *   frontendHost?: string?,
 *   staticHost?: string?,
 *   widgetHost?: string?,
 *   apiHost?: string?,
 *   timezone?: string?,
 *   user?: ContextUser?,
 *   bot?: ContextBot?,
 *   conversation?: ContextConversation?,
 *   contact?: ContextContact?,
 *   namespace?: ContextNamespace?,
 * }} Store
 *
 * @type {AsyncLocalStorage<Store>}
 */
const als = new AsyncLocalStorage()

/**
 * @template T
 * @param {(...args: unknown[]) => Promise<T>} fn
 * @param {{ disableContextInheritance?: boolean }} [options]
 * @returns {(...args: unknown[]) => Promise<T>}
 */
export function runInContext(fn, options = {}) {
  const { disableContextInheritance = false } = options

  const handler = async function (...args) {
    return await als.run(
      disableContextInheritance ? {} : getSafeStore(),
      async () => {
        debug(`running in session context`)

        const result = await fn(...args)

        return result
      }
    )
  }

  return handler
}

/**
 * @template T
 * @param {(...args: unknown[]) => Promise<T>} fn
 * @returns {Promise<T>}
 */
export function executeInContext(fn) {
  return runInContext(fn)()
}

/**
 * @returns {Store}
 * @throws
 */
export function getStore() {
  const store = als.getStore()

  if (!store) {
    throw new Error('Store not found')
  }

  return store
}

/**
 * @returns {Store}
 */
export function getSafeStore() {
  const store = als.getStore()

  return store || {}
}

/**
 *
 */
export function getContextRequestStartTime() {
  return getSafeStore().startTime
}

/**
 *
 */
export function setContextRequestStartTime(startTime) {
  const store = getSafeStore()

  if (store) {
    store.startTime = startTime
  }
}

/**
 *
 */
export function resetContextNamespace() {
  const store = getSafeStore()

  debug(`resetContextNamespace`, { store }).log('context.resetContextNamespace')

  if (store) {
    store.namespace = null
  }

  setTag('context.namespace', '')
}

/**
 *
 */
export function getContextNextApiRequest() {
  return getSafeStore().nextApiRequest
}

/**
 *
 */
export function setContextNextApiRequest(request) {
  const store = als.getStore()

  if (store) {
    store.nextApiRequest = request
  }
}

/**
 *
 */
export function getContextNextApiResponse() {
  return getSafeStore().nextApiResponse
}

/**
 *
 */
export function setContextNextApiResponse(response) {
  const store = als.getStore()

  if (store) {
    store.nextApiResponse = response
  }
}

/**
 *
 */
export function getContextRequest() {
  return getSafeStore().request
}

/**
 *
 * @param {Request|import('next').NextApiRequest} request
 */
export function setContextRequest(request) {
  const store = als.getStore()

  if (store) {
    store.request = request
  }
}

/**
 *
 */
export function getContextRequestHost() {
  return getSafeStore().requestHost
}

/**
 *
 */
export function setContextRequestHost(host) {
  const store = als.getStore()

  if (store) {
    store.requestHost = host
  }

  if (host) {
    setTag('context.host', host)
  }
}

/**
 *
 */
export function getContextFrontendHost() {
  return getSafeStore().frontendHost
}

/**
 *
 */
export function setContextFrontendHost(frontendHost) {
  const store = als.getStore()

  if (store) {
    store.frontendHost = frontendHost
  }

  if (frontendHost) {
    setTag('context.frontendHost', frontendHost)
  }
}

/**
 *
 */
export function getContextStaticHost() {
  return getSafeStore().staticHost
}

/**
 * @param {string|null|undefined} staticHost
 */
export function setContextStaticHost(staticHost) {
  const store = als.getStore()

  if (store) {
    store.staticHost = staticHost
  }
}

/**
 *
 */
export function getContextWidgetHost() {
  return getSafeStore().widgetHost
}

/**
 * @param {string|null|undefined} widgetHost
 */
export function setContextWidgetHost(widgetHost) {
  const store = als.getStore()

  if (store) {
    store.widgetHost = widgetHost
  }
}

/**
 *
 */
export function getContextAPIHost() {
  return getSafeStore().apiHost
}

/**
 * @param {string|null|undefined} apiHost
 */
export function setContextAPIHost(apiHost) {
  const store = als.getStore()

  if (store) {
    store.apiHost = apiHost
  }
}

/**
 *
 */
export function getContextRequestProtocol() {
  return getSafeStore().requestProtocol
}

/**
 *
 */
export function setContextRequestProtocol(protocol) {
  const store = als.getStore()

  if (store) {
    store.requestProtocol = protocol
  }

  if (protocol) {
    setTag('context.protocol', protocol)
  }
}

/**
 *
 */
export function getContextRequestIpAddress() {
  return getSafeStore().requestIpAddress
}

/**
 *
 */
export function setContextRequestIpAddress(ipAddress) {
  const store = als.getStore()

  if (store) {
    store.requestIpAddress = ipAddress
  }

  if (ipAddress) {
    setTag('context.ipAddress', ipAddress)
  }
}

/**
 *
 */
export function getContextRequestUserAgent() {
  return getSafeStore().requestUserAgent
}

/**
 *
 */
export function setContextRequestUserAgent(userAgent) {
  const store = als.getStore()

  if (store) {
    store.requestUserAgent = userAgent
  }

  if (userAgent) {
    setTag('context.userAgent', userAgent)
  }
}

/**
 *
 */
export function getContextRequestQuery() {
  return getSafeStore().requestQuery
}

/**
 *
 */
export function setContextRequestQuery(query) {
  const store = als.getStore()

  if (store) {
    store.requestQuery = query
  }
}

/**
 * @returns {string|null}
 */
export function getContextTimezone() {
  return getSafeStore().timezone ?? null
}

/**
 * @param {string|null} timezone
 */
export function setContextTimezone(timezone) {
  const store = getSafeStore()

  if (store) {
    store.timezone = timezone
  }

  if (timezone) {
    setTag('context.timezone', timezone)
  }
}

/**
 * @returns {ContextUser|null}
 */
export function getContextUser() {
  return getSafeStore().user ?? null
}

/**
 * @param {ContextUser} user
 */
export function setContextUser(user) {
  const store = getSafeStore()

  if (store) {
    store.user = user
  }

  if (user) {
    if (user.id) {
      setTag('context.userId', user.id)
    }
  }
}

/**
 * @returns {ContextBot|null}
 */
export function getContextBot() {
  return getSafeStore().bot ?? null
}

/**
 * @param {ContextBot} bot
 */
export function setContextBot(bot) {
  const store = getSafeStore()

  if (store) {
    store.bot = bot
  }

  if (bot) {
    if (bot.id) {
      setTag('context.botId', bot.id)
    }
  }
}

/**
 * @returns {ContextConversation|null}
 */
export function getContextConversation() {
  return getSafeStore().conversation ?? null
}

/**
 * @param {ContextConversation} conversation
 */
export function setContextConversation(conversation) {
  const store = getSafeStore()

  if (store) {
    store.conversation = conversation
  }

  if (conversation) {
    if (conversation.id) {
      setTag('context.conversationId', conversation.id)
    }
  }
}

/**
 * @returns {ContextContact|null}
 */
export function getContextContact() {
  return getSafeStore().contact ?? null
}

/**
 * @param {ContextContact} contact
 */
export function setContextContact(contact) {
  const store = getSafeStore()

  if (store) {
    store.contact = contact
  }

  if (contact) {
    if (contact.id) {
      setTag('context.contactId', contact.id)
    }
  }
}

/**
 *
 */
export function resetContextContact() {
  const store = getSafeStore()

  if (store) {
    store.contact = null
  }

  setTag('context.contactId', '')
}

/**
 * @returns {ContextNamespace|null}
 */
export function getContextNamespace() {
  const value = getSafeStore().namespace ?? null

  debug(`getContextNamespace`, { value }).log('context.getContextNamespace')

  return value
}

/**
 * @param {ContextNamespace} namespace
 */
export function setContextNamespace(namespace) {
  const store = getSafeStore()

  debug(`setContextNamespace`, { namespace, store }).log(
    'context.setContextNamespace'
  )

  if (store) {
    store.namespace = namespace
  }

  if (namespace) {
    setTag('context.namespace', namespace)
  }
}
