declare module '@/prompts/*.yaml' {
  export interface Prompt {
    description: string
    prompt: string
    model: string
    output?: 'text' | 'json' | 'schema'
    schema?: React<string, any>
    stop?: string[]
  }

  const prompt: Prompt

  export default prompt
}
