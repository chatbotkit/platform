import { MAX_DB_TEXT_BYTES_LENGTH } from '@/prisma/constraints'

import abilityInstructionSchema from '@/schemas/abilityInstruction'

const itIfTextLengthIsConstrained =
  MAX_DB_TEXT_BYTES_LENGTH <= 1000000 ? it : it.skip

describe('abilityInstructionSchema', () => {
  it('should validate a valid ability instruction', () => {
    const validInstruction =
      'Execute the following API call to get user data: GET /api/users/{id}'
    const result = abilityInstructionSchema.validate(validInstruction)

    expect(result).toEqual({ value: validInstruction })
  })

  it('should allow empty strings', () => {
    const result = abilityInstructionSchema.validate('')

    expect(result).toEqual({ value: '' })
  })

  itIfTextLengthIsConstrained(
    'should validate an instruction at maximum byte length',
    () => {
      // Create a string that is exactly at the byte limit
      const maxLengthInstruction = 'a'.repeat(MAX_DB_TEXT_BYTES_LENGTH)
      const result = abilityInstructionSchema.validate(maxLengthInstruction)

      expect(result).toEqual({ value: maxLengthInstruction })
    }
  )

  itIfTextLengthIsConstrained(
    'should reject an instruction exceeding maximum byte length',
    () => {
      // Create a string that exceeds the byte limit
      const oversizedInstruction = 'a'.repeat(MAX_DB_TEXT_BYTES_LENGTH + 1)
      const result = abilityInstructionSchema.validate(oversizedInstruction)

      expect(result.error).toBeDefined()
      expect(result.error.message).toContain('bytes long')
    }
  )

  it('should handle complex API instructions', () => {
    const apiInstruction = `
\`\`\`fetch
method: POST
url: https://api.example.com/users
headers:
  Authorization: Bearer {{token}}
  Content-Type: application/json
body:
  name: {{user.name}}
  email: {{user.email}}
\`\`\`
    `
    const result = abilityInstructionSchema.validate(apiInstruction)

    expect(result).toEqual({ value: apiInstruction.trim() })
  })

  it('should handle multiline instructions with templates', () => {
    const templateInstruction = `Execute the following steps:
1. Validate input parameters: {{param1}}, {{param2}}
2. Make API call: POST /api/endpoint
3. Process response data
4. Return formatted result`
    const result = abilityInstructionSchema.validate(templateInstruction)

    expect(result).toEqual({ value: templateInstruction.trim() })
  })

  it('should handle JSON-formatted instructions', () => {
    const jsonInstruction = `{
  "action": "fetch",
  "url": "https://api.service.com/data",
  "method": "GET",
  "parameters": {
    "userId": "{{userId}}",
    "format": "json"
  }
}`
    const result = abilityInstructionSchema.validate(jsonInstruction)

    expect(result).toEqual({ value: jsonInstruction.trim() })
  })

  it('should handle shell command instructions', () => {
    const shellInstruction = `#!/bin/bash
# Execute file processing
cp {{input_file}} /tmp/processing/
./process_file.sh /tmp/processing/{{input_file}}
echo "Processing complete"`
    const result = abilityInstructionSchema.validate(shellInstruction)

    expect(result).toEqual({ value: shellInstruction.trim() })
  })

  it('should handle SQL query instructions', () => {
    const sqlInstruction = `SELECT u.id, u.name, u.email, p.preferences 
FROM users u 
LEFT JOIN profiles p ON u.id = p.user_id 
WHERE u.active = 1 AND u.id = {{user_id}}
LIMIT 1`
    const result = abilityInstructionSchema.validate(sqlInstruction)

    expect(result).toEqual({ value: sqlInstruction.trim() })
  })

  it('should handle instruction templates with variables', () => {
    const templateInstruction = `Process user {{user.id}} with parameters:
- Name: {{user.name}}
- Email: {{user.email}}
- Action: {{action_type}}
- Timestamp: {{current_time}}`
    const result = abilityInstructionSchema.validate(templateInstruction)

    expect(result).toEqual({ value: templateInstruction.trim() })
  })

  it('should trim whitespace from instructions', () => {
    const instructionWithWhitespace =
      '   Execute API call: GET /api/data   \n\n  '
    const result = abilityInstructionSchema.validate(instructionWithWhitespace)

    expect(result).toEqual({ value: 'Execute API call: GET /api/data' })
  })

  itIfTextLengthIsConstrained(
    'should handle unicode characters correctly for byte length',
    () => {
      // Unicode characters can take multiple bytes
      // '🚀' takes 4 bytes in UTF-8
      const oversizedUnicodeInstruction = '🚀'.repeat(
        Math.floor(MAX_DB_TEXT_BYTES_LENGTH / 4) + 1
      )
      const result = abilityInstructionSchema.validate(
        oversizedUnicodeInstruction
      )

      expect(result.error).toBeDefined()
      expect(result.error.message).toContain('bytes long')
    }
  )

  it('should reject null values', () => {
    const result = abilityInstructionSchema.validate(null)

    expect(result.error).toBeDefined()
    expect(result.error.message).toContain('string')
  })

  it('should reject non-string values', () => {
    const result = abilityInstructionSchema.validate(123)

    expect(result.error).toBeDefined()
    expect(result.error.message).toContain('string')
  })

  it('should reject arrays', () => {
    const result = abilityInstructionSchema.validate(['instruction', 'text'])

    expect(result.error).toBeDefined()
    expect(result.error.message).toContain('string')
  })

  it('should handle special characters and symbols', () => {
    const specialInstruction =
      'Execute: curl -X POST "https://api.example.com/webhook" -H "Content-Type: application/json" -d \'{"event": "user_created"}\''
    const result = abilityInstructionSchema.validate(specialInstruction)

    expect(result).toEqual({ value: specialInstruction })
  })

  it('should handle code block instructions', () => {
    const codeInstruction = `\`\`\`python
import requests

def fetch_user_data(user_id):
    url = f"https://api.example.com/users/{user_id}"
    response = requests.get(url)
    return response.json()
\`\`\``
    const result = abilityInstructionSchema.validate(codeInstruction)

    expect(result).toEqual({ value: codeInstruction.trim() })
  })
})
