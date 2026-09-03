import { q } from '@/lib/query.helpers'

describe('query helpers', () => {
  describe('q', () => {
    describe('basic functionality', () => {
      it('should convert simple object to query string', () => {
        expect(q({ key: 'value' })).toBe('key=value')
      })

      it('should convert multiple key-value pairs', () => {
        const result = q({ foo: 'bar', baz: 'qux' })

        expect(result).toContain('foo=bar')
        expect(result).toContain('baz=qux')
        expect(result).toContain('&')
      })

      it('should handle numeric values', () => {
        expect(q({ age: 25 })).toBe('age=25')
        expect(q({ count: 0 })).toBe('count=0')
        expect(q({ negative: -10 })).toBe('negative=-10')
      })

      it('should handle boolean values', () => {
        expect(q({ enabled: true })).toBe('enabled=true')
        expect(q({ disabled: false })).toBe('disabled=false')
      })

      it('should handle string values', () => {
        expect(q({ name: 'John Doe' })).toBe('name=John+Doe')
        expect(q({ title: 'Hello World' })).toBe('title=Hello+World')
      })
    })

    describe('edge cases', () => {
      it('should return empty string for empty object', () => {
        expect(q({})).toBe('')
      })

      it('should handle null values', () => {
        expect(q({ key: null })).toBe('')
      })

      it('should handle undefined values', () => {
        expect(q({ key: undefined })).toBe('')
      })

      it('should handle empty string values', () => {
        expect(q({ key: '' })).toBe('key=')
      })

      it('should handle special characters', () => {
        expect(q({ key: 'a@b.com' })).toBe('key=a%40b.com')
        expect(q({ key: 'hello&world' })).toBe('key=hello%26world')
        expect(q({ key: 'a=b' })).toBe('key=a%3Db')
      })

      it('should handle spaces', () => {
        expect(q({ key: 'hello world' })).toBe('key=hello+world')
      })

      it('should handle unicode characters', () => {
        expect(q({ key: 'こんにちは' })).toBe(
          'key=%E3%81%93%E3%82%93%E3%81%AB%E3%81%A1%E3%81%AF'
        )
      })

      it('should handle special URL characters', () => {
        expect(q({ url: 'https://example.com/path?query=value' })).toBe(
          'url=https%3A%2F%2Fexample.com%2Fpath%3Fquery%3Dvalue'
        )
      })

      it('should handle plus sign', () => {
        expect(q({ key: 'a+b' })).toBe('key=a%2Bb')
      })

      it('should handle hash/fragment', () => {
        expect(q({ key: 'a#b' })).toBe('key=a%23b')
      })

      it('should handle forward slash', () => {
        expect(q({ key: 'a/b' })).toBe('key=a%2Fb')
      })
    })

    describe('type conversion', () => {
      it('should convert numbers to strings', () => {
        const result = q({ num: 123 })

        expect(result).toBe('num=123')
      })

      it('should convert booleans to strings', () => {
        expect(q({ bool: true })).toBe('bool=true')
        expect(q({ bool: false })).toBe('bool=false')
      })

      it('should handle NaN', () => {
        expect(q({ key: NaN })).toBe('key=NaN')
      })

      it('should handle Infinity', () => {
        expect(q({ key: Infinity })).toBe('key=Infinity')
        expect(q({ key: -Infinity })).toBe('key=-Infinity')
      })

      it('should handle Date objects', () => {
        const date = new Date('2024-01-01T00:00:00.000Z')
        const result = q({ date })

        expect(result).toContain('date=')
        expect(result).toContain('2024')
      })

      it('should handle object toString conversion', () => {
        const obj = { toString: () => 'custom' }

        expect(q({ key: obj })).toBe('key=custom')
      })
    })

    describe('multiple parameters', () => {
      it('should handle multiple parameters with different types', () => {
        const result = q({
          string: 'hello',
          number: 42,
          boolean: true,
        })

        expect(result).toContain('string=hello')
        expect(result).toContain('number=42')
        expect(result).toContain('boolean=true')
      })

      it('should maintain parameter order consistency', () => {
        const input = {
          a: '1',
          b: '2',
          c: '3',
        }
        const result = q(input)

        // URLSearchParams maintains insertion order
        expect(result.indexOf('a=1')).toBeLessThan(result.indexOf('b=2'))
        expect(result.indexOf('b=2')).toBeLessThan(result.indexOf('c=3'))
      })

      it('should handle many parameters', () => {
        const input = {}

        for (let i = 0; i < 20; i++) {
          input[`key${i}`] = `value${i}`
        }

        const result = q(input)

        expect(result.split('&').length).toBe(20)
      })
    })

    describe('array handling', () => {
      it('should handle array values by converting to string', () => {
        const result = q({ arr: [1, 2, 3] })

        expect(result).toBe('arr=1%2C2%2C3')
      })

      it('should handle empty array', () => {
        const result = q({ arr: [] })

        expect(result).toBe('arr=')
      })

      it('should handle array with mixed types', () => {
        const result = q({ arr: [1, 'two', true] })

        expect(result).toBe('arr=1%2Ctwo%2Ctrue')
      })
    })

    describe('nested object handling', () => {
      it('should handle nested objects by converting to string', () => {
        const result = q({ obj: { nested: 'value' } })

        expect(result).toContain('obj=')
        expect(result).toContain('object')
      })

      it('should handle object with custom toString', () => {
        const obj = {
          toString() {
            return 'custom-string'
          },
        }

        expect(q({ key: obj })).toBe('key=custom-string')
      })
    })

    describe('real-world usage', () => {
      it('should generate valid URL query strings', () => {
        const params = {
          search: 'test query',
          page: 1,
          limit: 10,
          sort: 'name',
        }
        const result = q(params)

        expect(result).toContain('search=test+query')
        expect(result).toContain('page=1')
        expect(result).toContain('limit=10')
        expect(result).toContain('sort=name')
      })

      it('should handle filter parameters', () => {
        const result = q({
          filter: 'active',
          category: 'electronics',
          minPrice: 100,
          maxPrice: 500,
        })

        expect(result).toContain('filter=active')
        expect(result).toContain('category=electronics')
        expect(result).toContain('minPrice=100')
        expect(result).toContain('maxPrice=500')
      })

      it('should encode email addresses properly', () => {
        const result = q({ email: 'user@example.com' })

        expect(result).toBe('email=user%40example.com')
      })

      it('should encode URLs properly', () => {
        const result = q({ redirect: 'https://example.com/page?id=123' })

        expect(result).toBe(
          'redirect=https%3A%2F%2Fexample.com%2Fpage%3Fid%3D123'
        )
      })
    })

    describe('spread operator behavior', () => {
      it('should work with spread syntax', () => {
        const obj = { a: '1', b: '2' }

        expect(q({ ...obj })).toContain('a=1')
        expect(q({ ...obj })).toContain('b=2')
      })

      it('should handle spread with additional properties', () => {
        const obj = { a: '1' }
        const result = q({ ...obj, b: '2' })

        expect(result).toContain('a=1')
        expect(result).toContain('b=2')
      })

      it('should handle property override via spread', () => {
        const obj = { key: 'original' }
        const result = q({ ...obj, key: 'override' })

        expect(result).toBe('key=override')
      })
    })
  })
})
