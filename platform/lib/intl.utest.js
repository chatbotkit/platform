import { getTranslationMap } from '@/lib/intl'

const { hasLanguageModelsByProvider } = jest.requireActual('@/lib/model.utils')

const describeIfConfigured = hasLanguageModelsByProvider('openai')
  ? describe
  : describe.skip

jest.retryTimes(3)

describeIfConfigured('getTranslationMap', () => {
  it('should be able to get a translation map', async () => {
    const response = await getTranslationMap(['french', 'spanish', 'german'], {
      hello: 'Hello!',
      name: 'What is your name?',
    })

    expect(Object.keys(response).length).toBe(3)
    expect(response).toHaveProperty('fr')
    expect(response).toHaveProperty('es')
    expect(response).toHaveProperty('de')
  })

  it('should be able to preserve markdown syntax', async () => {
    const response = await getTranslationMap(['french', 'spanish', 'german'], {
      hello: 'Hello!',
      name: 'What is your name?',
      description:
        'This is **bold** and this is *italic*. This is a link [link](https://chatbotkit.com). This is a button [Button text]().',
    })

    Object.entries(response).forEach(([, value]) => {
      expect(value.description).toMatch(/\*\*.+?\*\*/)
      expect(value.description).toMatch(/\*.+?\*/)
      expect(value.description).toMatch(/\[.+\]\(https:\/\/chatbotkit\.com\)/)
      expect(value.description).toMatch(/\[.+?\]\(\)/)
    })
  })

  it('should be able to preserve placeholders', async () => {
    const response = await getTranslationMap(['french', 'spanish', 'german'], {
      hello: 'Hello, {{name}}!',
      name: 'What is your name?',
    })

    Object.entries(response).forEach(([, value]) => {
      expect(value.hello).toMatch(/{{name}}/)
    })
  })
})
