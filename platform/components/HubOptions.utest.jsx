import HubOptions from './HubOptions'

import { act, fireEvent, render, screen } from '@testing-library/react'

const confirmMock = jest.fn()
const fetchMock = jest.fn()

jest.mock('@/hooks/useExternalFrontendURL', () => () => (path) =>
  `https://chatbotkit.test${path}`
)

jest.mock('@/lib/string', () => ({
  toTitleCase: (value) => value.charAt(0).toUpperCase() + value.slice(1),
}))

jest.mock('pluralize', () => (value) => `${value}s`)

jest.mock('@/components/CodeAction', () => {
  return function CodeAction({ code }) {
    return <div data-testid="code-action">{String(code || '')}</div>
  }
})

jest.mock('@/components/Confirm', () => ({
  useConfirm: () => confirmMock,
}))

jest.mock('@/components/Expando', () => {
  return function Expando({ title, children }) {
    return (
      <section>
        <h2>{title}</h2>
        {children}
      </section>
    )
  }
})

jest.mock('@/components/IconSelect', () => {
  return function IconSelect({ value, onChange }) {
    return (
      <input
        aria-label="icon-select"
        value={value}
        onChange={(e) => onChange({ target: { value: e.target.value } })}
      />
    )
  }
})

jest.mock('@/components/Toggle', () => {
  return function Toggle({ checked, setChecked }) {
    return (
      <button type="button" onClick={() => setChecked(!checked)}>
        {checked ? 'on' : 'off'}
      </button>
    )
  }
})

jest.mock('@/hooks/useFetch', () => () => ({
  code: '',
  fetch: fetchMock,
}))

describe('HubOptions', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('publishes instance and updates external URL', async () => {
    const instance = { id: 'bp-1' }

    fetchMock.mockResolvedValueOnce({ error: null, data: { id: 'hub-1' } })

    render(<HubOptions type="blueprint" instance={instance} />)

    fireEvent.change(screen.getAllByRole('textbox')[0], {
      target: { value: 'my-slug' },
    })

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Publish' }))
    })

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/hub/blueprint/bp-1/publish',
      {
        data: expect.objectContaining({
          slug: 'my-slug',
          icon: '',
          shareLog: false,
        }),
        successMessage: 'Blueprint published.',
      }
    )
    expect(screen.getByText('The external URL is:')).toBeTruthy()
    expect(
      screen.getByRole('link', {
        name: 'https://chatbotkit.test/hub/blueprints/my-slug',
      })
    ).toBeTruthy()
  })

  it('does not unpublish when confirmation is cancelled', async () => {
    const instance = {
      id: 'bp-1',
      hubBlueprintPage: { id: 'hub-1', slug: 's' },
    }

    confirmMock.mockResolvedValueOnce(false)

    render(<HubOptions type="blueprint" instance={instance} />)

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Unpublish' }))
    })

    expect(fetchMock).not.toHaveBeenCalled()
    expect(instance.hubBlueprintPage).toBeTruthy()
  })

  it('unpublishes and clears state when confirmed', async () => {
    const instance = {
      id: 'bp-1',
      hubBlueprintPage: {
        id: 'hub-1',
        slug: 'slug-a',
        icon: 'icon-a',
        shareLog: true,
      },
    }

    confirmMock.mockResolvedValueOnce(true)
    fetchMock.mockResolvedValueOnce({ error: null })

    render(<HubOptions type="blueprint" instance={instance} />)

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Unpublish' }))
    })

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/hub/blueprint/bp-1/unpublish',
      {
        data: {},
        successMessage: 'Blueprint unpublished...',
      }
    )
    expect(instance.hubBlueprintPage).toBeNull()
    expect(screen.queryByRole('button', { name: 'Unpublish' })).toBeNull()
  })
})
