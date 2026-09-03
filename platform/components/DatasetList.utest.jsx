import DatasetList from './DatasetList'

import '@testing-library/jest-dom'
import { render, screen } from '@testing-library/react'

jest.mock('@/components/ResourceList', () => {
  return function ResourceList(props) {
    return (
      <div data-testid="resource-list" data-props={JSON.stringify(props)}>
        ResourceList Mock
      </div>
    )
  }
})

describe('DatasetList', () => {
  describe('basic functionality', () => {
    it('should render ResourceList component', () => {
      render(<DatasetList />)

      expect(screen.getByTestId('resource-list')).toBeInTheDocument()
    })

    it('should pass default kind prop', () => {
      render(<DatasetList />)

      const resourceList = screen.getByTestId('resource-list')
      const props = JSON.parse(resourceList.getAttribute('data-props'))

      expect(props.kind).toBe('dataset')
    })

    it('should use GraphQL list route by default', () => {
      render(<DatasetList />)

      const resourceList = screen.getByTestId('resource-list')
      const props = JSON.parse(resourceList.getAttribute('data-props'))

      expect(props.listRoute).toBe('/api/v1/graphql')
    })

    it('should pass default deleteRoute prop', () => {
      render(<DatasetList />)

      const resourceList = screen.getByTestId('resource-list')
      const props = JSON.parse(resourceList.getAttribute('data-props'))

      expect(props.deleteRoute).toBe('/api/v1/dataset/[id]/delete')
    })

    it('should pass default instanceRoute prop', () => {
      render(<DatasetList />)

      const resourceList = screen.getByTestId('resource-list')
      const props = JSON.parse(resourceList.getAttribute('data-props'))

      expect(props.instanceRoute).toBe('/datasets/[id]')
    })

    it('should pass default exportRoute as null', () => {
      render(<DatasetList />)

      const resourceList = screen.getByTestId('resource-list')
      const props = JSON.parse(resourceList.getAttribute('data-props'))

      expect(props.exportRoute).toBeNull()
    })

    it('should pass default filter as false', () => {
      render(<DatasetList />)

      const resourceList = screen.getByTestId('resource-list')
      const props = JSON.parse(resourceList.getAttribute('data-props'))

      expect(props.filter).toBe(false)
    })
  })

  describe('prop overrides', () => {
    it('should allow overriding kind prop', () => {
      render(<DatasetList kind="custom-dataset" />)

      const resourceList = screen.getByTestId('resource-list')
      const props = JSON.parse(resourceList.getAttribute('data-props'))

      expect(props.kind).toBe('custom-dataset')
    })

    it('should allow overriding listRoute prop', () => {
      render(<DatasetList listRoute="/custom/list" />)

      const resourceList = screen.getByTestId('resource-list')
      const props = JSON.parse(resourceList.getAttribute('data-props'))

      expect(props.listRoute).toBe('/custom/list')
    })

    it('should allow overriding exportRoute prop', () => {
      render(<DatasetList exportRoute="/custom/export" />)

      const resourceList = screen.getByTestId('resource-list')
      const props = JSON.parse(resourceList.getAttribute('data-props'))

      expect(props.exportRoute).toBe('/custom/export')
    })

    it('should allow overriding deleteRoute prop', () => {
      render(<DatasetList deleteRoute="/custom/delete" />)

      const resourceList = screen.getByTestId('resource-list')
      const props = JSON.parse(resourceList.getAttribute('data-props'))

      expect(props.deleteRoute).toBe('/custom/delete')
    })

    it('should allow overriding instanceRoute prop', () => {
      render(<DatasetList instanceRoute="/custom/[id]" />)

      const resourceList = screen.getByTestId('resource-list')
      const props = JSON.parse(resourceList.getAttribute('data-props'))

      expect(props.instanceRoute).toBe('/custom/[id]')
    })

    it('should allow overriding filter prop', () => {
      render(<DatasetList filter={true} />)

      const resourceList = screen.getByTestId('resource-list')
      const props = JSON.parse(resourceList.getAttribute('data-props'))

      expect(props.filter).toBe(true)
    })
  })

  describe('props forwarding', () => {
    it('should forward additional props to ResourceList', () => {
      render(<DatasetList className="custom-class" data-test="value" />)

      const resourceList = screen.getByTestId('resource-list')
      const props = JSON.parse(resourceList.getAttribute('data-props'))

      expect(props.className).toBe('custom-class')
      expect(props['data-test']).toBe('value')
    })

    it('should forward multiple custom props', () => {
      render(
        <DatasetList
          customProp1="value1"
          customProp2="value2"
          customProp3={123}
        />
      )

      const resourceList = screen.getByTestId('resource-list')
      const props = JSON.parse(resourceList.getAttribute('data-props'))

      expect(props.customProp1).toBe('value1')
      expect(props.customProp2).toBe('value2')
      expect(props.customProp3).toBe(123)
    })

    it('should forward boolean props correctly', () => {
      render(<DatasetList disabled={true} loading={false} />)

      const resourceList = screen.getByTestId('resource-list')
      const props = JSON.parse(resourceList.getAttribute('data-props'))

      expect(props.disabled).toBe(true)
      expect(props.loading).toBe(false)
    })
  })

  describe('edge cases', () => {
    it('should render without crashing when no props provided', () => {
      expect(() => render(<DatasetList />)).not.toThrow()
    })

    it('should handle null values for optional props', () => {
      render(<DatasetList exportRoute={null} />)

      const resourceList = screen.getByTestId('resource-list')
      const props = JSON.parse(resourceList.getAttribute('data-props'))

      expect(props.exportRoute).toBeNull()
    })

    it('should handle undefined values for optional props', () => {
      render(<DatasetList exportRoute={undefined} />)

      const resourceList = screen.getByTestId('resource-list')
      const props = JSON.parse(resourceList.getAttribute('data-props'))

      // undefined becomes null when serialized to JSON
      expect(props.exportRoute).toBeNull()
    })

    it('should render consistently on multiple renders', () => {
      const { rerender } = render(<DatasetList />)

      expect(screen.getByTestId('resource-list')).toBeInTheDocument()

      rerender(<DatasetList />)

      expect(screen.getByTestId('resource-list')).toBeInTheDocument()
    })

    it('should handle empty string values', () => {
      render(<DatasetList kind="" listRoute="" />)

      const resourceList = screen.getByTestId('resource-list')
      const props = JSON.parse(resourceList.getAttribute('data-props'))

      expect(props.kind).toBe('')
      expect(props.listRoute).toBe('')
    })
  })

  describe('default route structure', () => {
    it('should use consistent API v1 route pattern', () => {
      render(<DatasetList />)

      const resourceList = screen.getByTestId('resource-list')
      const props = JSON.parse(resourceList.getAttribute('data-props'))

      expect(props.listRoute).toMatch(/^\/api\/v1\//)
      expect(props.deleteRoute).toMatch(/^\/api\/v1\//)
    })

    it('should use [id] placeholder in instance and delete routes', () => {
      render(<DatasetList />)

      const resourceList = screen.getByTestId('resource-list')
      const props = JSON.parse(resourceList.getAttribute('data-props'))

      expect(props.deleteRoute).toContain('[id]')
      expect(props.instanceRoute).toContain('[id]')
    })
  })
})
