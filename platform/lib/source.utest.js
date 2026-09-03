import { extractSource } from '@/lib/source'

describe('source utilities', () => {
  describe('extractSource', () => {
    describe('basic functionality', () => {
      it('should extract content between source markers', () => {
        const input = `
// some comment
// source start
const code = 'extracted'
// source end
// more comments
`.trim()

        const result = extractSource(input)

        expect(result).toBe("const code = 'extracted'")
      })

      it('should handle multiple lines between markers', () => {
        const input = `
// source start
line 1
line 2
line 3
// source end
`.trim()

        const result = extractSource(input)

        expect(result).toBe('line 1\nline 2\nline 3')
      })

      it('should skip content outside markers', () => {
        const input = `
ignored line 1
ignored line 2
// source start
extracted line
// source end
ignored line 3
`.trim()

        const result = extractSource(input)

        expect(result).toBe('extracted line')
      })

      it('should handle !source markers', () => {
        const input = `
// !source start
extracted content
// !source end
`.trim()

        const result = extractSource(input)

        expect(result).toBe('extracted content')
      })
    })

    describe('multiple source blocks', () => {
      it('should extract content from multiple source blocks', () => {
        const input = `
ignored
// source start
block 1
// source end
ignored
// source start
block 2
// source end
`.trim()

        const result = extractSource(input)

        expect(result).toBe('block 1\nblock 2')
      })

      it('should handle alternating source blocks with ignored content', () => {
        const input = `
// source start
first
// source end
middle ignored
// source start
second
// source end
`.trim()

        const result = extractSource(input)

        expect(result).toBe('first\nsecond')
      })

      it('should handle three or more source blocks', () => {
        const input = `
// source start
a
// source end
// source start
b
// source end
// source start
c
// source end
`.trim()

        const result = extractSource(input)

        expect(result).toBe('a\nb\nc')
      })
    })

    describe('whitespace handling', () => {
      it('should preserve indentation within source blocks', () => {
        const input = `
// source start
  indented line
    more indented
  less indented
// source end
`.trim()

        const result = extractSource(input)

        expect(result).toBe(
          '  indented line\n    more indented\n  less indented'
        )
      })

      it('should preserve empty lines within source blocks', () => {
        const input = `
// source start
line 1

line 3
// source end
`.trim()

        const result = extractSource(input)

        expect(result).toBe('line 1\n\nline 3')
      })

      it('should handle trailing whitespace', () => {
        const input = `
// source start
line with trailing spaces   
// source end
`.trim()

        const result = extractSource(input)

        expect(result).toBe('line with trailing spaces   ')
      })
    })

    describe('edge cases', () => {
      it('should return empty string when no source markers', () => {
        const input = `
line 1
line 2
line 3
`.trim()

        const result = extractSource(input)

        expect(result).toBe('')
      })

      it('should return empty string for empty input', () => {
        expect(extractSource('')).toBe('')
      })

      it('should handle only start marker without end marker', () => {
        const input = `
// source start
unclosed content
more content
`.trim()

        const result = extractSource(input)

        expect(result).toBe('unclosed content\nmore content')
      })

      it('should handle only end marker without start marker', () => {
        const input = `
some content
// source end
more content
`.trim()

        const result = extractSource(input)

        expect(result).toBe('')
      })

      it('should handle empty source block', () => {
        const input = `
// source start
// source end
`.trim()

        const result = extractSource(input)

        expect(result).toBe('')
      })

      it('should handle adjacent start and end markers', () => {
        const input = `
// source start
// source end
`.trim()

        const result = extractSource(input)

        expect(result).toBe('')
      })
    })

    describe('marker variations', () => {
      it('should handle markers with varying whitespace', () => {
        const input = `
//  source start
content
//   source end
`.trim()

        const result = extractSource(input)

        expect(result).toBe('content')
      })

      it('should handle markers with tabs', () => {
        const input = `
//\tsource start
content
//\tsource end
`.trim()

        const result = extractSource(input)

        expect(result).toBe('content')
      })

      it('should handle markers with multiple spaces', () => {
        const input = `
//     source start
content
//     source end
`.trim()

        const result = extractSource(input)

        expect(result).toBe('content')
      })

      it('should mix regular and !source markers', () => {
        const input = `
// source start
block 1
// source end
// !source start
block 2
// !source end
`.trim()

        const result = extractSource(input)

        expect(result).toBe('block 1\nblock 2')
      })
    })

    describe('special characters', () => {
      it('should handle special characters in extracted content', () => {
        const input = `
// source start
const regex = /test\\.js$/
const str = "quotes 'and' \\"double\\""
// source end
`.trim()

        const result = extractSource(input)

        expect(result).toContain('regex')
        expect(result).toContain('quotes')
      })

      it('should handle unicode characters', () => {
        const input = `
// source start
const emoji = '🎉'
const unicode = 'Héllo Wörld'
// source end
`.trim()

        const result = extractSource(input)

        expect(result).toContain('🎉')
        expect(result).toContain('Héllo Wörld')
      })

      it('should handle code with various syntax', () => {
        const input = `
// source start
const obj = { key: 'value' }
const arr = [1, 2, 3]
const fn = () => {}
// source end
`.trim()

        const result = extractSource(input)

        expect(result).toContain('obj')
        expect(result).toContain('arr')
        expect(result).toContain('fn')
      })
    })

    describe('real-world scenarios', () => {
      it('should extract JavaScript function', () => {
        const input = `
// File header
// Description
// source start
function calculate(a, b) {
  return a + b
}
// source end
// File footer
`.trim()

        const result = extractSource(input)

        expect(result).toBe('function calculate(a, b) {\n  return a + b\n}')
      })

      it('should extract TypeScript interface', () => {
        const input = `
// imports
// source start
interface User {
  id: string
  name: string
}
// source end
// exports
`.trim()

        const result = extractSource(input)

        expect(result).toContain('interface User')
        expect(result).toContain('id: string')
      })

      it('should extract React component', () => {
        const input = `
// !source start
export function Component() {
  return <div>Hello</div>
}
// !source end
`.trim()

        const result = extractSource(input)

        expect(result).toContain('Component')
        expect(result).toContain('<div>Hello</div>')
      })
    })
  })
})
