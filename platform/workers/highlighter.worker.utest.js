/* eslint-disable @typescript-eslint/no-require-imports */
/* global globalThis */
describe('highlighter worker', () => {
  beforeEach(() => {
    jest.resetModules()

    Object.defineProperty(globalThis, 'self', {
      configurable: true,
      value: {
        postMessage: jest.fn(),
      },
    })
  })

  afterEach(() => {
    delete globalThis.self
  })

  it('does not re-highlight generated marker attributes', async () => {
    require('./highlighter.worker')

    await globalThis.self.onmessage({
      data: {
        value: "import ChatBotKit from '@chatbotkit/sdk'",
        keywords: [
          /(?<string>'(?:\\.|[^'\\])*')/gm,
          /\b(?<keyword>class|from|import)\b/gm,
        ],
      },
    })

    expect(globalThis.self.postMessage).toHaveBeenCalledWith(
      '<mark class="keyword">import</mark> ChatBotKit <mark class="keyword">from</mark> <mark class="string">&#039;@chatbotkit/sdk&#039;</mark>'
    )
  })
})
