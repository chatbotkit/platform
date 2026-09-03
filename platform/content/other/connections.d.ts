declare module '@/content/other/connections.yaml' {
  export interface ConnectionPage {
    title: string
    description?: string
    content: string
    start?: string
  }

  export type Connections = Record<string, ConnectionPage>

  const connections: Connections

  export default connections
}
