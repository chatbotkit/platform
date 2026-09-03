import ConversationList from './ConversationList'
import ResourceList from './ResourceList'

import fetch from '@/lib/fetch'

import '@testing-library/jest-dom'
import { render } from '@testing-library/react'

let mockProjectScope = {
  hydrated: true,
  resourcesHydrated: true,
  scope: null,
  botIds: null,
}

jest.mock('@/lib/fetch', () => ({
  __esModule: true,
  default: jest.fn(),
}))

jest.mock('@/hooks/useProjectScope', () => ({
  __esModule: true,
  default: jest.fn(() => mockProjectScope),
}))

jest.mock('./ResourceList', () =>
  jest.fn(
    ({
      kind,
      listRoute,
      exportRoute,
      deleteRoute,
      instanceRoute,
      filter,
      ...props
    }) => (
        <div data-testid="resource-list">
          <div data-testid="kind">{kind}</div>
        <div data-testid="list-route">{JSON.stringify(listRoute)}</div>
        <div data-testid="export-route">{exportRoute}</div>
        <div data-testid="delete-route">{deleteRoute}</div>
        <div data-testid="instance-route">{instanceRoute}</div>
        <div data-testid="filter">{String(filter)}</div>
        <div data-testid="extra-props">{JSON.stringify(props)}</div>
      </div>
    )
  )
)

describe('ConversationList', () => {
  beforeEach(() => {
    mockProjectScope = {
      hydrated: true,
      resourcesHydrated: true,
      scope: null,
      botIds: null,
    }
  })

  describe('basic rendering', () => {
    it('should render ResourceList component', () => {
      const { getByTestId } = render(<ConversationList />)

      expect(getByTestId('resource-list')).toBeInTheDocument()
    })

    it('should use default kind of conversation', () => {
      const { getByTestId } = render(<ConversationList />)

      expect(getByTestId('kind')).toHaveTextContent('conversation')
    })

    it('should use GraphQL list route by default', () => {
      const { getByTestId } = render(<ConversationList />)

      expect(getByTestId('list-route')).toHaveTextContent(
        '/api/v1/graphql'
      )
    })

    it('should use default exportRoute', () => {
      const { getByTestId } = render(<ConversationList />)

      expect(getByTestId('export-route')).toHaveTextContent(
        '/api/v1/conversation/export'
      )
    })

    it('should use default deleteRoute', () => {
      const { getByTestId } = render(<ConversationList />)

      expect(getByTestId('delete-route')).toHaveTextContent(
        '/api/v1/conversation/[id]/delete'
      )
    })

    it('should use default instanceRoute', () => {
      const { getByTestId } = render(<ConversationList />)

      expect(getByTestId('instance-route')).toHaveTextContent(
        '/conversations/[id]'
      )
    })

    it('should use default filter of true', () => {
      const { getByTestId } = render(<ConversationList />)

      expect(getByTestId('filter')).toHaveTextContent('true')
    })
  })

  describe('custom props', () => {
    it('should accept custom kind', () => {
      const { getByTestId } = render(<ConversationList kind="custom" />)

      expect(getByTestId('kind')).toHaveTextContent('custom')
    })

    it('should accept custom listRoute', () => {
      const { getByTestId } = render(
        <ConversationList listRoute="/custom/list" />
      )

      expect(getByTestId('list-route')).toHaveTextContent('/custom/list')
    })

    it('should accept custom exportRoute', () => {
      const { getByTestId } = render(
        <ConversationList exportRoute="/custom/export" />
      )

      expect(getByTestId('export-route')).toHaveTextContent('/custom/export')
    })

    it('should accept custom deleteRoute', () => {
      const { getByTestId } = render(
        <ConversationList deleteRoute="/custom/[id]/delete" />
      )

      expect(getByTestId('delete-route')).toHaveTextContent(
        '/custom/[id]/delete'
      )
    })

    it('should accept custom instanceRoute', () => {
      const { getByTestId } = render(
        <ConversationList instanceRoute="/custom/[id]" />
      )

      expect(getByTestId('instance-route')).toHaveTextContent('/custom/[id]')
    })

    it('should accept filter as false', () => {
      const { getByTestId } = render(<ConversationList filter={false} />)

      expect(getByTestId('filter')).toHaveTextContent('false')
    })

    it('should forward additional props to ResourceList', () => {
      const { getByTestId } = render(
        <ConversationList customProp="value" anotherProp={123} />
      )

      const extraProps = JSON.parse(getByTestId('extra-props').textContent)

      expect(extraProps).toEqual({
        customProp: 'value',
        anotherProp: 123,
      })
    })
  })

  describe('contactId handling', () => {
    it('should use GraphQL route when contactId is provided by default', () => {
      const { getByTestId } = render(
        <ConversationList contactId="contact123" />
      )

      expect(getByTestId('list-route')).toHaveTextContent(
        '/api/v1/graphql'
      )
    })

    it('should override custom listRoute when contactId is provided', () => {
      const { getByTestId } = render(
        <ConversationList listRoute="/custom/list" contactId="contact456" />
      )

      expect(getByTestId('list-route')).toHaveTextContent(
        '/api/v1/contact/contact456/conversation/list'
      )
    })

    it('should handle contactId with special characters in GraphQL mode', () => {
      const { getByTestId } = render(
        <ConversationList contactId="abc-123_xyz" />
      )

      expect(getByTestId('list-route')).toHaveTextContent(
        '/api/v1/graphql'
      )
    })

    it('should keep GraphQL transport when contactId changes', () => {
      const { getByTestId, rerender } = render(
        <ConversationList contactId="contact1" />
      )

      expect(getByTestId('list-route')).toHaveTextContent(
        '/api/v1/graphql'
      )

      rerender(<ConversationList contactId="contact2" />)

      expect(getByTestId('list-route')).toHaveTextContent(
        '/api/v1/graphql'
      )
    })

    it('should keep GraphQL transport when contactId is removed', () => {
      const { getByTestId, rerender } = render(
        <ConversationList contactId="contact123" />
      )

      expect(getByTestId('list-route')).toHaveTextContent(
        '/api/v1/graphql'
      )

      rerender(<ConversationList />)

      expect(getByTestId('list-route')).toHaveTextContent(
        '/api/v1/graphql'
      )
    })
  })

  describe('botId handling', () => {
    it('should use GraphQL route when botId is provided by default', () => {
      const { getByTestId } = render(<ConversationList botId="bot123" />)

      expect(getByTestId('list-route')).toHaveTextContent(
        '/api/v1/graphql'
      )
    })

    it('should not forward botId to ResourceList as an extra prop', () => {
      const { getByTestId } = render(<ConversationList botId="bot123" />)

      const extraProps = JSON.parse(getByTestId('extra-props').textContent)

      expect(extraProps.botId).toBeUndefined()
    })

    it('should use GraphQL route when contactId and botId are provided by default', () => {
      const { getByTestId } = render(
        <ConversationList contactId="contact1" botId="bot1" />
      )

      expect(getByTestId('list-route')).toHaveTextContent(
        '/api/v1/graphql'
      )
    })
  })

  describe('taskId handling', () => {
    it('should use GraphQL route when taskId is provided by default', () => {
      const { getByTestId } = render(<ConversationList taskId="task123" />)

      expect(getByTestId('list-route')).toHaveTextContent(
        '/api/v1/graphql'
      )
    })

    it('should not forward taskId to ResourceList as an extra prop', () => {
      const { getByTestId } = render(<ConversationList taskId="task123" />)

      const extraProps = JSON.parse(getByTestId('extra-props').textContent)

      expect(extraProps.taskId).toBeUndefined()
    })
  })

  describe('project scope', () => {
    it('should filter conversations by the active project bot IDs', async () => {
      mockProjectScope = {
        hydrated: true,
        resourcesHydrated: true,
        scope: { id: 'blueprint_123', name: 'Project' },
        botIds: ['bot_1', 'bot_2'],
      }
      fetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          data: { conversations: { edges: [], pageInfo: {} } },
        }),
      })

      render(<ConversationList />)

      const { listRoute } = ResourceList.mock.calls.at(-1)[0]

      await listRoute({})

      const body = JSON.parse(fetch.mock.calls.at(-1)[1].body)

      expect(body.variables.botIds).toEqual(['bot_1', 'bot_2'])
    })

    it('should update the filter when project bot membership changes', async () => {
      fetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          data: { conversations: { edges: [], pageInfo: {} } },
        }),
      })

      mockProjectScope = {
        hydrated: true,
        resourcesHydrated: true,
        scope: { id: 'blueprint_123', name: 'Project' },
        botIds: ['bot_1'],
      }

      const { rerender } = render(<ConversationList />)

      mockProjectScope = {
        ...mockProjectScope,
        botIds: ['bot_1', 'bot_2'],
      }

      rerender(<ConversationList />)

      const { listRoute } = ResourceList.mock.calls.at(-1)[0]

      await listRoute({})

      const body = JSON.parse(fetch.mock.calls.at(-1)[1].body)

      expect(body.variables.botIds).toEqual(['bot_1', 'bot_2'])
    })

    it('should reject an explicit bot outside the active project', async () => {
      mockProjectScope = {
        hydrated: true,
        resourcesHydrated: true,
        scope: { id: 'blueprint_123', name: 'Project' },
        botIds: ['bot_1'],
      }
      fetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          data: { conversations: { edges: [], pageInfo: {} } },
        }),
      })

      render(<ConversationList botId="bot_other" />)

      const { listRoute } = ResourceList.mock.calls.at(-1)[0]

      await listRoute({})

      const body = JSON.parse(fetch.mock.calls.at(-1)[1].body)

      expect(body.variables.botIds).toEqual([])
    })

    it('should wait for project resources before automatically loading', () => {
      mockProjectScope = {
        hydrated: true,
        resourcesHydrated: false,
        scope: { id: 'blueprint_123', name: 'Project' },
        botIds: [],
      }

      render(<ConversationList autoLoad />)

      const props = ResourceList.mock.calls.at(-1)[0]

      expect(props.autoLoad).toBe(false)
      expect(props.loading).toBe(true)
    })
  })

  describe('channel integration handling', () => {
    it.each([
      ['widgetIntegrationId', 'widget'],
      ['emailIntegrationId', 'email'],
      ['triggerIntegrationId', 'trigger'],
      ['githubIntegrationId', 'github'],
      ['instagramIntegrationId', 'instagram'],
      ['microsoftteamsIntegrationId', 'microsoftteams'],
    ])(
      'should keep GraphQL route while mapping %s to meta.%s variables',
      (prop) => {
        const { getByTestId } = render(
          <ConversationList {...{ [prop]: 'int123' }} />
        )

        expect(getByTestId('list-route')).toHaveTextContent(
          '/api/v1/graphql'
        )
      }
    )

    it('should not forward the integration filter to ResourceList', () => {
      const { getByTestId } = render(
        <ConversationList widgetIntegrationId="int123" />
      )

      const extraProps = JSON.parse(getByTestId('extra-props').textContent)

      expect(extraProps.widgetIntegrationId).toBeUndefined()
    })

    it('should still forward unrelated props alongside a filter', () => {
      const { getByTestId } = render(
        <ConversationList triggerIntegrationId="int123" customProp="value" />
      )

      const extraProps = JSON.parse(getByTestId('extra-props').textContent)

      expect(extraProps).toEqual({ customProp: 'value' })
    })

    it('should merge multiple integration filters into GraphQL meta', async () => {
      fetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          data: { conversations: { edges: [], pageInfo: {} } },
        }),
      })

      render(
        <ConversationList
          widgetIntegrationId="wid_1"
          slackIntegrationId="sid_2"
        />
      )

      const { listRoute } = ResourceList.mock.calls.at(-1)[0]

      await listRoute({})

      const body = JSON.parse(fetch.mock.calls.at(-1)[1].body)

      expect(body.variables.meta).toEqual({
        widget: { integrationId: 'wid_1' },
        slack: { integrationId: 'sid_2' },
      })
    })

    it('should use the first matched channel for the route fallback', () => {
      const { getByTestId } = render(
        <ConversationList
          listMode="route"
          listRoute="/api/v1/custom/list"
          slackIntegrationId="sid_2"
          widgetIntegrationId="wid_1"
        />
      )

      // widget precedes slack in INTEGRATION_FILTER_CHANNELS order
      expect(getByTestId('list-route')).toHaveTextContent(
        'meta.widget.integrationId=wid_1'
      )
    })
  })

  describe('edge cases', () => {
    it('should handle empty contactId', () => {
      const { getByTestId } = render(<ConversationList contactId="" />)

      expect(getByTestId('list-route')).toHaveTextContent(
        '/api/v1/graphql'
      )
    })

    it('should handle null contactId', () => {
      const { getByTestId } = render(<ConversationList contactId={null} />)

      expect(getByTestId('list-route')).toHaveTextContent(
        '/api/v1/graphql'
      )
    })

    it('should handle undefined contactId explicitly', () => {
      const { getByTestId } = render(<ConversationList contactId={undefined} />)

      expect(getByTestId('list-route')).toHaveTextContent(
        '/api/v1/graphql'
      )
    })

    it('should handle all props together', () => {
      const { getByTestId } = render(
        <ConversationList
          kind="archived"
          listRoute="/custom/list"
          exportRoute="/custom/export"
          deleteRoute="/custom/delete"
          instanceRoute="/custom/view"
          filter={false}
          contactId="contact789"
          customProp="test"
        />
      )

      expect(getByTestId('kind')).toHaveTextContent('archived')
      expect(getByTestId('list-route')).toHaveTextContent(
        '/api/v1/contact/contact789/conversation/list'
      )
      expect(getByTestId('export-route')).toHaveTextContent('/custom/export')
      expect(getByTestId('delete-route')).toHaveTextContent('/custom/delete')
      expect(getByTestId('instance-route')).toHaveTextContent('/custom/view')
      expect(getByTestId('filter')).toHaveTextContent('false')

      const extraProps = JSON.parse(getByTestId('extra-props').textContent)

      expect(extraProps.customProp).toBe('test')
    })
  })

  describe('memoization', () => {
    it('should memoize listRoute based on contactId and _listRoute', () => {
      const { getByTestId, rerender } = render(
        <ConversationList contactId="contact1" customProp="value1" />
      )

      const firstRoute = getByTestId('list-route').textContent

      rerender(<ConversationList contactId="contact1" customProp="value2" />)

      const secondRoute = getByTestId('list-route').textContent

      expect(firstRoute).toBe(secondRoute)
    })

    it('should keep the visible GraphQL route when dependencies change', () => {
      const { getByTestId, rerender } = render(
        <ConversationList contactId="contact1" />
      )

      const firstRoute = getByTestId('list-route').textContent

      rerender(<ConversationList contactId="contact2" />)

      const secondRoute = getByTestId('list-route').textContent

      expect(firstRoute).toBe(secondRoute)
    })
  })
})
