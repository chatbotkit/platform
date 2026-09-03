import credits from 'next-auth/credits'

describe('patch', () => {
  it('must return correct value', () => {
    expect(credits.patchedBy).toBe('chatbotkit')
  })
})
