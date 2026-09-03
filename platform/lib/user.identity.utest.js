import {
  getChildUserIdentityEmail,
  isUserIdentityEmail,
} from '@/lib/user.identity'

describe('Child User identity', () => {
  it('uses the fixed User identity namespace', () => {
    const email = getChildUserIdentityEmail('user_123')

    expect(email).toBe('user_123@user.internal')
    expect(isUserIdentityEmail(email)).toBe(true)
  })

  it('requires a User ID', () => {
    expect(() => getChildUserIdentityEmail('')).toThrow(
      'A Child User ID is required'
    )
  })

  it('does not identify customer-facing email addresses as User identities', () => {
    expect(isUserIdentityEmail('person@example.com')).toBe(false)
    expect(isUserIdentityEmail('')).toBe(false)
  })
})
