import { type Config, build, parse } from '@/lib/structstr'

/**
 * This file contains the default theme types. The default themes are meant to
 * be used as quick templates from where customizations can be made.
 */

export const COLOR_WHITE = '#ffffff'
export const COLOR_BLACK = '#000000'
export const COLOR_INDIGO_500 = '#6366f1'
export const COLOR_INDIGO_600 = '#4f46e5'
export const COLOR_LIME_500 = '#84cc16'
export const COLOR_GRAY_50 = '#f9fafb'
export const COLOR_GRAY_100 = '#f3f4f6'
export const COLOR_GRAY_200 = '#e5e7eb'
export const COLOR_GRAY_300 = '#d1d5db'
export const COLOR_GRAY_400 = '#9ca3af'
export const COLOR_GRAY_500 = '#6b7280'
export const COLOR_GRAY_600 = '#4b5563'
export const COLOR_GRAY_700 = '#374151'
export const COLOR_GRAY_800 = '#1f2937'
export const COLOR_GRAY_900 = '#111827'
export const COLOR_INHERIT = 'inherit'
export const COLOR_TRANSPARENT = 'transparent'

export type ThemeConfig = Config

interface Themes {
  blank: ThemeConfig
  default: ThemeConfig
  light: ThemeConfig
  dark: ThemeConfig
  modern: ThemeConfig
  stack: ThemeConfig
}

export const themes: Readonly<Themes> = Object.freeze({
  blank: {},

  default: {
    version: 'v2',

    fontSize: '1rem',
    lineHeight: '1.75rem',

    previewPrimary: COLOR_GRAY_50,
    framePrimary: COLOR_GRAY_50,

    popupBorderPrimary: COLOR_INDIGO_500,
    popupRounding: '1.5rem',

    conversationText: COLOR_GRAY_900,
    conversationPrimary: COLOR_WHITE,

    barText: COLOR_GRAY_900,
    barPrimary: COLOR_WHITE,
    barBorderPrimary: COLOR_GRAY_100,

    messagesPadding: '10px',

    messageSpacing: '1rem',
    messagePadding: '0.5rem 1rem',
    messageRounding: '0.5rem',

    introMessageText: COLOR_GRAY_500,

    introMessageButtonPrimary: COLOR_WHITE,
    introMessageButtonSecondary: COLOR_GRAY_100,
    introMessageButtonText: COLOR_GRAY_600,
    introMessageButtonBorderPrimary: COLOR_GRAY_300,
    introMessageButtonBorderSecondary: COLOR_GRAY_300,

    userMessageText: COLOR_BLACK,
    userMessagePrimary: COLOR_GRAY_100,
    userMessageLinkPrimary: COLOR_INHERIT,
    userMessageLinkSecondary: COLOR_INHERIT,

    botMessageText: COLOR_WHITE,
    botMessagePrimary: COLOR_INDIGO_500,
    botMessageLinkPrimary: COLOR_INHERIT,
    botMessageLinkSecondary: COLOR_INHERIT,
    botMessageButtonPrimary: COLOR_WHITE,
    botMessageButtonSecondary: COLOR_WHITE,
    botMessageButtonText: COLOR_INDIGO_500,

    inputMessageText: COLOR_GRAY_500,

    actionsPadding: '10px',

    inputText: COLOR_GRAY_900,
    inputPrimary: COLOR_WHITE,
    inputSecondary: COLOR_WHITE,
    inputBorderPrimary: COLOR_GRAY_300,
    inputBorderSecondary: COLOR_INDIGO_500,
    inputRounding: '1rem',

    tapText: COLOR_INDIGO_500,

    buttonText: COLOR_WHITE,
    buttonPrimary: COLOR_INDIGO_500,
    buttonSecondary: COLOR_INDIGO_600,

    messageStyle: 'bubble',
  },

  light: {
    version: 'v2',

    fontSize: '1rem',
    lineHeight: '1.75rem',

    previewPrimary: COLOR_GRAY_50,
    framePrimary: COLOR_GRAY_50,

    popupBorderPrimary: COLOR_INDIGO_500,

    conversationText: COLOR_GRAY_900,
    conversationPrimary: COLOR_WHITE,

    barText: COLOR_GRAY_900,
    barPrimary: COLOR_WHITE,
    barBorderPrimary: COLOR_GRAY_100,

    messagesPadding: '10px',

    messageSpacing: '1.25rem',
    messagePadding: '0.5rem 1rem',
    messageRounding: '0.5rem',

    userMessageText: COLOR_WHITE,
    userMessagePrimary: COLOR_LIME_500,
    userMessageLinkPrimary: COLOR_WHITE,
    userMessageLinkSecondary: COLOR_WHITE,

    botMessageText: COLOR_WHITE,
    botMessagePrimary: COLOR_INDIGO_500,
    botMessageLinkPrimary: COLOR_INHERIT,
    botMessageLinkSecondary: COLOR_INHERIT,

    actionsPadding: '10px',

    inputText: COLOR_GRAY_900,
    inputPrimary: COLOR_WHITE,
    inputSecondary: COLOR_WHITE,
    inputBorderPrimary: COLOR_GRAY_300,
    inputBorderSecondary: COLOR_INDIGO_500,

    tapText: COLOR_INDIGO_500,

    buttonText: COLOR_WHITE,
    buttonPrimary: COLOR_INDIGO_500,
    buttonSecondary: COLOR_INDIGO_600,

    messageStyle: 'bubble',
  },

  dark: {
    version: 'v2',

    fontSize: '1rem',
    lineHeight: '1.75rem',

    previewPrimary: COLOR_BLACK,
    framePrimary: COLOR_BLACK,

    popupBorderPrimary: COLOR_GRAY_600,

    conversationText: COLOR_WHITE,
    conversationPrimary: COLOR_BLACK,

    barText: COLOR_WHITE,
    barPrimary: COLOR_BLACK,
    barBorderPrimary: COLOR_GRAY_800,

    messagesPadding: '10px',

    messageDividerPrimary: 'transparent',
    messageSpacing: '1.25rem',
    messagePadding: '0.5rem 1rem',
    messageRounding: '0.5rem',

    userMessageText: COLOR_WHITE,
    userMessagePrimary: COLOR_INDIGO_500,
    userMessageLinkPrimary: COLOR_WHITE,
    userMessageLinkSecondary: COLOR_WHITE,

    botMessageText: COLOR_WHITE,
    botMessagePrimary: COLOR_GRAY_900,
    botMessageLinkPrimary: COLOR_WHITE,
    botMessageLinkSecondary: COLOR_WHITE,
    botMessageButtonText: COLOR_WHITE,
    botMessageButtonPrimary: COLOR_BLACK,

    actionsPadding: '10px',

    inputText: COLOR_WHITE,
    inputPrimary: COLOR_BLACK,
    inputSecondary: COLOR_BLACK,
    inputBorderPrimary: COLOR_GRAY_800,
    inputBorderSecondary: COLOR_GRAY_300,

    tapText: COLOR_WHITE,

    buttonText: COLOR_WHITE,
    buttonPrimary: COLOR_BLACK,
    buttonSecondary: COLOR_BLACK,
    buttonBorderPrimary: COLOR_GRAY_600,
    buttonBorderSecondary: COLOR_WHITE,

    messageStyle: 'bubble',
  },

  modern: {
    version: 'v2',

    fontSize: '0.875rem',
    lineHeight: '1.55rem',

    previewPrimary: COLOR_GRAY_50,
    framePrimary: COLOR_GRAY_50,

    popupBorderPrimary: COLOR_INDIGO_500,

    conversationText: COLOR_GRAY_900,
    conversationPrimary: COLOR_WHITE,

    barText: COLOR_GRAY_900,
    barPrimary: COLOR_WHITE,
    barBorderPrimary: COLOR_GRAY_100,

    messagesPadding: '0.5rem',

    messageSpacing: '1rem',
    messagePadding: '0.5rem 1rem',

    userMessageText: COLOR_BLACK,
    userMessagePrimary: COLOR_GRAY_100,
    userMessageLinkPrimary: COLOR_INDIGO_500,
    userMessageLinkSecondary: COLOR_INDIGO_600,
    userMessageRounding: '1rem 0rem 1rem 1rem',

    botMessageText: COLOR_WHITE,
    botMessagePrimary: COLOR_INDIGO_500,
    botMessageLinkPrimary: COLOR_WHITE,
    botMessageLinkSecondary: COLOR_WHITE,
    botMessageRounding: '0rem 1rem 1rem 1rem',

    actionsPadding: '10px',

    inputText: COLOR_GRAY_900,
    inputPrimary: COLOR_WHITE,
    inputSecondary: COLOR_WHITE,
    inputBorderPrimary: COLOR_GRAY_300,
    inputBorderSecondary: COLOR_INDIGO_500,

    tapText: COLOR_INDIGO_500,

    buttonText: COLOR_WHITE,
    buttonPrimary: COLOR_INDIGO_500,
    buttonSecondary: COLOR_INDIGO_600,

    messageStyle: 'bubble',
  },

  stack: {
    version: 'v2',

    fontSize: '1rem',
    lineHeight: '1.75rem',

    previewPrimary: COLOR_GRAY_50,
    framePrimary: COLOR_GRAY_50,

    popupBorderPrimary: COLOR_INDIGO_500,

    conversationText: COLOR_GRAY_900,
    conversationPrimary: COLOR_WHITE,

    barText: COLOR_GRAY_900,
    barPrimary: COLOR_WHITE,
    barBorderPrimary: COLOR_GRAY_100,

    messagesPadding: '0px',

    messageDividerSize: '1px',
    messageSpacing: '0px',
    messagePadding: '20px',
    messageRounding: '0px',

    userMessageText: COLOR_BLACK,
    userMessagePrimary: COLOR_GRAY_100,
    userMessageLinkPrimary: COLOR_INDIGO_500,
    userMessageLinkSecondary: COLOR_INDIGO_600,
    userMessageIconSize: '25px',

    botMessageText: COLOR_WHITE,
    botMessagePrimary: COLOR_INDIGO_500,
    botMessageLinkPrimary: COLOR_WHITE,
    botMessageLinkSecondary: COLOR_WHITE,
    botMessageIconSize: '25px',

    actionsPadding: '10px',

    inputText: COLOR_GRAY_900,
    inputPrimary: COLOR_WHITE,
    inputSecondary: COLOR_WHITE,
    inputBorderPrimary: COLOR_GRAY_300,
    inputBorderSecondary: COLOR_INDIGO_500,

    buttonText: COLOR_WHITE,
    buttonPrimary: COLOR_INDIGO_500,
    buttonSecondary: COLOR_INDIGO_600,

    messageStyle: 'stack',
  },
})

export const availableThemes: ReadonlyArray<keyof Themes> = Object.freeze(
  Object.keys(themes) as Array<keyof Themes>
)

export const defaultTheme: keyof Themes = availableThemes[0]

export function encodePart(input: string): string {
  return input?.toString().replace(/\//g, '%2F').replace(/=/g, '%3D')
}

export function decodePart(input: string): string {
  return input?.toString().replace(/%2F/gi, '/').replace(/%3D/gi, '=')
}

interface ParseThemeResult {
  name: string
  config: ThemeConfig
}

export function parseTheme(
  theme: string = defaultTheme,
  _themes: Readonly<Record<string, ThemeConfig>> = themes
): ParseThemeResult {
  const { name, config } = parse(theme, defaultTheme)

  // @todo do theme config checks here based on schema

  return {
    name,
    config: {
      ..._themes[name],
      ...config,
    },
  }
}

export function buildTheme(
  name: string,
  config: ThemeConfig,
  _themes: Readonly<Record<string, ThemeConfig>> = themes
): string {
  // @todo do theme config checks here based on schema

  const details = build(name, config, _themes[name])

  return details
}
