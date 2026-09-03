// =============================================================================
// Widget Types (Exported for external use)
// =============================================================================

/**
 * Represents a single message in the widget conversation.
 */
export interface Message {
  /** Unique identifier for the message */
  id: string
  /** The type of message */
  type: 'user' | 'bot' | 'input'
  /** The text content of the message */
  text: string
  /** Optional metadata associated with the message */
  meta?: Record<string, unknown>
}

/**
 * Definition for a single function.
 */
export interface FunctionDefinition {
  /** Description of what the function does */
  description: string
  /** JSON schema parameters for the function */
  parameters: Record<string, unknown>
  /** Handler function called when the engine invokes this function */
  handler: (args: Record<string, unknown>) => unknown | Promise<unknown>
}

/**
 * Contact information that can be assigned to the widget session.
 */
export interface Contact {
  /** Contact's name */
  name?: string
  /** Contact's email address */
  email?: string
  /** Contact's phone number */
  phone?: string
}

/**
 * Arbitrary metadata that can be associated with the widget session.
 */
export type Meta = Record<string, unknown>

/**
 * A notification to display in the widget.
 */
export interface NotificationDefinition {
  /** The notification text to display */
  text: string
}

/**
 * Options for initiating a message.
 */
export interface InitiateMessageOptions {
  /** The text content of the message */
  text?: string
}

/**
 * Options for sending a message.
 */
export interface SendMessageOptions {
  /** The text content of the message */
  text: string
  /** Whether to hide the message from the conversation UI */
  hidden?: boolean
  /** Whether the bot should respond to this message */
  respond?: boolean
}

/**
 * Options for rendering custom content.
 */
export interface RenderOptions {
  /** Custom render properties */
  [key: string]: unknown
}

/**
 * The ChatBotKit Widget custom element interface (v2).
 * This interface represents the public API of the chatbotkit-widget custom element.
 */
export interface ChatBotKitWidgetElementV2 extends HTMLElement {
  /** Whether the widget is ready for interaction */
  readonly ready: boolean
  /** Promise that resolves when the widget is ready */
  readonly readyPromise: Promise<boolean>

  /** The current conversation messages */
  messages: Message[] | null
  /** The registered engine functions */
  functions: Record<string, FunctionDefinition | null> | null
  /** The contact information */
  contact: Contact | null
  /** The session metadata */
  meta: Meta | null
  /** The current notifications */
  notifications: Record<string, NotificationDefinition | null>

  /** Whether the widget is open */
  open: boolean

  /** Hides the widget */
  hide(): void
  /** Shows the widget */
  show(): void

  /** Restarts the conversation */
  restartConversation(): void
  /** Initiates a new message */
  initiateMessage(props: InitiateMessageOptions): void
  /** Sends a message */
  sendMessage(props: SendMessageOptions): void

  /** Maximizes the widget */
  maximize(): void
  /** Minimizes the widget */
  minimize(): void

  /** Renders custom content */
  render(props: RenderOptions): void

  /** Registers additional functions */
  registerFunctions(functions: Record<string, FunctionDefinition | null>): void
  /** Unregisters functions by name */
  unregisterFunctions(functions: string[]): void

  /** Assigns contact information (legacy method) */
  assignContact(props: Contact): void
}

/**
 * The global chatbotkitWidget object available on window.
 */
export interface ChatBotKitGlobalObject {
  /** The widget instance (null if not yet initialized) */
  readonly instance: ChatBotKitWidgetElementV2 | null
  /** Promise that resolves with the widget instance when ready */
  readonly instancePromise: Promise<ChatBotKitWidgetElementV2>
}

/**
 * Extends the Window interface to include the chatbotkitWidget global.
 */
declare global {
  interface Window {
    chatbotkitWidget: ChatBotKitGlobalObject
    CHATBOTKIT_LOG_WARNING?: boolean
    CHATBOTKIT_WARNING_LOG?: boolean
    CHATBOTKIT_LOG_ERROR?: boolean
    CHATBOTKIT_ERROR_LOG?: boolean
    CHATBOTKIT_LOG_DEBUG?: boolean
    CHATBOTKIT_DEBUG_LOG?: boolean
  }

  interface HTMLElementTagNameMap {
    'chatbotkit-widget': ChatBotKitWidgetElementV2
  }
}

// =============================================================================
// Widget Implementation (IIFE to avoid global scope pollution)
// =============================================================================

// @todo the placeholder must be communicated via postMessage to make it more
// useful and dynamic

;(function () {
  // get the current script

  let scriptUrl
  let scriptData

  {
    if (!scriptUrl) {
      try {
        const script = document.currentScript as HTMLScriptElement | null

        if (script) {
          scriptUrl = script.src
          scriptData = Object.assign({}, script.dataset)
        }
      } catch {
        // pass
      }
    }

    if (!scriptUrl) {
      try {
        scriptUrl = import.meta.url
        scriptData = {}
      } catch {
        // pass
      }
    }

    if (!scriptUrl) {
      // @note last resort when the script cannot identify itself (its code
      // was copied into another bundle) - assume the embedding page is the
      // deployment itself
      scriptUrl = `${window.location.origin}/integrations/widget/v2.js`
      scriptData = {}

      scriptUrl
      scriptData
    }
  }

  // log helpers

  // eslint-disable-next-line
  const logWarning = (...args) => {
    if (!window.CHATBOTKIT_LOG_WARNING && !window.CHATBOTKIT_WARNING_LOG) {
      return
    }

    // eslint-disable-next-line no-console
    console.warn('[ChatBotKit Widget]', ...args)
  }

  // eslint-disable-next-line
  const logDebug = (...args) => {
    if (!window.CHATBOTKIT_LOG_DEBUG && !window.CHATBOTKIT_DEBUG_LOG) {
      return
    }

    // eslint-disable-next-line no-console
    console.log('[ChatBotKit Widget]', ...args)
  }

  // eslint-disable-next-line
  const logError = (...args) => {
    // eslint-disable-next-line no-console
    console.error('[ChatBotKit Widget]', ...args)
  }

  // dom helpers

  // @note we cannot rely on `document.readyState !== 'loading'` alone to know
  // that `document.body` exists. In headless/prerender contexts (and documents
  // whose body has been momentarily detached) the document can report
  // `interactive` or `complete` while `document.body` is still null. Calling
  // `document.body.appendChild(...)` in that window throws "Cannot read
  // properties of null (reading 'appendChild')" and the widget never mounts.
  // This helper guarantees the callback runs as soon as - but never before - a
  // body is actually available, so the widget loads by all means.
  const whenDocumentBodyReady = (callback) => {
    const mount = () => {
      if (!document.body) {
        return false
      }

      try {
        callback()
      } catch (e) {
        logError('failed to initialize widget', e)
      }

      return true
    }

    // body already available - mount immediately
    if (mount()) {
      return
    }

    // otherwise poll until the body appears. This covers both the normal
    // "still parsing" case and the headless/prerender race where readyState is
    // already past `loading` but the body has not been attached yet. The
    // interval stops the instant the body becomes available.
    const interval = window.setInterval(() => {
      if (mount()) {
        window.clearInterval(interval)
      }
    }, 25)

    // hook DOMContentLoaded as well so we mount at the earliest natural point
    // in the common case instead of waiting for the next poll tick
    if (document.readyState === 'loading') {
      document.addEventListener(
        'DOMContentLoaded',
        () => {
          if (mount()) {
            window.clearInterval(interval)
          }
        },
        { once: true }
      )
    }
  }

  // string helpers

  const stringToHash = (string) => {
    let hash = 0

    if (string.length === 0) {
      return hash
    }

    for (let i = 0; i < string.length; i++) {
      const char = string.charCodeAt(i)

      hash = (hash << 5) - hash + char
      hash = hash & hash
    }

    return Math.abs(hash)
  }

  // object helpers

  const createImmutableProxy = (object) => {
    const handler = {
      set(_target, property, _value, _receiver) {
        throw new Error(
          `Cannot modify property '${property}' of a frozen object.`
        )
      },
      deleteProperty(_target, property) {
        throw new Error(
          `Cannot delete property '${property}' of a frozen object.`
        )
      },
      defineProperty(_target, property, _descriptor) {
        throw new Error(
          `Cannot redefine property '${property}' of a frozen object.`
        )
      },
      get(target, property, receiver) {
        const value = Reflect.get(target, property, receiver)

        if (
          Array.isArray(target) &&
          typeof value === 'function' &&
          [
            'push',
            'pop',
            'shift',
            'unshift',
            'splice',
            'sort',
            'reverse',
          ].includes(property)
        ) {
          return () => {
            throw new Error(`Cannot modify a frozen array using '${property}'.`)
          }
        }

        if (typeof value === 'object' && value !== null) {
          return createImmutableProxy(value)
        }

        return value
      },
    }

    return new Proxy(object, handler)
  }

  const createCloneableObject = (object) => {
    return JSON.parse(JSON.stringify(object))
  }

  // json helpers

  const _tryParseJson = (string) => {
    try {
      return JSON.parse(string)
    } catch {
      return null
    }
  }

  _tryParseJson // @note reserved for future use

  const tryStringifyJson = (object) => {
    try {
      return JSON.stringify(object)
    } catch {
      return null
    }
  }

  // seo helpers

  // class helpers

  let ChatBotKitWidgetClass

  /**
   * The following codeblock will initialize the chatbotkit widget component. An
   * instance of the widget is not created.
   */
  initWidgetElement: {
    // detect previous initialization

    if (window.customElements.get('chatbotkit-widget')) {
      break initWidgetElement
    }

    // initialize locals

    const suffix = stringToHash(window.location.pathname)

    // declare init

    const initWidgetElement = () => {
      // insert mobile styles
      mobileStyle: {
        const mobileStyleId = `chatbotkit-mobile-style-${suffix}`

        if (document.getElementById(mobileStyleId)) {
          break mobileStyle
        }

        const style = document.createElement('style')

        style.setAttribute('id', mobileStyleId)

        style.appendChild(
          document.createTextNode(`
            .chatbotkit-mobile-documentElement-open-${suffix} {}

            .chatbotkit-mobile-body-open-${suffix} {
              position: fixed;
              width: 100%;
              height: 100%;
              overflow: auto;
            }

            .chatbotkit-mobile-body-open-${suffix} chatbotkit-widget[open="true"] {
              height: -webkit-fill-available;
              height: -moz-available;
            }
          `)
        )

        document.body.appendChild(style)
      }
    }

    // run widget init

    whenDocumentBodyReady(initWidgetElement)

    // detect mobile

    const isMobile =
      /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
        navigator.userAgent
      ) && navigator.maxTouchPoints > 1

    const isWebkit = /webkit/i.test(navigator.userAgent)
    const isFirefox = /firefox/i.test(navigator.userAgent)

    // consts

    const TAG_WAIT_FOR_CHANNEL_MESSAGE_BEGIN = 'waitForChannelMessageBegin'

    // create chatbotkit-widget element

    class ChatBotKitWidget extends HTMLElement {
      #id

      #ready

      #messages

      #functions

      #meta

      #notifications

      #contact

      #mediaMatch

      #frame

      constructor() {
        super()

        this.#id = this.#makeRandomId()

        this.#ready = false

        this.#messages = null

        this.#functions = null

        this.#contact = null

        this.#meta = null

        this.#notifications = new Map()

        this.#mediaMatch = window.matchMedia('screen and (max-width:640px)')

        const style = document.createElement('style')

        {
          // @note the visibility hidden is required to prevent low CLS scores
          // caused by the iframe loading after initial render

          style.appendChild(
            document.createTextNode(`
              :host {
                display: block;

                contain: layout paint;

                visibility: hidden;
              }

              :host([data-ready="true"]) {
                visibility: visible;
              }

              .wrapper {
                display: flex;

                width: 100%;
                height: 100%;
              }

              .frame {
                max-width: 100vw;
                max-height: 100vh;
                ${
                  isMobile && isWebkit
                    ? 'max-height: -webkit-fill-available;'
                    : ''
                }
                ${isMobile && isFirefox ? 'max-height: -moz-available;' : ''}

                border: 0px;
                margin: 0px;
                padding: 0px;

                transform: translate3d(0,0,0);

                background: transparent;

                color-scheme: normal;
              }

              @media only screen and (max-width:640px) {
                .frame[data-open="true"] {
                  width: 100vw ! important;
                  height: 100vh ! important;
                  ${
                    isMobile && isWebkit
                      ? 'height: -webkit-fill-available ! important;'
                      : ''
                  }
                  ${
                    isMobile && isFirefox
                      ? 'height: -moz-available ! important;'
                      : ''
                  }
                }
              }
            `)
          )
        }

        const frame = document.createElement('iframe')

        {
          frame.setAttribute('class', 'frame')
          frame.setAttribute('allow', 'clipboard-write; microphone')
          frame.setAttribute('title', 'ChatBotKit Widget')
          frame.setAttribute('loading', 'lazy')

          // @note set initial size to match closed button footprint (52px button + 16px padding × 2 = 84px)
          // @note this prevents CLS by ensuring no size change during initial hydration

          frame.width = '84px'
          frame.height = '84px'
        }

        const wrapper = document.createElement('div')

        {
          wrapper.setAttribute('class', 'wrapper')

          wrapper.appendChild(frame)
        }

        const shadow = this.attachShadow({ mode: 'closed' })

        {
          shadow.appendChild(style)
          shadow.appendChild(wrapper)
        }

        this.#frame = frame // deliberately exposed for added flexibility
      }

      // private helpers

      #makeRandomId() {
        try {
          return crypto.randomUUID()
        } catch {
          return Array(5)
            .fill(null)
            .map(() => Math.random().toString(36).slice(2))
            .join('-')
        }
      }

      #makeChannelName(suffix) {
        return `${this.#makeRandomId()}-${suffix}`
      }

      // private sync and change handlers

      /**
       * @typedef {{
       *   id: string,
       *   type: 'user'|'bot'|'input',
       *   text: string,
       *   meta?: Record<string,any>
       * }[]} Messages
       */

      /**
       *
       */
      #syncMessages() {
        this.postMessage({
          type: 'setMessages',
          props: {
            value: createCloneableObject(this.#messages || []),
          },
        })
      }

      /**
       *
       */
      #onMessagesChange(event) {
        const messages = event.data.props.value

        if (messages) {
          // no processing required
        }

        this.#messages = messages
      }

      /**
       * @typedef {Record<string,{
       *   description: string,
       *   parameters: object,
       *   result?: {data?: any}
       *   handler?: (args: object) => any
       * }>} EngineFunctions
       */

      /**
       *
       */
      #syncFunctions() {
        this.postMessage({
          type: 'setFunctions',
          props: {
            value: this.#functions
              ? createCloneableObject(
                  Array.from(
                    // @note safari does not support entries().map()
                    this.#functions.entries()
                  ).map(
                    ([name, { description, parameters, result, handler }]) => {
                      if (handler) {
                        result = {
                          channel: this.#makeChannelName(
                            `${name}-function-result`
                          ),
                        }
                      }

                      return {
                        name,
                        description,
                        parameters,
                        result,
                      }
                    }
                  )
                )
              : null,
          },
        })
      }

      /**
       *
       */
      #onFunctionsChange(event) {
        let functions = event.data.props.value

        if (functions) {
          functions = new Map(
            functions.map(({ name, description, parameters, result }) => [
              name,
              { description, parameters, result },
            ])
          )
        }

        this.#functions = functions
      }

      /**
       * @typedef {{
       *   name?: string,
       *   email?: string,
       *   phone?: string
       * }} Contact
       */

      /**
       *
       */
      #syncContact() {
        this.postMessage({
          type: 'setContact',
          props: {
            value: createCloneableObject(this.#contact || null),
          },
        })
      }

      /**
       *
       */
      #onContactChange(event) {
        const contact = event.data.props.value

        if (contact) {
          // no processing required
        }

        this.#contact = contact
      }

      /**
       * @typedef {Record<string,any>} Meta
       */

      /**
       *
       */
      #syncMeta() {
        this.postMessage({
          type: 'setMeta',
          props: {
            value: createCloneableObject(this.#meta || null),
          },
        })
      }

      /**
       *
       */
      #onMetaChange(event) {
        const meta = event.data.props.value

        if (meta) {
          // no processing required
        }

        this.#meta = meta
      }

      /**
       *
       */
      #syncNotifications() {
        if (!this.ready) {
          return
        }

        // extract current messages and ids

        const currentMessages = this.messages || []

        const currentMessageIds = new Set(currentMessages.map(({ id }) => id))

        // build old notification messages and ids

        const allNotificationMessages =
          /** @type {{id: string, type: 'input', text: string}[]} */ Array.from(
            // @note safari does not support entries().map()
            this.#notifications.entries()
          ).map(([id, { text }]) => ({
            id: `notification-${id}`,
            type: 'input',
            text,
          }))

        const allNotificationMessageIds = /** @type {Set<string>} */ new Set(
          allNotificationMessages.map(({ id }) => id)
        )

        // construct the final messages array

        this.messages = [
          ...currentMessages.filter(
            ({ id }) =>
              !id.startsWith('notification-') ||
              allNotificationMessageIds.has(id)
          ),

          ...allNotificationMessages.filter(
            ({ id }) => !currentMessageIds.has(id)
          ),
        ]
      }

      /**
       *
       */
      #onNotificationsChange(event) {
        event // @note added for completeness
      }

      // getters and setters

      /**
       * @returns {boolean}
       */
      get ready() {
        return this.#ready
      }

      /**
       * @returns {Promise<boolean>}
       */
      get readyPromise() {
        return new Promise((resolve) => {
          if (this.#ready) {
            resolve(true)
          } else {
            this.addEventListener('ready', () => {
              resolve(true)
            })
          }
        })
      }

      /**
       * @returns {Message[]?}
       */
      get messages() {
        return this.#messages
          ? createImmutableProxy(this.#messages)
          : this.ready
            ? createImmutableProxy([])
            : null
      }

      /**
       * @param {Message[]?} value
       * @returns {void}
       * @throws
       */
      set messages(value) {
        if (!this.ready) {
          logWarning(
            `The widget is not ready yet but we will attempt to set the messages later.`
          )
        }

        // @todo perform validation

        this.#messages = value

        this.#syncMessages()
      }

      /**
       * @returns {(Record<string, FunctionDefinition | null>)?}
       */
      get functions() {
        return this.#functions
          ? createImmutableProxy(Object.fromEntries(this.#functions.entries()))
          : this.ready
            ? createImmutableProxy({})
            : null
      }

      /**
       * @param {(Record<string, FunctionDefinition | null>)?} value
       */
      set functions(value) {
        if (!this.ready) {
          logWarning(
            `The widget is not ready yet but we will attempt to set the functions later.`
          )
        }

        // @todo perform validation

        this.#functions = value
          ? new Map(Object.entries(value).filter(([, value]) => !!value))
          : null

        this.#syncFunctions()
      }

      /**
       * @returns {Contact?}
       */
      get contact() {
        return this.#contact ? createImmutableProxy(this.#contact) : null
      }

      /**
       * @param {Contact?} value
       */
      set contact(value) {
        if (!this.ready) {
          logWarning(
            `The widget is not ready yet but we will attempt to set the meta later.`
          )
        }

        // @todo perform validation

        this.#contact = value

        this.#syncContact()
      }

      /**
       * @returns {Meta?}
       */
      get meta() {
        return this.#meta
          ? createImmutableProxy(this.#meta)
          : this.ready
            ? createImmutableProxy({})
            : null
      }

      /**
       * @param {Meta?} value
       */
      set meta(value) {
        if (!this.ready) {
          logWarning(
            `The widget is not ready yet but we will attempt to set the meta later.`
          )
        }

        // @todo perform validation

        this.#meta = value

        this.#syncMeta()
      }

      /**
       * @returns {Record<string, NotificationDefinition | null>}
       */
      get notifications() {
        return createImmutableProxy(
          Object.fromEntries(this.#notifications.entries())
        )
      }

      /**
       * @param {Record<string, NotificationDefinition | null>} value
       */
      set notifications(value) {
        // @todo perform validation

        this.#notifications = new Map(
          Object.entries(value || {}).filter(([, value]) => !!value)
        )

        this.#syncNotifications()
      }

      /**
       * @returns {boolean}
       * @throws
       */
      get open() {
        return this.getAttribute('open') === 'true'
      }

      /**
       * @param {?(boolean|string)?} value
       * @returns {void}
       */
      set open(value) {
        if (value == null) {
          throw new Error(`Value not accepted`)
        }

        this.setAttribute(
          'open',
          String({ true: true, false: false }[String(value)] ?? 'false')
        )
      }

      /**
       * @returns {boolean?}
       */
      get cache() {
        const cache = this.getAttribute('cache') || 'true'

        return ['true', 'on'].includes(cache) ? true : false
      }

      /**
       * @param {?boolean?} value
       * @returns {void}
       * @throws
       */
      set cache(value) {
        if (value == null) {
          throw new Error(`Value not accepted`)
        }

        this.setAttribute('cache', String(String(value) === 'true'))
      }

      /**
       * @returns {string?}
       */
      get session() {
        return this.getAttribute('session')
      }

      /**
       * @param {?string?} value
       * @returns {void}
       * @throws
       */
      set session(value) {
        if (value == null) {
          throw new Error(`Value not accepted`)
        }

        this.setAttribute('session', value)
      }

      /**
       * @returns {string?}
       */
      get widget() {
        return this.getAttribute('widget')
      }

      /**
       * @param {?string?} value
       * @returns {void}
       * @throws
       */
      set widget(value) {
        if (value == null) {
          throw new Error(`Value not accepted`)
        }

        this.setAttribute('widget', value)
      }

      /**
       * @returns {string?}
       */
      get layout() {
        return this.getAttribute('layout')
      }

      /**
       * @param {?string?} value
       * @returns {void}
       * @throws
       */
      set layout(value) {
        if (value == null) {
          throw new Error(`Value not accepted`)
        }

        this.setAttribute('layout', value)
      }

      /**
       * @returns {string?}
       */
      get position() {
        return this.getAttribute('position')
      }

      /**
       * @param {?string?} value
       * @returns {void}
       * @throws
       */
      set position(value) {
        if (value == null) {
          throw new Error(`Value not accepted`)
        }

        this.setAttribute('position', value)
      }

      /**
       * @returns {string?}
       */
      get barIcon() {
        return this.getAttribute('baricon')
      }

      /**
       * @param {?string?} value
       * @returns {void}
       * @throws
       */
      set barIcon(value) {
        if (value == null) {
          throw new Error(`Value not accepted`)
        }

        this.setAttribute('baricon', value)
      }

      /**
       * @returns {string?}
       */
      get barTitle() {
        return this.getAttribute('bartitle')
      }

      /**
       * @param {?string?} value
       * @returns {void}
       * @throws
       */
      set barTitle(value) {
        if (value == null) {
          throw new Error(`Value not accepted`)
        }

        this.setAttribute('bartitle', value)
      }

      /**
       * @returns {string?}
       */
      get botIcon() {
        return this.getAttribute('boticon')
      }

      /**
       * @param {?string?} value
       * @returns {void}
       * @throws
       */
      set botIcon(value) {
        if (value == null) {
          throw new Error(`Value not accepted`)
        }

        this.setAttribute('boticon', value)
      }

      /**
       * @returns {string?}
       */
      get userIcon() {
        return this.getAttribute('usericon')
      }

      /**
       * @param {?string?} value
       * @returns {void}
       * @throws
       */
      set userIcon(value) {
        if (value == null) {
          throw new Error(`Value not accepted`)
        }

        this.setAttribute('usericon', value)
      }

      /**
       * @returns {string?}
       */
      get buttonIcon() {
        return this.getAttribute('buttonicon')
      }

      /**
       * @param {?string?} value
       * @returns {void}
       * @throws
       */
      set buttonIcon(value) {
        if (value == null) {
          throw new Error(`Value not accepted`)
        }

        this.setAttribute('buttonicon', value)
      }

      /**
       * @returns {string?}
       */
      get placeholder() {
        return this.getAttribute('placeholder')
      }

      /**
       * @param {?string?} value
       * @returns {void}
       * @throws
       */
      set placeholder(value) {
        if (value == null) {
          throw new Error(`Value not accepted`)
        }

        this.setAttribute('placeholder', value)
      }

      /**
       * @returns {string?}
       */
      get language() {
        return this.getAttribute('language')
      }

      /**
       * @param {?string?} value
       * @returns {void}
       * @throws
       */
      set language(value) {
        if (value == null) {
          throw new Error(`Value not accepted`)
        }

        this.setAttribute('language', value)
      }

      /**
       * @returns {boolean?}
       */
      get hideBar() {
        return (
          this.hasAttribute('hidebar') ||
          ['true', 'on'].includes(this.getAttribute('hidebar') || '')
        )
      }

      /**
       * @param {?boolean|string?} value
       * @returns {void}
       */
      set hideBar(value) {
        if (value == null) {
          throw new Error(`Value not accepted`)
        }

        this.setAttribute(
          'hidebar',
          String(
            { true: true, false: false, on: true, off: false }[String(value)] ??
              'false'
          )
        )
      }

      /**
       * @returns {boolean?}
       */
      get hideButton() {
        return (
          this.hasAttribute('hidebutton') ||
          ['true', 'on'].includes(this.getAttribute('hidebutton') || '')
        )
      }

      /**
       * @param {?boolean|string?} value
       * @returns {void}
       * @throws
       */
      set hideButton(value) {
        if (value == null) {
          throw new Error(`Value not accepted`)
        }

        this.setAttribute(
          'hidebutton',
          String(
            { true: true, false: false, on: true, off: false }[String(value)] ??
              'false'
          )
        )
      }

      /**
       * @returns {string[]}
       */
      get plugins() {
        return (this.getAttribute('plugins') || '')
          .split(',')
          .map((p) => p.trim())
          .filter(Boolean)
      }

      /**
       * @param {(string|string[])} value
       */
      set plugins(value: string | string[]) {
        let plugins: string[]

        if (Array.isArray(value)) {
          plugins = value
        } else if (typeof value === 'string') {
          plugins = value
            .split(',')
            .map((p) => p.trim())
            .filter(Boolean)
        } else {
          throw new Error(`Unexpected value type: ${typeof value}`)
        }

        this.setAttribute('plugins', plugins.join(','))
      }

      /**
       * @returns {string?}
       */
      get host() {
        return this.getAttribute('host')
      }

      /**
       * @param {?string?} value
       * @returns {void}
       * @throws
       */
      set host(value) {
        if (value == null) {
          throw new Error(`Value not accepted`)
        }

        this.setAttribute('host', value)
      }

      // getters

      get url() {
        if (!this.widget) {
          throw new Error(`No widget specified`)
        }

        const url = /^(?:https?:\/\/|\/)/.test(this.widget)
          ? new URL(
              // @note we use the widget as the full url

              this.widget,

              // @note we use the current location as the base url

              window.location.toString()
            )
          : new URL(
              // @note resolve the frame relative to the script that loaded
              // the widget so aliases and proxy origins remain intact
              `/integrations/widget/${this.widget}/frame`,
              scriptUrl
            )

        if (this.host) {
          url.host = this.host
        }

        const query = {
          // demo: 'true',

          cache: this.cache,

          t: this.cache ? undefined : Date.now(),

          session: this.session,

          layout: this.layout,

          position: this.position,

          barIcon: this.barIcon,
          barTitle: this.barTitle,

          botIcon: this.botIcon,
          userIcon: this.userIcon,

          buttonIcon: this.buttonIcon,

          placeholder: this.placeholder,

          language: this.language,

          hideBar: this.hideBar ? 'true' : 'false',
          hideButton: this.hideButton ? 'true' : 'false',

          autoFocus: 'true',

          origin: window.location.origin,
        }

        for (const [name, value] of Object.entries(query)) {
          if (value != null && value !== '') {
            url.searchParams.append(name, String(value))
          }
        }

        return url
      }

      // private

      #rebuild() {
        logDebug(`rebuilding`)

        if (!this.widget) {
          logDebug(`widget not set - skipping rebuild`)

          return
        }

        const newUrl = this.url.toString()

        if (this.#frame.src === newUrl) {
          logDebug(`url not changed - skipping rebuild`)

          return
        }

        this.#frame.src = newUrl
      }

      // life-cycle methods

      static get observedAttributes() {
        return [
          'open',
          'cache',
          'session',
          'widget',
          'layout',
          'position',
          'baricon',
          'bartitle',
          'botIcon',
          'usericon',
          'buttonicon',
          'placeholder',
          'language',
          'hidebar',
          'hidebutton',
          'plugins',
        ]
      }

      attributeChangedCallback(name, _oldValue, newValue) {
        switch (name) {
          case 'open': {
            this.postMessage({
              type: 'media',
              props: {
                media: this.#mediaMatch.media,
                matches: this.#mediaMatch.matches,
              },
            })

            const open = newValue === 'true'

            this.postMessage({
              type: 'setOpen',
              props: {
                value: open,
              },
            })

            this.#frame.dataset.open = open ? 'true' : 'false'

            break
          }

          case 'plugins': {
            this.#loadPlugins(
              (newValue || '')
                .split(',')
                .map((p) => p.trim())
                .filter(Boolean)
            )
          }

          default: {
            this.#rebuild()

            break
          }
        }
      }

      connectedCallback() {
        logDebug(`connected`)

        window.addEventListener('message', this.#onMessage)

        this.#mediaMatch.addEventListener('change', this.#onMatchMedia)

        this.#rebuild()

        this.#dispatchSyntheticEvent('connect', {})
      }

      disconnectedCallback() {
        logDebug(`disconnected`)

        window.removeEventListener('message', this.#onMessage)

        this.#mediaMatch.removeEventListener('change', this.#onMatchMedia)

        this.#dispatchSyntheticEvent('disconnect', {})
      }

      // style helpers

      #insertMobileStyles() {
        document.documentElement.classList.add(
          `chatbotkit-mobile-documentElement-open-${suffix}`
        )

        document.body.classList.add(`chatbotkit-mobile-body-open-${suffix}`)

        let meta = document.querySelector('meta[name="viewport"]')

        if (!meta) {
          meta = document.createElement('meta')

          meta.setAttribute('name', 'viewport')

          // @ts-expect-error we are sure meta is an HTMLElement
          meta.dataset.chatbotkitSavedContent = ''
          ;(document.head || document.documentElement).appendChild(meta)
        }

        // @ts-expect-error we are sure meta is an HTMLElement
        meta.dataset.chatbotkitSavedContent = meta.getAttribute('content')

        meta.setAttribute(
          'content',
          'width=device-width, initial-scale=1, maximum-scale=1'
        )
      }

      #removeMobileStyles() {
        document.documentElement.classList.remove(
          `chatbotkit-mobile-documentElement-open-${suffix}`
        )

        document.body.classList.remove(`chatbotkit-mobile-body-open-${suffix}`)

        const meta = document.querySelector('meta[name="viewport"]')

        // @ts-expect-error we are sure meta is an HTMLElement
        if (meta?.dataset?.chatbotkitSavedContent) {
          // @ts-expect-error we are sure meta is an HTMLElement
          meta.setAttribute('content', meta.dataset.chatbotkitSavedContent)
        }
      }

      // event helpers

      #createSyntheticEvent(type, props) {
        const event = new Event(type)

        // @ts-ignore
        event.data = props

        return event
      }

      #dispatchSyntheticEvent(type, props) {
        const event = this.#createSyntheticEvent(type, props)

        this.dispatchEvent(event)
      }

      // plugin helpers

      #loadPlugins(plugins) {
        if (!scriptUrl) {
          return
        }

        if (!plugins.length) {
          return
        }

        if (!this.#ready) {
          return
        }

        const loaderKey = `chatbotkitWidgetPluginsLoader_${this.#id}`

        window[loaderKey] ??= {
          instance: this,
          plugins: [],
        }

        const newPlugins = plugins
          .map((plugin) => {
            return {
              url: new URL(
                `/integrations/widget/plugins/${plugin}.js`,
                scriptUrl
              ).toString(),
              name: plugin,
            }
          })
          .filter((plugin) => {
            return !window[loaderKey].plugins.some((p) => p.url === plugin.url)
          })

        if (!newPlugins.length) {
          return
        }

        window[loaderKey] = {
          instance: this,

          plugins: [...window[loaderKey].plugins, ...newPlugins],
        }

        const loader = document.createElement('script')

        loader.setAttribute('type', 'module')
        loader.setAttribute('async', 'true')
        loader.setAttribute('defer', 'true')

        loader.textContent = `
          const loader = window['${loaderKey}']
          const plugins = ${JSON.stringify(newPlugins)}

          if (loader && plugins) {
            const instance = loader.instance

            for (const plugin of plugins) {
              window['chatbotkitWidgetPlugin'] = {
                instance: instance,
                plugin: plugin
              }

              await import(plugin.url).then(async (module) => {
                if (module) {
                  if (module.default && typeof module.default === 'function') {
                    await module.default(instance)
                  } else
                  if (module.init && typeof module.init === 'function') {
                    await module.init(instance)
                  } else {
                    // we assume the module will load itself
                  }
                }
              })

              delete window['chatbotkitWidgetPlugin']
            }
          }
        `
        ;(document.head || document.documentElement).appendChild(loader)
      }

      // message event handlers

      #onReady = (event) => {
        this.#ready = true

        // show frame now that it's ready
        {
          this.dataset.ready = 'true'
        }

        // load plugins
        {
          this.#loadPlugins([
            ...(event.data.props.plugins || []),

            ...this.plugins,
          ])
        }

        // sync media match
        {
          this.postMessage({
            type: 'media',
            props: {
              media: this.#mediaMatch.media,
              matches: this.#mediaMatch.matches,
            },
          })
        }

        // sync messages
        {
          if (this.#messages?.length) {
            this.#syncMessages()
          }
        }

        // sync functions
        {
          if (this.#functions?.size) {
            this.#syncFunctions()
          }
        }

        // sync contact
        {
          if (this.#contact) {
            this.#syncContact()
          }
        }

        // sync meta
        {
          if (this.#meta) {
            this.#syncMeta()
          }
        }

        // sync notifications
        {
          if (this.#notifications?.size) {
            this.#syncNotifications()
          }
        }

        // sync open parameter
        {
          const open = this.open

          this.postMessage({
            type: 'setOpen',
            props: {
              value: open,
            },
          })

          this.#frame.dataset.open = open ? 'true' : 'false'
        }

        // dispatch ready event
        {
          this.#dispatchSyntheticEvent('ready', event.data.props)
        }
      }

      #onMessageReset = (event) => {
        this.open = event.data.props.open

        if (this.#mediaMatch.matches && event.data.props.open) {
          this.#insertMobileStyles()
        } else {
          this.#removeMobileStyles()
        }
      }

      #onMessageResize = (event) => {
        const width = event.data.props.width.toString()
        const height = event.data.props.height.toString()

        // We use the ! as an indicator to say that we really want to set the
        // the value to the one specified. Otherwise there are special cases
        // that are checked for.

        const newWidth = width.replace(/!(?:important)?/, '')
        let newHeight = height.replace(/!(?:important)?/, '')

        // The following special cases apply.

        switch (true) {
          case height === '100vh': {
            if (isWebkit) {
              newHeight = '-webkit-fill-available'
            }

            if (isFirefox) {
              newHeight = '-moz-available'
            }

            break
          }
        }

        // @note by calculating the width and height and then comparing them
        // to the current values we noticed 2 point improvement on CLS - from
        // 9 to 7

        if (this.#frame.style.width !== newWidth) {
          this.#frame.style.width = newWidth
        }

        if (this.#frame.style.height !== newHeight) {
          this.#frame.style.height = newHeight
        }
      }

      #onItem = async (event) => {
        // handle event
        {
          if (
            event.data.props.item.type === TAG_WAIT_FOR_CHANNEL_MESSAGE_BEGIN
          ) {
            const { channel, function: fnDef } = event.data.props.item.data

            if (!channel) {
              throw new Error(`No channel specified`)
            }

            if (!fnDef) {
              throw new Error(`No function specified`)
            }

            const { name: fnName, args: fnArgs } = fnDef

            if (!fnName) {
              throw new Error(`No function name specified`)
            }

            const id = this.#makeRandomId()

            try {
              const fn = this.#functions.get(fnName)

              if (!fn) {
                throw new Error(`No function found for function name ${fnName}`)
              }

              const { handler } = fn

              if (!handler) {
                throw new Error(`No handler found for function name ${fnName}`)
              }

              let ret

              try {
                ret = await handler(fnArgs)
              } catch (e) {
                logError(`function error`, e)

                ret = e
              }

              let message: Record<string, unknown>

              switch (true) {
                case ret instanceof AbortController: {
                  if (ret.signal.aborted) {
                    message = { abort: true }
                  } else {
                    throw new Error(`Unexpected abort controller signal state`)
                  }

                  break
                }

                case ret instanceof AbortSignal: {
                  if (ret.aborted) {
                    message = { abort: true }
                  } else {
                    throw new Error(`Unexpected abort signal state`)
                  }

                  break
                }

                case ret instanceof Error: {
                  message = { error: ret.message || ret.toString() }

                  break
                }

                default: {
                  message = { result: ret }

                  break
                }
              }

              this.postMessage({
                type: 'publishChannelMessage',
                id: id,
                props: {
                  channel: channel,
                  message: message,
                },
              })
            } catch (e) {
              logError(`function call error`, e)

              const message: Record<string, unknown> = {
                error: e.message || e.toString(),
              }

              this.postMessage({
                type: 'publishChannelMessage',
                id: id,
                props: {
                  channel: channel,
                  message: message,
                },
              })
            }
          }
        }

        // forward event
        {
          this.#dispatchSyntheticEvent('item', event.data.props)
        }
      }

      #onSend = (event) => {
        // handle event
        {
          // pass
        }

        // forward event
        {
          this.#dispatchSyntheticEvent('send', event.data.props)
        }
      }

      #onReceive = (event) => {
        // handle event
        {
          // pass
        }

        // forward event
        {
          this.#dispatchSyntheticEvent('receive', event.data.props)
        }
      }

      #onRestartConversation = (event) => {
        // sync functions
        {
          if (this.#functions?.size) {
            this.#syncFunctions()
          }
        }

        // sync contact
        {
          if (this.#contact) {
            this.#syncContact()
          }
        }

        // sync meta
        {
          if (this.#meta) {
            this.#syncMeta()
          }
        }

        this.#dispatchSyntheticEvent('onRestartConversation', event.data.props)
      }

      #onMessage = (event) => {
        logDebug('received message', event.data)

        if (event.source !== this.#frame.contentWindow) {
          // @note disabled because it produces false-positives due to other messages being sent from other origins on the same page
          // logWarning('unexpected source', { source: event.source })

          return
        }

        switch (event.data.type) {
          case 'onReady': {
            this.#onReady(event)

            break
          }

          case 'reset': {
            this.#onMessageReset(event)

            break
          }

          case 'resize': {
            this.#onMessageResize(event)

            break
          }

          case 'onItem': {
            void this.#onItem(event)

            break
          }

          case 'onSend': {
            this.#onSend(event)

            break
          }

          case 'onReceive': {
            this.#onReceive(event)

            break
          }

          case 'onMessagesChange': {
            const both = true // @note it syncs both ways

            if (both) {
              this.#onMessagesChange(event)
            }

            break
          }

          case 'onFunctionsChange': {
            const both = false // @note it syncs one way

            if (both) {
              this.#onFunctionsChange(event)
            }

            break
          }

          case 'onContactChange': {
            const both = false // @note it syncs one way

            if (both) {
              this.#onContactChange(event)
            }

            break
          }

          case 'onMetaChange': {
            const both = false // @note it syncs one way

            if (both) {
              this.#onMetaChange(event)
            }

            break
          }

          case 'onRestartConversation': {
            this.#onRestartConversation(event)

            break
          }
        }
      }

      // media event handlers

      #onMatchMedia = (event) => {
        this.postMessage({
          type: 'media',
          props: { media: event.media, matches: event.matches },
        })

        if (event.matches && this.open) {
          this.#insertMobileStyles()
        } else {
          this.#removeMobileStyles()
        }
      }

      // utility methods

      postMessage(message) {
        logDebug('sending message', message)

        let transferList
        let returnObject

        if (message.type.startsWith('get')) {
          const channel = new MessageChannel()
          const port1 = channel.port1
          const port2 = channel.port2

          transferList = [port2]

          returnObject = {
            await: async () => {
              return new Promise((resolve) => {
                port1.onmessage = (event) => {
                  resolve(event.data)
                }
              })
            },

            close: () => {
              port1.close()
              port2.close()
            },
          }
        }

        this.#frame.contentWindow?.postMessage(message, '*', transferList)

        return returnObject
      }

      // style methods

      hide() {
        this.style.visibility = 'hidden'
      }

      show() {
        this.style.visibility = 'visible'
      }

      // conversation methods

      restartConversation() {
        this.postMessage({
          type: 'restartConversation',
          props: {},
        })
      }

      initiateMessage(props) {
        this.postMessage({
          type: 'initiateMessage',
          props: props,
        })
      }

      sendMessage(props) {
        this.postMessage({
          type: 'sendMessage',
          props: props,
        })
      }

      // non-stable methods

      maximize() {
        this.postMessage({
          type: 'setMaximize',
          props: {
            value: true,
          },
        })
      }

      minimize() {
        this.postMessage({
          type: 'setMaximize',
          props: {
            value: false,
          },
        })
      }

      render(props) {
        this.postMessage({
          type: 'render',
          props: props,
        })
      }

      registerFunctions(functions) {
        this.functions = {
          ...Object.fromEntries(this.#functions?.entries() || []),

          ...functions,
        }
      }

      unregisterFunctions(functions) {
        this.functions = Object.fromEntries(
          this.#functions
            ?.entries()
            .filter(([name]) => !functions.includes(name) || [])
        )
      }

      // legacy methods

      assignContact(props) {
        this.contact = props
      }
    }

    window.customElements.define('chatbotkit-widget', ChatBotKitWidget)

    // eslint-disable-next-line
    ChatBotKitWidgetClass = ChatBotKitWidget
  }

  /**
   * The following codeblock creates a default, global instance of the chatbotkit
   * widget only if the embedded script is configured with options.
   */
  initWidgetInstance: {
    // get the current script

    let script
    let scriptUrl
    let scriptData

    {
      if (!scriptUrl) {
        try {
          script = /** @type {HTMLScriptElement|null} */ document.currentScript

          if (script) {
            scriptUrl = script.src
            scriptData = Object.assign({}, script.dataset)
          }
        } catch {
          // pass
        }
      }

      if (!scriptUrl) {
        try {
          scriptUrl = import.meta.url
          scriptData = {}
        } catch {
          // pass
        }
      }

      if (!scriptUrl) {
        break initWidgetInstance
      }
    }

    // declare global object class

    class ChatBotKitGlobalObject {
      #instance

      #instancePromise

      #instancePromiseResolver

      constructor(globalObject?, instance?) {
        if (globalObject) {
          this.#instance = globalObject.#instance

          this.#instancePromise = globalObject.#instancePromise

          this.#instancePromiseResolver = globalObject.#instancePromiseResolver
        } else {
          this.#instance = null

          this.#instancePromise = new Promise((resolve) => {
            this.#instancePromiseResolver = resolve
          })
        }

        if (instance) {
          this.#instance = instance

          this.#instancePromiseResolver(instance)
        }
      }

      get instance() {
        return this.#instance
      }

      get instancePromise() {
        return this.#instancePromise
      }
    }

    window.chatbotkitWidget = new ChatBotKitGlobalObject()

    // object helpers

    const has = (o, n) => {
      return Object.prototype.hasOwnProperty.call(o, n)
    }

    const deepExtend = (target, ...sources) => {
      if (!sources.length) {
        return target
      }

      const source = sources.shift()

      if (source === null || typeof source !== 'object') {
        return target
      }

      for (const key in source) {
        if (source.hasOwnProperty(key)) {
          if (
            typeof target[key] === 'object' &&
            target[key] !== null &&
            typeof source[key] === 'object' &&
            source[key] !== null
          ) {
            deepExtend(target[key], source[key])
          } else {
            target[key] = source[key]
          }
        }
      }

      return deepExtend(target, ...sources)
    }

    // css helpers

    const propertiesToCSS = (properties, sep = '') => {
      const parts: string[] = []

      Object.entries(properties).forEach(([propertyName, value]) => {
        if (!propertyName.startsWith(':')) {
          parts.push(
            `${propertyName.replace(
              /([A-Z])/g,
              (ch) => `-${ch.toLowerCase()}`
            )}: ${value};`
          )
        }
      })

      return parts.join(sep)
    }

    // declare init

    const initWidgetInstance = () => {
      // build options

      let options = deepExtend(
        {
          params: {
            layout: 'default',

            position: 'bottom-right',

            ...Object.fromEntries(
              new URLSearchParams(scriptUrl.replace(/^.*?(\?|#|$)/, '') || '')
            ),

            ...Object.assign({}, scriptData),
          },

          style: {
            widget: {},
          },
        },

        window.chatbotkitWidgetConfiguration
      )

      if (!options.params.widget) {
        return
      }

      // extend option styles with defaults

      options = deepExtend(options, {
        style: {
          widget: {
            ...{
              'bottom-right': {
                zIndex: 2147483647,

                position: 'fixed',

                bottom: '0',
                right: '0',
              },

              'bottom-left': {
                zIndex: 2147483647,

                position: 'fixed',

                bottom: '0',
                left: '0',
              },

              'top-right': {
                zIndex: 2147483647,

                position: 'fixed',

                top: '0',
                right: '0',
              },

              'top-left': {
                zIndex: 2147483647,

                position: 'fixed',

                top: '0',
                left: '0',
              },

              fullscreen: {
                zIndex: 2147483647,

                position: 'fixed',

                top: '0',
                left: '0',

                width: '100vw',
                height: '100vh',
              },
            }[options.params.position],
          },
        },
      })

      // create unique widget suffix

      const widgetSuffix =
        options.params.widget
          .replace(/\W+/g, '-')
          .replace(/-+/g, '-')
          .toLowerCase()
          .trim() || stringToHash(window.location.pathname)

      // create widget id

      const widgetId = `chatbotkit-widget-${widgetSuffix}`

      if (document.getElementById(widgetId)) {
        return
      }

      // create the widget style

      const style = document.createElement('style')

      {
        style.setAttribute('id', `chatbotkit-widget-style-${widgetSuffix}`)

        style.appendChild(
          document.createTextNode(`
            #${widgetId} {
              ${propertiesToCSS(options.style.widget, '\n')}
            }
          `)
        )

        document.body.appendChild(style)
      }

      // create the widget instance

      const instance =
        /** @type {ChatBotKitWidgetClass} */ document.createElement(
          'chatbotkit-widget'
        )

      // configure the widget element

      {
        instance.setAttribute('id', widgetId)

        let host

        if (has(options.params, 'host')) {
          host = options.params.host
        } else {
          if (/^(https?:)?\/\/.+/i.test(scriptUrl)) {
            host = new URL(scriptUrl.replace(/^\/\//, 'https://')).host
          }
        }

        instance.setAttribute('host', host)

        if (has(options.params, 'open')) {
          instance.setAttribute('open', options.params.open)
        }

        if (has(options.params, 'cache')) {
          instance.setAttribute('cache', options.params.cache)
        }

        if (has(options.params, 'session')) {
          instance.setAttribute('session', options.params.session)
        }

        if (has(options.params, 'widget')) {
          instance.setAttribute('widget', options.params.widget)
        }

        if (has(options.params, 'layout')) {
          instance.setAttribute('layout', options.params.layout)
        }

        if (has(options.params, 'position')) {
          instance.setAttribute('position', options.params.position)
        }

        if (has(options.params, 'baricon')) {
          instance.setAttribute('barIcon', options.params.baricon)
        }

        if (has(options.params, 'bartitle')) {
          instance.setAttribute('barTitle', options.params.bartitle)
        }

        if (has(options.params, 'boticon')) {
          instance.setAttribute('botIcon', options.params.boticon)
        }

        if (has(options.params, 'usericon')) {
          instance.setAttribute('userIcon', options.params.usericon)
        }

        if (has(options.params, 'buttonicon')) {
          instance.setAttribute('buttonIcon', options.params.buttonicon)
        }

        if (has(options.params, 'hidebar')) {
          instance.setAttribute('hideBar', options.params.hidebar)
        }

        if (has(options.params, 'hidebutton')) {
          instance.setAttribute('hideButton', options.params.hidebutton)
        }

        if (has(options.params, 'plugins')) {
          instance.setAttribute('plugins', options.params.plugins)
        }

        // the following are legacy ways of initializing some of the options
        {
          if (has(options.params, 'messages')) {
            instance.messages = JSON.parse(options.params.messages)
          }

          if (has(options.params, 'notifications')) {
            instance.notifications = JSON.parse(options.params.notifications)
          }

          if (has(options.params, 'meta')) {
            instance.meta = JSON.parse(options.params.meta)
          }
        }

        document.body.appendChild(instance)

        // handle initial hidden state
        {
          if (has(options.params, 'hidden')) {
            if (
              ['true', 'on', '1'].includes(
                String(options.params.hidden).toLowerCase()
              )
            ) {
              instance.hide() // @note should be ok because the method is modifying style
            }
          }
        }
      }

      // export global object

      {
        const globalInstance = new ChatBotKitGlobalObject(
          window.chatbotkitWidget,
          instance
        )

        window.chatbotkitWidget = globalInstance
      }

      let isReady = false

      window.chatbotkitWidget.instance?.addEventListener('ready', (event) => {
        if (isReady) {
          return
        }

        isReady = true

        // send init event to window
        {
          window.dispatchEvent(new CustomEvent('chatbotkitWidgetInit', event))
        }

        // execute init function if available
        {
          if (window.chatbotkitWidgetInit) {
            try {
              window.chatbotkitWidgetInit(event.data)
            } catch (e) {
              // eslint-disable-next-line no-console
              console.error(e)
            }
          }
        }

        // restore open state
        {
          if (!instance.open) {
            // @note we use timeout to allow for all animations to render, it is
            // a bit of a hack but it works

            // @todo consider using requestAnimationFrame for better performance:
            // requestAnimationFrame waits for the next browser paint cycle (~16-32ms)
            // instead of an arbitrary 1000ms delay. This would be more efficient
            // and responsive while still allowing animations to initialize.
            //
            // requestAnimationFrame(() => {
            //   requestAnimationFrame(() => {
            //     try {
            //       instance.open =
            //         window.sessionStorage['chatbotkit-widget-open'] === 'true'
            //     } catch {
            //       // pass
            //     }
            //   })
            // })

            setTimeout(() => {
              try {
                instance.open =
                  window.sessionStorage['chatbotkit-widget-open'] === 'true'
              } catch {
                // pass
              }
            }, 1000)
          }

          window.addEventListener('beforeunload', () => {
            try {
              window.sessionStorage['chatbotkit-widget-open'] = instance.open
                ? 'true'
                : 'false'
            } catch {
              // pass
            }
          })
        }
      })
    }

    // run widget init

    // @note the reason we use this method is to ensure that the widget is
    // initialized after the document is ready and the custom element is
    // defined and the body is available for manipulation

    whenDocumentBodyReady(initWidgetInstance)
  }
})()
