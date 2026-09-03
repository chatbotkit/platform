import useProjectScope, {
  PROJECT_SCOPE_REFRESH_INTERVAL,
  ProjectScopeProvider,
  getProjectScopeStorageKey,
  persistProjectScope,
  usePublishAccountSwitched,
  usePublishResourceDeleted,
} from './useProjectScope'

import '@testing-library/jest-dom'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'

const mockProjectListRoute = jest.fn()
const mockBotListRoute = jest.fn()
const mockUseGraphQLConnectionListRoute = jest.fn(({ connection }) =>
  connection === 'blueprints' ? mockProjectListRoute : mockBotListRoute
)

jest.mock('@/hooks/useGraphQLConnectionListRoute', () => ({
  __esModule: true,
  default: (...args) => mockUseGraphQLConnectionListRoute(...args),
}))

const OWNER_ID = 'user_123'
const STORAGE_KEY = getProjectScopeStorageKey(OWNER_ID)

function Probe() {
  const { hydrated, scope, setScope } = useProjectScope()

  return (
    <button
      type="button"
      onClick={() => setScope({ id: 'blueprint_next', name: 'Next' })}
    >
      {hydrated ? scope?.id || 'none' : 'loading'}
    </button>
  )
}

function ResourceProbe() {
  const { botIds, resourcesHydrated } = useProjectScope()

  return (
    <output>
      {resourcesHydrated ? botIds?.join(',') || 'none' : 'loading-resources'}
    </output>
  )
}

function DeleteProbe({ resource }) {
  const publishResourceDeleted = usePublishResourceDeleted()

  return (
    <button
      type="button"
      data-testid="publish"
      onClick={() => publishResourceDeleted(resource)}
    >
      publish
    </button>
  )
}

function AccountSwitchProbe() {
  const publishAccountSwitched = usePublishAccountSwitched()

  return (
    <button
      type="button"
      data-testid="switch"
      onClick={() => publishAccountSwitched()}
    >
      switch
    </button>
  )
}

function ProjectsProbe() {
  const { projects, projectsHydrated } = useProjectScope()

  return (
    <output data-testid="projects">
      {projectsHydrated
        ? projects.map(({ id, name }) => `${id}:${name}`).join(',') || 'none'
        : 'loading-projects'}
    </output>
  )
}

describe('persistProjectScope', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('stores the project under its account-specific key', () => {
    persistProjectScope(OWNER_ID, {
      id: 'blueprint_saved',
      name: 'Saved',
    })

    expect(window.localStorage.getItem(STORAGE_KEY)).toBe(
      JSON.stringify({ id: 'blueprint_saved', name: 'Saved' })
    )
  })

  it('removes the stored project when clearing the scope', () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ id: 'blueprint_saved', name: 'Saved' })
    )

    persistProjectScope(OWNER_ID, null)

    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull()
  })

  it('does nothing without an owner', () => {
    persistProjectScope(null, {
      id: 'blueprint_saved',
      name: 'Saved',
    })

    expect(window.localStorage).toHaveLength(0)
  })
})

describe('ProjectScopeProvider', () => {
  beforeEach(() => {
    window.localStorage.clear()
    mockProjectListRoute.mockReset()
    mockProjectListRoute.mockResolvedValue({ items: [], cursor: null })
    mockBotListRoute.mockReset()
    mockBotListRoute.mockResolvedValue({ items: [], cursor: null })
    mockUseGraphQLConnectionListRoute.mockClear()
  })

  it('loads every project into the shared scope through GraphQL', async () => {
    mockProjectListRoute
      .mockResolvedValueOnce({
        items: [{ id: 'blueprint_1', name: 'One' }],
        cursor: 'cursor_1',
      })
      .mockResolvedValueOnce({
        items: [{ id: 'blueprint_2', name: 'Untitled' }],
        cursor: null,
      })

    render(
      <ProjectScopeProvider ownerId={OWNER_ID}>
        <ProjectsProbe />
      </ProjectScopeProvider>
    )

    expect(screen.getByTestId('projects')).toHaveTextContent('loading-projects')

    await waitFor(() => {
      expect(screen.getByTestId('projects')).toHaveTextContent(
        'blueprint_1:One,blueprint_2:Untitled'
      )
    })

    expect(mockUseGraphQLConnectionListRoute).toHaveBeenCalledWith(
      expect.objectContaining({ connection: 'blueprints' })
    )
    expect(mockProjectListRoute).toHaveBeenNthCalledWith(1, {
      cursor: undefined,
      take: 100,
    })
    expect(mockProjectListRoute).toHaveBeenNthCalledWith(2, {
      cursor: 'cursor_1',
      take: 100,
    })
  })

  it('loads the active project bot IDs into the shared scope', async () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ id: 'blueprint_saved', name: 'Saved' })
    )
    mockBotListRoute.mockResolvedValue({
      items: ['bot_1', 'bot_2'],
      cursor: null,
    })

    render(
      <ProjectScopeProvider ownerId={OWNER_ID}>
        <ResourceProbe />
      </ProjectScopeProvider>
    )

    expect(screen.getByRole('status')).toHaveTextContent('loading-resources')

    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent('bot_1,bot_2')
    })

    expect(mockUseGraphQLConnectionListRoute).toHaveBeenLastCalledWith(
      expect.objectContaining({
        connection: 'bots',
        variables: { blueprintIds: ['blueprint_saved'] },
      })
    )
    expect(mockBotListRoute).toHaveBeenCalledWith({
      cursor: undefined,
      take: 100,
    })
  })

  it('reloads bot IDs when the selected project changes', async () => {
    mockBotListRoute.mockResolvedValue({
      items: ['bot_next'],
      cursor: null,
    })

    render(
      <ProjectScopeProvider ownerId={OWNER_ID}>
        <Probe />
        <ResourceProbe />
      </ProjectScopeProvider>
    )

    fireEvent.click(screen.getByRole('button'))

    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent('bot_next')
    })
  })

  it('loads every page of project bot IDs', async () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ id: 'blueprint_saved', name: 'Saved' })
    )
    mockBotListRoute
      .mockResolvedValueOnce({ items: ['bot_1'], cursor: 'cursor_1' })
      .mockResolvedValueOnce({ items: ['bot_2'], cursor: null })

    render(
      <ProjectScopeProvider ownerId={OWNER_ID}>
        <ResourceProbe />
      </ProjectScopeProvider>
    )

    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent('bot_1,bot_2')
    })

    expect(mockBotListRoute).toHaveBeenNthCalledWith(1, {
      cursor: undefined,
      take: 100,
    })
    expect(mockBotListRoute).toHaveBeenNthCalledWith(2, {
      cursor: 'cursor_1',
      take: 100,
    })
  })

  it('refreshes the active project bot IDs periodically', async () => {
    jest.useFakeTimers()
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ id: 'blueprint_saved', name: 'Saved' })
    )

    const { unmount } = render(
      <ProjectScopeProvider ownerId={OWNER_ID}>
        <ResourceProbe />
      </ProjectScopeProvider>
    )

    expect(mockBotListRoute).toHaveBeenCalledTimes(1)

    await act(async () => {
      await Promise.resolve()
    })

    await act(async () => {
      jest.advanceTimersByTime(PROJECT_SCOPE_REFRESH_INTERVAL)
      await Promise.resolve()
    })

    expect(mockBotListRoute).toHaveBeenCalledTimes(2)

    unmount()
    jest.useRealTimers()
  })

  it('refreshes the projects when a blueprint deletion is published', async () => {
    mockProjectListRoute
      .mockResolvedValueOnce({
        items: [
          { id: 'blueprint_1', name: 'One' },
          { id: 'blueprint_2', name: 'Two' },
        ],
        cursor: null,
      })
      .mockResolvedValueOnce({
        items: [{ id: 'blueprint_2', name: 'Two' }],
        cursor: null,
      })

    render(
      <ProjectScopeProvider ownerId={OWNER_ID}>
        <ProjectsProbe />
        <DeleteProbe resource={{ kind: 'blueprint', id: 'blueprint_1' }} />
      </ProjectScopeProvider>
    )

    await waitFor(() => {
      expect(screen.getByTestId('projects')).toHaveTextContent(
        'blueprint_1:One,blueprint_2:Two'
      )
    })

    fireEvent.click(screen.getByTestId('publish'))

    await waitFor(() => {
      expect(screen.getByTestId('projects')).toHaveTextContent(
        /^blueprint_2:Two$/
      )
    })

    expect(mockProjectListRoute).toHaveBeenCalledTimes(2)
  })

  it('clears the scope when the active project is deleted', async () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ id: 'blueprint_saved', name: 'Saved' })
    )

    render(
      <ProjectScopeProvider ownerId={OWNER_ID}>
        <Probe />
        <DeleteProbe resource={{ kind: 'blueprint', id: 'blueprint_saved' }} />
      </ProjectScopeProvider>
    )

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: 'blueprint_saved' })
      ).toBeInTheDocument()
    })

    fireEvent.click(screen.getByTestId('publish'))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'none' })).toBeInTheDocument()
    })

    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull()
  })

  it('clears the scope when the account is switched', async () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ id: 'blueprint_saved', name: 'Saved' })
    )

    render(
      <ProjectScopeProvider ownerId={OWNER_ID}>
        <Probe />
        <AccountSwitchProbe />
      </ProjectScopeProvider>
    )

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: 'blueprint_saved' })
      ).toBeInTheDocument()
    })

    fireEvent.click(screen.getByTestId('switch'))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'none' })).toBeInTheDocument()
    })

    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull()
  })

  it('ignores deletions of other resource kinds', async () => {
    render(
      <ProjectScopeProvider ownerId={OWNER_ID}>
        <ProjectsProbe />
        <DeleteProbe resource={{ kind: 'bot', id: 'bot_1' }} />
      </ProjectScopeProvider>
    )

    await waitFor(() => {
      expect(screen.getByTestId('projects')).toHaveTextContent('none')
    })

    fireEvent.click(screen.getByTestId('publish'))

    await act(async () => {
      await Promise.resolve()
    })

    expect(mockProjectListRoute).toHaveBeenCalledTimes(1)
  })

  it('loads a saved project scope when enabled', async () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ id: 'blueprint_saved', name: 'Saved' })
    )

    render(
      <ProjectScopeProvider ownerId={OWNER_ID}>
        <Probe />
      </ProjectScopeProvider>
    )

    await waitFor(() => {
      expect(screen.getByRole('button')).toHaveTextContent('blueprint_saved')
    })
  })

  it('stays unscoped when disabled even if storage has a project scope', () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ id: 'blueprint_saved', name: 'Saved' })
    )

    render(
      <ProjectScopeProvider enabled={false} ownerId={OWNER_ID}>
        <Probe />
      </ProjectScopeProvider>
    )

    expect(screen.getByRole('button')).toHaveTextContent('none')
  })

  it('does not update storage while disabled', () => {
    render(
      <ProjectScopeProvider enabled={false} ownerId={OWNER_ID}>
        <Probe />
      </ProjectScopeProvider>
    )

    fireEvent.click(screen.getByRole('button'))

    expect(window.localStorage.getItem(STORAGE_KEY)).toBe(null)
    expect(screen.getByRole('button')).toHaveTextContent('none')
  })

  it('loads a different scope when the active owner changes', async () => {
    window.localStorage.setItem(
      getProjectScopeStorageKey('user_one'),
      JSON.stringify({ id: 'blueprint_one', name: 'One' })
    )
    window.localStorage.setItem(
      getProjectScopeStorageKey('user_two'),
      JSON.stringify({ id: 'blueprint_two', name: 'Two' })
    )

    const { rerender } = render(
      <ProjectScopeProvider ownerId="user_one">
        <Probe />
      </ProjectScopeProvider>
    )

    await waitFor(() => {
      expect(screen.getByRole('button')).toHaveTextContent('blueprint_one')
    })

    rerender(
      <ProjectScopeProvider ownerId="user_two">
        <Probe />
      </ProjectScopeProvider>
    )

    await waitFor(() => {
      expect(screen.getByRole('button')).toHaveTextContent('blueprint_two')
    })
  })

  it('removes structurally invalid stored scope data', async () => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify('invalid'))

    render(
      <ProjectScopeProvider ownerId={OWNER_ID}>
        <Probe />
      </ProjectScopeProvider>
    )

    await waitFor(() => {
      expect(screen.getByRole('button')).toHaveTextContent('none')
    })

    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull()
  })
})
