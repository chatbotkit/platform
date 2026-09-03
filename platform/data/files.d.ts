declare module '@/data/files.yaml' {
  export interface FileTemplate {
    icon?: string
    name: string
    description: string
  }

  const fileTemplates: Record<string, FileTemplate>

  export default fileTemplates
}
