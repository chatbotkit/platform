import useExternalAPIURL from '@/hooks/useExternalAPIURL'

import { Main } from './components'

import { fireEvent, render, screen } from '@testing-library/react'

jest.mock('./server', () => ({
  fetchSpecOperation: jest.fn(),
  listSpecOperations: jest.fn(),
}))

jest.mock('@/hooks/useExternalAPIURL', () => ({
  __esModule: true,
  default: jest.fn(),
}))

jest.mock('@/components/CodeBlock', () => ({
  __esModule: true,
  default: ({ children }) => <pre data-testid="request-code">{children}</pre>,
}))

describe('API documentation request snippets', () => {
  it.each([
    ['Node', 'baseUrl: "http://console.localhost:3000"'],
    ['Go', 'BaseURL: "http://console.localhost:3000"'],
  ])('points the %s SDK example at the serving deployment', (tab, expected) => {
    useExternalAPIURL.mockReturnValue(
      (path) => `http://console.localhost:3000/api${path}`
    )

    render(
      <Main
        initialData={{ groups: [] }}
        initialSlug="bot.list"
        initialOperation={{
          operationId: 'bot.list',
          method: 'get',
          path: '/bot/list',
        }}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: tab, exact: true }))

    expect(screen.getByTestId('request-code').textContent).toContain(expected)
  })

  it.each([
    [
      'http://console.localhost:3000/api',
      '/api/v1/bot/list',
      'console.localhost:3000',
    ],
    ['https://api.example.com', '/v1/bot/list', 'api.example.com'],
  ])(
    'uses the resolved endpoint in the HTTP tab on %s',
    (baseURL, pathname, host) => {
      document.documentElement.dataset.apiHost = host
      useExternalAPIURL.mockReturnValue((path) => `${baseURL}${path}`)

      try {
        render(
          <Main
            initialData={{ groups: [] }}
            initialSlug="bot.list"
            initialOperation={{
              operationId: 'bot.list',
              method: 'get',
              path: '/bot/list',
            }}
          />
        )

        fireEvent.click(
          screen.getByRole('button', { name: 'HTTP', exact: true })
        )

        const snippet = screen.getByTestId('request-code').textContent

        expect(snippet).toContain(`GET ${pathname} HTTP/1.1`)
        expect(snippet).toContain(`Host: ${host}`)
      } finally {
        delete document.documentElement.dataset.apiHost
      }
    }
  )
})
