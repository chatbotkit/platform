import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'

import { FIVE_MINUTE_IN_MILLISECONDS } from '@chatbotkit-dev/time'

import CodeAction from '@/components/CodeAction'
import List from '@/components/List'

import useDebounce from '@/hooks/useDebounce'
import useFetch from '@/hooks/useFetch'
import usePopup from '@/hooks/usePopup'
import { usePublishAccountSwitched } from '@/hooks/useProjectScope'
import useRouter from '@/hooks/useRouter'
import useSession from '@/hooks/useSession'
import useTeamSwitch from '@/hooks/useTeamSwitch'
import useUserSwitch from '@/hooks/useUserSwitch'

import clsx from 'clsx'

const SessionProviderContext = createContext(null)

export function useSessionContext() {
  return useContext(SessionProviderContext)
}

function TeamSwitchPopup({ teams, ...props }) {
  const [selectedTeamId, setSelectedTeamId] = useState(null)
  const [search, setSearch] = useState('')

  const debouncedSearch = useDebounce(search, 300)

  const filteredTeams = useMemo(() => {
    if (!debouncedSearch) {
      return teams
    }

    const searchLower = debouncedSearch.toLowerCase()

    return teams.filter((team) => {
      return [team.id, team.name, team.description]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(searchLower)
    })
  }, [teams, debouncedSearch])

  return (
    <div {...props}>
      <div className="space-y-4">
        <p className="text-sm">Select a team from the list below.</p>
        <input
          className="default-input w-full"
          type="search"
          placeholder="Search teams..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <input type="hidden" name="teamId" value={selectedTeamId || ''} />
        <div className="max-h-[500px] h-screen flex flex-col overflow-auto">
          <List>
            {filteredTeams.map((team) => (
              <List.Item
                key={team.id}
                title={team.name || team.id}
                body={team.description || <i>A team without description</i>}
                timestamp={team.createdAt}
                onClick={() => setSelectedTeamId(team.id)}
                selected={selectedTeamId === team.id}
              />
            ))}
          </List>
        </div>
      </div>
    </div>
  )
}

function UserSwitchPopup({ users, ...props }) {
  const [selectedUserId, setSelectedUserId] = useState(null)
  const [search, setSearch] = useState('')

  const debouncedSearch = useDebounce(search, 300)

  const filteredUsers = useMemo(() => {
    if (!debouncedSearch) {
      return users
    }

    const searchLower = debouncedSearch.toLowerCase()

    return users.filter((user) => {
      return [user.id, user.name, user.description]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(searchLower)
    })
  }, [users, debouncedSearch])

  return (
    <div {...props}>
      <div className="space-y-4">
        <p className="text-sm">Select a user from the list below.</p>
        <input
          className="default-input w-full"
          type="search"
          placeholder="Search users..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <input type="hidden" name="userId" value={selectedUserId || ''} />
        <div className="max-h-[500px] h-screen flex flex-col overflow-auto">
          <List>
            {filteredUsers.map((user) => (
              <List.Item
                key={user.id}
                title={user.name || user.id}
                body={user.description || <i>A user without description</i>}
                timestamp={user.createdAt}
                onClick={() => setSelectedUserId(user.id)}
                selected={selectedUserId === user.id}
              />
            ))}
          </List>
        </div>
      </div>
    </div>
  )
}

export function TeamSwitchButton({ className, children, ...props }) {
  const { teams, openTeamSwitchPopup } = useSessionContext()

  return (
    <button
      {...props}
      type="button"
      className={clsx(className)}
      onClick={openTeamSwitchPopup}
      disabled={teams.length === 0}
    >
      {children}
    </button>
  )
}

TeamSwitchButton.Maybe = function TeamSwitchButtonMaybe(props) {
  const { teams } = useSessionContext()

  if (teams.length === 0) {
    return null
  }

  return <TeamSwitchButton {...props} />
}

export function UserSwitchButton({ className, children, ...props }) {
  const { users, openUserSwitchPopup } = useSessionContext()

  return (
    <button
      {...props}
      type="button"
      className={clsx(className)}
      onClick={openUserSwitchPopup}
      disabled={users.length === 0}
    >
      {children}
    </button>
  )
}

UserSwitchButton.Maybe = function UserSwitchButtonMaybe(props) {
  const { users } = useSessionContext()

  if (users.length === 0) {
    return null
  }

  return <UserSwitchButton {...props} />
}

export default function SessionContext({ children }) {
  const { data: session } = useSession()

  const isAuthenticated = !!session?.user

  const router = useRouter()

  const {
    isSwitched: isTeamSwitched,
    id: teamId,
    name: teamName,
  } = useTeamSwitch()
  const {
    isSwitched: isUserSwitched,
    id: userId,
    name: userName,
  } = useUserSwitch()

  const { code, fetch } = useFetch({
    loadingMessage: true,
    failureMessage: true,
  })

  const [teams, setTeams] = useState([])

  {
    useEffect(() => {
      async function loadTeams() {
        if (!isAuthenticated) {
          return
        }

        const { error, data } = await fetch('/api/me/team/list', {
          loadingMessage: false,
        })

        if (error) {
          return
        }

        setTeams(data.items || [])
      }

      loadTeams()

      const interval = setInterval(loadTeams, FIVE_MINUTE_IN_MILLISECONDS)

      return () => clearInterval(interval)
    }, [isAuthenticated, fetch, setTeams])
  }

  const [users, setUsers] = useState([])

  {
    useEffect(() => {
      async function loadUsers() {
        if (!isAuthenticated) {
          return
        }

        const { error, data } = await fetch('/api/me/user/list', {
          loadingMessage: false,
        })

        if (error) {
          return
        }

        setUsers(data.items || [])
      }

      loadUsers()

      const interval = setInterval(loadUsers, FIVE_MINUTE_IN_MILLISECONDS)

      return () => clearInterval(interval)
    }, [isAuthenticated, fetch, setUsers])
  }

  const shouldRefresh = useMemo(() => {
    return (
      Object.keys(router.params).filter((key) => key.endsWith('Id')).length ===
      0
    )
  }, [router.params])

  // @note anything scoped to the account we are working as has to be dropped
  // whenever that account changes, in either direction. The switch itself only
  // moves the run-as cookies, so state keyed by the signed in user - the project
  // scope - would otherwise survive it and point at another account's resources
  const publishAccountSwitched = usePublishAccountSwitched()

  const switchTeam = useCallback(
    async (teamId) => {
      if (!isAuthenticated) {
        return
      }

      const { error } = await fetch(`/api/me/team/${teamId}/switch`, {
        loadingMessage: 'Switching team...',

        data: {},
      })

      if (error) {
        return
      }

      publishAccountSwitched()

      // remain on the same page if it does not contains an id

      if (shouldRefresh) {
        router.refresh()
      } else {
        router.push('/overview')
      }
    },
    [isAuthenticated, router, fetch, shouldRefresh, publishAccountSwitched]
  )

  const unswitchTeam = useCallback(async () => {
    if (!isAuthenticated) {
      return
    }

    const { error } = await fetch(`/api/me/team/unswitch`, {
      loadingMessage: 'Switching team...',

      data: {},
    })

    if (error) {
      return
    }

    publishAccountSwitched()

    // remain on the same page if it does not contains an id

    if (shouldRefresh) {
      router.refresh()
    } else {
      router.push('/overview')
    }
  }, [isAuthenticated, router, fetch, shouldRefresh, publishAccountSwitched])

  const switchUser = useCallback(
    async (userId) => {
      const { error } = await fetch(`/api/me/user/${userId}/switch`, {
        loadingMessage: 'Switching user...',

        data: {},
      })

      if (error) {
        return
      }

      publishAccountSwitched()

      // remain on the same page if it does not contains an id

      if (shouldRefresh) {
        router.refresh()
      } else {
        router.push('/overview')
      }
    },
    [router, fetch, shouldRefresh, publishAccountSwitched]
  )

  const unswitchUser = useCallback(async () => {
    if (!isAuthenticated) {
      return
    }

    const { error } = await fetch(`/api/me/user/unswitch`, {
      loadingMessage: 'Switching user...',

      data: {},
    })

    if (error) {
      return
    }

    publishAccountSwitched()

    // remain on the same page if it does not contains an id

    if (shouldRefresh) {
      router.refresh()
    } else {
      router.push('/overview')
    }
  }, [isAuthenticated, router, fetch, shouldRefresh, publishAccountSwitched])

  const { popup, openPopup, closePopup } = usePopup()

  const openTeamSwitchPopup = useCallback(() => {
    if (!isAuthenticated) {
      return
    }

    // @note delay dialog open so the profile dropdown click can fully settle first
    setTimeout(() => {
      openPopup(<TeamSwitchPopup teams={teams} />, {
        title: 'Switch Team',
        actions: {
          ...(isTeamSwitched
            ? {
                Unswitch: {
                  fn: async () => {
                    await unswitchTeam()

                    closePopup()
                  },
                },
              }
            : null),

          Change: {
            default: true,
            fn: async ({ teamId }) => {
              if (!teamId) {
                return
              }

              await switchTeam(teamId)

              closePopup()
            },
          },
        },
      })
    }, 0)
  }, [
    isAuthenticated,
    openPopup,
    closePopup,
    teams,
    isTeamSwitched,
    unswitchTeam,
    switchTeam,
  ])

  const openUserSwitchPopup = useCallback(() => {
    if (!isAuthenticated) {
      return
    }

    // @note delay dialog open so the profile dropdown click can fully settle first
    setTimeout(() => {
      openPopup(<UserSwitchPopup users={users} />, {
        title: 'Switch User',
        actions: {
          ...(isUserSwitched
            ? {
                Unswitch: {
                  fn: async () => {
                    await unswitchUser()

                    closePopup()
                  },
                },
              }
            : null),

          Change: {
            default: true,
            fn: async ({ userId }) => {
              if (!userId) {
                return
              }

              await switchUser(userId)

              closePopup()
            },
          },
        },
      })
    }, 0)
  }, [
    isAuthenticated,
    openPopup,
    closePopup,
    users,
    isUserSwitched,
    switchUser,
    unswitchUser,
  ])

  return (
    <SessionProviderContext.Provider
      value={{
        isTeamSwitched,
        teamId,
        teamName,

        isUserSwitched,
        userId,
        userName,

        teams,

        users,

        switchTeam,
        unswitchTeam,

        switchUser,
        unswitchUser,

        openTeamSwitchPopup,
        openUserSwitchPopup,
      }}
    >
      {popup}
      <CodeAction key={code} code={code} />
      {children}
    </SessionProviderContext.Provider>
  )
}

SessionContext.withSessionContext = function WrappedComponent(Component) {
  return function WrappedComponent(props) {
    return (
      <SessionContext>
        <Component {...props} />
      </SessionContext>
    )
  }
}
