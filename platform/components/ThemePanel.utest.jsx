/* eslint-disable @typescript-eslint/no-require-imports */
import ThemePanel, { SizeInput } from './ThemePanel'

import { buildTheme, parseTheme } from '@/lib/theme'

import { ContextSchema } from '@/components/ContextInput'

import '@testing-library/jest-dom'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'

const mockSchemaPanelCalls = []

jest.mock('@/components/SchemaPanel', () => {
  function MockSchemaPanel({ schema, value, setValue, children, ...props }) {
    mockSchemaPanelCalls.push({ schema, value, setValue, props })

    return (
      <div data-testid="schema-panel">
        <output data-testid="theme-options">
          {JSON.stringify(schema.properties._theme?.enum || {})}
        </output>
        <output data-testid="panel-value">{JSON.stringify(value)}</output>
        <button
          type="button"
          onClick={() =>
            setValue((prev) => ({
              ...prev,

              _theme: 'dark',
            }))
          }
        >
          select dark
        </button>
        <button
          type="button"
          onClick={() =>
            setValue((prev) => ({
              ...prev,

              brand: {
                ...prev.brand,

                primary: '#ff0000',
              },
            }))
          }
        >
          set brand primary
        </button>
        <button
          type="button"
          onClick={() =>
            setValue((prev) => ({
              ...prev,

              button: {
                ...prev.button,

                padding: '8px 12px',
              },
            }))
          }
        >
          set button padding
        </button>
        <button
          type="button"
          onClick={() =>
            setValue((prev) => ({
              ...prev,

              _section: 'advanced',
            }))
          }
        >
          show advanced
        </button>
        {children}
      </div>
    )
  }

  MockSchemaPanel.Saving = MockSchemaPanel

  return {
    __esModule: true,
    default: MockSchemaPanel,
  }
})

jest.mock('@/hooks/useCopyWebsiteTheme', () => ({
  __esModule: true,
  default: () => [null, jest.fn()],
}))

function renderThemePanel(props = {}) {
  return render(
    <ThemePanel
      defaultDemo="default"
      defaultPanelHidden={false}
      defaultTheme="default"
      defaultThemes={['blank', 'default', 'light', 'dark', 'modern', 'stack']}
      {...props}
    />
  )
}

describe('ThemePanel', () => {
  beforeEach(() => {
    mockSchemaPanelCalls.length = 0
  })

  it('dedupes exact theme values and keeps repeated labels addressable', async () => {
    const customTheme1 = buildTheme('default', {
      name: 'Custom',
      botMessagePrimary: '#111111',
    })
    const customTheme2 = buildTheme('default', {
      name: 'Custom',
      botMessagePrimary: '#222222',
    })

    renderThemePanel({
      defaultThemes: ['default', 'default', customTheme1, customTheme2],
    })

    await waitFor(() => {
      expect(screen.getByTestId('theme-options')).not.toHaveTextContent('{}')
    })

    const options = JSON.parse(screen.getByTestId('theme-options').textContent)

    expect(options).toEqual({
      default: 'default',
      Custom: customTheme1,
      'Custom 2': customTheme2,
    })
  })

  it('loads the selected theme config before rebuilding the theme', async () => {
    const setTheme = jest.fn()

    renderThemePanel({
      theme: 'light',
      setTheme,
    })

    await waitFor(() => {
      expect(mockSchemaPanelCalls.at(-1).value._theme).toBe('light')
    })

    act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'select dark' }))
    })

    await waitFor(() => {
      expect(mockSchemaPanelCalls.at(-1).value.conversation.primary).toBe(
        '#000000'
      )
    })

    await waitFor(() => {
      expect(setTheme).toHaveBeenCalled()
    })

    const selectedTheme = setTheme.mock.calls.at(-1)[0]
    const { name, config } = parseTheme(selectedTheme)

    expect(name).toBe('dark')
    expect(config.conversationPrimary).toBe('#000000')
    expect(config.conversationText).toBe('#ffffff')
  })

  it('expands brand primary into dependent widget colors', async () => {
    const setTheme = jest.fn()

    renderThemePanel({
      theme: 'default',
      setTheme,
    })

    await waitFor(() => {
      expect(mockSchemaPanelCalls.at(-1).value._theme).toBe('default')
    })

    act(() => {
      fireEvent.click(
        screen.getByRole('button', { name: 'set brand primary' })
      )
    })

    await waitFor(() => {
      expect(setTheme).toHaveBeenCalled()
    })

    const selectedTheme = setTheme.mock.calls.at(-1)[0]
    const { config } = parseTheme(selectedTheme)

    expect(config.brandPrimary).toBe('#ff0000')
    expect(config.botMessagePrimary).toBe('#ff0000')
    expect(config.inputBorderSecondary).toBe('#ff0000')
    expect(config.buttonPrimary).toBe('#ff0000')
    expect(config.buttonSecondary).toBe('#ff0000')
  })

  it('includes the remaining visual controls from the legacy theme panel', async () => {
    renderThemePanel()

    await waitFor(() => {
      expect(mockSchemaPanelCalls.at(-1).value._theme).toBe('default')
    })

    act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'show advanced' }))
    })

    await waitFor(() => {
      expect(
        mockSchemaPanelCalls.at(-1).schema.properties.introMessage
      ).toBeDefined()
    })

    const schema = mockSchemaPanelCalls.at(-1).schema

    expect(
      schema.properties.popup.properties.border.properties.size
    ).toBeDefined()
    expect(schema.properties.button.properties.size).toBeDefined()
    expect(schema.properties.introMessage.properties.button).toBeDefined()
    expect(schema.properties.font.properties.leading.format).toBeUndefined()
    expect(schema.properties.button.properties.padding.format).toBeUndefined()
    expect(schema.properties.input.properties.padding.format).toBeUndefined()
    expect(schema.properties.bar.properties.padding.format).toBeUndefined()
    expect(schema.properties.message.properties.padding.format).toBeUndefined()
  })

  it('preserves CSS shorthand visual values when rebuilding the theme', async () => {
    const setTheme = jest.fn()

    renderThemePanel({
      theme: 'default',
      setTheme,
    })

    await waitFor(() => {
      expect(mockSchemaPanelCalls.at(-1).value._theme).toBe('default')
    })

    act(() => {
      fireEvent.click(
        screen.getByRole('button', { name: 'set button padding' })
      )
    })

    await waitFor(() => {
      const selectedTheme = setTheme.mock.calls.at(-1)?.[0]

      expect(selectedTheme).toBeDefined()
      expect(parseTheme(selectedTheme).config.buttonPadding).toBe('8px 12px')
    })
  })

  it('keeps complex CSS values visible in the size input instead of blanking them', () => {
    render(
      <ContextSchema
        defaultValue={{ size: 'calc(100% - 2rem)' }}
        schema={{
          type: 'object',
          properties: {
            size: {
              type: 'string',
              title: 'Size',
              format: SizeInput,
            },
          },
        }}
      />
    )

    expect(screen.getByDisplayValue('calc(100% - 2rem)')).toBeInTheDocument()
  })

  it('disables docking for the theme designer panel', async () => {
    renderThemePanel()

    await waitFor(() => {
      expect(mockSchemaPanelCalls.at(-1).props.dockable).toBe(false)
    })
  })
})
