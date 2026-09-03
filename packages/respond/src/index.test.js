import { assertConfigured, urlFor } from './index'

// @note the temptation this default resists is a `data:` URL, which would look
// like a working answer and fail at whichever third party was handed it. These
// cases pin the refusal so that nobody re-adds the plausible version.

const document = { body: '<Response/>', contentType: 'text/xml' }

describe('urlFor', () => {
  it('refuses with NOT_CONFIGURED', () => {
    expect(() => urlFor(document)).toThrow(
      expect.objectContaining({ respond: true, code: 'NOT_CONFIGURED' })
    )
  })

  it('does not return a data URL that a remote fetch could not use', () => {
    let result

    try {
      result = urlFor(document)
    } catch {
      result = undefined
    }

    expect(result).toBeUndefined()
  })

  it('names the contract rather than a package to install', () => {
    let error

    try {
      urlFor(document)
    } catch (thrown) {
      error = thrown
    }

    expect(error.message).toMatch(
      /@chatbotkit-dev\/respond.*RespondProvider.*@chatbotkit-dev\/respond-spec/
    )
  })
})

describe('assertConfigured', () => {
  it('fails the deployment readiness check', async () => {
    await expect(assertConfigured()).rejects.toThrow(/RespondProvider/)
  })
})
