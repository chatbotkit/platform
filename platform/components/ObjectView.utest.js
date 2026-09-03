import ObjectView from './ObjectView'

import '@testing-library/jest-dom'
import { fireEvent, render, screen } from '@testing-library/react'

jest.mock('@/lib/yaml', () => ({
  stringify: jest.fn((obj) => `yaml: ${JSON.stringify(obj)}`),
}))

jest.mock('@/components/CodeBlock', () => {
  return function MockCodeBlock({ language, children, actions }) {
    return (
      <div data-testid="code-block" data-language={language}>
        <div data-testid="code-block-actions">{actions}</div>
        <pre>{children}</pre>
      </div>
    )
  }
})

jest.mock('react-icons/md', () => ({
  MdCode: (props) => <span data-testid="md-code" {...props} />,
  MdCodeOff: (props) => <span data-testid="md-code-off" {...props} />,
}))

jest.mock('@/components/Component', () => {
  return function MockComponent({ as: Component, ...props }) {
    return <Component {...props} />
  }
})

describe('ObjectView', () => {
  const sampleObject = { name: 'test', value: 123 }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('basic functionality', () => {
    it('should render object as YAML by default', () => {
      render(<ObjectView object={sampleObject} />)

      const codeBlock = screen.getByTestId('code-block')

      expect(codeBlock).toHaveAttribute('data-language', 'yaml')
      expect(codeBlock).toHaveTextContent('yaml:')
    })

    it('should display YAML content correctly', () => {
      render(<ObjectView object={sampleObject} />)

      const pre = screen.getByTestId('code-block').querySelector('pre')

      expect(pre).toHaveTextContent(`yaml: ${JSON.stringify(sampleObject)}`)
    })

    it('should render empty object when no object prop provided', () => {
      render(<ObjectView />)

      const codeBlock = screen.getByTestId('code-block')

      expect(codeBlock).toHaveAttribute('data-language', 'yaml')
    })

    it('should handle complex nested objects', () => {
      const complexObject = {
        user: { name: 'John', age: 30 },
        items: [1, 2, 3],
        meta: { created: '2024-01-01' },
      }

      render(<ObjectView object={complexObject} />)

      const pre = screen.getByTestId('code-block').querySelector('pre')

      expect(pre).toHaveTextContent('yaml:')
    })
  })

  describe('toggle functionality', () => {
    it('should show MdCodeOff icon when in YAML mode', () => {
      render(<ObjectView object={sampleObject} />)
      expect(screen.getByTestId('md-code-off')).toBeInTheDocument()
      expect(screen.queryByTestId('md-code')).not.toBeInTheDocument()
    })

    it('should toggle to JSON mode when icon is clicked', () => {
      render(<ObjectView object={sampleObject} />)

      const toggleButton = screen.getByTestId('md-code-off')

      fireEvent.click(toggleButton)

      const codeBlock = screen.getByTestId('code-block')

      expect(codeBlock).toHaveAttribute('data-language', 'json')
      expect(screen.getByTestId('md-code')).toBeInTheDocument()
      expect(screen.queryByTestId('md-code-off')).not.toBeInTheDocument()
    })

    it('should display JSON content after toggling', () => {
      render(<ObjectView object={sampleObject} />)

      const toggleButton = screen.getByTestId('md-code-off')

      fireEvent.click(toggleButton)

      const pre = screen.getByTestId('code-block').querySelector('pre')

      expect(pre.textContent).toContain('"name"')
      expect(pre.textContent).toContain('"test"')
      expect(pre.textContent).toContain('"value"')
      expect(pre.textContent).toContain('123')
    })

    it('should toggle back to YAML mode', () => {
      render(<ObjectView object={sampleObject} />)

      const toggleButton = screen.getByTestId('md-code-off')

      // Toggle to JSON
      fireEvent.click(toggleButton)
      expect(screen.getByTestId('md-code')).toBeInTheDocument()

      // Toggle back to YAML
      fireEvent.click(screen.getByTestId('md-code'))
      expect(screen.getByTestId('md-code-off')).toBeInTheDocument()
      expect(screen.getByTestId('code-block')).toHaveAttribute(
        'data-language',
        'yaml'
      )
    })

    it('should maintain toggle state across multiple clicks', () => {
      render(<ObjectView object={sampleObject} />)

      // Multiple toggles
      fireEvent.click(screen.getByTestId('md-code-off'))
      expect(screen.getByTestId('code-block')).toHaveAttribute(
        'data-language',
        'json'
      )

      fireEvent.click(screen.getByTestId('md-code'))
      expect(screen.getByTestId('code-block')).toHaveAttribute(
        'data-language',
        'yaml'
      )

      fireEvent.click(screen.getByTestId('md-code-off'))
      expect(screen.getByTestId('code-block')).toHaveAttribute(
        'data-language',
        'json'
      )
    })
  })

  describe('props forwarding', () => {
    it('should render children in actions area', () => {
      render(
        <ObjectView object={sampleObject}>
          <button type="button">Custom Action</button>
        </ObjectView>
      )

      const actions = screen.getByTestId('code-block-actions')

      expect(actions).toHaveTextContent('Custom Action')
    })

    it('should include toggle icon alongside children in actions', () => {
      render(
        <ObjectView object={sampleObject}>
          <button type="button">Custom Action</button>
        </ObjectView>
      )

      const actions = screen.getByTestId('code-block-actions')

      expect(actions).toContainElement(screen.getByTestId('md-code-off'))
      expect(actions).toHaveTextContent('Custom Action')
    })
  })

  describe('edge cases', () => {
    it('should handle null object', () => {
      render(<ObjectView object={null} />)
      expect(screen.getByTestId('code-block')).toBeInTheDocument()
    })

    it('should handle undefined object', () => {
      render(<ObjectView object={undefined} />)
      expect(screen.getByTestId('code-block')).toBeInTheDocument()
    })

    it('should handle empty array', () => {
      render(<ObjectView object={[]} />)

      const pre = screen.getByTestId('code-block').querySelector('pre')

      expect(pre).toBeInTheDocument()
    })

    it('should handle empty object', () => {
      render(<ObjectView object={{}} />)

      const pre = screen.getByTestId('code-block').querySelector('pre')

      expect(pre).toBeInTheDocument()
    })

    it('should handle object with special characters', () => {
      const specialObject = { key: 'value with "quotes" and \'apostrophes\'' }

      render(<ObjectView object={specialObject} />)
      expect(screen.getByTestId('code-block')).toBeInTheDocument()
    })

    it('should update content when object prop changes', () => {
      const { rerender } = render(<ObjectView object={sampleObject} />)
      const pre = screen.getByTestId('code-block').querySelector('pre')

      expect(pre).toHaveTextContent(JSON.stringify(sampleObject))

      const newObject = { different: 'data' }

      rerender(<ObjectView object={newObject} />)
      expect(pre).toHaveTextContent(JSON.stringify(newObject))
    })

    it('should update content when object changes while in JSON mode', () => {
      const { rerender } = render(<ObjectView object={sampleObject} />)

      // Toggle to JSON
      fireEvent.click(screen.getByTestId('md-code-off'))

      const pre = screen.getByTestId('code-block').querySelector('pre')

      expect(pre.textContent).toContain('"test"')

      // Update object
      const newObject = { updated: 'content' }

      rerender(<ObjectView object={newObject} />)
      expect(pre.textContent).toContain('"updated"')
      expect(pre.textContent).toContain('"content"')
    })
  })
})
