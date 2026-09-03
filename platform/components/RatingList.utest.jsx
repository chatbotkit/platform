/* eslint-disable @typescript-eslint/no-require-imports */
import RatingList from './RatingList'

import { render, screen } from '@testing-library/react'

const mockGraphQLListRoute = jest.fn()

mockGraphQLListRoute.toJSON = () => '/api/v1/graphql'

const mockUseGraphQLConnectionListRoute = jest.fn(() => mockGraphQLListRoute)

jest.mock('@/hooks/useRouter', () => ({
  __esModule: true,
  default: jest.fn(),
}))

jest.mock('@/hooks/useGraphQLConnectionListRoute', () => ({
  __esModule: true,
  default: (...args) => mockUseGraphQLConnectionListRoute(...args),
}))

jest.mock('@/components/Emoji', () => {
  return function Emoji({ children }) {
    return <span data-testid="emoji">{children}</span>
  }
})

jest.mock('@/components/ResourceList', () => {
  return function ResourceList(props) {
    return (
      <div data-testid="resource-list">
        <div data-testid="list-route">{JSON.stringify(props.listRoute)}</div>
        <div data-testid="filter-enabled">{String(props.filter)}</div>
        <div data-testid="filter-options-count">
          {props.filterOptions.length}
        </div>
        <div data-testid="selected-upvote">
          {String(props.filterOptions[0].isSelected)}
        </div>
        <div data-testid="selected-downvote">
          {String(props.filterOptions[1].isSelected)}
        </div>
        <div data-testid="extra-tag">{props.extraTags({ value: -1 })}</div>
        <div data-testid="description-fallback">
          {props.descriptionMapper({ reason: '', description: '' })}
        </div>
      </div>
    )
  }
})

describe('RatingList', () => {
  const useRouter = require('@/hooks/useRouter').default

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('forwards numeric comparison filters to GraphQL', () => {
    useRouter.mockReturnValue({ query: { value: '>=10' } })

    render(<RatingList />)

    expect(mockUseGraphQLConnectionListRoute).toHaveBeenCalledWith(
      expect.objectContaining({
        variables: expect.objectContaining({
          sentiment: undefined,
          value: '>=10',
        }),
      })
    )
  })

  it('forwards the sentiment filter to GraphQL', () => {
    useRouter.mockReturnValue({ query: { sentiment: 'upvote' } })

    render(<RatingList />)

    expect(mockUseGraphQLConnectionListRoute).toHaveBeenCalledWith(
      expect.objectContaining({
        variables: expect.objectContaining({
          sentiment: 'upvote',
          value: undefined,
        }),
      })
    )
    expect(screen.getByTestId('selected-upvote').textContent).toBe('true')
  })

  it('maps legacy ?value=upvote onto the sentiment filter', () => {
    useRouter.mockReturnValue({ query: { value: 'upvote' } })

    render(<RatingList />)

    expect(mockUseGraphQLConnectionListRoute).toHaveBeenCalledWith(
      expect.objectContaining({
        variables: expect.objectContaining({
          sentiment: 'upvote',
          value: undefined,
        }),
      })
    )
  })

  it('uses GraphQL rating list route without contact id', () => {
    useRouter.mockReturnValue({ query: {} })

    render(<RatingList />)

    expect(screen.getByTestId('list-route').textContent).toContain(
      '/api/v1/graphql'
    )
    expect(screen.getByTestId('filter-options-count').textContent).toBe('2')
    expect(screen.getByTestId('selected-upvote').textContent).toBe('false')
    expect(screen.getByTestId('selected-downvote').textContent).toBe('false')
  })

  it('uses GraphQL rating route with contact id and selects upvote filter', () => {
    useRouter.mockReturnValue({ query: { value: 'upvote' } })

    render(<RatingList contactId="contact_123" />)

    expect(screen.getByTestId('list-route').textContent).toContain(
      '/api/v1/graphql'
    )
    expect(screen.getByTestId('selected-upvote').textContent).toBe('true')
    expect(screen.getByTestId('selected-downvote').textContent).toBe('false')
  })

  it('uses contact rating route in route mode', () => {
    useRouter.mockReturnValue({ query: {} })

    render(<RatingList listMode="route" contactId="contact_123" />)

    expect(screen.getByTestId('list-route').textContent).toContain(
      '/api/v1/contact/contact_123/rating/list'
    )
  })

  it('selects downvote filter and keeps filter enabled by default', () => {
    useRouter.mockReturnValue({ query: { value: 'downvote' } })

    render(<RatingList />)

    expect(screen.getByTestId('filter-enabled').textContent).toBe('true')
    expect(screen.getByTestId('selected-upvote').textContent).toBe('false')
    expect(screen.getByTestId('selected-downvote').textContent).toBe('true')
  })

  it('renders downvote extra tag for negative rating value', () => {
    useRouter.mockReturnValue({ query: {} })

    render(<RatingList />)

    expect(screen.getByTestId('extra-tag').textContent).toContain('downvote')
  })

  it('renders fallback text when description and reason are empty', () => {
    useRouter.mockReturnValue({ query: {} })

    render(<RatingList />)

    expect(screen.getByTestId('description-fallback').textContent).toContain(
      'A rating without description'
    )
  })
})
