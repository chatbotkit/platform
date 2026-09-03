import { useEffect, useReducer } from 'react'

import { readSource } from '@/lib/source'
import { makeJsonSafe } from '@/lib/struct'

import Demo, { SideBySidePage } from '@/layouts/Demo'

import DotsLoader from '@/components/DotsLoader'

// source start
import useWidgetInstance from '@chatbotkit/react/hooks/useWidgetInstance'

import clsx from 'clsx'

/**
 * The reducer function is responsible for managing the state of all rendered
 * boxes.
 */
function reducer(state, action) {
  const { type, value } = action

  switch (type) {
    case 'SET_COUNT': {
      return {
        ...state,

        count: value,
      }
    }

    case 'SET_SPIN': {
      return {
        ...state,

        isSpinning: value,
      }
    }

    case 'SET_PING': {
      return {
        ...state,

        isPinging: value,
      }
    }

    case 'SET_PULSE': {
      return {
        ...state,

        isPulsing: value,
      }
    }

    default: {
      return state
    }
  }
}

/**
 * A box component that can be animated with CSS animations.
 */
function Box({ isPinging, isPulsing, isSpinning }) {
  return (
    <div
      className={clsx({
        'animate-spin': isSpinning,
      })}
    >
      <div
        className={clsx({
          'animate-ping': isPinging,
        })}
      >
        <div
          className={clsx({
            'animate-pulse': isPulsing,
          })}
        >
          <div className="w-20 h-20 bg-red-500" />
        </div>
      </div>
    </div>
  )
}

/**
 * The example demonstrates how to use client-side functions to interact with
 * the ChatBotKit AI Widget. The example allows an AI bot to control the number
 * of boxes rendered and the animations applied to them. All of these actions
 * are performed via chat messages.
 */
export default function Page() {
  const [state, dispatch] = useReducer(reducer, {})

  const widget = useWidgetInstance('chatbotkit-widget')

  useEffect(() => {
    // if the widget is not ready, do nothing

    if (!widget) {
      return
    }

    // setup the functions available to the widget AI bot

    widget.functions = {
      setCount: {
        description: 'Set the number of boxes to render',
        parameters: {
          type: 'object',
          properties: {
            value: {
              type: 'number',
              description: 'The number of boxes to render',
            },
          },
          required: ['count'],
        },
        handler: async ({ value }) => {
          dispatch({ type: 'SET_COUNT', value })

          return { value }
        },
      },

      setSpin: {
        description: 'Turn on/off the spin animation',
        parameters: {
          type: 'object',
          properties: {
            value: {
              type: 'boolean',
              description: 'Whether to enable or disable the spin animation',
            },
          },
          required: ['value'],
        },
        handler: async ({ value }) => {
          dispatch({ type: 'SET_SPIN', value })

          return { value }
        },
      },

      setPing: {
        description: 'Turn on/off the ping animation',
        parameters: {
          type: 'object',
          properties: {
            value: {
              type: 'boolean',
              description: 'Whether to enable or disable the ping animation',
            },
          },
        },
        handler: async ({ value }) => {
          dispatch({ type: 'SET_PING', value })

          return { value }
        },
      },

      setPulse: {
        description: 'Turn on/off the pulse animation',
        parameters: {
          type: 'object',
          properties: {
            value: {
              type: 'boolean',
              description: 'Whether to enable or disable the pulse animation',
            },
          },
        },
        handler: async ({ value }) => {
          dispatch({ type: 'SET_PULSE', value })

          return { value }
        },
      },
    }
  }, [widget, dispatch])

  return (
    <SideBySidePage>
      <div className="w-full overflow-auto flex flex-cols justify-center items-center">
        <div className="p-10 flex flex-row flex-wrap gap-5">
          {Array(state.count || 1)
            .fill(null)
            .map((_, index) => (
              <Box key={index} {...state} />
            ))}
        </div>
      </div>
      <div className="relative border border-1 border-gray-200 rounded-xl overflow-hidden flex min-w-[30rem] max-w-[60rem] shadow-lg">
        <chatbotkit-widget
          class="flex-1 w-full h-full"
          widget="/examples/client-side-functions/frame"
        />
        <div
          className={clsx('absolute inset-0 flex items-center justify-center', {
            hidden: !!widget,
          })}
        >
          <DotsLoader className="text-xl text-gray-500 dark:text-gray-500" />
        </div>
      </div>
    </SideBySidePage>
  )
}
// source end

Page.getLayout = function getLayout(children, { source }) {
  return (
    <Demo
      title="Client-side Functions"
      description="This demo shows how to use client-side functions to interact with ChatBotKit AI Widget."
      slug="client-side-functions"
      source={source}
    >
      {children}
    </Demo>
  )
}

Page.theme = 'light'

export async function getStaticProps() {
  const source = readSource(
    './pages/examples/client-side-functions/demo/index.jsx'
  )

  return {
    props: makeJsonSafe({
      source,
    }),
  }
}
