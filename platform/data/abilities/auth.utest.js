import abilities from '@/data/abilities/all'

// @note every catalogue template that targets an auxiliary route must carry
// `options.auth: internal` so the action executor injects the temporary user
// token; auxiliary routes reject anonymous callers (see
// pages/api/auxiliary/README.md).

const AUXILIARY_URL = /^\s*url:\s*['"]?\/api\/auxiliary\//m
// @note either the `options.auth: internal` key or the fenced action parameter
// form (```fetch/auth=internal) is accepted by the action executor
const INTERNAL_AUTH =
  /^\s*auth:\s*['"]?internal['"]?\s*$|^\s*```fetch\/.*\bauth=internal\b/m

describe('auxiliary catalogue templates', () => {
  const auxiliary = Object.entries(abilities).filter(([, template]) =>
    AUXILIARY_URL.test(template.instruction)
  )

  it('finds the auxiliary templates', () => {
    expect(auxiliary.length).toBeGreaterThan(100)
  })

  it('carries options.auth internal on every auxiliary template', () => {
    const offenders = auxiliary
      .filter(([, template]) => !INTERNAL_AUTH.test(template.instruction))
      .map(([key]) => key)

    expect(offenders).toEqual([])
  })
})
