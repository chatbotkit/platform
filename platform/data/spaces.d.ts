declare module '@/data/spaces.yaml' {
  export interface SpaceTemplate {
    icon?: string
    name: string
    description: string
  }

  const spaceTemplates: Record<string, SpaceTemplate>

  export default spaceTemplates
}
