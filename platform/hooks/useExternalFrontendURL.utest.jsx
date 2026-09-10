import useExternalFrontendURL from './useExternalFrontendURL'

import '@testing-library/jest-dom'
import { renderHook } from '@testing-library/react'

jest.mock('@/hooks/useHost', () => ({
  __esModule: true,
  default: jest.fn(() => 'example.chatbotkit.com'),
}))

const useHost = jest.requireMock('@/hooks/useHost').default

describe('useExternalFrontendURL', () => {
  it('builds an https url on the resolved hostname', () => {
    const { result } = renderHook(() => useExternalFrontendURL())

    expect(result.current('/hub/bots/my-bot')).toBe(
      'https://example.chatbotkit.com/hub/bots/my-bot'
    )
  })

  it('downgrades to http on localhost', () => {
    useHost.mockReturnValue('localhost:3000')

    const { result } = renderHook(() => useExternalFrontendURL())

    expect(result.current('/hub')).toBe('http://localhost:3000/hub')
  })
})
