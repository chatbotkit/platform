/* eslint-disable @typescript-eslint/no-require-imports */
import ConfirmButton, {
  ConfirmDangerButton,
  ConfirmInfoButton,
} from './ConfirmButton'

import '@testing-library/jest-dom'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'

jest.mock('@/components/Confirm', () => ({
  useConfirmYesNo: jest.fn(),
  useConfirmDanger: jest.fn(),
  useConfirmInfo: jest.fn(),
}))

const {
  useConfirmYesNo,
  useConfirmDanger,
  useConfirmInfo,
} = require('@/components/Confirm')

describe('ConfirmButton', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('basic functionality', () => {
    it('should render button with props', () => {
      useConfirmYesNo.mockReturnValue(jest.fn().mockResolvedValue(false))

      render(
        <ConfirmButton message="Are you sure?" className="test-class">
          Click Me
        </ConfirmButton>
      )

      const button = screen.getByRole('button', { name: 'Click Me' })

      expect(button).toBeInTheDocument()
      expect(button).toHaveClass('test-class')
    })

    it('should have type="button" by default', () => {
      useConfirmYesNo.mockReturnValue(jest.fn().mockResolvedValue(false))

      render(<ConfirmButton message="Are you sure?">Click Me</ConfirmButton>)

      const button = screen.getByRole('button')

      expect(button).toHaveAttribute('type', 'button')
    })
  })

  describe('confirmation flow', () => {
    it('should show confirmation dialog on click', async () => {
      const mockConfirm = jest.fn().mockResolvedValue(true)

      useConfirmYesNo.mockReturnValue(mockConfirm)

      const onConfirm = jest.fn()

      render(
        <ConfirmButton
          message="Are you sure?"
          title="Confirm Action"
          onConfirm={onConfirm}
        >
          Delete
        </ConfirmButton>
      )

      const button = screen.getByRole('button')

      fireEvent.click(button)

      await waitFor(() => {
        expect(mockConfirm).toHaveBeenCalledWith('Are you sure?', {
          title: 'Confirm Action',
        })
      })
    })

    it('should call onConfirm when user confirms', async () => {
      const mockConfirm = jest.fn().mockResolvedValue(true)

      useConfirmYesNo.mockReturnValue(mockConfirm)

      const onConfirm = jest.fn()

      render(
        <ConfirmButton message="Are you sure?" onConfirm={onConfirm}>
          Delete
        </ConfirmButton>
      )

      const button = screen.getByRole('button')

      fireEvent.click(button)

      await waitFor(() => {
        expect(onConfirm).toHaveBeenCalledTimes(1)
      })
    })

    it('should not call onConfirm when user cancels', async () => {
      const mockConfirm = jest.fn().mockResolvedValue(false)

      useConfirmYesNo.mockReturnValue(mockConfirm)

      const onConfirm = jest.fn()

      render(
        <ConfirmButton message="Are you sure?" onConfirm={onConfirm}>
          Delete
        </ConfirmButton>
      )

      const button = screen.getByRole('button')

      fireEvent.click(button)

      await waitFor(() => {
        expect(mockConfirm).toHaveBeenCalled()
      })

      expect(onConfirm).not.toHaveBeenCalled()
    })

    it('should call onClick after confirmation', async () => {
      const mockConfirm = jest.fn().mockResolvedValue(true)

      useConfirmYesNo.mockReturnValue(mockConfirm)

      const onClick = jest.fn()

      render(
        <ConfirmButton message="Are you sure?" onClick={onClick}>
          Delete
        </ConfirmButton>
      )

      const button = screen.getByRole('button')

      fireEvent.click(button)

      await waitFor(() => {
        expect(onClick).toHaveBeenCalledTimes(1)
      })
    })
  })

  describe('disabled state', () => {
    it('should not show confirmation when disabled', async () => {
      const mockConfirm = jest.fn()

      useConfirmYesNo.mockReturnValue(mockConfirm)

      const onConfirm = jest.fn()

      render(
        <ConfirmButton message="Are you sure?" onConfirm={onConfirm} disabled>
          Delete
        </ConfirmButton>
      )

      const button = screen.getByRole('button')

      fireEvent.click(button)

      await waitFor(() => {
        expect(mockConfirm).not.toHaveBeenCalled()
      })
      expect(onConfirm).not.toHaveBeenCalled()
    })

    it('should not call onClick when disabled', async () => {
      const mockConfirm = jest.fn()

      useConfirmYesNo.mockReturnValue(mockConfirm)

      const onClick = jest.fn()

      render(
        <ConfirmButton message="Are you sure?" onClick={onClick} disabled>
          Delete
        </ConfirmButton>
      )

      const button = screen.getByRole('button')

      fireEvent.click(button)

      await waitFor(() => {
        expect(onClick).not.toHaveBeenCalled()
      })
    })
  })

  describe('edge cases', () => {
    it('should work without onConfirm callback', async () => {
      const mockConfirm = jest.fn().mockResolvedValue(true)

      useConfirmYesNo.mockReturnValue(mockConfirm)

      render(<ConfirmButton message="Are you sure?">Delete</ConfirmButton>)

      const button = screen.getByRole('button')

      fireEvent.click(button)

      await waitFor(() => {
        expect(mockConfirm).toHaveBeenCalled()
      })
    })

    it('should work without onClick callback', async () => {
      const mockConfirm = jest.fn().mockResolvedValue(true)

      useConfirmYesNo.mockReturnValue(mockConfirm)

      const onConfirm = jest.fn()

      render(
        <ConfirmButton message="Are you sure?" onConfirm={onConfirm}>
          Delete
        </ConfirmButton>
      )

      const button = screen.getByRole('button')

      fireEvent.click(button)

      await waitFor(() => {
        expect(onConfirm).toHaveBeenCalled()
      })
    })

    it('should work without title', async () => {
      const mockConfirm = jest.fn().mockResolvedValue(true)

      useConfirmYesNo.mockReturnValue(mockConfirm)

      render(<ConfirmButton message="Are you sure?">Delete</ConfirmButton>)

      const button = screen.getByRole('button')

      fireEvent.click(button)

      await waitFor(() => {
        expect(mockConfirm).toHaveBeenCalledWith('Are you sure?', {
          title: undefined,
        })
      })
    })
  })
})

describe('ConfirmDangerButton', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('basic functionality', () => {
    it('should render button with danger confirmation', () => {
      useConfirmDanger.mockReturnValue(jest.fn().mockResolvedValue(false))

      render(
        <ConfirmDangerButton message="Delete permanently?">
          Delete
        </ConfirmDangerButton>
      )

      const button = screen.getByRole('button', { name: 'Delete' })

      expect(button).toBeInTheDocument()
    })

    it('should use danger confirmation hook', async () => {
      const mockConfirm = jest.fn().mockResolvedValue(true)

      useConfirmDanger.mockReturnValue(mockConfirm)

      const onConfirm = jest.fn()

      render(
        <ConfirmDangerButton
          message="Delete permanently?"
          onConfirm={onConfirm}
        >
          Delete
        </ConfirmDangerButton>
      )

      const button = screen.getByRole('button')

      fireEvent.click(button)

      await waitFor(() => {
        expect(mockConfirm).toHaveBeenCalledWith('Delete permanently?', {
          title: undefined,
        })
      })
    })

    it('should call onConfirm when confirmed', async () => {
      const mockConfirm = jest.fn().mockResolvedValue(true)

      useConfirmDanger.mockReturnValue(mockConfirm)

      const onConfirm = jest.fn()

      render(
        <ConfirmDangerButton
          message="Delete permanently?"
          onConfirm={onConfirm}
        >
          Delete
        </ConfirmDangerButton>
      )

      const button = screen.getByRole('button')

      fireEvent.click(button)

      await waitFor(() => {
        expect(onConfirm).toHaveBeenCalledTimes(1)
      })
    })
  })

  describe('disabled state', () => {
    it('should not show confirmation when disabled', async () => {
      const mockConfirm = jest.fn()

      useConfirmDanger.mockReturnValue(mockConfirm)

      render(
        <ConfirmDangerButton message="Delete permanently?" disabled>
          Delete
        </ConfirmDangerButton>
      )

      const button = screen.getByRole('button')

      fireEvent.click(button)

      await waitFor(() => {
        expect(mockConfirm).not.toHaveBeenCalled()
      })
    })
  })
})

describe('ConfirmInfoButton', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('basic functionality', () => {
    it('should render button with info confirmation', () => {
      useConfirmInfo.mockReturnValue(jest.fn().mockResolvedValue(false))

      render(
        <ConfirmInfoButton message="Proceed with action?">
          Proceed
        </ConfirmInfoButton>
      )

      const button = screen.getByRole('button', { name: 'Proceed' })

      expect(button).toBeInTheDocument()
    })

    it('should use info confirmation hook', async () => {
      const mockConfirm = jest.fn().mockResolvedValue(true)

      useConfirmInfo.mockReturnValue(mockConfirm)

      const onConfirm = jest.fn()

      render(
        <ConfirmInfoButton message="Proceed with action?" onConfirm={onConfirm}>
          Proceed
        </ConfirmInfoButton>
      )

      const button = screen.getByRole('button')

      fireEvent.click(button)

      await waitFor(() => {
        expect(mockConfirm).toHaveBeenCalledWith('Proceed with action?', {
          title: undefined,
        })
      })
    })

    it('should call onConfirm when confirmed', async () => {
      const mockConfirm = jest.fn().mockResolvedValue(true)

      useConfirmInfo.mockReturnValue(mockConfirm)

      const onConfirm = jest.fn()

      render(
        <ConfirmInfoButton message="Proceed with action?" onConfirm={onConfirm}>
          Proceed
        </ConfirmInfoButton>
      )

      const button = screen.getByRole('button')

      fireEvent.click(button)

      await waitFor(() => {
        expect(onConfirm).toHaveBeenCalledTimes(1)
      })
    })
  })

  describe('disabled state', () => {
    it('should not show confirmation when disabled', async () => {
      const mockConfirm = jest.fn()

      useConfirmInfo.mockReturnValue(mockConfirm)

      render(
        <ConfirmInfoButton message="Proceed with action?" disabled>
          Proceed
        </ConfirmInfoButton>
      )

      const button = screen.getByRole('button')

      fireEvent.click(button)

      await waitFor(() => {
        expect(mockConfirm).not.toHaveBeenCalled()
      })
    })
  })
})
