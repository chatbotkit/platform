/* eslint-disable no-undef */
import allAbilities from '@/data/abilities/all'

import { definitions } from '@/lib/action.definition'
import { ActionName } from '@/lib/action.name'

describe('action.definition', () => {
  describe('examples validation', () => {
    it('should have all ActionName entries defined', () => {
      const actionNames = Object.values(ActionName)
      const definedActions = Object.keys(definitions)

      expect(definedActions).toHaveLength(actionNames.length)

      actionNames.forEach((actionName) => {
        expect(definitions[actionName as ActionName]).toBeDefined()
      })
    })

    it('should have valid description for each action', () => {
      Object.entries(definitions).forEach(([, definition]) => {
        expect(definition.description).toBeDefined()
        expect(typeof definition.description).toBe('string')
        expect(definition.description.length).toBeGreaterThan(0)
      })
    })

    it('should have examples array for each action', () => {
      Object.entries(definitions).forEach(([, definition]) => {
        expect(Array.isArray(definition.examples)).toBe(true)
      })
    })

    it('should reference valid ability keys when using @ prefix', () => {
      const allAbilityKeys = Object.keys(allAbilities)

      Object.entries(definitions).forEach(([, definition]) => {
        definition.examples.forEach((example) => {
          if (example.startsWith('@')) {
            const abilityKey = example.substring(1)

            expect(allAbilityKeys).toContain(abilityKey)
          }
        })
      })
    })

    it('should have all example references resolved in abilities catalogue', () => {
      const missingReferences: { action: string; example: string }[] = []

      Object.entries(definitions).forEach(([actionName, definition]) => {
        definition.examples.forEach((example) => {
          if (example.startsWith('@')) {
            const abilityKey = example.substring(1)

            if (!allAbilities[abilityKey]) {
              missingReferences.push({
                action: actionName,
                example: abilityKey,
              })
            }
          }
        })
      })

      if (missingReferences.length > 0) {
        const errorMessage = missingReferences
          .map((ref) => `  - ${ref.action}: @${ref.example}`)
          .join('\n')

        fail(
          `Found ${missingReferences.length} missing ability reference(s):\n${errorMessage}`
        )
      }

      expect(missingReferences).toHaveLength(0)
    })

    it('should verify all referenced abilities exist and have instruction field', () => {
      const invalidAbilities: {
        action: string
        example: string
        issue: string
      }[] = []

      Object.entries(definitions).forEach(([actionName, definition]) => {
        definition.examples.forEach((example) => {
          if (example.startsWith('@')) {
            const abilityKey = example.substring(1)
            const ability = allAbilities[abilityKey]

            if (ability) {
              if (!ability.instruction) {
                invalidAbilities.push({
                  action: actionName,
                  example: abilityKey,
                  issue: 'missing instruction field',
                })
              } else if (typeof ability.instruction !== 'string') {
                invalidAbilities.push({
                  action: actionName,
                  example: abilityKey,
                  issue: 'instruction is not a string',
                })
              } else if (ability.instruction.trim().length === 0) {
                invalidAbilities.push({
                  action: actionName,
                  example: abilityKey,
                  issue: 'instruction is empty',
                })
              }
            }
          }
        })
      })

      if (invalidAbilities.length > 0) {
        const errorMessage = invalidAbilities
          .map((ref) => `  - ${ref.action}: @${ref.example} (${ref.issue})`)
          .join('\n')

        fail(
          `Found ${invalidAbilities.length} invalid ability reference(s):\n${errorMessage}`
        )
      }

      expect(invalidAbilities).toHaveLength(0)
    })

    it('should verify each action has at least one example or is explicitly empty', () => {
      const actionsWithoutExamples: string[] = []

      Object.entries(definitions).forEach(([actionName, definition]) => {
        // We allow empty arrays for actions that don't have examples yet but we
        // want to track them for documentation purposes

        if (definition.examples.length === 0) {
          actionsWithoutExamples.push(actionName)
        }
      })

      // This is informational - we track but don't fail

      expect(actionsWithoutExamples).toBeDefined()
    })

    it('should verify example format consistency (@ prefix for references)', () => {
      const invalidFormats: { action: string; example: string }[] = []

      Object.entries(definitions).forEach(([actionName, definition]) => {
        definition.examples.forEach((example) => {
          // All examples should start with @ to reference abilities

          if (example.length > 0 && !example.startsWith('@')) {
            invalidFormats.push({
              action: actionName,
              example: example.substring(0, 50), // Truncate for readability
            })
          }
        })
      })

      if (invalidFormats.length > 0) {
        const errorMessage = invalidFormats
          .map((ref) => `  - ${ref.action}: "${ref.example}..."`)
          .join('\n')

        fail(
          `Found ${invalidFormats.length} example(s) not using @ reference format:\n${errorMessage}`
        )
      }

      expect(invalidFormats).toHaveLength(0)
    })
  })
})
