declare module '@/data/abilities/catalogue/*.yaml' {
  export interface AbilityTemplate {
    provider: string

    icon: string

    name: string
    description: string
    instruction: string

    commentary?: string
    setup?: string

    tags?: string[]

    secret?: string
    file?: string
    space?: string
    bot?: string
  }

  const abilityTemplates: Record<string, AbilityTemplate>

  export default abilityTemplates
}
