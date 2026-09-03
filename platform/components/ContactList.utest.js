import ContactList from './ContactList'
import ResourceList from './ResourceList'

import '@testing-library/jest-dom'
import { render } from '@testing-library/react'

jest.mock('./ResourceList', () => {
  return jest.fn(() => <div data-testid="resource-list">ResourceList</div>)
})

function expectGraphQLListRoute(listRoute) {
  expect(typeof listRoute).toBe('function')
  expect(listRoute.toJSON()).toBe('/api/v1/graphql')
}

describe('ContactList', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('basic functionality', () => {
    it('should render ResourceList with default props', () => {
      const { getByTestId } = render(<ContactList />)

      expect(getByTestId('resource-list')).toBeInTheDocument()
      expect(ResourceList).toHaveBeenCalledWith(
        expect.objectContaining({
          kind: 'contact',
          listRoute: expect.any(Function),
          exportRoute: '/api/v1/contact/export',
          deleteRoute: '/api/v1/contact/[id]/delete',
          instanceRoute: '/contacts/[id]',
          filter: true,
        }),
        undefined
      )

      expectGraphQLListRoute(ResourceList.mock.calls[0][0].listRoute)
    })

    it('should render with custom kind', () => {
      render(<ContactList kind="lead" />)

      expect(ResourceList).toHaveBeenCalledWith(
        expect.objectContaining({
          kind: 'lead',
        }),
        undefined
      )
    })

    it('should render with custom routes', () => {
      render(
        <ContactList
          listRoute="/custom/list"
          exportRoute="/custom/export"
          deleteRoute="/custom/[id]/delete"
          instanceRoute="/custom/[id]"
        />
      )

      expect(ResourceList).toHaveBeenCalledWith(
        expect.objectContaining({
          listRoute: '/custom/list',
          exportRoute: '/custom/export',
          deleteRoute: '/custom/[id]/delete',
          instanceRoute: '/custom/[id]',
        }),
        undefined
      )
    })

    it('should render with filter disabled', () => {
      render(<ContactList filter={false} />)

      expect(ResourceList).toHaveBeenCalledWith(
        expect.objectContaining({
          filter: false,
        }),
        undefined
      )
    })
  })

  describe('extraTags functionality', () => {
    it('should use default extraTags function when not provided', () => {
      render(<ContactList />)

      const call = ResourceList.mock.calls[0][0]
      const extraTags = call.extraTags

      expect(typeof extraTags).toBe('function')

      // Test default implementation with verified contact
      const { container: verifiedContainer } = render(
        <>{extraTags({ verifiedAt: '2024-01-01' })}</>
      )

      expect(verifiedContainer.querySelector('.tag')).toHaveTextContent(
        'verified'
      )

      // Test default implementation with unverified contact
      const { container: unverifiedContainer } = render(
        <>{extraTags({ verifiedAt: null })}</>
      )

      expect(unverifiedContainer.querySelector('.tag')).toHaveTextContent(
        'unverified'
      )
    })

    it('should use custom extraTags when provided', () => {
      const customExtraTags = jest.fn(() => <div>Custom Tag</div>)

      render(<ContactList extraTags={customExtraTags} />)

      const call = ResourceList.mock.calls[0][0]

      expect(call.extraTags).toBe(customExtraTags)
    })

    it('should memoize default extraTags', () => {
      const { rerender } = render(<ContactList />)

      const firstCall = ResourceList.mock.calls[0][0]
      const firstExtraTags = firstCall.extraTags

      rerender(<ContactList />)

      const secondCall = ResourceList.mock.calls[1][0]
      const secondExtraTags = secondCall.extraTags

      expect(firstExtraTags).toBe(secondExtraTags)
    })

    it('should update extraTags when prop changes', () => {
      const customExtraTags1 = jest.fn(() => <div>Tag 1</div>)
      const customExtraTags2 = jest.fn(() => <div>Tag 2</div>)

      const { rerender } = render(<ContactList extraTags={customExtraTags1} />)

      const firstCall = ResourceList.mock.calls[0][0]

      expect(firstCall.extraTags).toBe(customExtraTags1)

      rerender(<ContactList extraTags={customExtraTags2} />)

      const secondCall = ResourceList.mock.calls[1][0]

      expect(secondCall.extraTags).toBe(customExtraTags2)
    })
  })

  describe('props spreading', () => {
    it('should spread additional props to ResourceList', () => {
      render(
        <ContactList
          className="custom-class"
          data-testid="custom-list"
          customProp="value"
        />
      )

      expect(ResourceList).toHaveBeenCalledWith(
        expect.objectContaining({
          className: 'custom-class',
          'data-testid': 'custom-list',
          customProp: 'value',
        }),
        undefined
      )
    })
  })

  describe('edge cases', () => {
    it('should handle undefined extraTags prop', () => {
      render(<ContactList extraTags={undefined} />)

      const call = ResourceList.mock.calls[0][0]

      expect(typeof call.extraTags).toBe('function')
    })

    it('should handle null extraTags prop', () => {
      render(<ContactList extraTags={null} />)

      const call = ResourceList.mock.calls[0][0]

      expect(typeof call.extraTags).toBe('function')
    })

    it('should render with all props undefined except defaults', () => {
      render(
        <ContactList
          kind={undefined}
          listRoute={undefined}
          exportRoute={undefined}
          deleteRoute={undefined}
          instanceRoute={undefined}
          filter={undefined}
        />
      )

      expect(ResourceList).toHaveBeenCalledWith(
        expect.objectContaining({
          kind: 'contact',
          listRoute: expect.any(Function),
          exportRoute: '/api/v1/contact/export',
          deleteRoute: '/api/v1/contact/[id]/delete',
          instanceRoute: '/contacts/[id]',
          filter: true,
        }),
        undefined
      )

      expectGraphQLListRoute(ResourceList.mock.calls[0][0].listRoute)
    })
  })
})
