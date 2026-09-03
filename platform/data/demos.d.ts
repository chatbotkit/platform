declare module '@/data/demos.yaml' {
  export interface DemoMessage {
    id: number
    type: 'user' | 'bot'
    text: string
  }

  export interface Demo {
    keywords?: string[]
    intro?: string
    initial?: string
    messages: DemoMessage[]
  }

  const demos: Record<string, Demo>

  export default demos
}
