import abilities from '@/data/abilities/visible'

describe('abilities', () => {
  it('names should not start with .', () => {
    for (const name of Object.keys(abilities)) {
      expect(name.startsWith('.')).toBe(false)
    }
  })
})
