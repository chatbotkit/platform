import { readSource } from '@/lib/source'
import { makeJsonSafe } from '@/lib/struct'

import Demo, { SideBySidePage } from '@/layouts/Demo'

import PagePlaceholder from '@/components/PagePlaceholder'

// source start
import useWidgetInstance from '@chatbotkit/react/hooks/useWidgetInstance'
import useWidgetInstanceFunctions from '@chatbotkit/react/hooks/useWidgetInstanceFunctions'

export default function Page() {
  const widget = useWidgetInstance('chatbotkit-widget')

  useWidgetInstanceFunctions({
    selector: 'chatbotkit-widget',
    functions: {
      bookMeeting: {
        description:
          'When invoked, the user will be presented with a form to book a meeting.',
        parameters: {},
        handler: () => {
          widget?.render({
            frame:
              'https://calendar.google.com/calendar/appointments/schedules/AcZssZ05tgQAH_KuE1nSqhagde5Xwg2BqZ-WGUQiIYI49cZBpWr0pALy1v04eCckGzyF1dp6L1gnjJCn?gv=true',
          })

          const controller = new AbortController()

          controller.abort()

          return controller.signal
        },
      },
    },
  })

  return (
    <SideBySidePage>
      <div className="w-full overflow-auto flex flex-cols justify-center items-center border border-gray-200 rounded-xl p-2">
        <div className="flex-1 w-full h-full">
          <PagePlaceholder />
        </div>
      </div>
      <div className="relative border border-1 border-gray-200 rounded-xl overflow-hidden flex min-w-[30rem] max-w-[60rem] shadow-lg">
        <chatbotkit-widget
          class="flex-1 w-full h-full"
          widget="/examples/call-analyzer/frame" // @note you would use your own chatbotkit widget id here
        />
      </div>
    </SideBySidePage>
  )
}
// source end

Page.getLayout = function getLayout(children, { source }) {
  return (
    <Demo
      title="Call Analyzer"
      description="This demo showcases an AI system that can analyze calls and provide insights."
      slug="call-analyzer"
      source={source}
    >
      {children}
    </Demo>
  )
}

Page.theme = 'light'

export async function getStaticProps() {
  const source = readSource('./pages/examples/call-analyzer/demo/index.jsx')

  return {
    props: makeJsonSafe({
      source,
    }),
  }
}
