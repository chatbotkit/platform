import { transformAutomaticInstruction } from '@/lib/instruction.transform.automatic'

describe('transformAutomaticInstruction', () => {
  it('should return null as automatic instructions are not implemented yet', async () => {
    const instruction = 'test instruction'
    const input = 'test input'
    const options = { userId: 'test-user' }

    // @note automatic instructions are not fully implemented yet so the
    // transform returns null - similar to how extractAutomaticInstructionFields
    // returns an empty array

    await expect(
      transformAutomaticInstruction(instruction, input, options)
    ).resolves.toBeNull()
  })
})
