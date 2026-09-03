// @note these tests run real commands through the real interpreter rather than
// asserting against a mock. That is the point of this package: if `echo` does
// not echo, the default is not a working sandbox and there is nothing here
// worth having.

import { jest } from '@jest/globals'

import provider, { reset } from './index.ts'

beforeEach(() => {
  reset()
})

describe('exec', () => {
  it('runs a command and reports its output', async () => {
    const result = await provider.exec({
      sandboxId: 'a',
      cmd: 'echo hello',
    })

    expect(result.exitCode).toBe(0)
    expect(result.stdout.trim()).toBe('hello')
    expect(result.mountedPaths).toEqual([])
  })

  it('reports a non-zero exit rather than throwing', async () => {
    const result = await provider.exec({
      sandboxId: 'a',
      cmd: 'exit 3',
    })

    expect(result.exitCode).toBe(3)
  })

  it('keeps the filesystem across calls to the same sandbox', async () => {
    await provider.exec({ sandboxId: 'a', cmd: 'echo kept > /tmp/note' })

    const result = await provider.exec({ sandboxId: 'a', cmd: 'cat /tmp/note' })

    expect(result.stdout.trim()).toBe('kept')
  })

  it('keeps sandboxes apart', async () => {
    await provider.exec({ sandboxId: 'a', cmd: 'echo mine > /tmp/note' })

    const result = await provider.exec({ sandboxId: 'b', cmd: 'cat /tmp/note' })

    expect(result.exitCode).not.toBe(0)
  })

  it('writes files before running the command', async () => {
    const result = await provider.exec({
      sandboxId: 'a',
      cmd: 'cat /work/input.txt',
      files: [{ path: '/work/input.txt', contents: 'seeded' }],
    })

    expect(result.stdout.trim()).toBe('seeded')
  })

  it('passes environment through', async () => {
    const result = await provider.exec({
      sandboxId: 'a',
      cmd: 'echo $GREETING',
      env: { GREETING: 'hi' },
    })

    expect(result.stdout.trim()).toBe('hi')
  })

  // @note the divergence from a real machine, pinned. A `cd` and a variable
  // assignment both end with the command that made them, where a VM-backed
  // backend holds a live shell and both survive. These assertions exist so that
  // the day `just-bash` starts carrying shell state, someone has to come here
  // and decide whether the README still tells the truth.

  it('does not carry the working directory between calls', async () => {
    await provider.exec({
      sandboxId: 'a',
      sessionId: 's1',
      cmd: 'mkdir -p /work/sub && cd /work/sub',
    })

    const result = await provider.exec({
      sandboxId: 'a',
      sessionId: 's1',
      cmd: 'pwd',
    })

    expect(result.stdout.trim()).not.toBe('/work/sub')
  })

  it('does not carry shell variables between calls', async () => {
    await provider.exec({ sandboxId: 'a', sessionId: 's1', cmd: 'FOO=bar' })

    const result = await provider.exec({
      sandboxId: 'a',
      sessionId: 's1',
      cmd: 'echo "[$FOO]"',
    })

    expect(result.stdout.trim()).toBe('[]')
  })

  it('shares written files between sessions of one sandbox', async () => {
    await provider.exec({
      sandboxId: 'a',
      sessionId: 's1',
      cmd: 'echo shared > /tmp/note',
    })

    const result = await provider.exec({
      sandboxId: 'a',
      sessionId: 's2',
      cmd: 'cat /tmp/note',
    })

    expect(result.stdout.trim()).toBe('shared')
  })
})

describe('timeouts', () => {
  // @note that the signal is honoured rather than merely passed. A timeout that
  // returns on time and leaves the script interpreting inside this process is
  // the failure mode the whole design of `toSignal` exists to avoid, and it
  // would look identical from the outside.

  it('aborts a command that outruns its timeout', async () => {
    await expect(
      provider.exec({ sandboxId: 'a', cmd: 'sleep 30', timeout: 50 })
    ).rejects.toMatchObject({ sandbox: true, code: 'EXEC_TIMEOUT' })
  })

  it('does not relabel a command that chose to exit 124', async () => {
    const result = await provider.exec({ sandboxId: 'a', cmd: 'exit 124' })

    expect(result.exitCode).toBe(124)
  })

  it('leaves a command that finishes in time alone', async () => {
    const result = await provider.exec({
      sandboxId: 'a',
      cmd: 'echo quick',
      timeout: 10000,
    })

    expect(result.exitCode).toBe(0)
    expect(result.stdout.trim()).toBe('quick')
  })
})

describe('mounts', () => {
  // @note the platform is told the truth about what it can reach. A backend
  // that cannot mount reports nothing mounted, and never asks storage to mint
  // credentials for a mount that is not going to happen.

  it('reports nothing mounted and never resolves credentials', async () => {
    const resolve = jest.fn()

    const result = await provider.exec({
      sandboxId: 'a',
      cmd: 'echo hello',
      mounts: {
        requests: [{ path: '/space', scope: 'space', prefix: 'spaces/1' }],
        resolve,
      },
    })

    expect(result.mountedPaths).toEqual([])
    expect(resolve).not.toHaveBeenCalled()
  })
})

describe('files', () => {
  it('writes and reads back', async () => {
    await provider.writeFile({
      sandboxId: 'a',
      path: '/work/out.txt',
      contents: 'written',
    })

    const result = await provider.readFile({
      sandboxId: 'a',
      path: '/work/out.txt',
    })

    expect(result.contents).toBe('written')
  })

  it('reports a missing file as FILE_NOT_FOUND', async () => {
    await expect(
      provider.readFile({ sandboxId: 'a', path: '/work/missing.txt' })
    ).rejects.toMatchObject({ sandbox: true, code: 'FILE_NOT_FOUND' })
  })

  it('makes a written file visible to commands', async () => {
    await provider.writeFile({
      sandboxId: 'a',
      path: '/work/out.txt',
      contents: 'visible',
    })

    const result = await provider.exec({
      sandboxId: 'a',
      cmd: 'cat /work/out.txt',
    })

    expect(result.stdout.trim()).toBe('visible')
  })
})

// @note there are no `runCode` cases here, and that is not an omission.
// `just-bash` loads its vendored CPython by resolving a path against
// `import.meta.url`, which jest's VM module loader does not provide, so
// `python3` fails with `TypeError: Invalid URL` under the runner and works
// under node. Testing it here would pin the runner's limitation rather than
// this package's behaviour.
//
// Those cases live in `scripts/verify-interpreters.js` - python output,
// tracebacks, the binding-persistence divergence, and javascript - and run with
// `pnpm script:verify-interpreters`. Do not "fix" the gap by moving them back.

describe('development only', () => {
  const nodeEnv = process.env.NODE_ENV

  beforeEach(() => {
    process.env.NODE_ENV = 'production'
  })

  afterEach(() => {
    process.env.NODE_ENV = nodeEnv
  })

  it('refuses every operation under NODE_ENV=production before touching a shell', async () => {
    for (const call of [
      () => provider.exec({ sandboxId: 'p', cmd: 'echo ok' }),
      () =>
        provider.runCode({ sandboxId: 'p', language: 'python', code: '1' }),
      () => provider.readFile({ sandboxId: 'p', path: '/etc/passwd' }),
      () => provider.writeFile({ sandboxId: 'p', path: '/tmp/x', contents: 'x' }),
    ]) {
      await expect(call()).rejects.toMatchObject({
        sandbox: true,
        code: 'SANDBOX_UNAVAILABLE',
      })
    }
  })

  it('fails the configuration check with the install to make instead', async () => {
    await expect(provider.assertConfigured()).rejects.toThrow(
      /development only.*isolated implementation/
    )
  })

  it('runs again once the environment is not production', async () => {
    process.env.NODE_ENV = nodeEnv

    const result = await provider.exec({ sandboxId: 'p', cmd: 'echo ok' })

    expect(result.stdout.trim()).toBe('ok')
  })
})

describe('assertConfigured', () => {
  it('resolves, because there is nothing to configure', async () => {
    await expect(provider.assertConfigured()).resolves.toBeUndefined()
  })
})
