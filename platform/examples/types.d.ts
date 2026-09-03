declare module '@/examples/catalogue/*.yaml' {
  export interface Example {
    slug?: string

    icon: string

    title: string
    description: string

    keywords: Array<string>

    date: Date

    url?: string

    share?: string

    commentary?: string

    backstory: string
    backstoryExtra?: string

    model: string

    dataset?:
      | { id: string }
      | {
          name?: string
          description?: string
          records: Array<{
            name: string
            description: string
            text: string
          }>
        }

    skillset?:
      | { id: string }
      | {
          name?: string
          description?: string
          abilities: Array<{
            name: string
            description: string
            instruction: string
          }>
        }

    secrets?: Array<{
      name?: string
      description?: string
      value?: string
    }>

    intro?: string
    initial?: string

    messages?: Array<{ type: 'intro' | 'bot' | 'user'; text: string }>

    link?: string

    theme?: string | { name: string; config: object }

    exported?: boolean

    // @todo move widget related props here

    widget?: {
      intro?: string
      initial?: string
      math?: boolean
    }

    blueprint?: {
      resources: Record<string, { type: string; data: Record<string, any> }>
      positions?: Record<string, { x: number; y: number }>
      notes?: Record<
        string,
        {
          data: Record<string, { text: string }>
          position: { x: number; y: number }
        }
      >
    }

    files?: Array<{
      path: string
      content: string
    }>

    integration?:
      | 'widget'
      | 'slack'
      | 'discord'
      | 'whatsapp'
      | 'messenger'
      | 'telegram'
      | 'twilio'
      | 'email'
      | 'trigger'

    // examples that will be featured in the main examples list

    featured?: boolean

    // promoted examples are used to highlight widgets on specific pages and in
    // marketing materials - i.e. / and /widgets - and, for blueprint entries,
    // to pick the solutions grid on /

    promoted?: boolean

    // builder examples are practical, channel-ready solutions suitable to
    // suggest inside the builder experience - i.e. the overview examples tab.
    // promoted blueprint entries should also be builder

    builder?: boolean

    // live examples are working widgets embedded in the example page

    live?: boolean
    liveBackstory?: string

    // demo examples are complete apps with embedded widgets that can be access
    // on a separate URL

    demo?: boolean
    demoBackstory?: string

    // hub examples are pointers to a published hub page (e.g. a blueprint)
    // rather than a self-contained, hosted example. they appear in the examples
    // gallery, but their card links to the hub page - which already provides
    // clone and visit - and /examples/[slug] redirects there. nothing is copied;
    // only the listing metadata (icon, title, description, keywords) lives here.

    hub?: {
      type: 'blueprint'
      ref: string
    }

    // hidden examples do not appear in the official examples list, but can be
    // accessed directly via their URL or used internally

    hidden?: boolean
  }

  const examples: Array<Example>

  export default examples
}
