import yaml from '@/lib/yaml'

import { repair, tryRepair } from './json.repair'

jest.mock('@/lib/yaml', () => ({
  __esModule: true,
  default: {
    parse: jest.fn(),
  },
}))

const mockYaml = yaml

describe('json.repair', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('repair', () => {
    describe('basic functionality', () => {
      it('should repair valid JSON', () => {
        const validJson = '{"name":"test","value":123}'

        mockYaml.parse.mockReturnValue({ name: 'test', value: 123 })

        const result = repair(validJson)

        expect(result).toBe('{"name":"test","value":123}')
      })

      it('should handle YAML-parseable input', () => {
        const yamlInput = 'name: test\nvalue: 123'

        mockYaml.parse.mockReturnValue({ name: 'test', value: 123 })

        const result = repair(yamlInput)

        expect(result).toBe('{"name":"test","value":123}')
      })

      it('should repair JSON with trailing commas', () => {
        const brokenJson = '{"name":"test","value":123,}'

        mockYaml.parse.mockImplementation(() => {
          throw new Error('YAML parse failed')
        })

        const result = repair(brokenJson)
        const parsed = JSON.parse(result)

        expect(parsed).toEqual({ name: 'test', value: 123 })
      })

      it('should repair JSON with missing quotes', () => {
        const brokenJson = '{name:"test",value:123}'

        mockYaml.parse.mockImplementation(() => {
          throw new Error('YAML parse failed')
        })

        const result = repair(brokenJson)
        const parsed = JSON.parse(result)

        expect(parsed).toEqual({ name: 'test', value: 123 })
      })

      it('should return single line JSON string', () => {
        const multilineInput = '{\n  "name": "test",\n  "value": 123\n}'

        mockYaml.parse.mockReturnValue({ name: 'test', value: 123 })

        const result = repair(multilineInput)

        expect(result).not.toContain('\n')
        expect(result).toBe('{"name":"test","value":123}')
      })
    })

    describe('edge cases', () => {
      it('should handle empty object', () => {
        mockYaml.parse.mockReturnValue({})

        const result = repair('{}')

        expect(result).toBe('{}')
      })

      it('should handle empty array', () => {
        mockYaml.parse.mockReturnValue([])

        const result = repair('[]')

        expect(result).toBe('[]')
      })

      it('should handle nested objects', () => {
        const nested = { a: { b: { c: 'value' } } }

        mockYaml.parse.mockReturnValue(nested)

        const result = repair('{"a":{"b":{"c":"value"}}}')

        expect(JSON.parse(result)).toEqual(nested)
      })

      it('should handle arrays with objects', () => {
        const arrayData = [{ id: 1 }, { id: 2 }, { id: 3 }]

        mockYaml.parse.mockReturnValue(arrayData)

        const result = repair('[{"id":1},{"id":2},{"id":3}]')

        expect(JSON.parse(result)).toEqual(arrayData)
      })

      it('should handle special characters in strings', () => {
        const special = { text: 'Hello "world" with \'quotes\' and \nnewlines' }

        mockYaml.parse.mockReturnValue(special)

        const result = repair(JSON.stringify(special))

        expect(JSON.parse(result)).toEqual(special)
      })

      it('should handle unicode characters', () => {
        const unicode = { emoji: '😀🎉', chinese: '你好', arabic: 'مرحبا' }

        mockYaml.parse.mockReturnValue(unicode)

        const result = repair(JSON.stringify(unicode))

        expect(JSON.parse(result)).toEqual(unicode)
      })
    })

    describe('error handling', () => {
      it('should throw when JSON cannot be repaired', () => {
        mockYaml.parse.mockImplementation(() => {
          throw new Error('YAML parse failed')
        })

        const invalidJson = 'this is not json at all {{{'

        expect(() => repair(invalidJson)).toThrow()
      })

      it('should throw when input is completely invalid', () => {
        mockYaml.parse.mockImplementation(() => {
          throw new Error('YAML parse failed')
        })

        expect(() => repair('{{{')).toThrow()
      })

      it('should throw when jsonrepair cannot fix input', () => {
        mockYaml.parse.mockImplementation(() => {
          throw new Error('YAML parse failed')
        })

        // jsonrepair might still fix some invalid inputs, test truly invalid
        expect(() => repair('this is not json at all {{{')).toThrow()
      })
    })

    describe('fallback behavior', () => {
      it('should use jsonrepair when YAML parsing fails', () => {
        mockYaml.parse.mockImplementation(() => {
          throw new Error('YAML parse failed')
        })

        const brokenJson = '{"name":"test","value":123,}'
        const result = repair(brokenJson)

        expect(JSON.parse(result)).toEqual({ name: 'test', value: 123 })
      })

      it('should prefer YAML parse over jsonrepair', () => {
        const yamlData = { fromYaml: true }

        mockYaml.parse.mockReturnValue(yamlData)

        const result = repair('{"fromYaml":false}')

        expect(JSON.parse(result)).toEqual({ fromYaml: true })
        expect(mockYaml.parse).toHaveBeenCalled()
      })
    })
  })

  describe('tryRepair', () => {
    describe('basic functionality', () => {
      it('should return repaired JSON on success', () => {
        mockYaml.parse.mockReturnValue({ name: 'test' })

        const result = tryRepair('{"name":"test"}')

        expect(result).toBe('{"name":"test"}')
      })

      it('should convert non-string input to string', () => {
        mockYaml.parse.mockReturnValue(123)

        const result = tryRepair(123)

        expect(result).toBe('123')
      })

      it('should handle object input by converting to string', () => {
        const obj = { key: 'value' }

        mockYaml.parse.mockReturnValue(obj)

        const result = tryRepair(obj)

        expect(result).not.toBeNull()
      })
    })

    describe('edge cases', () => {
      it('should handle null input by converting to string', () => {
        mockYaml.parse.mockReturnValue(null)

        const result = tryRepair(null)

        expect(result).toBe('null')
      })

      it('should handle undefined input by converting to string', () => {
        mockYaml.parse.mockReturnValue(null)

        const result = tryRepair(undefined)

        expect(result).toBe('null')
      })

      it('should handle empty string', () => {
        mockYaml.parse.mockImplementation(() => {
          throw new Error('Failed')
        })

        const result = tryRepair('')

        expect(result).toBeNull()
      })

      it('should handle boolean input', () => {
        mockYaml.parse.mockReturnValue(true)

        const result = tryRepair(true)

        expect(result).toBe('true')
      })

      it('should handle number input', () => {
        mockYaml.parse.mockReturnValue(42)

        const result = tryRepair(42)

        expect(result).toBe('42')
      })
    })

    describe('error handling', () => {
      it('should return null on repair failure', () => {
        mockYaml.parse.mockImplementation(() => {
          throw new Error('YAML parse failed')
        })

        const result = tryRepair('invalid json {{')

        expect(result).toBeNull()
      })

      it('should not throw errors', () => {
        mockYaml.parse.mockImplementation(() => {
          throw new Error('YAML parse failed')
        })

        expect(() => tryRepair('completely invalid')).not.toThrow()
      })

      it('should handle plain text by stringifying', () => {
        mockYaml.parse.mockReturnValue('not json')

        const result = tryRepair('not json')

        expect(result).toBe('"not json"')
      })
    })

    describe('success scenarios', () => {
      it('should handle valid JSON gracefully', () => {
        const validData = { test: 'value', number: 123 }

        mockYaml.parse.mockReturnValue(validData)

        const result = tryRepair(JSON.stringify(validData))

        expect(result).not.toBeNull()
        expect(JSON.parse(result)).toEqual(validData)
      })

      it('should repair broken JSON successfully', () => {
        mockYaml.parse.mockImplementation(() => {
          throw new Error('YAML parse failed')
        })

        const result = tryRepair('{"key":"value",}')

        expect(result).not.toBeNull()

        if (result) {
          expect(JSON.parse(result)).toEqual({ key: 'value' })
        }
      })
    })
  })
})
