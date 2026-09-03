jest.mock('@/prisma/client', () => ({}))

jest.mock('@/lib/session.get', () => ({ getSoftSession: jest.fn() }))
jest.mock('@/lib/struct', () => ({ makeJsonSafe: jest.fn((value) => value) }))

jest.mock('@/layouts/Wizard', () => ({
  __esModule: true,
  default: () => null,
  useWizard: jest.fn(),
  Heading: () => null,
  NavigationButtons: () => null,
}))

jest.mock('@/components/Emoji', () => () => null)

jest.mock('@/hooks/useRouter', () => jest.fn())

jest.mock('@/templates/index', () => ({ templates: {} }))

import { getSafeReturnPath } from '@/pages/new'

describe('getSafeReturnPath', () => {
  it('keeps local paths and their query strings', () => {
    expect(getSafeReturnPath('/bots?view=all#top')).toBe('/bots?view=all#top')
  })

  it('rejects absolute and backslash-normalized external URLs', () => {
    expect(getSafeReturnPath('//example.com')).toBe('/overview')
    expect(getSafeReturnPath('/\\example.com')).toBe('/overview')
    expect(getSafeReturnPath('https://example.com')).toBe('/overview')
  })
})
