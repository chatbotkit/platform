/* eslint-disable @typescript-eslint/no-require-imports */
import MemoryList from './MemoryList'

import { render } from '@testing-library/react'

jest.mock('@/components/ResourceList', () => ({
  __esModule: true,
  default: jest.fn(() => null),
}))

const ResourceList = require('@/components/ResourceList').default

function expectGraphQLListRoute(listRoute) {
  expect(typeof listRoute).toBe('function')
  expect(listRoute.toJSON()).toBe('/api/v1/graphql')
}

describe('MemoryList', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('uses GraphQL list route when no filters are provided', () => {
    render(<MemoryList data-testid="memory-list" />)

    expect(ResourceList).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'memory',
        listRoute: expect.any(Function),
      }),
      undefined
    )

    expectGraphQLListRoute(ResourceList.mock.calls[0][0].listRoute)
  })

  it('appends contact and bot filters to the list route in route mode', () => {
    render(
      <MemoryList
        listMode="route"
        listRoute="/api/v1/memory/list"
        contactId="c-1"
        botId="b-1"
      />
    )

    const props = ResourceList.mock.calls[0][0]
    const route = new URL(props.listRoute, 'https://example.com')

    expect(route.pathname).toBe('/api/v1/memory/list')
    expect(route.searchParams.get('contactId')).toBe('c-1')
    expect(route.searchParams.get('botId')).toBe('b-1')
  })

  it('uses mappers for fallback name, description, and extra tags', () => {
    render(<MemoryList />)

    const { nameMapper, descriptionMapper, extraTags } =
      ResourceList.mock.calls[0][0]

    expect(nameMapper({ id: 'memory-1', name: '' })).toBe('memory-1')
    expect(nameMapper({ id: 'memory-1', name: 'Configured name' })).toBe(
      'Configured name'
    )

    expect(descriptionMapper({ description: 'Explicit description' })).toBe(
      'Explicit description'
    )
    expect(descriptionMapper({ description: '', text: 'Fallback text' })).toBe(
      'Fallback text'
    )

    const emptyDescription = descriptionMapper({})

    expect(emptyDescription.props.className).toContain('italic')
    expect(emptyDescription.props.children).toBe('A memory without description')

    const tags = extraTags({ contactId: 'c-1', botId: 'b-1' })
    const renderedTags = Array.isArray(tags.props.children)
      ? tags.props.children
      : [tags.props.children]

    expect(renderedTags[0].props.children).toBe('contact')
    expect(renderedTags[1].props.children).toBe('bot')
  })
})
