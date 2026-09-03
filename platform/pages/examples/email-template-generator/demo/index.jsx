import { useEffect, useReducer, useRef, useState } from 'react'
import { Body, Heading, Hr, Html, Markdown, Text, render } from 'react-email'

import { readSource } from '@/lib/source'
import { makeJsonSafe } from '@/lib/struct'

import Demo, { SideBySidePage } from '@/layouts/Demo'

import DotsLoader from '@/components/DotsLoader'
import ResponsiveIframe from '@/components/ResponsiveIframe'

// source start
import useWidgetInstance from '@chatbotkit/react/hooks/useWidgetInstance'

import clsx from 'clsx'

function getNextElement(children) {
  return children?.map?.((child) => {
    switch (child.type) {
      case 'layout':
        return <LayoutElement dsl={child} />

      case 'h':
      case 'heading':
        return <HeadingElement dsl={child} />

      case 'hr':
      case 'divider':
        return <HrElement dsl={child} />

      case 'md':
      case 'markdown':
        return <MarkdownElement dsl={child} />

      case 'p':
      case 'paragraph':
        return <ParagraphElement dsl={child} />

      default:
        return null
    }
  })
}

function LayoutElement({ dsl }) {
  return (
    <Html lang={dsl.lang}>
      <Body>{getNextElement(dsl.children)}</Body>
    </Html>
  )
}

function HeadingElement({ dsl }) {
  return <Heading style={dsl.style}>{dsl.text}</Heading>
}

function HrElement({ dsl }) {
  return <Hr style={dsl.style} />
}

function MarkdownElement({ dsl }) {
  return <Markdown style={dsl.style}>{dsl.text}</Markdown>
}

function ParagraphElement({ dsl }) {
  return <Text style={dsl.style}>{dsl.text}</Text>
}

function reducer(state, action) {
  const { type, value } = action

  switch (type) {
    case 'SET_DSL': {
      return {
        ...state,

        dsl: value,
      }
    }
  }
}

export function useHTMLGenerator(dsl) {
  const [html, setHtml] = useState('')

  useEffect(() => {
    async function doRender() {
      const children = <>{getNextElement(dsl)}</>

      const html = await render(children)

      setHtml(html)
    }

    doRender()
  }, [dsl])

  return html
}

export default function Page() {
  const [state, dispatch] = useReducer(reducer, {
    dsl: [
      {
        type: 'layout',
        children: [
          { type: 'p', text: 'Hello, world!' },
          { type: 'hr' },
          { type: 'p', text: 'This is a test email' },
          { type: 'hr' },
          { type: 'markdown', text: '# Goodbye!' },
        ],
      },
    ],
  })

  const dslRef = useRef(state.dsl)

  useEffect(() => {
    dslRef.current = state.dsl
  }, [state.dsl])

  const html = useHTMLGenerator(state.dsl)

  const widget = useWidgetInstance('chatbotkit-widget')

  useEffect(() => {
    // if the widget is not ready, do nothing

    if (!widget) {
      return
    }

    // setup the functions available to the widget AI bot

    widget.functions = {
      getDsl: {
        description: 'Get the DSL for the email template',
        parameters: {},
        handler: async () => {
          return { value: dslRef.current }
        },
      },
      setDsl: {
        description: 'Set the DSL for the email template',
        parameters: {
          type: 'object',
          properties: {
            value: {
              type: 'array',
              description: 'The DSL for the email template',
              items: {
                type: 'object',
                properties: {
                  type: {
                    type: 'string',
                    description: 'The type of element',
                  },
                  style: {
                    type: 'object',
                    description: 'The style for this element',
                    properties: {},
                  },
                  children: {
                    type: 'array',
                    description: 'The children elements',
                    items: {
                      type: 'object',
                      properties: {},
                    },
                  },
                },
              },
            },
          },
          required: ['value'],
        },
        handler: async ({ value }) => {
          dispatch({ type: 'SET_DSL', value })

          return { value }
        },
      },
    }
  }, [widget, dispatch])

  return (
    <SideBySidePage>
      <div className="w-full overflow-auto flex flex-cols justify-center items-center">
        <ResponsiveIframe
          srcDoc={html}
          className="w-full h-full border border-gray-200 rounded-xl"
        />
      </div>
      <div className="relative border border-1 border-gray-200 rounded-xl overflow-hidden flex min-w-[30rem] max-w-[60rem] shadow-lg">
        <chatbotkit-widget
          class="flex-1 w-full h-full"
          widget="/examples/email-template-generator/frame"
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
      title="Email Template Generator"
      description="This example demonstrates how to use client-side functions to create email templates generator chatbot using ChatBotKit."
      slug="email-template-generator"
      source={source}
    >
      {children}
    </Demo>
  )
}

Page.theme = 'light'

export async function getStaticProps() {
  const source = readSource(
    './pages/examples/email-template-generator/demo/index.jsx'
  )

  return {
    props: makeJsonSafe({
      source,
    }),
  }
}
