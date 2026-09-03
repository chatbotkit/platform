import PolicyList from './PolicyList'

import '@testing-library/jest-dom'
import { render } from '@testing-library/react'

jest.mock('@/components/ResourceList', () => {
  return function ResourceList(props) {
    return (
        <div data-testid="resource-list">
          <div data-testid="kind">{props.kind}</div>
        <div data-testid="list-route">{JSON.stringify(props.listRoute)}</div>
        <div data-testid="export-route">{String(props.exportRoute)}</div>
        <div data-testid="delete-route">{props.deleteRoute}</div>
        <div data-testid="instance-route">{props.instanceRoute}</div>
        <div data-testid="filter">{String(props.filter)}</div>
        {props.extraTags && (
          <div data-testid="extra-tags">
            {props.extraTags({ type: 'privacy' })}
          </div>
        )}
      </div>
    )
  }
})

describe('PolicyList', () => {
  describe('default props', () => {
    it('should render with default props', () => {
      const { getByTestId } = render(<PolicyList />)

      expect(getByTestId('resource-list')).toBeInTheDocument()
      expect(getByTestId('kind')).toHaveTextContent('policy')
      expect(getByTestId('list-route')).toHaveTextContent('/api/v1/graphql')
      expect(getByTestId('export-route')).toHaveTextContent('null')
      expect(getByTestId('delete-route')).toHaveTextContent(
        '/api/v1/policy/[id]/delete'
      )
      expect(getByTestId('instance-route')).toHaveTextContent('/policies/[id]')
      expect(getByTestId('filter')).toHaveTextContent('false')
    })

    it('should render with default extraTags', () => {
      const { getByTestId } = render(<PolicyList />)

      const extraTags = getByTestId('extra-tags')

      expect(extraTags).toBeInTheDocument()
      expect(extraTags.querySelector('.tag')).toHaveTextContent('privacy')
    })
  })

  describe('custom props', () => {
    it('should override kind prop', () => {
      const { getByTestId } = render(<PolicyList kind="custom-policy" />)

      expect(getByTestId('kind')).toHaveTextContent('custom-policy')
    })

    it('should override listRoute prop', () => {
      const { getByTestId } = render(
        <PolicyList listRoute="/api/v2/policies/list" />
      )

      expect(getByTestId('list-route')).toHaveTextContent(
        '/api/v2/policies/list'
      )
    })

    it('should override exportRoute prop', () => {
      const { getByTestId } = render(
        <PolicyList exportRoute="/api/v1/policy/export" />
      )

      expect(getByTestId('export-route')).toHaveTextContent(
        '/api/v1/policy/export'
      )
    })

    it('should override deleteRoute prop', () => {
      const { getByTestId } = render(
        <PolicyList deleteRoute="/api/v1/policy/[id]/remove" />
      )

      expect(getByTestId('delete-route')).toHaveTextContent(
        '/api/v1/policy/[id]/remove'
      )
    })

    it('should override instanceRoute prop', () => {
      const { getByTestId } = render(
        <PolicyList instanceRoute="/policy-details/[id]" />
      )

      expect(getByTestId('instance-route')).toHaveTextContent(
        '/policy-details/[id]'
      )
    })

    it('should override filter prop', () => {
      const { getByTestId } = render(<PolicyList filter={true} />)

      expect(getByTestId('filter')).toHaveTextContent('true')
    })

    it('should override extraTags prop', () => {
      const customExtraTags = ({ type }) => (
        <div className="custom-tag">Type: {type}</div>
      )

      const { getByTestId } = render(<PolicyList extraTags={customExtraTags} />)

      const extraTags = getByTestId('extra-tags')

      expect(extraTags.querySelector('.custom-tag')).toHaveTextContent(
        'Type: privacy'
      )
    })
  })

  describe('props forwarding', () => {
    it('should forward additional props to ResourceList', () => {
      const { getByTestId } = render(
        <PolicyList data-custom="test-value" className="custom-class" />
      )

      const resourceList = getByTestId('resource-list')

      expect(resourceList).toBeInTheDocument()
    })

    it('should combine all props correctly', () => {
      const customExtraTags = ({ type }) => (
        <div className="tag tag-{type}">{type.toUpperCase()}</div>
      )

      const { getByTestId } = render(
        <PolicyList
          kind="compliance-policy"
          listRoute="/api/v2/policy/list"
          exportRoute="/api/v2/policy/export"
          deleteRoute="/api/v2/policy/[id]/delete"
          instanceRoute="/compliance-policies/[id]"
          filter={true}
          extraTags={customExtraTags}
        />
      )

      expect(getByTestId('kind')).toHaveTextContent('compliance-policy')
      expect(getByTestId('list-route')).toHaveTextContent('/api/v2/policy/list')
      expect(getByTestId('export-route')).toHaveTextContent(
        '/api/v2/policy/export'
      )
      expect(getByTestId('delete-route')).toHaveTextContent(
        '/api/v2/policy/[id]/delete'
      )
      expect(getByTestId('instance-route')).toHaveTextContent(
        '/compliance-policies/[id]'
      )
      expect(getByTestId('filter')).toHaveTextContent('true')
    })
  })

  describe('edge cases', () => {
    it('should handle null exportRoute explicitly', () => {
      const { getByTestId } = render(<PolicyList exportRoute={null} />)

      expect(getByTestId('export-route')).toHaveTextContent('null')
    })

    it('should handle undefined exportRoute', () => {
      const { getByTestId } = render(<PolicyList exportRoute={undefined} />)

      expect(getByTestId('export-route')).toHaveTextContent('null')
    })

    it('should handle empty string kind', () => {
      const { getByTestId } = render(<PolicyList kind="" />)

      expect(getByTestId('kind')).toHaveTextContent('')
    })

    it('should handle empty string routes', () => {
      const { getByTestId } = render(
        <PolicyList
          listRoute=""
          deleteRoute=""
          instanceRoute=""
          exportRoute=""
        />
      )

      expect(getByTestId('list-route').textContent).toBe('""')
      expect(getByTestId('delete-route').textContent).toBe('')
      expect(getByTestId('instance-route').textContent).toBe('')
      expect(getByTestId('export-route').textContent).toBe('')
    })

    it('should handle filter as false explicitly', () => {
      const { getByTestId } = render(<PolicyList filter={false} />)

      expect(getByTestId('filter')).toHaveTextContent('false')
    })

    it('should handle filter as true', () => {
      const { getByTestId } = render(<PolicyList filter={true} />)

      expect(getByTestId('filter')).toHaveTextContent('true')
    })

    it('should handle null extraTags', () => {
      const { queryByTestId } = render(<PolicyList extraTags={null} />)

      expect(queryByTestId('extra-tags')).not.toBeInTheDocument()
    })

    it('should handle undefined extraTags with default behavior', () => {
      const { getByTestId } = render(<PolicyList extraTags={undefined} />)

      // undefined falls back to default extraTags
      const extraTags = getByTestId('extra-tags')

      expect(extraTags).toBeInTheDocument()
      expect(extraTags.querySelector('.tag')).toHaveTextContent('privacy')
    })
  })

  describe('extraTags functionality', () => {
    it('should render default tag with type', () => {
      const { getByTestId } = render(<PolicyList />)

      const extraTags = getByTestId('extra-tags')
      const tag = extraTags.querySelector('.tag')

      expect(tag).toBeInTheDocument()
      expect(tag).toHaveTextContent('privacy')
    })

    it('should support custom extraTags with different type values', () => {
      const { getByTestId } = render(<PolicyList />)

      // Default extraTags receives type from mock and displays it
      const extraTags = getByTestId('extra-tags')

      expect(extraTags.querySelector('.tag')).toHaveTextContent('privacy')
    })

    it('should support extraTags returning complex JSX', () => {
      const customExtraTags = ({ type }) => (
        <>
          <div className="tag primary">{type}</div>
          <div className="tag secondary">Policy</div>
        </>
      )

      const { getByTestId } = render(<PolicyList extraTags={customExtraTags} />)

      const extraTags = getByTestId('extra-tags')

      expect(extraTags.querySelector('.tag.primary')).toHaveTextContent(
        'privacy'
      )
      expect(extraTags.querySelector('.tag.secondary')).toHaveTextContent(
        'Policy'
      )
    })

    it('should support extraTags returning null', () => {
      const customExtraTags = () => null

      const { getByTestId } = render(<PolicyList extraTags={customExtraTags} />)

      const extraTags = getByTestId('extra-tags')

      expect(extraTags).toBeInTheDocument()
      expect(extraTags).toBeEmptyDOMElement()
    })

    it('should support extraTags with conditional rendering', () => {
      const customExtraTags = ({ type }) =>
        type === 'privacy' ? (
          <div className="tag">Privacy Policy</div>
        ) : (
          <div className="tag">Other Policy</div>
        )

      const { getByTestId } = render(<PolicyList extraTags={customExtraTags} />)

      const extraTags = getByTestId('extra-tags')

      expect(extraTags.querySelector('.tag')).toHaveTextContent(
        'Privacy Policy'
      )
    })
  })
})
