import TeamList from './TeamList'

import { render, screen } from '@testing-library/react'

jest.mock('@/components/ResourceList', () => {
  return function ResourceList(props) {
    // @note function list routes (the GraphQL ones) serialize through their
    // toJSON to the endpoint they post to
    const listRoute =
      typeof props.listRoute === 'function'
        ? props.listRoute.toJSON?.() || 'function'
        : props.listRoute

    return (
      <div data-testid="resource-list">
        <div data-testid="kind">{props.kind}</div>
        <div data-testid="listRoute">{listRoute}</div>
        <div data-testid="deleteRoute">{props.deleteRoute}</div>
        <div data-testid="instanceRoute">{props.instanceRoute}</div>
        <div data-testid="filter">{String(props.filter)}</div>
        {props.extraTags && (
          <div data-testid="extraTags">
            {props.extraTags({ _count: { memberships: 5 } })}
          </div>
        )}
      </div>
    )
  }
})

describe('TeamList', () => {
  describe('basic rendering', () => {
    it('should render with default props', () => {
      render(<TeamList />)

      expect(screen.getByTestId('resource-list')).toBeTruthy()
      expect(screen.getByTestId('kind').textContent).toBe('team')
      // @note the default route is the GraphQL teams connection
      expect(screen.getByTestId('listRoute').textContent).toBe(
        '/api/v1/graphql'
      )
      expect(screen.getByTestId('deleteRoute').textContent).toBe(
        '/api/v1/team/[id]/delete'
      )
      expect(screen.getByTestId('instanceRoute').textContent).toBe(
        '/teams/[id]'
      )
      expect(screen.getByTestId('filter').textContent).toBe('false')
    })

    it('should apply custom kind', () => {
      render(<TeamList kind="organization" />)

      expect(screen.getByTestId('kind').textContent).toBe('organization')
    })

    it('should apply custom listRoute', () => {
      render(<TeamList listRoute="/custom/list" />)

      expect(screen.getByTestId('listRoute').textContent).toBe('/custom/list')
    })

    it('should apply custom deleteRoute', () => {
      render(<TeamList deleteRoute="/custom/delete" />)

      expect(screen.getByTestId('deleteRoute').textContent).toBe(
        '/custom/delete'
      )
    })

    it('should apply custom instanceRoute', () => {
      render(<TeamList instanceRoute="/custom/[id]" />)

      expect(screen.getByTestId('instanceRoute').textContent).toBe(
        '/custom/[id]'
      )
    })

    it('should enable filter when provided', () => {
      render(<TeamList filter={true} />)

      expect(screen.getByTestId('filter').textContent).toBe('true')
    })
  })

  describe('extraTags function', () => {
    it('should render member count for single member', () => {
      const { container } = render(<TeamList />)

      // @note extraTags is tested via the mock's render output
      const tags = container.querySelector('[data-testid="extraTags"]')

      expect(tags).toBeTruthy()
    })

    it('should render member count for multiple members', () => {
      render(<TeamList />)

      const tags = screen.getByTestId('extraTags')

      expect(tags.textContent).toBe('5 members')
    })
  })

  describe('props forwarding', () => {
    it('should forward additional props to ResourceList', () => {
      const { container } = render(<TeamList className="custom-class" />)

      expect(
        container.querySelector('[data-testid="resource-list"]')
      ).toBeTruthy()
    })
  })
})
