/* eslint-disable @typescript-eslint/no-require-imports */
import SaveButton from './SaveButton'

import '@testing-library/jest-dom'
import { fireEvent, render } from '@testing-library/react'

jest.mock('@/lib/save', () => ({
  saveData: jest.fn(),
}))

jest.mock('@/lib/toast', () => ({
  __esModule: true,
  default: {
    success: jest.fn(),
    error: jest.fn(),
  },
}))

describe('SaveButton', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should render button with props', () => {
    const { getByRole } = render(
      <SaveButton data="test data" name="file.txt">
        Save File
      </SaveButton>
    )

    expect(getByRole('button')).toHaveTextContent('Save File')
  })

  it('should save data when clicked', () => {
    const { saveData } = require('@/lib/save')
    const { getByRole } = render(
      <SaveButton data="test data" name="file.txt">
        Save
      </SaveButton>
    )

    fireEvent.click(getByRole('button'))

    expect(saveData).toHaveBeenCalledWith('test data', {
      name: 'file.txt',
      type: undefined,
    })
  })

  it('should save data with type', () => {
    const { saveData } = require('@/lib/save')
    const { getByRole } = render(
      <SaveButton data="test data" name="file.txt" type="text/plain">
        Save
      </SaveButton>
    )

    fireEvent.click(getByRole('button'))

    expect(saveData).toHaveBeenCalledWith('test data', {
      name: 'file.txt',
      type: 'text/plain',
    })
  })

  it('should show success toast with default message', () => {
    const toast = require('@/lib/toast').default
    const { getByRole } = render(
      <SaveButton data="test data" name="file.txt">
        Save
      </SaveButton>
    )

    fireEvent.click(getByRole('button'))

    expect(toast.success).toHaveBeenCalledWith('File saved')
  })

  it('should show success toast with custom message', () => {
    const toast = require('@/lib/toast').default
    const { getByRole } = render(
      <SaveButton data="test data" name="file.txt" message="Download complete">
        Save
      </SaveButton>
    )

    fireEvent.click(getByRole('button'))

    expect(toast.success).toHaveBeenCalledWith('Download complete')
  })

  it('should not show toast when message is null', () => {
    const toast = require('@/lib/toast').default
    const { getByRole } = render(
      <SaveButton data="test data" name="file.txt" message={null}>
        Save
      </SaveButton>
    )

    fireEvent.click(getByRole('button'))

    expect(toast.success).not.toHaveBeenCalled()
  })

  it('should show error toast when save fails', () => {
    const { saveData } = require('@/lib/save')
    const toast = require('@/lib/toast').default

    saveData.mockImplementation(() => {
      throw new Error('Save failed')
    })

    const { getByRole } = render(
      <SaveButton data="test data" name="file.txt">
        Save
      </SaveButton>
    )

    fireEvent.click(getByRole('button'))

    expect(toast.error).toHaveBeenCalledWith('Failed to save file')
  })

  it('should call onClick handler if provided', () => {
    const onClick = jest.fn()
    const { getByRole } = render(
      <SaveButton data="test data" name="file.txt" onClick={onClick}>
        Save
      </SaveButton>
    )

    fireEvent.click(getByRole('button'))

    expect(onClick).toHaveBeenCalled()
  })

  it('should call onClick handler even when save fails', () => {
    const { saveData } = require('@/lib/save')
    const onClick = jest.fn()

    saveData.mockImplementation(() => {
      throw new Error('Save failed')
    })

    const { getByRole } = render(
      <SaveButton data="test data" name="file.txt" onClick={onClick}>
        Save
      </SaveButton>
    )

    fireEvent.click(getByRole('button'))

    expect(onClick).toHaveBeenCalled()
  })

  it('should pass through button props', () => {
    const { getByRole } = render(
      <SaveButton
        data="test data"
        name="file.txt"
        className="custom-class"
        disabled
        aria-label="Save file"
      >
        Save
      </SaveButton>
    )

    const button = getByRole('button')

    expect(button).toHaveClass('custom-class')
    expect(button).toBeDisabled()
    expect(button).toHaveAttribute('aria-label', 'Save file')
  })

  it('should have type="button"', () => {
    const { getByRole } = render(
      <SaveButton data="test data" name="file.txt">
        Save
      </SaveButton>
    )

    expect(getByRole('button')).toHaveAttribute('type', 'button')
  })

  it('should handle empty data', () => {
    const { saveData } = require('@/lib/save')
    const { getByRole } = render(
      <SaveButton data="" name="empty.txt">
        Save
      </SaveButton>
    )

    fireEvent.click(getByRole('button'))

    expect(saveData).toHaveBeenCalledWith('', {
      name: 'empty.txt',
      type: undefined,
    })
  })

  it('should handle object data', () => {
    const { saveData } = require('@/lib/save')
    const data = { key: 'value' }
    const { getByRole } = render(
      <SaveButton data={data} name="data.json">
        Save
      </SaveButton>
    )

    fireEvent.click(getByRole('button'))

    expect(saveData).toHaveBeenCalledWith(data, {
      name: 'data.json',
      type: undefined,
    })
  })
})
