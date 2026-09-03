import { useCallback, useEffect, useReducer, useRef } from 'react'

import { decode as decodeB64, encode as encodeB64 } from '@/lib/b64'
import { readSource } from '@/lib/source'
import { makeJsonSafe } from '@/lib/struct'

import Demo, { SideBySidePage } from '@/layouts/Demo'

import DotsLoader from '@/components/DotsLoader'
import ResponsiveIframe from '@/components/ResponsiveIframe'

// source start
import useWidgetInstance from '@chatbotkit/react/hooks/useWidgetInstance'

import clsx from 'clsx'

function reducer(state, action) {
  const { type, value } = action

  const newState = { ...state }

  function getEditorUrl(state) {
    const blob = new Blob(
      [
        '<script>window.onerror = (message, source, lineno, colno, error) => window.parent.postMessage({ type: "error", payload: {message, source, lineno, colno} }, "*")</script>',
        state.sourceCode || '',
      ],
      { type: 'text/html' }
    )

    return URL.createObjectURL(blob)
  }

  switch (type) {
    case 'SET_STATE': {
      Object.assign(newState, value)

      newState.editorUrl = getEditorUrl(newState)
      newState.error = null

      break
    }

    case 'SET_SOURCE_CODE': {
      newState.sourceCode = value

      newState.editorUrl = getEditorUrl(newState)
      newState.error = null

      break
    }

    case 'SET_ERROR': {
      newState.error = value

      break
    }
  }

  return newState
}

export function useEditorState() {
  const [state, dispatch] = useReducer(reducer, { version: 'v1' })

  const sourceCodeRef = useRef(state.sourceCode)
  const errorRef = useRef(state.error)

  // load/save state from/to the URL hash

  useEffect(() => {
    const stateJson = decodeB64(window.location.hash.slice(1))

    if (!stateJson) {
      return
    }

    try {
      const state = JSON.parse(stateJson)

      dispatch({ type: 'SET_STATE', value: state })
    } catch {
      // pass
    }
  }, [dispatch])

  useEffect(() => {
    window.location.hash = encodeB64(JSON.stringify(state))

    sourceCodeRef.current = state.sourceCode
    errorRef.current = state.error
  }, [state])

  // listen for errors from the editor

  useEffect(() => {
    function handleMessage(event) {
      if (event.data.type === 'error') {
        dispatch({ type: 'SET_ERROR', value: event.data.payload })
      }
    }

    window.addEventListener('message', handleMessage)

    return () => {
      window.removeEventListener('message', handleMessage)
    }
  }, [])

  // expose helper functions

  const getSource = useCallback(() => {
    return sourceCodeRef.current
  }, [])

  const setSource = useCallback(
    (value) => {
      dispatch({ type: 'SET_SOURCE_CODE', value })
    },
    [dispatch]
  )

  const getError = useCallback(() => {
    return errorRef.current
  }, [])

  // return the state and helper functions

  return { state, dispatch, getSource, setSource, getError }
}

export default function Page() {
  const { state, getSource, setSource, getError } = useEditorState()

  const widget = useWidgetInstance('chatbotkit-widget')

  useEffect(() => {
    // if the widget is not ready, do nothing

    if (!widget) {
      return
    }

    // setup the functions available to the widget AI bot

    widget.functions = {
      getEditorCode: {
        description: 'Get the source code for the HTML game',
        parameters: {},
        handler: async () => {
          return { value: getSource() }
        },
      },
      setEditorCode: {
        description: 'Set the source code for the HTML game',
        parameters: {
          type: 'object',
          properties: {
            value: {
              type: 'string',
              description: 'The source for the HTML game',
            },
          },
          required: ['value'],
        },
        handler: async ({ value }) => {
          setSource(value)

          return { value }
        },
      },
      getEditorError: {
        description: 'Get the last error from the editor',
        parameters: {},
        handler: async () => {
          return { value: getError() }
        },
      },
    }

    function handleRestartConversation() {
      setSource('')
    }

    widget.addEventListener('onRestartConversation', handleRestartConversation)

    return () => {
      widget.removeEventListener(
        'onRestartConversation',
        handleRestartConversation
      )
    }
  }, [widget, getSource, setSource, getError])

  return (
    <SideBySidePage>
      <div className="w-full overflow-auto flex flex-cols justify-center items-center">
        <ResponsiveIframe
          className="w-full h-full border border-gray-200 rounded-xl"
          src={state.editorUrl}
          sandbox="allow-scripts"
        />
      </div>
      <div className="relative border border-1 border-gray-200 rounded-xl overflow-hidden flex min-w-[30rem] max-w-[60rem] shadow-lg">
        <chatbotkit-widget
          class="flex-1 w-full h-full"
          widget="/examples/mini-game-maker/frame" // @note you would use your own chatbotkit widget id here
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
      title="Mini Game Maker"
      description="This example demonstrates how to create a mini game maker using ChatbotKit."
      slug="mini-game-maker"
      source={source}
      copy={true}
      share={true}
    >
      {children}
    </Demo>
  )
}

Page.theme = 'light'

export async function getStaticProps() {
  const source = readSource('./pages/examples/mini-game-maker/demo/index.jsx')

  return {
    props: makeJsonSafe({
      source,
    }),
  }
}
