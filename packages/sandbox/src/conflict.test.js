// @note the runtime is faked here, and only here: the conflict below is what
// the sidecar answers while it is still tearing down a timed-out command, and
// how long that takes depends on machine load, so the real runtime cannot be
// made to answer it on cue. The retry is what makes the sequence in
// index.test.js dependable, and this pins the retry itself.

import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { jest } from '@jest/globals'

const dataDir = mkdtempSync(join(tmpdir(), 'sandbox-conflict-test-'))

process.env.SANDBOX_DATA_DIR = dataDir

const CONFLICT =
  'ERR_AGENTOS_VM_EXECUTION_CONFLICT: WebAssembly execution state for VM vm-1 is already in use during start WebAssembly execution'

const conflict = () => ({ outcome: 'failed', error: { message: CONFLICT } })

const succeeded = (stdout) => ({ outcome: 'succeeded', exitCode: 0, stdout })

/** Answers per command, consumed front to back; the last answer repeats. */
const answers = new Map()

const exec = jest.fn(async (cmd) => {
  const queue = answers.get(cmd) ?? [succeeded('')]

  return queue.length > 1 ? queue.shift() : queue[0]
})

const execute = jest.fn(async () => succeeded(''))

jest.unstable_mockModule('@rivet-dev/agentos-core', () => ({
  AgentOs: {
    create: async () => ({
      process: { exec },
      javascript: { execute },
      python: {
        execute: async () => ({
          outcome: 'failed',
          error: { message: 'ENOENT: command not found: python' },
        }),
      },
      contexts: { reset: async () => {} },
      createContext: async () => {},
      filesystem: {},
      dispose: async () => {},
    }),
  },
  createHostDirBackend: () => ({}),
}))

const { default: provider, reset } = await import('./index.ts')

jest.setTimeout(30_000)

afterEach(() => {
  answers.clear()
  exec.mockClear()
  execute.mockClear()
})

afterAll(async () => {
  await reset()

  rmSync(dataDir, { recursive: true, force: true })
})

it('runs a command again once the runtime lets go of the previous one', async () => {
  answers.set('echo recovered', [conflict(), conflict(), succeeded('recovered\n')])

  const result = await provider.exec({ sandboxId: 'a', cmd: 'echo recovered' })

  expect(result.exitCode).toBe(0)
  expect(result.stdout).toBe('recovered\n')
  expect(exec.mock.calls.filter(([cmd]) => cmd === 'echo recovered')).toHaveLength(3)
})

it('does the same for code in a session', async () => {
  execute
    .mockResolvedValueOnce(conflict())
    .mockResolvedValueOnce(succeeded('1\n'))

  const result = await provider.runCode({
    sandboxId: 'a',
    language: 'javascript',
    code: 'console.log(1)',
  })

  expect(result.stdout).toBe('1\n')
  expect(execute).toHaveBeenCalledTimes(2)
})

it('reports a conflict that never clears as a command that could not run', async () => {
  answers.set('echo stuck', [conflict()])

  const started = Date.now()

  const result = await provider.exec({ sandboxId: 'a', cmd: 'echo stuck' })

  expect(result.exitCode).toBe(127)
  expect(result.error).toMatch(/ERR_AGENTOS_VM_EXECUTION_CONFLICT/)
  expect(Date.now() - started).toBeGreaterThanOrEqual(4_500)
  expect(exec.mock.calls.filter(([cmd]) => cmd === 'echo stuck').length).toBeGreaterThan(10)
})
