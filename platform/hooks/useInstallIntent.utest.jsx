import useInstallIntent from './useInstallIntent'

import { renderHook } from '@testing-library/react'

function visit(url) {
  window.history.replaceState(null, '', url)
}

describe('useInstallIntent', () => {
  beforeEach(() => {
    visit('/integrations/slack/si1')
  })

  it('reports no intent when the location carries no flag', () => {
    const { result } = renderHook(() => useInstallIntent())

    expect(result.current).toBe(false)
  })

  it('reports the intent when the location carries the flag', () => {
    visit('/integrations/slack/si1?install=1')

    const { result } = renderHook(() => useInstallIntent())

    expect(result.current).toBe(true)
  })

  it('strips the flag so a refresh does not reopen a dismissed popup', () => {
    visit('/integrations/slack/si1?install=1')

    renderHook(() => useInstallIntent())

    expect(window.location.search).toBe('')
    expect(window.location.pathname).toBe('/integrations/slack/si1')
  })

  it('leaves every other query param where it found it', () => {
    visit('/integrations/slack/si1?install=1&botId=b1#setup')

    const { result } = renderHook(() => useInstallIntent())

    expect(result.current).toBe(true)

    expect(window.location.search).toBe('?botId=b1')
    expect(window.location.hash).toBe('#setup')
  })

  it('reports the intent to every instance of the same page, not just the first', () => {
    // @note Slack renders three install buttons, each of which reads the flag.
    // Were it consumed during render, the first to mount would take it out from
    // under the others and the one meant to answer it would never open

    visit('/integrations/slack/si1?install=1')

    const { result } = renderHook(() => [
      useInstallIntent(),
      useInstallIntent(),
      useInstallIntent(),
    ])

    expect(result.current).toEqual([true, true, true])

    // @note cleared exactly once, by whichever effect ran first
    expect(window.location.search).toBe('')
  })

  it('does not report the intent a second time once the flag is consumed', () => {
    visit('/integrations/slack/si1?install=1')

    const { result, rerender } = renderHook(() => useInstallIntent())

    expect(result.current).toBe(true)

    // @note a remount is what a back navigation looks like - the flag is gone
    // from the location by then, so nothing asks for the popup again
    const { result: remounted } = renderHook(() => useInstallIntent())

    rerender()

    expect(remounted.current).toBe(false)
  })
})
