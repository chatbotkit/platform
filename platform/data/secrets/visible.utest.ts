import secrets from '@/data/secrets/visible'

describe('secrets', () => {
  it('names should not start with .', () => {
    for (const name of Object.keys(secrets)) {
      expect(name.startsWith('.')).toBe(false)
    }
  })
})
