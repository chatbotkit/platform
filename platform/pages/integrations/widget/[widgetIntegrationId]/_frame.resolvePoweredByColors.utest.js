import { POWERED_BY_MIN_CONTRAST, resolvePoweredByColors } from './frame'

describe('resolvePoweredByColors', () => {
  it('keeps a legible inherited text color and leaves the pill transparent', () => {
    // default-style theme: dark text on a white conversation surface
    const result = resolvePoweredByColors({
      conversationPrimary: '#ffffff',
      conversationText: '#111827',
    })

    expect(result).toEqual({ text: '#111827' })
    expect(result.primary).toBeUndefined()
  })

  it('honors a badge text color that has enough contrast', () => {
    const result = resolvePoweredByColors({
      conversationPrimary: '#ffffff',
      // indigo-600 on white is ~6.3:1 - comfortably above the AA floor
      messageText: '#4f46e5',
    })

    expect(result).toEqual({ text: '#4f46e5' })
  })

  it('overrides text set to the same color as the surface (hiding attack)', () => {
    const result = resolvePoweredByColors({
      conversationPrimary: '#ffffff',
      // messageText only affects the badge, so this is the clean hiding vector
      messageText: '#ffffff',
    })

    expect(result).toEqual({ text: '#000000' })
  })

  it('overrides when an opaque pill fill matches the inherited text color', () => {
    const result = resolvePoweredByColors({
      conversationPrimary: '#ffffff',
      conversationText: '#111827',
      // filled pill whose background equals the text -> would be invisible
      messagePrimary: '#111827',
    })

    // text now sits on the dark pill, so it must flip to white
    expect(result).toEqual({ text: '#ffffff' })
  })

  it('overrides near-transparent text even when nominal contrast is high', () => {
    const result = resolvePoweredByColors({
      conversationPrimary: '#ffffff',
      messageText: 'rgba(0, 0, 0, 0.05)',
    })

    expect(result).toEqual({ text: '#000000' })
  })

  it('falls back to a self-contained opaque chip when the surface is indeterminate', () => {
    const result = resolvePoweredByColors({
      conversationPrimary: 'transparent',
    })

    expect(result.primary).toBeDefined()
    expect(result.text).toBeDefined()
    // chip fill and text must not be the same color
    expect(result.primary).not.toBe(result.text)
  })

  it('defaults to a visible chip for an empty theme', () => {
    const result = resolvePoweredByColors({})

    expect(result.primary).toBeDefined()
    expect(result.text).toBeDefined()
  })

  it('respects the exported minimum contrast constant', () => {
    expect(POWERED_BY_MIN_CONTRAST).toBe(4.5)
  })
})
