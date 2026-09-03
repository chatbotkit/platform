// @note the interpreter-backed half of this package's behaviour, verified here
// rather than in `src/index.test.js`.
//
// It is not that these cases are slow or need configuration. They cannot run
// under jest at all: `just-bash` loads its vendored CPython build by resolving a
// URL relative to `import.meta.url`, and jest's experimental VM module loader
// does not give it one, so `python3` fails with `TypeError: Invalid URL` on a
// build that works perfectly under node. Asserting against that would be
// asserting against the test runner.
//
// Run with `pnpm script:verify-interpreters`. Exits non-zero on the first
// failure, so it is usable as a gate.

import assert from 'node:assert/strict'

import provider from '../src/index.ts'

async function check(name, fn) {
  await fn()

  console.log(`ok - ${name}`)
}

await check('python runs and returns its output', async () => {
  const result = await provider.runCode({
    sandboxId: 'verify',
    code: 'print(6 * 7)',
    language: 'python',
  })

  assert.equal(result.exitCode, 0, result.stderr)
  assert.equal(result.stdout.trim(), '42')
})

await check('a python traceback comes back on stderr', async () => {
  const result = await provider.runCode({
    sandboxId: 'verify',
    code: 'raise ValueError("nope")',
    language: 'python',
  })

  assert.notEqual(result.exitCode, 0)
  assert.match(result.stderr, /nope/)
})

await check('python bindings do not survive between calls', async () => {
  await provider.runCode({
    sandboxId: 'verify',
    sessionId: 's1',
    code: 'value = 1',
    language: 'python',
  })

  const result = await provider.runCode({
    sandboxId: 'verify',
    sessionId: 's1',
    code: 'print(value)',
    language: 'python',
  })

  // @note the documented divergence from a backend that holds a live
  // interpreter and would print `1`. See the README.

  assert.notEqual(result.exitCode, 0)
})

await check('javascript runs and returns its output', async () => {
  const result = await provider.runCode({
    sandboxId: 'verify',
    code: 'console.log(40 + 2)',
    language: 'javascript',
  })

  assert.equal(result.exitCode, 0, result.stderr)
  assert.equal(result.stdout.trim(), '42')
})

console.log('\nall interpreter checks passed')

// @note explicit, and load-bearing. The QuickJS worker behind `js-exec` keeps
// the event loop alive after the command finishes, so this script hangs at the
// end without it. That is worth knowing beyond this file - see the README's note
// on running the JavaScript interpreter in a long-lived process.

process.exit(0)
