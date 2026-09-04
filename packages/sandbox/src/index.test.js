// @note these tests run real commands through the real runtime rather than
// asserting against a mock. That is the point of this package: if `echo` does
// not echo, the default is not a working sandbox and there is nothing here
// worth having.

import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { jest } from '@jest/globals'

const dataDir = mkdtempSync(join(tmpdir(), 'sandbox-test-'))

process.env.SANDBOX_DATA_DIR = dataDir

const { default: provider, reset } = await import('./index.ts')

jest.setTimeout(120_000)

afterAll(async () => {
  await reset()

  rmSync(dataDir, { recursive: true, force: true })
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

  it('reports a command that could not run as an error', async () => {
    const result = await provider.exec({
      sandboxId: 'a',
      cmd: 'no-such-command-anywhere',
    })

    expect(result.exitCode).not.toBe(0)
  })

  it('starts in the workspace', async () => {
    const result = await provider.exec({ sandboxId: 'a', cmd: 'pwd' })

    expect(result.stdout.trim()).toBe('/workspace')
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
      cmd: 'cat /workspace/input.txt',
      files: [{ path: '/workspace/input.txt', contents: 'seeded' }],
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

  it('runs node', async () => {
    const result = await provider.exec({
      sandboxId: 'a',
      cmd: 'node -e "console.log(21 * 2)"',
    })

    expect(result.stdout.trim()).toBe('42')
  })
})

describe('sessions', () => {
  // @note a `sessionId` shares the filesystem and nothing else, which is the
  // honest encoding of what a fresh process per command can offer. These
  // assertions pin that a `cd` and a variable both end with the command, the
  // same divergence from a real machine the previous default documented, so a
  // future version that starts carrying shell state has to come here and say
  // so.

  it('does not carry the working directory between calls', async () => {
    await provider.exec({
      sandboxId: 'a',
      sessionId: 's1',
      cmd: 'mkdir -p /workspace/sub && cd /workspace/sub',
    })

    const result = await provider.exec({
      sandboxId: 'a',
      sessionId: 's1',
      cmd: 'pwd',
    })

    expect(result.stdout.trim()).toBe('/workspace')
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

  it('reports exit status and stderr of a session command', async () => {
    const result = await provider.exec({
      sandboxId: 'a',
      sessionId: 's1',
      cmd: 'echo oops 1>&2; false',
    })

    expect(result.exitCode).toBe(1)
    expect(result.stderr.trim()).toBe('oops')
  })

  it('passes environment into a session', async () => {
    const result = await provider.exec({
      sandboxId: 'a',
      sessionId: 's1',
      cmd: 'echo "$QUOTED"',
      env: { QUOTED: "it's here" },
    })

    expect(result.stdout.trim()).toBe("it's here")
  })

  it('shares written files between sessions of one sandbox', async () => {
    await provider.exec({
      sandboxId: 'a',
      sessionId: 's1',
      cmd: 'echo shared > /tmp/shared',
    })

    const result = await provider.exec({
      sandboxId: 'a',
      sessionId: 's2',
      cmd: 'cat /tmp/shared',
    })

    expect(result.stdout.trim()).toBe('shared')
  })

  it('stays usable after a command outran its timeout', async () => {
    await expect(
      provider.exec({
        sandboxId: 'a',
        sessionId: 's3',
        cmd: 'sleep 30',
        timeout: 300,
      })
    ).rejects.toMatchObject({ sandbox: true, code: 'EXEC_TIMEOUT' })

    const result = await provider.exec({
      sandboxId: 'a',
      sessionId: 's3',
      cmd: 'echo recovered',
    })

    expect(result.stdout.trim()).toBe('recovered')
  })

  it('serializes overlapping commands on one sandbox', async () => {
    const [slow, fast] = await Promise.all([
      provider.exec({ sandboxId: 'a', cmd: 'sleep 1; echo slow' }),
      provider.exec({ sandboxId: 'a', cmd: 'echo fast' }),
    ])

    expect(slow.stdout.trim()).toBe('slow')
    expect(fast.stdout.trim()).toBe('fast')
  })
})

describe('timeouts', () => {
  it('aborts a command that outruns its timeout', async () => {
    await expect(
      provider.exec({ sandboxId: 'a', cmd: 'sleep 30', timeout: 300 })
    ).rejects.toMatchObject({ sandbox: true, code: 'EXEC_TIMEOUT' })
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
      path: '/workspace/out.txt',
      contents: 'written',
    })

    const result = await provider.readFile({
      sandboxId: 'a',
      path: '/workspace/out.txt',
    })

    expect(result.contents).toBe('written')
  })

  it('reports a missing file as FILE_NOT_FOUND', async () => {
    await expect(
      provider.readFile({ sandboxId: 'a', path: '/workspace/missing.txt' })
    ).rejects.toMatchObject({ sandbox: true, code: 'FILE_NOT_FOUND' })
  })

  it('makes a written file visible to commands', async () => {
    await provider.writeFile({
      sandboxId: 'a',
      path: '/workspace/out.txt',
      contents: 'visible',
    })

    const result = await provider.exec({
      sandboxId: 'a',
      cmd: 'cat /workspace/out.txt',
    })

    expect(result.stdout.trim()).toBe('visible')
  })
})

describe('runCode', () => {
  it('runs javascript', async () => {
    const result = await provider.runCode({
      sandboxId: 'a',
      language: 'javascript',
      code: 'console.log(6 * 7)',
    })

    expect(result.exitCode).toBe(0)
    expect(result.stdout.trim()).toBe('42')
  })

  it('keeps javascript bindings within a session', async () => {
    await provider.runCode({
      sandboxId: 'a',
      sessionId: 'j1',
      language: 'javascript',
      code: 'globalThis.answer = 42',
    })

    const result = await provider.runCode({
      sandboxId: 'a',
      sessionId: 'j1',
      language: 'javascript',
      code: 'console.log(answer)',
    })

    expect(result.stdout.trim()).toBe('42')
  })

  it('reports a javascript error on stderr with a non-zero exit', async () => {
    const result = await provider.runCode({
      sandboxId: 'a',
      sessionId: 'j1',
      language: 'javascript',
      code: 'throw new Error("boom")',
    })

    expect(result.exitCode).not.toBe(0)
    expect(result.stderr).toContain('boom')

    // @note and the session survives it

    const after = await provider.runCode({
      sandboxId: 'a',
      sessionId: 'j1',
      language: 'javascript',
      code: 'console.log(answer)',
    })

    expect(after.stdout.trim()).toBe('42')
  })

  it('runs a typed node session through exec', async () => {
    const result = await provider.exec({
      sandboxId: 'a',
      sessionId: 'n1',
      sessionType: 'node',
      cmd: 'console.log("typed")',
    })

    expect(result.stdout.trim()).toBe('typed')
  })

  // @note python is what the installed sidecar makes it: either it runs, or
  // the package says so honestly. Both are asserted, so that the day the
  // runtime ships nothing here has to change but the README.

  it('either runs python or reports it unsupported', async () => {
    try {
      const result = await provider.runCode({
        sandboxId: 'a',
        language: 'python',
        code: 'print(6 * 7)',
      })

      expect(result.stdout.trim()).toBe('42')
    } catch (error) {
      expect(error).toMatchObject({
        sandbox: true,
        code: 'UNSUPPORTED_OPERATION',
      })
      expect(error.message).toMatch(/python/i)
    }
  })
})

describe('network', () => {
  it('refuses the host', async () => {
    const result = await provider.exec({
      sandboxId: 'a',
      cmd: `node -e "fetch('http://127.0.0.1:8080/').then(() => console.log('reached')).catch((e) => console.log('refused', e.cause?.message || e.message))"`,
      timeout: 15000,
    })

    expect(result.stdout).toMatch(/^refused/)
    expect(result.stdout).toMatch(/EACCES|blocked/)
  })
})

describe('persistence', () => {
  it('keeps the workspace across the VM being disposed', async () => {
    await provider.exec({
      sandboxId: 'p',
      cmd: 'echo durable > /workspace/durable.txt; echo gone > /tmp/gone.txt',
    })

    await reset()

    const kept = await provider.exec({
      sandboxId: 'p',
      cmd: 'cat /workspace/durable.txt',
    })

    expect(kept.stdout.trim()).toBe('durable')

    const lost = await provider.exec({ sandboxId: 'p', cmd: 'cat /tmp/gone.txt' })

    expect(lost.exitCode).not.toBe(0)
  })
})

describe('assertConfigured', () => {
  it('resolves, because the sidecar runs here', async () => {
    await expect(provider.assertConfigured()).resolves.toBeUndefined()
  })
})
