import { useEffect, useState } from 'react'

import { markdownToMessages as markdownToMessagesForDiscord } from '@/lib/discord.markdown'
import { markdownToMessages as markdownToMessagesForMessenger } from '@/lib/messenger.markdown'
import { markdownToBlocks as markdownToBlocksForSlack } from '@/lib/slack.markdown'
import { markdownToMessages as markdownToMessagesForTelegram } from '@/lib/telegram.markdown'
import { markdownToMessages as markdownToMessagesForWhatsApp } from '@/lib/whatsapp.markdown'

import Dashboard from '@/layouts/Dashboard'

import AutoTextarea from '@/components/AutoTextarea'
import CodeBlock from '@/components/CodeBlock'
import CopyButton from '@/components/CopyButton'
import FAQ from '@/components/FAQ'
import MarkdownCheatsheet from '@/components/MarkdownCheatsheet'
import NavHeader from '@/components/NavHeader'
import SimpleTabs from '@/components/SimpleTabs'
import ThemeBuilder from '@/components/ThemeBuilder'

import useRouter from '@/hooks/useRouter'

import faq from '@/content/faqs/website-playground-message.yaml'

export function Widget({ text }) {
  return (
    <ThemeBuilder
      className="w-full h-[800px] border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden"
      key={text} // @note we use the text as a key because it wont use the new messages
      intro={text}
      messages={[
        { type: 'bot', text },
        { type: 'user', text },
      ]}
      poweredBy={false}
    />
  )
}

export function Slack({ text }) {
  const [blocks, setBlocks] = useState([])

  useEffect(() => {
    async function convertToSlackBlocks() {
      setBlocks(await markdownToBlocksForSlack(text))
    }

    convertToSlackBlocks()
  }, [text])

  return (
    <div className="space-y-2">
      <p className="text-sm text-gray-600 dark:text-gray-300">
        There is currently no rendering for Slack blocks. You can use the
        following JSON to see how the blocks are structured.
      </p>
      <div>
        <CodeBlock className="text-sm h-[800px]" language="json">
          {JSON.stringify(blocks, null, 2)}
        </CodeBlock>
      </div>
    </div>
  )
}

export function Discord({ text }) {
  const [blocks, setBlocks] = useState([])

  useEffect(() => {
    async function convertToSlackBlocks() {
      setBlocks(await markdownToMessagesForDiscord(text))
    }

    convertToSlackBlocks()
  }, [text])

  return (
    <div className="space-y-2">
      <p className="text-sm text-gray-600 dark:text-gray-300">
        There is currently no rendering for Discord message. You can use the
        following JSON to see how the blocks are structured.
      </p>
      <div>
        <CodeBlock className="text-sm h-[800px]" language="json">
          {JSON.stringify(blocks, null, 2)}
        </CodeBlock>
      </div>
    </div>
  )
}

export function WhatsApp({ text }) {
  const [messages, setMessages] = useState([])

  useEffect(() => {
    async function convertToWhatsAppMessages() {
      setMessages(await markdownToMessagesForWhatsApp(text))
    }

    convertToWhatsAppMessages()
  }, [text])

  return (
    <div className="space-y-2">
      <p className="text-sm text-gray-600 dark:text-gray-300">
        There is currently no rendering for WhatsApp messages. You can use the
        following JSON to see how the messages are structured.
      </p>
      <div>
        <CodeBlock className="text-sm h-[800px]" language="json">
          {JSON.stringify(messages, null, 2)}
        </CodeBlock>
      </div>
    </div>
  )
}

export function Messenger({ text }) {
  const [messages, setMessages] = useState([])

  useEffect(() => {
    async function convertToMessengerMessages() {
      setMessages(await markdownToMessagesForMessenger(text))
    }

    convertToMessengerMessages()
  }, [text])

  return (
    <div className="space-y-2">
      <p className="text-sm text-gray-600 dark:text-gray-300">
        There is currently no rendering for Messenger messages. You can use the
        following JSON to see how the messages are structured.
      </p>
      <div>
        <CodeBlock className="text-sm h-[800px]" language="json">
          {JSON.stringify(messages, null, 2)}
        </CodeBlock>
      </div>
    </div>
  )
}

export function Telegram({ text }) {
  const [messages, setMessages] = useState([])

  useEffect(() => {
    async function convertToTelegramMessages() {
      setMessages(await markdownToMessagesForTelegram(text))
    }

    convertToTelegramMessages()
  }, [text])

  return (
    <div className="space-y-2">
      <p className="text-sm text-gray-600 dark:text-gray-300">
        There is currently no rendering for Telegram messages. You can use the
        following JSON to see how the messages are structured.
      </p>
      <div>
        <CodeBlock className="text-sm h-[800px]" language="json">
          {JSON.stringify(messages, null, 2)}
        </CodeBlock>
      </div>
    </div>
  )
}

export default function Index() {
  const router = useRouter()

  const [text, setText] = useState('This is the start of something amazing.')

  useEffect(() => {
    if (router.query.text) {
      setText(router.query.text)
    }
  }, [router.query.text])

  return (
    <section className="section-white">
      <div className="main-page">
        <NavHeader
          link="/playground"
          caption="playgrounds"
          title="Message"
          beta={true}
        >
          A playground to test and generate message rendering widgets.
        </NavHeader>
        <SimpleTabs
          tabs={{
            Input: (
              <div className="space-y-2">
                <AutoTextarea
                  className="default-input max-h-[800px] !overflow-auto"
                  value={text}
                  onChange={(event) => setText(event.target.value)}
                  placeholder="Type your markdown message here..."
                />
                <MarkdownCheatsheet />
              </div>
            ),
            Widget: <Widget text={text} />,
            Slack: <Slack text={text} />,
            Discord: <Discord text={text} />,
            WhatsApp: <WhatsApp text={text} />,
            Messenger: <Messenger text={text} />,
            Telegram: <Telegram text={text} />,
          }}
        />
        <div>
          <CopyButton
            className="default-button"
            text={router.absoluteHref({
              pathname: router.pathname,
              query: { text },
            })}
          >
            Get Permalink
          </CopyButton>
        </div>
      </div>
    </section>
  )
}

Index.getLayout = function (children) {
  return (
    <Dashboard
      breadcrumbs={['Playground', 'ChatBotKit']}
      title="Message Rendering Playground"
      description="A playground to test and generate message rendering widgets."
      keywords="chatbot, playground, message, rendering, widget, slack, whatsapp, telegram"
      image={`/playground/message/card`}
    >
      {children}
      <FAQ faq={faq} />
    </Dashboard>
  )
}

/**
 * @doc Playgrounds
 * @index 90
 *
 * ## Message
 *
 * The [Message Playground](https://chatbotkit.com/playground/message) helps you create and preview message content across multiple rendering targets. It is useful when you want to verify how the same content appears in widget, Slack, Discord, WhatsApp, Messenger, or Telegram contexts.
 *
 * Use it to test formatting, compare renderers, and make sure a message looks correct before you use it in a live integration.
 */
