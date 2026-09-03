/* eslint-disable import/no-anonymous-default-export,react-hooks/rules-of-hooks */
import { useState } from 'react'

import {
  ConfigContext,
  ConversationContext,
  IntlContext,
  Messages,
  StateContext,
  ThemeContext,
} from './frame'

export default {
  title: 'Pages/Integrations/Widget/Frame/Messages',
  component: Messages,
  parameters: {
    layout: 'padded',
  },
  decorators: [
    (Story) => {
      const configContext = {
        botIcon: '🤖',
        userIcon: '👤',
        contextIcon: '📝',
        stream: true,
        tools: true,
        math: false,
        origin: 'https://chatbotkit.com',
      }

      const themeContext = {
        theme: {
          messageStyle: 'stack',
          optPlaceholder: 'Type your message...',
          buttonless: false,
        },
      }

      const intlContext = {
        getLocalText: (key, defaultText) => defaultText,
        locale: 'en',
        availableLocales: ['en'],
      }

      const conversationContext = {
        conversationId: 'test-conversation-id',
        token: 'test-token',
        tokenExpiresAt: Date.now() + 3600000,
        session: null,
      }

      const stateContext = {
        state: {
          hasMessages: true,
          contact: null,
        },
        setState: () => {},
      }

      return (
        <ConfigContext.Provider value={configContext}>
          <ThemeContext.Provider value={themeContext}>
            <IntlContext.Provider value={intlContext}>
              <ConversationContext.Provider value={conversationContext}>
                <StateContext.Provider value={stateContext}>
                  <div className="w-full max-w-4xl mx-auto bg-white rounded-lg shadow-lg p-4">
                    <Story />
                  </div>
                </StateContext.Provider>
              </ConversationContext.Provider>
            </IntlContext.Provider>
          </ThemeContext.Provider>
        </ConfigContext.Provider>
      )
    },
  ],
  argTypes: {
    intro: {
      control: 'text',
      description: 'Intro message displayed at the start',
    },
    initial: {
      control: 'text',
      description: 'Initial message from the bot',
    },
    visibleUserMessages: {
      control: 'number',
      description: 'Number of visible user messages (default: Infinity)',
    },
    visibleBotMessages: {
      control: 'number',
      description: 'Number of visible bot messages (default: Infinity)',
    },
    thinking: {
      control: 'boolean',
      description: 'Whether the bot is thinking',
    },
    writing: {
      control: 'boolean',
      description: 'Whether the bot is writing',
    },
    disabled: {
      control: 'boolean',
      description: 'Whether interactions are disabled',
    },
  },
}

const sampleMessages = [
  {
    id: '1',
    originalMessageId: 'msg-1',
    type: 'user',
    text: 'Hello! Can you help me?',
    createdAt: Date.now() - 300000,
  },
  {
    id: '2',
    originalMessageId: 'msg-2',
    type: 'bot',
    text: "Hello! Of course, I'd be happy to help you. What do you need assistance with?",
    createdAt: Date.now() - 280000,
  },
  {
    id: '3',
    originalMessageId: 'msg-3',
    type: 'user',
    text: 'I need information about your services.',
    createdAt: Date.now() - 260000,
  },
  {
    id: '4',
    originalMessageId: 'msg-4',
    type: 'bot',
    text: 'Great! Here are our main services:\n\n- **Customer Support**: 24/7 assistance\n- **Sales**: Product recommendations\n- **Technical Help**: Troubleshooting and guides\n\nWhich one would you like to know more about?',
    createdAt: Date.now() - 240000,
  },
]

export const Default = {
  args: {
    messages: sampleMessages,
    disabled: false,
  },
}

export const WithIntroAndInitial = {
  args: {
    intro: 'Welcome to our support chat!',
    initial: "Hi there! I'm here to help. How can I assist you today?",
    messages: sampleMessages.slice(2),
    disabled: false,
  },
}

export const EmptyState = {
  args: {
    intro: 'Welcome! Start a conversation.',
    initial: 'Hello! Feel free to ask me anything.',
    messages: [],
    disabled: false,
  },
}

export const ThinkingState = {
  args: {
    messages: sampleMessages,
    incoming: {
      id: 'incoming-1',
      type: 'bot',
      text: '',
    },
    thinking: true,
    writing: false,
    disabled: false,
  },
}

export const WritingState = {
  args: {
    messages: sampleMessages,
    incoming: {
      id: 'incoming-1',
      type: 'bot',
      text: "I'm currently typing a response...",
    },
    thinking: false,
    writing: true,
    disabled: false,
  },
}

export const LimitedVisibleMessages = {
  args: {
    messages: [
      ...sampleMessages,
      {
        id: '5',
        originalMessageId: 'msg-5',
        type: 'user',
        text: 'Tell me about customer support.',
        createdAt: Date.now() - 220000,
      },
      {
        id: '6',
        originalMessageId: 'msg-6',
        type: 'bot',
        text: 'Our customer support team is available 24/7 to help you with any issues.',
        createdAt: Date.now() - 200000,
      },
    ],
    visibleUserMessages: 2,
    visibleBotMessages: 2,
    disabled: false,
  },
}

export const WithMarkdownContent = {
  args: {
    messages: [
      {
        id: '1',
        originalMessageId: 'msg-1',
        type: 'user',
        text: 'Show me some formatted content',
        createdAt: Date.now() - 300000,
      },
      {
        id: '2',
        originalMessageId: 'msg-2',
        type: 'bot',
        text: `Here's some formatted content:

# Main Heading

This is a paragraph with **bold text** and *italic text*.

## Subheading

- Bullet point 1
- Bullet point 2
- Bullet point 3

Here's a [link](https://chatbotkit.com) and some \`inline code\`.

\`\`\`javascript
function hello() {
  console.log("Hello, World!");
}
\`\`\`

> This is a blockquote with important information.`,
        createdAt: Date.now() - 280000,
      },
    ],
    disabled: false,
  },
}

export const DisabledState = {
  args: {
    messages: sampleMessages,
    disabled: true,
  },
}

export const LongConversation = {
  args: {
    messages: [
      ...sampleMessages,
      ...Array.from({ length: 10 }, (_, i) => [
        {
          id: `user-${i + 5}`,
          originalMessageId: `msg-user-${i + 5}`,
          type: 'user',
          text: `This is user message number ${i + 5}`,
          createdAt: Date.now() - (180000 - i * 10000),
        },
        {
          id: `bot-${i + 5}`,
          originalMessageId: `msg-bot-${i + 5}`,
          type: 'bot',
          text: `This is bot response number ${
            i + 5
          }. Here's some information to help you.`,
          createdAt: Date.now() - (170000 - i * 10000),
        },
      ]).flat(),
    ],
    disabled: false,
  },
}

const InteractiveExample = (args) => {
  const [messages, setMessages] = useState(sampleMessages)
  const [thinking, setThinking] = useState(false)
  const [writing, setWriting] = useState(false)
  const [incomingMessage, setIncomingMessage] = useState(null)

  const addMessage = (type) => {
    const newMessage = {
      id: `${type}-${Date.now()}`,
      originalMessageId: `msg-${type}-${Date.now()}`,
      type,
      text:
        type === 'user'
          ? 'This is a new user message'
          : 'This is a new bot response',
      createdAt: Date.now(),
    }

    setMessages([...messages, newMessage])
  }

  const simulateBotResponse = () => {
    const fullText =
      'This is a simulated bot response with realistic typing speed. It demonstrates how messages appear character by character, creating a more natural and engaging user experience. Pretty cool, right?'

    setThinking(true)

    setTimeout(() => {
      setThinking(false)
      setWriting(true)

      const messageId = `bot-${Date.now()}`

      setIncomingMessage({
        id: messageId,
        type: 'bot',
        text: '',
      })

      let currentIndex = 0

      const typingSpeed = 30

      const typeInterval = setInterval(() => {
        if (currentIndex < fullText.length) {
          currentIndex++
          setIncomingMessage({
            id: messageId,
            type: 'bot',
            text: fullText.substring(0, currentIndex),
          })
        } else {
          clearInterval(typeInterval)

          setWriting(false)

          const newMessage = {
            id: messageId,
            originalMessageId: `msg-${messageId}`,
            type: 'bot',
            text: fullText,
            createdAt: Date.now(),
          }

          setMessages((prev) => [...prev, newMessage])

          setIncomingMessage(null)
        }
      }, typingSpeed)
    }, 1500)
  }

  return (
    <div className="space-y-4">
      <Messages
        {...args}
        messages={messages}
        thinking={thinking}
        writing={writing}
        incoming={
          thinking
            ? {
                id: 'incoming',
                type: 'bot',
                text: '',
              }
            : incomingMessage
        }
      />
      <div className="flex gap-2 mt-4 p-4 bg-gray-100 rounded">
        <button
          type="button"
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          onClick={() => addMessage('user')}
        >
          Add User Message
        </button>
        <button
          type="button"
          className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
          onClick={simulateBotResponse}
          disabled={thinking || writing}
        >
          Simulate Bot Response
        </button>
        <button
          type="button"
          className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
          onClick={() => setMessages([])}
        >
          Clear Messages
        </button>
      </div>
    </div>
  )
}

export const Interactive = {
  render: InteractiveExample,

  args: {
    intro: 'Welcome to the interactive demo!',
    initial: 'Try adding messages using the buttons below.',
  },
}

const BotMessageWithMicroExample = (args) => {
  const [messages, setMessages] = useState([
    {
      id: '1',
      originalMessageId: 'msg-1',
      type: 'user',
      text: 'Hello!',
      createdAt: Date.now() - 60000,
    },
    {
      id: '2',
      originalMessageId: 'msg-2',
      type: 'bot',
      text: 'Hi there! How can I help you today?',
      createdAt: Date.now() - 50000,
    },
  ])
  const [thinking, setThinking] = useState(false)
  const [incomingMessage, setIncomingMessage] = useState(null)

  const addBotMessageWithMicro = () => {
    setThinking(true)

    setIncomingMessage({
      id: `bot-micro-${Date.now()}`,
      type: 'bot',
      text: '',
    })

    setTimeout(() => {
      setThinking(false)

      const newMessage = {
        id: `bot-${Date.now()}`,
        originalMessageId: `msg-bot-${Date.now()}`,
        type: 'bot',
        text: 'Check out this awesome resource! 🌟',
        micro: {
          url: 'https://en.wikipedia.org/wiki/Artificial_intelligence',
          image:
            'https://upload.wikimedia.org/wikipedia/commons/thumb/f/fe/Kernel_Machine.svg/330px-Kernel_Machine.svg.png',
          title: 'Artificial Intelligence - Wikipedia',
          description:
            'Artificial intelligence (AI) is intelligence demonstrated by machines, as opposed to natural intelligence displayed by animals and humans.',
          publisher: 'Wikipedia',
        },
        createdAt: Date.now(),
      }

      setMessages((prev) => [...prev, newMessage])

      setIncomingMessage(null)
    }, 2000)
  }

  return (
    <div className="space-y-4">
      <Messages
        {...args}
        messages={messages}
        thinking={thinking}
        incoming={incomingMessage}
      />
      <div className="flex gap-2 mt-4 p-4 bg-gray-100 rounded">
        <button
          type="button"
          className="px-4 py-2 bg-purple-500 text-white rounded hover:bg-purple-600 disabled:bg-gray-400 disabled:cursor-not-allowed"
          onClick={addBotMessageWithMicro}
          disabled={thinking}
        >
          {thinking ? 'Bot is typing...' : 'Add Bot Message with Micro'}
        </button>
        <button
          type="button"
          className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
          onClick={() => setMessages(messages.slice(0, 2))}
        >
          Reset Messages
        </button>
      </div>
      <div className="p-4 bg-blue-50 rounded text-sm text-gray-700">
        <strong>What this demonstrates:</strong> Click the button to add a bot
        message with a rich preview card (micro). The message first shows a
        typing indicator for 2 seconds, then displays both the message text and
        a preview card with an image, title, and description that links to an
        external resource.
      </div>
    </div>
  )
}

export const BotMessageWithMicro = {
  render: BotMessageWithMicroExample,

  args: {
    intro: 'Interactive Bot Message with Micro Demo',
    initial:
      'Click the button below to see a bot message with a typing indicator!',
  },
}

// @note the default theme uses the bubble message style, so the following
// stories override the decorator theme to reproduce what most real widgets
// actually display

const bubbleThemeDecorator = (Story) => (
  <ThemeContext.Provider
    value={{
      theme: {
        messageStyle: 'bubble',
        optPlaceholder: 'Type your message...',
        buttonless: false,
      },
    }}
  >
    <Story />
  </ThemeContext.Provider>
)

export const IncomingWithWorkingAction = {
  decorators: [bubbleThemeDecorator],

  args: {
    messages: sampleMessages,
    incoming: {
      id: 'incoming-1',
      type: 'bot',
      text: '',
      actions: [
        {
          id: 'action-1',
          name: 'searchOrders',
          justification: 'Searching your recent orders',
          working: true,
        },
      ],
    },
    thinking: false,
    writing: true,
    disabled: false,
  },
}

export const ThinkingBeforeFirstEvent = {
  decorators: [bubbleThemeDecorator],

  args: {
    messages: [
      ...sampleMessages,
      {
        id: '5',
        originalMessageId: 'msg-5',
        type: 'user',
        text: 'Can you check my order status?',
        createdAt: Date.now() - 1000,
      },
    ],
    incoming: null,
    thinking: true,
    writing: false,
    disabled: false,
  },
}

export const PausedAfterPartialText = {
  decorators: [bubbleThemeDecorator],

  args: {
    messages: sampleMessages,
    incoming: {
      id: 'incoming-1',
      type: 'bot',
      text: 'Let me check your order status first.',
      actions: [
        {
          id: 'action-1',
          name: 'fetchOrderStatus',
          justification: 'Fetching the order status',
          working: true,
        },
      ],
    },
    thinking: false,
    writing: true,
    disabled: false,
  },
}

export const ContextMessageWithWorkingAction = {
  decorators: [bubbleThemeDecorator],

  args: {
    messages: [
      ...sampleMessages,
      {
        id: '5',
        originalMessageId: 'msg-5',
        type: 'context',
        text: '',
        actions: [
          {
            id: 'action-1',
            name: 'crawlWebsite',
            justification:
              'Crawling the website for product information across all of the catalog pages to find the most relevant matches for the query',
            working: true,
          },
        ],
        createdAt: Date.now() - 1000,
      },
    ],
    thinking: true,
    writing: false,
    disabled: false,
  },
}
