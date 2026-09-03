;(function () {
  function load(meta: { mcpserverIntegrationId?: string }) {
    const { mcpserverIntegrationId } = meta

    if (!mcpserverIntegrationId) {
      return
    }

    const script = document.currentScript as HTMLScriptElement | null

    if (!script) {
      return
    }

    const frame = document.createElement('iframe')

    frame.src = new URL(
      `/integrations/mcpserver/${mcpserverIntegrationId}/frame`,
      new URL(script.src).origin
    ).href

    frame.style.border = 'none'
    frame.style.width = '100%'
    frame.style.height = '100%'

    document.body.innerHTML = ''
    document.body.appendChild(frame)

    // @todo automatically control the height of the iframe
  }

  function render() {
    const body = document.body
    const meta = window.openai?.toolResponseMetadata?._meta || {}

    load(meta as { mcpserverIntegrationId?: string })

    // @note notifyIntrinsicHeight takes a number, not an object

    if (window.openai?.notifyIntrinsicHeight) {
      window.openai.notifyIntrinsicHeight(body.scrollHeight)

      // @todo monitor for changes and notify again
    }
  }

  render()

  window.addEventListener('openai:set_globals', render)
})()
