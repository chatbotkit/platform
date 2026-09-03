import { unpackTemplateInstruction } from '@/lib/instruction.template.unpack'

describe('unpackTemplateInstruction', () => {
  it('should find existing template by exact ID match', () => {
    // @note using a known template from the abilities catalogue

    const result = unpackTemplateInstruction('github/repository/list')

    expect(result).toBeDefined()
    expect(result).toHaveProperty('provider', 'github')
    expect(result).toHaveProperty('name', 'List GitHub Repositories')
    expect(result).toHaveProperty('instruction')
  })

  it('should handle case-insensitive lookup', () => {
    const result = unpackTemplateInstruction('GITHUB/REPOSITORY/LIST')

    expect(result).toBeDefined()
    expect(result).toHaveProperty('provider', 'github')
    expect(result).toHaveProperty('name', 'List GitHub Repositories')
  })

  it('should handle whitespace in ID', () => {
    const result = unpackTemplateInstruction('  github/repository/list  ')

    expect(result).toBeDefined()
    expect(result).toHaveProperty('provider', 'github')
  })

  it('should return null for non-existent template', () => {
    const result = unpackTemplateInstruction('nonexistent/template/id')

    expect(result).toBeNull()
  })

  it('should return null for empty ID', () => {
    const result = unpackTemplateInstruction('')

    expect(result).toBeNull()
  })

  it('should return null for whitespace-only ID', () => {
    const result = unpackTemplateInstruction('   ')

    expect(result).toBeNull()
  })

  it('should find slack templates', () => {
    // @note using another known template to verify catalogue access

    const result = unpackTemplateInstruction('slack/message/send')

    expect(result).toBeDefined()
    expect(result).toHaveProperty('provider', 'slack')
    expect(result).toHaveProperty('name')
    expect(result).toHaveProperty('instruction')
  })

  it('should find google templates', () => {
    const result = unpackTemplateInstruction('google/calendar/list')

    expect(result).toBeDefined()
    expect(result).toHaveProperty('provider', 'google')
    expect(result).toHaveProperty('name')
  })

  it('should handle partial template ID matches', () => {
    // @note only exact matches are supported, partial matches return null

    const result = unpackTemplateInstruction('github/repository')

    expect(result).toBeNull()
  })

  it('should handle template IDs with special characters', () => {
    // @note testing that lookup handles IDs that might contain special chars

    const result = unpackTemplateInstruction(
      'github/repository/list/special-chars'
    )

    expect(result).toBeNull()
  })
})
