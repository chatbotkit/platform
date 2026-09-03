import { assertConfigured, publicUrl, readMetadata, request } from './index'

describe('publicUrl and request', () => {
  it.each([
    ['publicUrl', () => publicUrl('https://example.com')],
    ['request', () => request('https://example.com')],
  ])('%s refuses with NOT_CONFIGURED', (_name, call) => {
    expect(call).toThrow(
      expect.objectContaining({ screenshot: true, code: 'NOT_CONFIGURED' })
    )
  })

  it('names the contract rather than a package to install', () => {
    let error

    try {
      publicUrl('https://example.com')
    } catch (thrown) {
      error = thrown
    }

    expect(error.message).toMatch(
      /@chatbotkit-dev\/screenshot.*ScreenshotProvider.*@chatbotkit-dev\/screenshot-spec/
    )
  })

  it('says which page it could not capture', () => {
    expect(() => request('https://example.com')).toThrow(
      expect.objectContaining({
        detail: expect.stringContaining('https://example.com'),
      })
    )
  })
})

describe('readMetadata', () => {
  // @note the one method that answers rather than refusing. A caller that has a
  // response in hand should not have to guard a method that cannot fail.
  it('reports nothing rather than throwing', () => {
    expect(readMetadata(new Headers())).toEqual({
      title: null,
      icon: null,
      fonts: null,
      openGraph: null,
    })
  })
})

describe('assertConfigured', () => {
  it('fails the deployment readiness check', async () => {
    await expect(assertConfigured()).rejects.toThrow(/ScreenshotProvider/)
  })
})
