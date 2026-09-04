// @note the driver is exercised through a real VM rather than by calling its
// methods: what matters is what `ls`, `cat`, a redirect and `node` see, and
// the kernel's own sequence of calls - `lstat` per entry after a listing,
// 64KB `pread` slices, a truncating `writeFile` before the real one - is what
// the caches exist for.

import { jest } from '@jest/globals'

import { AgentOs } from '@rivet-dev/agentos-core'

import { createStorageDriver } from './mount.ts'
import { createFakeStore } from './store.fake.js'

const PREFIX = 'spaces/s1/data'

const PERMISSIONS = {
  fs: 'allow',
  childProcess: 'allow',
  process: 'allow',
  env: 'allow',
  binding: 'allow',
  network: 'allow',
}

// @note generous because the runtime, not the driver, sets the pace: at this
// version a stalled pipe holds a command for its ten-second blocking-read
// limit and a process started meanwhile wedges the VM, so one slow step on a
// CI runner cascades into the tests after it. @todo once
// rivet-dev/agentos#1959 is fixed in a pinned release, bring this back to the
// default and put the `| sort` back into the nested-directories test.

jest.setTimeout(120_000)

let store
let vm

beforeAll(async () => {
  store = createFakeStore({
    [`${PREFIX}/hello.txt`]: 'hi there\n',
    [`${PREFIX}/sub/a.txt`]: 'A\n',
    [`${PREFIX}/sub/deeper/b.txt`]: 'B\n',
    [`${PREFIX}/empty/`]: '',
  })

  vm = await AgentOs.create({
    permissions: PERMISSIONS,
    user: { uid: process.getuid(), gid: process.getgid() },
    mounts: [
      {
        path: '/space',
        driver: createStorageDriver({
          store,
          scope: 'space',
          prefix: PREFIX,
          uid: process.getuid(),
          gid: process.getgid(),
        }),
        readOnly: false,
      },
    ],
  })
}, 60_000)

afterAll(async () => {
  await vm?.dispose()
})

const sh = async (cmd) => {
  const result = await vm.process.exec(cmd, {
    cwd: '/space',
    output: { capture: 'all' },
    timeoutMs: 30_000,
  })

  return { code: result.exitCode ?? 0, out: result.stdout ?? '', err: result.stderr ?? '' }
}

describe('reading', () => {
  it('lists objects as files and prefixes as directories', async () => {
    const { code, out } = await sh('ls /space')

    expect(code).toBe(0)
    expect(out.trim().split('\n').sort()).toEqual(['empty', 'hello.txt', 'sub'])
  })

  it('shows an empty directory marker as a directory', async () => {
    const { out } = await sh('[ -d /space/empty ] && echo dir')

    expect(out.trim()).toBe('dir')
  })

  it('reads a file', async () => {
    const { out } = await sh('cat /space/hello.txt')

    expect(out).toBe('hi there\n')
  })

  it('walks nested directories', async () => {
    // @note no `| sort`: a pipe between two guest commands stalls for the
    // runtime's blocking-read limit at this version (rivet-dev/agentos#1959),
    // and a second process started while it stalls wedges the VM. See the
    // timeout note at the top for when to restore it.

    const { out } = await sh('find /space -type f')

    expect(out.trim().split('\n').sort()).toEqual([
      '/space/hello.txt',
      '/space/sub/a.txt',
      '/space/sub/deeper/b.txt',
    ])
  })

  it('reports a missing file the way a shell expects', async () => {
    const { code, err } = await sh('cat /space/missing.txt')

    expect(code).not.toBe(0)
    expect(err).toMatch(/No such file/)
  })

  it('serves a large file through pread slices', async () => {
    store.objects.set(`${PREFIX}/big.bin`, {
      bytes: new Uint8Array(200_000).fill(7),
      updatedAt: new Date(),
    })

    const { out } = await sh(
      `node -e "const b=require('fs').readFileSync('/space/big.bin');console.log(b.length, b[0], b[199999])"`
    )

    expect(out.trim()).toBe('200000 7 7')
  })
})

describe('writing', () => {
  it('stores a redirect as an object the platform reads back', async () => {
    await sh('echo written > /space/new.txt')

    expect(store.text(`${PREFIX}/new.txt`)).toBe('written\n')
  })

  it('appends', async () => {
    await sh('echo more >> /space/new.txt')

    expect(store.text(`${PREFIX}/new.txt`)).toBe('written\nmore\n')
  })

  it('creates a directory as a marker object', async () => {
    const { code } = await sh('mkdir /space/made && [ -d /space/made ]')

    expect(code).toBe(0)
    expect(store.objects.has(`${PREFIX}/made/`)).toBe(true)
  })

  it('writes into a directory it made', async () => {
    await sh('echo inner > /space/made/inner.txt')

    expect(store.text(`${PREFIX}/made/inner.txt`)).toBe('inner\n')
  })

  it('moves a file', async () => {
    const { code } = await sh('mv /space/new.txt /space/made/moved.txt')

    expect(code).toBe(0)
    expect(store.objects.has(`${PREFIX}/new.txt`)).toBe(false)
    expect(store.text(`${PREFIX}/made/moved.txt`)).toBe('written\nmore\n')
  })

  it('moves a directory tree', async () => {
    const { code } = await sh('mv /space/made /space/renamed && cat /space/renamed/inner.txt')

    expect(code).toBe(0)
    expect(store.text(`${PREFIX}/renamed/inner.txt`)).toBe('inner\n')
    expect([...store.objects.keys()].some((key) => key.startsWith(`${PREFIX}/made/`))).toBe(false)
  })

  it('removes a file', async () => {
    await sh('rm /space/renamed/moved.txt')

    expect(store.objects.has(`${PREFIX}/renamed/moved.txt`)).toBe(false)
  })

  it('refuses to remove a directory that is not empty', async () => {
    const { code } = await sh('rmdir /space/renamed')

    expect(code).not.toBe(0)
    expect(store.text(`${PREFIX}/renamed/inner.txt`)).toBe('inner\n')
  })

  it('removes a tree', async () => {
    const { code } = await sh('rm -r /space/renamed && [ ! -e /space/renamed ]')

    expect(code).toBe(0)
    expect([...store.objects.keys()].some((key) => key.startsWith(`${PREFIX}/renamed`))).toBe(false)
  })

  it('writes binary content from node', async () => {
    const { out } = await sh(
      `node -e "const fs=require('fs');fs.writeFileSync('/space/n.bin',Buffer.alloc(70000,1));console.log(fs.statSync('/space/n.bin').size)"`
    )

    expect(out.trim()).toBe('70000')
    expect(store.objects.get(`${PREFIX}/n.bin`).bytes.byteLength).toBe(70000)
  })

  it('sees an object the platform wrote after the fact', async () => {
    store.objects.set(`${PREFIX}/late.txt`, {
      bytes: new TextEncoder().encode('late\n'),
      updatedAt: new Date(),
    })

    // @note stats are trusted for a few seconds; a fresh name has none

    const { out } = await sh('cat /space/late.txt')

    expect(out).toBe('late\n')
  })
})

describe('boundaries', () => {
  it('cannot reach outside the prefix', async () => {
    store.objects.set('spaces/other/data/secret.txt', {
      bytes: new TextEncoder().encode('no\n'),
      updatedAt: new Date(),
    })

    const { code } = await sh('cat /space/../../other/data/secret.txt')

    expect(code).not.toBe(0)
    expect([...store.objects.keys()].filter((key) => !key.startsWith(PREFIX)).length).toBe(1)
  })

  it('refuses symlinks', async () => {
    const { code } = await sh('ln -s /space/hello.txt /space/link')

    expect(code).not.toBe(0)
  })
})
