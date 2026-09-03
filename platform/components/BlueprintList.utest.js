import BlueprintList from './BlueprintList'

import '@testing-library/jest-dom'
import { render } from '@testing-library/react'

let capturedProps = {}

jest.mock('@/components/ResourceList', () => {
  return function ResourceList(props) {
    capturedProps = props

    return <div data-testid="resource-list" />
  }
})

describe('BlueprintList', () => {
  beforeEach(() => {
    capturedProps = {}
  })

  describe('default props', () => {
    it('should render ResourceList with default props', () => {
      const { getByTestId } = render(<BlueprintList />)
      const resourceList = getByTestId('resource-list')

      expect(resourceList).toBeInTheDocument()
      expect(capturedProps.kind).toBe('blueprint')
      expect(typeof capturedProps.listRoute).toBe('function')
      expect(capturedProps.listRoute.toJSON()).toBe('/api/v1/graphql')
      expect(capturedProps.deleteRoute).toBe('/api/v1/blueprint/[id]/delete')
      expect(capturedProps.instanceRoute).toBe('/blueprints/[id]')
      expect(capturedProps.filter).toBe(false)
    })

    it('should not have exportRoute by default', () => {
      render(<BlueprintList />)
      expect(capturedProps.exportRoute).toBeNull()
    })

    it('should have default extraLinks', () => {
      render(<BlueprintList />)
      expect(capturedProps.extraLinks).toEqual({
        Design: '/blueprints/[id]/designer',
      })
    })
  })

  describe('custom props', () => {
    it('should override kind prop', () => {
      render(<BlueprintList kind="custom-blueprint" />)
      expect(capturedProps.kind).toBe('custom-blueprint')
    })

    it('should override listRoute prop', () => {
      render(<BlueprintList listRoute="/custom/list" />)
      expect(capturedProps.listRoute).toBe('/custom/list')
    })

    it('should set exportRoute when provided', () => {
      render(<BlueprintList exportRoute="/api/v1/blueprint/export" />)
      expect(capturedProps.exportRoute).toBe('/api/v1/blueprint/export')
    })

    it('should override deleteRoute prop', () => {
      render(<BlueprintList deleteRoute="/custom/[id]/delete" />)
      expect(capturedProps.deleteRoute).toBe('/custom/[id]/delete')
    })

    it('should override instanceRoute prop', () => {
      render(<BlueprintList instanceRoute="/custom/[id]" />)
      expect(capturedProps.instanceRoute).toBe('/custom/[id]')
    })

    it('should override filter prop', () => {
      render(<BlueprintList filter={true} />)
      expect(capturedProps.filter).toBe(true)
    })

    it('should override extraLinks prop', () => {
      const customLinks = {
        Edit: '/blueprints/[id]/edit',
        View: '/blueprints/[id]/view',
      }

      render(<BlueprintList extraLinks={customLinks} />)
      expect(capturedProps.extraLinks).toEqual(customLinks)
    })
  })

  describe('props spreading', () => {
    it('should pass through additional props to ResourceList', () => {
      render(
        <BlueprintList
          data-custom="value"
          aria-label="Blueprint list"
          className="custom-class"
        />
      )
      expect(capturedProps['data-custom']).toBe('value')
      expect(capturedProps['aria-label']).toBe('Blueprint list')
      expect(capturedProps.className).toBe('custom-class')
    })

    it('should handle multiple custom props', () => {
      const handleSelect = jest.fn()

      render(
        <BlueprintList
          title="My Blueprints"
          emptyMessage="No blueprints"
          onSelect={handleSelect}
        />
      )
      expect(capturedProps.title).toBe('My Blueprints')
      expect(capturedProps.emptyMessage).toBe('No blueprints')
      expect(capturedProps.onSelect).toBe(handleSelect)
    })
  })

  describe('combined overrides', () => {
    it('should handle multiple prop overrides at once', () => {
      render(
        <BlueprintList
          kind="template"
          listRoute="/templates/list"
          deleteRoute="/templates/[id]/delete"
          instanceRoute="/templates/[id]"
          filter={true}
          extraLinks={{ Configure: '/templates/[id]/config' }}
        />
      )

      expect(capturedProps.kind).toBe('template')
      expect(capturedProps.listRoute).toBe('/templates/list')
      expect(capturedProps.deleteRoute).toBe('/templates/[id]/delete')
      expect(capturedProps.instanceRoute).toBe('/templates/[id]')
      expect(capturedProps.filter).toBe(true)
      expect(capturedProps.extraLinks).toEqual({
        Configure: '/templates/[id]/config',
      })
    })
  })
})
