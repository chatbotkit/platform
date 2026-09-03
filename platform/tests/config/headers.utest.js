import * as headerConfig from '@/config/headers'

const canonicalInternalHeaders = Object.entries(headerConfig).filter(([name]) =>
  /^CHATBOTKIT_INTERNAL_.*_HEADER_NAME$/.test(name)
)

describe('header config', () => {
  it('should declare canonical internal header names', () => {
    expect(canonicalInternalHeaders.length).toBeGreaterThan(0)
  })

  it.each(canonicalInternalHeaders)(
    '%s should remain outside the authenticated assertion wire namespace',
    (_name, value) => {
      expect(
        value.startsWith(headerConfig.CHATBOTKIT_ASSERTION_HEADER_PREFIX)
      ).toBe(false)
    }
  )
})
