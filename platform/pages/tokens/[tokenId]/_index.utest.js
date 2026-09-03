import { Form } from './index'

import '@testing-library/jest-dom'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'

const mockConfirmInfo = jest.fn()
const mockFetch = jest.fn()
const mockPush = jest.fn()

jest.mock('@/examples/catalogue/projects.yaml', () => [])

jest.mock('@/prisma/client', () => ({}))

jest.mock('@/lib/form', () => ({
  formToData: jest.fn(() => ({ name: 'Production' })),
}))
jest.mock('@/lib/host', () => ({ getExternalAPIHostURL: jest.fn() }))
jest.mock('@/lib/session.get', () => ({ getSoftSession: jest.fn() }))
jest.mock('@/lib/struct', () => ({ makeJsonSafe: jest.fn((value) => value) }))

jest.mock('@/layouts/Dashboard', () =>
  function Dashboard({ children }) {
    return <div>{children}</div>
  }
)

jest.mock('@/components/AutoTextarea', () =>
  function AutoTextarea(props) {
    return <textarea {...props} />
  }
)
jest.mock('@/components/CodeAction', () => () => null)
jest.mock('@/components/CodeBlock', () =>
  function CodeBlock({ children }) {
    return <pre>{children}</pre>
  }
)
jest.mock('@/components/Confirm', () => ({
  useConfirmDelete: () => jest.fn(),
  useConfirmInfo: () => mockConfirmInfo,
}))
jest.mock('@/components/DocsLink', () =>
  function DocsLink({ children }) {
    return <span>{children}</span>
  }
)
jest.mock('@/components/DynamicIcon', () => () => null)
jest.mock('@/components/Expando', () =>
  function Expando({ children }) {
    return <div>{children}</div>
  }
)
jest.mock('@/components/FAQ', () => () => null)
jest.mock('@/components/Headline', () =>
  function Headline({ children }) {
    return <div>{children}</div>
  }
)
jest.mock('@/components/Link', () =>
  function Link({ children }) {
    return <span>{children}</span>
  }
)
jest.mock('@/components/List', () => {
  function List({ children }) {
    return <div>{children}</div>
  }

  List.Item = function ListItem({ children }) {
    return <div>{children}</div>
  }

  return List
})
jest.mock('@/components/MetaInput', () => () => null)
jest.mock('@/components/PageSections', () =>
  function PageSections({ children }) {
    return <div>{children}</div>
  }
)
jest.mock('@/components/SimpleTabs', () => () => null)
jest.mock('@/components/ThisSolution', () => () => null)
jest.mock('@/components/TokenConfigInput', () => () => null)
jest.mock('@/components/WebhookSetupSection', () =>
  function WebhookSetupSection() {
    return null
  }
)

jest.mock('@/hooks/useExternalAPIURL', () => () => (path) => path)
jest.mock('@/hooks/useFetch', () => () => ({
  code: null,
  fetch: mockFetch,
}))
jest.mock('@/hooks/useRouter', () => () => ({ push: mockPush }))

jest.mock('@/content/faqs/platform-token-instance.yaml', () => ({}))

describe('Token Form', () => {
  beforeEach(() => {
    mockConfirmInfo.mockReset()
    mockFetch.mockReset()
    mockPush.mockReset()
  })

  it('shows the created token once before redirecting to its route', async () => {
    let closePopup
    const popupClosed = new Promise((resolve) => {
      closePopup = resolve
    })

    mockFetch.mockResolvedValue({
      data: {
        id: 'token_123',
        token: 'sk-created-secret',
      },
      error: null,
    })
    mockConfirmInfo.mockReturnValue(popupClosed)

    render(<Form token={{ config: {} }} />)

    fireEvent.click(screen.getByRole('button', { name: 'Create' }))

    await waitFor(() => expect(mockConfirmInfo).toHaveBeenCalledTimes(1))

    const [content, options] = mockConfirmInfo.mock.calls[0]

    expect(options).toEqual({ title: 'API Token Created' })
    expect(content.props.secrets[0]).toMatchObject({
      label: 'API Token',
      value: 'sk-created-secret',
    })
    expect(mockPush).not.toHaveBeenCalled()

    closePopup()

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/tokens/token_123')
    })
  })
})
