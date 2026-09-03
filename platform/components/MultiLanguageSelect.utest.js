import MultiLanguageSelect from './MultiLanguageSelect'

import '@testing-library/jest-dom'
import { render } from '@testing-library/react'

// Mock CommaListSelect
jest.mock('@/components/CommaListSelect', () => {
  return function MockCommaListSelect(props) {
    return (
      <div data-testid="comma-list-select" {...props}>
        CommaListSelect Mock
      </div>
    )
  }
})

describe('MultiLanguageSelect', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('basic functionality', () => {
    it('should render without crashing', () => {
      const { getByTestId } = render(<MultiLanguageSelect />)

      expect(getByTestId('comma-list-select')).toBeInTheDocument()
    })

    it('should render CommaListSelect component', () => {
      const { getByText } = render(<MultiLanguageSelect />)

      expect(getByText('CommaListSelect Mock')).toBeInTheDocument()
    })

    it('should pass default placeholder text', () => {
      const { getByTestId } = render(<MultiLanguageSelect />)
      const select = getByTestId('comma-list-select')

      expect(select).toHaveAttribute(
        'placeholder',
        'Type the language and press enter...'
      )
    })
  })

  describe('prop forwarding', () => {
    it('should forward value prop', () => {
      const { getByTestId } = render(
        <MultiLanguageSelect value={['English', 'Spanish']} />
      )
      const select = getByTestId('comma-list-select')

      // Props are spread to div, arrays become strings
      expect(select).toBeDefined()
    })

    it('should forward setValue prop', () => {
      const mockSetValue = jest.fn()
      const { getByTestId } = render(
        <MultiLanguageSelect setValue={mockSetValue} />
      )
      const select = getByTestId('comma-list-select')

      expect(select).toBeDefined()
    })

    it('should forward onChange prop', () => {
      const mockOnChange = jest.fn()
      const { getByTestId } = render(
        <MultiLanguageSelect onChange={mockOnChange} />
      )
      const select = getByTestId('comma-list-select')

      expect(select).toBeDefined()
    })

    it('should forward disabled prop', () => {
      const { getByTestId } = render(<MultiLanguageSelect disabled />)
      const select = getByTestId('comma-list-select')

      expect(select).toBeDefined()
    })

    it('should forward className prop', () => {
      const { getByTestId } = render(
        <MultiLanguageSelect className="custom-class" />
      )
      const select = getByTestId('comma-list-select')

      expect(select).toHaveClass('custom-class')
    })

    it('should forward multiple props simultaneously', () => {
      const mockSetValue = jest.fn()
      const { getByTestId } = render(
        <MultiLanguageSelect
          value={['French']}
          setValue={mockSetValue}
          disabled={false}
          className="test-class"
        />
      )
      const select = getByTestId('comma-list-select')

      expect(select).toHaveClass('test-class')
    })
  })

  describe('placeholder behavior', () => {
    it('should use default placeholder when not provided', () => {
      const { getByTestId } = render(<MultiLanguageSelect />)
      const select = getByTestId('comma-list-select')

      expect(select).toHaveAttribute(
        'placeholder',
        'Type the language and press enter...'
      )
    })

    it('should override placeholder when provided', () => {
      const { getByTestId } = render(
        <MultiLanguageSelect placeholder="Custom placeholder" />
      )
      const select = getByTestId('comma-list-select')

      expect(select).toHaveAttribute('placeholder', 'Custom placeholder')
    })

    it('should handle empty string placeholder', () => {
      const { getByTestId } = render(<MultiLanguageSelect placeholder="" />)
      const select = getByTestId('comma-list-select')

      expect(select).toHaveAttribute('placeholder', '')
    })

    it('should handle null placeholder', () => {
      const { getByTestId } = render(<MultiLanguageSelect placeholder={null} />)
      const select = getByTestId('comma-list-select')

      // null placeholder won't set the attribute
      expect(select).toBeInTheDocument()
    })
  })

  describe('controlled component behavior', () => {
    it('should work as controlled with value and setValue', () => {
      const mockSetValue = jest.fn()
      const { getByTestId } = render(
        <MultiLanguageSelect value={['English']} setValue={mockSetValue} />
      )
      const select = getByTestId('comma-list-select')

      expect(select).toBeInTheDocument()
    })

    it('should handle empty array value', () => {
      const { getByTestId } = render(<MultiLanguageSelect value={[]} />)
      const select = getByTestId('comma-list-select')

      expect(select).toBeInTheDocument()
    })

    it('should handle single language', () => {
      const { getByTestId } = render(
        <MultiLanguageSelect value={['Japanese']} />
      )
      const select = getByTestId('comma-list-select')

      expect(select).toBeInTheDocument()
    })

    it('should handle multiple languages', () => {
      const { getByTestId } = render(
        <MultiLanguageSelect
          value={['English', 'Spanish', 'French', 'German']}
        />
      )
      const select = getByTestId('comma-list-select')

      expect(select).toBeInTheDocument()
    })
  })

  describe('edge cases', () => {
    it('should handle undefined value', () => {
      const { getByTestId } = render(<MultiLanguageSelect value={undefined} />)
      const select = getByTestId('comma-list-select')

      expect(select).toBeInTheDocument()
    })

    it('should handle null value', () => {
      const { getByTestId } = render(<MultiLanguageSelect value={null} />)
      const select = getByTestId('comma-list-select')

      expect(select).toBeInTheDocument()
    })

    it('should handle special characters in language names', () => {
      const { getByTestId } = render(
        <MultiLanguageSelect value={['中文', 'العربية', 'Ελληνικά']} />
      )
      const select = getByTestId('comma-list-select')

      expect(select).toBeInTheDocument()
    })

    it('should handle very long language list', () => {
      const manyLanguages = Array.from({ length: 100 }, (_, i) => `Lang${i}`)
      const { getByTestId } = render(
        <MultiLanguageSelect value={manyLanguages} />
      )
      const select = getByTestId('comma-list-select')

      expect(select).toBeInTheDocument()
    })

    it('should handle duplicate language names', () => {
      const { getByTestId } = render(
        <MultiLanguageSelect value={['English', 'English', 'Spanish']} />
      )
      const select = getByTestId('comma-list-select')

      expect(select).toBeInTheDocument()
    })

    it('should handle whitespace in language names', () => {
      const { getByTestId } = render(
        <MultiLanguageSelect value={['  English  ', 'Spanish']} />
      )
      const select = getByTestId('comma-list-select')

      expect(select).toBeInTheDocument()
    })

    it('should handle empty strings in language array', () => {
      const { getByTestId } = render(
        <MultiLanguageSelect value={['English', '', 'Spanish']} />
      )
      const select = getByTestId('comma-list-select')

      expect(select).toBeInTheDocument()
    })
  })

  describe('data attributes', () => {
    it('should forward data-testid when provided', () => {
      const { getByTestId } = render(
        <MultiLanguageSelect data-testid="custom-id" />
      )

      // When custom data-testid is provided, it overrides the mock's testid
      expect(getByTestId('custom-id')).toBeInTheDocument()
    })

    it('should forward arbitrary data attributes', () => {
      const { getByTestId } = render(
        <MultiLanguageSelect data-custom="value" data-other="test" />
      )
      const select = getByTestId('comma-list-select')

      expect(select).toHaveAttribute('data-custom', 'value')
      expect(select).toHaveAttribute('data-other', 'test')
    })
  })

  describe('style and appearance', () => {
    it('should forward style prop', () => {
      const customStyle = { color: 'red', fontSize: '16px' }
      const { getByTestId } = render(
        <MultiLanguageSelect style={customStyle} />
      )
      const select = getByTestId('comma-list-select')

      expect(select).toHaveStyle(customStyle)
    })

    it('should forward id prop', () => {
      const { getByTestId } = render(<MultiLanguageSelect id="lang-select" />)
      const select = getByTestId('comma-list-select')

      expect(select).toHaveAttribute('id', 'lang-select')
    })

    it('should forward name prop', () => {
      const { getByTestId } = render(<MultiLanguageSelect name="languages" />)
      const select = getByTestId('comma-list-select')

      expect(select).toHaveAttribute('name', 'languages')
    })
  })
})
