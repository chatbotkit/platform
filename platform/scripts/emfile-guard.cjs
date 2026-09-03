// @note preloaded with `node --require` during the image build. Next's
// build-trace collection (@vercel/nft) opens files with unbounded
// concurrency through fs.promises, and on hosts with a modest descriptor
// limit the build dies with EMFILE. graceful-fs cannot help - it patches the
// callback API only - so this shim wraps the promise API to wait and retry
// when the descriptor table is full, which turns a crash into brief
// backpressure. It is deliberately dependency-free and safe to preload into
// every node process of the build.

const fsp = require('node:fs/promises')

const RETRY_DELAY_MS = 25

function guard(fn) {
  return async function guarded(...args) {
    for (;;) {
      try {
        return await fn.apply(this, args)
      } catch (error) {
        if (error?.code !== 'EMFILE' && error?.code !== 'ENFILE') {
          throw error
        }

        await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS))
      }
    }
  }
}

for (const name of [
  'open',
  'readFile',
  'writeFile',
  'copyFile',
  'stat',
  'lstat',
  'readdir',
  'readlink',
  'realpath',
  'opendir',
  'access',
]) {
  fsp[name] = guard(fsp[name])
}
