import UsageList from './UsageList'

import { render } from '@testing-library/react'

const mockOpenPopup = jest.fn()
const mockResourceList = jest.fn(() => null)
const mockRevalue = jest.fn((value) => value)

jest.mock('@/lib/object', () => ({
  revalue: (...args) => mockRevalue(...args),
}))

jest.mock('@/components/GlobalRoot', () => ({
  GlobalRootPortal: function GlobalRootPortal({ children }) {
    return <div data-testid="portal">{children}</div>
  },
}))

jest.mock('@/components/ObjectView', () => {
  return function ObjectView() {
    return <div data-testid="object-view" />
  }
})

jest.mock('@/components/ResourceList', () => {
  return function ResourceList(props) {
    mockResourceList(props)

    return <div data-testid="resource-list" />
  }
})

jest.mock('@/hooks/useInitial', () => ({
  __esModule: true,
  default: (factory) => factory(),
}))

jest.mock('@/hooks/usePopup', () => ({
  __esModule: true,
  default: () => ({
    popup: <div data-testid="popup" />,
    openPopup: mockOpenPopup,
  }),
}))

describe('UsageList', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('builds list and export routes from usageTypes and context filters', () => {
    render(
      <UsageList
        usageTypes={['TOKEN', 'MESSAGE']}
        contextFilters={{ botId: 'bot-1' }}
      />
    )

    const props = mockResourceList.mock.calls[0][0]

    expect(props.listRoute).toBe(
      '/api/v1/usage/list?type=TOKEN%2CMESSAGE&botId=bot-1'
    )
    expect(props.exportRoute).toBe(
      '/api/v1/usage/export?type=TOKEN%2CMESSAGE&botId=bot-1'
    )
    expect(props.kind).toBe('usage record')
    expect(props.autoLoad).toBe(true)
    expect(props.refreshInterval).toBe(60_000)
  })

  it('uses provided listRoute and exportRoute overrides', () => {
    render(
      <UsageList
        listRoute="/custom/list"
        exportRoute="/custom/export"
        usageTypes={['TOKEN']}
      />
    )

    const props = mockResourceList.mock.calls[0][0]

    expect(props.listRoute).toBe('/custom/list')
    expect(props.exportRoute).toBe('/custom/export')
  })

  it('disables export route when export prop is false', () => {
    render(<UsageList export={false} usageTypes={['TOKEN']} />)

    const props = mockResourceList.mock.calls[0][0]

    expect(props.exportRoute).toBeNull()
  })

  it('opens popup with object details when onItemClick is invoked', () => {
    render(<UsageList />)

    const props = mockResourceList.mock.calls[0][0]
    const item = { type: 'token_usage', count: 2, meta: { reason: 'test' } }

    props.onItemClick(item)

    expect(mockRevalue).toHaveBeenCalledWith(item, null)
    expect(mockOpenPopup).toHaveBeenCalledTimes(1)
    expect(mockOpenPopup.mock.calls[0][1]).toEqual(
      expect.objectContaining({
        title: 'token_usage',
        cancelButtonCaption: 'Close',
      })
    )
  })
})
