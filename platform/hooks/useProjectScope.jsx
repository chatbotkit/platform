import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'

import { useListen, usePublish } from '@/hooks/useBus'
import useGraphQLConnectionListRoute from '@/hooks/useGraphQLConnectionListRoute'

export const PROJECT_SCOPE_STORAGE_KEY = 'cbk.projectScope'
export const PROJECT_SCOPE_REFRESH_INTERVAL = 60_000

const RESOURCE_DELETED_CHANNEL = 'project.resource.deleted'
const ACCOUNT_SWITCHED_CHANNEL = 'project.account.switched'

/**
 * Returns a publisher to call with `{ kind, id }` after a resource is
 * deleted so the project scope refreshes ahead of its next interval tick
 * and drops the active scope if its project is gone.
 */
export function usePublishResourceDeleted() {
  return usePublish(RESOURCE_DELETED_CHANNEL)
}

/**
 * Returns a publisher to call after the account we are working as changes - a
 * team or user switch, or an unswitch - so the active project scope is dropped
 * along with it.
 */
export function usePublishAccountSwitched() {
  return usePublish(ACCOUNT_SWITCHED_CHANNEL)
}

const PROJECT_SCOPE_PROJECT_LIST_QUERY = `
  query ProjectScopeProjects(
    $first: Int
    $last: Int
    $after: ID
    $before: ID
    $order: ListOrder
  ) {
    blueprints(
      first: $first
      last: $last
      after: $after
      before: $before
      order: $order
    ) {
      edges {
        node {
          id
          name
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
`

const PROJECT_SCOPE_BOT_LIST_QUERY = `
  query ProjectScopeBots(
    $first: Int
    $last: Int
    $after: ID
    $before: ID
    $order: ListOrder
    $blueprintIds: [ID!]
  ) {
    bots(
      first: $first
      last: $last
      after: $after
      before: $before
      order: $order
      blueprintIds: $blueprintIds
    ) {
      edges {
        node {
          id
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
`

function mapProject(project) {
  return {
    id: project.id,
    name: project.name || 'Untitled',
  }
}

function mapBotId(bot) {
  return bot.id
}

function areItemsEqual(current, next) {
  return (
    current.length === next.length &&
    current.every((item, index) => {
      const nextItem = next[index]

      if (item === nextItem) {
        return true
      }

      return item?.id === nextItem?.id && item?.name === nextItem?.name
    })
  )
}

function useConnectionSnapshot({
  cacheKey,
  listRoute,
  normalizeItems,
  version = 0,
}) {
  const [snapshot, setSnapshot] = useState({
    key: null,
    items: [],
  })

  const hydrated = !cacheKey || snapshot.key === cacheKey
  const items = hydrated ? snapshot.items : []

  useEffect(() => {
    if (!cacheKey) {
      setSnapshot((current) =>
        current.key === null && current.items.length === 0
          ? current
          : { key: null, items: [] }
      )

      return
    }

    let cancelled = false
    let refreshing = false

    async function refresh() {
      if (refreshing) {
        return
      }

      refreshing = true

      try {
        const nextItems = []

        let cursor

        do {
          const result = await listRoute({ cursor, take: 100 })

          nextItems.push(...result.items)

          cursor = result.cursor
        } while (cursor && !cancelled)

        if (cancelled) {
          return
        }

        const normalizedItems = normalizeItems(nextItems)

        setSnapshot((current) =>
          current.key === cacheKey &&
          areItemsEqual(current.items, normalizedItems)
            ? current
            : { key: cacheKey, items: normalizedItems }
        )
      } catch {
        if (!cancelled) {
          setSnapshot((current) =>
            current.key === cacheKey ? current : { key: cacheKey, items: [] }
          )
        }
      } finally {
        refreshing = false
      }
    }

    refresh()

    const interval = window.setInterval(refresh, PROJECT_SCOPE_REFRESH_INTERVAL)

    return () => {
      cancelled = true

      window.clearInterval(interval)
    }
  }, [cacheKey, listRoute, normalizeItems, version])

  return { hydrated, items }
}

function normalizeProjects(projects) {
  return projects.filter((project) => typeof project?.id === 'string')
}

function normalizeBotIds(botIds) {
  return botIds.filter((id) => typeof id === 'string').sort()
}

export function getProjectScopeStorageKey(ownerId) {
  return ownerId ? `${PROJECT_SCOPE_STORAGE_KEY}:${ownerId}` : null
}

/**
 * Persists the active project for an account. Passing null clears the scope.
 * Storage is best-effort so callers can continue when it is unavailable.
 */
export function persistProjectScope(ownerId, scope) {
  const storageKey = getProjectScopeStorageKey(ownerId)

  if (!storageKey || typeof window === 'undefined') {
    return
  }

  try {
    if (scope) {
      window.localStorage.setItem(storageKey, JSON.stringify(scope))
    } else {
      window.localStorage.removeItem(storageKey)
    }
  } catch {
    // storage is best-effort
  }
}

const ProjectScopeContext = createContext({
  hydrated: true,
  projectsHydrated: true,
  resourcesHydrated: true,
  projects: [],
  scope: null,
  botIds: null,
  setScope: () => {},
})

/**
 * Holds the active project scope for the dashboard builder experience: a
 * blueprint the user has chosen to work in, or null for the unscoped (all
 * resources) view. The selection is made once in the dashboard sidebar
 * (ProjectScopeSelector) and read anywhere below the provider - resource lists
 * filter by it, create flows link new resources to it.
 *
 * The selection persists per account in localStorage so the scope survives
 * reloads and navigation without leaking across switched users or teams.
 */
export function ProjectScopeProvider({ enabled = true, ownerId, children }) {
  const [hydratedOwnerId, setHydratedOwnerId] = useState(null)

  const [scope, setScopeState] = useState(null)

  const [projectsVersion, setProjectsVersion] = useState(0)

  const hydrated = !enabled || (!!ownerId && hydratedOwnerId === ownerId)

  const projectKey = enabled && ownerId ? `projects:${ownerId}` : null

  const resourceKey =
    enabled && ownerId && scope?.id ? `bots:${ownerId}:${scope.id}` : null

  const projectListRoute = useGraphQLConnectionListRoute({
    query: PROJECT_SCOPE_PROJECT_LIST_QUERY,
    connection: 'blueprints',
    mapNode: mapProject,
  })

  const botListVariables = useMemo(
    () => ({
      blueprintIds: scope?.id ? [scope.id] : [],
    }),
    [scope?.id]
  )

  const botListRoute = useGraphQLConnectionListRoute({
    query: PROJECT_SCOPE_BOT_LIST_QUERY,
    connection: 'bots',
    variables: botListVariables,
    mapNode: mapBotId,
  })

  const { hydrated: projectsHydrated, items: projects } = useConnectionSnapshot(
    {
      cacheKey: projectKey,
      listRoute: projectListRoute,
      normalizeItems: normalizeProjects,
      version: projectsVersion,
    }
  )

  const { hydrated: resourcesHydrated, items: scopedBotIds } =
    useConnectionSnapshot({
      cacheKey: resourceKey,
      listRoute: botListRoute,
      normalizeItems: normalizeBotIds,
    })

  const botIds = scope ? scopedBotIds : null

  useEffect(() => {
    const storageKey = getProjectScopeStorageKey(ownerId)

    if (!enabled || !storageKey) {
      setScopeState(null)

      setHydratedOwnerId(null)

      return
    }

    setHydratedOwnerId(null)
    setScopeState(null)

    try {
      const raw = window.localStorage.getItem(storageKey)

      if (raw) {
        const storedScope = JSON.parse(raw)

        if (
          storedScope &&
          typeof storedScope.id === 'string' &&
          typeof storedScope.name === 'string'
        ) {
          setScopeState(storedScope)
        } else {
          persistProjectScope(ownerId, null)
        }
      }
    } catch {
      // ignore corrupted or unavailable storage
    } finally {
      setHydratedOwnerId(ownerId)
    }
  }, [enabled, ownerId])

  const setScope = useCallback(
    (next) => {
      if (!enabled || !getProjectScopeStorageKey(ownerId)) {
        return
      }

      setScopeState(next)
      persistProjectScope(ownerId, next)
    },
    [enabled, ownerId]
  )

  useListen(RESOURCE_DELETED_CHANNEL, (resource) => {
    if (!enabled || resource?.kind !== 'blueprint') {
      return
    }

    setProjectsVersion((version) => version + 1)

    if (scope?.id === resource.id) {
      setScope(null)
    }
  })

  // @note the scope names a blueprint of the account we were working as, so it
  // cannot follow us into another one. Nothing else drops it: the switch lives
  // in the run-as cookies, which change the account every request is served as
  // but not the signed in user this scope is stored under, so `ownerId` - and
  // with it the hydration effect above - stays put across a switch.
  useListen(ACCOUNT_SWITCHED_CHANNEL, () => {
    setScope(null)
  })

  const value = useMemo(
    () => ({
      hydrated: enabled ? hydrated : true,
      projectsHydrated: enabled ? projectsHydrated : true,
      resourcesHydrated: enabled ? resourcesHydrated : true,
      projects: enabled ? projects : [],
      scope: enabled ? scope : null,
      botIds: enabled ? botIds : null,
      setScope,
    }),
    [
      enabled,
      hydrated,
      projectsHydrated,
      resourcesHydrated,
      projects,
      scope,
      botIds,
      setScope,
    ]
  )

  return (
    <ProjectScopeContext.Provider value={value}>
      {children}
    </ProjectScopeContext.Provider>
  )
}

/**
 * Returns the available projects, active `{ id, name }` scope, its cached
 * `botIds`, hydration state, and the scope setter. Scope and bot IDs are null
 * when unscoped.
 */
export default function useProjectScope() {
  return useContext(ProjectScopeContext)
}

/**
 * Appends the active scope to a string list route, e.g.
 * `/api/v1/bot/list` -> `/api/v1/bot/list?blueprintId=...`. Function routes
 * and unscoped state pass through unchanged.
 */
export function scopeListRoute(listRoute, scope) {
  if (!scope || typeof listRoute !== 'string') {
    return listRoute
  }

  const [path, search] = listRoute.split('?')

  const params = new URLSearchParams(search)

  params.set('blueprintId', scope.id)

  return `${path}?${params.toString()}`
}
