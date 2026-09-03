/* eslint-disable @typescript-eslint/no-require-imports */
import SessionContext, {
  TeamSwitchButton,
  UserSwitchButton,
} from './SessionContext'

import '@testing-library/jest-dom'
import { act, fireEvent, render, screen } from '@testing-library/react'

const openPopupMock = jest.fn()
const closePopupMock = jest.fn()
const fetchMock = jest.fn()
const refreshMock = jest.fn()
const pushMock = jest.fn()

jest.mock('@/components/CodeAction', () => () => null)

jest.mock('@/components/List', () => {
  function List({ children }) {
    return <div>{children}</div>
  }

  List.Item = function ListItem({ title, onClick, selected }) {
    return (
      <button type="button" onClick={onClick} data-selected={selected}>
        {title}
      </button>
    )
  }

  return List
})

jest.mock('@/hooks/useDebounce', () => (value) => value)

jest.mock('@/hooks/useFetch', () => () => ({
  code: '',
  fetch: fetchMock,
}))

jest.mock('@/hooks/useLocalStorage', () => {
  return jest.fn(() => [[], jest.fn()])
})

jest.mock('@/hooks/usePopup', () => () => ({
  popup: null,
  openPopup: openPopupMock,
  closePopup: closePopupMock,
}))

jest.mock('@/hooks/useRouter', () => () => ({
  asPath: '/overview',
  params: {},
  refresh: refreshMock,
  push: pushMock,
}))

jest.mock('@/hooks/useSession', () => () => ({
  data: {
    user: { id: 'owner-1' },
  },
}))

jest.mock('@/hooks/useTeamSwitch', () => () => ({
  isSwitched: false,
  id: '',
  name: '',
}))

jest.mock('@/hooks/useUserSwitch', () => () => ({
  isSwitched: false,
  id: '',
  name: '',
}))

describe('SessionContext', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.useFakeTimers()
    fetchMock.mockImplementation((url) => {
      if (url === '/api/me/team/list') {
        return Promise.resolve({
          error: null,
          data: { items: [{ id: 'team-1', name: 'Team One' }] },
        })
      }

      if (url === '/api/me/user/list') {
        return Promise.resolve({
          error: null,
          data: { items: [{ id: 'user-1', name: 'User One' }] },
        })
      }

      return Promise.resolve({ error: null, data: { items: [] } })
    })
  })

  afterEach(() => {
    jest.runOnlyPendingTimers()
    jest.useRealTimers()
  })

  it('opens team switch popup on the next tick', async () => {
    render(
      <SessionContext>
        <TeamSwitchButton>Switch Team</TeamSwitchButton>
      </SessionContext>
    )

    await act(async () => {})

    fireEvent.click(screen.getByRole('button', { name: 'Switch Team' }))

    expect(openPopupMock).not.toHaveBeenCalled()

    await act(async () => {
      jest.runOnlyPendingTimers()
    })

    expect(openPopupMock).toHaveBeenCalledTimes(1)
    expect(openPopupMock.mock.calls[0][1]).toEqual(
      expect.objectContaining({ title: 'Switch Team' })
    )
  })

  it('opens user switch popup on the next tick', async () => {
    render(
      <SessionContext>
        <UserSwitchButton>Switch User</UserSwitchButton>
      </SessionContext>
    )

    await act(async () => {})

    fireEvent.click(screen.getByRole('button', { name: 'Switch User' }))

    expect(openPopupMock).not.toHaveBeenCalled()

    await act(async () => {
      jest.runOnlyPendingTimers()
    })

    expect(openPopupMock).toHaveBeenCalledTimes(1)
    expect(openPopupMock.mock.calls[0][1]).toEqual(
      expect.objectContaining({ title: 'Switch User' })
    )
  })
})
