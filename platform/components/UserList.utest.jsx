import UserList from './UserList'

import '@testing-library/jest-dom'
import { render } from '@testing-library/react'

const confirmMock = jest.fn()
const fetchMock = jest.fn()
const pushMock = jest.fn()
const shortFormatMock = jest.fn((value) => `fmt-${value}`)

const resourceListMock = jest.fn(() => <div data-testid="resource-list" />)

jest.mock('@/lib/number', () => ({
  shortFormat: (...args) => shortFormatMock(...args),
}))

jest.mock('@/components/Confirm', () => ({
  useConfirm: () => confirmMock,
}))

jest.mock('@/hooks/useFetch', () => ({
  __esModule: true,
  default: () => ({ fetch: fetchMock }),
}))

jest.mock('@/hooks/useRouter', () => ({
  __esModule: true,
  default: () => ({ push: pushMock }),
}))

jest.mock(
  '@/components/ResourceList',
  () =>
    function MockResourceList(props) {
      resourceListMock(props)

      return <div data-testid="resource-list" />
    }
)

describe('UserList', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('passes default routes and options to ResourceList', () => {
    render(<UserList />)

    expect(resourceListMock).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'user',
        deleteRoute: '/api/v1/user/[id]/delete',
        instanceRoute: '/users/[id]',
        filter: false,
        loadMore: false,
      })
    )

    // @note the default route is the GraphQL users connection - the
    // list route serializes to the endpoint it posts to
    const { listRoute } = resourceListMock.mock.calls[0][0]

    expect(listRoute.toJSON()).toBe('/api/v1/graphql')
  })

  it('formats usage tags using shortFormat in default extraTags', () => {
    render(<UserList />)

    const { extraTags } = resourceListMock.mock.calls[0][0]
    const tagsNode = extraTags({
      usage: {
        tokens: { value: 3 },
      },
    })

    expect(tagsNode).toBeTruthy()
    expect(shortFormatMock).toHaveBeenCalledWith(3)
  })

  it('switch link confirms and redirects on successful fetch', async () => {
    confirmMock.mockResolvedValue(true)
    fetchMock.mockResolvedValue({ error: undefined })

    render(<UserList />)

    const { extraLinks } = resourceListMock.mock.calls[0][0]
    const links = extraLinks({ id: 'user-2' })

    await links.Switch()

    expect(confirmMock).toHaveBeenCalledWith(
      'Do you really want to switch to this user?'
    )
    expect(fetchMock).toHaveBeenCalledWith('/api/me/user/user-2/switch', {
      data: {},
    })
    expect(pushMock).toHaveBeenCalledWith('/overview')
  })
})
