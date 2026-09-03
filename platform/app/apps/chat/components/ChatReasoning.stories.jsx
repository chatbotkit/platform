/* eslint-disable import/no-anonymous-default-export */
import GlobalRoot from '@/components/GlobalRoot'

import ChatReasoning from './ChatReasoning'

export default {
  title: 'Apps/Chat/Reasoning',
  component: ChatReasoning,
  parameters: {
    layout: 'padded',
    backgrounds: {
      default: 'light',
      values: [
        { name: 'light', value: '#f9fafb' },
        { name: 'dark', value: '#111827' },
      ],
    },
  },
  decorators: [
    (Story) => (
      <div className="min-h-screen p-6">
        <Story />
        <GlobalRoot />
      </div>
    ),
  ],
  argTypes: {
    reasoning: {
      control: 'text',
      description: 'The reasoning text to display',
    },
    working: {
      control: 'boolean',
      description: 'Whether the AI is currently working',
      defaultValue: true,
    },
  },
}

const fakeReasoning = `I will first consider the user's question and constraints.

1. Identify key requirements and any missing information.
2. Outline a minimal, safe approach that can be improved iteratively.
3. When an external action is needed, I will plan it as [action](#action) and explain the expected outcome.

Next, I will draft the response in clear, concise steps, verify edge cases, and ensure the output matches the requested format.`

export const Default = {
  render: (args) => (
    <div className="max-w-xl">
      <ChatReasoning {...args} reasoning={args.reasoning || fakeReasoning} />
    </div>
  ),
  args: {
    working: true,
  },
}

export const LongReasoningCollapsed = {
  render: (args) => (
    <div className="max-w-xl">
      <ChatReasoning
        {...args}
        reasoning={
          args.reasoning ||
          `${fakeReasoning}\n\n${Array.from({ length: 8 })
            .map(
              (_, i) =>
                `Additional consideration ${
                  i + 1
                }: Evaluate trade-offs and assumptions.`
            )
            .join('\n')}`
        }
      />
    </div>
  ),
  args: {
    working: true,
  },
}

export const ReasoningEnded = {
  render: (args) => (
    <div className="max-w-xl">
      <ChatReasoning {...args} reasoning={args.reasoning || fakeReasoning} />
    </div>
  ),
  args: {
    working: false,
  },
}
