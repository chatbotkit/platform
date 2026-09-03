import { readSource } from '@/lib/source'
import { makeJsonSafe } from '@/lib/struct'

import Demo, { SideBySidePage } from '@/layouts/Demo'

import DotsLoader from '@/components/DotsLoader'

// source start
import useWidgetInstance from '@chatbotkit/react/hooks/useWidgetInstance'

import clsx from 'clsx'

/**
 * The following example demonstrates how to send messages to the widget. The
 * example provides several buttons. When a button is clicked, the message is
 * sent using the `sendMessage` method of the widget. The method accepts an
 * object with the following properties:
 * - `message` (string): The message to send.
 * - `hidden` (boolean): Whether the message should be hidden from the user.
 * - `respond` (boolean): Whether the widget should respond to the message.
 */
export default function Page() {
  // acquire the widget element and wait for it to be ready

  const widget = useWidgetInstance('chatbotkit-widget')

  // render

  return (
    <SideBySidePage>
      <div className="w-full overflow-auto flex flex-cols justify-center items-center">
        <div className="flex flex-col gap-2">
          <button
            className="default-button"
            type="button"
            onClick={async () => {
              // send message

              widget.sendMessage({ message: 'Hello, world!' })
            }}
            disabled={!widget}
          >
            Send Message
          </button>
          <button
            className="default-button"
            type="button"
            onClick={async () => {
              // send message and respond

              widget.sendMessage({ message: 'Hello, world!', respond: true })
            }}
            disabled={!widget}
          >
            Send Message & Respond
          </button>
          <button
            className="default-button"
            type="button"
            onClick={async () => {
              // send hidden message

              widget.sendMessage({ message: 'Hello, world!', hidden: true })
            }}
            disabled={!widget}
          >
            Send Hidden Message
          </button>
          <button
            className="default-button"
            type="button"
            onClick={async () => {
              // send hidden message and respond

              widget.sendMessage({
                message: 'Hello, world!',
                hidden: true,
                respond: true,
              })
            }}
            disabled={!widget}
          >
            Send Hidden Message & Respond
          </button>
        </div>
      </div>
      <div className="relative border border-1 border-gray-200 rounded-xl overflow-hidden flex min-w-[30rem] max-w-[60rem] shadow-lg">
        <chatbotkit-widget
          class="flex-1 w-full h-full"
          widget="/examples/message-sending/frame"
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
      title="Message Sending"
      description="This demo showcases how to send messages to the ChatBotKit AI Widget programmatically."
      slug="message-sending"
      source={source}
    >
      {children}
    </Demo>
  )
}

Page.theme = 'light'

export async function getStaticProps() {
  const source = readSource('./pages/examples/message-sending/demo/index.jsx')

  return {
    props: makeJsonSafe({
      source,
    }),
  }
}
