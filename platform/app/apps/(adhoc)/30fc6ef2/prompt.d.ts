declare module '*.yaml' {
  interface Prompts {
    orchestrator: string
  }

  const prompts: Prompts

  export default prompts
}
