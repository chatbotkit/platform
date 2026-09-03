import React from 'react'

import Theme from './Theme'

import '@testing-library/jest-dom'
import { render, screen } from '@testing-library/react'

jest.mock('next-themes', () => ({
  ThemeProvider: jest.fn(({ children, ...props }) => (
    <div data-testid="theme-provider" data-props={JSON.stringify(props)}>
      {children}
    </div>
  )),
}))

jest.mock('@/components/ThemeColor', () =>
  jest.fn(() => <div data-testid="theme-color" />)
)

describe('Theme', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('basic functionality', () => {
    it('should render ThemeProvider with children', () => {
      render(
        <Theme>
          <div data-testid="child">Child content</div>
        </Theme>
      )

      expect(screen.getByTestId('theme-provider')).toBeInTheDocument()
      expect(screen.getByTestId('child')).toBeInTheDocument()
    })

    it('should render ThemeColor component', () => {
      render(<Theme>Content</Theme>)

      expect(screen.getByTestId('theme-color')).toBeInTheDocument()
    })

    it('should pass default themes when not specified', () => {
      render(<Theme>Content</Theme>)

      const provider = screen.getByTestId('theme-provider')
      const props = JSON.parse(provider.getAttribute('data-props'))

      expect(props.themes).toEqual(['none', 'light', 'dark'])
    })

    it('should use custom themes when provided', () => {
      render(<Theme themes={['light', 'dark']}>Content</Theme>)

      const provider = screen.getByTestId('theme-provider')
      const props = JSON.parse(provider.getAttribute('data-props'))

      expect(props.themes).toEqual(['light', 'dark'])
    })

    it('should set defaultTheme to system', () => {
      render(<Theme>Content</Theme>)

      const provider = screen.getByTestId('theme-provider')
      const props = JSON.parse(provider.getAttribute('data-props'))

      expect(props.defaultTheme).toBe('system')
    })

    it('should apply forcedTheme when provided', () => {
      render(<Theme theme="dark">Content</Theme>)

      const provider = screen.getByTestId('theme-provider')
      const props = JSON.parse(provider.getAttribute('data-props'))

      expect(props.forcedTheme).toBe('dark')
    })
  })

  describe('ThemeProvider configuration', () => {
    it('should set attribute to class', () => {
      render(<Theme>Content</Theme>)

      const provider = screen.getByTestId('theme-provider')
      const props = JSON.parse(provider.getAttribute('data-props'))

      expect(props.attribute).toBe('class')
    })

    it('should disable system theme detection', () => {
      render(<Theme>Content</Theme>)

      const provider = screen.getByTestId('theme-provider')
      const props = JSON.parse(provider.getAttribute('data-props'))

      expect(props.enableSystem).toBe(false)
    })

    it('should enable color scheme', () => {
      render(<Theme>Content</Theme>)

      const provider = screen.getByTestId('theme-provider')
      const props = JSON.parse(provider.getAttribute('data-props'))

      expect(props.enableColorScheme).toBe(true)
    })

    it('should disable transition on change', () => {
      render(<Theme>Content</Theme>)

      const provider = screen.getByTestId('theme-provider')
      const props = JSON.parse(provider.getAttribute('data-props'))

      expect(props.disableTransitionOnChange).toBe(true)
    })
  })

  describe('edge cases', () => {
    it('should handle empty themes array', () => {
      render(<Theme themes={[]}>Content</Theme>)

      const provider = screen.getByTestId('theme-provider')
      const props = JSON.parse(provider.getAttribute('data-props'))

      expect(props.themes).toEqual([])
    })

    it('should handle undefined theme prop', () => {
      render(<Theme theme={undefined}>Content</Theme>)

      const provider = screen.getByTestId('theme-provider')
      const props = JSON.parse(provider.getAttribute('data-props'))

      expect(props.forcedTheme).toBeUndefined()
    })

    it('should handle null theme prop', () => {
      render(<Theme theme={null}>Content</Theme>)

      const provider = screen.getByTestId('theme-provider')
      const props = JSON.parse(provider.getAttribute('data-props'))

      expect(props.forcedTheme).toBeNull()
    })

    it('should handle empty string theme', () => {
      render(<Theme theme="">Content</Theme>)

      const provider = screen.getByTestId('theme-provider')
      const props = JSON.parse(provider.getAttribute('data-props'))

      expect(props.forcedTheme).toBe('')
    })

    it('should handle multiple children', () => {
      render(
        <Theme>
          <div data-testid="child1">Child 1</div>
          <div data-testid="child2">Child 2</div>
          <div data-testid="child3">Child 3</div>
        </Theme>
      )

      expect(screen.getByTestId('child1')).toBeInTheDocument()
      expect(screen.getByTestId('child2')).toBeInTheDocument()
      expect(screen.getByTestId('child3')).toBeInTheDocument()
    })

    it('should handle no children', () => {
      render(<Theme />)

      const provider = screen.getByTestId('theme-provider')

      expect(provider).toBeInTheDocument()
    })
  })

  describe('theme values', () => {
    it('should handle light theme', () => {
      render(<Theme theme="light">Content</Theme>)

      const provider = screen.getByTestId('theme-provider')
      const props = JSON.parse(provider.getAttribute('data-props'))

      expect(props.forcedTheme).toBe('light')
    })

    it('should handle dark theme', () => {
      render(<Theme theme="dark">Content</Theme>)

      const provider = screen.getByTestId('theme-provider')
      const props = JSON.parse(provider.getAttribute('data-props'))

      expect(props.forcedTheme).toBe('dark')
    })

    it('should handle none theme', () => {
      render(<Theme theme="none">Content</Theme>)

      const provider = screen.getByTestId('theme-provider')
      const props = JSON.parse(provider.getAttribute('data-props'))

      expect(props.forcedTheme).toBe('none')
    })

    it('should handle custom theme value', () => {
      render(<Theme theme="custom-theme">Content</Theme>)

      const provider = screen.getByTestId('theme-provider')
      const props = JSON.parse(provider.getAttribute('data-props'))

      expect(props.forcedTheme).toBe('custom-theme')
    })
  })

  describe('themes array variations', () => {
    it('should handle single theme in array', () => {
      render(<Theme themes={['dark']}>Content</Theme>)

      const provider = screen.getByTestId('theme-provider')
      const props = JSON.parse(provider.getAttribute('data-props'))

      expect(props.themes).toEqual(['dark'])
    })

    it('should handle many themes in array', () => {
      const manyThemes = [
        'light',
        'dark',
        'blue',
        'red',
        'green',
        'purple',
        'none',
      ]

      render(<Theme themes={manyThemes}>Content</Theme>)

      const provider = screen.getByTestId('theme-provider')
      const props = JSON.parse(provider.getAttribute('data-props'))

      expect(props.themes).toEqual(manyThemes)
    })
  })

  describe('component structure', () => {
    it('should render ThemeColor before children', () => {
      const { container } = render(
        <Theme>
          <div data-testid="child">Child</div>
        </Theme>
      )

      const provider = container.querySelector('[data-testid="theme-provider"]')
      const themeColor = provider.querySelector('[data-testid="theme-color"]')
      const child = provider.querySelector('[data-testid="child"]')

      expect(themeColor).toBeTruthy()
      expect(child).toBeTruthy()

      // ThemeColor should appear before the child in DOM order
      expect(
        provider.innerHTML.indexOf('theme-color') <
          provider.innerHTML.indexOf('child')
      ).toBe(true)
    })

    it('should nest children properly', () => {
      render(
        <Theme>
          <div data-testid="outer">
            <div data-testid="inner">Nested content</div>
          </div>
        </Theme>
      )

      const outer = screen.getByTestId('outer')
      const inner = screen.getByTestId('inner')

      expect(outer).toContainElement(inner)
    })
  })

  describe('re-rendering', () => {
    it('should handle theme changes', () => {
      const { rerender } = render(<Theme theme="light">Content</Theme>)

      let provider = screen.getByTestId('theme-provider')
      let props = JSON.parse(provider.getAttribute('data-props'))

      expect(props.forcedTheme).toBe('light')

      rerender(<Theme theme="dark">Content</Theme>)

      provider = screen.getByTestId('theme-provider')
      props = JSON.parse(provider.getAttribute('data-props'))

      expect(props.forcedTheme).toBe('dark')
    })

    it('should handle themes array changes', () => {
      const { rerender } = render(
        <Theme themes={['light', 'dark']}>Content</Theme>
      )

      let provider = screen.getByTestId('theme-provider')
      let props = JSON.parse(provider.getAttribute('data-props'))

      expect(props.themes).toEqual(['light', 'dark'])

      rerender(<Theme themes={['light']}>Content</Theme>)

      provider = screen.getByTestId('theme-provider')
      props = JSON.parse(provider.getAttribute('data-props'))

      expect(props.themes).toEqual(['light'])
    })
  })
})
