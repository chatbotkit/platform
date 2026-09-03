import BotList from './BotList'

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

describe('BotList', () => {
  describe('basic functionality', () => {
    it('should render ResourceList component', () => {
      render(<BotList />)

      expect(screen.getByTestId('resource-list')).toBeInTheDocument()
    })

    it('should pass default kind prop', () => {
      render(<BotList />)

      const resourceList = screen.getByTestId('resource-list')
      const props = JSON.parse(resourceList.getAttribute('data-props'))

      expect(props.kind).toBe('bot')
    })

    it('should use GraphQL list route by default', () => {
      render(<BotList />)

      const resourceList = screen.getByTestId('resource-list')
      const props = JSON.parse(resourceList.getAttribute('data-props'))

      expect(props.listRoute).toBe('/api/v1/graphql')
    })

    it('should pass default deleteRoute prop', () => {
      render(<BotList />)

      const resourceList = screen.getByTestId('resource-list')
      const props = JSON.parse(resourceList.getAttribute('data-props'))

      expect(props.deleteRoute).toBe('/api/v1/bot/[id]/delete')
    })

    it('should pass default instanceRoute prop', () => {
      render(<BotList />)

      const resourceList = screen.getByTestId('resource-list')
      const props = JSON.parse(resourceList.getAttribute('data-props'))

      expect(props.instanceRoute).toBe('/bots/[id]')
    })

    it('should pass default exportRoute as null', () => {
      render(<BotList />)

      const resourceList = screen.getByTestId('resource-list')
      const props = JSON.parse(resourceList.getAttribute('data-props'))

      expect(props.exportRoute).toBeNull()
    })

    it('should pass default filter as false', () => {
      render(<BotList />)

      const resourceList = screen.getByTestId('resource-list')
      const props = JSON.parse(resourceList.getAttribute('data-props'))

      expect(props.filter).toBe(false)
    })
  })

  describe('prop overrides', () => {
    it('should allow overriding kind prop', () => {
      render(<BotList kind="custom-bot" />)

      const resourceList = screen.getByTestId('resource-list')
      const props = JSON.parse(resourceList.getAttribute('data-props'))

      expect(props.kind).toBe('custom-bot')
    })

    it('should allow overriding listRoute prop', () => {
      render(<BotList listRoute="/custom/list" />)

      const resourceList = screen.getByTestId('resource-list')
      const props = JSON.parse(resourceList.getAttribute('data-props'))

      expect(props.listRoute).toBe('/custom/list')
    })

    it('should allow overriding exportRoute prop', () => {
      render(<BotList exportRoute="/custom/export" />)

      const resourceList = screen.getByTestId('resource-list')
      const props = JSON.parse(resourceList.getAttribute('data-props'))

      expect(props.exportRoute).toBe('/custom/export')
    })

    it('should allow overriding deleteRoute prop', () => {
      render(<BotList deleteRoute="/custom/delete" />)

      const resourceList = screen.getByTestId('resource-list')
      const props = JSON.parse(resourceList.getAttribute('data-props'))

      expect(props.deleteRoute).toBe('/custom/delete')
    })

    it('should allow overriding instanceRoute prop', () => {
      render(<BotList instanceRoute="/custom/[id]" />)

      const resourceList = screen.getByTestId('resource-list')
      const props = JSON.parse(resourceList.getAttribute('data-props'))

      expect(props.instanceRoute).toBe('/custom/[id]')
    })

    it('should allow overriding filter prop', () => {
      render(<BotList filter={true} />)

      const resourceList = screen.getByTestId('resource-list')
      const props = JSON.parse(resourceList.getAttribute('data-props'))

      expect(props.filter).toBe(true)
    })
  })

  describe('props forwarding', () => {
    it('should forward additional props to ResourceList', () => {
      render(<BotList className="custom-class" data-test="value" />)

      const resourceList = screen.getByTestId('resource-list')
      const props = JSON.parse(resourceList.getAttribute('data-props'))

      expect(props.className).toBe('custom-class')
      expect(props['data-test']).toBe('value')
    })

    it('should forward multiple custom props', () => {
      render(
        <BotList customProp1="value1" customProp2="value2" customProp3={456} />
      )

      const resourceList = screen.getByTestId('resource-list')
      const props = JSON.parse(resourceList.getAttribute('data-props'))

      expect(props.customProp1).toBe('value1')
      expect(props.customProp2).toBe('value2')
      expect(props.customProp3).toBe(456)
    })

    it('should forward boolean props correctly', () => {
      render(<BotList disabled={true} loading={false} />)

      const resourceList = screen.getByTestId('resource-list')
      const props = JSON.parse(resourceList.getAttribute('data-props'))

      expect(props.disabled).toBe(true)
      expect(props.loading).toBe(false)
    })
  })

  describe('edge cases', () => {
    it('should render without crashing when no props provided', () => {
      expect(() => render(<BotList />)).not.toThrow()
    })

    it('should handle null values for optional props', () => {
      render(<BotList exportRoute={null} />)

      const resourceList = screen.getByTestId('resource-list')
      const props = JSON.parse(resourceList.getAttribute('data-props'))

      expect(props.exportRoute).toBeNull()
    })

    it('should handle undefined values for optional props', () => {
      render(<BotList exportRoute={undefined} />)

      const resourceList = screen.getByTestId('resource-list')
      const props = JSON.parse(resourceList.getAttribute('data-props'))

      // undefined becomes null when serialized to JSON
      expect(props.exportRoute).toBeNull()
    })

    it('should render consistently on multiple renders', () => {
      const { rerender } = render(<BotList />)

      expect(screen.getByTestId('resource-list')).toBeInTheDocument()

      rerender(<BotList />)

      expect(screen.getByTestId('resource-list')).toBeInTheDocument()
    })

    it('should handle empty string values', () => {
      render(<BotList kind="" listRoute="" />)

      const resourceList = screen.getByTestId('resource-list')
      const props = JSON.parse(resourceList.getAttribute('data-props'))

      expect(props.kind).toBe('')
      expect(props.listRoute).toBe('')
    })
  })

  describe('default route structure', () => {
    it('should use consistent API v1 route pattern', () => {
      render(<BotList />)

      const resourceList = screen.getByTestId('resource-list')
      const props = JSON.parse(resourceList.getAttribute('data-props'))

      expect(props.listRoute).toMatch(/^\/api\/v1\//)
      expect(props.deleteRoute).toMatch(/^\/api\/v1\//)
    })

    it('should use [id] placeholder in instance and delete routes', () => {
      render(<BotList />)

      const resourceList = screen.getByTestId('resource-list')
      const props = JSON.parse(resourceList.getAttribute('data-props'))

      expect(props.deleteRoute).toContain('[id]')
      expect(props.instanceRoute).toContain('[id]')
    })
  })
})
