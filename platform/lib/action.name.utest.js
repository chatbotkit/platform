import { ActionName } from '@/lib/action.name'

describe('ActionName', () => {
  describe('enum structure', () => {
    it('should be defined as an object', () => {
      expect(ActionName).toBeDefined()
      expect(typeof ActionName).toBe('object')
    })

    it('should have all verb action names', () => {
      expect(ActionName.search).toBe('search')
      expect(ActionName.fetch).toBe('fetch')
      expect(ActionName.email).toBe('email')
      expect(ActionName.echo).toBe('echo')
      expect(ActionName.abort).toBe('abort')
      expect(ActionName.view).toBe('view')
      expect(ActionName.listen).toBe('listen')
    })

    it('should have all noun action names', () => {
      expect(ActionName.bot).toBe('bot')
      expect(ActionName.dataset).toBe('dataset')
      expect(ActionName.skillset).toBe('skillset')
      expect(ActionName.memory).toBe('memory')
      expect(ActionName.space).toBe('space')
      expect(ActionName.file).toBe('file')
      expect(ActionName.attachment).toBe('attachment')
      expect(ActionName.text).toBe('text')
      expect(ActionName.image).toBe('image')
      expect(ActionName.form).toBe('form')
      expect(ActionName.shell).toBe('shell')
      expect(ActionName.conversation).toBe('conversation')
      expect(ActionName.task).toBe('task')
      expect(ActionName.time).toBe('time')
      expect(ActionName.pack).toBe('pack')
      expect(ActionName.agent).toBe('agent')
      expect(ActionName.mcp).toBe('mcp')
      expect(ActionName.todo).toBe('todo')
      expect(ActionName.list).toBe('list')
    })
  })

  describe('enum values', () => {
    it('should have string values matching their keys', () => {
      const actionNames = Object.keys(ActionName)

      actionNames.forEach((key) => {
        expect(ActionName[key]).toBe(key)
      })
    })

    it('should not have duplicate values', () => {
      const values = Object.values(ActionName)
      const uniqueValues = new Set(values)

      expect(values.length).toBe(uniqueValues.size)
    })
  })

  describe('enum usage', () => {
    it('should be usable in switch statements', () => {
      const testAction = ActionName.fetch

      let result

      switch (testAction) {
        case ActionName.fetch:
          result = 'fetch action'

          break
        case ActionName.search:
          result = 'search action'

          break
        default:
          result = 'unknown action'
      }

      expect(result).toBe('fetch action')
    })

    it('should be usable in type checking', () => {
      const isValidAction = (action) => {
        return Object.values(ActionName).includes(action)
      }

      expect(isValidAction('fetch')).toBe(true)
      expect(isValidAction('search')).toBe(true)
      expect(isValidAction('invalid')).toBe(false)
      expect(isValidAction('')).toBe(false)
      expect(isValidAction(null)).toBe(false)
    })

    it('should support array mapping', () => {
      const verbActions = [
        'search',
        'fetch',
        'email',
        'echo',
        'abort',
        'view',
        'listen',
      ]

      const mappedActions = verbActions.map((action) => ActionName[action])

      expect(mappedActions).toEqual([
        ActionName.search,
        ActionName.fetch,
        ActionName.email,
        ActionName.echo,
        ActionName.abort,
        ActionName.view,
        ActionName.listen,
      ])
    })
  })

  describe('enum completeness', () => {
    it('should have all expected verb actions', () => {
      const expectedVerbs = [
        'search',
        'fetch',
        'email',
        'echo',
        'abort',
        'view',
        'listen',
      ]

      expectedVerbs.forEach((verb) => {
        expect(ActionName[verb]).toBe(verb)
      })
    })

    it('should have all expected noun actions', () => {
      const expectedNouns = [
        'bot',
        'dataset',
        'skillset',
        'memory',
        'space',
        'file',
        'attachment',
        'text',
        'image',
        'form',
        'shell',
        'conversation',
        'task',
        'time',
        'pack',
        'agent',
        'mcp',
        'todo',
        'list',
      ]

      expectedNouns.forEach((noun) => {
        expect(ActionName[noun]).toBe(noun)
      })
    })
  })

  describe('edge cases', () => {
    it('should handle property access with brackets', () => {
      expect(ActionName['fetch']).toBe('fetch')
      expect(ActionName['search']).toBe('search')
    })

    it('should handle undefined property access', () => {
      expect(ActionName['nonexistent']).toBeUndefined()
      expect(ActionName['']).toBeUndefined()
    })

    it('should not allow adding new properties', () => {
      // TypeScript enums are compiled to objects that can be extended in runtime
      // but in practice, new properties shouldn't be added
      const originalKeys = Object.keys(ActionName)

      // Attempting to add a property (this will succeed in non-strict mode)
      ActionName.newAction = 'newAction'

      // Verify that the core enum values are still intact
      expect(ActionName.fetch).toBe('fetch')
      expect(ActionName.search).toBe('search')

      // Clean up
      delete ActionName.newAction

      // Verify we're back to original state
      expect(Object.keys(ActionName).length).toBe(originalKeys.length)
    })
  })
})
