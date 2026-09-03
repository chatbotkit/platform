import { useEffect } from 'react'

import { readSource } from '@/lib/source'
import { makeJsonSafe } from '@/lib/struct'

import Demo, { SideBySidePage } from '@/layouts/Demo'

import DotsLoader from '@/components/DotsLoader'

// source start
import useWidgetInstance from '@chatbotkit/react/hooks/useWidgetInstance'

import clsx from 'clsx'

/**
 * The example demonstrates how to use client-side functions to interact with
 * the ChatBotKit AI Widget. The example allows an AI bot to control the number
 * of boxes rendered and the animations applied to them. All of these actions
 * are performed via chat messages.
 */
export default function Page() {
  const widget = useWidgetInstance('chatbotkit-widget')

  useEffect(() => {
    // if the widget is not ready, do nothing

    if (!widget) {
      return
    }

    // setup the functions available to the widget AI bot

    widget.functions = {
      bookMeeting: {
        description:
          'When invoked, the user will be presented with a form to book a meeting.',
        parameters: {},
        handler: () => {
          widget.render({
            frame:
              'https://calendar.google.com/calendar/appointments/schedules/AcZssZ05tgQAH_KuE1nSqhagde5Xwg2BqZ-WGUQiIYI49cZBpWr0pALy1v04eCckGzyF1dp6L1gnjJCn?gv=true',
          })

          const controller = new AbortController()

          controller.abort()

          return controller.signal
        },
      },
    }
  }, [widget])

  return (
    <SideBySidePage>
      <div className="w-full overflow-auto flex flex-cols justify-center items-center"></div>
      <div className="relative border border-1 border-gray-200 rounded-xl overflow-hidden flex min-w-[30rem] max-w-[60rem] shadow-lg">
        <chatbotkit-widget
          class="flex-1 w-full h-full"
          widget="/examples/custom-components/frame" // @note you would use your own chatbotkit widget id here
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
      title="Custom Components"
      description="This demo shows how to use custom components in ChatBotKit."
      slug="custom-components"
      source={source}
    >
      {children}
    </Demo>
  )
}

Page.theme = 'light'

export async function getStaticProps() {
  const source = readSource('./pages/examples/custom-components/demo/index.jsx')

  return {
    props: makeJsonSafe({
      source,
    }),
  }
}
