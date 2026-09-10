/**
 * @jest-environment @chatbotkit-dev/jest-jsdom
 * @jest-environment-options {"url": "http://console.localhost:3000/playground/api"}
 */

import { act, renderHook } from '@testing-library/react'

import useFetch from '@/hooks/useFetch'
import Index from '@/pages/playground/api'

jest.mock('@/hooks/useFetch', () => ({
  __esModule: true,
  default: jest.fn(),
}))

function findProps(element, predicate) {
  if (Array.isArray(element)) {
    return element.map((child) => findProps(child, predicate)).find(Boolean)
  }

  if (!element?.props) {
    return undefined
  }

  return predicate(element.props)
    ? element.props
    : findProps(element.props.children, predicate)
}

describe('API playground request origin', () => {
  const fetch = jest.fn().mockResolvedValue({})

  beforeEach(() => {
    jest.clearAllMocks()
    useFetch.mockReturnValue({ fetch, loading: false })
  })

  it.each([
    '/v1/conversation/list?limit=2',
    'https://api.example/v1/conversation/list?limit=2',
    'https://api.example:8443/v1/conversation/list?limit=2',
    'http://api.localhost:8080/api/v1/conversation/list?limit=2',
  ])('sends %s through the page origin and session', async (uri) => {
    const { result } = renderHook(() => Index())

    act(() => {
      findProps(result.current, (props) => props.onChange && props.onKeyDown)
        .onChange({ target: { value: `GET ${uri} HTTP/1.1` } })
    })

    await act(async () => {
      await findProps(result.current, (props) => props.onChange && props.onKeyDown)
        .onKeyDown({
          ctrlKey: true,
          keyCode: 13,
          preventDefault() {},
          stopPropagation() {},
        })
    })

    expect(fetch).toHaveBeenCalledWith(
      'http://console.localhost:3000/api/v1/conversation/list?limit=2',
      expect.objectContaining({ method: 'GET', body: undefined })
    )
  })
})
