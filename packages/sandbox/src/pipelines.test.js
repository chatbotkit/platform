import { AgentOs } from '@rivet-dev/agentos-core'

let vm

beforeAll(async () => {
  vm = await AgentOs.create({
    // @note a short watchdog exposes the pipe stall as EAGAIN instead of
    // waiting ten seconds per stage (rivet-dev/agentos#1959)
    limits: { resources: { maxBlockingReadMs: 500 } },
  })
}, 60_000)

afterAll(async () => {
  await vm?.dispose()
})

const sh = (cmd) =>
  vm.process.exec(cmd, {
    cwd: '/workspace',
    output: { capture: 'all' },
    timeoutMs: 5_000,
  })

it('sorts and filters environment output without a blocking-read failure', async () => {
  const env = await sh('env')
  const result = await sh("env | sort | sed -n '1,2p'")

  expect(env.exitCode).toBe(0)
  expect(result.exitCode).toBe(0)
  expect(result.stderr).toBe('')
  expect(result.stdout).toBe(
    env.stdout.trim().split('\n').sort().slice(0, 2).join('\n') + '\n'
  )
})

it.each([
  ['seq 1 5 | paste -sd,', '1,2,3,4,5\n'],
  ['seq 1 5000 | tail -n 1', '5000\n'],
])('preserves all expected output through %s', async (cmd, expected) => {
  const result = await sh(cmd)

  expect(result.exitCode).toBe(0)
  expect(result.stderr).toBe('')
  expect(result.stdout).toBe(expected)
})
