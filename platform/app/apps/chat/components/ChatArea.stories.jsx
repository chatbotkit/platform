/* eslint-disable import/no-anonymous-default-export */
import { useRef, useState } from 'react'

import Confirm from '@/components/Confirm'
import GlobalRoot from '@/components/GlobalRoot'

import ChatArea from './ChatArea'

import { action } from '@storybook/addon-actions'

export default {
  title: 'Apps/Chat/ChatArea',
  component: ChatArea,
  parameters: {
    layout: 'fullscreen',
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
      <div className="min-h-screen flex flex-col justify-end p-4">
        <Confirm>
          <Story />
        </Confirm>
        <GlobalRoot />
      </div>
    ),
  ],
  argTypes: {
    hasMessages: {
      control: 'boolean',
      description: 'Whether there are existing messages in the chat',
    },
    thinking: {
      control: 'boolean',
      description: 'Whether the AI is thinking/processing',
    },
    writing: {
      control: 'boolean',
      description: 'Whether the AI is currently writing a response',
    },
    improvingPrompt: {
      control: 'boolean',
      description: 'Whether the AI is improving the prompt',
    },
    className: {
      control: 'text',
      description: 'Additional CSS classes',
    },
  },
}

// Mock data
const mockBots = [
  { id: 'auto', name: 'Auto', auto: true },
  {
    id: 'assistant',
    name: 'Assistant',
    nick: 'AI Assistant',
    icon: '@heroicons/chat-bubble-left-right',
    auto: false,
  },
  {
    id: 'coder',
    name: 'Code Helper',
    nick: 'Coder',
    icon: '@heroicons/code-bracket',
    auto: false,
  },
]

const mockModels = [
  { id: 'auto', name: 'Auto', auto: true },
  {
    id: 'gpt-4',
    name: 'GPT-4',
    icon: '@heroicons/sparkles',
    auto: false,
  },
  {
    id: 'claude',
    name: 'Claude',
    icon: '@heroicons/cpu-chip',
    auto: false,
  },
]

const mockSources = [
  { id: 'auto', name: 'Auto', auto: true },
  {
    id: 'docs',
    name: 'Documentation',
    icon: '@heroicons/document-text',
    auto: false,
  },
  {
    id: 'knowledge',
    name: 'Knowledge Base',
    icon: '@heroicons/book-open',
    auto: false,
  },
]

const mockFeatures = {
  promptImprovement: {
    enabled: true,
  },
}

// Story template wrapper
const ChatAreaTemplate = (args) => {
  const editorRef = useRef()
  const [attachments, setAttachments] = useState(args.attachments || [])
  const [clips, setClips] = useState(args.clips || [])

  return (
    <ChatArea
      {...args}
      editorRef={editorRef}
      bots={args.bots || mockBots}
      models={args.models || mockModels}
      sources={args.sources || mockSources}
      attachments={attachments}
      setAttachments={setAttachments}
      clips={clips}
      setClips={setClips}
      selectedBot={args.selectedBot || mockBots[1]}
      selectedModel={args.selectedModel || mockModels[1]}
      selectedSources={
        args.selectedSources !== undefined ? args.selectedSources : []
      }
      features={args.features || mockFeatures}
      handleOnSubmit={action('onSubmit')}
      handleSubmit={action('submit')}
      handleAttachFile={action('attachFile')}
      handleLargeTextPaste={action('largeTextPaste')}
      handleTakeScreenshot={action('takeScreenshot')}
      handleSelectBotClick={action('selectBotClick')}
      handleSelectModelClick={action('selectModelClick')}
      handleSelectSourcesClick={action('selectSourcesClick')}
      handleAbortStream={action('abortStream')}
      handleImprovePrompt={action('improvePrompt')}
    />
  )
}

export const Default = {
  render: ChatAreaTemplate,
  args: {
    hasMessages: false,
    thinking: false,
    writing: false,
    improvingPrompt: false,
    selectedSources: [], // Explicitly set to empty array to hide sources
    selectedBot: mockBots[0], // Use auto bot for default
  },
}

export const WithMessages = {
  render: ChatAreaTemplate,
  args: {
    hasMessages: true,
    thinking: false,
    writing: false,
    improvingPrompt: false,
    selectedBot: mockBots[0], // Use auto bot
  },
}

export const Thinking = {
  render: ChatAreaTemplate,
  args: {
    hasMessages: true,
    thinking: true,
    writing: false,
    improvingPrompt: false,
    selectedBot: mockBots[0], // Use auto bot
  },
}

export const Writing = {
  render: ChatAreaTemplate,
  args: {
    hasMessages: true,
    thinking: false,
    writing: true,
    improvingPrompt: false,
    selectedBot: mockBots[0], // Use auto bot
  },
}

export const ImprovingPrompt = {
  render: ChatAreaTemplate,
  args: {
    hasMessages: true,
    thinking: false,
    writing: false,
    improvingPrompt: true,
    selectedBot: mockBots[0], // Use auto bot
  },
}

export const WithAttachments = {
  render: ChatAreaTemplate,
  args: {
    hasMessages: true,
    attachments: [
      {
        id: '1',
        name: 'document.pdf',
        type: 'application/pdf',
        size: '2.4 MB',
      },
      {
        id: '2',
        name: 'image.png',
        type: 'image/png',
        size: '1.2 MB',
      },
    ],
    thinking: false,
    writing: false,
    improvingPrompt: false,
    selectedBot: mockBots[0], // Use auto bot
  },
}

export const WithClips = {
  render: ChatAreaTemplate,
  args: {
    hasMessages: true,
    clips: [
      {
        comment: 'Important note about implementation',
      },
      {
        comment: 'Code snippet for reference',
      },
    ],
    thinking: false,
    writing: false,
    improvingPrompt: false,
    selectedBot: mockBots[0], // Use auto bot
  },
}

export const WithAttachmentsAndClips = {
  render: ChatAreaTemplate,
  args: {
    hasMessages: true,
    attachments: [
      {
        id: '1',
        name: 'requirements.txt',
        type: 'text/plain',
        size: '0.5 KB',
      },
    ],
    clips: [
      {
        comment: 'Key requirement from discussion',
      },
    ],
    thinking: false,
    writing: false,
    improvingPrompt: false,
    selectedBot: mockBots[0], // Use auto bot
  },
}

export const MinimalBotSelection = {
  render: ChatAreaTemplate,
  args: {
    hasMessages: false,
    bots: [mockBots[0]], // Only auto bot
    thinking: false,
    writing: false,
    improvingPrompt: false,
    selectedBot: mockBots[0], // Use auto bot
  },
}

export const MinimalModelSelection = {
  render: ChatAreaTemplate,
  args: {
    hasMessages: false,
    models: [mockModels[0]], // Only auto model
    thinking: false,
    writing: false,
    improvingPrompt: false,
    selectedBot: mockBots[0], // Use auto bot
  },
}

export const MinimalSourceSelection = {
  render: ChatAreaTemplate,
  args: {
    hasMessages: false,
    sources: [mockSources[0]], // Only auto source
    thinking: false,
    writing: false,
    improvingPrompt: false,
    selectedBot: mockBots[0], // Use auto bot
  },
}

export const NoPromptImprovement = {
  render: ChatAreaTemplate,
  args: {
    hasMessages: true,
    features: {
      promptImprovement: {
        enabled: false,
      },
    },
    thinking: false,
    writing: false,
    improvingPrompt: false,
    selectedBot: mockBots[0], // Use auto bot
  },
}

export const WithTrace = {
  render: ChatAreaTemplate,
  args: {
    hasMessages: true,
    trace: true,
    thinking: false,
    writing: false,
    improvingPrompt: false,
    selectedBot: mockBots[0], // Use auto bot
  },
}

export const LoadingBots = {
  render: ChatAreaTemplate,
  args: {
    hasMessages: false,
    bots: [], // Empty array to simulate loading
    thinking: false,
    writing: false,
    improvingPrompt: false,
    selectedBot: mockBots[0], // Use auto bot
  },
}

export const MultipleSourcesSelected = {
  render: ChatAreaTemplate,
  args: {
    hasMessages: false,
    selectedSources: [mockSources[1], mockSources[2]],
    thinking: false,
    writing: false,
    improvingPrompt: false,
    selectedBot: mockBots[0], // Use auto bot
  },
}

export const WithSpecificModelSelected = {
  render: ChatAreaTemplate,
  args: {
    hasMessages: false,
    selectedModel: mockModels[2], // Claude model selected
    thinking: false,
    writing: false,
    improvingPrompt: false,
    selectedBot: mockBots[0], // Use auto bot
  },
}

export const WithSpecificBotSelected = {
  render: ChatAreaTemplate,
  args: {
    hasMessages: false,
    selectedBot: mockBots[2], // Code Helper bot selected
    thinking: false,
    writing: false,
    improvingPrompt: false,
  },
}
