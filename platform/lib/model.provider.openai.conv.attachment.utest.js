import {
  convertMessages,
  convertMessagesToResponseInput,
} from '@/lib/model.provider.openai.conv'

import { installOpenAITestLanguageModels } from '@/jest/utils/openai'

const restoreTestLanguageModels = installOpenAITestLanguageModels()

afterAll(restoreTestLanguageModels)

// @note isolated from model.provider.openai.conv.utest.js on purpose: these
// tests mock the conversation context and the attachment download helper, and
// keeping them in their own file ensures those module mocks cannot leak into
// the (much larger) main conversation test suite.

jest.mock('@/lib/context.store', () => ({
  ...jest.requireActual('@/lib/context.store'),
  getContextConversation: jest.fn(() => ({ id: 'conv-1' })),
  getContextNamespace: jest.fn(() => null),
}))

jest.mock('@/lib/conversation.attachment', () => ({
  ...jest.requireActual('@/lib/conversation.attachment'),
  getConversationAttachmentDownloadURL: jest.fn(
    async (conversationId, name) =>
      `https://signed.example/${conversationId}/${name}`
  ),
}))

// @note the reachable, real attachment behaviour: an `attachment://name`
// reference embedded in message content (e.g. inside an uploadAttachment tool
// result) is rewritten to a freshly signed download URL before the request is
// sent. Both converters run this post-processing pass.

describe('convertMessages attachment:// replacement', () => {
  it('rewrites attachment:// references in message content to signed URLs', async () => {
    const messages = [
      { type: 'user', text: 'here is the file attachment://pic.png thanks' },
    ]

    const converted = await convertMessages(messages, 'gpt-4o')

    expect(converted[0].content).toBe(
      'here is the file https://signed.example/conv-1/pic.png thanks'
    )
  })

  it('rewrites every distinct attachment:// reference', async () => {
    const messages = [
      { type: 'user', text: 'attachment://a.png and attachment://b.png' },
    ]

    const converted = await convertMessages(messages, 'gpt-4o')

    expect(converted[0].content).toBe(
      'https://signed.example/conv-1/a.png and https://signed.example/conv-1/b.png'
    )
  })
})

describe('convertMessagesToResponseInput attachment:// replacement', () => {
  it('rewrites attachment:// references in input items to signed URLs', async () => {
    const messages = [
      { type: 'user', text: 'here is the file attachment://pic.png thanks' },
    ]

    const { input } = await convertMessagesToResponseInput(
      messages,
      'gpt-5.4-mini'
    )

    expect(input[0].content).toBe(
      'here is the file https://signed.example/conv-1/pic.png thanks'
    )
  })

  it('rewrites every distinct attachment:// reference', async () => {
    const messages = [
      { type: 'user', text: 'attachment://a.png and attachment://b.png' },
    ]

    const { input } = await convertMessagesToResponseInput(
      messages,
      'gpt-5.4-mini'
    )

    expect(input[0].content).toBe(
      'https://signed.example/conv-1/a.png and https://signed.example/conv-1/b.png'
    )
  })
})
