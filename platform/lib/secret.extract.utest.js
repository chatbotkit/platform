import { extractSecrets, secretVariableRegex } from '@/lib/secret.extract'

describe('secret.extract', () => {
  describe('extractSecrets', () => {
    it('should return empty array when no secrets are present', () => {
      expect(extractSecrets('hello world')).toEqual([])
      expect(extractSecrets('')).toEqual([])
    })

    it('should extract a single ${SECRET_*} placeholder', () => {
      expect(extractSecrets('token is ${SECRET_API_KEY}')).toEqual(['API_KEY'])
    })

    it('should extract a single {{SECRET_*}} placeholder', () => {
      expect(extractSecrets('token is {{SECRET_API_KEY}}')).toEqual(['API_KEY'])
    })

    it('should extract multiple secrets from mixed syntaxes', () => {
      const input =
        'a ${SECRET_DB_USER} and {{SECRET_DB_PASS}} and ${SECRET_REGION}'

      expect(extractSecrets(input)).toEqual(['DB_USER', 'DB_PASS', 'REGION'])
    })

    it('should de-duplicate secrets preserving first appearance order', () => {
      const input =
        '${SECRET_ONE} x {{SECRET_TWO}} y ${SECRET_ONE} z {{SECRET_TWO}}'

      expect(extractSecrets(input)).toEqual(['ONE', 'TWO'])
    })

    it('should extract adjacent secrets and those separated by non-letters', () => {
      const input = '${SECRET_A}_${SECRET_B}-{{SECRET_C}}.${SECRET_D}'

      expect(extractSecrets(input)).toEqual(['A', 'B', 'C', 'D'])
    })

    it('should support digits and underscores in names', () => {
      const input = 'x ${SECRET_AB12_34} y {{SECRET_Z9_9}}'

      expect(extractSecrets(input)).toEqual(['AB12_34', 'Z9_9'])
    })

    it('should ignore incomplete or invalid placeholders', () => {
      const input =
        '${SECRET_} {{SECRET_}} ${secret_lower} {{secret_lower}} ${SECRET-INVALID}'

      expect(extractSecrets(input)).toEqual([])
    })

    it('should find secrets across multiple lines', () => {
      const input = `line1 ${'${SECRET_ALPHA}'}\nline2 {{SECRET_BETA}}\nline3 ${'${SECRET_ALPHA}'}`

      expect(extractSecrets(input)).toEqual(['ALPHA', 'BETA'])
    })

    it('should not match lowercase "secret_" prefix (case-sensitive)', () => {
      const input = '${secret_ALPHA} and {{secret_BETA}}'

      expect(extractSecrets(input)).toEqual([])
    })
  })

  describe('secretVariableRegex', () => {
    it('should match both ${SECRET_*} and {{SECRET_*}} forms', () => {
      const re = new RegExp(secretVariableRegex.source, 'g')

      const s = 'x ${SECRET_FOO} y {{SECRET_BAR}} z'
      const matches = Array.from(s.matchAll(re))

      expect(matches).toHaveLength(2)

      const first = matches[0]
      const second = matches[1]

      expect(first[1] || first[2]).toBe('FOO')
      expect(second[1] || second[2]).toBe('BAR')
    })
  })
})
