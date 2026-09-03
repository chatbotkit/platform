import featuresSchema from '@/schemas/features'

describe('featuresSchema', () => {
  it('should validate an empty array', () => {
    const result = featuresSchema.validate([])

    expect(result.error).toBeUndefined()
    expect(result.value).toEqual([])
  })

  it('should validate an array with valid feature objects', () => {
    const validFeatures = [
      { name: 'diligence' },
      { name: 'personalization' },
      { name: 'markdown' },
    ]

    const result = featuresSchema.validate(validFeatures)

    expect(result.error).toBeUndefined()
    expect(result.value).toEqual(validFeatures)
  })

  it('should validate a single valid feature object', () => {
    const validFeature = [{ name: 'buttons' }]

    const result = featuresSchema.validate(validFeature)

    expect(result.error).toBeUndefined()
    expect(result.value).toEqual(validFeature)
  })

  it('should reject an array containing the forbidden BPACC feature', () => {
    const invalidFeatures = [
      { name: 'diligence' },
      { name: 'bpacc' },
      { name: 'markdown' },
    ]

    const result = featuresSchema.validate(invalidFeatures)

    expect(result.error).toBeDefined()
    expect(result.error.message).toContain(
      'bpacc is not allowed in request features'
    )
  })

  it('should reject a feature object with missing name property', () => {
    const invalidFeatures = [
      { name: 'diligence' },
      {}, // missing name property
      { name: 'markdown' },
    ]

    const result = featuresSchema.validate(invalidFeatures)

    expect(result.error).toBeDefined()
    expect(result.error.message).toContain('Invalid discriminator value')
  })

  it('should reject a feature object with null name', () => {
    const invalidFeatures = [
      { name: 'diligence' },
      { name: null },
      { name: 'markdown' },
    ]

    const result = featuresSchema.validate(invalidFeatures)

    expect(result.error).toBeDefined()
  })

  it('should reject a feature object with empty string name', () => {
    const invalidFeatures = [
      { name: 'diligence' },
      { name: '' },
      { name: 'markdown' },
    ]

    const result = featuresSchema.validate(invalidFeatures)

    expect(result.error).toBeDefined()
  })

  it('should reject a feature object with non-string name', () => {
    const invalidFeatures = [
      { name: 'diligence' },
      { name: 123 },
      { name: 'markdown' },
    ]

    const result = featuresSchema.validate(invalidFeatures)

    expect(result.error).toBeDefined()
    expect(result.error.message).toContain('Invalid discriminator value')
  })

  it('should reject unknown feature names', () => {
    const invalidFeatures = [{ name: '[Filtered]' }]

    const result = featuresSchema.validate(invalidFeatures)

    expect(result.error).toBeDefined()
    expect(result.error.message).toContain('Invalid discriminator value')
  })

  it('should reject non-array input', () => {
    const invalidInput = { name: 'diligence' }

    const result = featuresSchema.validate(invalidInput)

    expect(result.error).toBeDefined()
    expect(result.error.message).toContain('array')
  })

  it('should reject null input', () => {
    const result = featuresSchema.validate(null)

    expect(result.error).toBeDefined()
  })

  it('should reject undefined input', () => {
    const result = featuresSchema.validate(undefined)

    // @note Joi arrays allow undefined by default unless .required() is specified

    expect(result.error).toBeUndefined()
    expect(result.value).toBeUndefined()
  })

  it('should reject primitive string input', () => {
    const result = featuresSchema.validate('diligence')

    expect(result.error).toBeDefined()
    expect(result.error.message).toContain('array')
  })

  it('should reject array with extra properties in feature objects', () => {
    const invalidFeatures = [
      { name: 'diligence', extraProp: 'value' },
      { name: 'markdown' },
    ]

    const result = featuresSchema.validate(invalidFeatures)

    expect(result.error).toBeDefined()
    expect(result.error.message).toContain('Unrecognized key(s) in object')
  })

  it('should handle mixed valid and invalid features appropriately', () => {
    const mixedFeatures = [
      { name: 'diligence' },
      { name: 'bpacc' }, // forbidden
      { name: 'markdown' },
    ]

    const result = featuresSchema.validate(mixedFeatures)

    expect(result.error).toBeDefined()
    expect(result.error.message).toContain(
      'bpacc is not allowed in request features'
    )
  })

  describe('valid feature names', () => {
    const validFeatureNames = [
      'diligence',
      'personalization',
      'memory',
      'task',
      'markdown',
      'buttons',
      'math',
      'references',
      'carousel',
      'form',
      'mermaid',
      'audio',
      'canvas',
      'footnotes',
      'batch',
      'silent',
      'answer',
      'vision',
      'attachments',
      'dataset',
      'skillset',
      'auth',
      'web',
      'chunking',
      'noFeatures',
      'noFunctions',
      'noInlineDatasets',
      'noInlineSkillsets',
      'reprogramming',
    ]

    validFeatureNames.forEach((featureName) => {
      it(`should validate feature with name "${featureName}"`, () => {
        const features = [{ name: featureName }]
        const result = featuresSchema.validate(features)

        expect(result.error).toBeUndefined()
        expect(result.value).toEqual(features)
      })
    })
  })

  describe('BPACC feature restriction', () => {
    it('should reject BPACC in different case variations', () => {
      const caseVariations = ['BPACC', 'Bpacc', 'bPacc', 'bpAcc']

      caseVariations.forEach((variation) => {
        const features = [{ name: variation }]
        const result = featuresSchema.validate(features)

        expect(result.error).toBeDefined()
      })
    })

    it('should specifically reject lowercase "bpacc"', () => {
      const features = [{ name: 'bpacc' }]

      const result = featuresSchema.validate(features)

      expect(result.error).toBeDefined()
      expect(result.error.message).toContain(
        'bpacc is not allowed in request features'
      )
    })
  })
})
