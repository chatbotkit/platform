// @ts-nocheck

;(function () {
  class ChatBotKitWidget extends HTMLElement {
    constructor() {
      super()

      // style

      const style = document.createElement('style')

      style.appendChild(
        document.createTextNode(`
          .wrapper {
            padding: var(--wrapper-padding, 1rem);

            box-sizing: border-box;

            display: flex;
            flex-direction: var(--wrapper-direction, column);

            justify-content: var(--wrapper-justify, end);

            gap: var(--wrapper-gap, 1rem);

            width: 100vw;
            height: 100vh;

            max-width: var(--wrapper-width, 400px);
            max-height: var(--wrapper-height, 700px);
          }

          .frame {
            flex: 1;

            display: block;

            margin: 0px;
            padding: 0px;

            background: white;

            pointer-events: auto;

            border-width: var(--frame-border-width, 2px);
            border-style: solid;
            border-color: var(--frame-border-color, #6366f1);
            border-radius: 0.5rem;

            overflow: hidden;

            color-scheme: normal;
          }

          .button {
            flex-shrink: 0;

            align-self: var(--button-align-self, end);

            pointer-events: auto;

            cursor: pointer;

            user-select: none;

            display: flex;

            gap: 0.5rem;

            height: 3.25rem;
            min-width: 3.25rem;

            justify-content: center;
            align-items: center;

            border-width: var(--button-border-width, 2px);
            border-style: solid;
            border-color: var(--button-border-color, var(--button-bg-color, #6366f1));

            border-radius: 0.5rem;

            padding-left: 1.25rem;
            padding-right: 1.25rem;

            font-weight: bolder;
            font-size: 1.125rem;

            background: var(--button-bg-color, #6366f1);
            color: var(--button-fg-collor, white);
          }

          .button:hover {
            background: var(--button-bg-hover-color, #4f46e5);
            color: var(--button-fg-hover-color, white)
          }

          .caption {
            font-family: var(--button-font-family);
            font-size: var(--button-font-size);
          }

          .icon {
            display: flex;

            justify-content: center;
            align-items: center;
          }

          .image {
            width: var(--button-icon-image-size, 1em);
            height: var(--button-icon-image-size, 1em);

            border-radius: 100%;
          }

          .text {
            font-size: var(--button-icon-text-size);
          }

          /* state */

          .wrapper[data-open="true"] .frame {
            visibility: visible;

            width: auto;
            height: auto;
          }

          .wrapper[data-open="true"] .button {
            border-width: var(--button-border-open-width, var(--button-border-width, 2px));
            border-style: solid;
            border-color: var(--button-border-open-color, var(--frame-border-color, var(--button-border-color, #6366f1)));
          }

          .wrapper[data-open="false"] {
            width: auto;
            height: auto;
          }

          .wrapper[data-open="false"] .frame {
            visibility: hidden;

            width: 0px;
            height: 0px;

            flex: auto;
          }

          /* media */

          @media (max-width: 640px) {
            .wrapper {
              max-width: 100vw;
              max-height: 100vh;
            }

            .button {
              border-radius: 100%;

              padding-left: 0rem;
              padding-right: 0rem;
            }

            .caption {
              display: none;
            }
          }
        `)
      )

      // icon

      const icon = document.createElement('div')

      icon.setAttribute('class', 'icon')

      // caption

      const caption = document.createElement('div')

      caption.setAttribute('class', 'caption')

      // button

      const button = document.createElement('div')

      button.setAttribute('class', 'button')

      button.appendChild(icon)
      button.appendChild(caption)

      // frame

      const frame = document.createElement('iframe')

      frame.setAttribute('class', 'frame')

      // wrapper

      const wrapper = document.createElement('div')

      wrapper.setAttribute('class', 'wrapper')

      wrapper.dataset.open = 'false'

      wrapper.appendChild(frame)
      wrapper.appendChild(button)

      // shadow

      const shadow = this.attachShadow({ mode: 'closed' })

      shadow.appendChild(style)
      shadow.appendChild(wrapper)

      // this

      this.icon = icon
      this.caption = caption
      this.button = button
      this.frame = frame
      this.wrapper = wrapper
    }

    getLocalStorageKey(key) {
      return `chatbotkit-widget-${this.getAttribute('widget')}-${key}`
    }

    handleButtonClick() {
      this.wrapper.dataset.open =
        this.wrapper.dataset.open == 'true' ? 'false' : 'true'

      try {
        // @note both localStorage and sessionStorage may not be present in some
        // browser environments, thus we need to catch them

        window.localStorage.setItem(
          this.getLocalStorageKey('open'),
          this.wrapper.dataset.open
        )

        window.sessionStorage.setItem(
          this.getLocalStorageKey('open'),
          this.wrapper.dataset.open
        )
      } catch {
        // pass
      }
    }

    connectedCallback() {
      // icon

      const iconThing = this.getAttribute('icon') || ''

      if (/^(https:\/\/|\/)/i.test(iconThing)) {
        const image = document.createElement('img')

        image.setAttribute('class', 'image')

        image.setAttribute('src', iconThing)

        this.icon.appendChild(image)
      } else {
        const text = document.createElement('span')

        text.setAttribute('class', 'text')

        text.innerText = iconThing

        this.icon.appendChild(text)
      }

      // caption

      this.caption.innerText = this.getAttribute('caption') || ''

      // button

      this.button.addEventListener('click', this.handleButtonClick.bind(this))

      // frame

      const host = this.getAttribute('host')

      const query = new URLSearchParams({
        session: this.getAttribute('session') || '',

        theme: this.getAttribute('theme') || '',

        intro: this.getAttribute('intro') || '',

        privacy: this.getAttribute('privacy') || '',
        moderation: this.getAttribute('moderation') || '',
      })

      for (const [name, value] of query.entries()) {
        if (['', null, undefined].includes(value)) {
          query.delete(name)
        }
      }

      this.frame.src = `${
        host ? `https://${host}` : ''
      }/integrations/widget/${this.getAttribute(
        'widget'
      )}/frame?${query.toString()}`

      // open

      try {
        // @note both localStorage and sessionStorage may not be present in some
        // browser environments, thus we need to catch them

        if (
          window.localStorage.getItem(this.getLocalStorageKey('open')) ===
            'true' ||
          window.sessionStorage.getItem(this.getLocalStorageKey('open')) ===
            'true'
        ) {
          this.wrapper.dataset.open = String(true)
        }
      } catch {
        // pass
      }
    }
  }

  window.customElements.define('chatbotkit-widget', ChatBotKitWidget)
})()
//
;(function () {
  const script = /** @type {HTMLScriptElement} */ document.currentScript

  if (!script) {
    return
  }

  function propertiesToCSS(properties, sep = '') {
    const parts = []

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

  function has(o, n) {
    return Object.prototype.hasOwnProperty.call(o, n)
  }

  function deepExtend(target, ...sources) {
    if (!sources.length) {
      return target
    }

    const source = sources.shift()

    if (source === null || typeof source !== 'object') {
      return target
    }

    for (const key in source) {
      if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
        continue
      }

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

  function chatbotkitWidgetInit() {
    // build options

    let options = deepExtend(
      {
        params: {
          icon: '🤖',

          caption: 'Chat',

          position: 'bottom-right',

          ...Object.fromEntries(
            new URLSearchParams(script?.src.replace(/^.*?(\?|#|$)/, '') || '')
          ),

          ...Object.assign({}, script.dataset),
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

    // build option styles

    options = deepExtend(options, {
      style: {
        widget: {
          ...{
            'bottom-right': {
              pointerEvents: 'none',

              zIndex: 2147483647,

              position: 'fixed',

              bottom: '0',
              right: '0',

              '--button-align-self': 'end',
            },

            'bottom-left': {
              pointerEvents: 'none',

              zIndex: 2147483647,

              position: 'fixed',

              bottom: '0',
              left: '0',

              '--button-align-self': 'start',
            },

            'top-right': {
              pointerEvents: 'none',

              zIndex: 2147483647,

              position: 'fixed',

              top: '0',
              right: '0',

              '--button-align-self': 'end',
              '--wrapper-justify': 'start',
              '--wrapper-direction': 'column-reverse',
            },

            'top-left': {
              pointerEvents: 'none',

              zIndex: 2147483647,

              position: 'fixed',

              top: '0',
              left: '0',

              '--button-align-self': 'start',
              '--wrapper-justify': 'start',
              '--wrapper-direction': 'column-reverse',
            },
          }[options.params.position],
        },
      },
    })

    // create widget id

    const chatbotkitWidgetId = `chatbotkit-widget-${
      options.params.widget
        .replace(/\W+/g, '-')
        .replace(/-+/g, '-')
        .toLowerCase()
        .trim() || Math.random().toString(32).slice(2)
    }`

    // create the widget style

    const chatbotkitWidgetStyle = document.createElement('style')

    chatbotkitWidgetStyle.appendChild(
      document.createTextNode(`
        #${chatbotkitWidgetId} {
          ${propertiesToCSS(options.style.widget, '\n')}
        }
    `)
    )

    // append the widget styles

    document.body.appendChild(chatbotkitWidgetStyle)

    // create the widget and assign configuration options

    const chatbotkitWidget = document.createElement('chatbotkit-widget')

    chatbotkitWidget.setAttribute('id', chatbotkitWidgetId)

    if (has(options.params, 'host')) {
      chatbotkitWidget.setAttribute('host', options.params.host)
    } else {
      if (script.src.startsWith('https://')) {
        chatbotkitWidget.setAttribute('host', new URL(script.src).host)
      }
    }

    if (has(options.params, 'widget')) {
      chatbotkitWidget.setAttribute('widget', options.params.widget)
    }

    if (has(options.params, 'session')) {
      chatbotkitWidget.setAttribute('session', options.params.session)
    }

    if (has(options.params, 'theme')) {
      chatbotkitWidget.setAttribute('theme', options.params.theme)
    }

    if (has(options.params, 'intro')) {
      chatbotkitWidget.setAttribute('intro', options.params.intro)
    }

    if (has(options.params, 'privacy')) {
      chatbotkitWidget.setAttribute('privacy', options.params.privacy)
    }

    if (has(options.params, 'moderation')) {
      chatbotkitWidget.setAttribute('moderation', options.params.moderation)
    }

    if (has(options.params, 'icon')) {
      chatbotkitWidget.setAttribute('icon', options.params.icon)
    }

    if (has(options.params, 'caption')) {
      chatbotkitWidget.setAttribute('caption', options.params.caption)
    }

    // append the widget

    document.body.appendChild(chatbotkitWidget)

    // api

    window.chatbotkitWidget = new (class {
      hide() {
        chatbotkitWidget.style.visibility = 'hidden'
      }

      show() {
        chatbotkitWidget.style.visibility = 'visible'
      }
    })()
  }

  // run widget init

  if (document.readyState !== 'loading') {
    chatbotkitWidgetInit()
  } else {
    document.addEventListener('DOMContentLoaded', function () {
      chatbotkitWidgetInit()
    })
  }
})()
