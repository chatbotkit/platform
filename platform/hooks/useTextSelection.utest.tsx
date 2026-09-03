import useTextSelection from './useTextSelection'

import { act, renderHook } from '@testing-library/react'

const mockSelection = {
  rangeCount: 0,
  getRangeAt: jest.fn(),
  removeAllRanges: jest.fn(),
  addRange: jest.fn(),
}

const mockRange = {
  collapsed: false,
  commonAncestorContainer: document.body,
  cloneContents: jest.fn(),
  getClientRects: jest.fn(),
  getBoundingClientRect: jest.fn(),
}

// @note mocking browser apis that are not available in jsdom

Object.defineProperty(window, 'getSelection', {
  writable: true,
  value: jest.fn(() => mockSelection),
})

describe('useTextSelection', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockSelection.rangeCount = 0
  })

  it('should return default state when no selection exists', () => {
    const { result } = renderHook(() => useTextSelection())

    expect(result.current).toEqual({
      clientRect: undefined,
      isCollapsed: undefined,
      textContent: undefined,
    })
  })

  it('should detect text selection and return correct data', () => {
    // Setup mock selection
    const mockDocumentFragment = {
      textContent: 'selected text',
    }

    const mockClientRects = [
      {
        toJSON: () => ({
          x: 10.5,
          y: 20.7,
          width: 100.3,
          height: 30.9,
          top: 20.7,
          right: 110.8,
          bottom: 51.6,
          left: 10.5,
        }),
      },
    ]

    mockSelection.rangeCount = 1
    mockRange.cloneContents.mockReturnValue(mockDocumentFragment)
    mockRange.getClientRects.mockReturnValue(mockClientRects)
    mockRange.collapsed = false
    mockSelection.getRangeAt.mockReturnValue(mockRange)

    const { result } = renderHook(() => useTextSelection())

    // trigger selection change

    act(() => {
      const event = new Event('selectionchange')

      document.dispatchEvent(event)
    })

    expect(result.current.textContent).toBe('selected text')
    expect(result.current.isCollapsed).toBe(false)

    // @note coordinates should be rounded

    expect(result.current.clientRect).toEqual({
      x: 11,
      y: 21,
      width: 100,
      height: 31,
      top: 21,
      right: 111,
      bottom: 52,
      left: 11,
    })
  })

  it('should respect target element constraints', () => {
    const targetElement = document.createElement('div')
    const outsideElement = document.createElement('div')

    mockSelection.rangeCount = 1
    mockRange.commonAncestorContainer = outsideElement
    mockSelection.getRangeAt.mockReturnValue(mockRange)

    // @note target.contains should return false for elements outside target

    jest.spyOn(targetElement, 'contains').mockReturnValue(false)

    const { result } = renderHook(() => useTextSelection(targetElement))

    act(() => {
      const event = new Event('selectionchange')

      document.dispatchEvent(event)
    })

    // should return default state since selection is outside target

    expect(result.current).toEqual({
      clientRect: undefined,
      isCollapsed: undefined,
      textContent: undefined,
    })
  })

  it('should handle collapsed selections correctly', () => {
    mockSelection.rangeCount = 1
    mockRange.collapsed = true
    mockRange.cloneContents.mockReturnValue({ textContent: '' })
    mockRange.getClientRects.mockReturnValue([])
    mockRange.commonAncestorContainer = document.createElement('div')

    // @note mock getBoundingClientRect for fallback scenario

    jest
      .spyOn(
        mockRange.commonAncestorContainer as HTMLElement,
        'getBoundingClientRect'
      )
      .mockReturnValue({
        toJSON: () => ({
          x: 0,
          y: 0,
          width: 0,
          height: 20,
          top: 0,
          right: 0,
          bottom: 20,
          left: 0,
        }),
      } as DOMRect)

    mockSelection.getRangeAt.mockReturnValue(mockRange)

    const { result } = renderHook(() => useTextSelection())

    act(() => {
      const event = new Event('selectionchange')

      document.dispatchEvent(event)
    })

    expect(result.current.isCollapsed).toBe(true)

    // @note empty textContent is not set in state when there's no actual text

    expect(result.current.textContent).toBeUndefined()
  })

  it('should handle resize events', () => {
    const { result } = renderHook(() => useTextSelection())

    // setup selection

    mockSelection.rangeCount = 1
    mockRange.getClientRects.mockReturnValue([
      {
        toJSON: () => ({
          x: 0,
          y: 0,
          width: 100,
          height: 20,
          top: 0,
          right: 100,
          bottom: 20,
          left: 0,
        }),
      },
    ])
    mockRange.cloneContents.mockReturnValue({ textContent: 'test' })
    mockSelection.getRangeAt.mockReturnValue(mockRange)

    act(() => {
      const event = new Event('selectionchange')

      document.dispatchEvent(event)
    })

    expect(result.current.textContent).toBe('test')

    // @note resize should trigger handler and potentially update coordinates

    act(() => {
      const resizeEvent = new Event('resize')

      window.dispatchEvent(resizeEvent)
    })

    // hook should still be responsive to events

    expect(result.current.textContent).toBe('test')
  })
})
