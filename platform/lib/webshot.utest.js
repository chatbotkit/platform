// @note this suite used to assert the whole query string the capture service
// understands - the parameter renames, the block and metadata shorthands, the
// canonical form the signature is computed over, and where the access key is
// allowed to travel. All of that moved into whichever page capture module is
// installed, along with its own tests.
//
// What is left is the platform's half, which is only that these three names
// delegate to the contract. Repeating the construction through this seam would
// be testing the module twice, and this file is where it would silently drift
// out of date first.

import { makeScreenshot, makeScreenshotRequest, readScreenshotMetadata } from '@/lib/webshot'

const provider = {
  publicUrl: jest.fn(),
  request: jest.fn(),
  readMetadata: jest.fn(),
}

jest.mock('@chatbotkit-dev/screenshot', () => ({
  __esModule: true,

  default: {
    publicUrl: (...args) => provider.publicUrl(...args),
    request: (...args) => provider.request(...args),
    readMetadata: (...args) => provider.readMetadata(...args),
  },
}))

beforeEach(() => {
  jest.clearAllMocks()
})

describe('makeScreenshot', () => {
  it('asks for an address a browser can be handed', () => {
    provider.publicUrl.mockReturnValue('https://capture.test/take?url=x')

    const options = { fullPage: true }

    expect(makeScreenshot('https://example.com', options)).toBe(
      'https://capture.test/take?url=x'
    )

    expect(provider.publicUrl).toHaveBeenCalledWith(
      'https://example.com',
      options
    )
  })
})

describe('makeScreenshotRequest', () => {
  // @note the two are different methods on the contract precisely because a URL
  // that goes through a browser must carry no credential and one the server
  // fetches must - see the note at the top of the contract
  it('asks for a request rather than an address', () => {
    provider.request.mockReturnValue({
      url: 'https://capture.test/take?url=x',
      headers: { Authorization: 'Bearer key' },
    })

    const result = makeScreenshotRequest('https://example.com')

    expect(result.headers.Authorization).toBe('Bearer key')
    expect(provider.request).toHaveBeenCalledWith(
      'https://example.com',
      undefined
    )
  })
})

describe('readScreenshotMetadata', () => {
  it('hands the response headers to the module', () => {
    const metadata = {
      title: 'Hello',
      icon: null,
      fonts: null,
      openGraph: null,
    }

    provider.readMetadata.mockReturnValue(metadata)

    const headers = new Headers()

    expect(readScreenshotMetadata(headers)).toBe(metadata)
    expect(provider.readMetadata).toHaveBeenCalledWith(headers)
  })
})
