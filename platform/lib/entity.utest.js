import {
  redactEntities,
  simplifyEntities,
  unredactEntities,
} from '@/lib/entity'

describe('Entity utility functions', () => {
  describe('redactEntities', () => {
    describe('basic redaction', () => {
      it('should redact a single entity', () => {
        const text = 'My email is john@example.com'
        const entities = {
          'john@example.com': '[EMAIL]',
        }

        const [output, ...steps] = redactEntities(text, entities)

        expect(output).toBe('My email is [EMAIL]')
        expect(steps).toHaveLength(1)
        expect(steps[0]).toHaveProperty('begin')
        expect(steps[0]).toHaveProperty('end')
      })

      it('should redact multiple entities', () => {
        const text = 'Contact John at john@example.com or call 555-1234'
        const entities = {
          'john@example.com': '[EMAIL]',
          '555-1234': '[PHONE]',
        }

        const [output, ...steps] = redactEntities(text, entities)

        expect(output).toContain('[EMAIL]')
        expect(output).toContain('[PHONE]')
        expect(steps).toHaveLength(2)
      })

      it('should preserve surrounding text', () => {
        const text = 'Before john@example.com After'
        const entities = {
          'john@example.com': '[EMAIL]',
        }

        const [output] = redactEntities(text, entities)

        expect(output).toBe('Before [EMAIL] After')
      })
    })

    describe('coordinate tracking', () => {
      it('should return coordinate steps for replacements', () => {
        const text = 'Email: john@example.com'
        const entities = {
          'john@example.com': '[EMAIL]',
        }

        const [, ...steps] = redactEntities(text, entities)

        expect(steps).toHaveLength(1)
        expect(steps[0]).toHaveProperty('begin')
        expect(steps[0]).toHaveProperty('end')
        expect(typeof steps[0].begin).toBe('number')
        expect(typeof steps[0].end).toBe('number')
      })

      it('should track multiple replacement coordinates', () => {
        const text = 'Email john@example.com Phone 555-1234'
        const entities = {
          'john@example.com': '[EMAIL]',
          '555-1234': '[PHONE]',
        }

        const [, ...steps] = redactEntities(text, entities)

        expect(steps).toHaveLength(2)
        steps.forEach((step) => {
          expect(step).toHaveProperty('begin')
          expect(step).toHaveProperty('end')
        })
      })
    })

    describe('edge cases', () => {
      it('should handle empty text', () => {
        const text = ''
        const entities = {
          test: '[TEST]',
        }

        const [output, ...steps] = redactEntities(text, entities)

        expect(output).toBe('')
        expect(steps).toHaveLength(0)
      })

      it('should handle empty entities object', () => {
        const text = 'Some text here'
        const entities = {}

        const [output, ...steps] = redactEntities(text, entities)

        expect(output).toBe('Some text here')
        expect(steps).toHaveLength(0)
      })

      it('should handle entity not found in text', () => {
        const text = 'Some text here'
        const entities = {
          notfound: '[REDACTED]',
        }

        const [output, ...steps] = redactEntities(text, entities)

        expect(output).toBe('Some text here')
        expect(steps).toHaveLength(0)
      })

      it('should handle special characters in entities', () => {
        const text = 'Price is $100.00'
        const entities = {
          '$100.00': '[PRICE]',
        }

        const [output] = redactEntities(text, entities)

        expect(output).toContain('[PRICE]')
      })

      it('should handle multiple occurrences of same entity', () => {
        const text = 'Email john@example.com and john@example.com again'
        const entities = {
          'john@example.com': '[EMAIL]',
        }

        const [output] = redactEntities(text, entities)

        expect(output).toBe('Email [EMAIL] and [EMAIL] again')
      })
    })

    describe('complex scenarios', () => {
      it('should handle overlapping positions correctly', () => {
        const text = 'abc def ghi'
        const entities = {
          abc: '[A]',
          def: '[D]',
          ghi: '[G]',
        }

        const [output, ...steps] = redactEntities(text, entities)

        expect(output).toBe('[A] [D] [G]')
        expect(steps).toHaveLength(3)
      })

      it('should handle adjacent entities', () => {
        const text = 'firstsecond'
        const entities = {
          first: '[1]',
          second: '[2]',
        }

        const [output] = redactEntities(text, entities)

        expect(output).toBe('[1][2]')
      })

      it('should handle very long replacement text', () => {
        const text = 'Short'
        const entities = {
          Short: '[VERY_LONG_REPLACEMENT_TEXT_HERE]',
        }

        const [output] = redactEntities(text, entities)

        expect(output).toBe('[VERY_LONG_REPLACEMENT_TEXT_HERE]')
      })
    })
  })

  describe('unredactEntities', () => {
    describe('basic unredaction', () => {
      it('should restore a single entity', () => {
        const text = 'My email is [EMAIL]'
        const entities = {
          'john@example.com': '[EMAIL]',
        }

        const result = unredactEntities(text, entities)

        expect(result).toBe('My email is john@example.com')
      })

      it('should restore multiple entities', () => {
        const text = 'Contact at [EMAIL] or [PHONE]'
        const entities = {
          'john@example.com': '[EMAIL]',
          '555-1234': '[PHONE]',
        }

        const result = unredactEntities(text, entities)

        expect(result).toBe('Contact at john@example.com or 555-1234')
      })

      it('should preserve surrounding text', () => {
        const text = 'Before [EMAIL] After'
        const entities = {
          'john@example.com': '[EMAIL]',
        }

        const result = unredactEntities(text, entities)

        expect(result).toBe('Before john@example.com After')
      })
    })

    describe('multiple occurrences', () => {
      it('should replace all occurrences of redacted entity', () => {
        const text = 'Email [EMAIL] and [EMAIL] again'
        const entities = {
          'john@example.com': '[EMAIL]',
        }

        const result = unredactEntities(text, entities)

        expect(result).toBe('Email john@example.com and john@example.com again')
      })

      it('should handle multiple different redacted entities', () => {
        const text = 'Use [EMAIL] or [PHONE] to contact'
        const entities = {
          'john@example.com': '[EMAIL]',
          '555-1234': '[PHONE]',
        }

        const result = unredactEntities(text, entities)

        expect(result).toBe('Use john@example.com or 555-1234 to contact')
      })
    })

    describe('edge cases', () => {
      it('should handle empty text', () => {
        const text = ''
        const entities = {
          test: '[TEST]',
        }

        const result = unredactEntities(text, entities)

        expect(result).toBe('')
      })

      it('should handle empty entities object', () => {
        const text = 'Some [REDACTED] text'
        const entities = {}

        const result = unredactEntities(text, entities)

        expect(result).toBe('Some [REDACTED] text')
      })

      it('should handle entity not found in text', () => {
        const text = 'Some text here'
        const entities = {
          original: '[NOTFOUND]',
        }

        const result = unredactEntities(text, entities)

        expect(result).toBe('Some text here')
      })

      it('should handle special characters in replacement', () => {
        const text = 'Price is [PRICE]'
        const entities = {
          '$100.00': '[PRICE]',
        }

        const result = unredactEntities(text, entities)

        expect(result).toBe('Price is $100.00')
      })
    })

    describe('round-trip consistency', () => {
      it('should restore text after redaction', () => {
        const originalText = 'Email john@example.com Phone 555-1234'
        const entities = {
          'john@example.com': '[EMAIL]',
          '555-1234': '[PHONE]',
        }

        const [redacted] = redactEntities(originalText, entities)
        const restored = unredactEntities(redacted, entities)

        expect(restored).toBe(originalText)
      })

      it('should handle complex multi-entity round-trip', () => {
        const originalText =
          'User john@example.com with SSN 123-45-6789 and phone 555-1234'
        const entities = {
          'john@example.com': '[EMAIL]',
          '123-45-6789': '[SSN]',
          '555-1234': '[PHONE]',
        }

        const [redacted] = redactEntities(originalText, entities)
        const restored = unredactEntities(redacted, entities)

        expect(restored).toBe(originalText)
      })
    })
  })

  describe('simplifyEntities', () => {
    describe('basic simplification', () => {
      it('should simplify entity with text and replacement', () => {
        const entities = [
          {
            text: 'john@example.com',
            replacement: { text: '[EMAIL]' },
          },
        ]

        const result = simplifyEntities(entities)

        expect(result).toEqual({
          'john@example.com': '[EMAIL]',
        })
      })

      it('should simplify multiple entities', () => {
        const entities = [
          {
            text: 'john@example.com',
            replacement: { text: '[EMAIL]' },
          },
          {
            text: '555-1234',
            replacement: { text: '[PHONE]' },
          },
        ]

        const result = simplifyEntities(entities)

        expect(result).toEqual({
          'john@example.com': '[EMAIL]',
          '555-1234': '[PHONE]',
        })
      })
    })

    describe('complex entities', () => {
      it('should extract text from nested replacement object', () => {
        const entities = [
          {
            text: 'original',
            replacement: { text: 'simplified', extra: 'ignored' },
          },
        ]

        const result = simplifyEntities(entities)

        expect(result).toEqual({
          original: 'simplified',
        })
      })

      it('should handle entities with special characters', () => {
        const entities = [
          {
            text: '$100.00',
            replacement: { text: '[PRICE]' },
          },
          {
            text: 'john@example.com',
            replacement: { text: '[EMAIL]' },
          },
        ]

        const result = simplifyEntities(entities)

        expect(result).toEqual({
          '$100.00': '[PRICE]',
          'john@example.com': '[EMAIL]',
        })
      })
    })

    describe('edge cases', () => {
      it('should handle empty array', () => {
        const entities = []

        const result = simplifyEntities(entities)

        expect(result).toEqual({})
      })

      it('should handle entities with empty strings', () => {
        const entities = [
          {
            text: '',
            replacement: { text: '' },
          },
        ]

        const result = simplifyEntities(entities)

        expect(result).toEqual({
          '': '',
        })
      })

      it('should handle duplicate text values', () => {
        const entities = [
          {
            text: 'duplicate',
            replacement: { text: '[FIRST]' },
          },
          {
            text: 'duplicate',
            replacement: { text: '[SECOND]' },
          },
        ]

        const result = simplifyEntities(entities)

        // last one wins in object assignment
        expect(result).toEqual({
          duplicate: '[SECOND]',
        })
      })
    })

    describe('integration with redaction functions', () => {
      it('should produce output compatible with redactEntities', () => {
        const complexEntities = [
          {
            text: 'john@example.com',
            replacement: { text: '[EMAIL]' },
          },
          {
            text: '555-1234',
            replacement: { text: '[PHONE]' },
          },
        ]

        const simplified = simplifyEntities(complexEntities)
        const text = 'Contact john@example.com or 555-1234'
        const [redacted] = redactEntities(text, simplified)

        expect(redacted).toBe('Contact [EMAIL] or [PHONE]')
      })

      it('should work with unredactEntities after simplification', () => {
        const complexEntities = [
          {
            text: 'secret',
            replacement: { text: '[REDACTED]' },
          },
        ]

        const simplified = simplifyEntities(complexEntities)
        const text = 'The [REDACTED] information'
        const restored = unredactEntities(text, simplified)

        expect(restored).toBe('The secret information')
      })
    })
  })

  describe('integration scenarios', () => {
    it('should handle complete workflow: simplify -> redact -> unredact', () => {
      const complexEntities = [
        {
          text: 'john@example.com',
          replacement: { text: '[EMAIL]' },
        },
        {
          text: '123-45-6789',
          replacement: { text: '[SSN]' },
        },
      ]

      const simplified = simplifyEntities(complexEntities)
      const originalText = 'User john@example.com SSN 123-45-6789'

      const [redacted] = redactEntities(originalText, simplified)

      expect(redacted).toBe('User [EMAIL] SSN [SSN]')

      const restored = unredactEntities(redacted, simplified)

      expect(restored).toBe(originalText)
    })

    it('should handle entities with varying lengths', () => {
      const entities = {
        a: '[VERY_LONG_REPLACEMENT]',
        very_long_original: '[X]',
      }

      const text = 'Test a and very_long_original here'
      const [redacted] = redactEntities(text, entities)
      const restored = unredactEntities(redacted, entities)

      expect(restored).toBe(text)
    })
  })
})
