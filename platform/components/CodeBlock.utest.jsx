/* eslint-disable @typescript-eslint/no-require-imports */
import CodeBlock, { CodeBlockInternal } from './CodeBlock'

import '@testing-library/jest-dom'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'

jest.mock('@/lib/toast', () => ({
  __esModule: true,
  default: {
    success: jest.fn(),
    error: jest.fn(),
  },
}))

jest.mock('@/components/NoSsr', () => {
  return function NoSsr({ children }) {
    return children
  }
})

jest.mock('@/hooks/useTheme', () => ({
  __esModule: true,
  default: jest.fn(),
}))

jest.mock('@/lib/highlighter', () => {
  const mockCodeToHtml = jest.fn(
    (code, options) =>
      `<pre class="shiki nord"><code><span class="line" data-language="${options.lang}">${code}</span></code></pre>`
  )

  const MockShikiStreamHighlighter = jest
    .fn()
    .mockImplementation((highlighter, options) => ({
      update: jest.fn(
        (code) =>
          `<pre class="shiki ${
            options.theme === 'light' ? 'github-light' : 'github-dark'
          }"><code><span class="line" data-language="${options.lang}">${code}</span></code></pre>`
      ),
      reset: jest.fn(),
    }))

  return {
    getHighlighter: jest.fn().mockResolvedValue({
      codeToHtml: mockCodeToHtml,
      codeToTokens: jest.fn((code, options) => ({
        tokens: [[{ content: code, color: '#ffffff' }]],
        grammarState: {},
      })),
      getLoadedLanguages: jest
        .fn()
        .mockReturnValue(['javascript', 'python', 'http', 'plain', 'text']),
      loadLanguage: jest.fn().mockResolvedValue(undefined),
    }),
    highlight: jest.fn(async ({ code, lang }) => {
      return mockCodeToHtml(code, { lang })
    }),
    ShikiStreamHighlighter: MockShikiStreamHighlighter,
  }
})

const toast = require('@/lib/toast').default
const useTheme = require('@/hooks/useTheme').default

afterEach(async () => {
  await act(async () => {
    await Promise.resolve()
    await Promise.resolve()
  })
})

describe('CodeBlockInternal', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    useTheme.mockReturnValue({ theme: 'light' })

    Object.defineProperty(window.navigator, 'clipboard', {
      value: {
        writeText: jest.fn().mockResolvedValue(undefined),
      },
      writable: true,
      configurable: true,
    })
  })

  describe('basic functionality', () => {
    it('should render code content', async () => {
      render(
        <CodeBlockInternal language="javascript">
          const x = 42
        </CodeBlockInternal>
      )

      await waitFor(() => {
        expect(
          screen.getByText('const x = 42', { exact: false })
        ).toBeInTheDocument()
      })
    })

    it('should highlight with specified language', async () => {
      render(
        <CodeBlockInternal language="python">
          print(&apos;hello&apos;)
        </CodeBlockInternal>
      )

      await waitFor(() => {
        const line = document.querySelector('[data-language="python"]')

        expect(line).toBeInTheDocument()
      })
    })

    it('should render copy button by default', () => {
      render(
        <CodeBlockInternal language="javascript">
          const x = 42
        </CodeBlockInternal>
      )

      const copyButton = document.querySelector('.cursor-pointer')

      expect(copyButton).toBeInTheDocument()
    })

    it('should not render copy button when copy=false', () => {
      render(
        <CodeBlockInternal language="javascript" copy={false}>
          const x = 42
        </CodeBlockInternal>
      )

      const copyButton = document.querySelector('.cursor-pointer')

      expect(copyButton).not.toBeInTheDocument()
    })
  })

  describe('language detection', () => {
    it('should detect HTTP methods from plain text starting with GET', async () => {
      render(
        <CodeBlockInternal language="plain">GET /api/users</CodeBlockInternal>
      )

      await waitFor(() => {
        const line = document.querySelector('[data-language="http"]')

        expect(line).toBeInTheDocument()
      })
    })

    it('should detect HTTP methods from plain text starting with POST', async () => {
      render(
        <CodeBlockInternal language="plain">POST /api/users</CodeBlockInternal>
      )

      await waitFor(() => {
        const line = document.querySelector('[data-language="http"]')

        expect(line).toBeInTheDocument()
      })
    })

    it('should detect HTTP methods from plain text starting with PUT', async () => {
      render(
        <CodeBlockInternal language="plain">PUT /api/users/1</CodeBlockInternal>
      )

      await waitFor(() => {
        const line = document.querySelector('[data-language="http"]')

        expect(line).toBeInTheDocument()
      })
    })

    it('should detect HTTP methods from plain text starting with DELETE', async () => {
      render(
        <CodeBlockInternal language="plain">
          DELETE /api/users/1
        </CodeBlockInternal>
      )

      await waitFor(() => {
        const line = document.querySelector('[data-language="http"]')

        expect(line).toBeInTheDocument()
      })
    })

    it('should detect HTTP response from plain text starting with HTTP/1.1', async () => {
      render(
        <CodeBlockInternal language="plain">HTTP/1.1 200 OK</CodeBlockInternal>
      )

      await waitFor(() => {
        const line = document.querySelector('[data-language="http"]')

        expect(line).toBeInTheDocument()
      })
    })

    it('should keep plain language for non-HTTP content', async () => {
      render(
        <CodeBlockInternal language="plain">
          Just some plain text
        </CodeBlockInternal>
      )

      await waitFor(() => {
        const line = document.querySelector('[data-language="plain"]')

        expect(line).toBeInTheDocument()
      })
    })
  })

  describe('theme support', () => {
    it('should pass light theme to stream highlighter', async () => {
      const { ShikiStreamHighlighter } = require('@/lib/highlighter')

      useTheme.mockReturnValue({ theme: 'light' })

      render(
        <CodeBlockInternal language="javascript">
          const x = 42
        </CodeBlockInternal>
      )

      await waitFor(() => {
        expect(ShikiStreamHighlighter).toHaveBeenCalledWith(
          expect.anything(),
          expect.objectContaining({ theme: 'light' })
        )
      })
    })

    it('should pass dark theme to stream highlighter', async () => {
      const { ShikiStreamHighlighter } = require('@/lib/highlighter')

      useTheme.mockReturnValue({ theme: 'dark' })

      render(
        <CodeBlockInternal language="javascript">
          const x = 42
        </CodeBlockInternal>
      )

      await waitFor(() => {
        expect(ShikiStreamHighlighter).toHaveBeenCalledWith(
          expect.anything(),
          expect.objectContaining({ theme: 'dark' })
        )
      })
    })
  })

  describe('streaming updates', () => {
    it('should highlight after async setup completes', async () => {
      const { ShikiStreamHighlighter } = require('@/lib/highlighter')

      render(
        <CodeBlockInternal language="javascript">
          const x = 42
        </CodeBlockInternal>
      )

      // Plain text shown while setup is in progress
      expect(screen.getByText('const x = 42')).toBeInTheDocument()

      // Wait for the async setup to complete and highlighted HTML to appear
      await waitFor(() => {
        expect(ShikiStreamHighlighter).toHaveBeenCalledWith(
          expect.anything(),
          expect.objectContaining({ lang: 'javascript' })
        )
      })

      await waitFor(() => {
        expect(
          document.querySelector('[data-language="javascript"]')
        ).toBeInTheDocument()
      })
    })

    it('should update highlighted content on every streaming token without debounce', async () => {
      const { ShikiStreamHighlighter } = require('@/lib/highlighter')

      const { rerender } = render(
        <CodeBlockInternal language="javascript">const</CodeBlockInternal>
      )

      // Wait for setup then initial highlight
      await waitFor(() => {
        expect(
          document.querySelector('[data-language="javascript"]')
        ).toBeInTheDocument()
      })

      const mockInstance = ShikiStreamHighlighter.mock.results[0].value

      mockInstance.update.mockClear()

      // Simulate streaming tokens - useLayoutEffect fires synchronously on each
      // rerender so every token update produces immediate highlighted output
      rerender(
        <CodeBlockInternal language="javascript">
          const answer
        </CodeBlockInternal>
      )

      await waitFor(() => {
        expect(mockInstance.update).toHaveBeenCalledWith('const answer')
      })

      rerender(
        <CodeBlockInternal language="javascript">
          const answer = 42
        </CodeBlockInternal>
      )

      await waitFor(() => {
        expect(mockInstance.update).toHaveBeenCalledWith('const answer = 42')
      })

      // Both calls share the same stream highlighter instance (no reset between tokens)
      expect(mockInstance.update).toHaveBeenCalledTimes(2)
    })
  })

  describe('copy functionality', () => {
    it('should copy code to clipboard on copy button click', async () => {
      const writeTextMock = jest.fn().mockResolvedValue(undefined)

      Object.defineProperty(window.navigator, 'clipboard', {
        value: { writeText: writeTextMock },
        writable: true,
        configurable: true,
      })

      render(
        <CodeBlockInternal language="javascript">
          const x = 42
        </CodeBlockInternal>
      )

      const copyButton = document.querySelector('.cursor-pointer')

      fireEvent.click(copyButton)

      await new Promise((resolve) => setTimeout(resolve, 0))

      expect(writeTextMock).toHaveBeenCalledWith('const x = 42')
      expect(toast.success).toHaveBeenCalledWith(
        'Code copied to your clipboard'
      )
    })

    it('should show error toast when clipboard API fails', async () => {
      const writeTextMock = jest
        .fn()
        .mockRejectedValue(new Error('Permission denied'))

      Object.defineProperty(window.navigator, 'clipboard', {
        value: { writeText: writeTextMock },
        writable: true,
        configurable: true,
      })

      render(
        <CodeBlockInternal language="javascript">
          const x = 42
        </CodeBlockInternal>
      )

      const copyButton = document.querySelector('.cursor-pointer')

      fireEvent.click(copyButton)

      await new Promise((resolve) => setTimeout(resolve, 0))

      expect(toast.error).toHaveBeenCalledWith(
        'Failed to copy code to clipboard'
      )
    })
  })

  describe('custom actions', () => {
    it('should render custom actions alongside copy button', () => {
      const customAction = (
        <button type="button" data-testid="custom-action">
          Custom
        </button>
      )

      render(
        <CodeBlockInternal language="javascript" actions={customAction}>
          const x = 42
        </CodeBlockInternal>
      )

      expect(screen.getByTestId('custom-action')).toBeInTheDocument()
      expect(document.querySelector('.cursor-pointer')).toBeInTheDocument()
    })

    it('should render custom actions without copy button', () => {
      const customAction = (
        <button type="button" data-testid="custom-action">
          Custom
        </button>
      )

      render(
        <CodeBlockInternal
          language="javascript"
          actions={customAction}
          copy={false}
        >
          const x = 42
        </CodeBlockInternal>
      )

      expect(screen.getByTestId('custom-action')).toBeInTheDocument()
      expect(document.querySelector('.cursor-pointer')).not.toBeInTheDocument()
    })
  })

  describe('edge cases', () => {
    it('should handle empty code content', () => {
      render(<CodeBlockInternal language="javascript"></CodeBlockInternal>)

      const container = document.querySelector('.codeblock')

      expect(container).toBeInTheDocument()
    })

    it('should handle code with special characters', async () => {
      render(
        <CodeBlockInternal language="javascript">
          const str = &apos;Hello world and friends&apos;
        </CodeBlockInternal>
      )

      await waitFor(() => {
        expect(
          screen.getByText(`const str = 'Hello world and friends'`, {
            exact: false,
          })
        ).toBeInTheDocument()
      })
    })

    it('should pass through custom className', () => {
      render(
        <CodeBlockInternal language="javascript" className="custom-class">
          const x = 42
        </CodeBlockInternal>
      )

      const container = document.querySelector('.codeblock')

      expect(container).toHaveClass('custom-class')
    })
  })
})

describe('CodeBlock', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    useTheme.mockReturnValue({ theme: 'light' })
  })

  describe('basic functionality', () => {
    it('should render CodeBlockInternal wrapped in NoSsr', async () => {
      render(<CodeBlock language="javascript">const x = 42</CodeBlock>)

      await waitFor(() => {
        expect(
          screen.getByText('const x = 42', { exact: false })
        ).toBeInTheDocument()
      })
    })

    it('should pass all props to CodeBlockInternal', async () => {
      render(
        <CodeBlock language="python" copy={false} className="test-class">
          print(&apos;hello&apos;)
        </CodeBlock>
      )

      await waitFor(() => {
        const line = document.querySelector('[data-language="python"]')

        expect(line).toBeInTheDocument()
      })

      const container = document.querySelector('.codeblock')

      expect(container).toHaveClass('test-class')

      const copyButton = document.querySelector('.cursor-pointer')

      expect(copyButton).not.toBeInTheDocument()
    })
  })

  describe('memoization', () => {
    // @note `useTheme` is called exactly once per CodeBlockInternal render, so
    // its call count doubles as a render counter for the memoized subtree.

    function Streaming({ trailing }) {
      return (
        <div>
          <CodeBlock language="javascript">const x = 42</CodeBlock>
          <p>{trailing}</p>
        </div>
      )
    }

    it('should not re-render when surrounding content changes but the source does not', async () => {
      const { rerender } = render(<Streaming trailing="a" />)

      await waitFor(() => {
        expect(
          screen.getByText('const x = 42', { exact: false })
        ).toBeInTheDocument()
      })

      // @note let the async highlighter setup (streamer/html state) settle so
      // the baseline counts only committed renders, not in-flight ones.
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 200))
      })

      const renders = useTheme.mock.calls.length

      for (const trailing of ['ab', 'abc', 'abcd']) {
        await act(async () => {
          rerender(<Streaming trailing={trailing} />)
        })
      }

      expect(useTheme.mock.calls.length).toBe(renders)
    })

    it('should re-render when the source changes', async () => {
      const { rerender } = render(
        <CodeBlock language="javascript">const x = 42</CodeBlock>
      )

      await waitFor(() => {
        expect(
          screen.getByText('const x = 42', { exact: false })
        ).toBeInTheDocument()
      })

      const renders = useTheme.mock.calls.length

      await act(async () => {
        rerender(<CodeBlock language="javascript">const x = 43</CodeBlock>)
      })

      expect(useTheme.mock.calls.length).toBeGreaterThan(renders)

      await waitFor(() => {
        expect(
          screen.getByText('const x = 43', { exact: false })
        ).toBeInTheDocument()
      })
    })
  })
})
