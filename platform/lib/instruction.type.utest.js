import {
  getInstructionType,
  isComplexInstruction,
  isSimpleInstruction,
  isStructuredInstruction,
  isTemplateInstruction,
} from '@/lib/instruction.type'

describe('isStructuredInstruction', () => {
  it('should return true for action key with !fetch tag', () => {
    const instruction = `action: !fetch
  method: GET
  url: https://api.example.com`

    const result = isStructuredInstruction(instruction)

    expect(result).toEqual(true)
  })

  it('should return true for root-level !fetch tag', () => {
    const instruction = `!fetch
method: POST
url: https://api.example.com`

    const result = isStructuredInstruction(instruction)

    expect(result).toEqual(true)
  })

  it('should return true for action key with !pack.install tag', () => {
    const instruction = `action: !pack.install
  abilities:
    - ability1`

    const result = isStructuredInstruction(instruction)

    expect(result).toEqual(true)
  })

  it('should return true for root-level !pack.install tag', () => {
    const instruction = `!pack.install
abilities:
  - ability1`

    const result = isStructuredInstruction(instruction)

    expect(result).toEqual(true)
  })

  it('should return true for action key with !skillset.install tag', () => {
    const instruction = `action: !skillset.install
  skillsetId: abc123`

    const result = isStructuredInstruction(instruction)

    expect(result).toEqual(true)
  })

  it('should return true for root-level !skillset.install tag', () => {
    const instruction = `!skillset.install
skillsetId: abc123
prefix: my-prefix`

    const result = isStructuredInstruction(instruction)

    expect(result).toEqual(true)
  })

  it('should return true for action key with !mcp.install tag', () => {
    const instruction = `action: !mcp.install
  url: https://mcp.example.com`

    const result = isStructuredInstruction(instruction)

    expect(result).toEqual(true)
  })

  it('should return true for root-level !mcp.install tag', () => {
    const instruction = `!mcp.install
url: https://mcp.example.com
prefix: my-prefix`

    const result = isStructuredInstruction(instruction)

    expect(result).toEqual(true)
  })

  it('should return false for regular YAML without action tags', () => {
    const instruction = `config:
  setting: value`

    const result = isStructuredInstruction(instruction)

    expect(result).toEqual(false)
  })

  it('should return false for YAML with action key but no action tag', () => {
    const instruction = `action:
  type: fetch
  url: https://api.example.com`

    const result = isStructuredInstruction(instruction)

    expect(result).toEqual(false)
  })

  it('should return false for template instructions', () => {
    const instruction = `template: google/calendar/search
parameters:
  query: test`

    const result = isStructuredInstruction(instruction)

    expect(result).toEqual(false)
  })

  it('should return false for shorthand template notation', () => {
    const instruction = '@google/calendar/book'

    const result = isStructuredInstruction(instruction)

    expect(result).toEqual(false)
  })

  it('should return false for code block instructions', () => {
    const instruction = '```fetch\nmethod: GET\n```'

    const result = isStructuredInstruction(instruction)

    expect(result).toEqual(false)
  })

  it('should return false for plain text', () => {
    const instruction = 'Just some plain text.'

    const result = isStructuredInstruction(instruction)

    expect(result).toEqual(false)
  })

  it('should return false for empty string', () => {
    const instruction = ''

    const result = isStructuredInstruction(instruction)

    expect(result).toEqual(false)
  })

  it('should return false for invalid YAML', () => {
    const instruction = 'invalid: yaml: structure: {'

    const result = isStructuredInstruction(instruction)

    expect(result).toEqual(false)
  })

  it('should handle structured instruction with dynamic fields', () => {
    const instruction = `action: !fetch
  url: !string
    name: apiUrl
    description: The API URL`

    const result = isStructuredInstruction(instruction)

    expect(result).toEqual(true)
  })

  it('should handle whitespace around structured instruction', () => {
    const instruction = `
  
!fetch
method: GET
url: https://api.example.com

  `

    const result = isStructuredInstruction(instruction)

    expect(result).toEqual(true)
  })
})

describe('isComplexInstruction', () => {
  it('should return true for complex instructions', () => {
    const instruction = '```fetch\n```\n\nAnd some other text.'

    const result = isComplexInstruction(instruction)

    expect(result).toEqual(true)
  })

  it('should return false for non-complex instructions', () => {
    const instruction =
      '```search/datasetId=clvmk6ksl0039vsm3k5wve3pp\n${query|The search query related to search for information}\n```'

    const result = isComplexInstruction(instruction)

    expect(result).toEqual(false)
  })

  it('should return true for multiple actions', () => {
    const instruction = '```fetch\n```\n```search\n```'

    const result = isComplexInstruction(instruction)

    expect(result).toEqual(true)
  })

  it('should return true for single action with text', () => {
    const instruction = '```fetch\n```\nSome explanatory text.'

    const result = isComplexInstruction(instruction)

    expect(result).toEqual(true)
  })

  it('should return false for empty instruction', () => {
    const instruction = ''

    const result = isComplexInstruction(instruction)

    expect(result).toEqual(false)
  })

  it('should return false for text only without actions', () => {
    const instruction = 'Just some text without any actions.'

    const result = isComplexInstruction(instruction)

    expect(result).toEqual(false)
  })
})

describe('isSimpleInstruction', () => {
  it('should return true for simple instructions', () => {
    const instruction = '```fetch\n```\n\n'

    const result = isSimpleInstruction(instruction)

    expect(result).toEqual(true)
  })

  it('should return false for non-simple instructions', () => {
    const instruction = '```fetch```\n\nAnd some other text.'

    const result = isSimpleInstruction(instruction)

    expect(result).toEqual(false)
  })

  it('should return true for single action without text', () => {
    const instruction = '```search\nquery: test\n```'

    const result = isSimpleInstruction(instruction)

    expect(result).toEqual(true)
  })

  it('should return false for multiple actions', () => {
    const instruction = '```fetch\n```\n```search\n```'

    const result = isSimpleInstruction(instruction)

    expect(result).toEqual(false)
  })

  it('should return false for empty instruction', () => {
    const instruction = ''

    const result = isSimpleInstruction(instruction)

    expect(result).toEqual(false)
  })

  it('should return false for action with additional text', () => {
    const instruction = '```fetch\n```\nAdditional text here.'

    const result = isSimpleInstruction(instruction)

    expect(result).toEqual(false)
  })
})

describe('isTemplateInstruction', () => {
  it('should return true for YAML template with template key', () => {
    const instruction = 'template: google/calendar/book\nparams:\n  id: 123'

    const result = isTemplateInstruction(instruction)

    expect(result).toEqual(true)
  })

  it('should return true for shorthand template notation', () => {
    const instruction = '@google/calendar/book'

    const result = isTemplateInstruction(instruction)

    expect(result).toEqual(true)
  })

  it('should return false for non-template YAML', () => {
    const instruction = 'config:\n  setting: value\nother: data'

    const result = isTemplateInstruction(instruction)

    expect(result).toEqual(false)
  })

  it('should return false for invalid YAML', () => {
    const instruction = 'invalid: yaml: structure: {'

    const result = isTemplateInstruction(instruction)

    expect(result).toEqual(false)
  })

  it('should return false for regular text', () => {
    const instruction = 'This is just regular text without template structure.'

    const result = isTemplateInstruction(instruction)

    expect(result).toEqual(false)
  })

  it('should return false for action blocks', () => {
    const instruction = '```fetch\nmethod: GET\n```'

    const result = isTemplateInstruction(instruction)

    expect(result).toEqual(false)
  })

  it('should return true for shorthand with multiline (edge case)', () => {
    const instruction = '@google/calendar/book\nwith some extra content'

    const result = isTemplateInstruction(instruction)

    expect(result).toEqual(false) // Should be false for multiline shorthand
  })
})

describe('getInstructionType', () => {
  it('should return "structured" for action key with !fetch tag', () => {
    const instruction = `action: !fetch
  method: GET
  url: https://api.example.com`

    const result = getInstructionType(instruction)

    expect(result).toEqual('structured')
  })

  it('should return "structured" for root-level !fetch tag', () => {
    const instruction = `!fetch
method: POST
url: https://api.example.com`

    const result = getInstructionType(instruction)

    expect(result).toEqual('structured')
  })

  it('should return "structured" for !pack.install tag', () => {
    const instruction = `!pack.install
abilities:
  - ability1`

    const result = getInstructionType(instruction)

    expect(result).toEqual('structured')
  })

  it('should prioritize structured over template', () => {
    // Structured instructions take precedence
    const instruction = `!mcp.install
url: https://mcp.example.com`

    const result = getInstructionType(instruction)

    expect(result).toEqual('structured')
  })

  it('should return "template" for template instructions', () => {
    const instruction = 'template: google/calendar/book\nparams:\n  id: 123'

    const result = getInstructionType(instruction)

    expect(result).toEqual('template')
  })

  it('should return "template" for shorthand template notation', () => {
    const instruction = '@google/calendar/book'

    const result = getInstructionType(instruction)

    expect(result).toEqual('template')
  })

  it('should return "complex" for complex instructions', () => {
    const instruction = '```fetch\n```\n\nAdditional text here.'

    const result = getInstructionType(instruction)

    expect(result).toEqual('complex')
  })

  it('should return "simple" for simple instructions', () => {
    const instruction = '```fetch\nmethod: GET\n```'

    const result = getInstructionType(instruction)

    expect(result).toEqual('simple')
  })

  it('should return "automatic" for instructions that don\'t match other types', () => {
    const instruction = 'Just some regular text without any structure.'

    const result = getInstructionType(instruction)

    expect(result).toEqual('automatic')
  })

  it('should return "automatic" for empty instruction', () => {
    const instruction = ''

    const result = getInstructionType(instruction)

    expect(result).toEqual('automatic')
  })

  it('should prioritize template over other types', () => {
    // This is an edge case where instruction could be interpreted as multiple types
    const instruction = 'template: "some/template"'

    const result = getInstructionType(instruction)

    expect(result).toEqual('template')
  })

  it('should prioritize complex over simple', () => {
    const instruction = '```fetch\n```\n```search\n```'

    const result = getInstructionType(instruction)

    expect(result).toEqual('complex')
  })

  it('should handle complex instruction with text and action', () => {
    const instruction = 'Here is some text.\n```fetch\nmethod: POST\n```'

    const result = getInstructionType(instruction)

    expect(result).toEqual('complex')
  })

  it('should handle whitespace-only instruction', () => {
    const instruction = '   \n  \t  \n   '

    const result = getInstructionType(instruction)

    expect(result).toEqual('automatic')
  })
})
