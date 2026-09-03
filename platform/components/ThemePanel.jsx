import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import demosData from '@/data/demos.yaml'

import { blackOrWhite, hueAndBrightnessGradient } from '@/lib/color2'
import { stringify as stringifyJson } from '@/lib/json'
import { flatten, unflatten } from '@/lib/object'
import { buildTheme, parseTheme } from '@/lib/theme'
import toast from '@/lib/toast'
import { stringify as stringifyYaml } from '@/lib/yaml'

import { ContextSchema, Item, useInputState } from '@/components/ContextInput'
import SchemaPanel from '@/components/SchemaPanel'

import useControlledState from '@/hooks/useControlledState'
import useCopyWebsiteTheme from '@/hooks/useCopyWebsiteTheme'

import clsx from 'clsx'

const PATH_ALIASES = {
  'font.leading': 'lineHeight',
  'popup.rounding': 'popupRounding',
}

function themeKeyToPath(key) {
  const aliasedPath = Object.entries(PATH_ALIASES).find(
    ([, themeKey]) => themeKey === key
  )?.[0]

  if (aliasedPath) {
    return aliasedPath
  }

  return key
    .split(/(?=[A-Z])/)
    .map((part) => part.toLowerCase())
    .join('.')
}

function pathToThemeKey(path) {
  if (path.startsWith('_')) {
    return null
  }

  if (PATH_ALIASES[path]) {
    return PATH_ALIASES[path]
  }

  return path
    .split('.')
    .map((item, index) =>
      index === 0 ? item : item.charAt(0).toUpperCase() + item.slice(1)
    )
    .join('')
}

function getValueThemeConfig(value) {
  return Object.fromEntries(
    Object.entries(flatten(value))
      .map(([path, value]) => {
        const key = pathToThemeKey(path)

        return key ? [key, value] : undefined
      })
      .filter(Boolean)
      .filter(([, value]) => value !== undefined)
  )
}

function getThemeConfigValue(config) {
  return unflatten(
    Object.fromEntries(
      Object.entries(config).map(([key, value]) => [themeKeyToPath(key), value])
    )
  )
}

function applyBrandConfig(config) {
  const nextConfig = { ...config }

  if (nextConfig.brandPrimary) {
    const brandPrimaryText = blackOrWhite(nextConfig.brandPrimary)

    Object.assign(nextConfig, {
      ...(nextConfig.popupBorderGradientFrom ||
      nextConfig.popupBorderGradientVia ||
      nextConfig.popupBorderGradientTo
        ? {
            ...((color) => {
              const [from, via, to] = hueAndBrightnessGradient(color, 3)

              return {
                popupBorderGradientFrom: from,
                popupBorderGradientVia: via,
                popupBorderGradientTo: to,
              }
            })(nextConfig.brandPrimary),
          }
        : {
            popupBorderPrimary: nextConfig.brandPrimary,
          }),

      botMessageText: brandPrimaryText,
      botMessagePrimary: nextConfig.brandPrimary,

      inputBorderSecondary: nextConfig.brandPrimary,

      tapText: nextConfig.brandPrimary,

      buttonText: brandPrimaryText,
      buttonPrimary: nextConfig.brandPrimary,
      buttonSecondary: nextConfig.brandPrimary,
    })
  }

  if (nextConfig.brandSecondary) {
    const brandSecondaryText = blackOrWhite(nextConfig.brandSecondary)

    Object.assign(nextConfig, {
      userMessageText: brandSecondaryText,
      userMessagePrimary: nextConfig.brandSecondary,
    })
  }

  return nextConfig
}

function getThemeOptions(themes = []) {
  const seenValues = new Set()
  const seenLabels = {}

  return Object.fromEntries(
    themes
      .map((theme) => {
        if (seenValues.has(theme)) {
          return null
        }

        seenValues.add(theme)

        const { name, config } = parseTheme(theme)
        const label = config.name || name

        seenLabels[label] = (seenLabels[label] || 0) + 1

        return [
          seenLabels[label] > 1 ? `${label} ${seenLabels[label]}` : label,
          theme,
        ]
      })
      .filter(Boolean)
  )
}

export const SizeInput = ContextSchema.Custom(function SizeInput({
  label,

  name,
  description,

  defaultValue: _defaultValue = '',
  value: _value,
  setValue: _setValue,

  defaultDisabled,
  disabled,
  setDisabled,

  optional,

  serializer,
  deserializer,

  className,
  inputClassName,

  children,

  ...props
}) {
  const state = useInputState({
    name,
    defaultValue: _defaultValue,
    value: _value,
    setValue: _setValue,
    defaultDisabled,
    disabled,
    setDisabled,
    optional,
    serializer,
    deserializer,
  })

  const { value, unit } = useMemo(() => {
    const match = (state.value ?? '').toString().match(/^(.*?)(px|em|rem|%)$/)

    if (!match) {
      return { value: state.value ?? '', unit: '' }
    }

    const [, value, unit] = match

    return {
      value: value?.trim(),
      unit: unit?.trim(),
    }
  }, [state.value])

  const changeValue = useCallback(
    (value) => {
      const newValue = /(px|em|rem|%)$/.test(value)
        ? `${value}`
        : `${value}${unit || 'px'}`

      state.setValue(newValue)
    },
    [unit, state]
  )

  const changeUnit = useCallback(
    (newUnit) => {
      const newValue = `${value || '0'}${newUnit}`

      state.setValue(newValue)
    },
    [value, state]
  )

  return (
    <Item
      {...props}
      className={clsx('size-input', className)}
      label={label}
      name={name}
      description={description}
      state={state}
    >
      <div
        className={clsx(
          'w-full flex flex-row gap-1 items-center',
          {
            'disabled cursor-not-allowed': !!state.disabled,
          },
          inputClassName
        )}
      >
        <input
          className="none-input [font-size:inherit] [line-height:inherit] w-full"
          type="text"
          value={value}
          onChange={(event) => changeValue(event.target.value)}
          disabled={state.disabled}
        />
        <div
          className={clsx(
            'tag',
            {
              darker: unit === 'px',
              'disabled cursor-not-allowed': !!state.disabled,
            },
            'py-0 [font-size:inherit] [line-height:inherit]'
          )}
          onClick={state.disabled ? undefined : changeUnit.bind(null, 'px')}
          aria-disabled={state.disabled}
        >
          px
        </div>
        <div
          className={clsx(
            'tag',
            {
              darker: unit === 'em',
              'disabled cursor-not-allowed': !!state.disabled,
            },
            'py-0 [font-size:inherit] [line-height:inherit]'
          )}
          onClick={state.disabled ? undefined : changeUnit.bind(null, 'em')}
          aria-disabled={state.disabled}
        >
          em
        </div>
        <div
          className={clsx(
            'tag',
            {
              darker: unit === 'rem',
              'disabled cursor-not-allowed': !!state.disabled,
            },
            'py-0 [font-size:inherit] [line-height:inherit]'
          )}
          onClick={state.disabled ? undefined : changeUnit.bind(null, 'rem')}
          aria-disabled={state.disabled}
        >
          rem
        </div>
        <div
          className={clsx(
            'tag',
            {
              darker: unit === '%',
              'disabled cursor-not-allowed': !!state.disabled,
            },
            'py-0 [font-size:inherit] [line-height:inherit]'
          )}
          onClick={state.disabled ? undefined : changeUnit.bind(null, '%')}
          aria-disabled={state.disabled}
        >
          %
        </div>
      </div>
      {children}
    </Item>
  )
})

export default function ThemePanel({
  defaultDemos: _defaultDemos = demosData,
  demos: _demos,
  setDemos: _setDemos,

  defaultDemo: _defaultDemo = Object.keys(_demos || demosData || {})[0],
  demo: _demo,
  setDemo: _setDemo,

  defaultThemes: _defaultThemes,
  themes: _themes,
  setThemes: _setThemes,

  defaultTheme: _defaultTheme,
  theme: _theme,
  setTheme: _setTheme,

  defaultTitle: _defaultTitle,
  title: _title,
  onTitleChange: _onTitleChange,

  defaultIntro: _defaultIntro,
  intro: _intro,
  onIntroChange: _onIntroChange,

  defaultInitial: _defaultInitial,
  initial: _initial,
  onInitialChange: _onInitialChange,

  defaultPanelHidden: _defaultPanelHidden = true,
  panelHidden: _panelHidden,
  setPanelHidden: _setPanelHidden,

  ...props
}) {
  // create controlled states

  const [demos] = useControlledState(_defaultDemos, _demos, _setDemos)

  const [demo, setDemo] = useControlledState(_defaultDemo, _demo, _setDemo)

  const [themes] = useControlledState(_defaultThemes, _themes, _setThemes)

  const [theme, setTheme] = useControlledState(_defaultTheme, _theme, _setTheme)

  const [, setTitle] = useControlledState(_defaultTitle, _title, _onTitleChange)

  const [, setIntro] = useControlledState(_defaultIntro, _intro, _onIntroChange)

  const [, setInitial] = useControlledState(
    _defaultInitial,
    _initial,
    _onInitialChange
  )

  const [panelHidden, setPanelHidden] = useControlledState(
    _defaultPanelHidden,
    _panelHidden,
    _setPanelHidden
  )

  // setup value

  const [value, setValue] = useState({})
  const [themeName, setThemeName] = useState(() => {
    return parseTheme(_theme || _defaultTheme).name
  })
  const [ready, setReady] = useState(false)

  const isSyncingThemeRef = useRef(false)
  const selectedThemeRef = useRef(_theme || _defaultTheme)
  const isLoadingSelectedThemeRef = useRef(false)

  const [copyWebsiteThemePopup, openCopyWebsiteThemePopup] =
    useCopyWebsiteTheme(
      useCallback(
        (value) => {
          setPanelHidden(false)

          if (!value) {
            return
          }

          const { theme, title, intro, initial } = value

          setTheme(theme)

          if (title) {
            setTitle(title)
          }

          if (intro) {
            setIntro(intro)
          }

          if (initial) {
            setInitial(initial)
          }
        },
        [setPanelHidden, setTheme, setTitle, setIntro, setInitial]
      )
    )

  // sync demos

  useEffect(() => {
    setValue((prev) => ({
      ...prev,

      _demo: demo,
    }))
  }, [demo])

  useEffect(() => {
    if (value._demo) {
      setDemo(value._demo)
    }
  }, [value, setDemo])

  // sync theme

  useEffect(() => {
    if (isSyncingThemeRef.current) {
      isSyncingThemeRef.current = false

      return
    }

    const { name, config } = parseTheme(theme)

    setThemeName(name)
    selectedThemeRef.current = theme

    const values = getThemeConfigValue(config)

    setValue((prev) => ({
      ...prev,

      _theme: theme,

      ...values,
    }))

    setReady(true)
  }, [theme])

  useEffect(() => {
    if (!ready || !value._theme) {
      return
    }

    if (value._theme === selectedThemeRef.current) {
      return
    }

    const { name, config } = parseTheme(value._theme)

    selectedThemeRef.current = value._theme
    isLoadingSelectedThemeRef.current = true

    setThemeName(name)

    setValue((prev) => ({
      ...prev,

      _theme: value._theme,

      ...getThemeConfigValue(config),
    }))
  }, [ready, value._theme])

  const themeConfig = useMemo(() => {
    return getValueThemeConfig(value)
  }, [value])

  const builtThemeConfig = useMemo(() => {
    return applyBrandConfig(themeConfig)
  }, [themeConfig])

  useEffect(() => {
    if (!ready) {
      return
    }

    if (isLoadingSelectedThemeRef.current) {
      isLoadingSelectedThemeRef.current = false

      return
    }

    const { name: newThemeName } = parseTheme(value._theme || themeName)
    const newTheme = buildTheme(newThemeName, builtThemeConfig)

    if (theme !== newTheme) {
      isSyncingThemeRef.current = true

      setThemeName(newThemeName)
      setTheme(newTheme)
    }
  }, [ready, value, themeName, builtThemeConfig, theme, setTheme])

  // setup section

  const [section, setSection] = useState('basic')

  useEffect(() => {
    if (value._section) {
      setSection(value._section)
    }
  }, [value])

  // setup the schemas

  const basicSchema = useMemo(() => {
    return {
      type: 'object',
      title: 'Theme Designer Schema',
      properties: {
        _demo: {
          title: 'Demo',
          type: 'string',
          description: 'The demo to use for the theme.',
          enum: Object.keys(demos), // @todo use nicer names
        },
        _theme: {
          title: 'Theme',
          type: 'string',
          description: 'The theme to use for the demo.',
          enum: getThemeOptions(themes),
        },
        brand: {
          title: 'Brand',
          type: 'object',
          properties: {
            primary: {
              title: 'Primary',
              description: 'The primary color for the theme.',
              type: 'string',
              format: 'color',
            },
            secondary: {
              title: 'Secondary',
              description: 'The secondary color for the theme.',
              type: 'string',
              format: 'color',
            },
          },
        },
      },
      required: ['_demo', '_theme', 'brand'],
    }
  }, [demos, themes])

  const advancedSchema = useMemo(() => {
    function getMessageProperties(type, properties) {
      return {
        primary: {
          title: 'Primary',
          description: `The primary color for ${
            type ? type.toLowerCase() + ' ' : ''
          }messages.`,
          type: 'string',
          format: 'color',
        },
        text: {
          title: 'Text',
          description: `The text color for ${
            type ? type.toLowerCase() + ' ' : ''
          }messages.`,
          type: 'string',
          format: 'color',
        },

        ...properties,

        rounding: {
          title: 'Rounding',
          description: `The border radius for ${
            type ? type.toLowerCase() + ' ' : ''
          }messages.`,
          type: 'string',
          format: SizeInput,
        },
        padding: {
          title: 'Padding',
          description: `The padding for ${
            type ? type.toLowerCase() + ' ' : ''
          }messages.`,
          type: 'string',
        },
        font: {
          title: 'Font',
          type: 'object',
          properties: {
            size: {
              title: 'Size',
              description: `The font size for ${
                type ? type.toLowerCase() + ' ' : ''
              }messages.`,
              type: 'string',
              format: SizeInput,
            },
            weight: {
              title: 'Weight',
              description: `The font weight for ${
                type ? type.toLowerCase() + ' ' : ''
              }messages.`,
              type: 'string',
            },
          },
          'react:props': { defaultOpen: false },
        },
        link: {
          type: 'object',
          title: 'Link',
          properties: {
            primary: {
              title: 'Primary',
              description: `The primary color for ${
                type ? type.toLowerCase() + ' ' : ''
              }message links.`,
              type: 'string',
              format: 'color',
            },
            secondary: {
              title: 'Secondary',
              description: `The secondary color for ${
                type ? type.toLowerCase() + ' ' : ''
              }message links.`,
              type: 'string',
              format: 'color',
            },
            decoration: {
              title: 'Decoration',
              description: `The text decoration for ${
                type ? type.toLowerCase() + ' ' : ''
              }message links.`,
              type: 'string',
              enum: ['underline', 'none'],
            },
          },
          'react:props': { defaultOpen: false },
        },
        button: {
          type: 'object',
          title: 'Button',
          properties: {
            primary: {
              title: 'Primary',
              description: `The primary color for ${
                type ? type.toLowerCase() + ' ' : ''
              }message buttons.`,
              type: 'string',
              format: 'color',
            },
            secondary: {
              title: 'Secondary',
              description: `The secondary color for ${
                type ? type.toLowerCase() + ' ' : ''
              }message buttons.`,
              type: 'string',
              format: 'color',
            },
            text: {
              title: 'Text',
              description: `The text color for ${
                type ? type.toLowerCase() + ' ' : ''
              }message buttons.`,
              type: 'string',
              format: 'color',
            },
            rounding: {
              title: 'Rounding',
              description: `The border radius for ${
                type ? type.toLowerCase() + ' ' : ''
              }message buttons.`,
              type: 'string',
              format: SizeInput,
            },
            padding: {
              title: 'Padding',
              description: `The padding for ${
                type ? type.toLowerCase() + ' ' : ''
              }message buttons.`,
              type: 'string',
            },
            border: {
              title: 'Border',
              type: 'object',
              properties: {
                primary: {
                  title: 'Primary',
                  description: `The border color for ${
                    type ? type.toLowerCase() + ' ' : ''
                  }message buttons.`,
                  type: 'string',
                  format: 'color',
                },
                secondary: {
                  title: 'Secondary',
                  description: `The secondary border color for ${
                    type ? type.toLowerCase() + ' ' : ''
                  }message buttons.`,
                  type: 'string',
                  format: 'color',
                },
                size: {
                  title: 'Size',
                  description: `The size of the ${
                    type ? type.toLowerCase() + ' ' : ''
                  }message button border.`,
                  type: 'string',
                  format: SizeInput,
                },
              },
              'react:props': { defaultOpen: false },
            },
          },
          'react:props': { defaultOpen: false },
        },
      }
    }

    return {
      type: 'object',
      title: 'Theme Designer Schema',
      properties: {
        font: {
          title: 'Font',
          type: 'object',
          properties: {
            family: {
              title: 'Family',
              description: 'The font family to use for the theme.',
              type: 'string',
            },
            size: {
              title: 'Size',
              description: 'The base font size for the theme.',
              type: 'string',
              format: SizeInput,
            },
            weight: {
              title: 'Weight',
              description: 'The font weight for the theme.',
              type: 'string',
            },
            leading: {
              title: 'Line Height',
              description: 'The line height for the theme.',
              type: 'string',
            },
          },
          'react:props': { defaultOpen: false },
        },
        popup: {
          title: 'Popup',
          type: 'object',
          properties: {
            rounding: {
              title: 'Rounding',
              description: 'The border radius for popups.',
              type: 'string',
              format: SizeInput,
            },
            border: {
              title: 'Border',
              type: 'object',
              properties: {
                primary: {
                  title: 'Primary',
                  description: 'The border color for popups.',
                  type: 'string',
                  format: 'color',
                },
                gradientFrom: {
                  title: 'Gradient From',
                  description:
                    'The starting color for the popup border gradient.',
                  type: 'string',
                  format: 'color',
                },
                gradientTo: {
                  title: 'Gradient To',
                  description:
                    'The ending color for the popup border gradient.',
                  type: 'string',
                  format: 'color',
                },
                gradientVia: {
                  title: 'Gradient Via',
                  description:
                    'The middle color for the popup border gradient.',
                  type: 'string',
                  format: 'color',
                },
                size: {
                  title: 'Size',
                  description: 'The size of the popup border.',
                  type: 'string',
                  format: SizeInput,
                },
              },
              'react:props': { defaultOpen: false },
            },
          },
          'react:props': { defaultOpen: false },
        },
        bar: {
          title: 'Bar',
          type: 'object',
          properties: {
            primary: {
              title: 'Primary',
              description: 'The primary color for the bar.',
              type: 'string',
              format: 'color',
            },
            text: {
              title: 'Text',
              description: 'The text color for the bar.',
              type: 'string',
              format: 'color',
            },
            padding: {
              title: 'Padding',
              description: 'The padding for the bar.',
              type: 'string',
            },
            border: {
              title: 'Border',
              type: 'object',
              properties: {
                primary: {
                  title: 'Primary',
                  description: 'The border color for the bar.',
                  type: 'string',
                  format: 'color',
                },
                size: {
                  title: 'Size',
                  description: 'The size of the bar border.',
                  type: 'string',
                  format: SizeInput,
                },
              },
              'react:props': { defaultOpen: false },
            },
            icon: {
              title: 'Icon',
              type: 'object',
              properties: {
                rounding: {
                  title: 'Rounding',
                  description: 'The border radius for bar icons.',
                  type: 'string',
                  format: SizeInput,
                },
              },
              'react:props': { defaultOpen: false },
            },
          },
          'react:props': { defaultOpen: false },
        },
        conversation: {
          title: 'Conversation',
          type: 'object',
          properties: {
            primary: {
              title: 'Primary',
              description: 'The primary color for conversations.',
              type: 'string',
              format: 'color',
            },
            text: {
              title: 'Text',
              description: 'The text color for conversations.',
              type: 'string',
              format: 'color',
            },
          },
          'react:props': { defaultOpen: false },
        },
        message: {
          title: 'Message',
          type: 'object',
          properties: getMessageProperties(null, {
            style: {
              title: 'Style',
              description: 'The style of the message (e.g., bubble, stack).',
              type: 'string',
              enum: ['bubble', 'stack'],
            },
            spacing: {
              title: 'Spacing',
              description: 'The spacing between messages.',
              type: 'string',
              format: SizeInput,
            },
          }),
          'react:props': { defaultOpen: false },
        },
        introMessage: {
          title: 'Intro Message',
          type: 'object',
          properties: getMessageProperties('Intro'),
          'react:props': { defaultOpen: false },
        },
        inputMessage: {
          title: 'Input Message',
          type: 'object',
          properties: getMessageProperties('Input'),
          'react:props': { defaultOpen: false },
        },
        botMessage: {
          title: 'Bot Message',
          type: 'object',
          properties: getMessageProperties('Bot'),
          'react:props': { defaultOpen: false },
        },
        userMessage: {
          title: 'User Message',
          type: 'object',
          properties: getMessageProperties('User'),
          'react:props': { defaultOpen: false },
        },
        input: {
          title: 'Input',
          type: 'object',
          properties: {
            primary: {
              title: 'Primary',
              description: 'The primary color for input fields.',
              type: 'string',
              format: 'color',
            },
            text: {
              title: 'Text',
              description: 'The text color for input fields.',
              type: 'string',
              format: 'color',
            },
            rounding: {
              title: 'Rounding',
              description: 'The border radius for input fields.',
              type: 'string',
              format: SizeInput,
            },
            padding: {
              title: 'Padding',
              description: 'The padding for input fields.',
              type: 'string',
            },
            border: {
              type: 'object',
              title: 'Border',
              properties: {
                primary: {
                  title: 'Primary',
                  description: 'The border color for input fields.',
                  type: 'string',
                  format: 'color',
                },
                secondary: {
                  title: 'Secondary',
                  description: 'The secondary border color for input fields.',
                  type: 'string',
                  format: 'color',
                },
                size: {
                  title: 'Size',
                  description: 'The size of the input field border.',
                  type: 'string',
                  format: SizeInput,
                },
              },
              'react:props': { defaultOpen: false },
            },
          },
          'react:props': { defaultOpen: false },
        },
        button: {
          title: 'Button',
          type: 'object',
          properties: {
            primary: {
              title: 'Primary',
              description: 'The primary color for buttons.',
              type: 'string',
              format: 'color',
            },
            secondary: {
              title: 'Secondary',
              description: 'The secondary color for buttons.',
              type: 'string',
              format: 'color',
            },
            text: {
              title: 'Text',
              description: 'The text color for buttons.',
              type: 'string',
              format: 'color',
            },
            rounding: {
              title: 'Rounding',
              description: 'The border radius for buttons.',
              type: 'string',
              format: SizeInput,
            },
            padding: {
              title: 'Padding',
              description: 'The padding for buttons.',
              type: 'string',
            },
            size: {
              title: 'Size',
              description: 'The size of the floating widget button.',
              type: 'string',
              format: SizeInput,
            },
          },
          'react:props': { defaultOpen: false },
        },
      },
      required: [
        'font',
        'popup',
        'bar',
        'conversation',
        'message',
        'introMessage',
        'inputMessage',
        'botMessage',
        'userMessage',
        'input',
        'button',
      ],
    }
  }, [])

  const developerSchema = useMemo(() => {
    return {
      type: 'object',
      title: 'Theme Designer Schema',
      properties: {},
      required: [],
    }
  }, [])

  const schema = useMemo(() => {
    const selectedSchema =
      {
        basic: basicSchema,
        advanced: advancedSchema,
        developer: developerSchema,
      }[section] || {}

    return {
      ...selectedSchema,

      properties: {
        _section: {
          title: 'Section',
          type: 'string',
          description: 'The section of the theme to edit.',
          enum: {
            'Quick Start': 'basic',
            'Advanced Customizations': 'advanced',
            'Developer Tools': 'developer',
          },
        },

        ...(selectedSchema.properties || {}),
      },

      required: ['_section', ...(selectedSchema.required || [])],
    }
  }, [section, basicSchema, advancedSchema, developerSchema])

  // render

  if (panelHidden) {
    return null
  }

  return (
    <>
      {copyWebsiteThemePopup}
      <SchemaPanel.Saving
        {...props}
        className={clsx(
          'right-4 top-20 max-h-[calc(100vh-6rem)]',
          props.className
        )}
        title="Design Panel"
        dockable={false}
        schema={schema}
        value={value}
        setValue={setValue}
      >
        {section === 'basic' ? (
          <button
            className="default-button tiny push !text-xxs"
            type="button"
            onClick={() => openCopyWebsiteThemePopup()}
          >
            Copy Website Theme
          </button>
        ) : null}
        {section === 'developer' ? (
          <>
            <button
              className="default-button tiny push !text-xxs"
              type="button"
              onClick={async () => {
                try {
                  const text = stringifyJson({
                    name: themeName,
                    config: builtThemeConfig,
                  })

                  await navigator.clipboard.writeText(text)

                  toast.success('Theme JSON copied to clipboard!')
                } catch {
                  // @note clipboard API may be blocked by permissions policy

                  toast.error('Failed to copy theme JSON to clipboard')
                }
              }}
            >
              Copy Theme JSON
            </button>
            <button
              className="default-button tiny push !text-xxs"
              type="button"
              onClick={async () => {
                try {
                  const text = stringifyYaml({
                    name: themeName,
                    config: builtThemeConfig,
                  })

                  await navigator.clipboard.writeText(text)

                  toast.success('Theme YAML copied to clipboard!')
                } catch {
                  // @note clipboard API may be blocked by permissions policy
                }
              }}
            >
              Copy Theme YAML
            </button>
            <button
              className="default-button tiny push !text-xxs"
              type="button"
              onClick={async () => {
                try {
                  const text = buildTheme(themeName, builtThemeConfig)

                  await navigator.clipboard.writeText(text)

                  toast.success('Theme Struct copied to clipboard!')
                } catch {
                  // @note clipboard API may be blocked by permissions policy
                }
              }}
            >
              Copy Theme Struct
            </button>
          </>
        ) : null}
      </SchemaPanel.Saving>
    </>
  )
}
