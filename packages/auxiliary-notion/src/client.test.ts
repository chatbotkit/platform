import type { TrimmedNonEmptyString } from '@chatbotkit-dev/typescript-utils'

import { getClient } from './client'

describe('getClient', () => {
  it('should create a Notion client with the provided auth token', () => {
    expect(getClient('test_token' as TrimmedNonEmptyString)).toBeDefined()
  })

  it('should create a Notion client with the provided bearer token', () => {
    expect(
      getClient('Bearer test_token' as TrimmedNonEmptyString)
    ).toBeDefined()
  })

  it('should throw if no auth token is provided', () => {
    expect(() => getClient('' as TrimmedNonEmptyString)).toThrow()
  })
})
