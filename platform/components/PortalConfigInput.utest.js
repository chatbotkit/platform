import PortalConfigInput from './PortalConfigInput'

import '@testing-library/jest-dom'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { useState } from 'react'

const openPopupMock = jest.fn()
const closePopupMock = jest.fn()

jest.mock('@/components/Widget', () => ({
  useExtendWidgetFunctions: jest.fn(),
}))

jest.mock('@/hooks/usePopup', () => {
  return function MockUsePopup() {
    return {
      popup: null,
      openPopup: openPopupMock,
      closePopup: closePopupMock,
    }
  }
})

jest.mock('@/lib/app.config.schemas', () => ({
  APP_CONFIG_JSON_SCHEMA_BY_SLUG: {
    chat: {
      type: 'object',
      // @note non-empty properties so ContextSchema.Memo renders (triggers the
      // real-world code path where schema-driven inputs are shown for the app)
      properties: {
        save: { type: 'boolean', title: 'Save conversations' },
        models: { type: 'boolean', title: 'Enable model selection' },
        sources: { type: 'boolean', title: 'Enable sources' },
      },
    },
    task: {
      type: 'object',
      properties: {},
    },
    connect: {
      type: 'object',
      properties: {},
    },
    inbox: {
      type: 'object',
      properties: {},
    },
    usage: {
      type: 'object',
      properties: {},
    },
  },
}))

function getHiddenConfigInput() {
  return document.querySelector('input[name="config"]')
}

function getChatAppToggle() {
  // @note chat is the first public app in the fixed order
  return screen.getAllByRole('switch')[0]
}

function getLayoutHeaderToggle() {
  // @note in layout tab, header toggle is rendered first
  return screen.getAllByRole('switch')[0]
}

describe('PortalConfigInput', () => {
  beforeEach(() => {
    openPopupMock.mockClear()
    closePopupMock.mockClear()
  })

  it('applies wrapper and tabs classes to the tabs root', () => {
    const { container } = render(
      <PortalConfigInput
        templates={false}
        wrapperClassName="flex-1"
        tabsClassName="compact-tabs"
      />
    )

    const tabs = container.querySelector('.simple-tabs')

    expect(tabs).toHaveClass('w-full')
    expect(tabs).toHaveClass('flex-1')
    expect(tabs).toHaveClass('compact-tabs')
  })

  it('preserves app enabled state across tab switches', async () => {
    render(<PortalConfigInput name="config" templates={false} defaultConfig={{}} />)

    fireEvent.click(screen.getByText('Apps'))

    const chatToggle = getChatAppToggle()

    expect(chatToggle).toHaveAttribute('aria-checked', 'false')

    fireEvent.click(chatToggle)

    await waitFor(() => {
      expect(getHiddenConfigInput().value).toContain('chat: {}')
    })

    fireEvent.click(screen.getByText('Layout'))
    fireEvent.click(screen.getByText('Apps'))

    await waitFor(() => {
      expect(getChatAppToggle()).toHaveAttribute('aria-checked', 'true')
    })
  })

  it('preserves app disable updates when switching tabs', async () => {
    render(
      <PortalConfigInput
        name="config"
        templates={false}
        defaultConfig={{ apps: { chat: {} } }}
      />
    )

    fireEvent.click(screen.getByText('Apps'))

    fireEvent.click(getChatAppToggle())

    await waitFor(() => {
      expect(getHiddenConfigInput().value).not.toContain('chat: {}')
    })

    fireEvent.click(screen.getByText('Users'))

    await waitFor(() => {
      expect(getHiddenConfigInput().value).not.toContain('chat: {}')
    })

    fireEvent.click(screen.getByText('Apps'))

    await waitFor(() => {
      expect(getChatAppToggle()).toHaveAttribute('aria-checked', 'false')
    })
  })

  it('preserves layout and app updates without cross-section clobbering', async () => {
    render(<PortalConfigInput name="config" templates={false} defaultConfig={{}} />)

    fireEvent.click(screen.getByText('Apps'))
    fireEvent.click(getChatAppToggle())

    await waitFor(() => {
      expect(getHiddenConfigInput().value).toContain('chat: {}')
    })

    fireEvent.click(screen.getByText('Layout'))
    fireEvent.click(getLayoutHeaderToggle())

    await waitFor(() => {
      expect(getHiddenConfigInput().value).toContain('header: false')
    })

    await waitFor(() => {
      const value = getHiddenConfigInput().value

      expect(value).toContain('apps:')
      expect(value).toContain('chat: {}')
      expect(value).toContain('layout:')
      expect(value).toContain('header: false')
    })

    fireEvent.click(screen.getByText('Users'))

    await waitFor(() => {
      const value = getHiddenConfigInput().value

      expect(value).toContain('chat: {}')
      expect(value).toContain('header: false')
    })
  })

  it('persists users matcher updates across tab switches', async () => {
    render(<PortalConfigInput name="config" templates={false} defaultConfig={{}} />)

    fireEvent.click(screen.getByText('Users'))

    const usersInput = screen.getByRole('textbox')

    fireEvent.change(usersInput, {
      target: { value: '*@company.com\nadmin@company.com' },
    })

    fireEvent.blur(usersInput)

    await waitFor(() => {
      const value = getHiddenConfigInput().value

      expect(value).toContain('users:')
      expect(value).toContain('*@company.com')
      expect(value).toContain('admin@company.com')
    })

    fireEvent.click(screen.getByText('Layout'))
    fireEvent.click(screen.getByText('Users'))

    await waitFor(() => {
      expect(screen.getByRole('textbox')).toHaveValue(
        '*@company.com\nadmin@company.com'
      )
    })
  })

  it('does not clobber focused users draft from external config updates', async () => {
    function Harness() {
      const [config, setConfig] = useState({})

      return (
        <>
          <button
            type="button"
            onClick={() => {
              setConfig({
                users: {
                  '*@external.com': {},
                },
              })
            }}
          >
            External Update
          </button>
          <PortalConfigInput
            name="config"
            templates={false}
            config={config}
            setConfig={setConfig}
          />
        </>
      )
    }

    render(<Harness />)

    fireEvent.click(screen.getByText('Users'))

    const usersInput = screen.getByRole('textbox')

    fireEvent.focus(usersInput)
    fireEvent.change(usersInput, {
      target: { value: '*@draft.com' },
    })

    fireEvent.click(screen.getByText('External Update'))

    await waitFor(() => {
      expect(screen.getByRole('textbox')).toHaveValue('*@draft.com')
    })

    fireEvent.blur(usersInput)

    await waitFor(() => {
      const value = getHiddenConfigInput().value

      expect(value).toContain('*@draft.com')
    })
  })

  // ---
  // Bug 1: enabled = !!configuredApps[slug] - falsy config values show wrong toggle state
  // ---

  describe('app toggle enabled check', () => {
    it('shows app as enabled when its config value is null but the key exists', () => {
      render(
        <PortalConfigInput
          name="config"
          templates={false}
          defaultConfig={{ apps: { chat: null } }}
        />
      )

      fireEvent.click(screen.getByText('Apps'))

      // chat IS in the apps config (key exists), so toggle must be enabled
      expect(getChatAppToggle()).toHaveAttribute('aria-checked', 'true')
    })

    it('removes an app whose config value is null in a single click', async () => {
      render(
        <PortalConfigInput
          name="config"
          templates={false}
          defaultConfig={{ apps: { chat: null } }}
        />
      )

      fireEvent.click(screen.getByText('Apps'))

      // single click on an "enabled" toggle should remove the app
      fireEvent.click(getChatAppToggle())

      await waitFor(() => {
        expect(getHiddenConfigInput().value).not.toContain('chat')
      })
    })
  })

  // ---
  // Bug 2: debounce useEffect depends on usersTextValue - external config changes reset the timer
  // ---

  describe('users debounce stability', () => {
    it('does not reset debounce timer when an external config change updates usersTextValue during typing', async () => {
      jest.useFakeTimers()

      function Harness() {
        const [config, setConfig] = useState({})

        return (
          <>
            <button
              type="button"
              onClick={() => {
                setConfig({ users: { 'override@test.com': {} } })
              }}
            >
              External Override
            </button>
            <PortalConfigInput
              name="config"
              templates={false}
              config={config}
              setConfig={setConfig}
            />
          </>
        )
      }

      const { act } = await import('@testing-library/react')

      render(<Harness />)

      fireEvent.click(screen.getByText('Users'))

      const usersInput = screen.getByRole('textbox')

      fireEvent.focus(usersInput)
      fireEvent.change(usersInput, { target: { value: 'typed@test.com' } })

      // advance 200 ms - less than the 300 ms debounce interval
      act(() => {
        jest.advanceTimersByTime(200)
      })

      // external update fires - this changes usersTextValue and should NOT reset the debounce
      fireEvent.click(screen.getByText('External Override'))

      // advance the remaining 100 ms (300 ms total from when the user typed)
      // the debounce should have fired if the timer was NOT reset
      act(() => {
        jest.advanceTimersByTime(100)
      })

      // the user's typed value must have been committed
      expect(getHiddenConfigInput().value).toContain('typed@test.com')

      jest.useRealTimers()
    })
  })

  // ---
  // Bug 4: apps with non-empty config that has schema options - disabling re-adds
  // the app because ContextSchema.Memo's child effects call setAppConfigValue
  // after removeApp has already fired, the no-op guard (hasOwnProperty) fails,
  // and the app gets re-inserted with the stale schema-driven value.
  // ---

  describe('disabling app with non-empty schema-driven config', () => {
    it('can disable a chat app that has save/models/sources set to true', async () => {
      render(
        <PortalConfigInput
          name="config"
          templates={false}
          defaultConfig={{
            apps: {
              chat: { save: true, models: true, sources: true },
              task: {},
            },
          }}
        />
      )

      fireEvent.click(screen.getByText('Apps'))

      // outer chat toggle is the first toggle in the list
      const chatToggle = getChatAppToggle()

      expect(chatToggle).toHaveAttribute('aria-checked', 'true')

      fireEvent.click(chatToggle)

      await waitFor(() => {
        expect(getHiddenConfigInput().value).not.toContain('chat')
      })
    })

    it('can disable a chat app and re-enable keeps task state intact', async () => {
      render(
        <PortalConfigInput
          name="config"
          templates={false}
          defaultConfig={{
            apps: {
              chat: { save: true, models: true, sources: true },
              task: {},
            },
          }}
        />
      )

      fireEvent.click(screen.getByText('Apps'))

      // disable chat
      fireEvent.click(getChatAppToggle())

      await waitFor(() => {
        expect(getHiddenConfigInput().value).not.toContain('chat')
      })

      // task must still be in the config
      expect(getHiddenConfigInput().value).toContain('task')
    })
  })

  describe('users textarea blur normalization', () => {
    it('trims surrounding whitespace from each line immediately on blur', async () => {
      render(
        <PortalConfigInput name="config" templates={false} defaultConfig={{}} />
      )

      fireEvent.click(screen.getByText('Users'))

      const usersInput = screen.getByRole('textbox')

      fireEvent.focus(usersInput)
      fireEvent.change(usersInput, {
        target: { value: '  *@company.com  \n  admin@company.com  ' },
      })
      fireEvent.blur(usersInput)

      // draft must immediately show the trimmed canonical form - no extra render required
      expect(usersInput).toHaveValue('*@company.com\nadmin@company.com')
    })

    it('deduplicates repeated matchers immediately on blur', async () => {
      render(
        <PortalConfigInput name="config" templates={false} defaultConfig={{}} />
      )

      fireEvent.click(screen.getByText('Users'))

      const usersInput = screen.getByRole('textbox')

      fireEvent.focus(usersInput)
      fireEvent.change(usersInput, {
        target: { value: '*@company.com\n*@company.com\nadmin@company.com' },
      })
      fireEvent.blur(usersInput)

      // duplicates must be removed immediately - no extra render required
      expect(usersInput).toHaveValue('*@company.com\nadmin@company.com')
    })
  })

  describe('template selection', () => {
    it('applies template config when the popup returns an object field', async () => {
      render(<PortalConfigInput name="config" defaultConfig={{}} />)

      fireEvent.click(document.querySelector('button.default-button.tiny'))

      const popupOptions = openPopupMock.mock.calls[0]?.[1]

      await act(async () => {
        await popupOptions.actions.Use.fn({
          config: {
            apps: {
              chat: {},
            },
            users: {
              '*@company.com': {},
            },
          },
        })
      })

      await waitFor(() => {
        const value = getHiddenConfigInput().value

        expect(value).toContain('apps:')
        expect(value).toContain('chat: {}')
        expect(value).not.toContain('object Object')
      })
    })
  })
})
