import usePopup from '@/hooks/usePopup'

import useFramePopup from './useFramePopup'

import { act, renderHook } from '@testing-library/react'

jest.mock('@/hooks/usePopup', () => {
  return jest.fn()
})

describe('useFramePopup', () => {
  let popupState

  beforeEach(() => {
    jest.clearAllMocks()

    popupState = {
      popup: <div>Popup</div>,
      openPopup: jest.fn(),
      closePopup: jest.fn(),
    }

    usePopup.mockReturnValue(popupState)
  })

  it('should initialize usePopup with default dialog settings', () => {
    renderHook(() => useFramePopup())

    expect(usePopup).toHaveBeenCalledWith(
      expect.objectContaining({
        dialogClassName:
          'w-screen h-screen lg:max-w-[calc(100vw*0.8)] lg:max-h-[calc(100vh*0.8)]',
        cancelButtonCaption: 'Close',
      })
    )
  })

  it('should pass through popup controls', () => {
    const { result } = renderHook(() => useFramePopup())

    expect(result.current.popup).toEqual(<div>Popup</div>)
    expect(result.current.openPopup).toBe(popupState.openPopup)
    expect(result.current.closePopup).toBe(popupState.closePopup)
  })

  it('should open popup with iframe content and default options', () => {
    const { result } = renderHook(() => useFramePopup())

    act(() => {
      result.current.openFramePopup('/docs')
    })

    expect(popupState.openPopup).toHaveBeenCalledTimes(1)

    const [content, options] = popupState.openPopup.mock.calls[0]

    expect(content.props.src).toBe('/docs')
    expect(content.props.allow).toContain('autoplay')
    expect(content.props.allowFullScreen).toBe(true)
    expect(options).toMatchObject({
      animateContentHeight: false,
      contentClassName: 'h-full',
      noActions: true,
    })
  })

  it('should append preview mode using pathname only', () => {
    const { result } = renderHook(() => useFramePopup())

    act(() => {
      result.current.openFramePopup('https://example.com/path/to/page?x=1', {
        preview: true,
      })
    })

    const [content] = popupState.openPopup.mock.calls[0]

    expect(content.props.src).toBe('/path/to/page?mode=preview')
  })

  it('should preserve src when preview URL parsing fails', () => {
    const originalURL = global.URL

    global.URL = jest.fn(() => {
      throw new Error('bad url')
    })

    const { result } = renderHook(() => useFramePopup())

    act(() => {
      result.current.openFramePopup('::invalid::', { preview: true })
    })

    const [content] = popupState.openPopup.mock.calls[0]

    expect(content.props.src).toBe('::invalid::')

    global.URL = originalURL
  })

  it('should create a go-to action and call window.open', () => {
    const openSpy = jest.spyOn(window, 'open').mockImplementation(() => null)
    const { result } = renderHook(() => useFramePopup())

    act(() => {
      result.current.openFramePopup('/stories', {
        goToCaption: 'Read full page',
        goToTarget: '_blank',
      })
    })

    const [, options] = popupState.openPopup.mock.calls[0]
    const action = options.actions['Read full page']

    expect(action.default).toBe(true)

    action.fn()
    expect(openSpy).toHaveBeenCalledWith('/stories', '_blank')

    openSpy.mockRestore()
  })
})
