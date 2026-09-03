import {
  extractAutomaticInstructionFields,
  substituteAutomaticInstructionFields,
} from '@/lib/instruction.extract.automatic'

describe('extractAutomaticInstructionFields', () => {
  it('should return empty array for automatic instructions', async () => {
    const instruction = 'test instruction'

    expect(extractAutomaticInstructionFields(instruction)).toEqual([])
  })
})

describe('substituteAutomaticInstructionFields', () => {
  it('should return the instruction unchanged when field values are provided', () => {
    const instruction = 'do something {{field}}'
    const fieldValues = { field: 'value' }

    expect(substituteAutomaticInstructionFields(instruction, fieldValues)).toBe(
      instruction
    )
  })

  it('should return the instruction unchanged with empty field values', () => {
    const instruction = 'do something with no placeholders'

    expect(substituteAutomaticInstructionFields(instruction, {})).toBe(
      instruction
    )
  })

  it('should return an empty string unchanged', () => {
    expect(substituteAutomaticInstructionFields('', {})).toBe('')
  })

  it('should return the exact same string reference', () => {
    const instruction = 'some instruction text'

    const result = substituteAutomaticInstructionFields(instruction, {
      key: 'value',
    })

    expect(result).toBe(instruction)
  })
})
