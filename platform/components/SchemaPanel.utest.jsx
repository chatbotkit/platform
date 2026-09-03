import SchemaPanel, {
  Drag,
  Panel,
  Schema,
  SchemaPanelModeContext,
  SchemaPanelPositionProvider,
  useSchemaPanelPositionProps,
} from './SchemaPanel'

import '@testing-library/jest-dom'
import { render, screen } from '@testing-library/react'

// Mock Draggable component
jest.mock('react-draggable', () => {
  return function Draggable({
    children,
    defaultPosition: _defaultPosition,
    nodeRef: _nodeRef,
    onDrag: _onDrag,
    ...props
  }) {
    return (
      <div data-testid="draggable" {...props}>
        {children}
      </div>
    )
  }
})

// Mock ContextSchema component
jest.mock('@/components/ContextInput', () => ({
  ContextSchema: {
    Memo: function MockContextSchema({
      children,
      schema,
      className,
      inputClassName,
      labelTooltipButton: _labelTooltipButton,
      defaultValue: _defaultValue,
      value: _value,
      setValue: _setValue,
      ...props
    }) {
      return (
        <div
          data-testid="context-schema"
          data-schema={JSON.stringify(schema)}
          className={`${className || ''} ${inputClassName || ''}`.trim()}
          {...props}
        >
          {children}
        </div>
      )
    },
  },
}))

// Mock Nbsp component
jest.mock('@/components/Nbsp', () => {
  return function Nbsp() {
    return <span>&nbsp;</span>
  }
})

describe('SchemaPanelPositionProvider', () => {
  it('should render children', () => {
    render(
      <SchemaPanelPositionProvider>
        <div data-testid="child">Test</div>
      </SchemaPanelPositionProvider>
    )
    expect(screen.getByTestId('child')).toBeInTheDocument()
  })

  it('should provide position context', () => {
    const TestComponent = () => {
      const position = useSchemaPanelPositionProps()

      return (
        <div data-testid="test">
          {position ? 'has-position' : 'no-position'}
        </div>
      )
    }

    render(
      <SchemaPanelPositionProvider>
        <TestComponent />
      </SchemaPanelPositionProvider>
    )

    expect(screen.getByTestId('test')).toHaveTextContent('has-position')
  })
})

describe('useSchemaPanelPositionProps', () => {
  it('should return position props', () => {
    let positionProps

    const TestComponent = () => {
      positionProps = useSchemaPanelPositionProps()

      return null
    }

    render(
      <SchemaPanelPositionProvider>
        <TestComponent />
      </SchemaPanelPositionProvider>
    )

    expect(positionProps).toHaveProperty('defaultPosition')
    expect(positionProps).toHaveProperty('onDrag')
    expect(typeof positionProps.onDrag).toBe('function')
  })

  it('should update position on drag', () => {
    let positionProps

    const TestComponent = () => {
      positionProps = useSchemaPanelPositionProps()

      return null
    }

    render(
      <SchemaPanelPositionProvider>
        <TestComponent />
      </SchemaPanelPositionProvider>
    )

    positionProps.onDrag(null, { x: 100, y: 200 })

    expect(positionProps.defaultPosition.x).toBe(100)
    expect(positionProps.defaultPosition.y).toBe(200)
  })

  it('should provide a fallback position without an explicit provider', () => {
    let positionProps

    const TestComponent = () => {
      positionProps = useSchemaPanelPositionProps()

      return null
    }

    render(<TestComponent />)

    expect(positionProps.defaultPosition).toEqual({ x: 0, y: 0 })

    positionProps.onDrag(null, { x: 20, y: 30 })

    expect(positionProps.defaultPosition).toEqual({ x: 20, y: 30 })
  })
})

describe('Drag', () => {
  it('should render with default bounds', () => {
    render(
      <Drag>
        <div>Draggable content</div>
      </Drag>
    )

    const draggable = screen.getByTestId('draggable')

    expect(draggable).toBeInTheDocument()
    expect(draggable).toHaveAttribute('bounds', 'html')
  })

  it('should render with custom bounds', () => {
    render(
      <Drag bounds="parent">
        <div>Draggable content</div>
      </Drag>
    )

    const draggable = screen.getByTestId('draggable')

    expect(draggable).toHaveAttribute('bounds', 'parent')
  })

  it('should set drag handle', () => {
    render(
      <Drag>
        <div>Draggable content</div>
      </Drag>
    )

    const draggable = screen.getByTestId('draggable')

    expect(draggable).toHaveAttribute('handle', '.drag-handle')
  })
})

describe('Drag.Saving', () => {
  it('should use position props from context', () => {
    render(
      <SchemaPanelPositionProvider>
        <Drag.Saving>
          <div>Saving draggable</div>
        </Drag.Saving>
      </SchemaPanelPositionProvider>
    )

    const draggable = screen.getByTestId('draggable')

    expect(draggable).toBeInTheDocument()
  })
})

describe('Panel', () => {
  it('should render with title', () => {
    render(<Panel title="Test Panel">Panel content</Panel>)
    expect(screen.getByText('Test Panel')).toBeInTheDocument()
    expect(screen.getByText('Panel content')).toBeInTheDocument()
  })

  it('should render without title', () => {
    render(<Panel>Panel content</Panel>)
    expect(screen.getByText('Panel content')).toBeInTheDocument()
  })

  it('should apply custom className', () => {
    const { container } = render(
      <Panel className="custom-class">Content</Panel>
    )
    const panel = container.querySelector('.custom-class')

    expect(panel).toBeInTheDocument()
  })

  it('should have drag handle', () => {
    const { container } = render(<Panel title="Test">Content</Panel>)
    const dragHandle = container.querySelector('.drag-handle')

    expect(dragHandle).toBeInTheDocument()
    expect(dragHandle).toHaveTextContent('Test')
  })

  it('should keep header height aligned with toolbar search bar', () => {
    const { container } = render(<Panel title="Test">Content</Panel>)
    const dragHandle = container.querySelector('.drag-handle')

    expect(dragHandle).toHaveClass('min-h-10')
  })

  it('should render a divider border like the search bar area', () => {
    const { container } = render(<Panel title="Test">Content</Panel>)
    const dragHandle = container.querySelector('.drag-handle')

    expect(dragHandle).toHaveClass('border-b')
    expect(dragHandle).toHaveClass('border-gray-200')
    expect(dragHandle).toHaveClass('dark:border-gray-800')
  })

  it('should hide the dock toggle when dockable is false', () => {
    render(
      <Panel title="Test" dockable={false}>
        Content
      </Panel>
    )

    expect(screen.queryByTitle('Dock panel to side')).not.toBeInTheDocument()
    expect(screen.queryByTitle('Undock panel')).not.toBeInTheDocument()
  })
})

describe('Schema', () => {
  it('should render with schema', () => {
    const mockSchema = { type: 'object', properties: {} }

    render(<Schema schema={mockSchema}>Schema content</Schema>)

    const schemaEl = screen.getByTestId('context-schema')

    expect(schemaEl).toBeInTheDocument()
    expect(schemaEl).toHaveAttribute('data-schema', JSON.stringify(mockSchema))
  })

  it('should apply custom className', () => {
    const mockSchema = { type: 'object' }
    const { container } = render(
      <Schema schema={mockSchema} className="custom-schema">
        Content
      </Schema>
    )
    const schemaEl = container.querySelector('.custom-schema')

    expect(schemaEl).toBeInTheDocument()
  })

  it('should apply custom inputClassName', () => {
    const mockSchema = { type: 'object' }

    render(
      <Schema schema={mockSchema} inputClassName="custom-input">
        Content
      </Schema>
    )

    const schemaEl = screen.getByTestId('context-schema')

    expect(schemaEl).toHaveClass('custom-input')
  })

  it('should stay floating when dockable is false even if panel mode is docked', () => {
    const mockSchema = { type: 'object' }

    render(
      <SchemaPanelModeContext.Provider
        value={{ mode: 'docked', toggleMode: jest.fn() }}
      >
        <SchemaPanel
          title="Floating Only"
          schema={mockSchema}
          dockable={false}
          className="floating-only-panel"
        />
      </SchemaPanelModeContext.Provider>
    )

    expect(screen.getByTestId('draggable')).toBeInTheDocument()
    expect(screen.queryByTitle('Undock panel')).not.toBeInTheDocument()
  })
})

describe('SchemaPanel', () => {
  it('should render with all props', () => {
    const mockSchema = { type: 'object', properties: {} }

    render(
      <SchemaPanel
        title="Test Schema Panel"
        schema={mockSchema}
        defaultValue={{}}
      >
        Panel content
      </SchemaPanel>
    )

    expect(screen.getByText('Test Schema Panel')).toBeInTheDocument()
    expect(screen.getByText('Panel content')).toBeInTheDocument()
    expect(screen.getByTestId('draggable')).toBeInTheDocument()
  })

  it('should work as controlled component', () => {
    const mockSchema = { type: 'object' }
    const setValue = jest.fn()
    const value = { test: 'value' }

    render(
      <SchemaPanel
        title="Controlled Panel"
        schema={mockSchema}
        value={value}
        setValue={setValue}
      />
    )

    const schemaEl = screen.getByTestId('context-schema')

    expect(schemaEl).toBeInTheDocument()
  })

  it('should work as uncontrolled component', () => {
    const mockSchema = { type: 'object' }
    const defaultValue = { test: 'default' }

    render(
      <SchemaPanel
        title="Uncontrolled Panel"
        schema={mockSchema}
        defaultValue={defaultValue}
      />
    )

    const schemaEl = screen.getByTestId('context-schema')

    expect(schemaEl).toBeInTheDocument()
  })

  it('should apply custom className', () => {
    const mockSchema = { type: 'object' }
    const { container } = render(
      <SchemaPanel title="Test" schema={mockSchema} className="custom-panel" />
    )

    const panel = container.querySelector('.custom-panel')

    expect(panel).toBeInTheDocument()
  })

  it('should apply custom inputClassName', () => {
    const mockSchema = { type: 'object' }

    render(
      <SchemaPanel
        title="Test"
        schema={mockSchema}
        inputClassName="custom-input"
      />
    )

    const schemaEl = screen.getByTestId('context-schema')

    expect(schemaEl).toHaveClass('custom-input')
  })
})

describe('SchemaPanel.Saving', () => {
  it('should use position props from context', () => {
    const mockSchema = { type: 'object' }

    render(
      <SchemaPanelPositionProvider>
        <SchemaPanel.Saving title="Saving Panel" schema={mockSchema}>
          Content
        </SchemaPanel.Saving>
      </SchemaPanelPositionProvider>
    )

    expect(screen.getByText('Saving Panel')).toBeInTheDocument()
    expect(screen.getByTestId('draggable')).toBeInTheDocument()
  })

  it('should persist position across renders', () => {
    const mockSchema = { type: 'object' }
    let positionProps

    const TestComponent = () => {
      positionProps = useSchemaPanelPositionProps()

      return <SchemaPanel.Saving title="Test" schema={mockSchema} />
    }

    const { rerender } = render(
      <SchemaPanelPositionProvider>
        <TestComponent />
      </SchemaPanelPositionProvider>
    )

    // Update position
    positionProps.onDrag(null, { x: 50, y: 75 })

    // Re-render
    rerender(
      <SchemaPanelPositionProvider>
        <TestComponent />
      </SchemaPanelPositionProvider>
    )

    // Position should be preserved
    expect(positionProps.defaultPosition.x).toBe(50)
    expect(positionProps.defaultPosition.y).toBe(75)
  })
})

describe('edge cases', () => {
  it('should handle undefined schema', () => {
    render(<SchemaPanel title="Test" schema={undefined} />)
    expect(screen.getByText('Test')).toBeInTheDocument()
  })

  it('should handle empty children', () => {
    const mockSchema = { type: 'object' }

    render(<SchemaPanel title="Empty" schema={mockSchema} />)
    expect(screen.getByText('Empty')).toBeInTheDocument()
  })

  it('should handle multiple Schema instances', () => {
    const mockSchema1 = { type: 'object', properties: { a: {} } }
    const mockSchema2 = { type: 'object', properties: { b: {} } }

    render(
      <div>
        <Schema schema={mockSchema1}>Schema 1</Schema>
        <Schema schema={mockSchema2}>Schema 2</Schema>
      </div>
    )

    const schemas = screen.getAllByTestId('context-schema')

    expect(schemas).toHaveLength(2)
  })
})
