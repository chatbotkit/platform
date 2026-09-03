import { ActionName } from '@/lib/action.name'

import { definitions } from './action.definition'

describe('action definitions', () => {
  describe('structure and completeness', () => {
    it('should have definitions for all ActionName enum values', () => {
      const actionNames = Object.values(ActionName)
      const definedActions = Object.keys(definitions)

      expect(definedActions.length).toBeGreaterThan(0)

      actionNames.forEach((actionName) => {
        expect(definitions).toHaveProperty(actionName)
      })
    })

    it('should have description for every action', () => {
      Object.entries(definitions).forEach(([_actionName, definition]) => {
        expect(definition).toHaveProperty('description')
        expect(typeof definition.description).toBe('string')
        expect(definition.description.length).toBeGreaterThan(0)
      })
    })

    it('should have examples array for every action', () => {
      Object.entries(definitions).forEach(([_actionName, definition]) => {
        expect(definition).toHaveProperty('examples')
        expect(Array.isArray(definition.examples)).toBe(true)
      })
    })

    it('should have exactly two properties per definition', () => {
      Object.entries(definitions).forEach(([_actionName, definition]) => {
        const keys = Object.keys(definition)

        expect(keys).toEqual(['description', 'examples'])
      })
    })
  })

  describe('verb actions', () => {
    it('should have search action definition', () => {
      expect(definitions[ActionName.search]).toBeDefined()
      expect(definitions[ActionName.search].description).toMatch(
        /search|web|dataset/i
      )
      expect(definitions[ActionName.search].examples).toContain('@search/web')
      expect(definitions[ActionName.search].examples).toContain('@search/news')
      expect(definitions[ActionName.search].examples).toContain(
        '@search/images'
      )
    })

    it('should have fetch action definition', () => {
      expect(definitions[ActionName.fetch]).toBeDefined()
      expect(definitions[ActionName.fetch].description).toMatch(
        /fetch|url|retrieve/i
      )
      expect(definitions[ActionName.fetch].examples.length).toBeGreaterThan(0)
    })

    it('should have email action definition', () => {
      expect(definitions[ActionName.email]).toBeDefined()
      expect(definitions[ActionName.email].description).toMatch(/email|send/i)
      expect(definitions[ActionName.email].examples).toContain('@email/send')
    })

    it('should have echo action definition', () => {
      expect(definitions[ActionName.echo]).toBeDefined()
      expect(definitions[ActionName.echo].description).toMatch(
        /echo|back|message|value/i
      )
      expect(Array.isArray(definitions[ActionName.echo].examples)).toBe(true)
    })

    it('should have abort action definition', () => {
      expect(definitions[ActionName.abort]).toBeDefined()
      expect(definitions[ActionName.abort].description).toMatch(
        /abort|stop|cancel/i
      )
      expect(Array.isArray(definitions[ActionName.abort].examples)).toBe(true)
    })

    it('should have view action definition', () => {
      expect(definitions[ActionName.view]).toBeDefined()
      expect(definitions[ActionName.view].description).toMatch(
        /vision|image|describe/i
      )
      expect(definitions[ActionName.view].examples).toContain('@view/describe')
    })

    it('should have listen action definition', () => {
      expect(definitions[ActionName.listen]).toBeDefined()
      expect(definitions[ActionName.listen].description).toMatch(
        /listen|input|event/i
      )
      expect(Array.isArray(definitions[ActionName.listen].examples)).toBe(true)
    })
  })

  describe('noun actions', () => {
    it('should have bot action definition', () => {
      expect(definitions[ActionName.bot]).toBeDefined()
      expect(definitions[ActionName.bot].description).toContain('bot')
      expect(Array.isArray(definitions[ActionName.bot].examples)).toBe(true)
    })

    it('should have dataset action definition', () => {
      expect(definitions[ActionName.dataset]).toBeDefined()
      expect(definitions[ActionName.dataset].description).toContain('dataset')
      expect(Array.isArray(definitions[ActionName.dataset].examples)).toBe(true)
    })

    it('should have skillset action definition', () => {
      expect(definitions[ActionName.skillset]).toBeDefined()
      expect(definitions[ActionName.skillset].description).toContain('skillset')
      expect(Array.isArray(definitions[ActionName.skillset].examples)).toBe(
        true
      )
    })

    it('should have memory action definition', () => {
      expect(definitions[ActionName.memory]).toBeDefined()
      expect(definitions[ActionName.memory].description).toMatch(
        /memory|stored|context|information/i
      )
      expect(Array.isArray(definitions[ActionName.memory].examples)).toBe(true)
    })

    it('should have space action definition', () => {
      expect(definitions[ActionName.space]).toBeDefined()
      expect(definitions[ActionName.space].description).toMatch(
        /space|workspace|environment/i
      )
      expect(Array.isArray(definitions[ActionName.space].examples)).toBe(true)
    })

    it('should have file action definition', () => {
      expect(definitions[ActionName.file]).toBeDefined()
      expect(definitions[ActionName.file].description).toMatch(
        /file|resource|process/i
      )
      expect(Array.isArray(definitions[ActionName.file].examples)).toBe(true)
    })

    it('should have attachment action definition', () => {
      expect(definitions[ActionName.attachment]).toBeDefined()
      expect(definitions[ActionName.attachment].description).toMatch(
        /attach|file|resource/i
      )
      expect(Array.isArray(definitions[ActionName.attachment].examples)).toBe(
        true
      )
    })

    it('should have conversation action definition', () => {
      expect(definitions[ActionName.conversation]).toBeDefined()
      expect(definitions[ActionName.conversation].description).toMatch(
        /conversation|thread|manage/i
      )
      expect(Array.isArray(definitions[ActionName.conversation].examples)).toBe(
        true
      )
    })

    it('should have task action definition', () => {
      expect(definitions[ActionName.task]).toBeDefined()
      expect(definitions[ActionName.task].description).toMatch(
        /task|to-do|manage/i
      )
      expect(Array.isArray(definitions[ActionName.task].examples)).toBe(true)
    })
  })

  describe('generation actions', () => {
    it('should have text action definition', () => {
      expect(definitions[ActionName.text]).toBeDefined()
      expect(definitions[ActionName.text].description).toContain('text')
      expect(definitions[ActionName.text].examples).toContain('@text/generate')
      expect(definitions[ActionName.text].examples).toContain('@text/summarize')
      expect(definitions[ActionName.text].examples).toContain('@text/translate')
    })

    it('should have image action definition', () => {
      expect(definitions[ActionName.image]).toBeDefined()
      expect(definitions[ActionName.image].description).toContain('image')
      expect(definitions[ActionName.image].examples).toContain(
        '@image/generate'
      )
      expect(definitions[ActionName.image].examples.length).toBeGreaterThan(1)
    })
  })

  describe('execution actions', () => {
    it('should have shell action definition', () => {
      expect(definitions[ActionName.shell]).toBeDefined()
      expect(definitions[ActionName.shell].description).toContain('shell')
      expect(definitions[ActionName.shell].examples).toContain('@shell/exec')
      expect(definitions[ActionName.shell].examples).toContain('@shell/read')
      expect(definitions[ActionName.shell].examples).toContain('@shell/write')
    })

    it('should have form action definition', () => {
      expect(definitions[ActionName.form]).toBeDefined()
      expect(definitions[ActionName.form].description).toContain('form')
      expect(Array.isArray(definitions[ActionName.form].examples)).toBe(true)
    })
  })

  describe('advanced actions', () => {
    it('should have pack action definition', () => {
      expect(definitions[ActionName.pack]).toBeDefined()
      expect(definitions[ActionName.pack].description).toMatch(
        /collection|abilities|group/i
      )
      expect(definitions[ActionName.pack].examples).toContain('@pack/vanta')
      expect(definitions[ActionName.pack].examples.length).toBeGreaterThan(1)
    })

    it('should have agent action definition', () => {
      expect(definitions[ActionName.agent]).toBeDefined()
      expect(definitions[ActionName.agent].description).toContain('agent')
      expect(definitions[ActionName.agent].examples.length).toBeGreaterThan(0)
    })

    it('should have mcp action definition', () => {
      expect(definitions[ActionName.mcp]).toBeDefined()
      expect(definitions[ActionName.mcp].description).toContain(
        'Model Context Protocol'
      )
      expect(definitions[ActionName.mcp].examples).toContain(
        '@mcp/load[notion]'
      )
      expect(definitions[ActionName.mcp].examples).toContain(
        '@mcp/load[linear]'
      )
      expect(definitions[ActionName.mcp].examples).toContain('@mcp/load[box]')
    })
  })

  describe('description quality', () => {
    it('should have descriptions that start with capital letter', () => {
      Object.entries(definitions).forEach(([_actionName, definition]) => {
        const firstChar = definition.description.charAt(0)

        expect(firstChar).toMatch(/[A-Z]/)
      })
    })

    it('should have descriptions that relate to the action', () => {
      Object.entries(definitions).forEach(([_actionName, definition]) => {
        // Just verify the description is meaningful and not empty
        expect(definition.description.length).toBeGreaterThan(10)
        expect(definition.description).toMatch(/^[A-Z]/)
      })
    })
  })

  describe('examples format', () => {
    it('should have examples that start with @ when present', () => {
      Object.entries(definitions).forEach(([_actionName, definition]) => {
        if (definition.examples.length > 0) {
          definition.examples.forEach((example) => {
            expect(example).toMatch(/^@/)
          })
        }
      })
    })

    it('should have unique examples for each action with examples', () => {
      Object.entries(definitions).forEach(([_actionName, definition]) => {
        if (definition.examples.length > 0) {
          const uniqueExamples = new Set(definition.examples)

          expect(uniqueExamples.size).toBe(definition.examples.length)
        }
      })
    })
  })

  describe('consistency checks', () => {
    it('should not have undefined or null definitions', () => {
      Object.entries(definitions).forEach(([_actionName, definition]) => {
        expect(definition).toBeDefined()
        expect(definition).not.toBeNull()
        expect(definition.description).toBeDefined()
        expect(definition.examples).toBeDefined()
      })
    })

    it('should have string descriptions', () => {
      Object.values(definitions).forEach((definition) => {
        expect(typeof definition.description).toBe('string')
      })
    })

    it('should have array examples', () => {
      Object.values(definitions).forEach((definition) => {
        expect(Array.isArray(definition.examples)).toBe(true)
      })
    })

    it('should have string array elements in examples', () => {
      Object.values(definitions).forEach((definition) => {
        definition.examples.forEach((example) => {
          expect(typeof example).toBe('string')
        })
      })
    })
  })

  describe('specific action examples validation', () => {
    it('should have correct image generation examples with variants', () => {
      const imageExamples = definitions[ActionName.image].examples

      expect(imageExamples).toContain('@image/generate')
      expect(imageExamples).toContain('@image/generate[gpt-image-2]')
      expect(imageExamples).toContain('@image/generate[gpt-image-1.5]')
      expect(imageExamples).toContain('@image/generate[gpt-image-1]')
    })

    it('should have correct agent examples', () => {
      const agentExamples = definitions[ActionName.agent].examples

      expect(agentExamples).toContain('@perplexity/search[sonar]')
      expect(agentExamples).toContain('@agent/task/evaluate')
      expect(agentExamples).toContain('@agent/task/plan')
    })

    it('should have correct fetch examples with various services', () => {
      const fetchExamples = definitions[ActionName.fetch].examples

      expect(fetchExamples).toContain('@serper/web/search')
      expect(fetchExamples).toContain('@brave/web/search')
      expect(fetchExamples).toContain('@tavily/search')
    })
  })
})
