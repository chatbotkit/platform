import IntegrationList from './IntegrationList'

import '@testing-library/jest-dom'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'

// @note the suite renders the real ResourceList, List and DynamicIcon so the
// wiring between them is exercised - the mappers, the type aware routes and
// the tags. Only the environment (session, fetch, scope, portals) is mocked.

const mockFetch = jest.fn()

jest.mock('@/lib/fetch', () => ({
  __esModule: true,
  default: (...args) => mockFetch(...args),
}))

jest.mock('@/lib/error', () => ({
  captureError: jest.fn(),
  captureException: jest.fn(),
}))

jest.mock('@/hooks/useRouter', () => {
  const normalizeHref = (href) =>
    typeof href === 'string' ? href : href?.pathname || ''

  return function useRouter() {
    return {
      push: jest.fn(),
      prefetch: jest.fn(),
      pathname: '/integrations',
      normalizeHref,
      resolveHref: normalizeHref,
      compareHref: () => false,
    }
  }
})

jest.mock('@/hooks/useSession', () => {
  return function useSession() {
    return { data: { user: { id: 'test-user' } } }
  }
})

jest.mock('@/hooks/useTheme', () => {
  return function useTheme() {
    return { theme: 'light' }
  }
})

// @note the identities must be stable across renders - ResourceList derives
// its load callback from them, and a fresh identity per render re-arms the
// auto load effect on every render
const mockApiFetch = jest.fn()
const mockReportError = jest.fn()
const mockOpenPopup = jest.fn()

jest.mock('@/hooks/useFetch', () => {
  return function useFetch() {
    return {
      fetch: mockApiFetch,
      loading: false,
      code: null,
      reportError: mockReportError,
    }
  }
})

jest.mock('@/hooks/usePopup', () => {
  return function usePopup() {
    return { popup: null, openPopup: mockOpenPopup }
  }
})

const mockProjectScope = { hydrated: true, scope: null }

jest.mock('@/hooks/useProjectScope', () => ({
  __esModule: true,
  default: () => mockProjectScope,
  usePublishResourceDeleted: () => jest.fn(),
}))

jest.mock('@/components/GlobalRoot', () => ({
  GlobalRootPortal: function GlobalRootPortal({ children }) {
    return <div>{children}</div>
  },
}))

jest.mock('@/components/Confirm', () => ({
  useConfirmDelete: () => jest.fn(() => Promise.resolve(true)),
  useConfirmDeleteWithOptions: () => jest.fn(() => Promise.resolve({})),
}))

// @note the create popup renders the icon of every integration on offer, and
// the svg backed ones do not survive the jest asset transform
jest.mock('@/icons/widget.svg', () => ({
  __esModule: true,
  default: (props) => <svg data-testid="icon-widget" {...props} />,
}))

jest.mock('@/icons/avatar.svg', () => ({
  __esModule: true,
  default: (props) => <svg data-testid="icon-avatar" {...props} />,
}))

jest.mock('@/icons/brands/anam.svg', () => ({
  __esModule: true,
  default: (props) => <svg data-testid="icon-anam" {...props} />,
}))

jest.mock('@/icons/brands/mcp.svg', () => ({
  __esModule: true,
  default: (props) => <svg data-testid="icon-mcp" {...props} />,
}))

jest.mock('@/icons/brands/recall.svg', () => ({
  __esModule: true,
  default: (props) => <svg data-testid="icon-recall" {...props} />,
}))

function node({ id, name, createdAt, ...rest }) {
  return {
    node: {
      id,
      name,
      description: null,
      createdAt,
      blueprint: null,
      ...rest,
    },
  }
}

function respondWith(data) {
  mockFetch.mockResolvedValue({
    ok: true,
    json: async () => ({ data }),
  })
}

function lastQuery() {
  const [, options] = mockFetch.mock.calls[mockFetch.mock.calls.length - 1]

  return JSON.parse(options.body).query
}

// @note the shape the bot, dataset and skillset pages pass down - already
// typed and flattened, unlike the nodes the merged query returns
function suppliedIntegrations() {
  return [
    {
      id: 'i_3',
      type: 'email',
      name: 'Inbox',
      description: null,
      blueprintId: null,
      createdAt: Date.parse('2026-07-01T00:00:00.000Z'),
    },
  ]
}

describe('IntegrationList', () => {
  beforeEach(() => {
    mockFetch.mockReset()
    mockApiFetch.mockReset()
    mockApiFetch.mockResolvedValue({ error: null })
    mockOpenPopup.mockReset()

    mockProjectScope.hydrated = true
    mockProjectScope.scope = null
  })

  // @note the popup hook is mocked, so the offered integrations are asserted by
  // rendering the content the list handed to it
  function renderCreateIntegrationPopup(name = 'Create Integration') {
    fireEvent.click(screen.getByRole('button', { name }))

    render(mockOpenPopup.mock.calls.at(-1)[0])
  }

  describe('self fetching', () => {
    it('should show a loading state and then the fetched integrations', async () => {
      respondWith({
        slackIntegrations: {
          edges: [
            node({
              id: 'i_1',
              name: 'Support Slack',
              description: 'The support workspace',
              createdAt: '2026-07-01T00:00:00.000Z',
            }),
          ],
        },
      })

      render(<IntegrationList authenticated={true} />)

      // @note the list frame renders immediately - the old implementation
      // replaced the whole section with a spinner instead
      expect(
        screen.getByRole('button', { name: 'Create Integration' })
      ).toBeInTheDocument()

      expect(screen.getByText('Loading...')).toBeInTheDocument()

      expect(await screen.findByText('Support Slack')).toBeInTheDocument()

      expect(screen.getByText('The support workspace')).toBeInTheDocument()
    })

    it('should link each row to its type aware instance route', async () => {
      respondWith({
        slackIntegrations: {
          edges: [
            node({
              id: 'i_1',
              name: 'Support Slack',
              createdAt: '2026-07-01T00:00:00.000Z',
            }),
          ],
        },
      })

      render(<IntegrationList authenticated={true} />)

      expect(await screen.findByText('Support Slack')).toBeInTheDocument()

      expect(
        screen.getByRole('link', { name: /Support Slack/ })
      ).toHaveAttribute('href', '/integrations/slack/i_1')
    })

    it('should render the type tag and the integration specific tags', async () => {
      respondWith({
        sitemapIntegrations: {
          edges: [
            node({
              id: 'i_2',
              name: 'Docs Sitemap',
              createdAt: '2026-07-01T00:00:00.000Z',
              syncStatus: 'synced',
              syncSchedule: 'daily',
              lastSyncedAt: null,
            }),
          ],
        },
      })

      render(<IntegrationList authenticated={true} />)

      expect(await screen.findByText('Docs Sitemap')).toBeInTheDocument()

      expect(screen.getByText('sitemap')).toBeInTheDocument()
      expect(screen.getByText('synced')).toBeInTheDocument()
      expect(screen.getByText('sync schedule daily')).toBeInTheDocument()
    })

    it('should merge every connection into one list, newest first', async () => {
      respondWith({
        slackIntegrations: {
          edges: [
            node({
              id: 'i_old',
              name: 'Older Slack',
              createdAt: '2026-01-01T00:00:00.000Z',
            }),
          ],
        },
        emailIntegrations: {
          edges: [
            node({
              id: 'i_new',
              name: 'Newer Email',
              createdAt: '2026-07-01T00:00:00.000Z',
            }),
          ],
        },
      })

      render(<IntegrationList authenticated={true} />)

      expect(await screen.findByText('Newer Email')).toBeInTheDocument()

      const titles = screen
        .getAllByRole('link')
        .map((link) => link.textContent)
        .filter((text) => /Slack|Email/.test(text))

      expect(titles[0]).toMatch(/Newer Email/)
      expect(titles[1]).toMatch(/Older Slack/)
    })

    it('should show the standard empty message when there is nothing to list', async () => {
      respondWith({ slackIntegrations: { edges: [] } })

      render(<IntegrationList authenticated={true} />)

      expect(
        await screen.findByText('You do not have any integrations yet.')
      ).toBeInTheDocument()

      // @note an exhausted list must settle - it must not keep re-arming the
      // auto load just because it has no items
      expect(mockFetch).toHaveBeenCalledTimes(1)
    })

    it('should offer a retry when the load fails', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        json: async () => ({ message: 'boom' }),
      })

      render(<IntegrationList authenticated={true} />)

      expect(
        await screen.findByRole('button', { name: 'Try again' })
      ).toBeInTheDocument()

      expect(
        screen.getByText(/Unable to load integrations/)
      ).toBeInTheDocument()
    })

    it('should not paginate - the merged query loads in one page', async () => {
      respondWith({
        slackIntegrations: {
          edges: [
            node({
              id: 'i_1',
              name: 'Support Slack',
              createdAt: '2026-07-01T00:00:00.000Z',
            }),
          ],
        },
      })

      render(<IntegrationList authenticated={true} />)

      expect(await screen.findByText('Support Slack')).toBeInTheDocument()

      expect(screen.queryByText('Load more')).not.toBeInTheDocument()
    })

    it('should query the private connections only when they are shown', async () => {
      respondWith({})

      const { unmount } = render(<IntegrationList authenticated={true} />)

      await waitFor(() => expect(mockFetch).toHaveBeenCalled())

      expect(lastQuery()).not.toContain('anamIntegrations')

      unmount()

      render(<IntegrationList authenticated={true} showPrivateIntegrations />)

      await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(2))

      expect(lastQuery()).toContain('anamIntegrations')
    })
  })

  describe('project scope', () => {
    it('should wait for the scope to hydrate before fetching', async () => {
      respondWith({})

      mockProjectScope.hydrated = false

      render(<IntegrationList authenticated={true} scopeAware={true} />)

      expect(screen.getByText('Loading...')).toBeInTheDocument()

      expect(mockFetch).not.toHaveBeenCalled()
    })

    it('should scope the query to the active project server side', async () => {
      respondWith({})

      mockProjectScope.scope = { id: 'bp_1' }

      render(<IntegrationList authenticated={true} scopeAware={true} />)

      await waitFor(() => expect(mockFetch).toHaveBeenCalled())

      expect(lastQuery()).toContain('blueprintIds: ["bp_1"]')
    })

    it('should not scope the query when the list is not scope aware', async () => {
      respondWith({})

      mockProjectScope.scope = { id: 'bp_1' }

      render(<IntegrationList authenticated={true} />)

      await waitFor(() => expect(mockFetch).toHaveBeenCalled())

      expect(lastQuery()).not.toContain('blueprintIds')
    })
  })

  describe('pre-supplied integrations', () => {
    it('should render the given integrations without fetching', () => {
      render(<IntegrationList integrations={suppliedIntegrations()} />)

      expect(screen.getByText('Inbox')).toBeInTheDocument()
      expect(screen.getByText('email')).toBeInTheDocument()
      expect(
        screen.getByText('An integration without description')
      ).toBeInTheDocument()

      expect(mockFetch).not.toHaveBeenCalled()
    })

    it('should render integrations that arrive after the first render', () => {
      const { rerender } = render(<IntegrationList integrations={[]} />)

      expect(
        screen.getByText('You do not have any integrations yet.')
      ).toBeInTheDocument()

      rerender(<IntegrationList integrations={suppliedIntegrations()} />)

      expect(screen.getByText('Inbox')).toBeInTheDocument()
    })

    it('should filter the integrations by scope when scope aware', () => {
      mockProjectScope.scope = { id: 'bp_1' }

      render(
        <IntegrationList
          scopeAware={true}
          integrations={[
            ...suppliedIntegrations(),
            {
              id: 'i_4',
              type: 'slack',
              name: 'Scoped Slack',
              description: null,
              blueprintId: 'bp_1',
              createdAt: Date.parse('2026-07-02T00:00:00.000Z'),
            },
          ]}
        />
      )

      expect(screen.getByText('Scoped Slack')).toBeInTheDocument()
      expect(screen.queryByText('Inbox')).not.toBeInTheDocument()
    })
  })

  describe('actions', () => {
    it('should offer the create action only when authenticated', () => {
      const { unmount } = render(
        <IntegrationList authenticated={true} integrations={[]} />
      )

      expect(
        screen.getByRole('button', { name: 'Create Integration' })
      ).toBeInTheDocument()

      unmount()

      render(<IntegrationList integrations={[]} />)

      expect(
        screen.queryByRole('button', { name: 'Create Integration' })
      ).not.toBeInTheDocument()
    })

    it('should open the create integration popup', () => {
      render(<IntegrationList authenticated={true} integrations={[]} />)

      fireEvent.click(
        screen.getByRole('button', { name: 'Create Integration' })
      )

      expect(mockOpenPopup).toHaveBeenCalled()
    })

    it('should render the actions prop alongside the list', () => {
      render(
        <IntegrationList
          integrations={[]}
          actions={<span>Create integration</span>}
        />
      )

      expect(screen.getByText('Create integration')).toBeInTheDocument()
    })

    it('should offer every integration when there is no resource', () => {
      render(<IntegrationList authenticated={true} integrations={[]} />)

      renderCreateIntegrationPopup()

      expect(screen.getByRole('link', { name: 'Slack Bot' })).toHaveAttribute(
        'href',
        '/integrations/slack/new'
      )

      expect(
        screen.getByRole('link', { name: 'Website Importer' })
      ).toBeInTheDocument()

      expect(
        screen.getByRole('link', { name: 'MCP Server' })
      ).toBeInTheDocument()
    })

    it('should offer the create action from the page of a resource', () => {
      const { unmount } = render(
        <IntegrationList
          integrations={[]}
          resource={{ type: 'bot', id: 'bot_1' }}
        />
      )

      expect(
        screen.getByRole('button', { name: 'Create integration' })
      ).toBeInTheDocument()

      unmount()

      render(<IntegrationList integrations={[]} />)

      expect(
        screen.queryByRole('button', { name: 'Create integration' })
      ).not.toBeInTheDocument()
    })

    it('should offer only the bot integrations from the page of a bot', () => {
      render(
        <IntegrationList
          integrations={[]}
          resource={{ type: 'bot', id: 'bot_1' }}
        />
      )

      renderCreateIntegrationPopup('Create integration')

      expect(screen.getByRole('link', { name: 'Slack Bot' })).toHaveAttribute(
        'href',
        '/integrations/slack/new?botId=bot_1'
      )

      // @note the importers attach to a dataset and the servers to a skillset,
      // so neither is on offer from the page of a bot
      expect(
        screen.queryByRole('link', { name: 'Website Importer' })
      ).not.toBeInTheDocument()

      expect(
        screen.queryByRole('link', { name: 'MCP Server' })
      ).not.toBeInTheDocument()
    })

    it('should offer only the dataset integrations from the page of a dataset', () => {
      render(
        <IntegrationList
          integrations={[]}
          resource={{ type: 'dataset', id: 'dst_1' }}
        />
      )

      renderCreateIntegrationPopup('Create integration')

      expect(
        screen.getByRole('link', { name: 'Website Importer' })
      ).toHaveAttribute('href', '/integrations/sitemap/new?datasetId=dst_1')

      expect(
        screen.queryByRole('link', { name: 'Slack Bot' })
      ).not.toBeInTheDocument()
    })

    it('should offer only the skillset integrations from the page of a skillset', () => {
      render(
        <IntegrationList
          integrations={[]}
          resource={{ type: 'skillset', id: 'sks_1' }}
        />
      )

      renderCreateIntegrationPopup('Create integration')

      expect(screen.getByRole('link', { name: 'MCP Server' })).toHaveAttribute(
        'href',
        '/integrations/mcpserver/new?skillsetId=sks_1'
      )

      expect(
        screen.queryByRole('link', { name: 'Slack Bot' })
      ).not.toBeInTheDocument()
    })

    it('should delete through the type aware delete route', async () => {
      render(<IntegrationList integrations={suppliedIntegrations()} />)

      // @note unauthenticated, so the row action menu is the only button
      fireEvent.click(screen.getByRole('button'))

      fireEvent.click(await screen.findByText('Delete'))

      await waitFor(() =>
        expect(mockApiFetch).toHaveBeenCalledWith(
          '/api/v1/integration/email/i_3/delete',
          { data: {} }
        )
      )

      // @note the row goes away optimistically
      await waitFor(() =>
        expect(screen.queryByText('Inbox')).not.toBeInTheDocument()
      )
    })
  })
})
