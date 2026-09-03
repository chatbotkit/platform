/* eslint-disable @typescript-eslint/no-require-imports */
import { formToData } from '@/lib/form'

jest.mock('@/lib/yaml', () => ({
  parse: jest.fn(),
}))

describe('form utilities', () => {
  let mockForm
  let mockYamlParse
  const OriginalFormData = global.FormData

  beforeEach(() => {
    // Reset mocks

    jest.clearAllMocks()

    mockYamlParse = require('@/lib/yaml').parse

    // Create a mock form element

    mockForm = {
      tagName: 'FORM',
      querySelectorAll: jest.fn(),
    }
  })

  afterEach(() => {
    jest.clearAllMocks()

    // Restore the original FormData after each test

    global.FormData = OriginalFormData
  })

  describe('formToData', () => {
    describe('basic form data extraction', () => {
      it('should extract basic string fields from form', () => {
        const formData = new FormData()

        formData.append('name', 'John Doe')
        formData.append('email', 'john@example.com')

        mockForm.querySelectorAll = jest.fn(() => [])

        global.FormData = jest.fn(() => formData)

        const result = formToData(mockForm)

        expect(result).toEqual({
          name: 'John Doe',
          email: 'john@example.com',
        })
      })

      it('should handle form reference from child element', () => {
        const childElement = {
          tagName: 'INPUT',
          form: mockForm,
        }

        const formData = new FormData()

        formData.append('field', 'value')

        mockForm.querySelectorAll = jest.fn(() => [])
        global.FormData = jest.fn(() => formData)

        const result = formToData(childElement)

        expect(result).toEqual({ field: 'value' })
      })

      it('should return undefined if no form found', () => {
        const elementWithoutForm = {
          tagName: 'INPUT',
          form: null,
        }

        const result = formToData(elementWithoutForm)

        expect(result).toBeUndefined()
      })
    })

    describe('object fields (YAML parsing)', () => {
      it('should parse valid YAML object fields', () => {
        const mockTextarea = {
          name: 'config',
          value: 'key: value\nother: data',
        }

        const formData = new FormData()

        formData.append('config', 'key: value\nother: data')

        mockForm.querySelectorAll = jest.fn((selector) => {
          if (selector === '[data-type="object"]') {
            return [mockTextarea]
          }

          return []
        })

        global.FormData = jest.fn(() => formData)

        mockYamlParse.mockReturnValue({ key: 'value', other: 'data' })

        const result = formToData(mockForm)

        expect(result).toEqual({
          config: { key: 'value', other: 'data' },
        })
        expect(mockYamlParse).toHaveBeenCalledWith('key: value\nother: data')
      })

      it('should convert empty object field to null', () => {
        const mockTextarea = {
          name: 'config',
          value: '   ',
        }

        const formData = new FormData()

        formData.append('config', '   ')

        mockForm.querySelectorAll = jest.fn((selector) => {
          if (selector === '[data-type="object"]') {
            return [mockTextarea]
          }

          return []
        })

        global.FormData = jest.fn(() => formData)

        const result = formToData(mockForm)

        expect(result).toEqual({ config: null })
      })

      it('should return undefined if YAML parsing fails', () => {
        const mockTextarea = {
          name: 'config',
          value: 'invalid: yaml: :',
        }

        const formData = new FormData()

        formData.append('config', 'invalid: yaml: :')

        mockForm.querySelectorAll = jest.fn((selector) => {
          if (selector === '[data-type="object"]') {
            return [mockTextarea]
          }

          return []
        })

        global.FormData = jest.fn(() => formData)

        mockYamlParse.mockImplementation(() => {
          throw new Error('YAML parse error')
        })

        const result = formToData(mockForm)

        expect(result).toBeUndefined()
      })

      it('should return undefined if YAML parses to non-object', () => {
        const mockTextarea = {
          name: 'config',
          value: 'just a string',
        }

        const formData = new FormData()

        formData.append('config', 'just a string')

        mockForm.querySelectorAll = jest.fn((selector) => {
          if (selector === '[data-type="object"]') {
            return [mockTextarea]
          }

          return []
        })

        global.FormData = jest.fn(() => formData)

        mockYamlParse.mockReturnValue('not an object')

        const result = formToData(mockForm)

        expect(result).toBeUndefined()
      })
    })

    describe('boolean fields (checkboxes)', () => {
      it('should convert checked checkbox to true', () => {
        const mockCheckbox = {
          name: 'enabled',
          type: 'checkbox',
        }

        const formData = new FormData()

        formData.append('enabled', 'on')

        mockForm.querySelectorAll = jest.fn((selector) => {
          if (selector === 'input[type="checkbox"]:not([data-type])') {
            return [mockCheckbox]
          }

          return []
        })

        global.FormData = jest.fn(() => formData)

        const result = formToData(mockForm)

        expect(result).toEqual({ enabled: true })
      })

      it('should convert unchecked checkbox to false', () => {
        const mockCheckbox = {
          name: 'enabled',
          type: 'checkbox',
        }

        const formData = new FormData()

        // Unchecked checkboxes don't send data, but formData might have empty value
        formData.append('enabled', '')

        mockForm.querySelectorAll = jest.fn((selector) => {
          if (selector === 'input[type="checkbox"]:not([data-type])') {
            return [mockCheckbox]
          }

          return []
        })

        global.FormData = jest.fn(() => formData)

        const result = formToData(mockForm)

        expect(result).toEqual({ enabled: false })
      })

      it('should handle multiple checkboxes', () => {
        const mockCheckbox1 = { name: 'option1', type: 'checkbox' }
        const mockCheckbox2 = { name: 'option2', type: 'checkbox' }

        const formData = new FormData()

        formData.append('option1', 'on')
        formData.append('option2', '')

        mockForm.querySelectorAll = jest.fn((selector) => {
          if (selector === 'input[type="checkbox"]:not([data-type])') {
            return [mockCheckbox1, mockCheckbox2]
          }

          return []
        })

        global.FormData = jest.fn(() => formData)

        const result = formToData(mockForm)

        expect(result).toEqual({
          option1: true,
          option2: false,
        })
      })
    })

    describe('number fields', () => {
      it('should parse valid number field', () => {
        const mockNumberInput = {
          name: 'age',
          type: 'number',
        }

        const formData = new FormData()

        formData.append('age', '25')

        mockForm.querySelectorAll = jest.fn((selector) => {
          if (selector === 'input[type="number"]:not([data-type])') {
            return [mockNumberInput]
          }

          return []
        })

        global.FormData = jest.fn(() => formData)

        const result = formToData(mockForm)

        expect(result).toEqual({ age: 25 })
      })

      it('should delete empty number field', () => {
        const mockNumberInput = {
          name: 'age',
          type: 'number',
        }

        const formData = new FormData()

        formData.append('age', '')

        mockForm.querySelectorAll = jest.fn((selector) => {
          if (selector === 'input[type="number"]:not([data-type])') {
            return [mockNumberInput]
          }

          return []
        })

        global.FormData = jest.fn(() => formData)

        const result = formToData(mockForm)

        expect(result).toEqual({})
        expect(result).not.toHaveProperty('age')
      })

      it('should delete number field with only whitespace', () => {
        const mockNumberInput = {
          name: 'age',
          type: 'number',
        }

        const formData = new FormData()

        formData.append('age', '   ')

        mockForm.querySelectorAll = jest.fn((selector) => {
          if (selector === 'input[type="number"]:not([data-type])') {
            return [mockNumberInput]
          }

          return []
        })

        global.FormData = jest.fn(() => formData)

        const result = formToData(mockForm)

        expect(result).toEqual({})
        expect(result).not.toHaveProperty('age')
      })

      it('should delete number field with NaN value', () => {
        const mockNumberInput = {
          name: 'age',
          type: 'number',
        }

        const formData = new FormData()

        formData.append('age', 'not a number')

        mockForm.querySelectorAll = jest.fn((selector) => {
          if (selector === 'input[type="number"]:not([data-type])') {
            return [mockNumberInput]
          }

          return []
        })

        global.FormData = jest.fn(() => formData)

        const result = formToData(mockForm)

        expect(result).toEqual({})
        expect(result).not.toHaveProperty('age')
      })

      it('should parse decimal numbers', () => {
        const mockNumberInput = {
          name: 'price',
          type: 'number',
        }

        const formData = new FormData()

        formData.append('price', '19.99')

        mockForm.querySelectorAll = jest.fn((selector) => {
          if (selector === 'input[type="number"]:not([data-type])') {
            return [mockNumberInput]
          }

          return []
        })

        global.FormData = jest.fn(() => formData)

        const result = formToData(mockForm)

        expect(result).toEqual({ price: 19.99 })
      })

      it('should parse negative numbers', () => {
        const mockNumberInput = {
          name: 'temperature',
          type: 'number',
        }

        const formData = new FormData()

        formData.append('temperature', '-10')

        mockForm.querySelectorAll = jest.fn((selector) => {
          if (selector === 'input[type="number"]:not([data-type])') {
            return [mockNumberInput]
          }

          return []
        })

        global.FormData = jest.fn(() => formData)

        const result = formToData(mockForm)

        expect(result).toEqual({ temperature: -10 })
      })
    })

    describe('empty key filtering', () => {
      it('should delete keys with empty string', () => {
        const formData = new FormData()

        formData.append('', 'value')
        formData.append('valid', 'data')

        mockForm.querySelectorAll = jest.fn(() => [])
        global.FormData = jest.fn(() => formData)

        const result = formToData(mockForm)

        expect(result).toEqual({ valid: 'data' })
        expect(result).not.toHaveProperty('')
      })

      it('should delete keys with only whitespace', () => {
        const formData = new FormData()

        formData.append('   ', 'value')
        formData.append('valid', 'data')

        mockForm.querySelectorAll = jest.fn(() => [])
        global.FormData = jest.fn(() => formData)

        const result = formToData(mockForm)

        expect(result).toEqual({ valid: 'data' })
        expect(result).not.toHaveProperty('   ')
      })
    })

    describe('private field filtering (_prefix)', () => {
      it('should delete keys starting with underscore', () => {
        const formData = new FormData()

        formData.append('_private', 'secret')
        formData.append('public', 'data')

        mockForm.querySelectorAll = jest.fn(() => [])
        global.FormData = jest.fn(() => formData)

        const result = formToData(mockForm)

        expect(result).toEqual({ public: 'data' })
        expect(result).not.toHaveProperty('_private')
      })

      it('should delete multiple private fields', () => {
        const formData = new FormData()

        formData.append('_field1', 'value1')
        formData.append('_field2', 'value2')
        formData.append('public', 'data')

        mockForm.querySelectorAll = jest.fn(() => [])
        global.FormData = jest.fn(() => formData)

        const result = formToData(mockForm)

        expect(result).toEqual({ public: 'data' })
        expect(result).not.toHaveProperty('_field1')
        expect(result).not.toHaveProperty('_field2')
      })

      it('should not delete fields with underscore not at start', () => {
        const formData = new FormData()

        formData.append('field_name', 'value')
        formData.append('another_field', 'data')

        mockForm.querySelectorAll = jest.fn(() => [])
        global.FormData = jest.fn(() => formData)

        const result = formToData(mockForm)

        expect(result).toEqual({
          field_name: 'value',
          another_field: 'data',
        })
      })
    })

    describe('complex form data', () => {
      it('should handle form with all field types', () => {
        const mockTextarea = {
          name: 'config',
          value: 'key: value',
        }
        const mockCheckbox = {
          name: 'enabled',
          type: 'checkbox',
        }
        const mockNumberInput = {
          name: 'count',
          type: 'number',
        }

        const formData = new FormData()

        formData.append('name', 'Test')
        formData.append('config', 'key: value')
        formData.append('enabled', 'on')
        formData.append('count', '5')
        formData.append('_hidden', 'secret')

        mockForm.querySelectorAll = jest.fn((selector) => {
          if (selector === '[data-type="object"]') {
            return [mockTextarea]
          }

          if (selector === 'input[type="checkbox"]:not([data-type])') {
            return [mockCheckbox]
          }

          if (selector === 'input[type="number"]:not([data-type])') {
            return [mockNumberInput]
          }

          return []
        })

        global.FormData = jest.fn(() => formData)
        mockYamlParse.mockReturnValue({ key: 'value' })

        const result = formToData(mockForm)

        expect(result).toEqual({
          name: 'Test',
          config: { key: 'value' },
          enabled: true,
          count: 5,
        })
        expect(result).not.toHaveProperty('_hidden')
      })
    })

    describe('data-type="number" on any element', () => {
      it('should coerce select value to number', () => {
        const mockSelect = { name: 'priority', dataset: { type: 'number' } }

        const formData = new FormData()

        formData.append('priority', '3')

        mockForm.querySelectorAll = jest.fn((selector) => {
          if (selector === '[data-type="number"]') {
            return [mockSelect]
          }

          return []
        })

        global.FormData = jest.fn(() => formData)

        const result = formToData(mockForm)

        expect(result).toEqual({ priority: 3 })
      })

      it('should coerce text input with data-type="number"', () => {
        const mockInput = { name: 'score', dataset: { type: 'number' } }

        const formData = new FormData()

        formData.append('score', '99.5')

        mockForm.querySelectorAll = jest.fn((selector) => {
          if (selector === '[data-type="number"]') {
            return [mockInput]
          }

          return []
        })

        global.FormData = jest.fn(() => formData)

        const result = formToData(mockForm)

        expect(result).toEqual({ score: 99.5 })
      })

      it('should delete data-type="number" field when empty', () => {
        const mockSelect = { name: 'priority', dataset: { type: 'number' } }

        const formData = new FormData()

        formData.append('priority', '')

        mockForm.querySelectorAll = jest.fn((selector) => {
          if (selector === '[data-type="number"]') {
            return [mockSelect]
          }

          return []
        })

        global.FormData = jest.fn(() => formData)

        const result = formToData(mockForm)

        expect(result).not.toHaveProperty('priority')
      })

      it('should delete data-type="number" field when whitespace only', () => {
        const mockSelect = { name: 'priority', dataset: { type: 'number' } }

        const formData = new FormData()

        formData.append('priority', '   ')

        mockForm.querySelectorAll = jest.fn((selector) => {
          if (selector === '[data-type="number"]') {
            return [mockSelect]
          }

          return []
        })

        global.FormData = jest.fn(() => formData)

        const result = formToData(mockForm)

        expect(result).not.toHaveProperty('priority')
      })

      it('should delete data-type="number" field when NaN', () => {
        const mockSelect = { name: 'priority', dataset: { type: 'number' } }

        const formData = new FormData()

        formData.append('priority', 'abc')

        mockForm.querySelectorAll = jest.fn((selector) => {
          if (selector === '[data-type="number"]') {
            return [mockSelect]
          }

          return []
        })

        global.FormData = jest.fn(() => formData)

        const result = formToData(mockForm)

        expect(result).not.toHaveProperty('priority')
      })

      it('should coerce negative number from select', () => {
        const mockSelect = { name: 'offset', dataset: { type: 'number' } }

        const formData = new FormData()

        formData.append('offset', '-5')

        mockForm.querySelectorAll = jest.fn((selector) => {
          if (selector === '[data-type="number"]') {
            return [mockSelect]
          }

          return []
        })

        global.FormData = jest.fn(() => formData)

        const result = formToData(mockForm)

        expect(result).toEqual({ offset: -5 })
      })

      it('should skip data-type="number" elements without a name', () => {
        const mockSelect = { name: '', dataset: { type: 'number' } }

        const formData = new FormData()

        mockForm.querySelectorAll = jest.fn((selector) => {
          if (selector === '[data-type="number"]') {
            return [mockSelect]
          }

          return []
        })

        global.FormData = jest.fn(() => formData)

        expect(() => formToData(mockForm)).not.toThrow()
      })
    })

    describe('data-type="number-or-null" on any element', () => {
      it('should coerce a value to a number', () => {
        const mockSelect = {
          name: 'sessionDuration',
          dataset: { type: 'number-or-null' },
        }

        const formData = new FormData()

        formData.append('sessionDuration', '3600000')

        mockForm.querySelectorAll = jest.fn((selector) => {
          if (selector === '[data-type="number-or-null"]') {
            return [mockSelect]
          }

          return []
        })

        global.FormData = jest.fn(() => formData)

        const result = formToData(mockForm)

        expect(result).toEqual({ sessionDuration: 3600000 })
      })

      it('should resolve an empty value to null (not omit)', () => {
        const mockSelect = {
          name: 'sessionDuration',
          dataset: { type: 'number-or-null' },
        }

        const formData = new FormData()

        formData.append('sessionDuration', '')

        mockForm.querySelectorAll = jest.fn((selector) => {
          if (selector === '[data-type="number-or-null"]') {
            return [mockSelect]
          }

          return []
        })

        global.FormData = jest.fn(() => formData)

        const result = formToData(mockForm)

        expect(result).toEqual({ sessionDuration: null })
      })

      it('should resolve a whitespace-only value to null', () => {
        const mockSelect = {
          name: 'sessionDuration',
          dataset: { type: 'number-or-null' },
        }

        const formData = new FormData()

        formData.append('sessionDuration', '   ')

        mockForm.querySelectorAll = jest.fn((selector) => {
          if (selector === '[data-type="number-or-null"]') {
            return [mockSelect]
          }

          return []
        })

        global.FormData = jest.fn(() => formData)

        const result = formToData(mockForm)

        expect(result).toEqual({ sessionDuration: null })
      })

      it('should resolve a NaN value to null', () => {
        const mockSelect = {
          name: 'sessionDuration',
          dataset: { type: 'number-or-null' },
        }

        const formData = new FormData()

        formData.append('sessionDuration', 'abc')

        mockForm.querySelectorAll = jest.fn((selector) => {
          if (selector === '[data-type="number-or-null"]') {
            return [mockSelect]
          }

          return []
        })

        global.FormData = jest.fn(() => formData)

        const result = formToData(mockForm)

        expect(result).toEqual({ sessionDuration: null })
      })

      it('should preserve an explicit 0', () => {
        const mockSelect = {
          name: 'sessionDuration',
          dataset: { type: 'number-or-null' },
        }

        const formData = new FormData()

        formData.append('sessionDuration', '0')

        mockForm.querySelectorAll = jest.fn((selector) => {
          if (selector === '[data-type="number-or-null"]') {
            return [mockSelect]
          }

          return []
        })

        global.FormData = jest.fn(() => formData)

        const result = formToData(mockForm)

        expect(result).toEqual({ sessionDuration: 0 })
      })
    })

    describe('data-type="boolean" on any element', () => {
      it('should coerce select value "true" to true', () => {
        const mockSelect = { name: 'active', dataset: { type: 'boolean' } }

        const formData = new FormData()

        formData.append('active', 'true')

        mockForm.querySelectorAll = jest.fn((selector) => {
          if (selector === '[data-type="boolean"]') {
            return [mockSelect]
          }

          return []
        })

        global.FormData = jest.fn(() => formData)

        const result = formToData(mockForm)

        expect(result).toEqual({ active: true })
      })

      it('should coerce select value "false" to false', () => {
        const mockSelect = { name: 'active', dataset: { type: 'boolean' } }

        const formData = new FormData()

        formData.append('active', 'false')

        mockForm.querySelectorAll = jest.fn((selector) => {
          if (selector === '[data-type="boolean"]') {
            return [mockSelect]
          }

          return []
        })

        global.FormData = jest.fn(() => formData)

        const result = formToData(mockForm)

        expect(result).toEqual({ active: false })
      })

      it('should coerce empty string to false', () => {
        const mockSelect = { name: 'active', dataset: { type: 'boolean' } }

        const formData = new FormData()

        formData.append('active', '')

        mockForm.querySelectorAll = jest.fn((selector) => {
          if (selector === '[data-type="boolean"]') {
            return [mockSelect]
          }

          return []
        })

        global.FormData = jest.fn(() => formData)

        const result = formToData(mockForm)

        expect(result).toEqual({ active: false })
      })

      it('should coerce "on" to true for data-type="boolean"', () => {
        const mockInput = { name: 'notify', dataset: { type: 'boolean' } }

        const formData = new FormData()

        formData.append('notify', 'on')

        mockForm.querySelectorAll = jest.fn((selector) => {
          if (selector === '[data-type="boolean"]') {
            return [mockInput]
          }

          return []
        })

        global.FormData = jest.fn(() => formData)

        const result = formToData(mockForm)

        expect(result).toEqual({ notify: true })
      })

      it('should coerce any non-true/on value to false', () => {
        const mockSelect = { name: 'flag', dataset: { type: 'boolean' } }

        const formData = new FormData()

        formData.append('flag', 'no')

        mockForm.querySelectorAll = jest.fn((selector) => {
          if (selector === '[data-type="boolean"]') {
            return [mockSelect]
          }

          return []
        })

        global.FormData = jest.fn(() => formData)

        const result = formToData(mockForm)

        expect(result).toEqual({ flag: false })
      })

      it('should skip data-type="boolean" elements without a name', () => {
        const mockSelect = { name: '', dataset: { type: 'boolean' } }

        const formData = new FormData()

        mockForm.querySelectorAll = jest.fn((selector) => {
          if (selector === '[data-type="boolean"]') {
            return [mockSelect]
          }

          return []
        })

        global.FormData = jest.fn(() => formData)

        expect(() => formToData(mockForm)).not.toThrow()
      })
    })

    describe('data-type fallback compatibility', () => {
      it('should still handle checkboxes without data-type as boolean', () => {
        const mockCheckbox = { name: 'legacy', type: 'checkbox' }

        const formData = new FormData()

        formData.append('legacy', 'on')

        mockForm.querySelectorAll = jest.fn((selector) => {
          if (selector === 'input[type="checkbox"]:not([data-type])') {
            return [mockCheckbox]
          }

          return []
        })

        global.FormData = jest.fn(() => formData)

        const result = formToData(mockForm)

        expect(result).toEqual({ legacy: true })
      })

      it('should still handle input[type=number] without data-type', () => {
        const mockNumberInput = { name: 'amount', type: 'number' }

        const formData = new FormData()

        formData.append('amount', '42')

        mockForm.querySelectorAll = jest.fn((selector) => {
          if (selector === 'input[type="number"]:not([data-type])') {
            return [mockNumberInput]
          }

          return []
        })

        global.FormData = jest.fn(() => formData)

        const result = formToData(mockForm)

        expect(result).toEqual({ amount: 42 })
      })
    })

    describe('mixed data-type and implicit fields', () => {
      it('should handle select with data-type="number" alongside regular checkbox and number input', () => {
        const mockSelect = { name: 'level', dataset: { type: 'number' } }
        const mockCheckbox = { name: 'enabled', type: 'checkbox' }
        const mockNumberInput = { name: 'count', type: 'number' }

        const formData = new FormData()

        formData.append('level', '5')
        formData.append('enabled', 'on')
        formData.append('count', '10')

        mockForm.querySelectorAll = jest.fn((selector) => {
          if (selector === '[data-type="number"]') {
            return [mockSelect]
          }

          if (selector === '[data-type="boolean"]') {
            return []
          }

          if (selector === '[data-type="object"]') {
            return []
          }

          if (selector === 'input[type="checkbox"]:not([data-type])') {
            return [mockCheckbox]
          }

          if (selector === 'input[type="number"]:not([data-type])') {
            return [mockNumberInput]
          }

          return []
        })

        global.FormData = jest.fn(() => formData)

        const result = formToData(mockForm)

        expect(result).toEqual({
          level: 5,
          enabled: true,
          count: 10,
        })
      })

      it('should handle select with data-type="boolean" alongside other fields', () => {
        const mockSelect = { name: 'visible', dataset: { type: 'boolean' } }

        const formData = new FormData()

        formData.append('visible', 'true')
        formData.append('title', 'Hello')

        mockForm.querySelectorAll = jest.fn((selector) => {
          if (selector === '[data-type="boolean"]') {
            return [mockSelect]
          }

          return []
        })

        global.FormData = jest.fn(() => formData)

        const result = formToData(mockForm)

        expect(result).toEqual({
          visible: true,
          title: 'Hello',
        })
      })
    })

    describe('edge cases', () => {
      it('should handle form with no fields', () => {
        const formData = new FormData()

        mockForm.querySelectorAll = jest.fn(() => [])
        global.FormData = jest.fn(() => formData)

        const result = formToData(mockForm)

        expect(result).toEqual({})
      })

      it('should handle form with only filtered fields', () => {
        const formData = new FormData()

        formData.append('_private', 'value')
        formData.append('', 'empty')

        mockForm.querySelectorAll = jest.fn(() => [])
        global.FormData = jest.fn(() => formData)

        const result = formToData(mockForm)

        expect(result).toEqual({})
      })

      it('should skip object fields with no name attribute without throwing', () => {
        // Reproduces: TypeError: Cannot read properties of undefined (reading 'trim')
        // Happens when ObjectInput with name={undefined} is inside a form that has
        // a named hidden input for the same data. The unnamed ObjectInput still has
        // data-type="object" so formToData finds it, but data[""] is undefined.

        const mockUnnamedTextarea = {
          name: '',
        }

        const mockNamedInput = {
          name: 'config',
        }

        const formData = new FormData()

        formData.append('config', 'key: value')

        mockForm.querySelectorAll = jest.fn((selector) => {
          if (selector === '[data-type="object"]') {
            return [mockUnnamedTextarea, mockNamedInput]
          }

          return []
        })

        global.FormData = jest.fn(() => formData)
        mockYamlParse.mockReturnValue({ key: 'value' })

        expect(() => formToData(mockForm)).not.toThrow()

        const result = formToData(mockForm)

        expect(result).toEqual({ config: { key: 'value' } })
      })

      it('should skip number fields with no name attribute without throwing', () => {
        const mockUnnamedNumber = {
          name: '',
          type: 'number',
        }

        const mockNamedNumber = {
          name: 'count',
          type: 'number',
        }

        const formData = new FormData()

        formData.append('count', '42')

        mockForm.querySelectorAll = jest.fn((selector) => {
          if (selector === 'input[type="number"]:not([data-type])') {
            return [mockUnnamedNumber, mockNamedNumber]
          }

          return []
        })

        global.FormData = jest.fn(() => formData)

        expect(() => formToData(mockForm)).not.toThrow()

        const result = formToData(mockForm)

        expect(result).toEqual({ count: 42 })
      })
    })
  })
})
