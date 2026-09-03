import MarkdownInput from './MarkdownInput'

import '@testing-library/jest-dom'
import { render, waitFor } from '@testing-library/react'

jest.mock('@/hooks/useDebounce', () => ({
  __esModule: true,
  default: jest.fn((value) => value),
}))

jest.mock('@/hooks/useTokenCount', () => ({
  __esModule: true,
  default: jest.fn(() => 0),
}))

jest.mock('@/components/AdvancedAutoTextarea', () => {
  const React = jest.requireActual('react')

  return {
    __esModule: true,
    default: React.forwardRef(function MockAdvancedAutoTextarea(
      { children, wrapperClassName, autoTextareaAs: _autoTextareaAs, ...props },
      ref
    ) {
      return (
        <div className={wrapperClassName}>
          <textarea ref={ref} {...props} />
          {children}
        </div>
      )
    }),
  }
})

describe('MarkdownInput', () => {
  let workerInstances

  beforeEach(() => {
    workerInstances = []

    global.requestAnimationFrame = jest.fn((cb) => {
      cb()

      return 1
    })

    global.ResizeObserver = jest.fn(() => ({
      observe: jest.fn(),
      disconnect: jest.fn(),
    }))

    global.Worker = jest.fn(() => {
      const instance = {
        postMessage: jest.fn(),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        terminate: jest.fn(),
      }

      workerInstances.push(instance)

      return instance
    })

    jest.spyOn(window, 'getComputedStyle').mockReturnValue({
      getPropertyValue: () => '0px',
    })
  })

  afterEach(() => {
    delete global.ResizeObserver
    delete global.Worker
    delete global.requestAnimationFrame

    jest.restoreAllMocks()
  })

  function lastHighlighterPayload() {
    const calls = workerInstances.flatMap(
      (instance) => instance.postMessage.mock.calls
    )

    return calls.length ? calls[calls.length - 1][0] : undefined
  }

  it('re-highlights when the controlled value is swapped without DOM events', async () => {
    const setValue = jest.fn()

    const { rerender } = render(
      <MarkdownInput value="# first file" setValue={setValue} />
    )

    // useDOMQuerySelector resolves the textarea from containerRef on the next
    // render pass, so re-render once before asserting the initial highlight
    rerender(<MarkdownInput value="# first file" setValue={setValue} />)

    await waitFor(() => {
      expect(lastHighlighterPayload()).toMatchObject({ value: '# first file' })
    })

    // a controlled swap (e.g. the playbooks editor switching files) fires no
    // input/focus/blur events - the highlighter must still re-sync
    rerender(<MarkdownInput value="# second file" setValue={setValue} />)

    await waitFor(() => {
      expect(lastHighlighterPayload()).toMatchObject({ value: '# second file' })
    })
  })
})
