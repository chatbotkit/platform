import TextareaHighlighter from './TextareaHighlighter'

import '@testing-library/jest-dom'
import { act, fireEvent, render, waitFor } from '@testing-library/react'

describe('TextareaHighlighter', () => {
  let workerInstances
  let resizeObserverInstances

  beforeEach(() => {
    workerInstances = []
    resizeObserverInstances = []

    global.requestAnimationFrame = jest.fn((cb) => {
      cb()

      return 1
    })

    global.ResizeObserver = jest.fn((cb) => {
      const instance = {
        observe: jest.fn(),
        disconnect: jest.fn(),
        callback: cb,
      }

      resizeObserverInstances.push(instance)

      return instance
    })

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
  })

  afterEach(() => {
    delete global.ResizeObserver
    delete global.Worker
    delete global.requestAnimationFrame
  })

  function renderWithTextarea(props = {}) {
    const textarea = document.createElement('textarea')

    textarea.value = 'hello world'
    document.body.appendChild(textarea)

    const getComputedStyleMock = jest
      .spyOn(window, 'getComputedStyle')
      .mockReturnValue({
        getPropertyValue: () => '0px',
      })

    const view = render(
      <TextareaHighlighter
        textarea={textarea}
        keywords={['hello']}
        {...props}
      />
    )

    return { ...view, textarea, getComputedStyleMock }
  }

  it('creates worker and posts initial payload', async () => {
    const { getComputedStyleMock } = renderWithTextarea()

    await waitFor(() => {
      expect(global.Worker).toHaveBeenCalledTimes(1)
      expect(workerInstances[0].postMessage).toHaveBeenCalledWith({
        value: 'hello world',
        keywords: ['hello'],
      })
    })

    getComputedStyleMock.mockRestore()
  })

  it('syncs on input and posts updated value with trailing newline normalization', async () => {
    const { textarea, getComputedStyleMock } = renderWithTextarea()

    await waitFor(() =>
      expect(workerInstances[0].postMessage).toHaveBeenCalled()
    )

    act(() => {
      textarea.value = 'updated\n'
      fireEvent.input(textarea)
    })

    await waitFor(() => {
      const lastCall =
        workerInstances[0].postMessage.mock.calls[
          workerInstances[0].postMessage.mock.calls.length - 1
        ][0]

      expect(lastCall).toEqual({
        value: 'updated\n\n',
        keywords: ['hello'],
      })
    })

    getComputedStyleMock.mockRestore()
  })

  it('re-syncs when the controlled value changes without any DOM event', async () => {
    const { textarea, rerender, getComputedStyleMock } = renderWithTextarea({
      value: 'hello world',
    })

    await waitFor(() =>
      expect(workerInstances[0].postMessage).toHaveBeenCalled()
    )

    // programmatic controlled update - no input/focus/blur events fire
    textarea.value = 'switched content'

    rerender(
      <TextareaHighlighter
        textarea={textarea}
        keywords={['hello']}
        value="switched content"
      />
    )

    await waitFor(() => {
      const lastCall =
        workerInstances[0].postMessage.mock.calls[
          workerInstances[0].postMessage.mock.calls.length - 1
        ][0]

      expect(lastCall).toEqual({
        value: 'switched content',
        keywords: ['hello'],
      })
    })

    getComputedStyleMock.mockRestore()
  })

  it('attaches and cleans up observers and worker listeners', async () => {
    const { unmount, textarea, getComputedStyleMock } = renderWithTextarea()

    await waitFor(() => {
      expect(resizeObserverInstances[0].observe).toHaveBeenCalledWith(textarea)
      expect(workerInstances[0].addEventListener).toHaveBeenCalledWith(
        'message',
        expect.any(Function)
      )
    })

    unmount()

    expect(resizeObserverInstances[0].disconnect).toHaveBeenCalledTimes(1)
    expect(workerInstances[0].removeEventListener).toHaveBeenCalledWith(
      'message',
      expect.any(Function)
    )
    expect(workerInstances[0].terminate).toHaveBeenCalledTimes(1)

    getComputedStyleMock.mockRestore()
  })
})
