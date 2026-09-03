import Confirm, {
  useConfirm,
  useConfirmInput,
  useConfirmYesNo,
} from './Confirm'

import '@testing-library/jest-dom'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'

const openPopup = jest.fn()
const closePopup = jest.fn()

jest.mock('@/hooks/usePopup', () => {
  return jest.fn(() => ({
    popup: <div data-testid="mock-popup">popup</div>,
    openPopup,
    closePopup,
  }))
})

function ConfirmHarness() {
  const confirm = useConfirm()

  return (
    <button
      type="button"
      onClick={async () => {
        const result = await confirm('Are you sure?', {
          title: 'Confirm title',
          actions: {
            Proceed: { result: 'done', default: true },
          },
        })

        document.body.setAttribute('data-confirm-result', String(result))
      }}
    >
      Open confirm
    </button>
  )
}

function ConfirmYesNoHarness() {
  const confirmYesNo = useConfirmYesNo()

  return (
    <button
      type="button"
      onClick={async () => {
        const result = await confirmYesNo('Continue?')

        document.body.setAttribute('data-yesno-result', String(result))
      }}
    >
      Open yesno
    </button>
  )
}

function ConfirmInputHarness() {
  const confirmInput = useConfirmInput()

  return (
    <button
      type="button"
      onClick={async () => {
        const result = await confirmInput('Provide details', {
          submitButtonCaption: 'Submit',
        })

        document.body.setAttribute('data-input-result', JSON.stringify(result))
      }}
    >
      Open input
    </button>
  )
}

describe('Confirm', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    document.body.removeAttribute('data-confirm-result')
    document.body.removeAttribute('data-yesno-result')
    document.body.removeAttribute('data-input-result')
  })

  it('registers hook popup content in provider output', () => {
    render(
      <Confirm>
        <ConfirmHarness />
      </Confirm>
    )

    expect(screen.getByTestId('mock-popup')).toBeInTheDocument()
  })

  it('resolves with configured action result and closes popup', async () => {
    render(
      <Confirm>
        <ConfirmHarness />
      </Confirm>
    )

    fireEvent.click(screen.getByRole('button', { name: 'Open confirm' }))

    const [, options] = openPopup.mock.calls[0]

    await options.actions.Proceed.fn({})

    await waitFor(() => {
      expect(document.body.getAttribute('data-confirm-result')).toBe('done')
    })
    expect(closePopup).toHaveBeenCalled()
  })

  it('resolves with false when popup closes without action', async () => {
    render(
      <Confirm>
        <ConfirmHarness />
      </Confirm>
    )

    fireEvent.click(screen.getByRole('button', { name: 'Open confirm' }))

    const [, options] = openPopup.mock.calls[0]

    options.onClose()

    await waitFor(() => {
      expect(document.body.getAttribute('data-confirm-result')).toBe('false')
    })
  })

  it('configures yes-no variant captions and default action', async () => {
    render(
      <Confirm>
        <ConfirmYesNoHarness />
      </Confirm>
    )

    fireEvent.click(screen.getByRole('button', { name: 'Open yesno' }))

    const [, options] = openPopup.mock.calls[0]

    expect(options.cancelButtonCaption).toBe('No')
    expect(options.actions.Yes).toMatchObject({
      default: false,
      danger: false,
    })

    await options.actions.Yes.fn({})

    await waitFor(() => {
      expect(document.body.getAttribute('data-yesno-result')).toBe('true')
    })
  })

  it('resolves input variant with submitted form data', async () => {
    render(
      <Confirm>
        <ConfirmInputHarness />
      </Confirm>
    )

    fireEvent.click(screen.getByRole('button', { name: 'Open input' }))

    const [, options] = openPopup.mock.calls[0]

    await options.actions.Submit.fn({ answer: '42' })

    await waitFor(() => {
      expect(document.body.getAttribute('data-input-result')).toBe(
        JSON.stringify({ answer: '42' })
      )
    })
  })
})
