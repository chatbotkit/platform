import useExternalFrontendURL from './useExternalFrontendURL'

import '@testing-library/jest-dom'
import { renderHook } from '@testing-library/react'

jest.mock('@/hooks/useHostname', () => ({
  __esModule: true,
  default: jest.fn(() => 'example.chatbotkit.com'),
}))

const useHostname = jest.requireMock('@/hooks/useHostname').default

describe('useExternalFrontendURL', () => {
  it('builds an https url on the resolved hostname', () => {
    const { result } = renderHook(() => useExternalFrontendURL())

    expect(result.current('/hub/bots/my-bot')).toBe(
      'https://example.chatbotkit.com/hub/bots/my-bot'
    )
  })

  it('downgrades to http on localhost', () => {
    useHostname.mockReturnValue('localhost:3000')

    const { result } = renderHook(() => useExternalFrontendURL())

    expect(result.current('/hub')).toBe('http://localhost:3000/hub')
  })
})
