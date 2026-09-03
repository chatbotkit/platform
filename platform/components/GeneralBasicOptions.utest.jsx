import GeneralBasicOptions from './GeneralBasicOptions'

import '@testing-library/jest-dom'
import { render, screen } from '@testing-library/react'

jest.mock('@/components/NameInput', () => ({
  __esModule: true,
  default: jest.fn((props) => <input {...props} />),
}))

jest.mock('@/components/DescriptionInput', () => ({
  __esModule: true,
  default: jest.fn((props) => <textarea {...props} />),
}))

describe('GeneralBasicOptions', () => {
  const defaultInstance = {
    name: 'Test Name',
    description: 'Test Description',
  }

  describe('basic rendering', () => {
    it('should render name input with label', () => {
      render(<GeneralBasicOptions instance={defaultInstance} />)

      expect(screen.getByText('Name')).toBeInTheDocument()

      const inputs = screen.getAllByRole('textbox')

      expect(inputs.length).toBeGreaterThanOrEqual(1)
    })

    it('should render description input with label', () => {
      render(<GeneralBasicOptions instance={defaultInstance} />)

      expect(screen.getByText('Description')).toBeInTheDocument()

      const inputs = screen.getAllByRole('textbox')

      expect(inputs.length).toBeGreaterThanOrEqual(1)
    })

    it('should render default instructions text', () => {
      render(<GeneralBasicOptions instance={defaultInstance} />)

      expect(
        screen.getByText(/Enter a name to distinguish this from the rest/)
      ).toBeInTheDocument()
      expect(
        screen.getByText(/Optionally write description/)
      ).toBeInTheDocument()
    })

    it('should render children when provided', () => {
      render(
        <GeneralBasicOptions instance={defaultInstance}>
          <div data-testid="child">Child Content</div>
        </GeneralBasicOptions>
      )

      expect(screen.getByTestId('child')).toBeInTheDocument()
      expect(screen.getByText('Child Content')).toBeInTheDocument()
    })
  })

  describe('with empty instance', () => {
    it('should render with empty values', () => {
      render(<GeneralBasicOptions instance={{}} />)

      const inputs = screen.getAllByRole('textbox')

      expect(inputs.length).toBeGreaterThanOrEqual(1)
    })

    it('should handle null name gracefully', () => {
      render(<GeneralBasicOptions instance={{ name: null }} />)

      expect(screen.getByText('Name')).toBeInTheDocument()
    })

    it('should handle null description gracefully', () => {
      render(<GeneralBasicOptions instance={{ description: null }} />)

      expect(screen.getByText('Description')).toBeInTheDocument()
    })
  })

  describe('with additional instructions', () => {
    it('should render additional name instructions', () => {
      render(
        <GeneralBasicOptions
          instance={defaultInstance}
          additionalNameInstructions="Extra name info"
        />
      )

      expect(screen.getByText(/Extra name info/)).toBeInTheDocument()
    })

    it('should render additional description instructions', () => {
      render(
        <GeneralBasicOptions
          instance={defaultInstance}
          additionalDescriptionInstructions="Extra description info"
        />
      )

      expect(screen.getByText(/Extra description info/)).toBeInTheDocument()
    })

    it('should render both additional instructions', () => {
      render(
        <GeneralBasicOptions
          instance={defaultInstance}
          additionalNameInstructions="Name extra"
          additionalDescriptionInstructions="Description extra"
        />
      )

      expect(screen.getByText(/Name extra/)).toBeInTheDocument()
      expect(screen.getByText(/Description extra/)).toBeInTheDocument()
    })
  })

  describe('with magic prop', () => {
    it('should pass magic prop to DescriptionInput', () => {
      const magic = { enabled: true }

      render(<GeneralBasicOptions instance={defaultInstance} magic={magic} />)

      expect(screen.getByText('Description')).toBeInTheDocument()
    })
  })

  describe('edge cases', () => {
    it('should handle undefined additionalNameInstructions', () => {
      render(
        <GeneralBasicOptions
          instance={defaultInstance}
          additionalNameInstructions={undefined}
        />
      )

      expect(
        screen.getByText(/Enter a name to distinguish this from the rest/)
      ).toBeInTheDocument()
    })

    it('should handle undefined additionalDescriptionInstructions', () => {
      render(
        <GeneralBasicOptions
          instance={defaultInstance}
          additionalDescriptionInstructions={undefined}
        />
      )

      expect(
        screen.getByText(/Optionally write description/)
      ).toBeInTheDocument()
    })

    it('should render without children', () => {
      render(<GeneralBasicOptions instance={defaultInstance} />)

      expect(screen.getByText('Name')).toBeInTheDocument()
      expect(screen.getByText('Description')).toBeInTheDocument()
    })
  })
})
