import { template, when } from './index'

describe('template', () => {
  describe('basic functionality', () => {
    it('should handle simple text without conditionals', () => {
      const result = template`
        This is simple text
        without any conditionals
      `

      expect(result).toContain('This is simple text')
      expect(result).toContain('without any conditionals')
    })

    it('should handle regular string interpolation', () => {
      const name = 'ChatBot'
      const result = template`
        Hello ${name}!
        Welcome to the platform.
      `

      expect(result).toContain('Hello ChatBot!')
      expect(result).toContain('Welcome to the platform.')
    })
  })

  describe('when() function', () => {
    it('should keep line and remove when(true) with no content', () => {
      const result = template`
        Line 1
        Line 2 ${when(true)}
        Line 3
      `

      expect(result).toContain('Line 1')
      expect(result).toContain('Line 2')
      expect(result).toContain('Line 3')
      expect(result).not.toContain('when(')
    })

    it('should insert content with when(true, content)', () => {
      const result = template`
        ${when(true, 'This content should appear')}
      `

      expect(result).toContain('This content should appear')
    })

    it('should remove entire line with when(false)', () => {
      const result = template`
        Line 1
        Line 2 ${when(false)}
        Line 3
      `

      expect(result).toContain('Line 1')
      expect(result).not.toContain('Line 2')
      expect(result).toContain('Line 3')
    })

    it('should remove entire line with when(false, content)', () => {
      const result = template`
        Line 1
        Line 2 ${when(false, 'ignored content')}
        Line 3
      `

      expect(result).toContain('Line 1')
      expect(result).not.toContain('Line 2')
      expect(result).not.toContain('ignored content')
      expect(result).toContain('Line 3')
    })
  })

  describe('whitespace preservation', () => {
    it('should dedent by removing common leading whitespace', () => {
      const result = template`
        indented content
          more indented
      `

      // The minimum indentation is 8 spaces, so both lines should be dedented by 8 spaces
      expect(result).toContain('indented content')
      expect(result).toContain('  more indented') // This line had 10 spaces, now has 2
    })

    it('should preserve relative indentation in list items', () => {
      const result = template`
        Steps:
          1. First step ${when(true)}
          2. Optional step ${when(false)}
          3. Final step
      `

      // After dedenting, "Steps:" starts at column 0, list items at column 2
      expect(result).toContain('Steps:')
      expect(result).toContain('  1. First step')
      expect(result).not.toContain('Optional step')
      expect(result).toContain('  3. Final step')
    })

    it('should handle the example from the comment - trim by shortest whitespace prefix', () => {
      // This test matches the exact example provided in the PR comment
      const condition = true
      let template_result: string

      if (condition) {
        template_result = template`
    First line
    Second line
      3rd-indented line
  `
      } else {
        template_result = ''
      }

      // Expected result after dedenting by the shortest prefix (4 spaces):
      const expected = 'First line\nSecond line\n  3rd-indented line'

      expect(template_result).toBe(expected)
    })
  })

  describe('whitespace concatenation', () => {
    it('should concatenate new line when lines end with \\', () => {
      const result = template`
        This is a line that ends with a backslash \\
        and this line should be concatenated to it.
        
        This is a new paragraph.
      `

      expect(result).toContain(
        'This is a line that ends with a backslash and this line should be concatenated to it.'
      )
      expect(result).toContain('This is a new paragraph.')
    })
  })

  describe('complex scenarios', () => {
    it('should handle multiple conditions on same line', () => {
      const isOnline = true
      const debugMode = false

      const result = template`
        Status: running ${when(isOnline, '✅')} ${when(!isOnline, '❌')}
        Debug mode ${when(debugMode)}
      `

      expect(result).toContain('Status: running ✅')
      expect(result).not.toContain('❌')
      expect(result).not.toContain('Debug mode')
    })

    it('should handle nested conditional content', () => {
      const isDevelopment = true
      const hasDocker = false
      const useTypeScript = true

      const result = template`
        # Project Setup
        
        ## Prerequisites
        * Node.js >= 16 ${when(isDevelopment)}
        * Docker ${when(hasDocker)}
        * Python for scripts ${when(false)}
        
        ## Installation Steps
        ${when(
          useTypeScript,
          '1. Install TypeScript: `npm install -g typescript`'
        )}
        2. Clone the repository
        3. Install dependencies: \`npm install\`
        ${when(hasDocker, '4. Start Docker containers: `docker-compose up`')}
        ${when(!hasDocker, '4. Start the development server: `npm run dev`')}
      `

      expect(result).toContain('# Project Setup')
      expect(result).toContain('* Node.js >= 16')
      expect(result).not.toContain('* Docker')
      expect(result).not.toContain('* Python for scripts')
      expect(result).toContain('1. Install TypeScript')
      expect(result).toContain('2. Clone the repository')
      expect(result).not.toContain('Start Docker containers')
      expect(result).toContain('4. Start the development server')
    })

    it('should handle complex markdown structures', () => {
      const result = template`
        # Header
        * item 1 ${when(true)}
        * item 2 ${when(false)}
        * item 3 ${when(true, '(modified)')}
      `

      expect(result).toMatch(/\* item 1\s*\n/)
      expect(result).not.toContain('item 2')
      expect(result).toContain('item 3 (modified)')
    })
  })

  describe('edge cases', () => {
    it('should handle empty string content', () => {
      const result = template`
        Content: ${when(true, '')}
        End
      `

      expect(result).toContain('Content:')
      expect(result).toContain('End')
    })

    it('should handle multiple when() calls in sequence', () => {
      const result = template`
        ${when(true, 'First')}
        ${when(false)}
        ${when(true, 'Third')}
      `

      expect(result).toContain('First')
      expect(result).toContain('Third')
      expect(result.split('\n').filter((line) => line.trim()).length).toBe(2)
    })

    it('should handle mixed content with conditions', () => {
      const serverStatus = 'running'
      const isOnline = true

      const result = template`
        Status: ${serverStatus} ${when(isOnline, '✅')}
        Details available ${when(true)}
        Debug info ${when(false)}
      `

      expect(result).toContain('Status: running ✅')
      expect(result).toContain('Details available')
      expect(result).not.toContain('Debug info')
    })
  })

  describe('specification examples', () => {
    it('should match Example 1 from specification', () => {
      const result = template`
        This is a simple bot that has a couple of things in common. The main thing is
        that it can write lines that are well formatted.
        There are several conditions that we need to follow
        * use the most recent version of the library ${when(true)} 
        * use the previous version of the library ${when(false)} 
        ${when(true, 'Make sure to use this other thing which works!')}
      `

      expect(result).toContain(
        'This is a simple bot that has a couple of things in common'
      )
      expect(result).toContain('* use the most recent version of the library')
      expect(result).not.toContain('* use the previous version of the library')
      expect(result).toContain('Make sure to use this other thing which works!')
    })

    it('should match Example 2 from specification - complex nested conditions', () => {
      const isDevelopment = true
      const hasDocker = false
      const useTypeScript = true

      const setup = template`
        # Project Setup
        
        ## Prerequisites
        * Node.js >= 16 ${when(isDevelopment)}
        * Docker ${when(hasDocker)}
        * Python for scripts ${when(false)}
        
        ## Installation Steps
        ${when(
          useTypeScript,
          '1. Install TypeScript: `npm install -g typescript`'
        )}
        2. Clone the repository
        3. Install dependencies: \`npm install\`
        ${when(hasDocker, '4. Start Docker containers: `docker-compose up`')}
        ${when(!hasDocker, '4. Start the development server: `npm run dev`')}
        
        ## Development Notes
        ${when(
          isDevelopment,
          `
        * Hot reload is enabled
        * Debug mode is active
        * Source maps are generated
        `
        )}
        
        ${when(!isDevelopment, 'Production optimizations are enabled')}
      `

      expect(setup).toContain('# Project Setup')
      expect(setup).toContain('* Node.js >= 16')
      expect(setup).not.toContain('* Docker')
      expect(setup).not.toContain('* Python for scripts')
      expect(setup).toContain('1. Install TypeScript')
      expect(setup).toContain('4. Start the development server')
      expect(setup).not.toContain('Start Docker containers')
      expect(setup).toContain('Hot reload is enabled')
      expect(setup).not.toContain('Production optimizations are enabled')
    })
  })
})

describe('when', () => {
  it('should return correct WhenResult for when(true)', () => {
    const result = when(true)

    expect(result.__isWhenResult).toBe(true)
    expect(result.condition).toBe(true)
    expect(result.content).toBeUndefined()
    expect(result.shouldRemoveLine).toBe(false)
  })

  it('should return correct WhenResult for when(true, content)', () => {
    const result = when(true, 'test content')

    expect(result.__isWhenResult).toBe(true)
    expect(result.condition).toBe(true)
    expect(result.content).toBe('test content')
    expect(result.shouldRemoveLine).toBe(false)
  })

  it('should return correct WhenResult for when(false)', () => {
    const result = when(false)

    expect(result.__isWhenResult).toBe(true)
    expect(result.condition).toBe(false)
    expect(result.content).toBeUndefined()
    expect(result.shouldRemoveLine).toBe(true)
  })

  it('should return correct WhenResult for when(false, content)', () => {
    const result = when(false, 'ignored content')

    expect(result.__isWhenResult).toBe(true)
    expect(result.condition).toBe(false)
    expect(result.content).toBeUndefined()
    expect(result.shouldRemoveLine).toBe(true) // @note when(false, content) removes entire line and ignores content
  })
})

describe('undefined/null handling', () => {
  it('should NOT include "undefined" when variable is undefined with when(false)', () => {
    const maybeValue: string | undefined = undefined

    const result = template`
      ${maybeValue} ${when(!!maybeValue)}
      Next line
    `

    expect(result).not.toContain('undefined')
    expect(result).toContain('Next line')
  })

  it('should remove line when value is undefined and when(false) is used', () => {
    const maybeValue: string | undefined = undefined

    const result = template`
      First line
      ${maybeValue} ${when(!!maybeValue)}
      Last line
    `

    expect(result).toContain('First line')
    expect(result).toContain('Last line')
    expect(result).not.toContain('undefined')
  })

  it('should NOT include "null" when variable is null with when(false)', () => {
    const maybeValue: string | null = null

    const result = template`
      ${maybeValue} ${when(!!maybeValue)}
      Next line
    `

    expect(result).not.toContain('null')
    expect(result).toContain('Next line')
  })

  it('should keep line with value when when(true) is used', () => {
    const maybeValue: string | undefined = 'Hello'

    const result = template`
      ${maybeValue} ${when(!!maybeValue)}
      Next line
    `

    expect(result).toContain('Hello')
    expect(result).toContain('Next line')
  })
})
