import { resolveTwilioFromNumber } from './twilio'

describe('resolveTwilioFromNumber', () => {
  it('keeps the requested number when it matches an available number', () => {
    const result = resolveTwilioFromNumber({
      from: '+12025551234',
      availableNumbers: ['+12025551234', '+14155552671'],
    })

    expect(result).toBe('+12025551234')
  })

  it('falls back to the only available number when the requested one does not match', () => {
    // @note prevents acting on a hallucinated "from" when there is a single
    // number we can safely default to
    const result = resolveTwilioFromNumber({
      from: '+19998887777',
      availableNumbers: ['+12025551234'],
    })

    expect(result).toBe('+12025551234')
  })

  it('uses the single available number even when the requested one matches it', () => {
    const result = resolveTwilioFromNumber({
      from: '+12025551234',
      availableNumbers: ['+12025551234'],
    })

    expect(result).toBe('+12025551234')
  })

  it('throws and lists the options when the requested number is not among several', () => {
    expect(() =>
      resolveTwilioFromNumber({
        from: '+19998887777',
        availableNumbers: ['+12025551234', '+14155552671'],
      })
    ).toThrow(
      'The "from" number +19998887777 is not one of the available Twilio phone numbers: +12025551234, +14155552671'
    )
  })

  it('throws when no numbers are available', () => {
    expect(() =>
      resolveTwilioFromNumber({
        from: '+12025551234',
        availableNumbers: [],
      })
    ).toThrow('No Twilio phone numbers are available on this integration')
  })

  it('normalizes available numbers before comparing', () => {
    // @note Twilio returns E.164, but be resilient to loosely formatted values
    const result = resolveTwilioFromNumber({
      from: '+12025551234',
      availableNumbers: ['(202) 555-1234'],
    })

    expect(result).toBe('+12025551234')
  })

  it('drops unparseable available numbers', () => {
    expect(() =>
      resolveTwilioFromNumber({
        from: '+12025551234',
        availableNumbers: ['not-a-number'],
      })
    ).toThrow('No Twilio phone numbers are available on this integration')
  })
})
